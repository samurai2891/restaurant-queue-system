import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  createStore: vi.fn().mockResolvedValue(1),
  addStoreStaff: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getStoresByOwnerId: vi.fn().mockResolvedValue([
    {
      id: 1,
      ownerId: 1,
      name: "Test Store",
      description: "Test Description",
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      isReceptionPaused: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getStoreByStaffUserId: vi.fn().mockResolvedValue([]),
  getStoreById: vi.fn().mockResolvedValue({
    id: 1,
    ownerId: 1,
    name: "Test Store",
    description: "Test Description",
    subscriptionPlan: "free",
    subscriptionStatus: "active",
    isReceptionPaused: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getStaffByUserAndStore: vi.fn().mockResolvedValue({
    id: 1,
    storeId: 1,
    userId: 1,
    role: "owner",
    isActive: true,
  }),
  updateStore: vi.fn().mockResolvedValue(undefined),
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
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("store.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new store and adds owner as staff", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.store.create({
      name: "New Restaurant",
      description: "A test restaurant",
    });

    expect(result).toEqual({ id: 1 });
  });
});

describe("store.list", () => {
  it("returns stores owned by the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.store.list();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Store");
  });
});

describe("store.get", () => {
  it("returns store details for authorized user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.store.get({ id: 1 });

    expect(result.name).toBe("Test Store");
    expect(result.subscriptionPlan).toBe("free");
  });
});
