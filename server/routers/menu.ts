import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Menu Router
// ============================================
export const menuRouter = router({
  // カテゴリ一覧
  categories: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      return db.getMenuCategoriesByStoreId(input.storeId);
    }),

  // カテゴリ作成
  createCategory: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
      availableTime: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuCategory(input);
      return { id };
    }),

  // カテゴリ更新
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
      availableTime: z.any().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateMenuCategory(id, data);
      return { success: true };
    }),

  // 商品一覧
  items: publicProcedure
    .input(z.object({ storeId: z.number(), categoryId: z.number().optional() }))
    .query(async ({ input }) => {
      if (input.categoryId) {
        return db.getMenuItemsByCategoryId(input.categoryId);
      }
      return db.getMenuItemsByStoreId(input.storeId);
    }),

  // 商品作成
  createItem: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      categoryId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      price: z.string(),
      imageUrl: z.string().optional(),
      prepTimeMinutes: z.number().optional(),
      allergens: z.any().optional(),
      calories: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuItem(input);
      return { id };
    }),

  // 商品更新
  updateItem: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      imageUrl: z.string().optional(),
      allergens: z.any().optional(),
      categoryId: z.number().optional(),
      isAvailable: z.boolean().optional(),
      stockCount: z.number().optional(),
      prepTimeMinutes: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateMenuItem(id, data);
      return { success: true };
    }),

  // モディファイア取得（商品単位）
  modifiers: publicProcedure
    .input(z.object({ menuItemId: z.number() }))
    .query(async ({ input }) => {
      return db.getMenuModifiersByItemId(input.menuItemId);
    }),

  // 店舗全体のモディファイア取得
  allModifiers: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      return db.getMenuModifiersByStoreId(input.storeId);
    }),

  // モディファイア作成
  createModifier: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      menuItemId: z.number(),
      name: z.string(),
      price: z.string().optional(),
      isRequired: z.boolean().optional(),
      maxSelections: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuModifier(input);
      return { id };
    }),
});
