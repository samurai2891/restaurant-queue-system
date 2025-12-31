import type { Store } from "../../drizzle/schema";
import { nanoid } from "nanoid";

type NotificationChannel = "sms" | "line" | "email";

export type SendNotificationInput = {
  channel: NotificationChannel;
  recipient: string;
  message: string;
  subject?: string;
  store: Store;
};

export type SendNotificationResult = {
  status: "sent" | "failed";
  externalId?: string;
  errorMessage?: string;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const validateChannelConfig = (input: SendNotificationInput) => {
  if (input.channel === "sms" && !input.store.smsEnabled) {
    throw new Error("SMS通知が無効です");
  }
  if (input.channel === "line") {
    if (!input.store.lineChannelAccessToken || !input.store.lineChannelSecret) {
      throw new Error("LINE通知の設定が不足しています");
    }
  }
};

const dispatchNotification = async (input: SendNotificationInput) => {
  validateChannelConfig(input);
  console.info("[Notification] Dispatching message", {
    channel: input.channel,
    recipient: input.recipient,
    storeId: input.store.id,
  });
  return {
    externalId: `notif_${nanoid(10)}`,
  };
};

export async function sendNotificationWithRetry(
  input: SendNotificationInput
): Promise<SendNotificationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await dispatchNotification(input);
      return {
        status: "sent",
        externalId: result.externalId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("通知送信に失敗しました");
      console.warn("[Notification] Send attempt failed", {
        attempt,
        channel: input.channel,
        recipient: input.recipient,
        error: lastError.message,
      });

      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    status: "failed",
    errorMessage: lastError?.message || "通知送信に失敗しました",
  };
}
