# サブスク移行 実装フェーズ計画

**作成日**: 2026-02-28  
**前提**: [改修案](./2026-02-28_subscription_migration_plan.md) と [技術対応表](./TECHNICAL_MAPPING.md) を参照

---

## フェーズ一覧

| フェーズ | 概要 | 推定工数 | 依存 |
|----------|------|----------|------|
| **Phase 0** | 招待コードを「お試しPRO」として位置づけ明確化 | 小 | なし |
| **Phase 1** | プラン・コンテンツ階層のDB/型拡張 | 中 | Phase 0 |
| **Phase 2** | アクセス制御ロジックの拡張（STANDARD/PRO/ADVANCE） | 中 | Phase 1 |
| **Phase 3** | 決済連携（Stripe等）・サブスク課金 | 大 | Phase 2 |
| **Phase 4** | PROコンテンツのレンタル/購入 | 大 | Phase 3 |
| **Phase 5** | 新コンテンツ種別（動画・風のカード・ワークシート） | 大 | Phase 2 |
| **Phase 6** | 学びの共有（ユーザー投稿） | 大 | Phase 5 |

---

## Phase 0: 招待コード期限切れ時のサブスク案内

**目的**: 招待コードの期限が切れたユーザーに、マイページでサブスク導入案内とプラン加入（BASIC/PRO/ADVANCE）を表示。リンクでサブスク登録画面（作成予定）へ遷移。

**方針**: 招待コードを「お試しPRO」などと明示しない。既存利用者に混乱を招かない。

### タスク

- [x] 招待コードページで「有効なコードが0件」のときにサブスク案内を表示
- [x] 案内内容: サブスク導入の説明、BASIC/PRO/ADVANCE の概要、サブスク登録へのリンク
- [x] サブスク登録画面のプレースホルダー `/mypage/subscription` を作成（Phase 3 で決済連携を実装）

### 変更ファイル（想定）

- `app/mypage/invite-codes/page.tsx`
- `app/mypage/invite-codes/InviteCodeList.tsx`
- 新規: `components/SubscriptionSignupBanner.tsx`（案内用コンポーネント）

### 成果物

- 招待コード期限切れ時にサブスク・プラン案内が表示される

---

## Phase 1: プラン・コンテンツ階層のDB/型拡張

**目的**: `plan` と `content_tier` を拡張し、新プラン構成の土台を作る。

### タスク

- [ ] **マイグレーション**: `profiles.plan` を `'free'|'pro'|'advance'|'premium'` に拡張（CHECK制約変更）
- [ ] **マイグレーション**: `slides` に `content_tier` カラム追加（'basic'|'pro'|'advance'、NULL は basic 扱い）
- [ ] 既存 `visibility` は維持（一覧表示制御用）
- [ ] `lib/types.ts` の型定義を更新
- [ ] 既存データの `content_tier` 初期値設定（visibility=free → basic、invite_only → pro or basic 等）
- [ ] 管理画面に `content_tier` の編集UIを追加

### 変更ファイル（想定）

- `supabase/migrations/20_plan_content_tier.sql`（新規）
- `lib/types.ts`
- `lib/access.ts`（plan の型のみ、ロジックは Phase 2）
- `app/admin/page.tsx`

### 成果物

- DB上で plan / content_tier が扱える状態
- 管理画面でスライドの content_tier を設定可能

---

## Phase 2: アクセス制御ロジックの拡張

**目的**: STANDARD / PRO / ADVANCE に基づいた閲覧可否判定を実装する。

### タスク

- [ ] `getAccessContext` で `plan` が pro/advance の場合の扱いを追加
- [ ] 招待コードあり = お試しPRO として `accessibleSlideIds` に加え、`pro_trial_ends_at` 相当の判定を統合
- [ ] `canViewSlide` を拡張: content_tier=basic → BASIC以上で可、content_tier=pro → PRO以上で可（レンタル/購入は Phase 4）、content_tier=advance → ADVANCE のみ
- [ ] 一覧フィルタ `filterVisibleSlides` を content_tier に対応
- [ ] スライド詳細ページの「4枚制限」を content_tier に基づいて適用
- [ ] フロントのプラン表示・案内文言の更新

### 変更ファイル（想定）

