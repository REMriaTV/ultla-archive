/** ジャンル種別の id（genre_types テーブルで管理。例: program, organization, municipality） */
export type GenreType = string;

/** スライドの公開レベル */
export type SlideVisibility = "free" | "invite_only" | "private";

/** コンテンツ階層（サブスク用）。NULL は basic 扱い */
export type ContentTier = "basic" | "pro" | "advance";

/** ユーザープラン（profiles.plan） */
export type Plan = "free" | "basic" | "pro" | "advance" | "premium";

export interface Program {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  started_year: number | null;
  /** 旧: 共通バッジ表示名（互換用） */
  shelf_badge_label?: string | null;
  /** スライド棚のバッジ表示設定（未設定なら非表示） */
  slide_badge_label?: string | null;
  slide_badge_bg?: string | null;
  slide_badge_text?: string | null;
  /** 動画棚のバッジ表示設定（未設定なら非表示） */
  video_badge_label?: string | null;
  video_badge_bg?: string | null;
  video_badge_text?: string | null;
  /** ジャンル種別（genre_types.id を参照） */
  genre_type?: string | null;
  /** トップページのシリーズ棚・トップ棚に載せるか。false だとトップの棚対象から外れる */
  show_on_front?: boolean;
  /** マイページ等サイドバーの「コンテンツ」メニューに出すか */
  show_in_sidebar?: boolean;
}

export interface Slide {
  id: string;
  program_id: string;
  title: string;
  keyword_tags: string[];
  caption: string | null;
  image_url: string | null;
  pdf_url: string | null;
  year: number | null;
  page_count: number | null;
  page_image_urls: string[] | null;
  /** free=未ログインでも一覧・4枚まで, invite_only=紐づくコード必須, private=管理者のみ */
  visibility?: SlideVisibility;
  /** basic=BASICでフル閲覧, pro=PROでレンタル/購入, advance=ADVANCEのみ。NULLはbasic扱い */
  content_tier?: ContentTier | null;
}

/** 招待コード（閲覧可能なスライド/動画のセットを定義） */
export interface InviteCode {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  max_uses: number;
  used_count: number;
  created_at: string;
}

/** 招待コード×スライド紐づけ */
export interface InviteCodeSlide {
  invite_code_id: string;
  slide_id: string;
}

/** 招待コード×動画紐づけ */
export interface InviteCodeVideo {
  invite_code_id: string;
  video_id: string;
}

/** ユーザー×招待コード紐づけ（有効期限付き） */
export interface UserInviteCode {
  user_id: string;
  invite_code_id: string;
  expires_at: string;
  created_at: string;
}
