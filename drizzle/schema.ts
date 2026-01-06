import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, decimal } from "drizzle-orm/mysql-core";

// ============================================
// Core User Table (Auth)
// ============================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// Store (店舗)
// ============================================
export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  logoUrl: text("logoUrl"),
  // 営業時間 (JSON: { mon: { open: "09:00", close: "22:00" }, ... })
  businessHours: json("businessHours"),
  // 受付時間 (JSON: { start: "09:00", end: "21:00" })
  receptionHours: json("receptionHours"),
  // 受付停止フラグ
  isReceptionPaused: boolean("isReceptionPaused").default(false).notNull(),
  // 最大待ち組数
  maxQueueSize: int("maxQueueSize").default(50),
  // タイムゾーン
  timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo"),
  // Stripe関連
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "standard", "premium"]).default("free"),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "trialing"]).default("active"),
  // LINE連携
  lineChannelAccessToken: text("lineChannelAccessToken"),
  lineChannelSecret: varchar("lineChannelSecret", { length: 255 }),
  // SMS設定
  smsEnabled: boolean("smsEnabled").default(true),
  // 注文解放ルール
  orderReleaseRank: int("orderReleaseRank").default(5), // 上位N組に注文解放
  orderReleaseMinutes: int("orderReleaseMinutes").default(15), // 残りT分以内に注文解放
  // 自動通知ルール
  autoNotifyRank: int("autoNotifyRank").default(0), // 上位N組に自動通知
  autoNotifyMinutes: int("autoNotifyMinutes").default(0), // 残りT分以内に自動通知
  // Feature Flags (段階導入)
  enablePosV2UI: boolean("enablePosV2UI").default(false).notNull(),
  enableHandheld: boolean("enableHandheld").default(false).notNull(),
  enableMemoTicket: boolean("enableMemoTicket").default(false).notNull(),
  enableDraftHandoff: boolean("enableDraftHandoff").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// ============================================
// Store Staff (店舗スタッフ)
// ============================================
export const storeStaff = mysqlTable("store_staff", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "manager", "cashier", "host", "staff", "kitchen"]).default("staff").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StoreStaff = typeof storeStaff.$inferSelect;
export type InsertStoreStaff = typeof storeStaff.$inferInsert;

