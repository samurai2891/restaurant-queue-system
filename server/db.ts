import { eq, and, desc, asc, sql, gte, lte, lt, or, gt, SQL, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  stores, InsertStore, Store,
  storeStaff, InsertStoreStaff, StoreStaff,
  seatTypes, InsertSeatType, SeatType,
  parties, InsertParty, Party,
  auditLogs, InsertAuditLog,
  notifications, InsertNotification, Notification,
  notificationTemplates, InsertNotificationTemplate,
  menuCategories, InsertMenuCategory,
  menuItems, InsertMenuItem,
  menuModifiers, InsertMenuModifier,
  orders, InsertOrder,
  orderItems, InsertOrderItem,
  subscriptions, InsertSubscription,
  dailyAnalytics, InsertDailyAnalytics
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// User Functions
// ============================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Store Functions
// ============================================
export async function createStore(data: InsertStore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stores).values(data);
  return result[0].insertId;
}

export async function getStoreById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStoresByOwnerId(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stores).where(eq(stores.ownerId, ownerId));
}

export async function getStoresForAutoNotification() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stores);
}

export async function updateStore(id: number, data: Partial<InsertStore>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stores).set(data).where(eq(stores.id, id));
}

export async function getStoreByStaffUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const staffRecords = await db.select().from(storeStaff).where(eq(storeStaff.userId, userId));
  if (staffRecords.length === 0) return [];
  const storeIds = staffRecords.map(s => s.storeId);
  const storeList = [];
  for (const storeId of storeIds) {
    const store = await getStoreById(storeId);
    if (store) storeList.push({ ...store, staffRole: staffRecords.find(s => s.storeId === storeId)?.role });
  }
  return storeList;
}

// ============================================
// Store Staff Functions
// ============================================
export async function addStoreStaff(data: InsertStoreStaff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(storeStaff).values(data);
  return result[0].insertId;
}

export async function getStoreStaff(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(storeStaff).where(eq(storeStaff.storeId, storeId));
}

