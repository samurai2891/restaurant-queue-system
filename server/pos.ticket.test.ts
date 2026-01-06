import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Stripe初期化（ENV未設定）でテストが落ちるのを防ぐ
vi.mock("./stripe/stripe", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  stripe: {},
}));

const mockDb = vi.hoisted(() => ({
  getStoreById: vi.fn(),
  getStaffByUserAndStore: vi.fn(),
  createParty: vi.fn(),
  getPartyById: vi.fn(),
  updateParty: vi.fn(),
  getOrdersByPartyId: vi.fn(),
  confirmOrderPayment: vi.fn(),
  getOrdersByStoreId: vi.fn(),
  getOrderItemsByOrderId: vi.fn(),
  createAuditLog: vi.fn(),
  updateOrder: vi.fn(),
  updateOrderItem: vi.fn(),
  getPartyByAccessToken: vi.fn(),
  getPartyPosition: vi.fn(),
  calculateEstimatedWaitTime: vi.fn(),
}));

vi.mock("./db", () => mockDb);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
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
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
      get: (key: string) => (key.toLowerCase() === "user-agent" ? "vitest" : undefined),
    } as unknown as TrpcContext["req"],
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

describe("POS v1 (ticket/payment) routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.getStoreById.mockResolvedValue({
      id: 1,
      ownerId: 1,
      name: "Test Store",
      enablePosV2UI: true,
      enableHandheld: true,
      orderReleaseRank: 5,
    });

    mockDb.getStaffByUserAndStore.mockResolvedValue({
      id: 1,
      storeId: 1,
      userId: 1,
      role: "cashier",
      isActive: true,
    });

    mockDb.createParty.mockResolvedValue({
      id: 10,
      ticketNumber: 1001,
      accessToken: "test-token-123",
    });

    mockDb.updateParty.mockResolvedValue(undefined);
    mockDb.createAuditLog.mockResolvedValue(1);
  });

  it("TC-N-01: ticket.lockForPayment sets PAYMENT_LOCKED when unpaidTotal > 0", async () => {
    // Given: 前提条件（未精算がある伝票）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "OPEN",
      status: "seated",
      partySize: 2,
    });
    mockDb.getOrdersByPartyId.mockResolvedValue([
      { id: 1, paymentStatus: "unpaid", totalAmount: "1000" },
      { id: 2, paymentStatus: "paid", totalAmount: "500" },
    ]);

    // When: 実行する操作（会計ロック開始）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ticket.lockForPayment({ storeId: 1, ticketId: 10 });

    // Then: 期待する結果/検証（PAYMENT_LOCKEDへ遷移）
    expect(result).toEqual({ success: true });
    expect(mockDb.updateParty).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ posStatus: "PAYMENT_LOCKED" })
    );
  });

  it("TC-A-01: ticket.lockForPayment rejects when posStatus is MEMO_ONLY", async () => {
    // Given: 前提条件（メモ伝票）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "MEMO_ONLY",
      posStatus: "MEMO_ONLY",
      status: "seated",
      partySize: 1,
    });

    // When: 実行する操作（会計ロック開始）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Then: 期待する結果/検証（BAD_REQUEST + メッセージ）
    await expect(
      caller.ticket.lockForPayment({ storeId: 1, ticketId: 10 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "メモ伝票は明細入力後に会計できます",
    });
  });

  it("TC-A-02: ticket.lockForPayment rejects when unpaidTotal is 0", async () => {
    // Given: 前提条件（未精算がない伝票）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "OPEN",
      status: "seated",
      partySize: 2,
    });
    mockDb.getOrdersByPartyId.mockResolvedValue([
      { id: 1, paymentStatus: "paid", totalAmount: "1000" },
    ]);

    // When: 実行する操作（会計ロック開始）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Then: 期待する結果/検証（会計対象なし）
    await expect(
      caller.ticket.lockForPayment({ storeId: 1, ticketId: 10 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "会計対象の明細がありません",
    });
  });

  it("TC-N-02: payment.confirmCash succeeds when cashReceived >= total", async () => {
    // Given: 前提条件（PAYMENT_LOCKED + 未精算合計=6800）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "PAYMENT_LOCKED",
      status: "seated",
      partySize: 2,
    });
    mockDb.getOrdersByPartyId.mockResolvedValue([
      { id: 1, paymentStatus: "unpaid", totalAmount: "4800" },
      { id: 2, paymentStatus: "unpaid", totalAmount: "2000" },
    ]);

    // When: 実行する操作（現金で確定）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payment.confirmCash({
      storeId: 1,
      ticketId: 10,
      cashReceived: 10000,
    });

    // Then: 期待する結果/検証（PAID + おつり計算）
    expect(result).toEqual({ success: true, totalAmount: 6800, changeAmount: 3200 });
    expect(mockDb.confirmOrderPayment).toHaveBeenCalledTimes(2);
    expect(mockDb.updateParty).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ posStatus: "PAID" })
    );
  });

  it("TC-A-03: payment.confirmCash rejects when cashReceived < total", async () => {
    // Given: 前提条件（PAYMENT_LOCKED + 未精算合計=6800）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "PAYMENT_LOCKED",
      status: "seated",
      partySize: 2,
    });
    mockDb.getOrdersByPartyId.mockResolvedValue([
      { id: 1, paymentStatus: "unpaid", totalAmount: "6800" },
    ]);

    // When: 実行する操作（不足金額で現金確定）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Then: 期待する結果/検証（BAD_REQUEST）
    await expect(
      caller.payment.confirmCash({ storeId: 1, ticketId: 10, cashReceived: 6799 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "受取金額が不足しています",
    });
  });

  it("TC-N-03: payment.confirmManual succeeds and marks ticket PAID", async () => {
    // Given: 前提条件（PAYMENT_LOCKED + 未精算あり）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "PAYMENT_LOCKED",
      status: "seated",
      partySize: 2,
    });
    mockDb.getOrdersByPartyId.mockResolvedValue([
      { id: 1, paymentStatus: "unpaid", totalAmount: "500" },
    ]);

    // When: 実行する操作（手動確定）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.payment.confirmManual({
      storeId: 1,
      ticketId: 10,
      paymentMethod: "external",
    });

    // Then: 期待する結果/検証（PAID）
    expect(result).toEqual({ success: true, totalAmount: 500 });
    expect(mockDb.confirmOrderPayment).toHaveBeenCalledWith(1, { paymentMethod: "external" });
    expect(mockDb.updateParty).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ posStatus: "PAID" })
    );
  });

  it("TC-A-04: order.create rejects when ticket is PAYMENT_LOCKED", async () => {
    // Given: 前提条件（会計ロック中のaccessToken）
    mockDb.getPartyByAccessToken.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      status: "waiting",
      posStatus: "PAYMENT_LOCKED",
      accessToken: "test-token-123",
      preferredSeatTypeId: null,
      estimatedWaitMinutes: null,
    });

    // When: 実行する操作（ゲスト注文作成）
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Then: 期待する結果/検証（会計中で拒否）
    await expect(
      caller.order.create({
        accessToken: "test-token-123",
        items: [{ menuItemId: 1, quantity: 1 }],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "会計中のため注文できません",
    });
  });

  it("TC-A-05: ticket.addItemsToTicket rejects when ticket is PAYMENT_LOCKED", async () => {
    // Given: 前提条件（PAYMENT_LOCKEDの伝票）
    mockDb.getPartyById.mockResolvedValue({
      id: 10,
      storeId: 1,
      ticketNumber: 1001,
      partyKind: "DINE_IN",
      posStatus: "PAYMENT_LOCKED",
      status: "seated",
      partySize: 2,
    });

    // When: 実行する操作（明細追加）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Then: 期待する結果/検証（会計中で拒否）
    await expect(
      caller.ticket.addItemsToTicket({
        storeId: 1,
        ticketId: 10,
        items: [{ menuItemId: 1, quantity: 1 }],
        entrySource: "staff_handheld",
        routeToKitchen: true,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "会計中のため追加できません",
    });
  });

  it("TC-N-04: order.list returns only routeToKitchen=true orders", async () => {
    // Given: 前提条件（routeToKitchenの混在）
    mockDb.getOrdersByStoreId.mockResolvedValue([
      { id: 1, storeId: 1, partyId: 10, routeToKitchen: true, status: "pending" },
      { id: 2, storeId: 1, partyId: 10, routeToKitchen: false, status: "served" },
    ]);
    mockDb.getOrderItemsByOrderId.mockResolvedValue([]);
    mockDb.getPartyById.mockResolvedValue({ id: 10, storeId: 1, ticketNumber: 1001 });

    // When: 実行する操作（キッチン用一覧）
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.order.list({ storeId: 1 });

    // Then: 期待する結果/検証（routeToKitchen=trueのみ）
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it("RBAC: ticket.create allows cashier and rejects staff", async () => {
    // Given: 前提条件（cashierは許可）
    mockDb.getStaffByUserAndStore.mockResolvedValueOnce({
      id: 1,
      storeId: 1,
      userId: 1,
      role: "cashier",
      isActive: true,
    });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // When: 実行する操作（伝票作成）
    await expect(
      caller.ticket.create({ storeId: 1, kind: "DINE_IN", partySize: 2 })
    ).resolves.toMatchObject({ id: 10, ticketNumber: 1001 });

    // Given: 前提条件（staffは拒否）
    mockDb.getStaffByUserAndStore.mockResolvedValueOnce({
      id: 2,
      storeId: 1,
      userId: 1,
      role: "staff",
      isActive: true,
    });

    // Then: 期待する結果/検証（FORBIDDEN + メッセージ）
    await expect(
      caller.ticket.create({ storeId: 1, kind: "DINE_IN", partySize: 2 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "この操作を行う権限がありません",
    });
  });
});
