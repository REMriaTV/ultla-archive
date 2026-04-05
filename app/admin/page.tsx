"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { KeywordTagInput } from "@/components/KeywordTagInput";
import { AnnouncementMarkdown } from "@/components/AnnouncementMarkdown";
import { extractYoutubeVideoId } from "@/lib/youtube";
import { isValidHttpUrl } from "@/lib/external-url";

type SlideVisibility = "free" | "invite_only" | "private";
type ContentTier = "basic" | "pro" | "advance";

const VISIBILITY_LABELS: Record<SlideVisibility, string> = {
  free: "公開（未ログインでも一覧・4枚まで）",
  invite_only: "コード必須（紐づくコードを持つ人のみ）",
  private: "非公開（管理者のみ）",
};

/** 一覧用の短いラベル */
const VISIBILITY_SHORT: Record<SlideVisibility, string> = {
  free: "公開（4枚まで）",
  invite_only: "コード必須",
  private: "非公開",
};

const CONTENT_TIER_LABELS: Record<ContentTier, string> = {
  basic: "BASIC",
  pro: "PRO",
  advance: "ADVANCE",
};

interface SlideRow {
  id: string;
  title: string;
  program_id: string;
  pdf_url: string | null;
  page_count: number | null;
  page_image_urls: string[] | null;
  image_url?: string | null;
  year: number | null;
  keyword_tags: string[];
  caption: string | null;
  visibility?: SlideVisibility;
  content_tier?: ContentTier | null;
}

function thumbPageIndexFromSlide(slide: SlideRow): number {
  const urls = slide.page_image_urls ?? [];
  if (urls.length === 0) return 1;
  const img = slide.image_url;
  if (img) {
    const idx = urls.findIndex((u) => u === img);
    if (idx >= 0) return idx + 1;
  }
  return 1;
}

/** 一覧サムネが PDF ページ画像ではなくアップロード画像などのとき true */
function slideHasCustomThumbnail(slide: SlideRow): boolean {
  const urls = slide.page_image_urls ?? [];
  const img = slide.image_url?.trim();
  if (!img) return false;
  if (urls.length === 0) return true;
  return !urls.includes(img);
}

const THUMB_ACCEPT_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function firstAcceptedImageFile(list: FileList | File[] | null | undefined): File | null {
  if (!list || list.length === 0) return null;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const f = "item" in list && typeof list.item === "function" ? list.item(i) : (list as File[])[i];
    if (f && THUMB_ACCEPT_MIME.has(f.type)) return f;
  }
  return null;
}

/** ドラッグ＆ドロップ・クリップボード用（DataTransfer / ClipboardEvent.clipboardData） */
function firstImageFileFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  const direct = firstAcceptedImageFile(dt.files);
  if (direct) return direct;
  const items = dt.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file") {
      const f = it.getAsFile();
      if (f && THUMB_ACCEPT_MIME.has(f.type)) return f;
    }
  }
  return null;
}

interface GenreTypeRow {
  id: string;
  name: string;
  sort_order: number;
}

interface Program {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  started_year: number | null;
  shelf_badge_label?: string | null;
  slide_badge_label?: string | null;
  slide_badge_bg?: string | null;
  slide_badge_text?: string | null;
  video_badge_label?: string | null;
  video_badge_bg?: string | null;
  video_badge_text?: string | null;
  genre_type: string | null;
  show_on_front?: boolean;
  show_in_sidebar?: boolean;
}

