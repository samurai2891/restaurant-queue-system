import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getStoreById: vi.fn().mockResolvedValue({
    id: 1,
    ownerId: 1,
    name: "Test Store",
    subscriptionPlan: "free",
    subscriptionStatus: "active",
    stripeCustomerId: null,
  }),
  getStaffByUserAndStore: vi.fn().mockResolvedValue({
    id: 1,
    storeId: 1,
    userId: 1,
    role: "owner",
    isActive: true,
  }),
}));

// Mock Stripe functions
vi.mock("./stripe/stripe", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({
    url: "https://checkout.stripe.com/test-session",
  }),
  createPortalSession: vi.fn().mockResolvedValue({
    url: "https://billing.stripe.com/test-portal",
  }),
  stripe: {},
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {
        origin: "https://example.com",
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("subscription.plans", () => {
  it("returns all available subscription plans", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscription.plans();

    expect(result).toHaveLength(3);
    expect(result.map(p => p.id)).toEqual(["free", "standard", "premium"]);
    
    const freePlan = result.find(p => p.id === "free");
    expect(freePlan?.price).toBe(0);
    expect(freePlan?.name).toBe("フリープラン");
    
    const standardPlan = result.find(p => p.id === "standard");
    expect(standardPlan?.price).toBe(4980);
  });
});

describe("subscription.current", () => {
  it("returns current subscription for store owner", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscription.current({ storeId: 1 });

    expect(result.plan).toBe("free");
    expect(result.status).toBe("active");
    expect(result.planDetails).toBeDefined();
  });
});

describe("subscription.createCheckout", () => {
  it("creates checkout session for standard plan", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscription.createCheckout({
      storeId: 1,
      plan: "standard",
    });

    expect(result.url).toBe("https://checkout.stripe.com/test-session");
  });

  it("creates checkout session for premium plan", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscription.createCheckout({
      storeId: 1,
      plan: "premium",
    });

    expect(result.url).toBe("https://checkout.stripe.com/test-session");
  });
});
