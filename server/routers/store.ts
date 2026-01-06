import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Store Router
// ============================================
export const storeRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await db.createStore({
        ...input,
        ownerId: ctx.user.id,
      });

      // オーナーをスタッフとして追加
      await db.addStoreStaff({
        storeId,
        userId: ctx.user.id,
        role: "owner",
      });

      return { id: storeId };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const ownedStores = await db.getStoresByOwnerId(ctx.user.id);
    const staffStores = await db.getStoreByStaffUserId(ctx.user.id);

    // 重複を除去
    const allStores = [...ownedStores];
    for (const store of staffStores) {
      if (!allStores.find(s => s.id === store.id)) {
        allStores.push(store);
      }
    }

    return allStores;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.id);
      return db.getStoreById(input.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      businessHours: z.any().optional(),
      receptionHours: z.any().optional(),
      isReceptionPaused: z.boolean().optional(),
      maxQueueSize: z.number().optional(),
      orderReleaseRank: z.number().optional(),
      orderReleaseMinutes: z.number().optional(),
      autoNotifyRank: z.number().optional(),
      autoNotifyMinutes: z.number().optional(),
      lineChannelAccessToken: z.string().optional(),
      lineChannelSecret: z.string().optional(),
      smsEnabled: z.boolean().optional(),
      enablePosV2UI: z.boolean().optional(),
      enableHandheld: z.boolean().optional(),
      enableMemoTicket: z.boolean().optional(),
      enableDraftHandoff: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await checkStoreAccess(ctx.user.id, id, ["owner", "manager"]);
      await db.updateStore(id, data);
      return { success: true };
    }),

  toggleReception: protectedProcedure
    .input(z.object({ id: z.number(), paused: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.id, ["owner", "manager", "host"]);
      await db.updateStore(input.id, { isReceptionPaused: input.paused });
      return { success: true };
    }),
});