export async function getStaffByUserAndStore(userId: number, storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(storeStaff)
    .where(and(eq(storeStaff.userId, userId), eq(storeStaff.storeId, storeId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStoreStaff(id: number, data: Partial<InsertStoreStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(storeStaff).set(data).where(eq(storeStaff.id, id));
}

// ============================================
// Seat Type Functions
// ============================================
export async function createSeatType(data: InsertSeatType) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(seatTypes).values(data);
  return result[0].insertId;
}

export async function getSeatTypesByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seatTypes)
    .where(and(eq(seatTypes.storeId, storeId), eq(seatTypes.isActive, true)))
    .orderBy(asc(seatTypes.sortOrder));
}

export async function getSeatTypeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(seatTypes).where(eq(seatTypes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSeatType(id: number, data: Partial<InsertSeatType>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(seatTypes).set(data).where(eq(seatTypes.id, id));
}

export async function updateSeatAvailability(id: number, delta: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(seatTypes)
    .set({ availableSeats: sql`${seatTypes.availableSeats} + ${delta}` })
    .where(eq(seatTypes.id, id));
}

// ============================================
// Party Functions
// ============================================
export async function getNextTicketNumber(storeId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.select({ maxTicket: sql<number>`MAX(${parties.ticketNumber})` })
    .from(parties)
    .where(and(
      eq(parties.storeId, storeId),
      gte(parties.registeredAt, today)
    ));
  
  return (result[0]?.maxTicket || 0) + 1;
}

export async function createParty(data: Omit<InsertParty, 'accessToken' | 'ticketNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const ticketNumber = await getNextTicketNumber(data.storeId);
  const accessToken = nanoid(32);
  
  const result = await db.insert(parties).values({
    ...data,
    ticketNumber,
    accessToken,
  });
  
  return { id: result[0].insertId, ticketNumber, accessToken };
}

export async function getPartyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPartyByAccessToken(accessToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(parties).where(eq(parties.accessToken, accessToken)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPartiesByStoreId(storeId: number, status?: string[]) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let query = db.select().from(parties)
    .where(and(
      eq(parties.storeId, storeId),
      eq(parties.partyKind, "DINE_IN"),
      gte(parties.registeredAt, today)
    ))
    .orderBy(asc(parties.priority), asc(parties.registeredAt));
  
  return query;
}

export async function getPartiesForExport(
  storeId: number,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(parties.storeId, storeId)];
  if (options.startDate) {
    conditions.push(gte(parties.registeredAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(parties.registeredAt, options.endDate));
  }

  return db.select().from(parties)
    .where(and(...conditions))
    .orderBy(desc(parties.registeredAt))
    .limit(options.limit ?? 5000);
}

export async function getActivePartyCount(storeId: number) {
  const parties = await getPartiesByStoreId(storeId);
  return parties.filter(p => ["waiting", "notified", "arrived"].includes(p.status)).length;
}

export async function getWaitingParties(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return db.select().from(parties)
    .where(and(
      eq(parties.storeId, storeId),
      eq(parties.partyKind, "DINE_IN"),
      eq(parties.status, 'waiting'),
      gte(parties.registeredAt, today)
    ))
    .orderBy(desc(parties.priority), asc(parties.registeredAt));
}

export async function getPartyPosition(partyId: number, storeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const party = await getPartyById(partyId);
  if (!party || party.partyKind !== "DINE_IN" || party.status !== 'waiting') return 0;
  
  const waitingParties = await getWaitingParties(storeId);
  const position = waitingParties.findIndex(p => p.id === partyId) + 1;
  return position;
}

export async function updateParty(id: number, data: Partial<InsertParty>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(parties).set(data).where(eq(parties.id, id));
}

export async function getTicketsByStoreId(
  storeId: number,
  options: {
    partyKind?: Party["partyKind"];
    posStatus?: Party["posStatus"];
    search?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const conditions: SQL[] = [
    eq(parties.storeId, storeId),
    gte(parties.registeredAt, today),
  ];

  if (options.partyKind) {
    conditions.push(eq(parties.partyKind, options.partyKind));
  }

  if (options.posStatus) {
    conditions.push(eq(parties.posStatus, options.posStatus));
  }

  const search = options.search?.trim();
  if (search) {
    const likeQuery = `%${search}%`;
    const numeric = Number.parseInt(search, 10);
    const searchConditions: SQL[] = [
      sql`${parties.tableLabel} LIKE ${likeQuery}`,
      sql`${parties.guestName} LIKE ${likeQuery}`,
    ];
    if (Number.isFinite(numeric)) {
      searchConditions.push(eq(parties.ticketNumber, numeric));
    }
    const searchOr = or(...searchConditions);
    if (searchOr) conditions.push(searchOr);
  }

  const ticketRows = await db
    .select()
    .from(parties)
    .where(and(...conditions))
    .orderBy(desc(parties.updatedAt));

  if (ticketRows.length === 0) return [];

  const partyIds = ticketRows.map((p) => p.id);

  const totalsByParty = await db
    .select({
      partyId: orders.partyId,
      unpaidTotalAmount: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(inArray(orders.partyId, partyIds), eq(orders.paymentStatus, "unpaid")))
    .groupBy(orders.partyId);

  const itemsByParty = await db
    .select({
      partyId: orders.partyId,
      unpaidItemsCount: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(inArray(orders.partyId, partyIds), eq(orders.paymentStatus, "unpaid")))
    .groupBy(orders.partyId);

  const totalMap = new Map(totalsByParty.map((row) => [row.partyId, row.unpaidTotalAmount]));
  const itemMap = new Map(itemsByParty.map((row) => [row.partyId, row.unpaidItemsCount]));

  return ticketRows.map((ticket) => ({
    ...ticket,
    unpaidTotalAmount: totalMap.get(ticket.id) ?? 0,
    unpaidItemsCount: itemMap.get(ticket.id) ?? 0,
  }));
}

export async function updatePartyStatus(id: number, status: Party['status'], additionalData?: Partial<InsertParty>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Partial<InsertParty> = { status, ...additionalData };
  
  // タイムスタンプを自動設定
  const now = new Date();
  if (status === 'notified') updateData.notifiedAt = now;
  if (status === 'arrived') updateData.arrivedAt = now;
  if (status === 'seated') updateData.seatedAt = now;
  if (status === 'seated' || status === 'canceled' || status === 'noshow') {
    updateData.completedAt = now;
  }
  
  await db.update(parties).set(updateData).where(eq(parties.id, id));
}

// ============================================
// Notification Functions
// ============================================
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(data);
  return result[0].insertId;
}

export async function getNotificationsByPartyId(partyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.partyId, partyId))
    .orderBy(desc(notifications.createdAt));
}

export async function getLatestNotificationByPartyAndType(partyId: number, type: Notification["type"]) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notifications)
    .where(and(eq(notifications.partyId, partyId), eq(notifications.type, type)))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getNotificationsForExport(
  storeId: number,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(notifications.storeId, storeId)];
  if (options.startDate) {
    conditions.push(gte(notifications.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(notifications.createdAt, options.endDate));
  }

  return db.select().from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit ?? 5000);
}

export async function updateNotification(id: number, data: Partial<InsertNotification>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set(data).where(eq(notifications.id, id));
}

// ============================================
// Audit Log Functions
// ============================================
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auditLogs).values(data);
  return result[0].insertId;
}

