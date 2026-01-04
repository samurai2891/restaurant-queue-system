import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createCheckoutSession, createPortalSession } from "../stripe/stripe";
import { SUBSCRIPTION_PLANS } from "../stripe/products";
import { checkStoreAccess } from "./helpers";

// ============================================
// Stripe Subscription Router
// ============================================
export const subscriptionRouter = router({
  // プラン一覧取得
  plans: publicProcedure.query(() => {
    return Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      features: plan.features,
    }));
  }),

  // 現在のサブスクリプション情報
  current: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);
      const store = await db.getStoreById(input.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }

      return {
        plan: store.subscriptionPlan,
        status: store.subscriptionStatus,
        planDetails: SUBSCRIPTION_PLANS[store.subscriptionPlan as keyof typeof SUBSCRIPTION_PLANS],
      };
    }),

  // チェックアウトセッション作成
  createCheckout: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      plan: z.enum(["standard", "premium"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);

      const planConfig = SUBSCRIPTION_PLANS[input.plan];
      if (!("priceId" in planConfig)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なプランです" });
      }

      const origin = ctx.req.headers.origin || "http://localhost:3000";

      const session = await createCheckoutSession({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || undefined,
        storeId: input.storeId,
        priceId: planConfig.priceId,
        successUrl: `${origin}/dashboard?payment=success`,
        cancelUrl: `${origin}/dashboard?payment=canceled`,
      });

      return { url: session.url };
    }),

  // カスタマーポータルセッション作成
  createPortal: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);

      const store = await db.getStoreById(input.storeId);
      if (!store?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripeカスタマーが設定されていません" });
      }

      const origin = ctx.req.headers.origin || "http://localhost:3000";

      const session = await createPortalSession({
        customerId: store.stripeCustomerId,
        returnUrl: `${origin}/dashboard`,
      });

      return { url: session.url };
    }),
});
