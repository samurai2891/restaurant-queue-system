import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Payment Router (v1: Partyを伝票として会計確定)
// ============================================
export const paymentRouter = router({
  confirmCash: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
      cashReceived: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus !== "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計開始されていません" });
      }

      const orders = await db.getOrdersByPartyId(ticket.id);
      const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid");
      if (unpaidOrders.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計対象の明細がありません" });
      }

      const totalAmount = unpaidOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
      if (input.cashReceived < totalAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "受取金額が不足しています" });
      }

      for (const order of unpaidOrders) {
        await db.confirmOrderPayment(order.id, { paymentMethod: "cash" });
      }

      await db.updateParty(ticket.id, {
        posStatus: "PAID",
        paymentLockedAt: null,
        paymentLockedByStaffId: null,
      });

      const changeAmount = input.cashReceived - totalAmount;

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "payment.confirmCash",
        targetType: "party",
        targetId: ticket.id,
        details: {
          totalAmount,
          cashReceived: input.cashReceived,
          changeAmount,
          orderIds: unpaidOrders.map((o) => o.id),
        },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return {
        success: true,
        totalAmount,
        changeAmount,
      };
    }),

  confirmManual: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
      paymentMethod: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus !== "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計開始されていません" });
      }

      const orders = await db.getOrdersByPartyId(ticket.id);
      const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid");
      if (unpaidOrders.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計対象の明細がありません" });
      }

      const totalAmount = unpaidOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);

      for (const order of unpaidOrders) {
        await db.confirmOrderPayment(order.id, { paymentMethod: input.paymentMethod });
      }

      await db.updateParty(ticket.id, {
        posStatus: "PAID",
        paymentLockedAt: null,
        paymentLockedByStaffId: null,
      });

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "payment.confirmManual",
        targetType: "party",
        targetId: ticket.id,
        details: {
          totalAmount,
          paymentMethod: input.paymentMethod,
          orderIds: unpaidOrders.map((o) => o.id),
        },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return {
        success: true,
        totalAmount,
      };
    }),
});


