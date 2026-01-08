import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Analytics Router
// ============================================
export const analyticsRouter = router({
  // ダッシュボード概要
  dashboard: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // 今日のパーティ取得
      const parties = await db.getPartiesByStoreId(input.storeId);

      // 統計計算
      const totalParties = parties.length;
      const waitingCount = parties.filter(p => p.status === "waiting").length;
      const seatedCount = parties.filter(p => p.status === "seated").length;
      const canceledCount = parties.filter(p => p.status === "canceled").length;
      const noshowCount = parties.filter(p => p.status === "noshow").length;

      // 平均待ち時間
      const seatedParties = parties.filter(p => p.seatedAt && p.registeredAt);
      const avgWaitTime = seatedParties.length > 0
        ? Math.round(seatedParties.reduce((sum, p) => {
          const wait = (new Date(p.seatedAt!).getTime() - new Date(p.registeredAt).getTime()) / 60000;
          return sum + wait;
        }, 0) / seatedParties.length)
        : 0;

      // 席種別空き状況
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);

      // 今日の注文
      const orders = await db.getOrdersByStoreId(input.storeId);
      const totalOrders = orders.length;
      const totalOrderAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      return {
        date: todayStr,
        totalParties,
        waitingCount,
        seatedCount,
        canceledCount,
        noshowCount,
        avgWaitTime,
        seatTypes: seatTypes.map(s => ({
          id: s.id,
          name: s.name,
          totalSeats: s.totalSeats,
          availableSeats: s.availableSeats,
        })),
        totalOrders,
        totalOrderAmount,
      };
    }),

  // 期間別分析
  period: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getDailyAnalytics(input.storeId, input.startDate, input.endDate);
    }),

  waitTimeByHour: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getWaitTimeStatsByHour(input.storeId, input.startDate, input.endDate);
    }),

  // ============================================
  // 売上分析
  // ============================================

  // 日別売上サマリー（グラフ・テーブル用）
  salesDailySummary: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getSalesDailySummary(input.storeId, input.startDate, input.endDate);
    }),

  // 特定日の売上詳細
  salesDailyDetail: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getSalesDailyDetail(input.storeId, input.date);
    }),

  // カテゴリー別売上
  salesByCategory: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getSalesByCategory(input.storeId, input.date);
    }),
});
