import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { sendNotificationWithRetry } from "../_core/guestNotification";
import { buildNotificationMessage, resolveNotificationRecipient } from "../_core/notificationHelpers";
import { checkStoreAccess } from "./helpers";

// ============================================
// Notification Router
// ============================================
export const notificationRouter = router({
  // 通知送信
  send: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyId: z.number(),
      type: z.enum(["registration", "notify", "remind", "seated", "custom"]),
      channel: z.enum(["sms", "line", "email"]),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const party = await db.getPartyById(input.partyId);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      // 送信先を決定
      const recipient = resolveNotificationRecipient(party, input.channel);
      if (!recipient) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "送信先が設定されていません" });
      }

      // テンプレートからメッセージを生成
      const store = await db.getStoreById(input.storeId);
      const message = await buildNotificationMessage({
        storeId: input.storeId,
        store: store ?? undefined,
        party,
        type: input.type,
        channel: input.channel,
        messageOverride: input.message,
      });

      // 通知レコード作成
      const notificationId = await db.createNotification({
        storeId: input.storeId,
        partyId: input.partyId,
        type: input.type,
        channel: input.channel,
        recipient,
        message,
        status: "pending",
      });

      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }

      const sendResult = await sendNotificationWithRetry({
        channel: input.channel,
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

      if (sendResult.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: sendResult.errorMessage || "通知送信に失敗しました",
        });
      }

      return { id: notificationId, success: true };
    }),

  // 通知履歴取得
  history: protectedProcedure
    .input(z.object({ storeId: z.number(), partyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getNotificationsByPartyId(input.partyId);
    }),

  // テンプレート一覧
  templates: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getNotificationTemplatesByStoreId(input.storeId);
    }),

  // テンプレート作成
  createTemplate: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      type: z.enum(["registration", "notify", "remind", "seated", "custom"]),
      channel: z.enum(["sms", "line", "email"]),
      name: z.string(),
      subject: z.string().optional(),
      template: z.string(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createNotificationTemplate(input);
      return { id };
    }),
});