- `lib/access.ts`
- `app/slide/[id]/page.tsx`
- `app/page.tsx`（一覧）
- `components/SlideImageViewer.tsx`
- `app/mypage/account/page.tsx`

### 成果物

- 新プラン構成に沿ったアクセス制御が動作
- 課金なしでも招待コードで BASIC 相当のコンテンツを閲覧可能（現状維持）

---

## Phase 3: 決済連携・サブスク課金

**目的**: Stripe（または lemon squeezy 等）で月額サブスクを課金し、plan を更新する。

### タスク

- [ ] Stripe アカウント・プロダクト・価格の作成
- [ ] `subscriptions` テーブル作成（user_id, stripe_*, plan, current_period_end 等）
- [ ] チェックアウト・顧客ポータル用 API エンドポイント作成
- [ ] Webhook で `subscriptions` / `profiles.plan` を更新
- [ ] マイページに「プラン管理」「アップグレード」UI 追加
- [ ] 解約・更新時の処理

### 変更ファイル（想定）

- `supabase/migrations/21_subscriptions.sql`
- `app/api/stripe/` 配下（checkout, webhook, portal）
- `app/mypage/` にプラン管理ページ

### 成果物

- PRO / ADVANCE の月額課金が可能
- 課金状態に応じて plan が自動更新

---

## Phase 4: PROコンテンツのレンタル/購入

**目的**: content_tier=pro のスライドを、レンタル（期間限定閲覧）または購入（ダウンロード可）で提供する。

### タスク

- [ ] `content_purchases` テーブル作成（user_id, slide_id, type=rent|buy, expires_at 等）
- [ ] レンタル・購入用の決済フロー（Stripe one-time payment 等）
- [ ] `canViewSlide` で content_purchases を参照し、レンタル/購入済みなら閲覧可
- [ ] ダウンロード可否の判定（購入済み or ADVANCE）
- [ ] スライド詳細ページに「レンタル」「購入」ボタン追加

### 変更ファイル（想定）

- `supabase/migrations/22_content_purchases.sql`
- `lib/access.ts`
- `app/api/purchase/` 配下
- `app/slide/[id]/page.tsx`

### 成果物

- PRO コンテンツをレンタル/購入で閲覧可能
- 購入済みはダウンロード可

---

## Phase 5: 新コンテンツ種別の追加

**目的**: 動画・風のカード・ワークシートを登録・配信する。

### タスク

- [ ] 動画用テーブル（videos または slides に type 拡張）とストレージ設計
- [ ] プログラムダイジェスト動画: セキュリティ（ADVANCE or 招待）を考慮した公開条件
- [ ] STEAM CHAOS 動画: 64本 + ワークシートDL の紐づけ
- [ ] 風のカード: products テーブル、購入フロー
- [ ] ワークシート: スライド添付 or 独立コンテンツとして登録

### 変更ファイル（想定）

- 複数マイグレーション
- 新規ページ・コンポーネント多数

### 成果物

- 動画・カード・ワークシートの登録と閲覧・購入が可能

---

## Phase 6: 学びの共有（ユーザー投稿）

**目的**: 「このレシピで作ったらこんなのになりました」という投稿機能。

### タスク

- [ ] ユーザー投稿用テーブル（user_posts, user_post_attachments 等）
- [ ] 投稿作成・編集・削除 UI
- [ ] 一覧表示・フィルタ
- [ ] モデレーション方針の検討

### 成果物

- 学びの共有機能が利用可能

---

## 推奨実行順序

1. **Phase 0** → すぐ着手可能。招待コードの位置づけを明確にする
2. **Phase 1** → DB/型の準備。Phase 0 と並行しても可
3. **Phase 2** → アクセス制御の心臓部。Phase 1 完了後に実施
4. **Phase 3** → 決済が必須なら優先。そうでなければ Phase 5 の一部を先に着手も可
5. **Phase 4** → Phase 3 の後に実施
6. **Phase 5** → 動画・カードなどコンテンツ拡張。Phase 2 が動いていれば部分的に着手可能
7. **Phase 6** → 最後の拡張

---

## メモ

- **招待コード削除**: 葉山町の先生への影響を避けるため、Phase 0〜2 では削除しない。
- **premium の扱い**: 既存 premium ユーザーは ADVANCE 相当として扱うか、別途運用で対応
