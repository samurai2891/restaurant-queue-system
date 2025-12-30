import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe, constructWebhookEvent } from "./stripe";
import { getPlanByPriceId } from "./products";
import * as db from "../db";

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // テストイベントの検出
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("[Webhook] Checkout session completed:", session.id);

        const storeId = session.metadata?.store_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (storeId && customerId) {
          // 店舗のStripeカスタマーIDを更新
          await db.updateStore(parseInt(storeId), {
            stripeCustomerId: customerId,
          });

          // サブスクリプション情報を取得してプランを更新
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
            const priceId = subscription.items.data[0]?.price.id;
            const plan = getPlanByPriceId(priceId || "");

            if (plan) {
              await db.updateStore(parseInt(storeId), {
                subscriptionPlan: plan,
                subscriptionStatus: "active",
              });

              // サブスクリプション履歴を記録
              const periodStart = (subscription as any).current_period_start;
              const periodEnd = (subscription as any).current_period_end;
              await db.createSubscription({
                storeId: parseInt(storeId),
                stripeSubscriptionId: subscriptionId,
                plan: plan,
                status: "active",
                currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
                currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[Webhook] Subscription updated:", subscription.id);

        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanByPriceId(priceId || "");
        const status = subscription.status;

        // ローカルDBのサブスクリプションを更新
        const existingSub = await db.getSubscriptionByStripeId(subscription.id);
        if (existingSub) {
          const periodStart = (subscription as any).current_period_start;
          const periodEnd = (subscription as any).current_period_end;
          await db.updateSubscription(existingSub.id, {
            status: status as any,
            currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
          });

          // 店舗のステータスも更新
          await db.updateStore(existingSub.storeId, {
            subscriptionStatus: status as any,
            subscriptionPlan: plan || existingSub.plan,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log("[Webhook] Subscription deleted:", subscription.id);

        const existingSub = await db.getSubscriptionByStripeId(subscription.id);
        if (existingSub) {
          await db.updateSubscription(existingSub.id, {
            status: "canceled",
            canceledAt: new Date(),
          });

          // 店舗をフリープランに戻す
          await db.updateStore(existingSub.storeId, {
            subscriptionPlan: "free",
            subscriptionStatus: "canceled",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        console.log("[Webhook] Invoice paid:", invoice.id);
        // 支払い成功のログ記録など
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("[Webhook] Invoice payment failed:", invoice.id);

        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          const existingSub = await db.getSubscriptionByStripeId(subscriptionId);
          if (existingSub) {
            await db.updateStore(existingSub.storeId, {
              subscriptionStatus: "past_due",
            });
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Error processing event:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
