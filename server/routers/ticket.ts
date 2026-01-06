import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { checkStoreAccess, createOrderWithItems } from "./helpers";

const TicketKindSchema = z.enum(["DINE_IN", "COUNTER_SALE", "MEMO_ONLY"]);
const TicketPosStatusSchema = z.enum(["OPEN", "MEMO_ONLY", "ITEMIZED", "PAYMENT_LOCKED", "PAID", "VOID"]);

const TicketItemInputSchema = z.object({
  menuItemId: z.number(),
  quantity: z.number().min(1),
  modifiers: z.any().optional(),
  notes: z.string().optional(),
});

// ============================================
// Ticket (= Party) Router (POS中心)
// ============================================
export const ticketRouter = router({
  create: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      kind: TicketKindSchema,
      partySize: z.number().min(1).optional(),
      tableLabel: z.string().max(50).optional(),
      guestName: z.string().max(100).optional(),
      memoText: z.string().optional(),
      memoImageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const partySize = input.kind === "COUNTER_SALE"
        ? 1
        : (input.partySize ?? 1);

      const posStatus = input.kind === "MEMO_ONLY" ? "MEMO_ONLY" : "OPEN";

      const result = await db.createParty({
        storeId: input.storeId,
        status: "seated",
        guestName: input.guestName,
        partySize,
        partyKind: input.kind,
        posStatus,
        tableLabel: input.tableLabel,
        memoText: input.memoText,
        memoImageUrl: input.memoImageUrl,
      });

      return {
        id: result.id,
        ticketNumber: result.ticketNumber,
        accessToken: result.accessToken,
      };
    }),

  list: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyKind: TicketKindSchema.optional(),
      posStatus: TicketPosStatusSchema.optional(),
      search: z.string().max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getTicketsByStoreId(input.storeId, {
        partyKind: input.partyKind,
        posStatus: input.posStatus,
        search: input.search,
      });
    }),

  get: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      const allOrders = await db.getOrdersByPartyId(ticket.id);
      const unpaidOrders = allOrders.filter((o) => o.paymentStatus === "unpaid");

      const ordersWithItems = await Promise.all(
        unpaidOrders.map(async (order) => {
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

      const totalAmount = ordersWithItems.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
      const totalItems = ordersWithItems.reduce(
        (sum, order) => sum + (order.items ?? []).reduce((s, item) => s + (item.quantity ?? 0), 0),
        0
      );

      return {
        ticket,
        orders: ordersWithItems,
        totals: {
          totalAmount,
          totalItems,
        },
      };
    }),

  updateMeta: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
      tableLabel: z.string().max(50).nullable().optional(),
      partySize: z.number().min(1).nullable().optional(),
      guestName: z.string().max(100).nullable().optional(),
      memoText: z.string().nullable().optional(),
      memoImageUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus === "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計中のため編集できません" });
      }

      await db.updateParty(input.ticketId, {
        ...(input.tableLabel !== undefined ? { tableLabel: input.tableLabel } : {}),
        ...(input.partySize !== undefined ? { partySize: input.partySize } : {}),
        ...(input.guestName !== undefined ? { guestName: input.guestName } : {}),
        ...(input.memoText !== undefined ? { memoText: input.memoText } : {}),
        ...(input.memoImageUrl !== undefined ? { memoImageUrl: input.memoImageUrl } : {}),
      });

      return { success: true };
    }),

  markItemized: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.partyKind !== "MEMO_ONLY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "メモ伝票ではありません" });
      }

      if (ticket.posStatus !== "MEMO_ONLY") {
        return { success: true };
      }

      await db.updateParty(ticket.id, { posStatus: "ITEMIZED" });
      return { success: true };
    }),

  lockForPayment: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus === "PAID" || ticket.posStatus === "VOID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票は会計できません" });
      }

      if (ticket.posStatus === "MEMO_ONLY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "メモ伝票は明細入力後に会計できます" });
      }

      if (ticket.posStatus === "PAYMENT_LOCKED") {
        return { success: true };
      }

      const orders = await db.getOrdersByPartyId(ticket.id);
      const unpaidTotal = orders
        .filter((o) => o.paymentStatus === "unpaid")
        .reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);

      if (unpaidTotal <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計対象の明細がありません" });
      }

      const now = new Date();
      await db.updateParty(ticket.id, {
        posStatus: "PAYMENT_LOCKED",
        paymentLockedAt: now,
        paymentLockedByStaffId: ctx.user.id,
      });

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "ticket.lockForPayment",
        targetType: "party",
        targetId: ticket.id,
        details: { unpaidTotal },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return { success: true };
    }),

  unlock: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager", "cashier"]);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus !== "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計中ロックされていません" });
      }

      const nextStatus = ticket.partyKind === "MEMO_ONLY" ? "ITEMIZED" : "OPEN";
      await db.updateParty(ticket.id, {
        posStatus: nextStatus,
        paymentLockedAt: null,
        paymentLockedByStaffId: null,
      });

      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "ticket.unlock",
        targetType: "party",
        targetId: ticket.id,
        details: { nextStatus },
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.get("user-agent"),
      });

      return { success: true };
    }),

  addItemsToTicket: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      ticketId: z.number(),
      items: z.array(TicketItemInputSchema).min(1),
      notes: z.string().optional(),
      entrySource: z.string().max(32).optional(),
      routeToKitchen: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const staff = await checkStoreAccess(ctx.user.id, input.storeId);

      const ticket = await db.getPartyById(input.ticketId);
      if (!ticket || ticket.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "伝票が見つかりません" });
      }

      if (ticket.posStatus === "PAYMENT_LOCKED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "会計中のため追加できません" });
      }
      if (ticket.posStatus === "PAID" || ticket.posStatus === "VOID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この伝票には追加できません" });
      }
      if (ticket.posStatus === "MEMO_ONLY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "メモ伝票は明細入力に切り替えてください" });
      }

      const isPrivileged = ["owner", "manager", "cashier"].includes(staff.role);

      const effectiveEntrySource = isPrivileged
        ? (input.entrySource ?? "staff_register")
        : "staff_handheld";

      const effectiveRouteToKitchen = isPrivileged
        ? (input.routeToKitchen ?? true)
        : true;

      const orderStatus = effectiveRouteToKitchen ? undefined : "served";

      const { orderResult, totalAmount, orderItemIds } = await createOrderWithItems({
        storeId: ticket.storeId,
        partyId: ticket.id,
        items: input.items,
        notes: input.notes,
        orderType: ticket.status === "seated" ? "dine_in" : "preorder",
        status: orderStatus,
        entrySource: effectiveEntrySource,
        routeToKitchen: effectiveRouteToKitchen,
      });

      if (!effectiveRouteToKitchen) {
        const now = new Date();
        await db.updateOrder(orderResult.id, {
          status: "served",
          confirmedAt: now,
          preparedAt: now,
          servedAt: now,
        });

        for (const orderItemId of orderItemIds) {
          await db.updateOrderItem(orderItemId, { status: "served" });
        }
      }

      if (ticket.partyKind === "COUNTER_SALE" && ticket.posStatus === "OPEN") {
        await db.updateParty(ticket.id, { posStatus: "ITEMIZED" });
      }

      return {
        orderId: orderResult.id,
        orderNumber: orderResult.orderNumber,
        totalAmount,
      };
    }),
});


