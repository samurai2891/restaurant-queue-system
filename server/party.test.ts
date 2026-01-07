import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Stripe初期化（ENV未設定）でテストが落ちるのを防ぐ
vi.mock("./stripe/stripe", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  stripe: {},
}));

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
    // Given: 前提条件（認証不要で受付登録可能）
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // When: 実行する操作（ゲスト受付）
    const result = await caller.party.guestRegister({
      storeId: 1,
      guestName: "山田太郎",
      partySize: 3,
      phone: "090-1234-5678",
    });

    // Then: 期待する結果/検証（受付番号/アクセストークンが返る）
    expect(result.ticketNumber).toBe(101);
    expect(result.accessToken).toBe("test-token-123");
    expect(result.estimatedWaitMinutes).toBe(null);
  });
});

describe("party.guestStatus", () => {
  it("returns party status for valid access token", async () => {
    // Given: 前提条件（有効なaccessToken）
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // When: 実行する操作（待ち状況取得）
    const result = await caller.party.guestStatus({
      accessToken: "test-token-123",
    });

    // Then: 期待する結果/検証（基本情報が返る）
    expect(result.ticketNumber).toBe(101);
    expect(result.status).toBe("waiting");
    expect(result.position).toBe(1);
    expect(result.storeName).toBe("Test Store");
    expect(result.canOrder).toBe(true);
  });

  it("TC-N-01: guestStatus canOrder=true when posStatus=OPEN and release rule allows", async () => {
    // Given: 前提条件（enablePosV2UI=false + 解放ルールOK + posStatus=OPEN）
    vi.mocked(db.getStoreById).mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      name: "Test Store",
      isReceptionPaused: false,
      orderReleaseRank: 5,
      enablePosV2UI: false,
    } as any);
    vi.mocked(db.getPartyByAccessToken).mockResolvedValueOnce({
      id: 1,
      storeId: 1,
      ticketNumber: 101,
      guestName: "田中太郎",
      partySize: 2,
      status: "waiting",
      accessToken: "test-token-123",
      registeredAt: new Date(),
      preferredSeatTypeId: null,
      estimatedWaitMinutes: null,
      posStatus: "OPEN",
    } as any);
    vi.mocked(db.getPartyPosition).mockResolvedValueOnce(1);

    // When: 実行する操作（待ち状況取得）
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.party.guestStatus({ accessToken: "test-token-123" });

    // Then: 期待する結果/検証（注文可能）
    expect(result.canOrder).toBe(true);
  });

  it("TC-N-02: guestStatus canOrder=false when posStatus=PAYMENT_LOCKED even if release rule allows", async () => {
    // Given: 前提条件（解放ルールOKでも、会計中は注文不可）
    vi.mocked(db.getStoreById).mockResolvedValueOnce({
      id: 1,
      ownerId: 1,
      name: "Test Store",
      isReceptionPaused: false,
      orderReleaseRank: 5,
      enablePosV2UI: false,
    } as any);
    vi.mocked(db.getPartyByAccessToken).mockResolvedValueOnce({
      id: 1,
      storeId: 1,
      ticketNumber: 101,
      guestName: "田中太郎",
      partySize: 2,
      status: "waiting",
      accessToken: "test-token-123",
      registeredAt: new Date(),
      preferredSeatTypeId: null,
      estimatedWaitMinutes: null,
      posStatus: "PAYMENT_LOCKED",
    } as any);
    vi.mocked(db.getPartyPosition).mockResolvedValueOnce(1);

    // When: 実行する操作（待ち状況取得）
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.party.guestStatus({ accessToken: "test-token-123" });

    // Then: 期待する結果/検証（注文不可）
    expect(result.canOrder).toBe(false);
  });

  for (const blockedStatus of ["PAID", "VOID", "MEMO_ONLY"] as const) {
    it(`TC-B: guestStatus canOrder=false when posStatus=${blockedStatus}`, async () => {
      // Given: 前提条件（posStatusが注文不可ステータス）
      vi.mocked(db.getStoreById).mockResolvedValueOnce({
        id: 1,
        ownerId: 1,
        name: "Test Store",
        isReceptionPaused: false,
        orderReleaseRank: 5,
        enablePosV2UI: false,
      } as any);
      vi.mocked(db.getPartyByAccessToken).mockResolvedValueOnce({
        id: 1,
        storeId: 1,
        ticketNumber: 101,
        guestName: "田中太郎",
        partySize: 2,
        status: "waiting",
        accessToken: "test-token-123",
        registeredAt: new Date(),
        preferredSeatTypeId: null,
        estimatedWaitMinutes: null,
        posStatus: blockedStatus,
      } as any);
      vi.mocked(db.getPartyPosition).mockResolvedValueOnce(1);

      // When: 実行する操作（待ち状況取得）
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.party.guestStatus({ accessToken: "test-token-123" });

      // Then: 期待する結果/検証（注文不可）
      expect(result.canOrder).toBe(false);
    });
  }
});

describe("party.list", () => {
  it("returns all parties for authorized staff", async () => {
    // Given: 前提条件（認証済みスタッフ）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // When: 実行する操作（受付一覧取得）
    const result = await caller.party.list({ storeId: 1 });

    // Then: 期待する結果/検証（一覧が返る）
    expect(result).toHaveLength(2);
    expect(result[0].ticketNumber).toBe(101);
    expect(result[1].ticketNumber).toBe(102);
  });
});