export default function AdminPage() {
  const pathname = usePathname();
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSlide, setEditingSlide] = useState<SlideRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    program_id: "",
    year: "",
    keyword_tags: "",
    caption: "",
    visibility: "private" as SlideVisibility,
    content_tier: "basic" as ContentTier,
    thumbnail_page: "1",
  });
  const [saving, setSaving] = useState(false);
  /** 編集モーダル開いたときの「サムネページ」表示値（カスタムサムネ時の保存で誤って上書きしないため） */
  const [slideThumbPageOnOpen, setSlideThumbPageOnOpen] = useState("1");
  const [slideEditThumbUploading, setSlideEditThumbUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [extractingCaption, setExtractingCaption] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    program_id: "",
    year: "",
    caption: "",
    visibility: "free" as SlideVisibility,
    content_tier: "basic" as ContentTier,
    thumbnail_page: "1",
  });
  const [keywordTags, setKeywordTags] = useState<string[]>([]);
  const [slideBadgeSelect, setSlideBadgeSelect] = useState("");
  const [slideBadgeNewLabel, setSlideBadgeNewLabel] = useState("");
  const [slideBadgeBg, setSlideBadgeBg] = useState("#f59e0b");
  const [slideBadgeText, setSlideBadgeText] = useState("#ffffff");
  const [slideEditBadgeSelect, setSlideEditBadgeSelect] = useState("");
  const [slideEditBadgeNewLabel, setSlideEditBadgeNewLabel] = useState("");
  const [slideEditBadgeBg, setSlideEditBadgeBg] = useState("#f59e0b");
  const [slideEditBadgeText, setSlideEditBadgeText] = useState("#ffffff");
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [programForm, setProgramForm] = useState({
    name: "",
    slug: "",
    genre_type: "program",
    description: "",
    started_year: "",
    slide_badge_label: "",
    slide_badge_bg: "#f59e0b",
    slide_badge_text: "#ffffff",
    video_badge_label: "",
    video_badge_bg: "#f59e0b",
    video_badge_text: "#ffffff",
    show_on_front: true,
    show_in_sidebar: true,
  });
  const [savingProgram, setSavingProgram] = useState(false);

  const [genreTypes, setGenreTypes] = useState<GenreTypeRow[]>([]);
  const [editingGenreType, setEditingGenreType] = useState<GenreTypeRow | null>(null);
  const [creatingGenreType, setCreatingGenreType] = useState(false);
  const [genreTypeForm, setGenreTypeForm] = useState({ id: "", name: "", sort_order: 0 });
  const [savingGenreType, setSavingGenreType] = useState(false);

  const [inviteCodes, setInviteCodes] = useState<Array<{
    id: string;
    code: string;
    name: string | null;
    description: string | null;
    max_uses: number;
    used_count: number;
    default_expires_at: string | null;
    slide_ids: string[];
    video_ids: string[];
  }>>([]);
  const [loadingInviteCodes, setLoadingInviteCodes] = useState(false);
  const [creatingInviteCode, setCreatingInviteCode] = useState(false);
  const [inviteCodeForm, setInviteCodeForm] = useState({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [] as string[], video_ids: [] as string[] });
  const [editingInviteCode, setEditingInviteCode] = useState<typeof inviteCodes[0] | null>(null);
  const [inviteCodeEditForm, setInviteCodeEditForm] = useState({ name: "", description: "", default_expires_at: "", slide_ids: [] as string[], video_ids: [] as string[] });
  const [savingInviteCode, setSavingInviteCode] = useState(false);
  const [applyingExpiryId, setApplyingExpiryId] = useState<string | null>(null);
  const [grantRoleEmail, setGrantRoleEmail] = useState("");
  const [grantRoleLoading, setGrantRoleLoading] = useState(false);
  const [grantRoleMessage, setGrantRoleMessage] = useState<string | null>(null);
  const [roleMembers, setRoleMembers] = useState<Array<{
    user_id: string;
    email: string;
    is_admin: boolean;
    is_core_staff: boolean;
  }>>([]);
  const [loadingRoleMembers, setLoadingRoleMembers] = useState(false);

  const [siteSettingsSubtitle, setSiteSettingsSubtitle] = useState("");
  const [siteSettingsFooterText, setSiteSettingsFooterText] = useState("");
  const [heroMode, setHeroMode] = useState<"random" | "selected">("random");
  const [heroSlideCount, setHeroSlideCount] = useState(5);
  const [heroSlideIds, setHeroSlideIds] = useState<string[]>([]);
  const [savingSiteSettings, setSavingSiteSettings] = useState(false);

  const [inquiries, setInquiries] = useState<Array<{
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    subject: string;
    body: string;
    created_at: string;
    read_at: string | null;
  }>>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<typeof inquiries[0] | null>(null);
  const [replyForm, setReplyForm] = useState({ subject: "", body: "" });
  const [sendingReply, setSendingReply] = useState(false);

  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    title: string;
    body: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    published_at: string;
    show_on_home?: boolean;
    home_sort_order?: number;
  }>>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    body: "",
    is_published: true,
    show_on_home: false,
    home_sort_order: 0,
  });
  const [editingAnnouncement, setEditingAnnouncement] = useState<typeof announcements[0] | null>(null);
  const [announcementEditForm, setAnnouncementEditForm] = useState({
    title: "",
    body: "",
    is_published: true,
    show_on_home: false,
    home_sort_order: 0,
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementBodyTab, setAnnouncementBodyTab] = useState<"edit" | "preview">("edit");
  const [announcementEditBodyTab, setAnnouncementEditBodyTab] = useState<"edit" | "preview">("edit");
  const [videos, setVideos] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    keyword_tags: string[];
    youtube_url: string | null;
    youtube_video_id: string | null;
    external_watch_url?: string | null;
    program_id: number;
    visibility: SlideVisibility;
    content_tier: ContentTier;
    is_published: boolean;
    slide_ids: number[];
    created_at: string;
    thumbnail_url?: string | null;
  }>>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoThumbUploading, setVideoThumbUploading] = useState(false);
  const [pendingVideoThumbnailFile, setPendingVideoThumbnailFile] = useState<File | null>(null);
  const [videoForm, setVideoForm] = useState({
    title: "",
    description: "",
    youtube_url: "",
    external_watch_url: "",
    thumbnail_url: "",
    program_id: "",
    visibility: "free" as SlideVisibility,
    content_tier: "basic" as ContentTier,
    is_published: true,
  });
  const [videoKeywordTags, setVideoKeywordTags] = useState<string[]>([]);
  const [videoBadgeSelect, setVideoBadgeSelect] = useState("");
  const [videoBadgeNewLabel, setVideoBadgeNewLabel] = useState("");
  const [videoBadgeBg, setVideoBadgeBg] = useState("#f59e0b");
  const [videoBadgeText, setVideoBadgeText] = useState("#ffffff");
  const [editingVideo, setEditingVideo] = useState<(typeof videos)[0] | null>(null);
  const [videoEditForm, setVideoEditForm] = useState({
    title: "",
    description: "",
    youtube_url: "",
    external_watch_url: "",
    thumbnail_url: "",
    program_id: "",
    visibility: "free" as SlideVisibility,
    content_tier: "basic" as ContentTier,
    is_published: true,
  });
  const [videoEditKeywordTags, setVideoEditKeywordTags] = useState<string[]>([]);
  const [videoEditSlideIds, setVideoEditSlideIds] = useState<number[]>([]);
  const [videoEditBadgeSelect, setVideoEditBadgeSelect] = useState("");
  const [videoEditBadgeNewLabel, setVideoEditBadgeNewLabel] = useState("");
  const [videoEditBadgeBg, setVideoEditBadgeBg] = useState("#f59e0b");
  const [videoEditBadgeText, setVideoEditBadgeText] = useState("#ffffff");
  const [videoSlideIds, setVideoSlideIds] = useState<number[]>([]);
  const [creatingQuickProgram, setCreatingQuickProgram] = useState(false);
  const [savingQuickProgram, setSavingQuickProgram] = useState(false);
  const [quickProgramName, setQuickProgramName] = useState("");
  const [quickProgramSlug, setQuickProgramSlug] = useState("");
  const [selectedPdfName, setSelectedPdfName] = useState("");
  const [isPdfDragOver, setIsPdfDragOver] = useState(false);
  const [shelves, setShelves] = useState<Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    sort_order: number;
    is_published: boolean;
    items: Array<{
      id: string;
      shelf_id: string;
      content_type: "slide" | "video";
      content_id: string;
      sort_order: number;
    }>;
  }>>([]);
  const [loadingShelves, setLoadingShelves] = useState(false);
  const [creatingShelf, setCreatingShelf] = useState(false);
  const [savingShelf, setSavingShelf] = useState(false);
  const [editingShelf, setEditingShelf] = useState<(typeof shelves)[0] | null>(null);
  const [shelfForm, setShelfForm] = useState({
    title: "",
    slug: "",
    description: "",
    sort_order: 0,
    is_published: true,
  });
  const [shelfSlideIds, setShelfSlideIds] = useState<string[]>([]);
  const [shelfVideoIds, setShelfVideoIds] = useState<string[]>([]);
  const [frontShelfOrder, setFrontShelfOrder] = useState<Array<{
    id: string;
    shelf_type: "program_shelf" | "video_program_shelf" | "curated_shelf";
    ref_id: string;
    sort_order: number;
    is_enabled: boolean;
    label: string;
  }>>([]);
  const [loadingFrontShelfOrder, setLoadingFrontShelfOrder] = useState(false);
  const [savingFrontShelfOrder, setSavingFrontShelfOrder] = useState(false);
  const [draggingFrontShelfId, setDraggingFrontShelfId] = useState<string | null>(null);
  const [dragOverFrontShelfId, setDragOverFrontShelfId] = useState<string | null>(null);

  const adminView: "operations" | "slides" | "videos" | "settings" | "master" =
    pathname === "/admin/slides"
      ? "slides"
      : pathname === "/admin/videos"
        ? "videos"
        : pathname === "/admin/settings"
          ? "settings"
          : pathname === "/admin/master"
            ? "master"
            : "operations";

  useEffect(() => {
    loadSlides();
    loadPrograms();
    loadGenreTypes();
    loadInviteCodes();
    loadSiteSettings();
    loadInquiries();
    loadAnnouncements();
    loadVideos();
    loadShelves();
    loadFrontShelfOrder();
    loadRoleMembers();
  }, []);

  async function loadSiteSettings() {
    try {
      const res = await fetch("/api/admin/site-settings");
      if (!res.ok) return;
      const data = await res.json();
      setSiteSettingsSubtitle(data.subtitle ?? "");
      setSiteSettingsFooterText(data.footer_text ?? "");
      setHeroMode(data.hero_mode === "selected" ? "selected" : "random");
      setHeroSlideCount(typeof data.hero_slide_count === "number" ? data.hero_slide_count : 5);
      setHeroSlideIds(Array.isArray(data.hero_slide_ids) ? data.hero_slide_ids : []);
    } catch {
      console.error("サイト設定読み込み失敗");
    }
  }

  function getCreatePdfInput(): HTMLInputElement | null {
    const form = document.getElementById("create-slide-form") as HTMLFormElement | null;
    return (form?.pdf as HTMLInputElement | undefined) ?? null;
  }

  function applyPdfFileToCreateForm(file: File) {
    if (file.type !== "application/pdf") {
      alert("PDFファイルのみ選択できます");
      return;
    }
    const input = getCreatePdfInput();
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    setSelectedPdfName(file.name);
  }

  function handlePdfDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsPdfDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    applyPdfFileToCreateForm(file);
  }

  function handlePdfPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const file = e.clipboardData.files?.[0];
    if (!file) return;
    e.preventDefault();
    applyPdfFileToCreateForm(file);
  }

  async function handleSaveSiteSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSiteSettings(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtitle: siteSettingsSubtitle,
          footer_text: siteSettingsFooterText,
          hero_mode: heroMode,
          hero_slide_count: heroSlideCount,
          hero_slide_ids: heroSlideIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "保存に失敗しました");
        return;
      }
      alert("サイト設定を保存しました");
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingSiteSettings(false);
    }
  }

  async function loadInquiries() {
    setLoadingInquiries(true);
    try {
      const res = await fetch("/api/admin/inquiries");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setInquiries(data);
    } catch {
      console.error("お問い合わせ一覧読み込み失敗");
    } finally {
      setLoadingInquiries(false);
    }
  }

  async function loadAnnouncements() {
    setLoadingAnnouncements(true);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setAnnouncements(data);
    } catch {
      console.error("お知らせ一覧読み込み失敗");
    } finally {
      setLoadingAnnouncements(false);
    }
  }

  async function loadVideos() {
    setLoadingVideos(true);
    try {
      const res = await fetch("/api/admin/videos");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setVideos(data);
      }
    } catch {
      console.error("動画一覧読み込み失敗");
    } finally {
      setLoadingVideos(false);
    }
  }

  async function loadShelves() {
    setLoadingShelves(true);
    try {
      const res = await fetch("/api/admin/shelves");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setShelves(data);
      }
    } catch {
      console.error("棚一覧読み込み失敗");
    } finally {
      setLoadingShelves(false);
    }
  }

  async function loadFrontShelfOrder() {
    setLoadingFrontShelfOrder(true);
    try {
      const res = await fetch("/api/admin/front-shelf-order");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setFrontShelfOrder(data);
      }
    } catch {
      console.error("フロント棚順序の読み込み失敗");
    } finally {
      setLoadingFrontShelfOrder(false);
    }
  }

  function reorderFrontShelfRows(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setFrontShelfOrder((prev) => {
      const from = prev.findIndex((r) => r.id === draggedId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const list = [...prev];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list.map((row, i) => ({ ...row, sort_order: i }));
    });
  }

  async function saveFrontShelfOrder() {
    setSavingFrontShelfOrder(true);
    try {
      const payload = frontShelfOrder.map((row, idx) => ({
        id: row.id,
        sort_order: idx,
        is_enabled: row.is_enabled,
      }));
      const res = await fetch("/api/admin/front-shelf-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`保存失敗: ${json.error ?? "エラー"}`);
        return;
      }
      alert("トップ棚の順序を保存しました");
      loadFrontShelfOrder();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingFrontShelfOrder(false);
    }
  }

  async function handleCreateShelf(e: React.FormEvent) {
    e.preventDefault();
    if (!shelfForm.title.trim()) {
      alert("棚タイトルを入力してください");
      return;
    }
    setSavingShelf(true);
    try {
      const items = [
        ...shelfSlideIds.map((id, index) => ({ content_type: "slide" as const, content_id: id, sort_order: index })),
        ...shelfVideoIds.map((id, index) => ({ content_type: "video" as const, content_id: id, sort_order: shelfSlideIds.length + index })),
      ];
      const res = await fetch("/api/admin/shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shelfForm,
          items,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`棚作成失敗: ${json.error ?? "エラー"}`);
        return;
      }
      setCreatingShelf(false);
      setShelfForm({ title: "", slug: "", description: "", sort_order: 0, is_published: true });
      setShelfSlideIds([]);
      setShelfVideoIds([]);
      loadShelves();
      loadFrontShelfOrder();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingShelf(false);
    }
  }

  async function handleUpdateShelf(e: React.FormEvent) {
    e.preventDefault();
    if (!editingShelf) return;
    if (!shelfForm.title.trim()) {
      alert("棚タイトルを入力してください");
      return;
    }
    setSavingShelf(true);
    try {
      const items = [
        ...shelfSlideIds.map((id, index) => ({ content_type: "slide" as const, content_id: id, sort_order: index })),
        ...shelfVideoIds.map((id, index) => ({ content_type: "video" as const, content_id: id, sort_order: shelfSlideIds.length + index })),
      ];
      const res = await fetch(`/api/admin/shelves/${encodeURIComponent(editingShelf.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shelfForm,
          items,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`棚更新失敗: ${json.error ?? "エラー"}`);
        return;
      }
      setEditingShelf(null);
      setShelfForm({ title: "", slug: "", description: "", sort_order: 0, is_published: true });
      setShelfSlideIds([]);
      setShelfVideoIds([]);
      loadShelves();
      loadFrontShelfOrder();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingShelf(false);
    }
  }

  async function handleDeleteShelf(shelfId: string) {
    if (!confirm("この棚を削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/shelves/${encodeURIComponent(shelfId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`削除失敗: ${json.error ?? "エラー"}`);
        return;
      }
      loadShelves();
      loadFrontShelfOrder();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function uploadVideoThumbnailFile(videoId: string, file: File) {
    setVideoThumbUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(videoId)}/thumbnail`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error ?? "サムネイルのアップロードに失敗しました");
        return;
      }
      await loadVideos();
      const url = typeof json.thumbnail_url === "string" ? json.thumbnail_url : "";
      if (url) {
        setEditingVideo((v) => (v && v.id === videoId ? { ...v, thumbnail_url: url } : v));
        setVideoEditForm((f) => ({ ...f, thumbnail_url: url }));
      }
    } finally {
      setVideoThumbUploading(false);
    }
  }

  async function handleCreateVideo(e: React.FormEvent) {
    e.preventDefault();
    const ytIn = videoForm.youtube_url.trim();
    const extIn = videoForm.external_watch_url.trim();
    const ytId = ytIn ? extractYoutubeVideoId(ytIn) : null;
    if (!videoForm.title.trim() || !videoForm.program_id) {
      alert("タイトル・シリーズは必須です");
      return;
    }
    if (ytIn && !ytId) {
      alert("YouTube の動画URLの形式が不正です");
      return;
    }
    if (extIn && !isValidHttpUrl(extIn)) {
      alert("外部視聴URLは http(s) で始まる必要があります");
      return;
    }
    if (!ytId && !isValidHttpUrl(extIn)) {
      alert("YouTube の動画URL または 外部視聴URL のどちらかを入力してください");
      return;
    }
    setSavingVideo(true);
    try {
      const manualThumb = videoForm.thumbnail_url.trim();
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoForm.title.trim(),
          description: videoForm.description.trim() || null,
          keyword_tags: videoKeywordTags,
          youtube_url: ytIn,
          external_watch_url: extIn,
          ...(manualThumb ? { thumbnail_url: manualThumb } : {}),
          program_id: Number(videoForm.program_id),
          visibility: videoForm.visibility,
          content_tier: videoForm.content_tier,
          is_published: videoForm.is_published,
          slide_ids: videoSlideIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`動画作成失敗: ${json.error ?? "エラー"}`);
        return;
      }
      const newId = typeof json.id === "string" ? json.id : null;
      if (newId && pendingVideoThumbnailFile) {
        await uploadVideoThumbnailFile(newId, pendingVideoThumbnailFile);
        setPendingVideoThumbnailFile(null);
      }
      const selectedVideoBadgeLabel =
        videoBadgeSelect === "__new__" ? videoBadgeNewLabel.trim() : videoBadgeSelect.trim();
      if (videoForm.program_id) {
        await applyProgramBadge(videoForm.program_id, "video", selectedVideoBadgeLabel, videoBadgeBg, videoBadgeText);
      }
      alert("動画を作成しました");
      setCreatingVideo(false);
      setVideoForm({
        title: "",
        description: "",
        youtube_url: "",
        external_watch_url: "",
        thumbnail_url: "",
        program_id: "",
        visibility: "free",
        content_tier: "basic",
        is_published: true,
      });
      setVideoKeywordTags([]);
      setVideoBadgeSelect("");
      setVideoBadgeNewLabel("");
      setVideoBadgeBg("#f59e0b");
      setVideoBadgeText("#ffffff");
      setVideoSlideIds([]);
      loadVideos();
      loadPrograms();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingVideo(false);
    }
  }

  async function handleCreateQuickProgram(e: React.FormEvent) {
    e.preventDefault();
    const name = quickProgramName.trim();
    if (!name) {
      alert("シリーズ名を入力してください");
      return;
    }
    const slug = quickProgramSlug.trim() || slugFromName(name);
    setSavingQuickProgram(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .insert({
          name,
          slug,
          genre_type: genreTypes[0]?.id ?? "program",
          description: null,
          started_year: null,
          shelf_badge_label: null,
          slide_badge_label: null,
          slide_badge_bg: null,
          slide_badge_text: null,
          video_badge_label: null,
          video_badge_bg: null,
          video_badge_text: null,
          show_on_front: true,
          show_in_sidebar: true,
        })
        .select("id, name")
        .single();
      if (error) throw error;
      await loadPrograms();
      if (data?.id != null) {
        handleProgramChangedForVideo(String(data.id));
      }
      setCreatingQuickProgram(false);
      setQuickProgramName("");
      setQuickProgramSlug("");
    } catch (err) {
      alert(`シリーズ追加失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingQuickProgram(false);
    }
  }

  async function handleDeleteVideo(videoId: string) {
    if (!confirm("この動画を削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`削除失敗: ${json.error ?? "エラー"}`);
        return;
      }
      loadVideos();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleStartEditVideo(video: (typeof videos)[0]) {
    setCreatingVideo(false);
    setEditingVideo(video);
    setVideoEditForm({
      title: video.title ?? "",
      description: video.description ?? "",
      youtube_url: video.youtube_url ?? "",
      external_watch_url: video.external_watch_url?.trim() ?? "",
      thumbnail_url: video.thumbnail_url?.trim() ?? "",
      program_id: String(video.program_id ?? ""),
      visibility: (video.visibility ?? "free") as SlideVisibility,
      content_tier: (video.content_tier ?? "basic") as ContentTier,
      is_published: video.is_published !== false,
    });
    setVideoEditKeywordTags(Array.isArray(video.keyword_tags) ? video.keyword_tags : []);
    setVideoEditSlideIds((video.slide_ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id)));
    const p = programs.find((row) => String(row.id) === String(video.program_id));
    const label = p?.video_badge_label?.trim() ?? "";
    const inOptions = !!label && videoBadgeOptions.includes(label);
    setVideoEditBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setVideoEditBadgeNewLabel(inOptions ? "" : label);
    setVideoEditBadgeBg(p?.video_badge_bg ?? "#f59e0b");
    setVideoEditBadgeText(p?.video_badge_text ?? "#ffffff");
  }

  async function handleUpdateVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVideo) return;
    const ytIn = videoEditForm.youtube_url.trim();
    const extIn = videoEditForm.external_watch_url.trim();
    const ytId = ytIn ? extractYoutubeVideoId(ytIn) : null;
    if (!videoEditForm.title.trim() || !videoEditForm.program_id) {
      alert("タイトル・シリーズは必須です");
      return;
    }
    if (ytIn && !ytId) {
      alert("YouTube の動画URLの形式が不正です");
      return;
    }
    if (extIn && !isValidHttpUrl(extIn)) {
      alert("外部視聴URLは http(s) で始まる必要があります");
      return;
    }
    if (!ytId && !isValidHttpUrl(extIn)) {
      alert("YouTube の動画URL または 外部視聴URL のどちらかを入力してください");
      return;
    }
    setSavingVideo(true);
    try {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(editingVideo.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoEditForm.title.trim(),
          description: videoEditForm.description.trim() || null,
          keyword_tags: videoEditKeywordTags,
          youtube_url: ytIn,
          external_watch_url: extIn,
          ...(videoEditForm.thumbnail_url.trim()
            ? { thumbnail_url: videoEditForm.thumbnail_url.trim() }
            : {}),
          program_id: Number(videoEditForm.program_id),
          visibility: videoEditForm.visibility,
          content_tier: videoEditForm.content_tier,
          is_published: videoEditForm.is_published,
          slide_ids: videoEditSlideIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`動画更新失敗: ${json.error ?? "エラー"}`);
        return;
      }
      const selectedVideoBadgeLabel =
        videoEditBadgeSelect === "__new__" ? videoEditBadgeNewLabel.trim() : videoEditBadgeSelect.trim();
      if (videoEditForm.program_id) {
        await applyProgramBadge(videoEditForm.program_id, "video", selectedVideoBadgeLabel, videoEditBadgeBg, videoEditBadgeText);
      }
      setEditingVideo(null);
      await loadPrograms();
      await loadVideos();
      alert("動画を更新しました");
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingVideo(false);
    }
  }

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      alert("タイトルと本文を入力してください");
      return;
    }
    setSavingAnnouncement(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementForm.title.trim(),
          body: announcementForm.body.trim(),
          is_published: announcementForm.is_published,
          show_on_home: announcementForm.show_on_home,
          home_sort_order: announcementForm.home_sort_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "作成に失敗しました");
        return;
      }
      setAnnouncements((prev) => [data, ...prev]);
      setCreatingAnnouncement(false);
      setAnnouncementForm({
        title: "",
        body: "",
        is_published: true,
        show_on_home: false,
        home_sort_order: 0,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "お知らせの作成に失敗しました");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleUpdateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAnnouncement) return;
    if (!announcementEditForm.title.trim() || !announcementEditForm.body.trim()) {
      alert("タイトルと本文を入力してください");
      return;
    }
    setSavingAnnouncement(true);
    try {
      const res = await fetch(`/api/admin/announcements/${encodeURIComponent(editingAnnouncement.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementEditForm.title.trim(),
          body: announcementEditForm.body.trim(),
          is_published: announcementEditForm.is_published,
          show_on_home: announcementEditForm.show_on_home,
          home_sort_order: announcementEditForm.home_sort_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "更新に失敗しました");
        return;
      }
      setAnnouncements((prev) => prev.map((a) => (a.id === editingAnnouncement.id ? data : a)));
      setEditingAnnouncement(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "お知らせの更新に失敗しました");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm("このお知らせを削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "削除に失敗しました");
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      if (editingAnnouncement?.id === id) setEditingAnnouncement(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "お知らせの削除に失敗しました");
    }
  }

  async function patchAnnouncementFields(
    id: string,
    updates: { show_on_home?: boolean; home_sort_order?: number }
  ) {
    try {
      const res = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "更新に失敗しました");
        return;
      }
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    }
  }

  async function openInquiryDetail(inq: typeof inquiries[0]) {
    setSelectedInquiry(inq);
    setReplyForm({
      subject: inq.subject.startsWith("Re:") ? inq.subject : `Re: ${inq.subject}`,
      body: "",
    });
    if (!inq.read_at) {
      try {
        await fetch(`/api/admin/inquiries/${encodeURIComponent(inq.id)}`, { method: "PATCH" });
        setInquiries((prev) => prev.map((i) => (i.id === inq.id ? { ...i, read_at: new Date().toISOString() } : i)));
      } catch {
        // 既読更新失敗は無視
      }
    }
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInquiry) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(selectedInquiry.id)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: replyForm.subject, body: replyForm.body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "返信の送信に失敗しました");
        return;
      }
      alert("返信を送信しました");
      setSelectedInquiry(null);
      loadInquiries();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSendingReply(false);
    }
  }

  async function loadGenreTypes() {
    try {
      const res = await fetch("/api/genre-types");
      const data = await res.json();
      if (Array.isArray(data)) setGenreTypes(data);
    } catch {
      console.error("ジャンル種別読み込み失敗");
    }
  }

  async function handleCreateGenreType(e: React.FormEvent) {
    e.preventDefault();
    setSavingGenreType(true);
    try {
      const res = await fetch("/api/admin/genre-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genreTypeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "追加に失敗しました");
      await loadGenreTypes();
      setCreatingGenreType(false);
      setGenreTypeForm({ id: "", name: "", sort_order: genreTypes.length });
    } catch (err) {
      alert(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSavingGenreType(false);
    }
  }

  async function handleUpdateGenreType(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGenreType) return;
    setSavingGenreType(true);
    try {
      const res = await fetch(`/api/admin/genre-types/${encodeURIComponent(editingGenreType.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: genreTypeForm.name, sort_order: genreTypeForm.sort_order }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新に失敗しました");
      await loadGenreTypes();
      setEditingGenreType(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingGenreType(false);
    }
  }

  async function handleDeleteGenreType(gt: GenreTypeRow) {
    if (!confirm(`「${gt.name}」を削除しますか？使用中のプログラムがあると削除できません。`)) return;
    setSavingGenreType(true);
    try {
      const res = await fetch(`/api/admin/genre-types/${encodeURIComponent(gt.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "削除に失敗しました");
      await loadGenreTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setSavingGenreType(false);
    }
  }

  async function loadInviteCodes() {
    setLoadingInviteCodes(true);
    try {
      const res = await fetch("/api/admin/invite-codes");
      const data = await res.json();
      if (res.ok) setInviteCodes(data);
    } catch {
      console.error("招待コード読み込み失敗");
    } finally {
      setLoadingInviteCodes(false);
    }
  }

  async function loadPrograms() {
    const { data } = await supabase
      .from("programs")
      .select("id, name, slug, description, started_year, shelf_badge_label, slide_badge_label, slide_badge_bg, slide_badge_text, video_badge_label, video_badge_bg, video_badge_text, genre_type, show_on_front, show_in_sidebar")
      .order("started_year", { ascending: true, nullsFirst: false });
    setPrograms((data ?? []) as Program[]);
  }

  function slugFromName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "program";
  }

  const slideBadgeOptions = Array.from(
    new Set(
      programs
        .map((p) => p.slide_badge_label?.trim() ?? "")
        .filter((v) => v.length > 0)
    )
  );
  const videoBadgeOptions = Array.from(
    new Set(
      programs
        .map((p) => p.video_badge_label?.trim() ?? "")
        .filter((v) => v.length > 0)
    )
  );

  function handleProgramChangedForSlide(programId: string) {
    setCreateForm((f) => ({ ...f, program_id: programId }));
    const p = programs.find((row) => String(row.id) === String(programId));
    const label = p?.slide_badge_label?.trim() ?? "";
    const inOptions = !!label && slideBadgeOptions.includes(label);
    setSlideBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setSlideBadgeNewLabel(inOptions ? "" : label);
    setSlideBadgeBg(p?.slide_badge_bg ?? "#f59e0b");
    setSlideBadgeText(p?.slide_badge_text ?? "#ffffff");
  }

  function handleProgramChangedForVideo(programId: string) {
    setVideoForm((f) => ({ ...f, program_id: programId }));
    const p = programs.find((row) => String(row.id) === String(programId));
    const label = p?.video_badge_label?.trim() ?? "";
    const inOptions = !!label && videoBadgeOptions.includes(label);
    setVideoBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setVideoBadgeNewLabel(inOptions ? "" : label);
    setVideoBadgeBg(p?.video_badge_bg ?? "#f59e0b");
    setVideoBadgeText(p?.video_badge_text ?? "#ffffff");
  }

  function handleProgramChangedForSlideEdit(programId: string) {
    setEditForm((f) => ({ ...f, program_id: programId }));
    const p = programs.find((row) => String(row.id) === String(programId));
    const label = p?.slide_badge_label?.trim() ?? "";
    const inOptions = !!label && slideBadgeOptions.includes(label);
    setSlideEditBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setSlideEditBadgeNewLabel(inOptions ? "" : label);
    setSlideEditBadgeBg(p?.slide_badge_bg ?? "#f59e0b");
    setSlideEditBadgeText(p?.slide_badge_text ?? "#ffffff");
  }

  function handleProgramChangedForVideoEdit(programId: string) {
    setVideoEditForm((f) => ({ ...f, program_id: programId }));
    const p = programs.find((row) => String(row.id) === String(programId));
    const label = p?.video_badge_label?.trim() ?? "";
    const inOptions = !!label && videoBadgeOptions.includes(label);
    setVideoEditBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setVideoEditBadgeNewLabel(inOptions ? "" : label);
    setVideoEditBadgeBg(p?.video_badge_bg ?? "#f59e0b");
    setVideoEditBadgeText(p?.video_badge_text ?? "#ffffff");
  }

  async function applyProgramBadge(
    programId: string,
    kind: "slide" | "video",
    label: string,
    bg: string,
    text: string
  ) {
    const payload =
      kind === "slide"
        ? {
            slide_badge_label: label || null,
            slide_badge_bg: label ? bg : null,
            slide_badge_text: label ? text : null,
          }
        : {
            video_badge_label: label || null,
            video_badge_bg: label ? bg : null,
            video_badge_text: label ? text : null,
          };
    const { error } = await supabase.from("programs").update(payload).eq("id", programId);
    if (error) throw error;
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    const slug = programForm.slug.trim() || slugFromName(programForm.name);
    const name = programForm.name.trim();
    if (!name) {
      alert("プログラム名を入力してください");
      return;
    }
    setSavingProgram(true);
    try {
      const { error } = await supabase.from("programs").insert({
        name,
        slug,
        genre_type: programForm.genre_type,
        description: programForm.description.trim() || null,
        started_year: programForm.started_year ? parseInt(programForm.started_year, 10) : null,
        slide_badge_label: programForm.slide_badge_label.trim() || null,
        slide_badge_bg: programForm.slide_badge_label.trim() ? programForm.slide_badge_bg : null,
        slide_badge_text: programForm.slide_badge_label.trim() ? programForm.slide_badge_text : null,
        video_badge_label: programForm.video_badge_label.trim() || null,
        video_badge_bg: programForm.video_badge_label.trim() ? programForm.video_badge_bg : null,
        video_badge_text: programForm.video_badge_label.trim() ? programForm.video_badge_text : null,
        show_on_front: programForm.show_on_front,
        show_in_sidebar: programForm.show_in_sidebar,
      });
      if (error) throw error;
      setCreatingProgram(false);
      setProgramForm({
        name: "",
        slug: "",
        genre_type: genreTypes[0]?.id ?? "program",
        description: "",
        started_year: "",
        slide_badge_label: "",
        slide_badge_bg: "#f59e0b",
        slide_badge_text: "#ffffff",
        video_badge_label: "",
        video_badge_bg: "#f59e0b",
        video_badge_text: "#ffffff",
        show_on_front: true,
        show_in_sidebar: true,
      });
      loadPrograms();
    } catch (err) {
      alert(`登録失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingProgram(false);
    }
  }

  async function handleCreateInviteCode(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCodeForm.code.trim()) {
      alert("コードを入力してください");
      return;
    }
    setSavingInviteCode(true);
    try {
      const defaultExpiresAt = inviteCodeForm.default_expires_at.trim()
        ? `${inviteCodeForm.default_expires_at.trim()}T23:59:59.000Z`
        : null;
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteCodeForm.code.trim().toLowerCase().replace(/\s+/g, "-"),
          name: inviteCodeForm.name.trim() || null,
          description: inviteCodeForm.description.trim() || null,
          default_expires_at: defaultExpiresAt,
          slide_ids: inviteCodeForm.slide_ids,
          video_ids: inviteCodeForm.video_ids,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "作成失敗");
      setCreatingInviteCode(false);
      setInviteCodeForm({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [], video_ids: [] });
      loadInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "招待コードの作成に失敗しました");
    } finally {
      setSavingInviteCode(false);
    }
  }

  async function handleUpdateInviteCode(e: React.FormEvent) {
    e.preventDefault();
    if (!editingInviteCode) return;
    setSavingInviteCode(true);
    try {
      const defaultExpiresAt = inviteCodeEditForm.default_expires_at.trim()
        ? `${inviteCodeEditForm.default_expires_at.trim()}T23:59:59.000Z`
        : null;
      const res = await fetch(`/api/admin/invite-codes/${editingInviteCode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteCodeEditForm.name.trim() || null,
          description: inviteCodeEditForm.description.trim() || null,
          default_expires_at: defaultExpiresAt,
          slide_ids: inviteCodeEditForm.slide_ids,
          video_ids: inviteCodeEditForm.video_ids,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "更新失敗");
      setEditingInviteCode(null);
      loadInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "招待コードの更新に失敗しました");
    } finally {
      setSavingInviteCode(false);
    }
  }

  async function handleDeleteInviteCode(id: string) {
    if (!confirm("この招待コードを削除しますか？紐づくスライド・動画の設定も消えます。")) return;
    try {
      const res = await fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "削除失敗");
      loadInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "招待コードの削除に失敗しました");
    }
  }

  async function handleApplyExpiry(inviteCodeId: string) {
    if (!confirm("この招待コードの「既定の有効期限」を、既に登録済みの全ユーザーに一括適用しますか？")) return;
    setApplyingExpiryId(inviteCodeId);
    try {
      const res = await fetch(`/api/admin/invite-codes/${inviteCodeId}/apply-expiry`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "一括適用に失敗しました");
      alert(json.message ?? "一括適用しました");
      loadInviteCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "一括適用に失敗しました");
    } finally {
      setApplyingExpiryId(null);
    }
  }

  async function handleGrantRole(role: "admin" | "core_staff") {
    const email = grantRoleEmail.trim();
    if (!email) {
      setGrantRoleMessage("メールアドレスを入力してください");
      return;
    }
    setGrantRoleLoading(true);
    setGrantRoleMessage(null);
    try {
      const res = await fetch("/api/admin/users/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, action: "grant" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "権限付与に失敗しました");
      setGrantRoleMessage(json.message || "権限を付与しました");
      setGrantRoleEmail("");
      await loadRoleMembers();
    } catch (err) {
      setGrantRoleMessage(err instanceof Error ? err.message : "権限付与に失敗しました");
    } finally {
      setGrantRoleLoading(false);
    }
  }

  async function handleRevokeRole(role: "admin" | "core_staff") {
    const email = grantRoleEmail.trim();
    if (!email) {
      setGrantRoleMessage("メールアドレスを入力してください");
      return;
    }
    setGrantRoleLoading(true);
    setGrantRoleMessage(null);
    try {
      const res = await fetch("/api/admin/users/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, action: "revoke" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "権限解除に失敗しました");
      setGrantRoleMessage(json.message || "権限を解除しました");
      setGrantRoleEmail("");
      await loadRoleMembers();
    } catch (err) {
      setGrantRoleMessage(err instanceof Error ? err.message : "権限解除に失敗しました");
    } finally {
      setGrantRoleLoading(false);
    }
  }

  async function loadRoleMembers() {
    setLoadingRoleMembers(true);
    try {
      const res = await fetch("/api/admin/users/grant-role");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "権限メンバーの取得に失敗しました");
      setRoleMembers(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setRoleMembers([]);
    } finally {
      setLoadingRoleMembers(false);
    }
  }

  async function handleUpdateProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProgram) return;
    const slug = programForm.slug.trim() || slugFromName(programForm.name);
    const name = programForm.name.trim();
    if (!name) {
      alert("プログラム名を入力してください");
      return;
    }
    setSavingProgram(true);
    try {
      const { error } = await supabase
        .from("programs")
        .update({
          name,
          slug,
          genre_type: programForm.genre_type,
          description: programForm.description.trim() || null,
          started_year: programForm.started_year ? parseInt(programForm.started_year, 10) : null,
          slide_badge_label: programForm.slide_badge_label.trim() || null,
          slide_badge_bg: programForm.slide_badge_label.trim() ? programForm.slide_badge_bg : null,
          slide_badge_text: programForm.slide_badge_label.trim() ? programForm.slide_badge_text : null,
          video_badge_label: programForm.video_badge_label.trim() || null,
          video_badge_bg: programForm.video_badge_label.trim() ? programForm.video_badge_bg : null,
          video_badge_text: programForm.video_badge_label.trim() ? programForm.video_badge_text : null,
          show_on_front: programForm.show_on_front,
          show_in_sidebar: programForm.show_in_sidebar,
        })
        .eq("id", editingProgram.id);
      if (error) throw error;
      setEditingProgram(null);
      setProgramForm({
        name: "",
        slug: "",
        genre_type: genreTypes[0]?.id ?? "program",
        description: "",
        started_year: "",
        slide_badge_label: "",
        slide_badge_bg: "#f59e0b",
        slide_badge_text: "#ffffff",
        video_badge_label: "",
        video_badge_bg: "#f59e0b",
        video_badge_text: "#ffffff",
        show_on_front: true,
        show_in_sidebar: true,
      });
      loadPrograms();
    } catch (err) {
      alert(`更新失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingProgram(false);
    }
  }

  async function loadSlides() {
    const { data, error } = await supabase
      .from("slides")
      .select("id, title, program_id, pdf_url, page_count, page_image_urls, image_url, year, keyword_tags, caption, visibility, content_tier")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setSlides(data ?? []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.pdf as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      alert("PDFファイルを選択してください");
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("title", createForm.title);
      formData.append("program_id", createForm.program_id);
      if (createForm.year) formData.append("year", createForm.year);
      if (keywordTags.length > 0) formData.append("keyword_tags", keywordTags.join(", "));
      if (createForm.caption) formData.append("caption", createForm.caption);
      formData.append("visibility", createForm.visibility);
      formData.append("content_tier", createForm.content_tier);
      formData.append("thumbnail_page", createForm.thumbnail_page.trim() || "1");

      const res = await fetch("/api/slides/create", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        alert(`作成失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }

      const selectedSlideBadgeLabel =
        slideBadgeSelect === "__new__" ? slideBadgeNewLabel.trim() : slideBadgeSelect.trim();
      if (createForm.program_id) {
        await applyProgramBadge(createForm.program_id, "slide", selectedSlideBadgeLabel, slideBadgeBg, slideBadgeText);
      }

      alert(`作成完了: ${json.pageCount}ページ`);
      setCreateForm({ title: "", program_id: "", year: "", caption: "", visibility: "free", content_tier: "basic", thumbnail_page: "1" });
      setKeywordTags([]);
      setSlideBadgeSelect("");
      setSlideBadgeNewLabel("");
      setSlideBadgeBg("#f59e0b");
      setSlideBadgeText("#ffffff");
      setSelectedPdfName("");
      fileInput.value = "";
      loadSlides();
      loadPrograms();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleExtractKeywords() {
    const form = document.getElementById("create-slide-form") as HTMLFormElement | null;
    const fileInput = form?.pdf as HTMLInputElement | undefined;
    const file = fileInput?.files?.[0];
    if (!file) {
      alert("PDFファイルを選択してください");
      return;
    }

    setExtractingKeywords(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("title", createForm.title);

      const res = await fetch("/api/slides/extract-keywords", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        alert(`抽出失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }

      if (json.keywords?.length > 0) {
        const merged = [...new Set([...keywordTags, ...json.keywords])];
        setKeywordTags(merged);
        alert(json.message ?? `${json.keywords.length}個のキーワードを抽出しました`);
      } else {
        alert(
          json.message ??
            "キーワードを抽出できませんでした。ANTHROPIC_API_KEY または OPENAI_API_KEY を .env.local に設定してください。"
        );
      }
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExtractingKeywords(false);
    }
  }

  async function handleExtractCaption() {
    const form = document.getElementById("create-slide-form") as HTMLFormElement | null;
    const fileInput = form?.pdf as HTMLInputElement | undefined;
    const file = fileInput?.files?.[0];
    if (!file) {
      alert("PDFファイルを選択してください");
      return;
    }
    const fiftyMB = 50 * 1024 * 1024;
    if (file.size > fiftyMB) {
      if (!confirm(`PDFが約50MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）。ローカルでは上限設定を上げれば処理できますが、本番では失敗する可能性があります。続行しますか？`)) {
        return;
      }
    }

    setExtractingCaption(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("title", createForm.title);

      const res = await fetch("/api/slides/extract-caption", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let json: { error?: string; message?: string; details?: string; caption?: string };
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        if (res.status === 413) {
          json = {
            error: "PDFが大きすぎます",
            message: "アップロードサイズ制限を超えています。ローカルでは next.config.ts の proxyClientMaxBodySize を、本番ではホスティング側の上限を確認してください。",
          };
        } else {
          json = { error: "レスポンスの解析に失敗しました", details: `HTTP ${res.status}` };
        }
      }

      if (!res.ok) {
        alert(`抽出失敗: ${json.error ?? "エラー"}\n${json.message ?? json.details ?? ""}`);
        return;
      }

      if (json.caption) {
        setCreateForm((f) => ({ ...f, caption: json.caption ?? f.caption }));
        alert(json.message ?? "キャプションを生成しました");
      }
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExtractingCaption(false);
    }
  }

  async function handleDelete(slideId: string) {
    if (!confirm("このスライドを削除しますか？Storage のファイルも含めて完全に削除されます。")) {
      return;
    }
    setDeletingId(slideId);
    try {
      const res = await fetch(`/api/slides/${slideId}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        alert(`削除失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }

      loadSlides();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(slide: SlideRow) {
    setEditingSlide(slide);
    setSlideThumbPageOnOpen(String(thumbPageIndexFromSlide(slide)));
    const tags = slide.keyword_tags ?? [];
    setEditForm({
      title: slide.title,
      program_id: slide.program_id ?? "",
      year: slide.year?.toString() ?? "",
      keyword_tags: Array.isArray(tags) ? tags.join(", ") : "",
      caption: slide.caption ?? "",
      visibility: (slide.visibility as SlideVisibility) || "private",
      content_tier: (slide.content_tier as ContentTier) || "basic",
      thumbnail_page: String(thumbPageIndexFromSlide(slide)),
    });
    const p = programs.find((row) => String(row.id) === String(slide.program_id));
    const label = p?.slide_badge_label?.trim() ?? "";
    const inOptions = !!label && slideBadgeOptions.includes(label);
    setSlideEditBadgeSelect(inOptions ? label : label ? "__new__" : "");
    setSlideEditBadgeNewLabel(inOptions ? "" : label);
    setSlideEditBadgeBg(p?.slide_badge_bg ?? "#f59e0b");
    setSlideEditBadgeText(p?.slide_badge_text ?? "#ffffff");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSlide) return;
    setSaving(true);
    try {
      const tags = editForm.keyword_tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const patchBody: Record<string, unknown> = {
        title: editForm.title,
        program_id: editForm.program_id || null,
        year: editForm.year ? Number(editForm.year) : null,
        keyword_tags: tags,
        caption: editForm.caption.trim() || null,
        visibility: editForm.visibility,
        content_tier: editForm.content_tier,
      };
      const urls = editingSlide.page_image_urls ?? [];
      const pageCount = urls.length;
      const hasCustomThumb = slideHasCustomThumbnail(editingSlide);
      const tp = parseInt(editForm.thumbnail_page.trim(), 10);
      const thumbPageChanged =
        !Number.isNaN(tp) && tp >= 1 && String(tp) !== slideThumbPageOnOpen;
      if (pageCount > 0 && (!hasCustomThumb || thumbPageChanged)) {
        if (!Number.isNaN(tp) && tp >= 1) {
          patchBody.thumbnail_page_index = tp;
        }
      }

      const res = await fetch(`/api/slides/${editingSlide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`更新失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }
      const selectedSlideBadgeLabel =
        slideEditBadgeSelect === "__new__" ? slideEditBadgeNewLabel.trim() : slideEditBadgeSelect.trim();
      if (editForm.program_id) {
        await applyProgramBadge(editForm.program_id, "slide", selectedSlideBadgeLabel, slideEditBadgeBg, slideEditBadgeText);
      }
      setEditingSlide(null);
      await loadPrograms();
      loadSlides();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(slideId: string) {
    setConvertingId(slideId);
    try {
      const res = await fetch(`/api/slides/${slideId}/convert`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        alert(`変換失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }

      alert(`変換完了: ${json.pageCount}ページ`);
      loadSlides();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConvertingId(null);
    }
  }

  async function uploadSlideThumbnailForEdit(slideId: string, file: File) {
    setSlideEditThumbUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/slides/${encodeURIComponent(slideId)}/thumbnail`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error ?? "サムネイルのアップロードに失敗しました");
        return;
      }
      const url = typeof json.image_url === "string" ? json.image_url : "";
      if (url) {
        setEditingSlide((s) => (s && s.id === slideId ? { ...s, image_url: url } : s));
      }
      await loadSlides();
    } finally {
      setSlideEditThumbUploading(false);
    }
  }

  async function revertSlideThumbnailToPage() {
    if (!editingSlide) return;
    const urls = editingSlide.page_image_urls ?? [];
    if (urls.length === 0) return;
    const tp = parseInt(editForm.thumbnail_page.trim(), 10);
    if (Number.isNaN(tp) || tp < 1 || tp > urls.length) {
      alert(`サムネイルに使うページを 1〜${urls.length} の範囲で指定してください`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/slides/${encodeURIComponent(editingSlide.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_page_index: tp }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`更新失敗: ${json.error ?? ""}\n${json.details ?? ""}`);
        return;
      }
      const slide = json.slide as SlideRow | undefined;
      if (slide) {
        setEditingSlide(slide);
        const n = thumbPageIndexFromSlide(slide);
        setSlideThumbPageOnOpen(String(n));
        setEditForm((f) => ({ ...f, thumbnail_page: String(n) }));
      }
      await loadSlides();
    } catch (err) {
      alert(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full">
      <header
        className="w-full min-w-0 overflow-visible border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-header)" }}
      >
        <div className="mx-auto w-full min-w-0 max-w-4xl px-6 py-6">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <Link
              href="/"
              className="shrink-0 text-sm font-medium hover:opacity-80"
              style={{ color: "var(--fg-muted)" }}
            >
              ← Back to Home
            </Link>
            <div className="flex min-w-0 shrink-0 items-center gap-4">
              <Link
                href="/admin/operations"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: adminView === "operations" ? "var(--fg)" : "var(--fg-muted)" }}
              >
                運用管理
              </Link>
              <Link
                href="/admin/slides"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: adminView === "slides" ? "var(--fg)" : "var(--fg-muted)" }}
              >
                スライド管理
              </Link>
              <Link
                href="/admin/videos"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: adminView === "videos" ? "var(--fg)" : "var(--fg-muted)" }}
              >
                動画管理
              </Link>
              <Link
                href="/admin/settings"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: adminView === "settings" ? "var(--fg)" : "var(--fg-muted)" }}
              >
                フロント設定
              </Link>
              <Link
                href="/admin/master"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: adminView === "master" ? "var(--fg)" : "var(--fg-muted)" }}
              >
                マスタ管理
              </Link>
              <Link
                href="/admin/guide"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: "var(--fg-muted)" }}
              >
                使い方ガイド
              </Link>
              <Link
                href="/admin/business-guide"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: "var(--fg-muted)" }}
              >
                ビジネス・戦略ガイド
              </Link>
              <h1 className="shrink-0 text-xl font-bold" style={{ color: "var(--fg)" }}>
                管理画面
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
        {/* フロント設定（ヘッダー管理） */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "settings" ? "" : "hidden"}`}>
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">ヘッダー管理</h2>
          <p className="mb-6 text-sm text-neutral-600">
            トップページのヘッダー下のキャッチコピーと、フッター横のテキストを編集できます。それぞれ独立して変更可能です。
          </p>
          <form onSubmit={handleSaveSiteSettings} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">サブタイトル（ヘッダー下）</label>
              <input
                type="text"
                value={siteSettingsSubtitle}
                onChange={(e) => setSiteSettingsSubtitle(e.target.value)}
                placeholder="例: いつでも、どこでも、学びのレシピ"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">フッター横のテキスト</label>
              <input
                type="text"
                value={siteSettingsFooterText}
                onChange={(e) => setSiteSettingsFooterText(e.target.value)}
                placeholder="例: SPACE ARCHIVE — いつでも、どこでも、学びのレシピ"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div className="space-y-4 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-800">ヒーローカルーセル（トップのスライド表示）</h3>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="heroMode"
                    checked={heroMode === "random"}
                    onChange={() => setHeroMode("random")}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm text-neutral-700">ランダムモード</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="heroMode"
                    checked={heroMode === "selected"}
                    onChange={() => setHeroMode("selected")}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm text-neutral-700">選択モード</span>
                </label>
              </div>
              {heroMode === "random" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">表示枚数（1〜20）</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={heroSlideCount}
                    onChange={(e) => setHeroSlideCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                    className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
              )}
              {heroMode === "selected" && (
                <div>
                  <p className="mb-2 text-sm text-neutral-600">表示するスライドを選んでください（上から表示順）。</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id && !heroSlideIds.includes(id)) setHeroSlideIds((prev) => [...prev, id]);
                        e.target.value = "";
                      }}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                    >
                      <option value="">スライドを追加…</option>
                      {slides
                        .filter((s) => !heroSlideIds.includes(s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ({String(s.id ?? "").slice(0, 8)}…)
                          </option>
                        ))}
                    </select>
                  </div>
                  <ul className="space-y-1 rounded border border-neutral-200 bg-neutral-50 p-2 max-h-48 overflow-y-auto">
                    {heroSlideIds.length === 0 ? (
                      <li className="text-sm text-neutral-500">まだ選択されていません</li>
                    ) : (
                      heroSlideIds.map((id) => {
                        const slide = slides.find((s) => s.id === id);
                        return (
                          <li key={id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm">
                            <span className="min-w-0 truncate text-neutral-800">{slide?.title ?? id}</span>
                            <button
                              type="button"
                              onClick={() => setHeroSlideIds((prev) => prev.filter((x) => x !== id))}
                              className="shrink-0 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
                            >
                              削除
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={savingSiteSettings}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {savingSiteSettings ? "保存中..." : "保存"}
            </button>
          </form>
        </section>

        {/* ジャンル種別（プログラム・組織をオーガナイズ・自治体等のマスタ） */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "master" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">ジャンル種別</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingGenreType(true);
                setEditingGenreType(null);
                setGenreTypeForm({ id: "", name: "", sort_order: genreTypes.length });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規ジャンル種別追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            プログラム・組織をオーガナイズ・自治体など、ジャンルの「種別」を管理します。下のジャンル管理で各シリーズに割り当てます。
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-neutral-700">id</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">表示名</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">並び順</th>
                  <th className="w-32 px-4 py-3 font-medium text-neutral-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {genreTypes.map((g) => (
                  <tr key={g.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-neutral-600">{g.id}</td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{g.name}</td>
                    <td className="px-4 py-3 text-neutral-600">{g.sort_order}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGenreType(g);
                          setGenreTypeForm({ id: g.id, name: g.name, sort_order: g.sort_order });
                        }}
                        className="mr-2 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGenreType(g)}
                        disabled={savingGenreType}
                        className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {genreTypes.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">ジャンル種別がありません。マイグレーションを実行してください。</p>
          )}

          {creatingGenreType && (
            <form onSubmit={handleCreateGenreType} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規ジャンル種別</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">id *（英小文字・数字・ハイフンのみ）</label>
                <input
                  type="text"
                  value={genreTypeForm.id}
                  onChange={(e) => setGenreTypeForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                  placeholder="例: event"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">表示名 *</label>
                <input
                  type="text"
                  value={genreTypeForm.name}
                  onChange={(e) => setGenreTypeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例: イベント"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">並び順</label>
                <input
                  type="number"
                  value={genreTypeForm.sort_order}
                  onChange={(e) => setGenreTypeForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                  className="w-24 rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingGenreType || !genreTypeForm.id || !genreTypeForm.name}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingGenreType ? "追加中..." : "追加"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatingGenreType(false); setGenreTypeForm({ id: "", name: "", sort_order: 0 }); }}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {editingGenreType && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !savingGenreType && setEditingGenreType(null)}
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-semibold text-neutral-800">ジャンル種別を編集</h3>
                <form onSubmit={handleUpdateGenreType} className="space-y-4">
                  <p className="text-sm text-neutral-500">id: {editingGenreType.id}（変更不可）</p>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">表示名 *</label>
                    <input
                      type="text"
                      value={genreTypeForm.name}
                      onChange={(e) => setGenreTypeForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">並び順</label>
                    <input
                      type="number"
                      value={genreTypeForm.sort_order}
                      onChange={(e) => setGenreTypeForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                      className="w-24 rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingGenreType}
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {savingGenreType ? "保存中..." : "保存"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGenreType(null)}
                      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* ジャンル管理（プログラム・組織・自治体） */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "master" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">ジャンル管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingProgram(true);
                setEditingProgram(null);
                setProgramForm({
                  name: "",
                  slug: "",
                  genre_type: genreTypes[0]?.id ?? "program",
                  description: "",
                  started_year: "",
                  slide_badge_label: "",
                  slide_badge_bg: "#f59e0b",
                  slide_badge_text: "#ffffff",
                  video_badge_label: "",
                  video_badge_bg: "#f59e0b",
                  video_badge_text: "#ffffff",
                  show_on_front: true,
                  show_in_sidebar: true,
                });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規ジャンル追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            プログラム（ROCKET ABL 等）、組織（SPACE・EARTH 等）、自治体（鎌倉市等）を登録できます。スライド作成時に選択します。「トップ棚」と「サイドバー」は独立しています（トップにだけ出し、メニューには出さない、などが可能です）。
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-neutral-700">名前</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">slug</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">種別</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">開始年</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">トップ棚</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">サイドバー</th>
                  <th className="w-24 px-4 py-3 font-medium text-neutral-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-800">{p.name}</td>
                    <td className="px-4 py-3 text-neutral-500">{p.slug}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {genreTypes.find((g) => g.id === p.genre_type)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{p.started_year ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.show_on_front !== false ? "する" : "しない"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.show_in_sidebar !== false ? "する" : "しない"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProgram(p);
                          setCreatingProgram(false);
                          setProgramForm({
                            name: p.name,
                            slug: p.slug,
                            genre_type: p.genre_type || "program",
                            description: p.description ?? "",
                            started_year: p.started_year != null ? String(p.started_year) : "",
                            slide_badge_label: p.slide_badge_label ?? "",
                            slide_badge_bg: p.slide_badge_bg ?? "#f59e0b",
                            slide_badge_text: p.slide_badge_text ?? "#ffffff",
                            video_badge_label: p.video_badge_label ?? "",
                            video_badge_bg: p.video_badge_bg ?? "#f59e0b",
                            video_badge_text: p.video_badge_text ?? "#ffffff",
                            show_on_front: p.show_on_front !== false,
                            show_in_sidebar: p.show_in_sidebar !== false,
                          });
                        }}
                        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {programs.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">ジャンルがありません。上から追加してください。</p>
          )}

          {/* 新規ジャンル追加フォーム */}
          {creatingProgram && (
            <form onSubmit={handleCreateProgram} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規ジャンル</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">名前 *</label>
                <input
                  type="text"
                  value={programForm.name}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="例: ROCKET ABL / SPACE / 鎌倉市"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">slug（任意・未入力なら名前から自動）</label>
                <input
                  type="text"
                  value={programForm.slug}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="例: rocket-abl"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">ジャンル種別</label>
                <select
                  value={programForm.genre_type}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, genre_type: e.target.value }))
                  }
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                >
                  {genreTypes.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">シリーズの説明（任意）</label>
                <p className="mb-1 text-[11px] text-neutral-500">フロントのシリーズタイトル直下に1行で表示されます。</p>
                <input
                  type="text"
                  value={programForm.description}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="例: 探究型プログラム / 株式会社SPACEの取り組み"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded border border-neutral-200 bg-white p-3">
                  <label className="block text-xs font-medium text-neutral-700">スライド用バッジ（任意）</label>
                  <input
                    type="text"
                    value={programForm.slide_badge_label}
                    onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_label: e.target.value }))}
                    placeholder="例: ABL / 講演"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-neutral-600">
                      背景色
                      <input type="color" value={programForm.slide_badge_bg} onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_bg: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                    <label className="text-[11px] text-neutral-600">
                      文字色
                      <input type="color" value={programForm.slide_badge_text} onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_text: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                  </div>
                </div>
                <div className="space-y-2 rounded border border-neutral-200 bg-white p-3">
                  <label className="block text-xs font-medium text-neutral-700">動画用バッジ（任意）</label>
                  <input
                    type="text"
                    value={programForm.video_badge_label}
                    onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_label: e.target.value }))}
                    placeholder="例: 動画教材 / 対談"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-neutral-600">
                      背景色
                      <input type="color" value={programForm.video_badge_bg} onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_bg: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                    <label className="text-[11px] text-neutral-600">
                      文字色
                      <input type="color" value={programForm.video_badge_text} onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_text: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">開始年（任意）</label>
                <input
                  type="number"
                  value={programForm.started_year}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, started_year: e.target.value }))
                  }
                  placeholder="例: 2015"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_on_front_new"
                  checked={programForm.show_on_front}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, show_on_front: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="show_on_front_new" className="text-xs font-medium text-neutral-600">
                  トップページのシリーズ棚に表示する
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_in_sidebar_new"
                  checked={programForm.show_in_sidebar}
                  onChange={(e) =>
                    setProgramForm((f) => ({ ...f, show_in_sidebar: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="show_in_sidebar_new" className="text-xs font-medium text-neutral-600">
                  マイページ等のサイドバー「コンテンツ」メニューに表示する
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingProgram}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingProgram ? "登録中..." : "登録"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingProgram(false);
                    setProgramForm({
                      name: "",
                      slug: "",
                      genre_type: genreTypes[0]?.id ?? "program",
                      description: "",
                      started_year: "",
                      slide_badge_label: "",
                      slide_badge_bg: "#f59e0b",
                      slide_badge_text: "#ffffff",
                      video_badge_label: "",
                      video_badge_bg: "#f59e0b",
                      video_badge_text: "#ffffff",
                      show_on_front: true,
                      show_in_sidebar: true,
                    });
                  }}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {/* ジャンル編集モーダル */}
          {editingProgram && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !savingProgram && setEditingProgram(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="program-edit-title"
            >
              <div
                className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="program-edit-title" className="mb-4 text-lg font-semibold text-neutral-800">
                  ジャンルを編集
                </h3>
                <form onSubmit={handleUpdateProgram} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">名前 *</label>
                    <input
                      type="text"
                      value={programForm.name}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">slug（任意）</label>
                    <input
                      type="text"
                      value={programForm.slug}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, slug: e.target.value }))
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">ジャンル種別</label>
                    <select
                      value={programForm.genre_type}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, genre_type: e.target.value }))
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    >
                      {genreTypes.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">シリーズの説明（任意）</label>
                    <p className="mb-1 text-xs text-neutral-500">フロントのシリーズタイトル直下に1行で表示されます。</p>
                    <input
                      type="text"
                      value={programForm.description}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="例: 探究型プログラム"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3">
                      <label className="block text-sm font-medium text-neutral-700">スライド用バッジ（任意）</label>
                      <input
                        type="text"
                        value={programForm.slide_badge_label}
                        onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_label: e.target.value }))}
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-neutral-600">
                          背景色
                          <input type="color" value={programForm.slide_badge_bg} onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_bg: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                        </label>
                        <label className="text-xs text-neutral-600">
                          文字色
                          <input type="color" value={programForm.slide_badge_text} onChange={(e) => setProgramForm((f) => ({ ...f, slide_badge_text: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3">
                      <label className="block text-sm font-medium text-neutral-700">動画用バッジ（任意）</label>
                      <input
                        type="text"
                        value={programForm.video_badge_label}
                        onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_label: e.target.value }))}
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-neutral-600">
                          背景色
                          <input type="color" value={programForm.video_badge_bg} onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_bg: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                        </label>
                        <label className="text-xs text-neutral-600">
                          文字色
                          <input type="color" value={programForm.video_badge_text} onChange={(e) => setProgramForm((f) => ({ ...f, video_badge_text: e.target.value }))} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">開始年（任意）</label>
                    <input
                      type="number"
                      value={programForm.started_year}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, started_year: e.target.value }))
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="show_on_front_edit"
                      checked={programForm.show_on_front}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, show_on_front: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    <label htmlFor="show_on_front_edit" className="text-sm font-medium text-neutral-600">
                      トップページのシリーズ棚に表示する
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="show_in_sidebar_edit"
                      checked={programForm.show_in_sidebar}
                      onChange={(e) =>
                        setProgramForm((f) => ({ ...f, show_in_sidebar: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    <label htmlFor="show_in_sidebar_edit" className="text-sm font-medium text-neutral-600">
                      マイページ等のサイドバー「コンテンツ」メニューに表示する
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProgram(null)}
                      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={savingProgram}
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {savingProgram ? "保存中..." : "保存"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* フロント設定: シリーズ棚管理 */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "settings" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">シリーズ棚管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingShelf(true);
                setEditingShelf(null);
                setShelfForm({ title: "", slug: "", description: "", sort_order: 0, is_published: true });
                setShelfSlideIds([]);
                setShelfVideoIds([]);
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規棚を追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            トップページの「特集棚」に表示する棚を管理します。1つの棚にスライドと動画を混在できます。
          </p>

          {loadingShelves ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">タイトル</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">slug</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">公開</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">並び順</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">アイテム数</th>
                    <th className="w-36 px-4 py-3 font-medium text-neutral-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shelves.map((shelf) => (
                    <tr key={shelf.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-neutral-800">{shelf.title}</td>
                      <td className="px-4 py-3 text-neutral-600">{shelf.slug}</td>
                      <td className="px-4 py-3 text-neutral-600">{shelf.is_published ? "公開" : "非公開"}</td>
                      <td className="px-4 py-3 text-neutral-600">{shelf.sort_order}</td>
                      <td className="px-4 py-3 text-neutral-600">{shelf.items?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShelf(shelf);
                              setCreatingShelf(false);
                              setShelfForm({
                                title: shelf.title,
                                slug: shelf.slug,
                                description: shelf.description ?? "",
                                sort_order: shelf.sort_order ?? 0,
                                is_published: shelf.is_published !== false,
                              });
                              const slideIds = (shelf.items ?? []).filter((it) => it.content_type === "slide").map((it) => String(it.content_id));
                              const videoIds = (shelf.items ?? []).filter((it) => it.content_type === "video").map((it) => String(it.content_id));
                              setShelfSlideIds(slideIds);
                              setShelfVideoIds(videoIds);
                            }}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShelf(shelf.id)}
                            className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {creatingShelf && (
            <form onSubmit={handleCreateShelf} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規棚</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">棚タイトル *</label>
                  <input
                    type="text"
                    value={shelfForm.title}
                    onChange={(e) => setShelfForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">slug（任意）</label>
                  <input
                    type="text"
                    value={shelfForm.slug}
                    onChange={(e) => setShelfForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    placeholder="ai-feature"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">説明（任意）</label>
                <input
                  type="text"
                  value={shelfForm.description}
                  onChange={(e) => setShelfForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">並び順</label>
                  <input
                    type="number"
                    value={shelfForm.sort_order}
                    onChange={(e) => setShelfForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="shelf_is_published_new"
                    type="checkbox"
                    checked={shelfForm.is_published}
                    onChange={(e) => setShelfForm((f) => ({ ...f, is_published: e.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <label htmlFor="shelf_is_published_new" className="text-xs font-medium text-neutral-600">公開する</label>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-neutral-600">スライド（複数選択）</p>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                    {slides.map((s) => {
                      const checked = shelfSlideIds.includes(String(s.id));
                      return (
                        <label key={`shelf-slide-${s.id}`} className="flex items-center gap-2 text-xs text-neutral-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setShelfSlideIds((prev) => [...prev, String(s.id)]);
                              else setShelfSlideIds((prev) => prev.filter((id) => id !== String(s.id)));
                            }}
                          />
                          <span className="truncate">{s.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-neutral-600">動画（複数選択）</p>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                    {videos.map((v) => {
                      const checked = shelfVideoIds.includes(String(v.id));
                      return (
                        <label key={`shelf-video-${v.id}`} className="flex items-center gap-2 text-xs text-neutral-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setShelfVideoIds((prev) => [...prev, String(v.id)]);
                              else setShelfVideoIds((prev) => prev.filter((id) => id !== String(v.id)));
                            }}
                          />
                          <span className="truncate">{v.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingShelf}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingShelf ? "作成中..." : "作成"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingShelf(false)}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {editingShelf && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !savingShelf && setEditingShelf(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shelf-edit-title"
            >
              <div
                className="w-full max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="shelf-edit-title" className="mb-4 text-lg font-semibold text-neutral-800">棚を編集</h3>
                <form onSubmit={handleUpdateShelf} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">棚タイトル *</label>
                      <input
                        type="text"
                        value={shelfForm.title}
                        onChange={(e) => setShelfForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">slug</label>
                      <input
                        type="text"
                        value={shelfForm.slug}
                        onChange={(e) => setShelfForm((f) => ({ ...f, slug: e.target.value }))}
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">説明（任意）</label>
                    <input
                      type="text"
                      value={shelfForm.description}
                      onChange={(e) => setShelfForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-neutral-600">スライド</p>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                        {slides.map((s) => (
                          <label key={`shelf-edit-slide-${s.id}`} className="flex items-center gap-2 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={shelfSlideIds.includes(String(s.id))}
                              onChange={(e) => {
                                if (e.target.checked) setShelfSlideIds((prev) => [...prev, String(s.id)]);
                                else setShelfSlideIds((prev) => prev.filter((id) => id !== String(s.id)));
                              }}
                            />
                            <span className="truncate">{s.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-neutral-600">動画</p>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                        {videos.map((v) => (
                          <label key={`shelf-edit-video-${v.id}`} className="flex items-center gap-2 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={shelfVideoIds.includes(String(v.id))}
                              onChange={(e) => {
                                if (e.target.checked) setShelfVideoIds((prev) => [...prev, String(v.id)]);
                                else setShelfVideoIds((prev) => prev.filter((id) => id !== String(v.id)));
                              }}
                            />
                            <span className="truncate">{v.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
                      <input
                        type="checkbox"
                        checked={shelfForm.is_published}
                        onChange={(e) => setShelfForm((f) => ({ ...f, is_published: e.target.checked }))}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      公開する
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingShelf(null)}
                        className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        disabled={savingShelf}
                        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {savingShelf ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* フロント設定: トップ棚の順序管理 */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "settings" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">トップ棚の順序管理</h2>
            <button
              type="button"
              onClick={saveFrontShelfOrder}
              disabled={savingFrontShelfOrder || loadingFrontShelfOrder}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {savingFrontShelfOrder ? "保存中..." : "順序を保存"}
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            固定棚（スライド・動画）とシリーズ棚を、同じ一覧で順序変更できます。フロント側での並び順にそのまま反映されます。
          </p>
          <p className="mb-4 text-xs text-neutral-500">
            各行をドラッグ＆ドロップして並び替えてから「順序を保存」を押してください。
          </p>
          {loadingFrontShelfOrder ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="w-16 px-4 py-3 font-medium text-neutral-700">移動</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">表示</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">棚</th>
                    <th className="w-28 px-4 py-3 font-medium text-neutral-700">順序</th>
                  </tr>
                </thead>
                <tbody>
                  {frontShelfOrder.map((row, index) => (
                    <tr
                      key={row.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingFrontShelfId(row.id);
                        setDragOverFrontShelfId(row.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverFrontShelfId !== row.id) setDragOverFrontShelfId(row.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingFrontShelfId) {
                          reorderFrontShelfRows(draggingFrontShelfId, row.id);
                        }
                        setDraggingFrontShelfId(null);
                        setDragOverFrontShelfId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingFrontShelfId(null);
                        setDragOverFrontShelfId(null);
                      }}
                      className={`border-b border-neutral-100 last:border-0 ${
                        draggingFrontShelfId === row.id ? "opacity-60" : ""
                      } ${dragOverFrontShelfId === row.id ? "bg-sky-50/50" : ""}`}
                    >
                      <td className="cursor-move px-4 py-3 text-neutral-500" title="ドラッグして並び替え">
                        ⋮⋮
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={row.is_enabled}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFrontShelfOrder((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, is_enabled: checked } : r)),
                            );
                          }}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-neutral-800">{row.label}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">#{index + 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* メンバー権限付与（最短運用） */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "operations" ? "" : "hidden"}`}>
          <h2 className="text-lg font-semibold text-neutral-800">メンバー権限付与</h2>
          <p className="mt-2 text-sm text-neutral-600">
            メールアドレスを入力して、管理者またはコアスタッフ権限を付与/解除します（対象ユーザーは事前にログイン済みである必要があります）。
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-600">メールアドレス</label>
              <input
                type="email"
                value={grantRoleEmail}
                onChange={(e) => setGrantRoleEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
              />
            </div>
            <button
              type="button"
              onClick={() => handleGrantRole("admin")}
              disabled={grantRoleLoading}
              className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              管理者を付与
            </button>
            <button
              type="button"
              onClick={() => handleRevokeRole("admin")}
              disabled={grantRoleLoading}
              className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              管理者を解除
            </button>
            <button
              type="button"
              onClick={() => handleGrantRole("core_staff")}
              disabled={grantRoleLoading}
              className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              コアスタッフを付与
            </button>
            <button
              type="button"
              onClick={() => handleRevokeRole("core_staff")}
              disabled={grantRoleLoading}
              className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              コアスタッフを解除
            </button>
          </div>
          {grantRoleMessage && (
            <p className="mt-3 text-sm text-neutral-700">{grantRoleMessage}</p>
          )}
          <div className="mt-5 rounded-lg border border-neutral-200">
            <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
              現在の権限メンバー
            </div>
            {loadingRoleMembers ? (
              <p className="px-3 py-3 text-sm text-neutral-500">読み込み中...</p>
            ) : roleMembers.length === 0 ? (
              <p className="px-3 py-3 text-sm text-neutral-500">管理者/コアスタッフはまだ登録されていません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-white">
                    <tr>
                      <th className="px-3 py-2 font-medium text-neutral-700">メール</th>
                      <th className="px-3 py-2 font-medium text-neutral-700">管理者</th>
                      <th className="px-3 py-2 font-medium text-neutral-700">コアスタッフ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleMembers.map((m) => (
                      <tr key={m.user_id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-3 py-2 text-neutral-800">{m.email}</td>
                        <td className="px-3 py-2 text-neutral-600">{m.is_admin ? "✅" : "—"}</td>
                        <td className="px-3 py-2 text-neutral-600">{m.is_core_staff ? "✅" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* 招待コード管理 */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "operations" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">招待コード管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingInviteCode(true);
                setInviteCodeForm({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [], video_ids: [] });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規招待コード追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            招待コードごとに閲覧可能なスライド・動画を紐づけます。ユーザーがコードを入力すると、紐づけたコンテンツのみ閲覧できます。
          </p>
          {loadingInviteCodes ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">コード</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">名前</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">有効期限（既定）</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">紐づけスライド数</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">紐づけ動画数</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">使用数</th>
                    <th className="w-28 px-4 py-3 font-medium text-neutral-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.map((ic) => (
                    <tr key={ic.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-neutral-800">{ic.code}</td>
                      <td className="px-4 py-3 text-neutral-600">{ic.name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {ic.default_expires_at
                          ? (() => {
                              const d = ic.default_expires_at.slice(0, 10);
                              return `${d.replace(/-/g, "/")}`;
                            })()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{ic.slide_ids?.length ?? 0}件</td>
                      <td className="px-4 py-3 text-neutral-600">{ic.video_ids?.length ?? 0}件</td>
                      <td className="px-4 py-3 text-neutral-600">{ic.used_count} / {ic.max_uses}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInviteCode(ic);
                              setInviteCodeEditForm({
                                name: ic.name ?? "",
                                description: ic.description ?? "",
                                default_expires_at: ic.default_expires_at ? ic.default_expires_at.slice(0, 10) : "",
                                slide_ids: ic.slide_ids ?? [],
                                video_ids: ic.video_ids ?? [],
                              });
                            }}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInviteCode(ic.id)}
                            className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {inviteCodes.length === 0 && !loadingInviteCodes && (
            <p className="mt-3 text-sm text-neutral-500">招待コードがありません。マイグレーションで ULTLA2025 が投入されている場合は、DBを確認してください。</p>
          )}

          {creatingInviteCode && (
            <form onSubmit={handleCreateInviteCode} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規招待コード</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">コード *（英数字・ハイフンのみ）</label>
                <input
                  type="text"
                  value={inviteCodeForm.code}
                  onChange={(e) => setInviteCodeForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="例: syoku-iku-hayama"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">名前（任意）</label>
                <input
                  type="text"
                  value={inviteCodeForm.name}
                  onChange={(e) => setInviteCodeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例: 葉山食育セミナー2026"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">説明（任意）</label>
                <input
                  type="text"
                  value={inviteCodeForm.description}
                  onChange={(e) => setInviteCodeForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="備考"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">有効期限（任意・未設定なら付与から1ヶ月）</label>
                <input
                  type="date"
                  value={inviteCodeForm.default_expires_at}
                  onChange={(e) => setInviteCodeForm((f) => ({ ...f, default_expires_at: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">紐づけるスライド（チェックで選択）</label>
                <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white p-2">
                  {slides.map((s) => (
                    <label key={s.id} className="mb-1 flex cursor-pointer gap-2 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={inviteCodeForm.slide_ids.some((id) => String(id) === String(s.id))}
                        onChange={(e) => {
                          const sid = s.id;
                          const ids = e.target.checked
                            ? [...inviteCodeForm.slide_ids, sid]
                            : inviteCodeForm.slide_ids.filter((id) => String(id) !== String(sid));
                          setInviteCodeForm((f) => ({ ...f, slide_ids: ids }));
                        }}
                      />
                      <span className="truncate">{s.title}</span>
                    </label>
                  ))}
                  {slides.length === 0 && <p className="text-xs text-neutral-500">スライドがありません</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">紐づける動画（チェックで選択）</label>
                <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white p-2">
                  {videos.map((v) => (
                    <label key={v.id} className="mb-1 flex cursor-pointer gap-2 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={inviteCodeForm.video_ids.some((id) => String(id) === String(v.id))}
                        onChange={(e) => {
                          const vid = String(v.id);
                          const ids = e.target.checked
                            ? [...inviteCodeForm.video_ids, vid]
                            : inviteCodeForm.video_ids.filter((id) => String(id) !== vid);
                          setInviteCodeForm((f) => ({ ...f, video_ids: ids }));
                        }}
                      />
                      <span className="truncate">{v.title}</span>
                    </label>
                  ))}
                  {videos.length === 0 && <p className="text-xs text-neutral-500">動画がありません</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  disabled={savingInviteCode}
                >
                  {savingInviteCode ? "作成中..." : "作成"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingInviteCode(false)}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {editingInviteCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-neutral-800">招待コードを編集: {editingInviteCode.code}</h3>
                <form onSubmit={handleUpdateInviteCode} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">名前（任意）</label>
                    <input
                      type="text"
                      value={inviteCodeEditForm.name}
                      onChange={(e) => setInviteCodeEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例: 葉山食育セミナー2026"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">説明（任意）</label>
                    <input
                      type="text"
                      value={inviteCodeEditForm.description}
                      onChange={(e) => setInviteCodeEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="備考"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">有効期限（任意・未設定なら付与から1ヶ月）</label>
                    <input
                      type="date"
                      value={inviteCodeEditForm.default_expires_at}
                      onChange={(e) => setInviteCodeEditForm((f) => ({ ...f, default_expires_at: e.target.value }))}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">紐づけるスライド（チェックで選択）</label>
                    <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white p-2">
                      {slides.map((s) => (
                        <label key={s.id} className="mb-1 flex cursor-pointer gap-2 text-sm text-neutral-800">
                          <input
                            type="checkbox"
                            checked={inviteCodeEditForm.slide_ids.some((id) => String(id) === String(s.id))}
                            onChange={(e) => {
                              const sid = s.id;
                              const ids = e.target.checked
                                ? [...inviteCodeEditForm.slide_ids, sid]
                                : inviteCodeEditForm.slide_ids.filter((id) => String(id) !== String(sid));
                              setInviteCodeEditForm((f) => ({ ...f, slide_ids: ids }));
                            }}
                          />
                          <span className="truncate">{s.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">紐づける動画（チェックで選択）</label>
                    <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white p-2">
                      {videos.map((v) => (
                        <label key={v.id} className="mb-1 flex cursor-pointer gap-2 text-sm text-neutral-800">
                          <input
                            type="checkbox"
                            checked={inviteCodeEditForm.video_ids.some((id) => String(id) === String(v.id))}
                            onChange={(e) => {
                              const vid = String(v.id);
                              const ids = e.target.checked
                                ? [...inviteCodeEditForm.video_ids, vid]
                                : inviteCodeEditForm.video_ids.filter((id) => String(id) !== vid);
                              setInviteCodeEditForm((f) => ({ ...f, video_ids: ids }));
                            }}
                          />
                          <span className="truncate">{v.title}</span>
                        </label>
                      ))}
                      {videos.length === 0 && <p className="text-xs text-neutral-500">動画がありません</p>}
                    </div>
                  </div>
                  {editingInviteCode.default_expires_at && (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleApplyExpiry(editingInviteCode.id)}
                        disabled={applyingExpiryId === editingInviteCode.id}
                        className="rounded border border-amber-600 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {applyingExpiryId === editingInviteCode.id ? "適用中..." : "既存の登録ユーザーにこの期限を一括適用"}
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      disabled={savingInviteCode}
                    >
                      {savingInviteCode ? "保存中..." : "保存"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingInviteCode(null)}
                      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* お知らせ管理 */}
        <section
          id="admin-announcements"
          className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "operations" ? "" : "hidden"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">お知らせ管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingAnnouncement(true);
                setAnnouncementForm({
                  title: "",
                  body: "",
                  is_published: true,
                  show_on_home: false,
                  home_sort_order: 0,
                });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規お知らせ
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            マイページのお知らせ一覧には、公開中のものが表示されます。トップページ（未ログイン含む）に載せるお知らせは、下の一覧で「トップ」をオンにしてください（複数可・表示順は数字が小さいほど上）。オフにするとトップには出ません。
          </p>
          {loadingAnnouncements ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">公開状態</th>
                    <th className="w-20 px-2 py-3 text-center text-xs font-medium text-neutral-700">トップ</th>
                    <th className="w-16 px-2 py-3 text-center text-xs font-medium text-neutral-700">順</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">タイトル</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">公開日</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">更新日</th>
                    <th className="w-28 px-4 py-3 font-medium text-neutral-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3">
                        <span
                          className={
                            a.is_published
                              ? "rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                              : "rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                          }
                        >
                          {a.is_published ? "公開" : "下書き"}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          title={a.is_published ? "トップページに表示" : "公開中のみトップに出せます"}
                          checked={a.show_on_home === true}
                          disabled={!a.is_published}
                          onChange={(e) => patchAnnouncementFields(a.id, { show_on_home: e.target.checked })}
                          className="h-4 w-4 rounded border-neutral-300 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input
                          type="number"
                          title="表示順（小さいほど上）"
                          className="w-14 rounded border border-neutral-300 px-1 py-1 text-center text-xs text-neutral-900"
                          defaultValue={a.home_sort_order ?? 0}
                          key={`${a.id}-${a.home_sort_order ?? 0}`}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!Number.isFinite(v)) return;
                            if (v === (a.home_sort_order ?? 0)) return;
                            patchAnnouncementFields(a.id, { home_sort_order: v });
                          }}
                        />
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-neutral-800" title={a.title}>
                        {a.title}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {a.published_at ? new Date(a.published_at).toLocaleString("ja-JP") : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {a.updated_at ? new Date(a.updated_at).toLocaleString("ja-JP") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAnnouncement(a);
                              setAnnouncementEditForm({
                                title: a.title,
                                body: a.body,
                                is_published: a.is_published,
                                show_on_home: a.show_on_home === true,
                                home_sort_order: typeof a.home_sort_order === "number" ? a.home_sort_order : 0,
                              });
                            }}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {announcements.length === 0 && !loadingAnnouncements && (
            <p className="mt-3 text-sm text-neutral-500">お知らせがありません。</p>
          )}

          {creatingAnnouncement && (
            <form onSubmit={handleCreateAnnouncement} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規お知らせ</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">タイトル *</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例: 葉山市 食育研修に参加された皆さまへ"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  required
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-neutral-600">本文 *</label>
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setAnnouncementBodyTab("edit")}
                      className={`rounded px-2 py-1 ${
                        announcementBodyTab === "edit"
                          ? "bg-neutral-800 text-white"
                          : "bg-white text-neutral-600 border border-neutral-300"
                      }`}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementBodyTab("preview")}
                      className={`rounded px-2 py-1 ${
                        announcementBodyTab === "preview"
                          ? "bg-neutral-800 text-white"
                          : "bg-white text-neutral-600 border border-neutral-300"
                      }`}
                    >
                      プレビュー
                    </button>
                  </div>
                </div>
                {announcementBodyTab === "edit" ? (
                  <textarea
                    value={announcementForm.body}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                    rows={7}
                    placeholder="Markdown 形式でお知らせ本文を入力できます（## 見出し, - 箇条書き, **太字**, > 引用 など）。"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    required
                  />
                ) : (
                  <div className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800">
                    {announcementForm.body.trim() ? (
                      <AnnouncementMarkdown body={announcementForm.body} />
                    ) : (
                      <p className="text-xs text-neutral-500">
                        本文を入力するとここにプレビューが表示されます。
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="announcement_new_published"
                  checked={announcementForm.is_published}
                  onChange={(e) => setAnnouncementForm((f) => ({ ...f, is_published: e.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="announcement_new_published" className="text-xs font-medium text-neutral-600">
                  公開する
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="announcement_new_home"
                    checked={announcementForm.show_on_home}
                    disabled={!announcementForm.is_published}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, show_on_home: e.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300 disabled:opacity-40"
                  />
                  <label htmlFor="announcement_new_home" className="text-xs font-medium text-neutral-600">
                    トップページにも表示（公開中のみ）
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="announcement_new_order" className="text-xs font-medium text-neutral-600">
                    トップでの順（小さいほど上）
                  </label>
                  <input
                    id="announcement_new_order"
                    type="number"
                    value={announcementForm.home_sort_order}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({
                        ...f,
                        home_sort_order: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingAnnouncement ? "作成中..." : "作成"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingAnnouncement(false);
                    setAnnouncementForm({
                      title: "",
                      body: "",
                      is_published: true,
                      show_on_home: false,
                      home_sort_order: 0,
                    });
                  }}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {editingAnnouncement && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !savingAnnouncement && setEditingAnnouncement(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="announcement-edit-title"
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="announcement-edit-title" className="mb-4 text-lg font-semibold text-neutral-800">
                  お知らせを編集
                </h3>
                <form onSubmit={handleUpdateAnnouncement} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">タイトル *</label>
                    <input
                      type="text"
                      value={announcementEditForm.title}
                      onChange={(e) => setAnnouncementEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                      required
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-xs font-medium text-neutral-600">本文 *</label>
                      <div className="flex gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setAnnouncementEditBodyTab("edit")}
                          className={`rounded px-2 py-1 ${
                            announcementEditBodyTab === "edit"
                              ? "bg-neutral-800 text-white"
                              : "bg-white text-neutral-600 border border-neutral-300"
                          }`}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnouncementEditBodyTab("preview")}
                          className={`rounded px-2 py-1 ${
                            announcementEditBodyTab === "preview"
                              ? "bg-neutral-800 text-white"
                              : "bg-white text-neutral-600 border border-neutral-300"
                          }`}
                        >
                          プレビュー
                        </button>
                      </div>
                    </div>
                    {announcementEditBodyTab === "edit" ? (
                      <textarea
                        value={announcementEditForm.body}
                        onChange={(e) => setAnnouncementEditForm((f) => ({ ...f, body: e.target.value }))}
                        rows={8}
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                        required
                      />
                    ) : (
                      <div className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800">
                        {announcementEditForm.body.trim() ? (
                          <AnnouncementMarkdown body={announcementEditForm.body} />
                        ) : (
                          <p className="text-xs text-neutral-500">
                            本文を入力するとここにプレビューが表示されます。
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="announcement_edit_published"
                      checked={announcementEditForm.is_published}
                      onChange={(e) => setAnnouncementEditForm((f) => ({ ...f, is_published: e.target.checked }))}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    <label htmlFor="announcement_edit_published" className="text-sm font-medium text-neutral-600">
                      公開する（ON にすると published_at を現在時刻に更新）
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="announcement_edit_home"
                        checked={announcementEditForm.show_on_home}
                        disabled={!announcementEditForm.is_published}
                        onChange={(e) =>
                          setAnnouncementEditForm((f) => ({ ...f, show_on_home: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-neutral-300 disabled:opacity-40"
                      />
                      <label htmlFor="announcement_edit_home" className="text-sm font-medium text-neutral-600">
                        トップページに表示（公開中のみ）
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="announcement_edit_order" className="text-sm font-medium text-neutral-600">
                        トップでの順
                      </label>
                      <input
                        id="announcement_edit_order"
                        type="number"
                        value={announcementEditForm.home_sort_order}
                        onChange={(e) =>
                          setAnnouncementEditForm((f) => ({
                            ...f,
                            home_sort_order: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAnnouncement(null)}
                      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={savingAnnouncement}
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {savingAnnouncement ? "保存中..." : "保存"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* お問い合わせ管理 */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "operations" ? "" : "hidden"}`}>
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">お問い合わせ管理</h2>
          <p className="mb-4 text-sm text-neutral-600">
            ユーザーからのお問い合わせ一覧です。行をクリックして詳細を表示し、返信できます。
          </p>
          {loadingInquiries ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">受信日時</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">お名前</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">メール</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">件名</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inq) => (
                    <tr
                      key={inq.id}
                      className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                      onClick={() => openInquiryDetail(inq)}
                    >
                      <td className="px-4 py-3 text-neutral-600">
                        {new Date(inq.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">{inq.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{inq.email}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-neutral-600" title={inq.subject}>
                        {inq.subject}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            inq.read_at
                              ? "rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                              : "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                          }
                        >
                          {inq.read_at ? "既読" : "未読"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {inquiries.length === 0 && !loadingInquiries && (
            <p className="mt-3 text-sm text-neutral-500">お問い合わせはまだありません。</p>
          )}
        </section>

        {/* お問い合わせ詳細・返信モーダル */}
        {selectedInquiry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-800">お問い合わせ詳細</h3>
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="rounded border border-neutral-300 bg-white p-2 text-neutral-600 hover:bg-neutral-50"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
              <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-neutral-500">お名前</dt>
                <dd className="text-neutral-800">{selectedInquiry.name}</dd>
                <dt className="text-neutral-500">メール</dt>
                <dd className="text-neutral-800">{selectedInquiry.email}</dd>
                <dt className="text-neutral-500">受信日時</dt>
                <dd className="text-neutral-800">{new Date(selectedInquiry.created_at).toLocaleString("ja-JP")}</dd>
                <dt className="text-neutral-500">件名</dt>
                <dd className="text-neutral-800">{selectedInquiry.subject}</dd>
                <dt className="text-neutral-500">本文</dt>
                <dd className="col-span-2 whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-neutral-800">
                  {selectedInquiry.body}
                </dd>
              </dl>
              <form onSubmit={handleReplySubmit} className="space-y-4 border-t border-neutral-200 pt-4">
                <h4 className="text-sm font-semibold text-neutral-700">返信</h4>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">件名</label>
                  <input
                    type="text"
                    value={replyForm.subject}
                    onChange={(e) => setReplyForm((f) => ({ ...f, subject: e.target.value }))}
                    required
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">本文</label>
                  <textarea
                    value={replyForm.body}
                    onChange={(e) => setReplyForm((f) => ({ ...f, body: e.target.value }))}
                    required
                    rows={6}
                    placeholder="返信内容を入力してください"
                    className="w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {sendingReply ? "送信中..." : "返信を送信"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInquiry(null)}
                    className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    閉じる
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "videos" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">動画管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingVideo(true);
                setEditingVideo(null);
                setVideoForm({
                  title: "",
                  description: "",
                  youtube_url: "",
                  external_watch_url: "",
                  thumbnail_url: "",
                  program_id: "",
                  visibility: "free",
                  content_tier: "basic",
                  is_published: true,
                });
                setPendingVideoThumbnailFile(null);
                setVideoKeywordTags([]);
                setVideoBadgeSelect("");
                setVideoBadgeNewLabel("");
                setVideoBadgeBg("#f59e0b");
                setVideoBadgeText("#ffffff");
                setVideoSlideIds([]);
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規動画
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            動画をシリーズに紐づけて管理します。関連スライドは複数選択できます。
          </p>

          {loadingVideos ? (
            <p className="text-sm text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">タイトル</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">シリーズ</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">公開</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">階層</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">関連</th>
                    <th className="w-28 px-4 py-3 font-medium text-neutral-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr key={v.id} className="border-b border-neutral-100 last:border-0">
                      <td className="max-w-[280px] truncate px-4 py-3 text-neutral-800" title={v.title}>
                        <a
                          href={
                            v.youtube_url?.trim()
                              ? v.youtube_url
                              : v.external_watch_url?.trim() || `/video/${encodeURIComponent(v.id)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {v.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {programs.find((p) => String(p.id) === String(v.program_id))?.name ?? String(v.program_id)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{v.is_published ? "公開" : "下書き"}</td>
                      <td className="px-4 py-3 text-neutral-600">{CONTENT_TIER_LABELS[v.content_tier] ?? v.content_tier}</td>
                      <td className="px-4 py-3 text-neutral-600">{v.slide_ids?.length ?? 0}件</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditVideo(v)}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVideo(v.id)}
                            className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {creatingVideo && (
            <form onSubmit={handleCreateVideo} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">新規動画</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">タイトル *</label>
                <input
                  type="text"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">キャプション（概要）</label>
                <textarea
                  value={videoForm.description}
                  onChange={(e) => setVideoForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="動画棚のホバー時に表示する説明文"
                  className="w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">YouTube の動画URL（任意）</label>
                <p className="mb-1 text-[11px] text-neutral-500">
                  東大 OCW など YouTube にない場合は空にし、下の「外部視聴URL」に公式ページを入力してください。どちらか一方（または両方）があれば登録できます。
                </p>
                <input
                  type="url"
                  value={videoForm.youtube_url}
                  onChange={(e) => setVideoForm((f) => ({ ...f, youtube_url: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">外部視聴URL（任意）</label>
                <input
                  type="url"
                  value={videoForm.external_watch_url}
                  onChange={(e) => setVideoForm((f) => ({ ...f, external_watch_url: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  placeholder="https://ocw.u-tokyo.ac.jp/... など"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">サムネイル画像（任意）</label>
                <p className="mb-1 text-[11px] text-neutral-500">
                  未指定時は YouTube の既定サムネイルです。URL 入力・ファイル選択・ドラッグ＆ドロップ・枠をクリック後の貼り付け（⌘V / Ctrl+V）で指定できます（作成後にアップロードされるファイルもここで選べます）。
                </p>
                <input
                  type="url"
                  value={videoForm.thumbnail_url}
                  onChange={(e) => setVideoForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  className="mb-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  placeholder="https://... （外部に置いた画像のURL）"
                />
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="作成後アップロードするサムネイル画像"
                  className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-3 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = firstImageFileFromDataTransfer(e.dataTransfer);
                    if (!file) {
                      alert("JPEG / PNG / WebP / GIF の画像ファイルをドロップしてください");
                      return;
                    }
                    setPendingVideoThumbnailFile(file);
                  }}
                  onPaste={(e) => {
                    const file = firstImageFileFromDataTransfer(e.clipboardData);
                    if (!file) return;
                    e.preventDefault();
                    setPendingVideoThumbnailFile(file);
                  }}
                >
                  <p className="mb-2 text-[11px] text-neutral-600">
                    作成後にアップロードする画像を、ドラッグ＆ドロップまたは貼り付けで指定できます。
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-xs text-neutral-700"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setPendingVideoThumbnailFile(f ?? null);
                    }}
                  />
                  {pendingVideoThumbnailFile && (
                    <p className="mt-1 text-[11px] text-neutral-600">選択中: {pendingVideoThumbnailFile.name}（作成後にアップロードされます）</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">キーワードタグ</label>
                <KeywordTagInput
                  tags={videoKeywordTags}
                  onChange={setVideoKeywordTags}
                  placeholder="タグを入力してEnter/カンマで追加"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">シリーズ *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={videoForm.program_id}
                    onChange={(e) => handleProgramChangedForVideo(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    required
                  >
                    <option value="">選択してください</option>
                    {programs.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCreatingQuickProgram(true)}
                    className="shrink-0 rounded border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    ＋新規シリーズ追加
                  </button>
                </div>
              </div>
              <div className="space-y-2 rounded border border-neutral-200 bg-white p-3">
                <label className="block text-xs font-medium text-neutral-700">動画バッジ（任意）</label>
                <select
                  value={videoBadgeSelect}
                  onChange={(e) => setVideoBadgeSelect(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="">未設定（非表示）</option>
                  {videoBadgeOptions.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                  <option value="__new__">＋新規作成</option>
                </select>
                {videoBadgeSelect === "__new__" && (
                  <input
                    type="text"
                    value={videoBadgeNewLabel}
                    onChange={(e) => setVideoBadgeNewLabel(e.target.value)}
                    placeholder="新しいバッジ名"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-neutral-600">
                    背景色
                    <input type="color" value={videoBadgeBg} onChange={(e) => setVideoBadgeBg(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                  </label>
                  <label className="text-[11px] text-neutral-600">
                    文字色
                    <input type="color" value={videoBadgeText} onChange={(e) => setVideoBadgeText(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                  </label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">公開レベル</label>
                  <select
                    value={videoForm.visibility}
                    onChange={(e) => setVideoForm((f) => ({ ...f, visibility: e.target.value as SlideVisibility }))}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  >
                    {(Object.keys(VISIBILITY_LABELS) as SlideVisibility[]).map((v) => (
                      <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">コンテンツ階層</label>
                  <select
                    value={videoForm.content_tier}
                    onChange={(e) => setVideoForm((f) => ({ ...f, content_tier: e.target.value as ContentTier }))}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                  >
                    {(Object.keys(CONTENT_TIER_LABELS) as ContentTier[]).map((v) => (
                      <option key={v} value={v}>{CONTENT_TIER_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-600">関連スライド（複数選択）</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                  {slides.map((s) => {
                    const numericId = Number(s.id);
                    const checked = videoSlideIds.includes(numericId);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (!Number.isFinite(numericId)) return;
                            if (e.target.checked) {
                              setVideoSlideIds((prev) => [...prev, numericId]);
                            } else {
                              setVideoSlideIds((prev) => prev.filter((id) => id !== numericId));
                            }
                          }}
                        />
                        <span className="truncate">{s.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="video_is_published"
                  type="checkbox"
                  checked={videoForm.is_published}
                  onChange={(e) => setVideoForm((f) => ({ ...f, is_published: e.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="video_is_published" className="text-xs font-medium text-neutral-600">公開する</label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingVideo}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {savingVideo ? "作成中..." : "作成"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingVideo(false)}
                  className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {creatingQuickProgram && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => !savingQuickProgram && setCreatingQuickProgram(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-program-title"
            >
              <div
                className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="quick-program-title" className="mb-4 text-lg font-semibold text-neutral-800">
                  新規シリーズを追加
                </h3>
                <form onSubmit={handleCreateQuickProgram} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">シリーズ名 *</label>
                    <input
                      type="text"
                      value={quickProgramName}
                      onChange={(e) => setQuickProgramName(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                      placeholder="例: 講演"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-600">slug（任意）</label>
                    <input
                      type="text"
                      value={quickProgramSlug}
                      onChange={(e) => setQuickProgramSlug(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                      placeholder="例: kouen"
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    追加後、この動画フォームのシリーズに自動選択されます。
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatingQuickProgram(false)}
                      className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                      disabled={savingQuickProgram}
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={savingQuickProgram}
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {savingQuickProgram ? "追加中..." : "追加"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingVideo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => !savingVideo && setEditingVideo(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="video-edit-title"
            >
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h3 id="video-edit-title" className="mb-4 text-lg font-semibold text-neutral-800">動画を編集</h3>
                <form onSubmit={handleUpdateVideo} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">タイトル *</label>
                    <input type="text" value={videoEditForm.title} onChange={(e) => setVideoEditForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">キャプション（概要）</label>
                    <textarea value={videoEditForm.description} onChange={(e) => setVideoEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full resize-y rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">YouTube の動画URL（任意）</label>
                    <p className="mb-1 text-[11px] text-neutral-500">
                      外部のみの場合は空にし、「外部視聴URL」を入力してください。
                    </p>
                    <input
                      type="url"
                      value={videoEditForm.youtube_url}
                      onChange={(e) => setVideoEditForm((f) => ({ ...f, youtube_url: e.target.value }))}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">外部視聴URL（任意）</label>
                    <input
                      type="url"
                      value={videoEditForm.external_watch_url}
                      onChange={(e) => setVideoEditForm((f) => ({ ...f, external_watch_url: e.target.value }))}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                      placeholder="https://ocw.u-tokyo.ac.jp/... など"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">サムネイル画像</label>
                    <p className="mb-1 text-[11px] text-neutral-500">
                      一覧・棚に表示される画像です。URL の直接入力、ファイル選択、ドラッグ＆ドロップ、または枠内をクリックしてから貼り付け（⌘V / Ctrl+V）も使えます。YouTube 既定に戻すこともできます。
                    </p>
                    <div
                      role="group"
                      tabIndex={0}
                      aria-label="サムネイル画像をドロップまたは貼り付け"
                      className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-3 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = firstImageFileFromDataTransfer(e.dataTransfer);
                        if (!file) {
                          alert("JPEG / PNG / WebP / GIF の画像ファイルをドロップしてください");
                          return;
                        }
                        if (!editingVideo) return;
                        await uploadVideoThumbnailFile(editingVideo.id, file);
                      }}
                      onPaste={async (e) => {
                        const file = firstImageFileFromDataTransfer(e.clipboardData);
                        if (!file || !editingVideo) return;
                        e.preventDefault();
                        await uploadVideoThumbnailFile(editingVideo.id, file);
                      }}
                    >
                      <p className="mb-2 text-[11px] text-neutral-600">
                        ここに画像をドラッグするか、枠をクリックしてフォーカスしてから貼り付け（コピーした画像を ⌘V / Ctrl+V）。
                      </p>
                      {videoEditForm.thumbnail_url ? (
                        <div className="mb-2 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                          <img
                            src={videoEditForm.thumbnail_url}
                            alt=""
                            className="mx-auto max-h-36 w-auto object-contain"
                          />
                        </div>
                      ) : null}
                      <input
                        type="url"
                        value={videoEditForm.thumbnail_url}
                        onChange={(e) => setVideoEditForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                        className="mb-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                        placeholder="画像URL（https://...）"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={videoThumbUploading}
                          className="text-xs text-neutral-700"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file || !editingVideo) return;
                            await uploadVideoThumbnailFile(editingVideo.id, file);
                          }}
                        />
                        {videoThumbUploading && <span className="text-xs text-neutral-500">アップロード中...</span>}
                        {editingVideo?.youtube_video_id && (
                          <button
                            type="button"
                            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                            disabled={videoThumbUploading}
                            onClick={async () => {
                              if (!editingVideo?.youtube_video_id) return;
                              const yt = editingVideo.youtube_video_id;
                              const thumb = `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
                              setVideoThumbUploading(true);
                              try {
                                const res = await fetch(`/api/admin/videos/${encodeURIComponent(editingVideo.id)}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ thumbnail_url: thumb }),
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  alert(json.error ?? "更新に失敗しました");
                                  return;
                                }
                                setVideoEditForm((f) => ({ ...f, thumbnail_url: thumb }));
                                setEditingVideo((v) => (v ? { ...v, thumbnail_url: thumb } : null));
                                await loadVideos();
                              } finally {
                                setVideoThumbUploading(false);
                              }
                            }}
                          >
                            YouTube のサムネに戻す
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">キーワードタグ</label>
                    <KeywordTagInput tags={videoEditKeywordTags} onChange={setVideoEditKeywordTags} placeholder="タグを入力してEnter/カンマで追加" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">シリーズ *</label>
                      <select value={videoEditForm.program_id} onChange={(e) => handleProgramChangedForVideoEdit(e.target.value)} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900" required>
                        <option value="">選択してください</option>
                        {programs.map((p) => (<option key={String(p.id)} value={String(p.id)}>{p.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">公開レベル</label>
                      <select value={videoEditForm.visibility} onChange={(e) => setVideoEditForm((f) => ({ ...f, visibility: e.target.value as SlideVisibility }))} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900">
                        {(Object.keys(VISIBILITY_LABELS) as SlideVisibility[]).map((v) => (<option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3">
                    <label className="block text-xs font-medium text-neutral-700">動画バッジ（任意）</label>
                    <select
                      value={videoEditBadgeSelect}
                      onChange={(e) => setVideoEditBadgeSelect(e.target.value)}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                    >
                      <option value="">未設定（非表示）</option>
                      {videoBadgeOptions.map((label) => (
                        <option key={`edit-video-${label}`} value={label}>{label}</option>
                      ))}
                      <option value="__new__">＋新規作成</option>
                    </select>
                    {videoEditBadgeSelect === "__new__" && (
                      <input
                        type="text"
                        value={videoEditBadgeNewLabel}
                        onChange={(e) => setVideoEditBadgeNewLabel(e.target.value)}
                        placeholder="新しいバッジ名"
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-neutral-600">
                        背景色
                        <input type="color" value={videoEditBadgeBg} onChange={(e) => setVideoEditBadgeBg(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                      </label>
                      <label className="text-[11px] text-neutral-600">
                        文字色
                        <input type="color" value={videoEditBadgeText} onChange={(e) => setVideoEditBadgeText(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">コンテンツ階層</label>
                    <select value={videoEditForm.content_tier} onChange={(e) => setVideoEditForm((f) => ({ ...f, content_tier: e.target.value as ContentTier }))} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900">
                      {(Object.keys(CONTENT_TIER_LABELS) as ContentTier[]).map((v) => (<option key={v} value={v}>{CONTENT_TIER_LABELS[v]}</option>))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-neutral-600">関連スライド（複数選択）</p>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-neutral-300 bg-white p-2">
                      {slides.map((s) => {
                        const numericId = Number(s.id);
                        const checked = videoEditSlideIds.includes(numericId);
                        return (
                          <label key={`edit-${s.id}`} className="flex items-center gap-2 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (!Number.isFinite(numericId)) return;
                                if (e.target.checked) setVideoEditSlideIds((prev) => [...prev, numericId]);
                                else setVideoEditSlideIds((prev) => prev.filter((id) => id !== numericId));
                              }}
                            />
                            <span className="truncate">{s.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="video_edit_is_published" type="checkbox" checked={videoEditForm.is_published} onChange={(e) => setVideoEditForm((f) => ({ ...f, is_published: e.target.checked }))} className="h-4 w-4 rounded border-neutral-300" />
                    <label htmlFor="video_edit_is_published" className="text-xs font-medium text-neutral-600">公開する</label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingVideo(null)} className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50" disabled={savingVideo}>キャンセル</button>
                    <button type="submit" disabled={savingVideo} className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">{savingVideo ? "保存中..." : "保存"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* 新規スライド作成（完全自動） */}
        <section className={`mb-12 rounded-lg border border-neutral-200 bg-white p-6 ${adminView === "slides" ? "" : "hidden"}`}>
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">
            新規スライド作成
          </h2>
          <p className="mb-6 text-sm text-neutral-600">
            PDFをアップロードするだけで、画像変換・Storage保存・DB登録まで自動で完了します。
          </p>

          <form id="create-slide-form" onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                PDFファイル *
              </label>
              <input
                type="file"
                name="pdf"
                accept=".pdf,application/pdf"
                required
                onChange={(e) => setSelectedPdfName(e.target.files?.[0]?.name ?? "")}
                className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:text-white file:hover:bg-neutral-800"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsPdfDragOver(true);
                }}
                onDragLeave={() => setIsPdfDragOver(false)}
                onDrop={handlePdfDrop}
                onPaste={handlePdfPaste}
                tabIndex={0}
                className="mt-2 rounded-lg border border-dashed px-3 py-3 text-xs outline-none"
                style={{
                  borderColor: isPdfDragOver ? "var(--accent)" : "var(--border)",
                  background: isPdfDragOver ? "color-mix(in srgb, var(--accent) 8%, white)" : "transparent",
                  color: "var(--fg-muted)",
                }}
              >
                PDFをここにドラッグ&ドロップ、または貼り付け（Ctrl/Cmd + V）できます。
                {selectedPdfName && (
                  <div className="mt-1 text-[11px]" style={{ color: "var(--fg)" }}>
                    選択中: {selectedPdfName}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                タイトル *
              </label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                placeholder="例: GREEN 知られざる顔一 (バナナ)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                ジャンル *
              </label>
              <select
                value={createForm.program_id}
                onChange={(e) => handleProgramChangedForSlide(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              >
                <option value="">選択してください</option>
                {programs.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.name}
                    {p.genre_type ? `（${genreTypes.find((g) => g.id === p.genre_type)?.name ?? p.genre_type}）` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
              <label className="block text-sm font-medium text-neutral-700">スライドバッジ（任意）</label>
              <select
                value={slideBadgeSelect}
                onChange={(e) => setSlideBadgeSelect(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              >
                <option value="">未設定（非表示）</option>
                {slideBadgeOptions.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
                <option value="__new__">＋新規作成</option>
              </select>
              {slideBadgeSelect === "__new__" && (
                <input
                  type="text"
                  value={slideBadgeNewLabel}
                  onChange={(e) => setSlideBadgeNewLabel(e.target.value)}
                  placeholder="新しいバッジ名"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-neutral-600">
                  背景色
                  <input type="color" value={slideBadgeBg} onChange={(e) => setSlideBadgeBg(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                </label>
                <label className="text-xs text-neutral-600">
                  文字色
                  <input type="color" value={slideBadgeText} onChange={(e) => setSlideBadgeText(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                年（任意）
              </label>
              <input
                type="number"
                value={createForm.year}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, year: e.target.value }))
                }
                placeholder="例: 2015"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                サムネイルに使うページ
              </label>
              <p className="mb-2 text-xs text-neutral-500">
                PDFの何ページ目を一覧・棚のサムネイルにするか（1＝1ページ目）。アップロード後に編集から変更もできます。
              </p>
              <input
                type="number"
                min={1}
                value={createForm.thumbnail_page}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, thumbnail_page: e.target.value }))
                }
                className="w-full max-w-[12rem] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                公開レベル
              </label>
              <select
                value={createForm.visibility}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, visibility: e.target.value as SlideVisibility }))
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              >
                {(Object.keys(VISIBILITY_LABELS) as SlideVisibility[]).map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                コンテンツ階層
              </label>
              <select
                value={createForm.content_tier}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, content_tier: e.target.value as ContentTier }))
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              >
                {(Object.keys(CONTENT_TIER_LABELS) as ContentTier[]).map((t) => (
                  <option key={t} value={t}>{CONTENT_TIER_LABELS[t]}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                BASIC=サブスクでフル閲覧、PRO=レンタル/購入、ADVANCE=一括閲覧
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                キャプション（任意）
              </label>
              <p className="mb-2 text-xs text-neutral-500">
                シリーズ棚のホバー時に表示。PDFから自動作成可能。
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createForm.caption}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, caption: e.target.value }))
                  }
                  placeholder="例: オレンジの断面と果汁の関係を探る"
                  className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
                <button
                  type="button"
                  onClick={handleExtractCaption}
                  disabled={extractingCaption}
                  className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {extractingCaption ? "生成中..." : "自動作成"}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                キーワードタグ（任意）
              </label>
              <p className="mb-2 text-xs text-neutral-500">
                「キーワードを自動抽出」でPDFからAIが抽出。入力してカンマまたはEnterでタグ追加。タグをクリックで編集、×で削除。
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <KeywordTagInput
                      tags={keywordTags}
                      onChange={setKeywordTags}
                      disabled={extractingKeywords}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExtractKeywords}
                    disabled={extractingKeywords}
                    className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {extractingKeywords ? "抽出中..." : "キーワードを自動抽出"}
                  </button>
                </div>
                {keywordTags.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    {keywordTags.length}個のタグ
                  </p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {creating ? "作成中..." : "作成"}
            </button>
          </form>
        </section>

        <section className={adminView === "slides" ? "" : "hidden"}>
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">
            既存スライドの PDF → 画像変換
          </h2>
          <p className="mb-6 text-sm text-neutral-600">
            pdf_url が登録されているスライドを、画像ベース表示用に変換します。
            変換後は詳細ページで画像ビューワーが表示されます。
          </p>

          {loading ? (
            <p className="text-neutral-500">読み込み中...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">
                      タイトル
                    </th>
                    <th className="px-4 py-3 font-medium text-neutral-700">
                      公開レベル
                    </th>
                    <th className="px-4 py-3 font-medium text-neutral-700">
                      コンテンツ階層
                    </th>
                    <th className="px-4 py-3 font-medium text-neutral-700">
                      状態
                    </th>
                    <th className="px-4 py-3 font-medium text-neutral-700">
                      操作
                    </th>
                    <th className="w-32 px-4 py-3 font-medium text-neutral-700">
                      編集 / 削除
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slides.map((slide) => (
                    <tr
                      key={slide.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/slide/${slide.id}`}
                          className="text-neutral-900 hover:underline"
                        >
                          {slide.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                            slide.visibility === "free"
                              ? "bg-green-100 text-green-800"
                              : slide.visibility === "invite_only"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {VISIBILITY_SHORT[(slide.visibility as SlideVisibility) || "private"]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {CONTENT_TIER_LABELS[(slide.content_tier as ContentTier) || "basic"]}
                      </td>
                      <td className="px-4 py-3">
                        {slide.page_image_urls?.length ? (
                          <span className="text-green-600">
                            画像済み（{slide.page_count}ページ）
                          </span>
                        ) : slide.pdf_url ? (
                          <span className="text-amber-600">PDFのみ</span>
                        ) : (
                          <span className="text-neutral-400">未登録</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {slide.pdf_url && (
                          <button
                            type="button"
                            onClick={() => handleConvert(slide.id)}
                            disabled={
                              convertingId === slide.id || !!slide.page_image_urls?.length
                            }
                            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
                          >
                            {convertingId === slide.id
                              ? "変換中..."
                              : slide.page_image_urls?.length
                                ? "済"
                                : "画像に変換"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(slide)}
                            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(slide.id)}
                            disabled={deletingId === slide.id}
                            className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === slide.id ? "削除中..." : "削除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 編集モーダル */}
        {editingSlide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !saving && setEditingSlide(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="edit-modal-title" className="mb-4 text-lg font-semibold text-neutral-800">
                スライドを編集
              </h2>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    ジャンル（紐づけるシリーズ）
                  </label>
                  <select
                    value={editForm.program_id}
                    onChange={(e) => handleProgramChangedForSlideEdit(e.target.value)}
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    <option value="">選択してください</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.genre_type ? `（${genreTypes.find((g) => g.id === p.genre_type)?.name ?? p.genre_type}）` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <label className="block text-sm font-medium text-neutral-700">スライドバッジ（任意）</label>
                  <select
                    value={slideEditBadgeSelect}
                    onChange={(e) => setSlideEditBadgeSelect(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    <option value="">未設定（非表示）</option>
                    {slideBadgeOptions.map((label) => (
                      <option key={`edit-slide-${label}`} value={label}>{label}</option>
                    ))}
                    <option value="__new__">＋新規作成</option>
                  </select>
                  {slideEditBadgeSelect === "__new__" && (
                    <input
                      type="text"
                      value={slideEditBadgeNewLabel}
                      onChange={(e) => setSlideEditBadgeNewLabel(e.target.value)}
                      placeholder="新しいバッジ名"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-neutral-600">
                      背景色
                      <input type="color" value={slideEditBadgeBg} onChange={(e) => setSlideEditBadgeBg(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                    <label className="text-xs text-neutral-600">
                      文字色
                      <input type="color" value={slideEditBadgeText} onChange={(e) => setSlideEditBadgeText(e.target.value)} className="mt-1 h-9 w-full rounded border border-neutral-300 p-1" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    年
                  </label>
                  <input
                    type="number"
                    value={editForm.year}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, year: e.target.value }))
                    }
                    placeholder="例: 2015"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    公開レベル
                  </label>
                  <select
                    value={editForm.visibility}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, visibility: e.target.value as SlideVisibility }))
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    {(Object.keys(VISIBILITY_LABELS) as SlideVisibility[]).map((v) => (
                      <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    コンテンツ階層
                  </label>
                  <select
                    value={editForm.content_tier}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, content_tier: e.target.value as ContentTier }))
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    {(Object.keys(CONTENT_TIER_LABELS) as ContentTier[]).map((t) => (
                      <option key={t} value={t}>{CONTENT_TIER_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                {editingSlide.page_image_urls && editingSlide.page_image_urls.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">
                      サムネイルに使うページ
                    </label>
                    <p className="mb-2 text-xs text-neutral-500">
                      全{editingSlide.page_image_urls.length}ページ中、何ページ目をサムネイルにするか（1＝1ページ目）。
                    </p>
                    <input
                      type="number"
                      min={1}
                      max={editingSlide.page_image_urls.length}
                      value={editForm.thumbnail_page}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, thumbnail_page: e.target.value }))
                      }
                      className="w-full max-w-[12rem] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    サムネイル画像（ファイルアップロード）
                  </label>
                  <p className="mb-2 text-xs text-neutral-500">
                    一覧・棚に表示する画像だけを差し替えます（PDF のページ指定より優先）。JPEG / PNG / WebP / GIF、最大5MB。ドラッグ＆ドロップ・貼り付け（枠をクリック後 ⌘V / Ctrl+V）にも対応しています。
                  </p>
                  <div
                    role="group"
                    tabIndex={0}
                    aria-label="スライドサムネイルをドロップまたは貼り付け"
                    className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-3 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = firstImageFileFromDataTransfer(e.dataTransfer);
                      if (!file) {
                        alert("JPEG / PNG / WebP / GIF の画像ファイルをドロップしてください");
                        return;
                      }
                      if (!editingSlide) return;
                      await uploadSlideThumbnailForEdit(editingSlide.id, file);
                    }}
                    onPaste={async (e) => {
                      const file = firstImageFileFromDataTransfer(e.clipboardData);
                      if (!file || !editingSlide) return;
                      e.preventDefault();
                      await uploadSlideThumbnailForEdit(editingSlide.id, file);
                    }}
                  >
                    <p className="mb-2 text-[11px] text-neutral-600">
                      ここに画像をドラッグするか、枠をクリックしてから貼り付け。
                    </p>
                    {editingSlide.image_url ? (
                      <div className="mb-2 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editingSlide.image_url}
                          alt=""
                          className="mx-auto max-h-32 w-auto object-contain"
                        />
                      </div>
                    ) : null}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={slideEditThumbUploading || saving}
                      className="text-xs text-neutral-700"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file || !editingSlide) return;
                        await uploadSlideThumbnailForEdit(editingSlide.id, file);
                      }}
                    />
                    {slideEditThumbUploading ? (
                      <span className="ml-2 text-xs text-neutral-500">アップロード中...</span>
                    ) : null}
                    {editingSlide.page_image_urls && editingSlide.page_image_urls.length > 0 && slideHasCustomThumbnail(editingSlide) ? (
                      <button
                        type="button"
                        disabled={saving || slideEditThumbUploading}
                        onClick={() => void revertSlideThumbnailToPage()}
                        className="mt-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        PDFのページ画像に戻す（上の「サムネイルに使うページ」）
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    キャプション
                  </label>
                  <input
                    type="text"
                    value={editForm.caption}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, caption: e.target.value }))
                    }
                    placeholder="シリーズ棚ホバー時に表示"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    キーワードタグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={editForm.keyword_tags}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, keyword_tags: e.target.value }))
                    }
                    placeholder="タウリン, 元気, 栄養ドリンク"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlide(null)}
                    disabled={saving}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
