import Stripe from "stripe";
import { ENV } from "./env";

export const stripe = new Stripe(ENV.stripeSecretKey || "", {
  // @ts-expect-error - Stripe API version
  apiVersion: "2025-04-30.basil",
});
