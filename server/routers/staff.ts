import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { checkStoreAccess } from "./helpers";

// ============================================
// Staff Router
// ============================================
export const staffRouter = router({
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const staffList = await db.getStoreStaff(input.storeId);

      // ユーザー情報を取得
      const staffWithUsers = await Promise.all(
        staffList.map(async (s) => {
          const user = await db.getUserById(s.userId);
          return { ...s, user };
        })
      );

      return staffWithUsers;
    }),

  add: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
      role: z.enum(["manager", "cashier", "host", "staff", "kitchen"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);

      const existing = await db.getStaffByUserAndStore(input.userId, input.storeId);
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このユーザーは既にスタッフとして登録されています" });
      }

      const id = await db.addStoreStaff(input);
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      role: z.enum(["manager", "cashier", "host", "staff", "kitchen"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateStoreStaff(id, data);
      return { success: true };
    }),
});
