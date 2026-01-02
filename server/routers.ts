import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { nanoid } from "nanoid";
import { createCheckoutSession, createPortalSession, stripe } from "./stripe/stripe";
import { SUBSCRIPTION_PLANS, getPlanByPriceId } from "./stripe/products";
import { sendNotificationWithRetry } from "./_core/guestNotification";

// ============================================
// Helper: Check store access
// ============================================
async function checkStoreAccess(userId: number, storeId: number, requiredRoles?: string[]) {
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

const createOrderWithItems = async ({
  storeId,
  partyId,
  items,
  notes,
  orderType,
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
}) => {
  const { totalAmount, orderItemsData } = await buildOrderItemsData(items);

  const orderResult = await db.createOrder({
    storeId,
    partyId,
    totalAmount: String(totalAmount),
    notes,
    orderType,
  });

  for (const itemData of orderItemsData) {
    await db.createOrderItem({
      orderId: orderResult.id,
      ...itemData,
    });
    await db.consumeMenuItemStock(itemData.menuItemId, itemData.quantity);
  }

  return { orderResult, totalAmount };
};

const createStaffOrder = async ({
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

  const { orderResult, totalAmount } = await createOrderWithItems({
    storeId: party.storeId,
    partyId: party.id,
    items,
    notes,
    orderType: party.status === "seated" ? "dine_in" : "preorder",
  });

  return {
    orderId: orderResult.id,
    orderNumber: orderResult.orderNumber,
    totalAmount,
  };
};

const isOrderReleaseAllowed = (
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

// ============================================
// Store Router
// ============================================
const storeRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = await db.createStore({
        ...input,
        ownerId: ctx.user.id,
      });
      
      // オーナーをスタッフとして追加
      await db.addStoreStaff({
        storeId,
        userId: ctx.user.id,
        role: "owner",
      });
      
      return { id: storeId };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const ownedStores = await db.getStoresByOwnerId(ctx.user.id);
    const staffStores = await db.getStoreByStaffUserId(ctx.user.id);
    
    // 重複を除去
    const allStores = [...ownedStores];
    for (const store of staffStores) {
      if (!allStores.find(s => s.id === store.id)) {
        allStores.push(store);
      }
    }
    
    return allStores;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.id);
      return db.getStoreById(input.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      businessHours: z.any().optional(),
      receptionHours: z.any().optional(),
      isReceptionPaused: z.boolean().optional(),
      maxQueueSize: z.number().optional(),
      orderReleaseRank: z.number().optional(),
      orderReleaseMinutes: z.number().optional(),
      lineChannelAccessToken: z.string().optional(),
      lineChannelSecret: z.string().optional(),
      smsEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await checkStoreAccess(ctx.user.id, id, ["owner", "manager"]);
      await db.updateStore(id, data);
      return { success: true };
    }),

  toggleReception: protectedProcedure
    .input(z.object({ id: z.number(), paused: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.id, ["owner", "manager", "host"]);
      await db.updateStore(input.id, { isReceptionPaused: input.paused });
      return { success: true };
    }),
});

// ============================================
// Staff Router
// ============================================
const staffRouter = router({
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const staffList = await db.getStoreStaff(input.storeId);
      
      // ユーザー情報を取得
      const staffWithUsers = await Promise.all(
        staffList.map(async (s) => {
          const user = await db.getUserById(s.userId);
          return { ...s, user };
        })
      );
      
      return staffWithUsers;
    }),

  add: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      userId: z.number(),
      role: z.enum(["manager", "host", "staff", "kitchen"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      
      const existing = await db.getStaffByUserAndStore(input.userId, input.storeId);
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このユーザーは既にスタッフとして登録されています" });
      }
      
      const id = await db.addStoreStaff(input);
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      role: z.enum(["manager", "host", "staff", "kitchen"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateStoreStaff(id, data);
      return { success: true };
    }),
});