// ============================================
// Seat Type (席種)
// ============================================
export const seatTypes = mysqlTable("seat_types", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // テーブル、カウンター、個室など
  description: text("description"),
  minPartySize: int("minPartySize").default(1).notNull(),
  maxPartySize: int("maxPartySize").default(4).notNull(),
  totalSeats: int("totalSeats").default(10).notNull(), // この席種の総数
  availableSeats: int("availableSeats").default(10).notNull(), // 現在の空き数
  avgTurnoverMinutes: int("avgTurnoverMinutes").default(60), // 平均回転時間（分）
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SeatType = typeof seatTypes.$inferSelect;
export type InsertSeatType = typeof seatTypes.$inferInsert;

// ============================================
// Party (受付単位/順番待ち)
// ============================================
export const parties = mysqlTable("parties", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  // 受付番号（店舗ごとに日次リセット）
  ticketNumber: int("ticketNumber").notNull(),
  // ゲスト情報
  guestName: varchar("guestName", { length: 100 }),
  partySize: int("partySize").notNull(),
  childCount: int("childCount").default(0),
  hasStroller: boolean("hasStroller").default(false),
  // 連絡先
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  lineUserId: varchar("lineUserId", { length: 255 }),
  // 希望席種
  preferredSeatTypeId: int("preferredSeatTypeId"),
  assignedSeatTypeId: int("assignedSeatTypeId"),
  // 状態
  status: mysqlEnum("status", ["waiting", "notified", "arrived", "seated", "canceled", "noshow"]).default("waiting").notNull(),
  // POS用の種別/状態（待ち行列のstatusとは別軸）
  partyKind: mysqlEnum("partyKind", ["DINE_IN", "COUNTER_SALE", "MEMO_ONLY"]).default("DINE_IN").notNull(),
  posStatus: mysqlEnum("posStatus", ["OPEN", "MEMO_ONLY", "ITEMIZED", "PAYMENT_LOCKED", "PAID", "VOID"]).default("OPEN").notNull(),
  tableLabel: varchar("tableLabel", { length: 50 }),
  memoText: text("memoText"),
  memoImageUrl: text("memoImageUrl"),
  paymentLockedAt: timestamp("paymentLockedAt"),
  paymentLockedByStaffId: int("paymentLockedByStaffId"),
  // 優先度（VIP対応など）
  priority: int("priority").default(0),
  // 備考
  notes: text("notes"),
  allergies: text("allergies"),
  // アクセストークン（ゲストWeb用）
  accessToken: varchar("accessToken", { length: 64 }).notNull(),
  // 推定待ち時間（分）
  estimatedWaitMinutes: int("estimatedWaitMinutes"),
  // タイムスタンプ
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  notifiedAt: timestamp("notifiedAt"),
  arrivedAt: timestamp("arrivedAt"),
  seatedAt: timestamp("seatedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Party = typeof parties.$inferSelect;
export type InsertParty = typeof parties.$inferInsert;

// ============================================
// Audit Log (監査ログ)
// ============================================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ============================================
// Notification (通知)
// ============================================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  partyId: int("partyId").notNull(),
  // 通知タイプ
  type: mysqlEnum("type", ["registration", "notify", "remind", "seated", "custom"]).notNull(),
  // チャネル
  channel: mysqlEnum("channel", ["sms", "line", "email"]).notNull(),
  // 送信先
  recipient: varchar("recipient", { length: 320 }).notNull(),
  // 内容
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  // 送信結果
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  // 外部ID（SMS/LINE APIのID）
  externalId: varchar("externalId", { length: 255 }),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================
// Notification Template (通知テンプレート)
// ============================================
export const notificationTemplates = mysqlTable("notification_templates", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  type: mysqlEnum("type", ["registration", "notify", "remind", "seated", "custom"]).notNull(),
  channel: mysqlEnum("channel", ["sms", "line", "email"]).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  template: text("template").notNull(), // {{ticketNumber}}, {{guestName}}, {{waitTime}} などのプレースホルダー
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// ============================================
// Menu Category (メニューカテゴリ)
// ============================================
export const menuCategories = mysqlTable("menu_categories", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  // 提供時間帯 (JSON: { lunch: true, dinner: true })
  availableTime: json("availableTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = typeof menuCategories.$inferInsert;

// ============================================
// Menu Item (メニュー商品)
// ============================================
export const menuItems = mysqlTable("menu_items", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 0 }).notNull(),
  imageUrl: text("imageUrl"),
  // 在庫管理
  isAvailable: boolean("isAvailable").default(true).notNull(),
  stockCount: int("stockCount"), // nullは無制限
  // 調理時間（分）
  prepTimeMinutes: int("prepTimeMinutes").default(10),
  // アレルゲン情報 (JSON配列)
  allergens: json("allergens"),
  // カロリー
  calories: int("calories"),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

// ============================================
// Menu Modifier (オプション/トッピング)
// ============================================
export const menuModifiers = mysqlTable("menu_modifiers", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  menuItemId: int("menuItemId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 0 }).default("0"),
  isRequired: boolean("isRequired").default(false),
  maxSelections: int("maxSelections").default(1),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuModifier = typeof menuModifiers.$inferSelect;
export type InsertMenuModifier = typeof menuModifiers.$inferInsert;

// ============================================
// Order (注文)
// ============================================
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  partyId: int("partyId").notNull(),
  orderNumber: int("orderNumber").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "served", "canceled"]).default("pending").notNull(),
  routeToKitchen: boolean("routeToKitchen").default(true).notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 0 }).default("0"),
  notes: text("notes"),
  // 事前注文か着席後注文か
  orderType: mysqlEnum("orderType", ["preorder", "dine_in"]).default("preorder"),
  // 受付経路
  entrySource: varchar("entrySource", { length: 32 }),
  // 支払い情報
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "paid", "voided"]).default("unpaid").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paidAt: timestamp("paidAt"),
  paymentCanceledAt: timestamp("paymentCanceledAt"),
  orderedAt: timestamp("orderedAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
  preparedAt: timestamp("preparedAt"),
  servedAt: timestamp("servedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================
// Order Item (注文明細)
// ============================================
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  menuItemId: int("menuItemId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 0 }).notNull(),
  // 選択されたモディファイア (JSON配列)
  modifiers: json("modifiers"),
  modifierPrice: decimal("modifierPrice", { precision: 10, scale: 0 }).default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 0 }).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "preparing", "ready", "served", "canceled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================
// Subscription (サブスクリプション履歴)
// ============================================
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "standard", "premium"]).notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "trialing"]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  canceledAt: timestamp("canceledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================
// Analytics (分析データ - 日次集計)
// ============================================
export const dailyAnalytics = mysqlTable("daily_analytics", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  // 受付数
  totalParties: int("totalParties").default(0),
  totalGuests: int("totalGuests").default(0),
  // 状態別カウント
  seatedCount: int("seatedCount").default(0),
  canceledCount: int("canceledCount").default(0),
  noshowCount: int("noshowCount").default(0),
  // 待ち時間統計（分）
  avgWaitTime: int("avgWaitTime"),
  maxWaitTime: int("maxWaitTime"),
  minWaitTime: int("minWaitTime"),
  // 回転時間統計（分）
  avgTurnoverTime: int("avgTurnoverTime"),
  // 通知統計
  notificationsSent: int("notificationsSent").default(0),
  notificationsDelivered: int("notificationsDelivered").default(0),
  notificationsFailed: int("notificationsFailed").default(0),
  // 注文統計
  totalOrders: int("totalOrders").default(0),
  totalOrderAmount: decimal("totalOrderAmount", { precision: 12, scale: 0 }).default("0"),
  preorderCount: int("preorderCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type InsertDailyAnalytics = typeof dailyAnalytics.$inferInsert;
