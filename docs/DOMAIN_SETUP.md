# space-archive.jp カスタムドメイン設定手順

運営：株式会社SPACE。本番は `https://space-archive.jp` で公開する想定です。

---

## ステップ 1：ドメインを取得する（未取得の場合）

1. **レジストラで検索・取得**
   - 例：[お名前.com](https://www.onamae.com/) / [ムームードメイン](https://muumuu-domain.com/) / [カゴヤ・ジャパン](https://www.kagoya.jp/domain/) などで「space-archive.jp」を検索。
   - `.jp` は日本レジストリ（JPRS）のドメイン。取得時に会社名・連絡先などの情報が必要な場合があります。
2. **取得後、そのレジストラの「DNS設定」または「ネームサーバー設定」の画面を開けるようにしておく。**

---

## ステップ 2：Vercel にドメインを追加する

1. [Vercel](https://vercel.com) にログインし、**ultla-archive** プロジェクトを開く。
2. 上部メニュー **Settings** → 左サイドバー **Domains** をクリック。
3. **Add** または「ドメインを追加」で、`space-archive.jp` を入力して追加。
4. **「www あり」も使うか**
   - `space-archive.jp` だけなら「ルートドメイン」のみ。
   - `www.space-archive.jp` も使う場合は、Vercel が案内に従って `www` 用の CNAME も追加する。
5. 追加すると、Vercel が **「このドメインを使うには、次の DNS レコードを設定してください」** と表示します。
   - 多くの場合、次のどちらかです：
     - **CNAME**: `www` などサブドメイン用。例：`www` → `cname.vercel-dns.com`
     - **A レコード**: ルート（`@` や `space-archive.jp`）用。例：`76.76.21.21` など Vercel が表示する IP。
   - 表示された **ホスト名・タイプ・値** をメモ（またはスクショ）する。

---

## ステップ 3：レジストラで DNS を設定する

1. ドメインを取得したレジストラの管理画面で、**DNS 設定**（DNS レコード編集・ネームサーバー設定）を開く。
2. **ステップ 2** で Vercel が表示したとおりにレコードを追加する。
   - **ルート（@）で A レコード**  
     ホスト: `@` または空、タイプ: A、値: Vercel が表示した IP（例: `76.76.21.21`）。
   - **www を使う場合**  
     ホスト: `www`、タイプ: CNAME、値: `cname.vercel-dns.com`（Vercel の表示に従う）。
3. **保存** する。
4. DNS の反映には **数分〜最大 48 時間** かかることがあります。  
   Vercel の Domains 画面では、反映されると「Valid Configuration」などと表示されます。

---

## ステップ 4：Supabase の Redirect URL を追加する

ログイン（Google など）後に正しく戻るように、Supabase 側にもカスタムドメインを登録します。

1. [Supabase](https://supabase.com) の該当プロジェクト → **Authentication** → **URL Configuration** を開く。
2. **Redirect URLs** に次を追加：
   - `https://space-archive.jp/**`
   - `https://space-archive.jp`
   - （`www` を使う場合）`https://www.space-archive.jp/**` と `https://www.space-archive.jp`
3. **Save** する。

---

## 確認

- ブラウザで `https://space-archive.jp` を開き、ultla-archive の画面が表示されること。
- ログイン → ログアウトが問題なくできること。
- 証明書は Vercel が自動で発行するため、特に操作は不要です（初回アクセス後しばらくで有効になります）。

---

## トラブル時

- **「Invalid Configuration」のまま**  
  DNS の値・ホスト名が Vercel の案内と一致しているか確認。反映待ちの場合は時間をおいて再確認。
- **ログイン後にエラー**  
  Supabase の Redirect URLs に `https://space-archive.jp/**` が含まれているか確認。