// ============================================
// Seat Type Router
// ============================================
const seatTypeRouter = router({
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getSeatTypesByStoreId(input.storeId);
    }),

  create: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      minPartySize: z.number().min(1).default(1),
      maxPartySize: z.number().min(1).default(4),
      totalSeats: z.number().min(1).default(10),
      avgTurnoverMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      
      const id = await db.createSeatType({
        ...input,
        availableSeats: input.totalSeats,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      minPartySize: z.number().optional(),
      maxPartySize: z.number().optional(),
      totalSeats: z.number().optional(),
      availableSeats: z.number().optional(),
      avgTurnoverMinutes: z.number().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateSeatType(id, data);
      return { success: true };
    }),
});

// ============================================
// Party (Queue) Router
// ============================================
const partyRouter = router({
  // スタッフ用: 受付一覧取得
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      const parties = await db.getPartiesByStoreId(input.storeId);
      
      // 席種情報を付加
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);
      const seatTypeMap = new Map(seatTypes.map(s => [s.id, s]));
      
      return parties.map(p => ({
        ...p,
        preferredSeatType: p.preferredSeatTypeId ? seatTypeMap.get(p.preferredSeatTypeId) : null,
        assignedSeatType: p.assignedSeatTypeId ? seatTypeMap.get(p.assignedSeatTypeId) : null,
      }));
    }),

  // スタッフ用: 新規受付
  create: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      guestName: z.string().optional(),
      partySize: z.number().min(1),
      childCount: z.number().optional(),
      hasStroller: z.boolean().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      preferredSeatTypeId: z.number().optional(),
      notes: z.string().optional(),
      allergies: z.string().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      // 受付停止チェック
      const store = await db.getStoreById(input.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }
      if (store?.isReceptionPaused) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在受付を停止しています" });
      }

      if (store.maxQueueSize && store.maxQueueSize > 0) {
        const activeCount = await db.getActivePartyCount(input.storeId);
        if (activeCount >= store.maxQueueSize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "受付上限に達しています" });
        }
      }

      if (input.preferredSeatTypeId) {
        const seatType = await db.getSeatTypeById(input.preferredSeatTypeId);
        if (!seatType || seatType.storeId !== input.storeId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "指定された席種が利用できません" });
        }
        if (input.partySize < seatType.minPartySize || input.partySize > seatType.maxPartySize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "席種の人数条件に一致しません" });
        }
      }
      
      // 待ち時間推定
      let estimatedWaitMinutes: number | null = null;
      if (input.preferredSeatTypeId) {
        estimatedWaitMinutes = await db.calculateEstimatedWaitTime(input.storeId, input.preferredSeatTypeId);
      }
      
      const result = await db.createParty({
        ...input,
        estimatedWaitMinutes,
      });
      return result;
    }),

  // ゲスト用: 自己受付（公開API）
  guestRegister: publicProcedure
    .input(z.object({
      storeId: z.number(),
      guestName: z.string().optional(),
      partySize: z.number().min(1),
      childCount: z.number().optional(),
      hasStroller: z.boolean().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      preferredSeatTypeId: z.number().optional(),
      allergies: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // 受付停止チェック
      const store = await db.getStoreById(input.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }
      if (store.isReceptionPaused) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在受付を停止しています" });
      }
      if (store.maxQueueSize && store.maxQueueSize > 0) {
        const activeCount = await db.getActivePartyCount(input.storeId);
        if (activeCount >= store.maxQueueSize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "受付上限に達しています" });
        }
      }

      if (input.preferredSeatTypeId) {
        const seatType = await db.getSeatTypeById(input.preferredSeatTypeId);
        if (!seatType || seatType.storeId !== input.storeId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "指定された席種が利用できません" });
        }
        if (input.partySize < seatType.minPartySize || input.partySize > seatType.maxPartySize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "席種の人数条件に一致しません" });
        }
      }
      
      // 待ち時間推定
      let estimatedWaitMinutes: number | null = null;
      if (input.preferredSeatTypeId) {
        estimatedWaitMinutes = await db.calculateEstimatedWaitTime(input.storeId, input.preferredSeatTypeId);
      }
      
      const result = await db.createParty({
        ...input,
        estimatedWaitMinutes,
      });
      
      return {
        ticketNumber: result.ticketNumber,
        accessToken: result.accessToken,
        estimatedWaitMinutes,
      };
    }),

  // ゲスト用: 進捗確認（公開API）
  guestStatus: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .query(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      
      const position = await db.getPartyPosition(party.id, party.storeId);
      const store = await db.getStoreById(party.storeId);
      
      // 注文可能かチェック
      const estimatedWaitMinutes = party.estimatedWaitMinutes ?? (
        party.preferredSeatTypeId
          ? await db.calculateEstimatedWaitTime(party.storeId, party.preferredSeatTypeId)
          : null
      );
      const canOrder = isOrderReleaseAllowed(store, position, estimatedWaitMinutes);
      
      // 席種名取得
      let preferredSeatTypeName = null;
      if (party.preferredSeatTypeId) {
        const seatType = await db.getSeatTypeById(party.preferredSeatTypeId);
        preferredSeatTypeName = seatType?.name;
      }
      
      return {
        ticketNumber: party.ticketNumber,
        status: party.status,
        partySize: party.partySize,
        position,
        estimatedWaitMinutes: estimatedWaitMinutes ?? party.estimatedWaitMinutes ?? 0,
        canOrder,
        storeName: store?.name,
        storeId: party.storeId,
        guestName: party.guestName,
        preferredSeatType: preferredSeatTypeName,
        registeredAt: party.registeredAt,
        notifiedAt: party.notifiedAt,
      };
    }),

  // ゲスト用: 到着報告（公開API）
  guestArrive: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      if (party.status === "arrived") {
        return { success: true };
      }

      if (party.status === "seated") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "すでにご案内済みのため到着報告できません" });
      }
      if (party.status === "canceled" || party.status === "noshow") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "受付が終了しているため到着報告できません" });
      }

      const previousStatus = party.status;
      await db.updatePartyStatus(party.id, "arrived");

      return { success: true };
    }),

  // ゲスト用: キャンセル（公開API）
  guestCancel: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      if (party.status === "canceled") {
        return { success: true };
      }
      if (party.status === "seated") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "すでにご案内済みのためキャンセルできません" });
      }
      if (party.status === "noshow") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "受付が終了しているためキャンセルできません" });
      }

      const previousStatus = party.status;
      await db.updatePartyStatus(party.id, "canceled");

      return { success: true };
    }),

  // スタッフ用: ステータス更新
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      status: z.enum(["waiting", "notified", "arrived", "seated", "canceled", "noshow"]),
      assignedSeatTypeId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      const party = await db.getPartyById(input.id);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      
      const previousStatus = party.status;
      
      await db.updatePartyStatus(input.id, input.status, {
        assignedSeatTypeId: input.assignedSeatTypeId,
        notes: input.notes,
      });
      
      // 着席時は席の空き数を減らす
      if (input.status === "seated" && input.assignedSeatTypeId) {
        await db.updateSeatAvailability(input.assignedSeatTypeId, -1);
      }
      
      // キャンセル/No-show時に席を戻す（既に着席していた場合）
      if ((input.status === "canceled" || input.status === "noshow") && party.assignedSeatTypeId && previousStatus === "seated") {
        await db.updateSeatAvailability(party.assignedSeatTypeId, 1);
      }
      return { success: true };
    }),

  // 席を解放（退店処理）
  release: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      const party = await db.getPartyById(input.id);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      
      if (party.assignedSeatTypeId) {
        await db.updateSeatAvailability(party.assignedSeatTypeId, 1);
      }
      return { success: true };
    }),
});

