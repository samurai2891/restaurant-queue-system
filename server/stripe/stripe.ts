import Stripe from "stripe";
import { ENV } from "../_core/env";

// Stripe クライアント初期化
export const stripe = new Stripe(ENV.stripeSecretKey || "", {
  // @ts-expect-error - Stripe API version
  apiVersion: "2024-11-20.acacia",
});

// チェックアウトセッション作成
export async function createCheckoutSession({
  userId,
  userEmail,
  userName,
  storeId,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: number;
  userEmail: string;
  userName?: string;
  storeId: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: userEmail,
    client_reference_id: userId.toString(),
    metadata: {
      user_id: userId.toString(),
      store_id: storeId.toString(),
      customer_email: userEmail,
      customer_name: userName || "",
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

// カスタマーポータルセッション作成
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// サブスクリプション取得
export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

// サブスクリプションキャンセル
export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

// 顧客作成
export async function createCustomer({
  email,
  name,
  metadata,
}: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}) {
  return await stripe.customers.create({
    email,
    name,
    metadata,
  });
}

// Webhook署名検証
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    ENV.stripeWebhookSecret || ""
  );
}