// ============================================
// Notification Template Functions
// ============================================
export async function createNotificationTemplate(data: InsertNotificationTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notificationTemplates).values(data);
  return result[0].insertId;
}

export async function getNotificationTemplatesByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationTemplates)
    .where(and(eq(notificationTemplates.storeId, storeId), eq(notificationTemplates.isActive, true)));
}

export async function getDefaultTemplate(storeId: number, type: string, channel: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notificationTemplates)
    .where(and(
      eq(notificationTemplates.storeId, storeId),
      eq(notificationTemplates.type, type as any),
      eq(notificationTemplates.channel, channel as any),
      eq(notificationTemplates.isDefault, true)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Menu Functions
// ============================================
export async function createMenuCategory(data: InsertMenuCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(menuCategories).values(data);
  return result[0].insertId;
}

export async function getMenuCategoriesByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuCategories)
    .where(and(eq(menuCategories.storeId, storeId), eq(menuCategories.isActive, true)))
    .orderBy(asc(menuCategories.sortOrder));
}

export async function updateMenuCategory(id: number, data: Partial<InsertMenuCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(menuCategories).set(data).where(eq(menuCategories.id, id));
}

export async function createMenuItem(data: InsertMenuItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(menuItems).values(data);
  return result[0].insertId;
}

export async function getMenuItemsByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems)
    .where(and(eq(menuItems.storeId, storeId), eq(menuItems.isActive, true)))
    .orderBy(asc(menuItems.sortOrder));
}

export async function getMenuItemsByCategoryId(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems)
    .where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.isActive, true)))
    .orderBy(asc(menuItems.sortOrder));
}

export async function getMenuItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateMenuItem(id: number, data: Partial<InsertMenuItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(menuItems).set(data).where(eq(menuItems.id, id));
}

export async function consumeMenuItemStock(menuItemId: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const menuItem = await getMenuItemById(menuItemId);
  if (!menuItem || menuItem.stockCount === null || menuItem.stockCount === undefined) {
    return;
  }
  const newStock = Math.max(menuItem.stockCount - quantity, 0);
  await db.update(menuItems).set({
    stockCount: newStock,
    isAvailable: newStock > 0,
  }).where(eq(menuItems.id, menuItemId));
}

export async function createMenuModifier(data: InsertMenuModifier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(menuModifiers).values(data);
  return result[0].insertId;
}

export async function getMenuModifiersByItemId(menuItemId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuModifiers)
    .where(and(eq(menuModifiers.menuItemId, menuItemId), eq(menuModifiers.isActive, true)))
    .orderBy(asc(menuModifiers.sortOrder));
}

// ============================================
// Order Functions
// ============================================
export async function getNextOrderNumber(storeId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.select({ maxOrder: sql<number>`MAX(${orders.orderNumber})` })
    .from(orders)
    .where(and(
      eq(orders.storeId, storeId),
      gte(orders.orderedAt, today)
    ));
  
  return (result[0]?.maxOrder || 0) + 1;
}

export async function createOrder(
  data: Omit<InsertOrder, "orderNumber"> & { entrySource?: string | null; routeToKitchen?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const orderNumber = await getNextOrderNumber(data.storeId);
  const result = await db.insert(orders).values({ ...data, orderNumber });
  return { id: result[0].insertId, orderNumber };
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrdersByStoreId(storeId: number, status?: string[]) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return db.select().from(orders)
    .where(and(
      eq(orders.storeId, storeId),
      gte(orders.orderedAt, today)
    ))
    .orderBy(desc(orders.orderedAt));
}

export async function getOrdersForExport(
  storeId: number,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(orders.storeId, storeId)];
  if (options.startDate) {
    conditions.push(gte(orders.orderedAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(orders.orderedAt, options.endDate));
  }

  return db.select().from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.orderedAt))
    .limit(options.limit ?? 5000);
}

