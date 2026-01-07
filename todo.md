# Restaurant Queue System - TODO

## データベース・基盤
- [x] データベーススキーマ設計・実装
- [x] 店舗（Store）テーブル
- [x] 席種（SeatType）テーブル
- [x] パーティ（Party/受付）テーブル
- [x] 通知（Notification）テーブル
- [x] メニュー関連テーブル（Category, MenuItem, Modifier）
- [x] 注文関連テーブル（Order, OrderItem）
- [x] サブスクリプション（Subscription）テーブル

## 1. 店舗設定機能
- [x] 営業時間・受付時間の設定
- [x] 受付停止/再開機能
- [x] 席種マスタ（テーブル/カウンター）の登録
- [x] min/max人数設定

## 2. 受付（順番待ち登録）機能
- [x] 店員用受付画面（iPad/PC対応）
- [x] ゲスト自己受付（QRコード→Web）
- [x] 人数・連絡先・席種選択の入力フォーム
- [x] 受付番号の自動発行

## 3. キュー管理機能
- [x] 待ち状態の一覧表示
- [x] 状態遷移管理（Waiting/Notified/Arrived/Seated/Cancel/No-show）
- [x] 並び替え・フィルタ機能
- [x] 呼び出し履歴の記録

## 4. SMS呼び出し機能
- [x] 受付完了通知テンプレート
- [x] 呼び出し通知テンプレート
- [x] 再呼び出し通知テンプレート
- [x] SMS送信機能（API準備済み）
- [x] 送信結果ログの記録

## 5. LINE公式アカウント通知機能
- [x] LINE Messaging API連携（設定画面）
- [x] 受付完了通知（LINE）
- [x] 呼び出し通知（LINE）
- [x] 再呼び出し通知（LINE）

## 6. 案内（着席）処理機能
- [x] 席種別の空き数管理
- [x] 案内候補の自動提示
- [x] ワンクリック着席処理
- [x] 例外時の手動オーバーライド

## 7. ゲストWeb進捗ページ
- [x] 受付番号・現在の状態表示
- [x] 呼び出し表示
- [x] リアルタイム更新機能（ポーリング）
- [x] QRコード/SMS経由でのアクセス

## 8. 権限管理
- [x] 店長・ホスト・スタッフの役割定義
- [x] 役割別アクセス制御

## 9. Stripe課金機能
- [x] Stripe連携設定
- [x] 店舗ごとのサブスクリプション管理
- [x] プラン選択（Free/Standard/Premium）
- [x] 支払い履歴の記録
- [x] Webhookハンドラー

## 10. 事前注文機能
- [x] メニューカテゴリ管理
- [x] 商品管理
- [x] オプション（Modifier）管理
- [x] 順番待ち上位N組への注文解放ルール
- [x] キッチン受注画面

## 11. 待ち時間予測・分析機能
- [x] 席種別回転時間の学習
- [x] 待ち時間自動推定
- [x] 離脱率分析
- [x] No-show率分析
- [x] 通知反応率分析
- [x] 分析ダッシュボード

## UI/UX
- [x] ランディングページ
- [x] 管理者ダッシュボード
- [x] モバイル対応（レスポンシブ）
- [x] 会社概要ページ
- [x] 料金プランページ

## テスト
- [x] 認証ログアウトテスト
- [x] 店舗作成・一覧テスト
- [x] パーティ登録・状態テスト
- [x] サブスクリプションテスト

## 追加機能: ゲスト事前注文機能の強化
- [x] ゲストステータスページからメニュー閲覧への導線追加
- [x] メニュー閲覧専用ページの作成（注文前のブラウジング）
- [x] カート機能の改善（数量変更、削除）
- [x] 注文確認画面の追加
- [x] 注文完了後のステータス表示改善
- [x] メニュー画像表示の最適化

## バグ修正
- [x] analytics.waitTimeByHourプロシージャが見つからないエラーを修正

## バグ修正（2026-01-02）
- [x] ダッシュボードページで発生している「Unexpected token '<', "<!doctype "... is not valid JSON」エラーを修正（lt関数のインポート漏れを修正）
- [x] GitHub同期時のマージコンフリクトを解決（dataExportRouter重複、routeToKitchen重複、autoNotifyRank/Minutes削除）

## バグ調査（2026-01-02）
- [x] 実装している全機能のUIを調査
- [x] ダッシュボードページの確認 - 正常
- [x] キュー管理ページの確認 - 正常
- [x] メニュー管理ページの確認 - 正常
- [x] 分析ページの確認 - Reactフックエラー
- [x] 店舗設定ページの確認 - 正常

## 発見された問題
- [x] Analytics.tsxのReactフックエラーを修正（useMemoを条件分岐の前に移動）
- [x] データダウンロード/データ出力ページのルーティングを確認（正常に動作）
- [x] App.tsxのルーティング設定を確認（/export/:storeIdで正しく設定済み）


## Stripe課金設定（2026-01-04）
- [x] ユーザー提供のStripe APIキーを設定
- [x] Stripe製品・価格の作成（Free/Standard/Premium）
- [x] Webhookエンドポイントの確認
- [x] サブスクリプションプランAPIの動作確認


## バグ修正（2026-01-06）
- [x] /adminページで発生していた「Unexpected token '<', "<!doctype "... is not valid JSON」エラーを修正（サーバー再起動中の一時的なエラーであることを確認）
- [x] TypeScript型エラーを修正（PartyRow型定義、publicStore.getにenablePosV2UI追加、db.tsのor関数型エラー、ticket.tsのnull値処理）
- [x] 全TypeScriptエラーを解消し、APIエンドポイントが正しく動作することを確認


## バグ修正（2026-01-06 - NaNエラー）
- [x] /settings/NaNページで発生していた「Invalid input: expected number, received NaN」エラーを修正
- [x] URLパラメータのstoreIdが正しく解析されない原因を特定（DashboardLayoutの正規表現マッチング問題）
- [x] StoreSettingsコンポーネントでNaN値のバリデーションを追加（早期リターンとエラーメッセージ表示）
- [x] DashboardLayoutでstoreIdがない場合のナビゲーションリンクを非表示に修正


## GitHub同期後の修正（2026-01-07）
- [x] GitHubリポジトリから最新変更をプル（Register.tsx AirPay風リファクタリング、RBAC調整、新テストケース追加）
- [x] リモート変更で再発したTypeScriptエラーを修正（party.ts PartyRow型定義、ticket.ts null値処理）
- [x] 全26件のテスト通過、TypeScriptエラーなし
