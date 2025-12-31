import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getStoreById: vi.fn().mockResolvedValue({
    id: 1,
    ownerId: 1,
    name: "Test Store",
    isReceptionPaused: false,
    orderReleaseRank: 5,
  }),
  getStaffByUserAndStore: vi.fn().mockResolvedValue({
    id: 1,
    storeId: 1,
    userId: 1,
    role: "owner",
    isActive: true,
  }),
  calculateEstimatedWaitTime: vi.fn().mockResolvedValue(15),
  createParty: vi.fn().mockResolvedValue({
    id: 1,
    ticketNumber: 101,
    accessToken: "test-token-123",
  }),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getPartiesByStoreId: vi.fn().mockResolvedValue([
    {
      id: 1,
      storeId: 1,
      ticketNumber: 101,
      guestName: "田中太郎",
      partySize: 2,
      status: "waiting",
      registeredAt: new Date(),
    },
    {
      id: 2,
      storeId: 1,
      ticketNumber: 102,
      guestName: "佐藤花子",
      partySize: 4,
      status: "waiting",
      registeredAt: new Date(),
    },
  ]),
  getSeatTypesByStoreId: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "テーブル席",
      minPartySize: 1,
      maxPartySize: 4,
    },
  ]),
  getPartyByAccessToken: vi.fn().mockResolvedValue({
    id: 1,
    storeId: 1,
    ticketNumber: 101,
    guestName: "田中太郎",
    partySize: 2,
    status: "waiting",
    accessToken: "test-token-123",
    registeredAt: new Date(),
  }),
  getPartyPosition: vi.fn().mockResolvedValue(1),
  getSeatTypeById: vi.fn().mockResolvedValue({
    id: 1,
    name: "テーブル席",
    minPartySize: 1,
    maxPartySize: 4,
  }),
  updateParty: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(1),
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

describe("party.guestRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows guest to register without authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.party.guestRegister({
      storeId: 1,
      guestName: "山田太郎",
      partySize: 3,
      phone: "090-1234-5678",
    });

    expect(result.ticketNumber).toBe(101);
    expect(result.accessToken).toBe("test-token-123");
    expect(result.estimatedWaitMinutes).toBe(null);
  });
});

describe("party.guestStatus", () => {
  it("returns party status for valid access token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.party.guestStatus({
      accessToken: "test-token-123",
    });

    expect(result.ticketNumber).toBe(101);
    expect(result.status).toBe("waiting");
    expect(result.position).toBe(1);
    expect(result.storeName).toBe("Test Store");
  });
});

describe("party.list", () => {
  it("returns all parties for authorized staff", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.party.list({ storeId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].ticketNumber).toBe(101);
    expect(result[1].ticketNumber).toBe(102);
  });
});