// ============================================
// Notification Router
// ============================================
const notificationRouter = router({
  // 通知送信
  send: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      partyId: z.number(),
      type: z.enum(["registration", "notify", "remind", "seated", "custom"]),
      channel: z.enum(["sms", "line", "email"]),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      const party = await db.getPartyById(input.partyId);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      
      // 送信先を決定
      let recipient = "";
      if (input.channel === "sms" && party.phone) {
        recipient = party.phone;
      } else if (input.channel === "email" && party.email) {
        recipient = party.email;
      } else if (input.channel === "line" && party.lineUserId) {
        recipient = party.lineUserId;
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "送信先が設定されていません" });
      }
      
      // テンプレートからメッセージを生成
      let message = input.message;
      const store = await db.getStoreById(input.storeId);
      if (!message) {
        const template = await db.getDefaultTemplate(input.storeId, input.type, input.channel);
        if (template) {
          message = template.template
            .replace(/\{\{ticketNumber\}\}/g, String(party.ticketNumber))
            .replace(/\{\{guestName\}\}/g, party.guestName || "お客様")
            .replace(/\{\{partySize\}\}/g, String(party.partySize))
            .replace(/\{\{storeName\}\}/g, store?.name || "")
            .replace(/\{\{waitTime\}\}/g, String(party.estimatedWaitMinutes || 0));
        } else {
          // デフォルトメッセージ
          const messages: Record<string, string> = {
            registration: `受付番号${party.ticketNumber}番でお受けしました。`,
            notify: `${party.ticketNumber}番のお客様、お席の準備ができました。`,
            remind: `${party.ticketNumber}番のお客様、まもなくお呼び出しです。`,
            seated: `ご来店ありがとうございました。`,
            custom: "",
          };
          message = messages[input.type];
        }
      }
      
      // 通知レコード作成
      const notificationId = await db.createNotification({
        storeId: input.storeId,
        partyId: input.partyId,
        type: input.type,
        channel: input.channel,
        recipient,
        message,
        status: "pending",
      });
      
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }

      const sendResult = await sendNotificationWithRetry({
        channel: input.channel,
        recipient,
        message,
        subject: undefined,
        store,
      });

      if (sendResult.status === "sent") {
        await db.updateNotification(notificationId, {
          status: "sent",
          sentAt: new Date(),
          externalId: sendResult.externalId,
        });
      } else {
        await db.updateNotification(notificationId, {
          status: "failed",
          errorMessage: sendResult.errorMessage,
        });
      }

      if (sendResult.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: sendResult.errorMessage || "通知送信に失敗しました",
        });
      }

      return { id: notificationId, success: true };
    }),

  // 通知履歴取得
  history: protectedProcedure
    .input(z.object({ storeId: z.number(), partyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getNotificationsByPartyId(input.partyId);
    }),

  // テンプレート一覧
  templates: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getNotificationTemplatesByStoreId(input.storeId);
    }),

  // テンプレート作成
  createTemplate: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      type: z.enum(["registration", "notify", "remind", "seated", "custom"]),
      channel: z.enum(["sms", "line", "email"]),
      name: z.string(),
      subject: z.string().optional(),
      template: z.string(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createNotificationTemplate(input);
      return { id };
    }),
});

