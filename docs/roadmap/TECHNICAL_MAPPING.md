# 現行アーキテクチャ → サブスク移行 技術対応表

**作成日**: 2026-02-28  
**目的**: 実装に入る前に、現行のDB・ロジック・UIと新プランの対応関係を整理する。

---

## 1. 現行のアクセス制御まとめ

### 1.1 ユーザー状態

| 状態 | 判定 | 一覧表示 | スライド閲覧 |
|------|------|----------|-------------|
| 未ログイン | `userId = null` | visibility=free のみ | 4枚まで |
| ログイン（free・招待コードなし） | `plan=free`, `accessibleSlideIds=空` | visibility=free のみ | 4枚まで |
| ログイン（free・招待コードあり） | `plan=free`, `accessibleSlideIds=コード紐づけ` | free + invite_only（紐づきのみ） | 紐づきスライドは全ページ |
| premium | `plan=premium` | 全件 | 全ページ |
| 管理者 | `is_admin=true` | 全件 | 全ページ・ダウンロード可 |

### 1.2 現行テーブル・カラム

| 対象 | 現行 | 役割 |
|------|------|------|
| **profiles** | `plan` ('free' \| 'premium') | 全件閲覧権 |
| **profiles** | `is_admin` | 管理者フラグ |
| **profiles** | `access_granted` | レガシー（招待コード付与履歴） |
| **slides** | `visibility` ('free' \| 'invite_only' \| 'private') | 誰に一覧表示するか |
| **invite_codes** | code, name, max_uses, used_count, default_expires_at | 招待コード定義 |
| **invite_code_slides** | invite_code_id, slide_id | コード×スライド紐づけ |
| **user_invite_codes** | user_id, invite_code_id, expires_at | ユーザー×コード紐づけ（有効期限付き） |

### 1.3 主要コード・ロジック

| ファイル | 役割 |
|----------|------|
| `lib/access.ts` | `getAccessContext`, `canViewSlide`, `filterVisibleSlides` |
| `lib/types.ts` | `SlideVisibility`, `InviteCode`, `UserInviteCode` |
| `app/api/invite/validate/route.ts` | コード有効性チェック |
| `app/api/invite/grant/route.ts` | 招待コード付与（user_invite_codes に追加） |
| `components/InviteGrantChecker.tsx` | ログイン後の pending_invite_code 処理 |
| `app/slide/[id]/page.tsx` | `hasFullAccess` で 4枚 vs 全ページ を分岐 |

---

## 2. 新プランとの対応マッピング

### 2.1 プラン対応（案）

| 新プラン | 現行での表現 | 備考 |
|----------|-------------|------|
| **FREE** | `未ログイン` または `ログイン＆plan=free＆招待コードなし` | 4枚まで閲覧 |
| 招待コード（現状） | `plan=free` + 有効期限内の `user_invite_codes` | 紐づきスライドをフル閲覧。期限切れで案内表示 |
| **BASIC** | `plan='basic'`（新規） | サブスク課金連携 |
| **PRO** | `plan='pro'`（新規） | サブスク課金連携 |
| **ADVANCE** | `plan='advance'`（新規） or 現行 `premium` を拡張 | 全コンテンツ＋DL可 |

### 2.2 スライド区分の対応

| 新区分 | 現行 | 移行方針 |
|--------|------|----------|
| **BASIC** | visibility=free or invite_only の一部 | 新カラム `content_tier` 追加 ('basic' \| 'pro' \| 'advance') または visibility を拡張 |
| **PRO** | invite_only のうち「有料」相当 | 同上 |
| **ADVANCE** | private 相当 or 新設 | 同上 |

### 2.3 必要なDB変更（案）

| 対象 | 変更内容 |
|------|----------|
| **profiles** | `plan` を `'free' \| 'pro' \| 'advance' \| 'premium'` に拡張（premium は legacy として維持可） |
| **profiles** | `pro_trial_ends_at`（お試しPRO終了日）追加（任意） |
| **slides** | `content_tier` 追加 ('basic' \| 'pro' \| 'advance')。従来 visibility は一覧可否用で維持 |
| **subscriptions** | 新規テーブル（課金連携用）。stripe_customer_id, plan, period_end など |
| **content_purchases** | 新規テーブル（PROコンテンツのレンタル/購入履歴） |

### 2.4 招待コードの扱い（移行期）

- 既存 `invite_codes` / `user_invite_codes` は**削除しない**
- 招待コードは現状どおり維持。いきなり「お試しPRO」などとは明示しない
- **期限切れ時**: マイページ招待コードページにサブスク案内・プラン加入案内（BASIC/PRO/ADVANCE）を表示。リンクでサブスク登録画面へ

---

## 3. 新コンテンツ種別の追加

| 種別 | テーブル | 既存/新規 |
|------|----------|----------|
| プログラムスライド | slides | 既存 |
| ダイジェスト動画 | videos（新規） or slides に type 追加 | 新規 |
| STEAM CHAOS動画 | 同上 | 新規 |
| 風のカード | products（新規） | 新規 |
| ワークシート | slide_attachments（新規） or slides に添付 | 新規 |

---

## 4. 課金・決済（将来的）

- Stripe / lemon squeezy などサブスク対応決済と連携
- Webhook で `profiles.plan` / `subscriptions` を更新
- レンタル・購入は `content_purchases` に記録

---

## 5. 実装時の参照

- アクセス判定は `lib/access.ts` を拡張。`plan`, `content_tier`, `subscriptions` を考慮
- スライド一覧のフィルタは `filterVisibleSlides` を段階的に拡張
- 4枚制限は `app/slide/[id]/page.tsx` の `hasFullAccess` と `freePreviewPageCount` を維持・拡張