export async function getOrdersByPartyId(partyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders)
    .where(eq(orders.partyId, partyId))
    .orderBy(desc(orders.orderedAt));
}

export async function updateOrder(
  id: number,
  data: Partial<InsertOrder> & { entrySource?: string | null; routeToKitchen?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function confirmOrderPayment(
  id: number,
  data: { paymentMethod: string; paidAt?: Date }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({
    paymentStatus: "paid",
    paymentMethod: data.paymentMethod,
    paidAt: data.paidAt ?? new Date(),
    paymentCanceledAt: null,
  }).where(eq(orders.id, id));
}

export async function cancelOrderPayment(id: number, data: { canceledAt?: Date } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({
    paymentStatus: "voided",
    paymentMethod: null,
    paidAt: null,
    paymentCanceledAt: data.canceledAt ?? new Date(),
  }).where(eq(orders.id, id));
}

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(data);
  return result[0].insertId;
}

export async function getOrderItemsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrderItemsForExport(
  storeId: number,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(orders.storeId, storeId)];
  if (options.startDate) {
    conditions.push(gte(orders.orderedAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(orders.orderedAt, options.endDate));
  }

  return db.select({
    order: orders,
    item: orderItems,
  })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .orderBy(desc(orders.orderedAt), desc(orderItems.id))
    .limit(options.limit ?? 5000);
}

export async function updateOrderItem(id: number, data: Partial<InsertOrderItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orderItems).set(data).where(eq(orderItems.id, id));
}

// ============================================
// Data Retention Functions
// ============================================
const getAffectedRows = (result: unknown): number => {
  if (Array.isArray(result) && result[0] && typeof result[0].affectedRows === "number") {
    return result[0].affectedRows;
  }
  return 0;
};

export async function deletePartiesBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete parties: database not available");
    return 0;
  }
  const result = await db.delete(parties).where(lt(parties.registeredAt, cutoff));
  return getAffectedRows(result);
}

export async function deleteNotificationsBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete notifications: database not available");
    return 0;
  }
  const result = await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
  return getAffectedRows(result);
}

export async function deleteOrderItemsBeforeOrderDate(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete order items: database not available");
    return 0;
  }
  const result = await db.execute(sql`
    delete from ${orderItems}
    where ${orderItems.orderId} in (
      select ${orders.id} from ${orders} where ${orders.orderedAt} < ${cutoff}
    )
  `);
  return getAffectedRows(result);
}

export async function deleteOrdersBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete orders: database not available");
    return 0;
  }
  const result = await db.delete(orders).where(lt(orders.orderedAt, cutoff));
  return getAffectedRows(result);
}

export async function deleteSubscriptionsBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete subscriptions: database not available");
    return 0;
  }
  const result = await db.delete(subscriptions).where(lt(subscriptions.createdAt, cutoff));
  return getAffectedRows(result);
}

export async function deleteDailyAnalyticsBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete daily analytics: database not available");
    return 0;
  }
  const result = await db.delete(dailyAnalytics).where(lt(dailyAnalytics.createdAt, cutoff));
  return getAffectedRows(result);
}

// ============================================
// Subscription Functions
// ============================================
export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data);
  return result[0].insertId;
}

export async function getSubscriptionByStoreId(storeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions)
    .where(eq(subscriptions.storeId, storeId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Analytics Functions
// ============================================
export async function upsertDailyAnalytics(data: InsertDailyAnalytics) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(dailyAnalytics).values(data).onDuplicateKeyUpdate({
    set: data
  });
}

export async function getDailyAnalytics(storeId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyAnalytics)
    .where(and(
      eq(dailyAnalytics.storeId, storeId),
      gte(dailyAnalytics.date, startDate),
      lte(dailyAnalytics.date, endDate)
    ))
    .orderBy(asc(dailyAnalytics.date));
}

type WaitTimeSampleRow = {
  hour: number;
  seatTypeId: number | null;
  seatTypeName: string | null;
  waitMinutes: number | null;
};

type WaitTimeDistributionBucket = {
  bucket: string;
  count: number;
};

export type WaitTimeByHourStat = {
  hour: number;
  seatTypeId: number | null;
  seatTypeName: string;
  count: number;
  avgWait: number;
  medianWait: number;
  p95Wait: number;
  minWait: number;
  maxWait: number;
  distribution: WaitTimeDistributionBucket[];
};

