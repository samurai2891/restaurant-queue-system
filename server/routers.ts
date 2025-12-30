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
      
      // 監査ログ
      await db.createAuditLog({
        storeId,
        userId: ctx.user.id,
        action: "store.create",
        targetType: "store",
        targetId: storeId,
        details: { name: input.name },
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
      
      await db.createAuditLog({
        storeId: id,
        userId: ctx.user.id,
        action: "store.update",
        targetType: "store",
        targetId: id,
        details: data,
      });
      
      return { success: true };
    }),

  toggleReception: protectedProcedure
    .input(z.object({ id: z.number(), paused: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.id, ["owner", "manager", "host"]);
      await db.updateStore(input.id, { isReceptionPaused: input.paused });
      
      await db.createAuditLog({
        storeId: input.id,
        userId: ctx.user.id,
        action: input.paused ? "store.pause_reception" : "store.resume_reception",
        targetType: "store",
        targetId: input.id,
      });
      
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
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "staff.add",
        targetType: "staff",
        targetId: id,
        details: { role: input.role },
      });
      
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
      
      await db.createAuditLog({
        storeId,
        userId: ctx.user.id,
        action: "staff.update",
        targetType: "staff",
        targetId: id,
        details: data,
      });
      
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
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "seat_type.create",
        targetType: "seat_type",
        targetId: id,
        details: { name: input.name },
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
      
      await db.createAuditLog({
        storeId,
        userId: ctx.user.id,
        action: "seat_type.update",
        targetType: "seat_type",
        targetId: id,
        details: data,
      });
      
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
      if (store?.isReceptionPaused) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在受付を停止しています" });
      }
      
      // 待ち時間推定
      let estimatedWaitMinutes = 0;
      if (input.preferredSeatTypeId) {
        estimatedWaitMinutes = await db.calculateEstimatedWaitTime(input.storeId, input.preferredSeatTypeId);
      }
      
      const result = await db.createParty({
        ...input,
        estimatedWaitMinutes,
      });
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "party.create",
        targetType: "party",
        targetId: result.id,
        details: { ticketNumber: result.ticketNumber, partySize: input.partySize },
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
      
      // 待ち時間推定
      let estimatedWaitMinutes = 0;
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
      const canOrder = store && position > 0 && position <= (store.orderReleaseRank || 5);
      
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
        estimatedWaitMinutes: party.estimatedWaitMinutes,
        canOrder,
        storeName: store?.name,
        storeId: party.storeId,
        guestName: party.guestName,
        preferredSeatType: preferredSeatTypeName,
        registeredAt: party.registeredAt,
        notifiedAt: party.notifiedAt,
      };
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
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: `party.${input.status}`,
        targetType: "party",
        targetId: input.id,
        details: { previousStatus, newStatus: input.status },
      });
      
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
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "party.release",
        targetType: "party",
        targetId: input.id,
      });
      
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
      if (!message) {
        const template = await db.getDefaultTemplate(input.storeId, input.type, input.channel);
        if (template) {
          const store = await db.getStoreById(input.storeId);
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
      
      // TODO: 実際のSMS/LINE/メール送信処理
      // ここでは送信成功として記録
      await db.updateNotification(notificationId, {
        status: "sent",
        sentAt: new Date(),
      });
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: "notification.send",
        targetType: "notification",
        targetId: notificationId,
        details: { type: input.type, channel: input.channel },
      });
      
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
      
      if (!store || position > (store.orderReleaseRank || 5)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "現在注文できません" });
      }
      
      // 合計金額計算
      let totalAmount = 0;
      const orderItemsData = [];
      
      for (const item of input.items) {
        const menuItem = await db.getMenuItemById(item.menuItemId);
        if (!menuItem || !menuItem.isAvailable) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品が利用できません: ${item.menuItemId}` });
        }
        
        const unitPrice = Number(menuItem.price);
        let modifierPrice = 0;
        
        // モディファイア価格計算
        if (item.modifiers && Array.isArray(item.modifiers)) {
          for (const modId of item.modifiers) {
            const modifiers = await db.getMenuModifiersByItemId(item.menuItemId);
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
      
      // 注文作成
      const orderResult = await db.createOrder({
        storeId: party.storeId,
        partyId: party.id,
        totalAmount: String(totalAmount),
        notes: input.notes,
        orderType: party.status === "seated" ? "dine_in" : "preorder",
      });
      
      // 注文明細作成
      for (const itemData of orderItemsData) {
        await db.createOrderItem({
          orderId: orderResult.id,
          ...itemData,
        });
      }
      
      return {
        orderId: orderResult.id,
        orderNumber: orderResult.orderNumber,
        totalAmount,
      };
    }),

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
      
      await db.createAuditLog({
        storeId: input.storeId,
        userId: ctx.user.id,
        action: `order.${input.status}`,
        targetType: "order",
        targetId: input.id,
      });
      
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
// Audit Log Router
// ============================================
const auditRouter = router({
  list: protectedProcedure
    .input(z.object({ storeId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      await checkStoreAccess(ctx.user.id, input.storeId, ["owner", "manager"]);
      return db.getAuditLogsByStoreId(input.storeId, input.limit || 100);
    }),
});

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
  audit: auditRouter,
  publicStore: publicStoreRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
