import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Data Export Router
// ============================================
export const dataExportRouter = router({
  export: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      type: z.enum([
        "parties",
        "notifications",
        "orders",
        "order_items",
        "audit_logs",
        "subscriptions",
        "daily_analytics",
      ]),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const dateStamp = new Date().toISOString().slice(0, 10);
      const toIso = (value?: Date | null) => (value ? value.toISOString() : "");
      const toText = (value?: unknown) => (value === null || value === undefined ? "" : String(value));
      const toJson = (value?: unknown) => (value ? JSON.stringify(value) : "");

      if (input.type === "parties") {
        const items = await db.getPartiesByStoreId(input.storeId);
        const header = [
          "id",
          "storeId",
          "ticketNumber",
          "guestName",
          "partySize",
          "childCount",
          "hasStroller",
          "phone",
          "email",
          "lineUserId",
          "preferredSeatTypeId",
          "assignedSeatTypeId",
          "status",
          "priority",
          "notes",
          "allergies",
          "accessToken",
          "estimatedWaitMinutes",
          "registeredAt",
          "notifiedAt",
          "arrivedAt",
          "seatedAt",
          "completedAt",
          "createdAt",
          "updatedAt",
        ];
        const rows = items.map((item) => [
          item.id,
          item.storeId,
          item.ticketNumber,
          item.guestName,
          item.partySize,
          item.childCount,
          item.hasStroller,
          item.phone,
          item.email,
          item.lineUserId,
          item.preferredSeatTypeId,
          item.assignedSeatTypeId,
          item.status,
          item.priority,
          item.notes,
          item.allergies,
          item.accessToken,
          item.estimatedWaitMinutes,
          toIso(item.registeredAt),
          toIso(item.notifiedAt),
          toIso(item.arrivedAt),
          toIso(item.seatedAt),
          toIso(item.completedAt),
          toIso(item.createdAt),
          toIso(item.updatedAt),
        ].map(toText).map(escapeCsv).join(","));
        return {
          fileName: `parties-${input.storeId}-${dateStamp}.csv`,
          csv: [header.map(escapeCsv).join(","), ...rows].join("\n"),
        };
      }

      if (input.type === "notifications") {
        // Not implemented
        return {
          fileName: `notifications-${input.storeId}-${dateStamp}.csv`,
          csv: "Not implemented",
        };
        const items: any[] = [];
        const header = [
          "id",
          "storeId",
          "partyId",
          "type",
          "channel",
          "recipient",
          "subject",
          "message",
          "status",
          "errorMessage",
          "externalId",
          "sentAt",
          "deliveredAt",
          "createdAt",
        ];
        const rows = items.map((item) => [
          item.id,
          item.storeId,
          item.partyId,
          item.type,
          item.channel,
          item.recipient,
          item.subject,
          item.message,
          item.status,
          item.errorMessage,
          item.externalId,
          toIso(item.sentAt),
          toIso(item.deliveredAt),
          toIso(item.createdAt),
        ].map(toText).map(escapeCsv).join(","));
        return {
          fileName: `notifications-${input.storeId}-${dateStamp}.csv`,
          csv: [header.map(escapeCsv).join(","), ...rows].join("\n"),
        };
      }

      if (input.type === "orders" || input.type === "order_items") {
        // These exports are not yet implemented
        return {
          fileName: `${input.type}-${input.storeId}-${dateStamp}.csv`,
          csv: "Not implemented",
        };
      }

      if (input.type === "audit_logs" || input.type === "subscriptions") {
        // These exports are not yet implemented
        return {
          fileName: `${input.type}-${input.storeId}-${dateStamp}.csv`,
          csv: "Not implemented",
        };
      }

      // daily_analytics export
      const items = await db.getDailyAnalytics(input.storeId, "", "");
      const header = [
        "id",
        "storeId",
        "date",
        "totalParties",
        "totalGuests",
        "seatedCount",
        "canceledCount",
        "noshowCount",
        "avgWaitTime",
        "maxWaitTime",
        "minWaitTime",
        "avgTurnoverTime",
        "notificationsSent",
        "notificationsDelivered",
        "notificationsFailed",
        "totalOrders",
        "totalOrderAmount",
        "preorderCount",
        "createdAt",
        "updatedAt",
      ];
      const rows = items.map((item) => [
        item.id,
        item.storeId,
        item.date,
        item.totalParties,
        item.totalGuests,
        item.seatedCount,
        item.canceledCount,
        item.noshowCount,
        item.avgWaitTime,
        item.maxWaitTime,
        item.minWaitTime,
        item.avgTurnoverTime,
        item.notificationsSent,
        item.notificationsDelivered,
        item.notificationsFailed,
        item.totalOrders,
        item.totalOrderAmount,
        item.preorderCount,
        toIso(item.createdAt),
        toIso(item.updatedAt),
      ].map(toText).map(escapeCsv).join(","));
      return {
        fileName: `daily-analytics-${input.storeId}-${dateStamp}.csv`,
        csv: [header.map(escapeCsv).join(","), ...rows].join("\n"),
      };
    }),
});

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (dateOnlyPattern.test(value)) {
    if (boundary === "start") {
      date.setUTCHours(0, 0, 0, 0);
    } else {
      date.setUTCHours(23, 59, 59, 999);
    }
  }
  return date;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function formatCsvValue(value: unknown) {
  if (value === null || value === undefined) return escapeCsv("");
  return escapeCsv(String(value));
}
