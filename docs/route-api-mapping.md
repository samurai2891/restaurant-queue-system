# 画面・ルーティング・API対応まとめ

## 1. ルーティング定義と画面一覧

### 1-1. ルーティング定義（`client/src/App.tsx`）

| パス | 画面コンポーネント | ファイル | 備考 |
| --- | --- | --- | --- |
| `/` | `Home` | `client/src/pages/Home.tsx` | 公開ページ |
| `/about` | `About` | `client/src/pages/About.tsx` | 公開ページ |
| `/pricing` | `Pricing` | `client/src/pages/Pricing.tsx` | 公開ページ |
| `/guest/register/:storeId` | `GuestRegister` | `client/src/pages/GuestRegister.tsx` | ゲスト受付 |
| `/guest/status/:accessToken` | `GuestStatus` | `client/src/pages/GuestStatus.tsx` | 待ち状況 |
| `/guest/menu/:accessToken` | `GuestMenu` | `client/src/pages/GuestMenu.tsx` | ゲスト注文 |
| `/dashboard` | `Dashboard` | `client/src/pages/Dashboard.tsx` | 管理ダッシュボード |
| `/queue/:storeId` | `QueueManagement` | `client/src/pages/QueueManagement.tsx` | 管理（受付/待ち列） |
| `/settings/:storeId` | `StoreSettings` | `client/src/pages/StoreSettings.tsx` | 管理（店舗設定） |
| `/menu/:storeId` | `MenuManagement` | `client/src/pages/MenuManagement.tsx` | 管理（メニュー） |
| `/cashier/:storeId` | `Cashier` | `client/src/pages/Cashier.tsx` | 管理（会計） |
| `/register/:storeId` | `Register` | `client/src/pages/Register.tsx` | 管理（会計専用入力） |
| `/kitchen/:storeId` | `KitchenDisplay` | `client/src/pages/KitchenDisplay.tsx` | キッチン表示 |
| `/analytics/:storeId` | `Analytics` | `client/src/pages/Analytics.tsx` | 分析ダッシュボード |
| `/export/:storeId` | `DataExport` | `client/src/pages/DataExport.tsx` | データ出力 |
| `/404` | `NotFound` | `client/src/pages/NotFound.tsx` | 明示的404 |
| それ以外 | `NotFound` | `client/src/pages/NotFound.tsx` | フォールバック |

### 1-2. 画面一覧（`client/src/pages`）

| 画面コンポーネント | ファイル | ルーティング有無 |
| --- | --- | --- |
| `About` | `client/src/pages/About.tsx` | あり (`/about`) |
| `Analytics` | `client/src/pages/Analytics.tsx` | あり (`/analytics/:storeId`) |
| `Cashier` | `client/src/pages/Cashier.tsx` | あり (`/cashier/:storeId`) |
| `ComponentShowcase` | `client/src/pages/ComponentShowcase.tsx` | なし（ルート定義に未登録） |
| `Dashboard` | `client/src/pages/Dashboard.tsx` | あり (`/dashboard`) |
| `DataExport` | `client/src/pages/DataExport.tsx` | あり (`/export/:storeId`) |
| `GuestMenu` | `client/src/pages/GuestMenu.tsx` | あり (`/guest/menu/:accessToken`) |
| `GuestRegister` | `client/src/pages/GuestRegister.tsx` | あり (`/guest/register/:storeId`) |
| `GuestStatus` | `client/src/pages/GuestStatus.tsx` | あり (`/guest/status/:accessToken`) |
| `Home` | `client/src/pages/Home.tsx` | あり (`/`) |
| `KitchenDisplay` | `client/src/pages/KitchenDisplay.tsx` | あり (`/kitchen/:storeId`) |
| `MenuManagement` | `client/src/pages/MenuManagement.tsx` | あり (`/menu/:storeId`) |
| `NotFound` | `client/src/pages/NotFound.tsx` | あり (`/404`, fallback) |
| `Pricing` | `client/src/pages/Pricing.tsx` | あり (`/pricing`) |
| `QueueManagement` | `client/src/pages/QueueManagement.tsx` | あり (`/queue/:storeId`) |
| `Register` | `client/src/pages/Register.tsx` | あり (`/register/:storeId`) |
| `StoreSettings` | `client/src/pages/StoreSettings.tsx` | あり (`/settings/:storeId`) |

## 2. API 一覧（`server/routers.ts`）

### 2-1. ルータ別一覧（tRPC）

> 記法: `router.procedure`（権限: public/protected）

**system**
- `system.*`（内部システムルータ、詳細は `server/_core/systemRouter.ts`）

**auth**
- `auth.me`（public）
- `auth.logout`（public）

**store**
- `store.create`（protected）
- `store.list`（protected）
- `store.get`（protected）
- `store.update`（protected）
- `store.toggleReception`（protected）
- `store.getPublic`（public: `publicStore.get` のエイリアス）

**staff**
- `staff.list`（protected）
- `staff.add`（protected）
- `staff.update`（protected）

**seatType**
- `seatType.list`（protected）
- `seatType.create`（protected）
- `seatType.update`（protected）
- `seatType.listPublic`（public: `publicStore.seatTypes` のエイリアス）

**party**
- `party.list`（protected）
- `party.create`（protected）
- `party.guestRegister`（public）
- `party.guestStatus`（public）
- `party.guestArrive`（public）
- `party.guestCancel`（public）
- `party.updateStatus`（protected）
- `party.release`（protected）