const waitTimeBuckets = [
  { label: "0-10", min: 0, max: 10 },
  { label: "11-20", min: 11, max: 20 },
  { label: "21-30", min: 21, max: 30 },
  { label: "31-45", min: 31, max: 45 },
  { label: "46-60", min: 46, max: 60 },
  { label: "61+", min: 61, max: Number.POSITIVE_INFINITY },
];

const nearestRank = (sorted: number[], percentile: number) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index];
};

const buildDistribution = (waitTimes: number[]) =>
  waitTimeBuckets.map((bucket) => ({
    bucket: bucket.label,
    count: waitTimes.filter((value) => value >= bucket.min && value <= bucket.max).length,
  }));

export async function getWaitTimeStatsByHour(storeId: number, startDate: string, endDate: string): Promise<WaitTimeByHourStat[]> {
  const db = await getDb();
  if (!db) return [];

  const rawRows = await db.execute<WaitTimeSampleRow>(sql`
    select
      hour(${parties.registeredAt}) as hour,
      coalesce(${parties.assignedSeatTypeId}, ${parties.preferredSeatTypeId}) as seatTypeId,
      ${seatTypes.name} as seatTypeName,
      timestampdiff(minute, ${parties.registeredAt}, ${parties.seatedAt}) as waitMinutes
    from ${parties}
    left join ${seatTypes}
      on ${seatTypes.id} = coalesce(${parties.assignedSeatTypeId}, ${parties.preferredSeatTypeId})
    where ${parties.storeId} = ${storeId}
      and ${parties.seatedAt} is not null
      and ${parties.registeredAt} is not null
      and ${parties.registeredAt} >= ${startDate}
      and ${parties.registeredAt} < date_add(${endDate}, interval 1 day)
  `);

  const rows: WaitTimeSampleRow[] = Array.isArray(rawRows) ? rawRows : (rawRows as any).rows || [];
  const grouped = new Map<string, { meta: Omit<WaitTimeByHourStat, "count" | "avgWait" | "medianWait" | "p95Wait" | "minWait" | "maxWait" | "distribution">; waits: number[] }>();

  rows.forEach((row: WaitTimeSampleRow) => {
    if (row.waitMinutes === null || row.waitMinutes === undefined) return;
    const hour = Number(row.hour);
    const seatTypeId = row.seatTypeId === null ? null : Number(row.seatTypeId);
    const seatTypeName = row.seatTypeName ?? "未指定";
    const key = `${hour}-${seatTypeId ?? "unassigned"}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.waits.push(Number(row.waitMinutes));
      return;
    }
    grouped.set(key, {
      meta: {
        hour,
        seatTypeId,
        seatTypeName,
      },
      waits: [Number(row.waitMinutes)],
    });
  });

  return Array.from(grouped.values())
    .map(({ meta, waits }) => {
      const sorted = waits.slice().sort((a, b) => a - b);
      const total = sorted.reduce((sum, value) => sum + value, 0);
      const avg = sorted.length > 0 ? Math.round(total / sorted.length) : 0;
      const median = nearestRank(sorted, 0.5);
      const p95 = nearestRank(sorted, 0.95);
      return {
        ...meta,
        count: sorted.length,
        avgWait: avg,
        medianWait: median,
        p95Wait: p95,
        minWait: sorted[0] ?? 0,
        maxWait: sorted[sorted.length - 1] ?? 0,
        distribution: buildDistribution(sorted),
      };
    })
    .sort((a, b) => (a.hour - b.hour) || a.seatTypeName.localeCompare(b.seatTypeName, "ja"));
}

// ============================================
// Utility Functions
// ============================================
export async function calculateEstimatedWaitTime(storeId: number, seatTypeId: number): Promise<number> {
  const waitingParties = await getWaitingParties(storeId);
  const seatType = await getSeatTypeById(seatTypeId);
  
  if (!seatType) return 0;
  
  const partiesAhead = waitingParties.filter(p => 
    !p.preferredSeatTypeId || p.preferredSeatTypeId === seatTypeId
  ).length;
  
  const avgTurnover = seatType.avgTurnoverMinutes || 60;
  const availableSeats = seatType.availableSeats || 1;
  
  return Math.ceil((partiesAhead / Math.max(availableSeats, 1)) * avgTurnover);
}
