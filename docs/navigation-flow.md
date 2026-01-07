# 画面分類と導線マップ

## 1. 画面分類（`client/src/pages`）

| 画面 | ルート | 分類 | 備考 |
| --- | --- | --- | --- |
| `Home.tsx` | `/` | 公開 | トップページ |
| `About.tsx` | `/about` | 公開 | 会社概要 |
| `Pricing.tsx` | `/pricing` | 公開 | 料金 |
| `GuestEntry.tsx` | `/guest` | ゲスト入口 | ゲスト導線の入口ページ |
| `GuestRegister.tsx` | `/guest/register/:storeId` | ゲスト | 受付登録 |
| `GuestStatus.tsx` | `/guest/status/:accessToken` | ゲスト | 順番状況 |
| `GuestMenu.tsx` | `/guest/menu/:accessToken` | ゲスト | メニュー閲覧/事前注文 |
| `StaffEntry.tsx` | `/staff` | スタッフ入口 | スタッフ導線の入口ページ |
| `Dashboard.tsx` | `/dashboard`, `/admin` | 管理者 | 管理者ポータル |
| `QueueManagement.tsx` | `/queue/:storeId` | スタッフ | キュー管理 |
| `Register.tsx` | `/register/:storeId` | スタッフ | レジ（AirPay風 1画面POSレジ / 伝票=party） |
| `Cashier.tsx` | `/cashier/:storeId` | スタッフ | 注文受付 |
| `KitchenDisplay.tsx` | `/kitchen/:storeId` | スタッフ | キッチン |
| `MenuManagement.tsx` | `/menu/:storeId` | 管理者 | メニュー管理 |
| `StoreSettings.tsx` | `/settings/:storeId` | 管理者 | 設定 |
| `Analytics.tsx` | `/analytics/:storeId` | 管理者 | 分析 |
| `DataExport.tsx` | `/export/:storeId` | 管理者 | データ出力 |
| `NotFound.tsx` | `*` | 共通 | 404 |

## 2. 現在の導線（リンク/リダイレクト）

```mermaid
flowchart TD
  Home[Home (/)] --> GuestEntry[/guest ゲスト入口/]
  Home --> StaffEntry[/staff スタッフ入口/]
  Home --> AdminPortal[/admin 管理者入口/]

  GuestEntry --> GuestRegister[/guest/register/:storeId]
  GuestEntry --> GuestStatus[/guest/status/:accessToken]
  GuestEntry --> GuestMenu[/guest/menu/:accessToken]

  StaffEntry --> Login[OAuth ログイン]
  StaffEntry --> StaffOps[/queue/:storeId]
  StaffEntry --> StaffOpsRegister[/register/:storeId]
  StaffEntry --> StaffOpsKitchen[/kitchen/:storeId]

  AdminPortal --> Dashboard[/dashboard 店舗一覧/]
  Dashboard --> AdminMenu[/menu/:storeId]
  Dashboard --> AdminSettings[/settings/:storeId]
  Dashboard --> AdminAnalytics[/analytics/:storeId]
  Dashboard --> AdminExport[/export/:storeId]
  Dashboard --> StaffOpsShortcuts[/queue/:storeId, /register/:storeId, /kitchen/:storeId]

  StaffOps --> StaffLayout[DashboardLayout (staff)]
  AdminMenu --> AdminLayout[DashboardLayout (admin)]
  AdminSettings --> AdminLayout
  AdminAnalytics --> AdminLayout
  AdminExport --> AdminLayout
```

## 3. 認可/認証の境界と整合性

- **ゲスト導線**: `guestRegister`, `guestStatus`, `guestArrive`, `guestCancel`, `guestOrders` などは `publicProcedure` で公開されており、ゲスト向けUIと整合しています。 (`server/routers.ts`)
- **スタッフ導線**: `checkStoreAccess` によりスタッフの在籍/ロールを検証し、`protectedProcedure` で認証済みユーザーのみアクセス可能にしています。 (`server/routers.ts`)
- **管理者導線**: `adminProcedure` により `ctx.user.role === 'admin'` のみ利用可能なシステムAPIがあります。管理画面の入口を `/admin` として明確化しました。 (`server/_core/trpc.ts`, `server/_core/systemRouter.ts`)

## 4. `/register/:storeId` のレジ（AirPay風 1画面）概要

- **目的**: 旧Step式（受付選択→注文→支払い）を廃止し、**1画面で伝票選択/商品追加/会計**まで完結。
- **導線**:
  - 伝票: 伝票番号/テーブル/顧客名で検索→選択
  - 受付: キュー（waiting/notified/arrived）から選択
  - 新規: 店内伝票 / 店頭（Quick Sale）/ メモ伝票
- **会計**: 伝票を `ticket.lockForPayment` でロックし、`payment.confirmCash` / `payment.confirmManual` で確定。
