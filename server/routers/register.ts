import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Register Session Router (レジセッション管理)
// ============================================
export const registerRouter = router({
  // 開店処理（レジセッション開始）
  openSession: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      openingCash: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const today = new Date();
      const sessionDate = today.toISOString().split("T")[0];

      // Check if session already exists for today
      const existing = await db.getRegisterSessionByStoreAndDate(input.storeId, sessionDate);
      if (existing) {
        if (existing.status === "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "本日のレジセッションは既に開始されています" });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "本日のレジセッションは既に締め済みです" });
      }

      const sessionId = await db.createRegisterSession({
        storeId: input.storeId,
        sessionDate,
        status: "open",
        openingCash: String(input.openingCash),
        openedByStaffId: ctx.user.id,
      });

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "register.openSession",
        targetType: "registerSession",
        targetId: sessionId,
        details: { openingCash: input.openingCash, sessionDate },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return {
        success: true,
        sessionId,
        sessionDate,
        openingCash: input.openingCash,
      };
    }),

  // 現在のセッション取得
  getCurrentSession: protectedProcedure
    .input(z.object({
      storeId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      const today = new Date();
      const sessionDate = today.toISOString().split("T")[0];
      
      const session = await db.getRegisterSessionByStoreAndDate(input.storeId, sessionDate);
      return session ?? null;
    }),

  // 今日の会計履歴取得
  getPaymentHistory: protectedProcedure
    .input(z.object({
      storeId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const paidOrders = await db.getPaidOrdersForSession(input.storeId, today, tomorrow);

      // Get party info for each order
      const ordersWithParty = await Promise.all(
        paidOrders.map(async (order) => {
          const party = await db.getPartyById(order.partyId);
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount ?? 0),
            paymentMethod: order.paymentMethod,
            paidAt: order.paidAt,
            ticketNumber: party?.ticketNumber ?? null,
            tableLabel: party?.tableLabel ?? null,
            guestName: party?.guestName ?? null,
          };
        })
      );

      // Calculate totals
      const totalSales = ordersWithParty.reduce((sum, o) => sum + o.totalAmount, 0);
      const cashSales = ordersWithParty
        .filter(o => o.paymentMethod === "cash")
        .reduce((sum, o) => sum + o.totalAmount, 0);
      const cardSales = ordersWithParty
        .filter(o => o.paymentMethod === "card")
        .reduce((sum, o) => sum + o.totalAmount, 0);
      const otherSales = totalSales - cashSales - cardSales;

      return {
        orders: ordersWithParty,
        summary: {
          totalTransactions: ordersWithParty.length,
          totalSales,
          cashSales,
          cardSales,
          otherSales,
        },
      };
    }),

  // レジ締め処理
  closeSession: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      closingCash: z.number().min(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const today = new Date();
      const sessionDate = today.toISOString().split("T")[0];

      const session = await db.getRegisterSessionByStoreAndDate(input.storeId, sessionDate);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "本日のレジセッションが見つかりません" });
      }

      if (session.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "本日のレジセッションは既に締め済みです" });
      }

      // Calculate sales for today
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const paidOrders = await db.getPaidOrdersForSession(input.storeId, today, tomorrow);

      const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
      const cashSales = paidOrders
        .filter(o => o.paymentMethod === "cash")
        .reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
      const cardSales = paidOrders
        .filter(o => o.paymentMethod === "card")
        .reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
      const otherSales = totalSales - cashSales - cardSales;

      // Calculate expected cash
      const openingCash = Number(session.openingCash ?? 0);
      const expectedCash = openingCash + cashSales;
      const cashDifference = input.closingCash - expectedCash;

      // Update session
      await db.updateRegisterSession(session.id, {
        status: "closed",
        closingCash: String(input.closingCash),
        expectedCash: String(expectedCash),
        cashDifference: String(cashDifference),
        closedByStaffId: ctx.user.id,
        closedAt: new Date(),
        totalSales: String(totalSales),
        cashSales: String(cashSales),
        cardSales: String(cardSales),
        otherSales: String(otherSales),
        totalTransactions: paidOrders.length,
        notes: input.notes,
      });

      // Update daily analytics
      await db.upsertDailyAnalytics({
        storeId: input.storeId,
        date: sessionDate,
        totalOrders: paidOrders.length,
        totalOrderAmount: String(totalSales),
      });

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "register.closeSession",
        targetType: "registerSession",
        targetId: session.id,
        details: {
          sessionDate,
          openingCash,
          closingCash: input.closingCash,
          expectedCash,
          cashDifference,
          totalSales,
          cashSales,
          cardSales,
          otherSales,
          totalTransactions: paidOrders.length,
        },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return {
        success: true,
        summary: {
          sessionDate,
          openingCash,
          closingCash: input.closingCash,
          expectedCash,
          cashDifference,
          totalSales,
          cashSales,
          cardSales,
          otherSales,
          totalTransactions: paidOrders.length,
        },
      };
    }),

  // セッション履歴取得
  getSessionHistory: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getRegisterSessionHistory(input.storeId, input.limit ?? 30);
    }),
});
