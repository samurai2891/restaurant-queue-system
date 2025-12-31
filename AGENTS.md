# AGENTS.md

## 目的（プロジェクトのゴール / 原則）
- レストランの待ち行列/順番管理を安全・確実に運用できること。
- 変更は小さく、安全に。既存仕様を壊さないことを優先する。
- 監査可能性（ログ/履歴）と可観測性を重視する。

## Agent種別と役割定義（Backend/Frontend/QA/Integrations）
- Backend: API、DB、ビジネスロジックの実装/保守。
- Frontend: UI/UX、表示ロジック、状態管理。
- QA: 受け入れ基準・テストケース定義、回帰確認。
- Integrations: 外部API、通知、連携基盤の実装/保守。

## 作業スコープ（ファイル・ディレクトリ）
- Backend: `server/`, `shared/`（API/モデル）、`drizzle/`
- Frontend: `client/`, `shared/`（UI/型）
- QA: `client/`, `server/`, `shared/`, `vitest.config.ts`
- Integrations: `server/` 内の `integrations/` 相当の領域（該当時）

## 成果物定義（必須成果 / 受け入れ基準）
- 必須成果:
  - 変更内容の概要と影響範囲の説明
  - 必要に応じたテストの追加/更新
  - 変更点のドキュメント更新（必要時）
- 受け入れ基準:
  - 既存テストが通る
  - 主要なユーザーフローが破綻しない
  - 変更点が明確で、レビュー可能な単位に分割されている

## テスト/検証ルール
- 可能な限り自動テスト（unit/integration/e2e）を実行する。
- 実行できない場合は理由を明記する。

## 依存・環境要件（DB/外部API/環境変数）
- DB: 依存するデータストアがある場合は `drizzle.config.ts` を参照。
- 外部API: 利用するAPIは `server/` 内の設定に準拠。
- 環境変数: `.env` または `server/` の設定ファイルに記載される前提。
