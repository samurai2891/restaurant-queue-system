import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { analyticsRouter } from "./routers/analytics";
import { authRouter } from "./routers/auth";
import { dataExportRouter } from "./routers/dataExport";
import { menuRouter } from "./routers/menu";
import { notificationRouter } from "./routers/notification";
import { orderRouter } from "./routers/order";
import { partyRouter } from "./routers/party";
import { publicStoreRouter } from "./routers/publicStore";
import { seatTypeRouter } from "./routers/seatType";
import { staffRouter } from "./routers/staff";
import { storeRouter } from "./routers/store";
import { subscriptionRouter } from "./routers/subscription";
import { tableRouter } from "./routers/table";
import { ticketRouter } from "./routers/ticket";
import { paymentRouter } from "./routers/payment";

// ============================================
// Main Router
// ============================================
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  store: { ...storeRouter, getPublic: publicStoreRouter.get },
  staff: staffRouter,
  seatType: { ...seatTypeRouter, listPublic: publicStoreRouter.seatTypes },
  table: tableRouter,
  party: partyRouter,
  ticket: ticketRouter,
  payment: paymentRouter,
  notification: notificationRouter,
  menu: { ...menuRouter, guestCategories: menuRouter.categories, guestItems: menuRouter.items },
  order: { ...orderRouter, guestCreate: orderRouter.create, kitchen: orderRouter.list },
  analytics: analyticsRouter,
  dataExport: dataExportRouter,
  publicStore: publicStoreRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