// ============================================
// Menu Router
// ============================================
const menuRouter = router({
  // カテゴリ一覧
  categories: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      return db.getMenuCategoriesByStoreId(input.storeId);
    }),

  // カテゴリ作成
  createCategory: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      sortOrder: z.number().optional(),
      availableTime: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuCategory(input);
      return { id };
    }),

  // 商品一覧
  items: publicProcedure
    .input(z.object({ storeId: z.number(), categoryId: z.number().optional() }))
    .query(async ({ input }) => {
      if (input.categoryId) {
        return db.getMenuItemsByCategoryId(input.categoryId);
      }
      return db.getMenuItemsByStoreId(input.storeId);
    }),

  // 商品作成
  createItem: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      categoryId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      price: z.string(),
      imageUrl: z.string().optional(),
      prepTimeMinutes: z.number().optional(),
      allergens: z.any().optional(),
      calories: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuItem(input);
      return { id };
    }),

  // 商品更新
  updateItem: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      imageUrl: z.string().optional(),
      allergens: z.any().optional(),
      isAvailable: z.boolean().optional(),
      stockCount: z.number().optional(),
      prepTimeMinutes: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, storeId, ...data } = input;
      await checkStoreAccess(ctx.user.id, storeId, ["owner", "manager"]);
      await db.updateMenuItem(id, data);
      return { success: true };
    }),

  // モディファイア取得
  modifiers: publicProcedure
    .input(z.object({ menuItemId: z.number() }))
    .query(async ({ input }) => {
      return db.getMenuModifiersByItemId(input.menuItemId);
    }),

  // モディファイア作成
  createModifier: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      menuItemId: z.number(),
      name: z.string(),
      price: z.string().optional(),
      isRequired: z.boolean().optional(),
      maxSelections: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const id = await db.createMenuModifier(input);
      return { id };
    }),
});

