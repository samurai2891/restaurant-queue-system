import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  checkStoreAccess,
  createCheckoutOrder,
  createOrderWithItems,
  createStaffOrder,
  isOrderReleaseAllowed,
} from "./helpers";

// ============================================
// Order Router
// ============================================
export const orderRouter = router({
  // 注文一覧（キッチン用）
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      const orders = await db.getOrdersByStoreId(input.storeId);
      const kitchenOrders = orders.filter(order => order.routeToKitchen);

      // 注文明細を付加（メニュー詳細含む）
      const ordersWithItems = await Promise.all(
        kitchenOrders.map(async (order) => {
          const items = await db.getOrderItemsByOrderId(order.id);
          const party = await db.getPartyById(order.partyId);
          
          // 各アイテムにメニュー詳細を付加
          const itemsWithMenu = await Promise.all(
            items.map(async (item) => {
              const menuItem = await db.getMenuItemById(item.menuItemId);
              return {
                ...item,
                menuItem: menuItem ? {
                  id: menuItem.id,
                  name: menuItem.name,
                  prepTimeMinutes: menuItem.prepTimeMinutes,
                  imageUrl: menuItem.imageUrl,
                } : null,
              };
            })
          );
          
          // 注文全体の最大調理時間を計算
          const maxPrepTime = Math.max(
            ...itemsWithMenu.map(i => i.menuItem?.prepTimeMinutes ?? 10),
            10
          );
          
          return { ...order, items: itemsWithMenu, party, maxPrepTime };
        })
      );

      return ordersWithItems;
    }),

  // ゲスト用: 注文作成
  create: publicProcedure
    .input(z.object({
      accessToken: z.string(),
      items: z.array(z.object({
        menuItemId: z.number(),
        quantity: z.number().min(1),
        modifiers: z.any().optional(),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
      entrySource: z.string().max(32).optional(),
      routeToKitchen: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      if (party.posStatus === "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計中のため注文できません" });
      }
      if (party.posStatus === "PAID" || party.posStatus === "VOID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票には注文できません" });
      }
      if (party.posStatus === "MEMO_ONLY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在注文できません" });
      }

      // 注文可能かチェック
      const store = await db.getStoreById(party.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }

      if (!store.enablePosV2UI) {
        const position = await db.getPartyPosition(party.id, party.storeId);
        const estimatedWaitMinutes = party.estimatedWaitMinutes ?? (
          party.preferredSeatTypeId
            ? await db.calculateEstimatedWaitTime(party.storeId, party.preferredSeatTypeId)
            : null
        );

        if (!isOrderReleaseAllowed(store, position, estimatedWaitMinutes)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "現在注文できません" });
        }
      } else {
        const canOrder = party.posStatus === "OPEN" || party.posStatus === "ITEMIZED";
        if (!canOrder) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "現在注文できません" });
        }
      }

      const { orderResult, totalAmount } = await createOrderWithItems({
        storeId: party.storeId,
        partyId: party.id,
        items: input.items,
        notes: input.notes,
        orderType: party.status === "seated" ? "dine_in" : "preorder",
        entrySource: input.entrySource ?? "guest_qr",
        routeToKitchen: input.routeToKitchen,
      });

      return {
        orderId: orderResult.id,
        orderNumber: orderResult.orderNumber,
        totalAmount,
      };
    }),

  // スタッフ用: 注文作成
  createByStaff: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyId: z.number(),
      items: z.array(z.object({
        menuItemId: z.number(),
        quantity: z.number().min(1),
        modifiers: z.any().optional(),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
      status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "canceled"]).optional(),
      entrySource: z.string().max(32).optional(),
      routeToKitchen: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => createStaffOrder({
      userId: ctx.user.id,
      storeId: input.storeId,
      partyId: input.partyId,
      items: input.items,
      notes: input.notes,
      status: input.status,
      entrySource: input.entrySource,
      routeToKitchen: input.routeToKitchen,
    })),

  // 会計時入力専用: 注文作成（厨房へ出さない）
  createForCheckout: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyId: z.number(),
      items: z.array(z.object({
        menuItemId: z.number(),
        quantity: z.number().min(1),
        modifiers: z.any().optional(),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => createCheckoutOrder({
      userId: ctx.user.id,
      storeId: input.storeId,
      partyId: input.partyId,
      items: input.items,
      notes: input.notes,
    })),

  // スタッフ用: 注文作成（保護API）
  createProtected: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyId: z.number(),
      items: z.array(z.object({
        menuItemId: z.number(),
        quantity: z.number().min(1),
        modifiers: z.any().optional(),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
      status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "canceled"]).optional(),
      entrySource: z.string().max(32).optional(),
      routeToKitchen: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => createStaffOrder({
      userId: ctx.user.id,
      storeId: input.storeId,
      partyId: input.partyId,
      items: input.items,
      notes: input.notes,
      status: input.status,
      entrySource: input.entrySource,
      routeToKitchen: input.routeToKitchen,
    })),

  // 注文ステータス更新
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "canceled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const updateData: Record<string, any> = { status: input.status };
      const now = new Date();

      if (input.status === "confirmed") updateData.confirmedAt = now;
      if (input.status === "ready") updateData.preparedAt = now;
      if (input.status === "served") updateData.servedAt = now;

      await db.updateOrder(input.id, updateData);
      return { success: true };
    }),

  // 会計確定
  confirmPayment: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      paymentMethod: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const order = await db.getOrderById(input.id);
      if (!order || order.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
      }
      if (order.paymentStatus === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "すでに支払い済みです" });
      }
      if (order.paymentStatus === "voided") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "支払い取り消し済みの注文です" });
      }

      await db.confirmOrderPayment(order.id, {
        paymentMethod: input.paymentMethod,
      });

      return { success: true };
    }),

  // 会計確定（複数注文対応）
  confirmPaymentBatch: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      orderIds: z.array(z.number().min(1)).min(1),
      paymentMethod: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const uniqueOrderIds = Array.from(new Set(input.orderIds));
      const orders = await Promise.all(uniqueOrderIds.map((orderId) => db.getOrderById(orderId)));

      if (orders.some((order) => !order)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
      }

      for (const order of orders) {
        if (!order || order.storeId !== input.storeId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
        }
        if (order.paymentStatus === "paid") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "すでに支払い済みの注文が含まれています" });
        }
        if (order.paymentStatus === "voided") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "支払い取り消し済みの注文が含まれています" });
        }
      }

      for (const order of orders) {
        if (!order) continue;

        await db.confirmOrderPayment(order.id, {
          paymentMethod: input.paymentMethod,
        });
      }

      return { success: true, orderIds: uniqueOrderIds };
    }),

  // 支払取り消し
  cancelPayment: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const order = await db.getOrderById(input.id);
      if (!order || order.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
      }
      if (order.paymentStatus !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "支払い済みの注文のみ取り消せます" });
      }

      await db.cancelOrderPayment(order.id);

      return { success: true };
    }),

  // 注文明細ステータス更新
  updateItemStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      status: z.enum(["pending", "preparing", "ready", "served", "canceled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      await db.updateOrderItem(input.id, { status: input.status });
      return { success: true };
    }),

  // ゲスト用: 注文状況確認
  guestOrders: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .query(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      const orders = await db.getOrdersByPartyId(party.id);
      const routedOrders = orders;
      const ordersWithItems = await Promise.all(
        routedOrders.map(async (order) => {
          const items = await db.getOrderItemsByOrderId(order.id);
          const itemsWithMenu = await Promise.all(
            items.map(async (item) => {
              const menuItem = await db.getMenuItemById(item.menuItemId);
              return { ...item, menuItem };
            })
          );
          return { ...order, items: itemsWithMenu };
        })
      );

      return ordersWithItems;
    }),

  // テーブル訂正: 注文を別の伝票に移動
  moveToTicket: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      storeId: z.number(),
      newTicketId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier", "host", "staff"]);

      // 注文を取得
      const order = await db.getOrderById(input.orderId);
      if (!order || order.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
      }

      // 支払済みの注文は移動不可
      if (order.paymentStatus === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "支払済みの注文は移動できません" });
      }

      // 移動先の伝票を確認
      const newTicket = await db.getPartyById(input.newTicketId);
      if (!newTicket || newTicket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "移動先の伝票が見つかりません" });
      }

      // 移動先の伝票が会計中でないことを確認
      if (newTicket.posStatus === "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計中の伝票には移動できません" });
      }
      if (newTicket.posStatus === "PAID" || newTicket.posStatus === "VOID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "終了した伝票には移動できません" });
      }

      // 注文を移動
      await db.updateOrder(input.orderId, { partyId: input.newTicketId });

      return { success: true, newTicketId: input.newTicketId };
    }),
});
