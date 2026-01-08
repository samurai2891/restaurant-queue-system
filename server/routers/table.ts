import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Table Router
// ============================================
export const tableRouter = router({
  // テーブル一覧取得
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getTablesByStoreId(input.storeId);
    }),

  // テーブルとパーティ情報を一緒に取得（キャッシャー画面用）
  listWithParties: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getTablesWithPartiesByStoreId(input.storeId);
    }),

  // テーブル作成
  create: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string().min(1),
      maxCapacity: z.number().min(1).default(4),
      section: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createTable(input);
      return { id };
    }),

  // 一括作成（例: A-1〜A-6を一度に作成）
  createBatch: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      prefix: z.string().min(1), // "A", "B", "カウンター" など
      startNumber: z.number().min(1).default(1),
      count: z.number().min(1).max(20).default(6),
      maxCapacity: z.number().min(1).default(4),
      section: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      
      const ids: number[] = [];
      const existingTables = await db.getTablesByStoreId(input.storeId);
      const maxSortOrder = existingTables.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0);
      
      for (let i = 0; i < input.count; i++) {
        const num = input.startNumber + i;
        const name = `${input.prefix}-${num}`;
        
        // 既存のテーブル名と重複チェック
        const exists = existingTables.some(t => t.name === name);
        if (exists) continue;
        
        const id = await db.createTable({
          storeId: input.storeId,
          name,
          maxCapacity: input.maxCapacity,
          section: input.section || input.prefix,
          sortOrder: maxSortOrder + i + 1,
        });
        ids.push(id);
      }
      
      return { ids, createdCount: ids.length };
    }),

  // テーブル更新
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      maxCapacity: z.number().optional(),
      section: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateTable(id, data);
      return { success: true };
    }),

  // テーブル削除（論理削除）
  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      await db.updateTable(input.id, { isActive: false });
      return { success: true };
    }),
});