// ============================================
// Order Router
// ============================================
const orderRouter = router({
  // 注文一覧（キッチン用）
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      const orders = await db.getOrdersByStoreId(input.storeId);
      
      // 注文明細を付加
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await db.getOrderItemsByOrderId(order.id);
          const party = await db.getPartyById(order.partyId);
          return { ...order, items, party };
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
    }))
    .mutation(async ({ input }) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      
      // 注文可能かチェック
      const store = await db.getStoreById(party.storeId);
      const position = await db.getPartyPosition(party.id, party.storeId);
      const estimatedWaitMinutes = party.estimatedWaitMinutes ?? (
        party.preferredSeatTypeId
          ? await db.calculateEstimatedWaitTime(party.storeId, party.preferredSeatTypeId)
          : null
      );

      if (!store || !isOrderReleaseAllowed(store, position, estimatedWaitMinutes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在注文できません" });
      }

      const { orderResult, totalAmount } = await createOrderWithItems({
        storeId: party.storeId,
        partyId: party.id,
        items: input.items,
        notes: input.notes,
        orderType: party.status === "seated" ? "dine_in" : "preorder",
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
    }))
    .mutation(async ({ ctx, input }) => createStaffOrder({
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
    }))
    .mutation(async ({ ctx, input }) => createStaffOrder({
      userId: ctx.user.id,
      storeId: input.storeId,
      partyId: input.partyId,
      items: input.items,
      notes: input.notes,
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
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
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
});

// ============================================
// Analytics Router
// ============================================
const analyticsRouter = router({
  // ダッシュボード概要
  dashboard: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
      // 今日のパーティ取得
      const parties = await db.getPartiesByStoreId(input.storeId);
      
      // 統計計算
      const totalParties = parties.length;
      const waitingCount = parties.filter(p => p.status === "waiting").length;
      const seatedCount = parties.filter(p => p.status === "seated").length;
      const canceledCount = parties.filter(p => p.status === "canceled").length;
      const noshowCount = parties.filter(p => p.status === "noshow").length;
      
      // 平均待ち時間
      const seatedParties = parties.filter(p => p.seatedAt && p.registeredAt);
      const avgWaitTime = seatedParties.length > 0
        ? Math.round(seatedParties.reduce((sum, p) => {
            const wait = (new Date(p.seatedAt!).getTime() - new Date(p.registeredAt).getTime()) / 60000;
            return sum + wait;
          }, 0) / seatedParties.length)
        : 0;
      
      // 席種別空き状況
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);
      
      // 今日の注文
      const orders = await db.getOrdersByStoreId(input.storeId);
      const totalOrders = orders.length;
      const totalOrderAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      
      return {
        date: todayStr,
        totalParties,
        waitingCount,
        seatedCount,
        canceledCount,
        noshowCount,
        avgWaitTime,
        seatTypes: seatTypes.map(s => ({
          id: s.id,
          name: s.name,
          totalSeats: s.totalSeats,
          availableSeats: s.availableSeats,
        })),
        totalOrders,
        totalOrderAmount,
      };
    }),

  // 期間別分析
  period: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getDailyAnalytics(input.storeId, input.startDate, input.endDate);
    }),

  waitTimeByHour: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      return db.getWaitTimeStatsByHour(input.storeId, input.startDate, input.endDate);
    }),
});

// ============================================
// Stripe Subscription Router
// ============================================
const subscriptionRouter = router({
  // プラン一覧取得
  plans: publicProcedure.query(() => {
    return Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      features: plan.features,
    }));
  }),

  // 現在のサブスクリプション情報
  current: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);
      const store = await db.getStoreById(input.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }
      
      return {
        plan: store.subscriptionPlan,
        status: store.subscriptionStatus,
        planDetails: SUBSCRIPTION_PLANS[store.subscriptionPlan as keyof typeof SUBSCRIPTION_PLANS],
      };
    }),

  // チェックアウトセッション作成
  createCheckout: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      plan: z.enum(["standard", "premium"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);
      
      const planConfig = SUBSCRIPTION_PLANS[input.plan];
      if (!('priceId' in planConfig)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なプランです" });
      }
      
      const origin = ctx.req.headers.origin || "http://localhost:3000";
      
      const session = await createCheckoutSession({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || undefined,
        storeId: input.storeId,
        priceId: planConfig.priceId,
        successUrl: `${origin}/dashboard?payment=success`,
        cancelUrl: `${origin}/dashboard?payment=canceled`,
      });
      
      return { url: session.url };
    }),

  // カスタマーポータルセッション作成
  createPortal: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner"]);
      
      const store = await db.getStoreById(input.storeId);
      if (!store?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stripeカスタマーが設定されていません" });
      }
      
      const origin = ctx.req.headers.origin || "http://localhost:3000";
      
      const session = await createPortalSession({
        customerId: store.stripeCustomerId,
        returnUrl: `${origin}/dashboard`,
      });
      
      return { url: session.url };
    }),
});

