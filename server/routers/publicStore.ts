import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

// ============================================
// Public Store Info (ゲスト用)
// ============================================
export const publicStoreRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const store = await db.getStoreById(input.id);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }

      return {
        id: store.id,
        name: store.name,
        description: store.description,
        address: store.address,
        phone: store.phone,
        isReceptionPaused: store.isReceptionPaused,
        businessHours: store.businessHours,
        receptionHours: store.receptionHours,
        enablePosV2UI: store.enablePosV2UI,
      };
    }),

  seatTypes: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);
      return seatTypes.map(s => ({
        id: s.id,
        name: s.name,
        minPartySize: s.minPartySize,
        maxPartySize: s.maxPartySize,
      }));
    }),

  waitingCount: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const parties = await db.getWaitingParties(input.storeId);
      return { count: parties.length };
    }),
});
