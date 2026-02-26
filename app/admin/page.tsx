"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { KeywordTagInput } from "@/components/KeywordTagInput";

type SlideVisibility = "free" | "invite_only" | "private";

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

interface SlideRow {
  id: string;
  title: string;
  program_id: string;
  pdf_url: string | null;
  page_count: number | null;
  page_image_urls: string[] | null;
  year: number | null;
  keyword_tags: string[];
  caption: string | null;
  visibility?: SlideVisibility;
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
  genre_type: string | null;
  show_on_front?: boolean;
}

export default function AdminPage() {
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
  });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extractingKeywords, setExtractingKeywords] = useState(false);
  const [extractingCaption, setExtractingCaption] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    program_id: "",
    year: "",
    caption: "",
    visibility: "free" as SlideVisibility,
  });
  const [keywordTags, setKeywordTags] = useState<string[]>([]);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [programForm, setProgramForm] = useState({
    name: "",
    slug: "",
    genre_type: "program",
    description: "",
    started_year: "",
    show_on_front: true,
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
  }>>([]);
  const [loadingInviteCodes, setLoadingInviteCodes] = useState(false);
  const [creatingInviteCode, setCreatingInviteCode] = useState(false);
  const [inviteCodeForm, setInviteCodeForm] = useState({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [] as string[] });
  const [editingInviteCode, setEditingInviteCode] = useState<typeof inviteCodes[0] | null>(null);
  const [inviteCodeEditForm, setInviteCodeEditForm] = useState({ name: "", description: "", default_expires_at: "", slide_ids: [] as string[] });
  const [savingInviteCode, setSavingInviteCode] = useState(false);
  const [applyingExpiryId, setApplyingExpiryId] = useState<string | null>(null);

  const [siteSettingsSubtitle, setSiteSettingsSubtitle] = useState("");
  const [siteSettingsFooterText, setSiteSettingsFooterText] = useState("");
  const [heroMode, setHeroMode] = useState<"random" | "selected">("random");
  const [heroSlideCount, setHeroSlideCount] = useState(5);
  const [heroSlideIds, setHeroSlideIds] = useState<string[]>([]);
  const [savingSiteSettings, setSavingSiteSettings] = useState(false);

  useEffect(() => {
    loadSlides();
    loadPrograms();
    loadGenreTypes();
    loadInviteCodes();
    loadSiteSettings();
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
      .select("id, name, slug, description, started_year, genre_type, show_on_front")
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
        show_on_front: programForm.show_on_front,
      });
      if (error) throw error;
      setCreatingProgram(false);
      setProgramForm({ name: "", slug: "", genre_type: genreTypes[0]?.id ?? "program", description: "", started_year: "", show_on_front: true });
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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "作成失敗");
      setCreatingInviteCode(false);
      setInviteCodeForm({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [] });
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
    if (!confirm("この招待コードを削除しますか？紐づくスライドの設定も消えます。")) return;
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
          show_on_front: programForm.show_on_front,
        })
        .eq("id", editingProgram.id);
      if (error) throw error;
      setEditingProgram(null);
      setProgramForm({ name: "", slug: "", genre_type: genreTypes[0]?.id ?? "program", description: "", started_year: "", show_on_front: true });
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
      .select("id, title, program_id, pdf_url, page_count, page_image_urls, year, keyword_tags, caption, visibility")
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

      const res = await fetch("/api/slides/create", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        alert(`作成失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }

      alert(`作成完了: ${json.pageCount}ページ`);
      setCreateForm({ title: "", program_id: "", year: "", caption: "", visibility: "free" });
      setKeywordTags([]);
      fileInput.value = "";
      loadSlides();
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
    const fourMB = 4 * 1024 * 1024;
    if (file.size > fourMB) {
      if (!confirm(`PDFが約4MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）。本番では約4.5MBの制限で失敗することがあります。続行しますか？`)) {
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
            message: "本番環境ではリクエストサイズの制限（約4.5MB）があります。PDFを小さくするか、キャプションを手動で入力してください。",
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
    const tags = slide.keyword_tags ?? [];
    setEditForm({
      title: slide.title,
      program_id: slide.program_id ?? "",
      year: slide.year?.toString() ?? "",
      keyword_tags: Array.isArray(tags) ? tags.join(", ") : "",
      caption: slide.caption ?? "",
      visibility: (slide.visibility as SlideVisibility) || "private",
    });
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
      const res = await fetch(`/api/slides/${editingSlide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          program_id: editForm.program_id || null,
          year: editForm.year ? Number(editForm.year) : null,
          keyword_tags: tags,
          caption: editForm.caption.trim() || null,
          visibility: editForm.visibility,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`更新失敗: ${json.error}\n${json.details ?? ""}`);
        return;
      }
      setEditingSlide(null);
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
                href="/admin/guide"
                className="shrink-0 text-sm hover:opacity-80"
                style={{ color: "var(--fg-muted)" }}
              >
                使い方ガイド
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
        {/* サイト設定（サブタイトル・フッター文言） */}
        <section className="mb-12 rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">サイト設定</h2>
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
        <section className="mb-12 rounded-lg border border-neutral-200 bg-white p-6">
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
        <section className="mb-12 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">ジャンル管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingProgram(true);
                setEditingProgram(null);
                setProgramForm({ name: "", slug: "", genre_type: genreTypes[0]?.id ?? "program", description: "", started_year: "", show_on_front: true });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規ジャンル追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            プログラム（ROCKET ABL 等）、組織（SPACE・EARTH 等）、自治体（鎌倉市等）を登録できます。スライド作成時に選択します。
          </p>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-neutral-700">名前</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">slug</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">種別</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">開始年</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">シリーズ表示</th>
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
                            show_on_front: p.show_on_front !== false,
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
                  フロントのシリーズ棚に表示する
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
                    setProgramForm({ name: "", slug: "", genre_type: genreTypes[0]?.id ?? "program", description: "", started_year: "", show_on_front: true });
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
                      フロントのシリーズ棚に表示する
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

        {/* 招待コード管理 */}
        <section className="mb-12 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">招待コード管理</h2>
            <button
              type="button"
              onClick={() => {
                setCreatingInviteCode(true);
                setInviteCodeForm({ code: "", name: "", description: "", default_expires_at: "", slide_ids: [] });
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              新規招待コード追加
            </button>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            招待コードごとに閲覧可能なスライドを紐づけます。ユーザーがコードを入力すると、紐づけたスライドのみ閲覧できます。
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
                    <label key={s.id} className="mb-1 flex cursor-pointer gap-2 text-sm">
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
                        <label key={s.id} className="mb-1 flex cursor-pointer gap-2 text-sm">
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

        {/* 新規スライド作成（完全自動） */}
        <section className="mb-12 rounded-lg border border-neutral-200 bg-white p-6">
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
                className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:text-white file:hover:bg-neutral-800"
              />
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
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, program_id: e.target.value }))
                }
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

        <section>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => !saving && setEditingSlide(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            <div
              className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
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
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, program_id: e.target.value }))
                    }
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
