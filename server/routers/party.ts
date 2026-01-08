import { z, TRPCError } from "../_core/deps";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { checkStoreAccess, isOrderReleaseAllowed } from "./helpers";

type AuthedCtx = { user: { id: number } };
type ProtectedOpts<TInput> = { ctx: AuthedCtx; input: TInput };
type PublicOpts<TInput> = { input: TInput };
type SeatTypeRow = { id: number; name: string };
type PartyRow = {
  id: number;
  storeId: number;
  ticketNumber: number;
  guestName: string | null;
  partySize: number;
  childCount: number | null;
  hasStroller: boolean | null;
  phone: string | null;
  email: string | null;
  lineUserId: string | null;
  preferredSeatTypeId: number | null;
  assignedSeatTypeId: number | null;
  status: "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";
  partyKind: "DINE_IN" | "COUNTER_SALE" | "MEMO_ONLY";
  posStatus: "OPEN" | "MEMO_ONLY" | "ITEMIZED" | "PAYMENT_LOCKED" | "PAID" | "VOID";
  tableLabel: string | null;
  memoText: string | null;
  memoImageUrl: string | null;
  paymentLockedAt: Date | null;
  paymentLockedByStaffId: number | null;
  priority: number | null;
  notes: string | null;
  allergies: string | null;
  accessToken: string;
  estimatedWaitMinutes: number | null;
  registeredAt: Date;
  notifiedAt: Date | null;
  arrivedAt: Date | null;
  seatedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================
// Party (Queue) Router
// ============================================
export const partyRouter = router({
  // スタッフ用: 受付一覧取得
  list: protectedProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ ctx, input }: ProtectedOpts<{ storeId: number }>) => {
      await checkStoreAccess(ctx.user.id, input.storeId);
      const parties = await db.getPartiesByStoreId(input.storeId);

      // 席種情報を付加
      const seatTypes = await db.getSeatTypesByStoreId(input.storeId);
      const seatTypeMap = new Map(seatTypes.map((s: SeatTypeRow) => [s.id, s]));

      return parties.map((p: PartyRow) => ({
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
      tableId: z.number().optional(),
      notes: z.string().optional(),
      allergies: z.string().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }: ProtectedOpts<{
      storeId: number;
      guestName?: string;
      partySize: number;
      childCount?: number;
      hasStroller?: boolean;
      phone?: string;
      email?: string;
      preferredSeatTypeId?: number;
      tableId?: number;
      notes?: string;
      allergies?: string;
      priority?: number;
    }>) => {
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
    .mutation(async ({ input }: PublicOpts<{
      storeId: number;
      guestName?: string;
      partySize: number;
      childCount?: number;
      hasStroller?: boolean;
      phone?: string;
      email?: string;
      preferredSeatTypeId?: number;
      allergies?: string;
      notes?: string;
    }>) => {
      // 受付停止チェック
      const store = await db.getStoreById(input.storeId);
      if (!store) {
        throw new TRPCError({ code: "NOT_FOUND", message: "店舗が見つかりません" });
      }
      if (store.enablePosV2UI) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この店舗ではゲスト自己受付は利用できません" });
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
    .query(async ({ input }: PublicOpts<{ accessToken: string }>) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      const store = await db.getStoreById(party.storeId);
      const position = await db.getPartyPosition(party.id, party.storeId);

      // 注文可能かチェック
      const estimatedWaitMinutes = party.estimatedWaitMinutes ?? (
        party.preferredSeatTypeId
          ? await db.calculateEstimatedWaitTime(party.storeId, party.preferredSeatTypeId)
          : null
      );
      const canOrder = store?.enablePosV2UI
        ? (party.posStatus === "OPEN" || party.posStatus === "ITEMIZED")
        : isOrderReleaseAllowed(store, position, estimatedWaitMinutes);
      const isOrderBlockedByPosStatus = ["PAYMENT_LOCKED", "PAID", "VOID", "MEMO_ONLY"].includes(party.posStatus);
      const effectiveCanOrder = isOrderBlockedByPosStatus ? false : canOrder;

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
        canOrder: effectiveCanOrder,
        storeName: store?.name,
        storeId: party.storeId,
        guestName: party.guestName,
        tableLabel: party.tableLabel,
        posStatus: party.posStatus,
        preferredSeatType: preferredSeatTypeName,
        registeredAt: party.registeredAt,
        notifiedAt: party.notifiedAt,
      };
    }),

  // ゲスト用: 到着報告（公開API）
  guestArrive: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }: PublicOpts<{ accessToken: string }>) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      const store = await db.getStoreById(party.storeId);
      if (store?.enablePosV2UI) {
        throw new TRPCError({ code: "FORBIDDEN", message: "この操作は利用できません" });
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
    .mutation(async ({ input }: PublicOpts<{ accessToken: string }>) => {
      const party = await db.getPartyByAccessToken(input.accessToken);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }
      const store = await db.getStoreById(party.storeId);
      if (store?.enablePosV2UI) {
        throw new TRPCError({ code: "FORBIDDEN", message: "この操作は利用できません" });
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

  // スタッフ用: パーティ更新
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      storeId: z.number(),
      status: z.enum(["waiting", "notified", "arrived", "seated", "canceled", "noshow"]).optional(),
      guestName: z.string().optional(),
      partySize: z.number().optional(),
      tableId: z.number().nullable().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }: ProtectedOpts<{
      id: number;
      storeId: number;
      status?: "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";
      guestName?: string;
      partySize?: number;
      tableId?: number | null;
      notes?: string;
    }>) => {
      await checkStoreAccess(ctx.user.id, input.storeId);

      const party = await db.getPartyById(input.id);
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "受付情報が見つかりません" });
      }

      const { id, storeId, status, ...data } = input;

      if (status) {
        await db.updatePartyStatus(id, status, data);
      } else {
        await db.updateParty(id, data);
      }

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
    .mutation(async ({ ctx, input }: ProtectedOpts<{
      id: number;
      storeId: number;
      status: "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";
      assignedSeatTypeId?: number;
      notes?: string;
    }>) => {
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
    .mutation(async ({ ctx, input }: ProtectedOpts<{ id: number; storeId: number }>) => {
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
