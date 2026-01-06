import { TRPCError } from "@trpc/server";
import * as db from "../db";

// ============================================
// Helper: Check store access
// ============================================
export async function checkStoreAccess(userId: number, storeId: number, requiredRoles?: string[]) {
  const staff = await db.getStaffByUserAndStore(userId, storeId);
  if (!staff || !staff.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "この店舗へのアクセス権限がありません" });
  }
  if (requiredRoles && !requiredRoles.includes(staff.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "この操作を行う権限がありません" });
  }
  return staff;
}

const buildOrderItemsData = async (
  items: Array<{
    menuItemId: number;
    quantity: number;
    modifiers?: unknown;
    notes?: string;
  }>
) => {
  let totalAmount = 0;
  const orderItemsData = [];

  for (const item of items) {
    const menuItem = await db.getMenuItemById(item.menuItemId);
    if (!menuItem || !menuItem.isAvailable || (menuItem.stockCount !== null && menuItem.stockCount <= 0)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `商品が利用できません: ${item.menuItemId}` });
    }

    if (menuItem.stockCount !== null && menuItem.stockCount < item.quantity) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `在庫が不足しています: ${menuItem.name}` });
    }

    const unitPrice = Number(menuItem.price);
    let modifierPrice = 0;

    if (item.modifiers && Array.isArray(item.modifiers)) {
      const modifiers = await db.getMenuModifiersByItemId(item.menuItemId);
      for (const modId of item.modifiers) {
        const mod = modifiers.find(m => m.id === modId);
        if (mod) {
          modifierPrice += Number(mod.price || 0);
        }
      }
    }

    const subtotal = (unitPrice + modifierPrice) * item.quantity;
    totalAmount += subtotal;

    orderItemsData.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: String(unitPrice),
      modifiers: item.modifiers,
      modifierPrice: String(modifierPrice),
      subtotal: String(subtotal),
      notes: item.notes,
    });
  }

  return { totalAmount, orderItemsData };
};

export const createOrderWithItems = async ({
  storeId,
  partyId,
  items,
  notes,
  orderType,
  status,
  entrySource,
  routeToKitchen,
}: {
  storeId: number;
  partyId: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
    modifiers?: unknown;
    notes?: string;
  }>;
  notes?: string;
  orderType: "dine_in" | "preorder";
  status?: "pending" | "confirmed" | "preparing" | "ready" | "served" | "canceled";
  entrySource?: string;
  routeToKitchen?: boolean;
}) => {
  const { totalAmount, orderItemsData } = await buildOrderItemsData(items);
  const now = new Date();
  const orderStatus = status ?? "pending";

  const orderResult = await db.createOrder({
    storeId,
    partyId,
    status: orderStatus,
    routeToKitchen: routeToKitchen ?? true,
    totalAmount: String(totalAmount),
    notes,
    orderType,
    entrySource,
    confirmedAt: orderStatus === "confirmed" ? now : undefined,
    preparedAt: orderStatus === "ready" ? now : undefined,
    servedAt: orderStatus === "served" ? now : undefined,
  });

  const orderItemIds: number[] = [];

  for (const itemData of orderItemsData) {
    const orderItemId = await db.createOrderItem({
      orderId: orderResult.id,
      ...itemData,
    });
    orderItemIds.push(orderItemId);
    await db.consumeMenuItemStock(itemData.menuItemId, itemData.quantity);
  }

  return { orderResult, totalAmount, orderItemIds };
};

export const createStaffOrder = async ({
  userId,
  storeId,
  partyId,
  items,
  notes,
  status,
  entrySource,
  routeToKitchen,
}: {
  userId: number;
  storeId: number;
  partyId: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
    modifiers?: unknown;
    notes?: string;
  }>;
  notes?: string;
  status?: "pending" | "confirmed" | "preparing" | "ready" | "served" | "canceled";
  entrySource?: string;
  routeToKitchen?: boolean;
}) => {
  await checkStoreAccess(userId, storeId);

  const party = await db.getPartyById(partyId);
  if (!party || party.storeId !== storeId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
  }

  if (party.status === "canceled" || party.status === "noshow") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "この受付には注文できません" });
  }

  if (party.posStatus === "PAYMENT_LOCKED") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "会計中のため注文できません" });
  }
  if (party.posStatus === "PAID" || party.posStatus === "VOID") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票には注文できません" });
  }
  if (party.posStatus === "MEMO_ONLY") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "メモ伝票は明細入力に切り替えてください" });
  }

  const { orderResult, totalAmount } = await createOrderWithItems({
    storeId: party.storeId,
    partyId: party.id,
    items,
    notes,
    orderType: party.status === "seated" ? "dine_in" : "preorder",
    status,
    entrySource: entrySource ?? "staff",
    routeToKitchen,
  });

  return {
    orderId: orderResult.id,
    orderNumber: orderResult.orderNumber,
    totalAmount,
  };
};

export const createCheckoutOrder = async ({
  userId,
  storeId,
  partyId,
  items,
  notes,
}: {
  userId: number;
  storeId: number;
  partyId: number;
  items: Array<{
    menuItemId: number;
    quantity: number;
    modifiers?: unknown;
    notes?: string;
  }>;
  notes?: string;
}) => {
  await checkStoreAccess(userId, storeId);

  const party = await db.getPartyById(partyId);
  if (!party || party.storeId !== storeId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
  }

  if (party.status === "canceled" || party.status === "noshow") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "この受付には注文できません" });
  }

  if (party.posStatus === "PAYMENT_LOCKED") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "会計中のため追加できません" });
  }
  if (party.posStatus === "PAID" || party.posStatus === "VOID") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票には追加できません" });
  }
  if (party.posStatus === "MEMO_ONLY") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "メモ伝票は明細入力に切り替えてください" });
  }

  const { orderResult, totalAmount, orderItemIds } = await createOrderWithItems({
    storeId: party.storeId,
    partyId: party.id,
    items,
    notes,
    orderType: party.status === "seated" ? "dine_in" : "preorder",
    routeToKitchen: false,
  });

  const now = new Date();
  await db.updateOrder(orderResult.id, {
    status: "served",
    confirmedAt: now,
    preparedAt: now,
    servedAt: now,
  });

  for (const orderItemId of orderItemIds) {
    await db.updateOrderItem(orderItemId, {
      status: "served",
    });
  }

  return {
    orderId: orderResult.id,
    orderNumber: orderResult.orderNumber,
    totalAmount,
  };
};

export const isOrderReleaseAllowed = (
  store: Awaited<ReturnType<typeof db.getStoreById>>,
  position: number,
  estimatedWaitMinutes: number | null | undefined
) => {
  if (!store || position <= 0) return false;
  const rankThreshold = store.orderReleaseRank ?? 0;
  const minutesThreshold = store.orderReleaseMinutes ?? 0;
  const byRank = rankThreshold > 0 && position <= rankThreshold;
  const byMinutes = minutesThreshold > 0
    && estimatedWaitMinutes !== null
    && estimatedWaitMinutes !== undefined
    && estimatedWaitMinutes <= minutesThreshold;
  return byRank || byMinutes;
};
