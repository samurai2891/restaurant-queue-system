import type { Party, Store } from "../../drizzle/schema";
import * as db from "../db";

export type NotificationChannel = "sms" | "line" | "email";
export type NotificationType = "registration" | "notify" | "remind" | "seated" | "custom";

const defaultMessages: Record<NotificationType, string> = {
  registration: "受付番号{{ticketNumber}}番でお受けしました。",
  notify: "{{ticketNumber}}番のお客様、お席の準備ができました。",
  remind: "{{ticketNumber}}番のお客様、まもなくお呼び出しです。",
  seated: "ご来店ありがとうございました。",
  custom: "",
};

const replaceTemplateVariables = (template: string, party: Party, store?: Store) =>
  template
    .replace(/\{\{ticketNumber\}\}/g, String(party.ticketNumber))
    .replace(/\{\{guestName\}\}/g, party.guestName || "お客様")
    .replace(/\{\{partySize\}\}/g, String(party.partySize))
    .replace(/\{\{storeName\}\}/g, store?.name || "")
    .replace(/\{\{waitTime\}\}/g, String(party.estimatedWaitMinutes || 0));

export const resolveNotificationRecipient = (
  party: Party,
  channel: NotificationChannel
): string | null => {
  if (channel === "sms" && party.phone) {
    return party.phone;
  }
  if (channel === "email" && party.email) {
    return party.email;
  }
  if (channel === "line" && party.lineUserId) {
    return party.lineUserId;
  }
  return null;
};

export async function buildNotificationMessage({
  storeId,
  store,
  party,
  type,
  channel,
  messageOverride,
}: {
  storeId: number;
  store?: Store;
  party: Party;
  type: NotificationType;
  channel: NotificationChannel;
  messageOverride?: string;
}) {
  if (messageOverride) {
    return messageOverride;
  }

  const storeRecord = store ?? (await db.getStoreById(storeId));
  const template = await db.getDefaultTemplate(storeId, type, channel);
  if (template) {
    return replaceTemplateVariables(template.template, party, storeRecord);
  }

  return replaceTemplateVariables(defaultMessages[type], party, storeRecord);
}