// ============================================
// Data Export Router
// ============================================
const dataExportRouter = router({
  parties: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().min(1).max(10000).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const parties = await db.getPartiesForExport(input.storeId, {
        limit: input.limit ?? 5000,
        startDate: parseDateInput(input.startDate, "start"),
        endDate: parseDateInput(input.endDate, "end"),
      });
      const header = [
        "ID",
        "受付番号",
        "ステータス",
        "ゲスト名",
        "人数",
        "子供人数",
        "電話番号",
        "メール",
        "希望席種ID",
        "割当席種ID",
        "優先度",
        "備考",
        "アレルギー",
        "受付日時",
        "呼出日時",
        "到着日時",
        "着席日時",
        "完了日時",
        "作成日時",
        "更新日時",
      ];
      const rows = parties.map((party) => [
        party.id,
        party.ticketNumber,
        party.status,
        party.guestName ?? "",
        party.partySize,
        party.childCount ?? "",
        party.phone ?? "",
        party.email ?? "",
        party.preferredSeatTypeId ?? "",
        party.assignedSeatTypeId ?? "",
        party.priority ?? "",
        party.notes ?? "",
        party.allergies ?? "",
        party.registeredAt?.toISOString() ?? "",
        party.notifiedAt?.toISOString() ?? "",
        party.arrivedAt?.toISOString() ?? "",
        party.seatedAt?.toISOString() ?? "",
        party.completedAt?.toISOString() ?? "",
        party.createdAt?.toISOString() ?? "",
        party.updatedAt?.toISOString() ?? "",
      ].map(formatCsvValue).join(","));
      const csv = [header.map(formatCsvValue).join(","), ...rows].join("\n");
      const dateStamp = new Date().toISOString().slice(0, 10);
      return {
        fileName: `parties-${input.storeId}-${dateStamp}.csv`,
        csv,
      };
    }),
  notifications: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().min(1).max(10000).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const notifications = await db.getNotificationsForExport(input.storeId, {
        limit: input.limit ?? 5000,
        startDate: parseDateInput(input.startDate, "start"),
        endDate: parseDateInput(input.endDate, "end"),
      });
      const header = [
        "ID",
        "受付ID",
        "通知タイプ",
        "チャネル",
        "送信先",
        "件名",
        "本文",
        "ステータス",
        "エラー",
        "外部ID",
        "送信日時",
        "配信完了日時",
        "作成日時",
      ];
      const rows = notifications.map((notification) => [
        notification.id,
        notification.partyId,
        notification.type,
        notification.channel,
        notification.recipient,
        notification.subject ?? "",
        notification.message,
        notification.status,
        notification.errorMessage ?? "",
        notification.externalId ?? "",
        notification.sentAt?.toISOString() ?? "",
        notification.deliveredAt?.toISOString() ?? "",
        notification.createdAt?.toISOString() ?? "",
      ].map(formatCsvValue).join(","));
      const csv = [header.map(formatCsvValue).join(","), ...rows].join("\n");
      const dateStamp = new Date().toISOString().slice(0, 10);
      return {
        fileName: `notifications-${input.storeId}-${dateStamp}.csv`,
        csv,
      };
    }),
  orders: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().min(1).max(10000).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const orders = await db.getOrdersForExport(input.storeId, {
        limit: input.limit ?? 5000,
        startDate: parseDateInput(input.startDate, "start"),
        endDate: parseDateInput(input.endDate, "end"),
      });
      const header = [
        "ID",
        "受付ID",
        "注文番号",
        "ステータス",
        "注文区分",
        "合計金額",
        "メモ",
        "注文日時",
        "確定日時",
        "調理完了日時",
        "提供日時",
        "作成日時",
        "更新日時",
      ];
      const rows = orders.map((order) => [
        order.id,
        order.partyId,
        order.orderNumber,
        order.status,
        order.orderType ?? "",
        order.totalAmount ?? "",
        order.notes ?? "",
        order.orderedAt?.toISOString() ?? "",
        order.confirmedAt?.toISOString() ?? "",
        order.preparedAt?.toISOString() ?? "",
        order.servedAt?.toISOString() ?? "",
        order.createdAt?.toISOString() ?? "",
        order.updatedAt?.toISOString() ?? "",
      ].map(formatCsvValue).join(","));
      const csv = [header.map(formatCsvValue).join(","), ...rows].join("\n");
      const dateStamp = new Date().toISOString().slice(0, 10);
      return {
        fileName: `orders-${input.storeId}-${dateStamp}.csv`,
        csv,
      };
    }),
  orderItems: protectedProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().min(1).max(10000).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      const orderItems = await db.getOrderItemsForExport(input.storeId, {
        limit: input.limit ?? 5000,
        startDate: parseDateInput(input.startDate, "start"),
        endDate: parseDateInput(input.endDate, "end"),
      });
      const header = [
        "注文明細ID",
        "注文ID",
        "注文番号",
        "受付ID",
        "商品ID",
        "数量",
        "単価",
        "モディファイア",
        "モディファイア料金",
        "小計",
        "ステータス",
        "メモ",
        "注文日時",
        "作成日時",
        "更新日時",
      ];
      const rows = orderItems.map((row) => [
        row.item.id,
        row.order.id,
        row.order.orderNumber,
        row.order.partyId,
        row.item.menuItemId,
        row.item.quantity,
        row.item.unitPrice ?? "",
        row.item.modifiers ? JSON.stringify(row.item.modifiers) : "",
        row.item.modifierPrice ?? "",
        row.item.subtotal ?? "",
        row.item.status,
        row.item.notes ?? "",
        row.order.orderedAt?.toISOString() ?? "",
        row.item.createdAt?.toISOString() ?? "",
        row.item.updatedAt?.toISOString() ?? "",
      ].map(formatCsvValue).join(","));
      const csv = [header.map(formatCsvValue).join(","), ...rows].join("\n");
      const dateStamp = new Date().toISOString().slice(0, 10);
      return {
        fileName: `order-items-${input.storeId}-${dateStamp}.csv`,
        csv,
      };
    }),
});

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (dateOnlyPattern.test(value)) {
    if (boundary === "start") {
      date.setUTCHours(0, 0, 0, 0);
    } else {
      date.setUTCHours(23, 59, 59, 999);
    }
  }
  return date;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function formatCsvValue(value: unknown) {
  if (value === null || value === undefined) return escapeCsv("");
  return escapeCsv(String(value));
}

