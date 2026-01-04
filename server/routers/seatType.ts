import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Seat Type Router
// ============================================
export const seatTypeRouter = router({
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getSeatTypesByStoreId(input.storeId);
    }),

  create: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      minPartySize: z.number().min(1).default(1),
      maxPartySize: z.number().min(1).default(4),
      totalSeats: z.number().min(1).default(10),
      avgTurnoverMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);

      const id = await db.createSeatType({
        ...input,
        availableSeats: input.totalSeats,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      minPartySize: z.number().optional(),
      maxPartySize: z.number().optional(),
      totalSeats: z.number().optional(),
      availableSeats: z.number().optional(),
      avgTurnoverMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateSeatType(id, data);
      return { success: true };
    }),
});