**notification**
- `notification.send`（protected）
- `notification.history`（protected）
- `notification.templates`（protected）
- `notification.createTemplate`（protected）

**menu**
- `menu.categories`（public）
- `menu.createCategory`（protected）
- `menu.items`（public）
- `menu.createItem`（protected）
- `menu.updateItem`（protected）
- `menu.modifiers`（public）
- `menu.createModifier`（protected）
- `menu.guestCategories`（public: `menu.categories` のエイリアス）
- `menu.guestItems`（public: `menu.items` のエイリアス）

**order**
- `order.list`（protected）
- `order.create`（public）
- `order.createByStaff`（protected）
- `order.createForCheckout`（protected）
- `order.createProtected`（protected）
- `order.updateStatus`（protected）
- `order.confirmPayment`（protected）
- `order.confirmPaymentBatch`（protected）
- `order.cancelPayment`（protected）
- `order.updateItemStatus`（protected）
- `order.guestOrders`（public）
- `order.guestCreate`（public: `order.create` のエイリアス）
- `order.kitchen`（protected: `order.list` のエイリアス）

**analytics**
- `analytics.dashboard`（protected）
- `analytics.period`（protected）
- `analytics.waitTimeByHour`（protected）

**dataExport**
- `dataExport.export`（protected）

**publicStore**
- `publicStore.get`（public）
- `publicStore.seatTypes`（public）
- `publicStore.waitingCount`（public）

**subscription**
- `subscription.plans`（public）
- `subscription.current`（protected）
- `subscription.createCheckout`（protected）
- `subscription.createPortal`（protected）

## 3. 画面 ↔ API 対応表（主要フロー）

> 画面側の使用は `client/src/pages/*.tsx` の `trpc.*` 呼び出しに基づく。

### 3-1. 受付フロー（ゲスト/スタッフ）

| 画面 | 主なAPI | 備考 |
| --- | --- | --- |
| `GuestRegister` (`/guest/register/:storeId`) | `publicStore.get`, `publicStore.seatTypes`, `party.guestRegister` | ゲストの受付登録 |
| `QueueManagement` (`/queue/:storeId`) | `store.get`, `party.list`, `seatType.list`, `party.create`, `party.updateStatus`, `notification.send`, `store.toggleReception` | スタッフ受付・通知 |
| `Register` (`/register/:storeId`) | `store.get`, `menu.categories`, `menu.items`, `party.list`, `order.list`, `order.createForCheckout`, `order.confirmPaymentBatch` | 会計入力寄りの受付/注文連動 |

### 3-2. 待ち状況フロー

| 画面 | 主なAPI | 備考 |
| --- | --- | --- |
| `GuestStatus` (`/guest/status/:accessToken`) | `party.guestStatus`, `party.guestArrive`, `party.guestCancel` | 待ち状況表示/到着/キャンセル |
| `QueueManagement` (`/queue/:storeId`) | `party.list`, `party.updateStatus`, `party.release` | スタッフ側の進行管理 |

### 3-3. 注文フロー

| 画面 | 主なAPI | 備考 |
| --- | --- | --- |
| `GuestMenu` (`/guest/menu/:accessToken`) | `party.guestStatus`, `menu.categories`, `menu.items`, `order.create` | ゲスト注文 |
| `KitchenDisplay` (`/kitchen/:storeId`) | `store.get`, `order.list`, `order.updateStatus` | キッチン表示・調理進行 |
| `MenuManagement` (`/menu/:storeId`) | `store.get`, `menu.categories`, `menu.items`, `menu.createCategory`, `menu.createItem`, `menu.updateItem` | メニュー管理 |

### 3-4. 会計フロー

| 画面 | 主なAPI | 備考 |
| --- | --- | --- |
| `Cashier` (`/cashier/:storeId`) | `store.get`, `menu.categories`, `menu.items`, `party.list`, `order.list`, `party.create`, `order.createByStaff`, `order.confirmPaymentBatch` | レジでの注文・会計 |
| `Register` (`/register/:storeId`) | `order.createForCheckout`, `order.confirmPaymentBatch` | 会計入力専用 |

### 3-5. 管理/運用フロー

| 画面 | 主なAPI | 備考 |
| --- | --- | --- |
| `Dashboard` (`/dashboard`) | `store.list`, `store.create` | 店舗一覧/作成 |
| `StoreSettings` (`/settings/:storeId`) | `store.get`, `store.update`, `seatType.list`, `seatType.create`, `seatType.update`, `notification.templates` | 店舗設定・席種・通知テンプレート |
| `Analytics` (`/analytics/:storeId`) | `store.get`, `analytics.dashboard`, `analytics.period`, `analytics.waitTimeByHour` | 分析 |
| `DataExport` (`/export/:storeId`) | `store.get`, `dataExport.export` | データ出力 |
| `Pricing` (`/pricing`) | `subscription.plans`, `subscription.createCheckout` | 料金プラン/購入 |

## 4. ドキュメント保存先・差分/上書き方針

- 保存先: `docs/route-api-mapping.md`
- 既存ドキュメントとの差分: 現時点で `docs/` 配下に関連ドキュメントがないため、新規作成。
- 上書き方針: 以降の更新は **同ファイルを上書き更新**し、他ドキュメントは変更しない。