// ============================================
// Public Store Info (ゲスト用)
// ============================================
const publicStoreRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const store = await db.getStoreById(input.id);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }
      
      return {
        id: store.id,
        name: store.name,
        description: store.description,
        address: store.address,
        phone: store.phone,
        isReceptionPaused: store.isReceptionPaused,
        businessHours: store.businessHours,
        receptionHours: store.receptionHours,
      };
    }),

  seatTypes: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);
      return seatTypes.map(s => ({
        id: s.id,
        name: s.name,
        minPartySize: s.minPartySize,
        maxPartySize: s.maxPartySize,
      }));
    }),

  waitingCount: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const parties = await db.getWaitingParties(input.storeId);
      return { count: parties.length };
    }),
});

// ============================================
// Main Router
// ============================================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  store: { ...storeRouter, getPublic: publicStoreRouter.get },
  staff: staffRouter,
  seatType: { ...seatTypeRouter, listPublic: publicStoreRouter.seatTypes },
  party: partyRouter,
  notification: notificationRouter,
  menu: { ...menuRouter, guestCategories: menuRouter.categories, guestItems: menuRouter.items },
  order: { ...orderRouter, guestCreate: orderRouter.create, kitchen: orderRouter.list },
  analytics: analyticsRouter,
  dataExport: dataExportRouter,
  publicStore: publicStoreRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
