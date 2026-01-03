import type { Party, Store } from "../../drizzle/schema";
import { sendNotificationWithRetry } from "./guestNotification";
import { buildNotificationMessage, resolveNotificationRecipient } from "./notificationHelpers";
import * as db from "../db";

const AUTO_NOTIFICATION_INTERVAL_MS = 60_000;
let isRunning = false;

const shouldAutoNotify = (
  store: Store,
  position: number,
  estimatedWaitMinutes: number | null | undefined
) => {
  const rankThreshold = store.autoNotifyRank ?? 0;
  const minutesThreshold = store.autoNotifyMinutes ?? 0;
  const byRank = rankThreshold > 0 && position > 0 && position <= rankThreshold;
  const byMinutes =
    minutesThreshold > 0 &&
    estimatedWaitMinutes !== null &&
    estimatedWaitMinutes !== undefined &&
    estimatedWaitMinutes <= minutesThreshold;
  return byRank || byMinutes;
};

const isSameDay = (date: Date, reference: Date) =>
  date.getFullYear() === reference.getFullYear() &&
  date.getMonth() === reference.getMonth() &&
  date.getDate() === reference.getDate();

const selectNotificationChannel = (party: Party, store: Store) => {
  if (party.lineUserId && store.lineChannelAccessToken && store.lineChannelSecret) {
    return "line" as const;
  }
  if (party.phone && store.smsEnabled) {
    return "sms" as const;
  }
  if (party.email) {
    return "email" as const;
  }
  return null;
};

const shouldSkipAlreadyNotified = async (partyId: number) => {
  const latest = await db.getLatestNotificationByPartyAndType(partyId, "notify");
  if (!latest?.createdAt) return false;
  const today = new Date();
  return isSameDay(latest.createdAt, today);
};

const handlePartyNotification = async (store: Store, party: Party, position: number) => {
  if (!shouldAutoNotify(store, position, party.estimatedWaitMinutes)) {
    return;
  }

  if (await shouldSkipAlreadyNotified(party.id)) {
    return;
  }

  const channel = selectNotificationChannel(party, store);
  if (!channel) {
    return;
  }

  const recipient = resolveNotificationRecipient(party, channel);
  if (!recipient) {
    return;
  }

  const message = await buildNotificationMessage({
    storeId: store.id,
    store,
    party,
    type: "notify",
    channel,
  });

  const notificationId = await db.createNotification({
    storeId: store.id,
    partyId: party.id,
    type: "notify",
    channel,
    recipient,
    message,
    status: "pending",
  });

  const sendResult = await sendNotificationWithRetry({
    channel,
    recipient,
    message,
    subject: undefined,
    store,
  });

  if (sendResult.status === "sent") {
    await db.updateNotification(notificationId, {
      status: "sent",
      sentAt: new Date(),
      externalId: sendResult.externalId,
    });
  } else {
    await db.updateNotification(notificationId, {
      status: "failed",
      errorMessage: sendResult.errorMessage,
    });
  }

  await db.createAuditLog({
    storeId: store.id,
    userId: null,
    action: "notification.auto_send",
    targetType: "notification",
    targetId: notificationId,
    details: {
      type: "notify",
      channel,
      status: sendResult.status,
      position,
      estimatedWaitMinutes: party.estimatedWaitMinutes ?? null,
    },
  });
};

const runAutoNotificationCycle = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const stores = await db.getStoresForAutoNotification();
    if (stores.length === 0) return;

    for (const store of stores) {
      if (store.isReceptionPaused) {
        continue;
      }

      const waitingParties = await db.getWaitingParties(store.id);
      if (waitingParties.length === 0) {
        continue;
      }

      for (let index = 0; index < waitingParties.length; index += 1) {
        const party = waitingParties[index];
        const position = index + 1;
        await handlePartyNotification(store, party, position);
      }
    }
  } catch (error) {
    console.error("[AutoNotification] Failed to run scheduler", error);
  } finally {
    isRunning = false;
  }
};

export function startAutoNotificationScheduler() {
  void runAutoNotificationCycle();
  setInterval(() => {
    void runAutoNotificationCycle();
  }, AUTO_NOTIFICATION_INTERVAL_MS);
}
