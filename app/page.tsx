import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExpandedSlideProvider } from "@/components/ExpandedSlideContext";
import { HomeAnnouncementCards } from "@/components/HomeAnnouncementCards";
import { GuestBanner } from "@/components/GuestBanner";
import { HeroSlides, type HeroCarouselItem } from "@/components/HeroSlides";
import { parseHeroSettingEntry } from "@/lib/hero-carousel";
import { CuratedShelf, InviteSeriesShelf, MylistShelf, ProgramShelf, VideoSeriesShelf, type CuratedShelfItem, type VideoShelfItem } from "@/components/ProgramShelf";
import { SearchSection } from "@/components/SearchSection";
import { getAccessContext, filterVisibleSlides, canViewVideo } from "@/lib/access";
import type { Slide } from "@/lib/types";
import { extractYoutubeVideoId } from "@/lib/youtube";
import { isValidHttpUrl } from "@/lib/external-url";

type HomeVideoRow = {
  id: string;
  youtube_url: string | null;
  youtube_video_id?: string | null;
  external_watch_url?: string | null;
};

function curatedVideoHref(video: HomeVideoRow): { href: string; external: boolean } {
  const ytId =
    (video.youtube_url && extractYoutubeVideoId(video.youtube_url)) ||
    (video.youtube_video_id?.trim() ? video.youtube_video_id.trim() : null);
  const ext = video.external_watch_url?.trim() ?? "";
  if (ytId) return { href: `/video/${video.id}`, external: false };
  if (isValidHttpUrl(ext)) return { href: ext, external: true };
  return { href: `/video/${video.id}`, external: false };
}

function videoHeroThumbnailUrl(v: HomeVideoRow & { thumbnail_url?: string | null }): string | null {
  if (v.thumbnail_url?.trim()) return v.thumbnail_url.trim();
  const ytId =
    (v.youtube_url && extractYoutubeVideoId(v.youtube_url)) ||
    (v.youtube_video_id?.trim() ? v.youtube_video_id.trim() : null);
  if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  return null;
}

function videoToHeroItem(v: HomeVideoRow & { id: string; title: string }): HeroCarouselItem {
  const { href, external } = curatedVideoHref(v);
  return {
    kind: "video",
    id: String(v.id),
    title: v.title,
    thumbnailUrl: videoHeroThumbnailUrl(v),
    href,
    openInNewTab: external,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type HomeProps = { searchParams?: Promise<{ q?: string }> | { q?: string } };

/** ログイン直後も招待コードシリーズを表示するため、常に最新セッションで描画する */
export const dynamic = "force-dynamic";

export default async function Home(props: HomeProps) {
  const searchParams = await (typeof (props.searchParams as Promise<{ q?: string }>)?.then === "function"
    ? (props.searchParams as Promise<{ q?: string }>)
    : Promise.resolve(props.searchParams ?? {}));
  const initialQuery = typeof searchParams?.q === "string" ? searchParams.q : "";

  const supabase = await createClient();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  const DEFAULT_SUBTITLE = "いつでも、どこでも、学びのレシピ";

  const [
    { data: programs, error: programsError },
    { data: allSlides, error: slidesError },
    { data: allVideos, error: videosError },
    { data: frontShelfOrderData, error: frontShelfOrderError },
    { data: shelvesData, error: shelvesError },
    { data: shelfItemsData, error: shelfItemsError },
    { data: siteSettings },
    { data: homeAnnouncementsData },
  ] = await Promise.all([
    supabase
      .from("programs")
      .select("*")
      .order("started_year", { ascending: true, nullsFirst: false }),
    (accessCtx.isAdmin || accessCtx.isCoreStaff) && supabaseAdmin
      ? supabaseAdmin.from("slides").select("*")
      : supabase.from("slides").select("*"),
    (accessCtx.isAdmin || accessCtx.isCoreStaff) && supabaseAdmin
      ? supabaseAdmin.from("videos").select("*")
      : supabase.from("videos").select("*"),
    supabase
      .from("front_shelf_order")
      .select("shelf_type, ref_id, sort_order, is_enabled")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("shelves")
      .select("id, title, slug, description, sort_order, is_published")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("shelf_items")
      .select("id, shelf_id, content_type, content_id, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("site_settings").select("subtitle, hero_mode, hero_slide_count, hero_slide_ids").eq("id", "main").single(),
    supabase
      .from("announcements")
      .select("id, title, body, published_at")
      .eq("is_published", true)
      .eq("show_on_home", true)
      .order("home_sort_order", { ascending: true })
      .order("published_at", { ascending: false }),
  ]);

  const subtitle = typeof siteSettings?.subtitle === "string" ? siteSettings.subtitle : DEFAULT_SUBTITLE;
  const heroMode = siteSettings?.hero_mode === "selected" ? "selected" : "random";
  const heroSlideCount = typeof siteSettings?.hero_slide_count === "number" && siteSettings.hero_slide_count >= 1 && siteSettings.hero_slide_count <= 20
    ? siteSettings.hero_slide_count
    : 5;
  const heroSlideIdsRaw = siteSettings?.hero_slide_ids;
  const heroSlideIds = Array.isArray(heroSlideIdsRaw) ? heroSlideIdsRaw.filter((id: unknown) => typeof id === "string") : [];

  const homeAnnouncements = Array.isArray(homeAnnouncementsData)
    ? (homeAnnouncementsData as { id: string; title: string; body: string; published_at: string | null }[])
    : [];

  if (programsError) console.error("Programs fetch error:", programsError);
  if (slidesError) console.error("Slides fetch error:", slidesError);
  if (videosError) console.error("Videos fetch error:", videosError);
  if (frontShelfOrderError) console.error("Front shelf order fetch error:", frontShelfOrderError);
  if (shelvesError) console.error("Shelves fetch error:", shelvesError);
  if (shelfItemsError) console.error("Shelf items fetch error:", shelfItemsError);

  const allPrograms = programs ?? [];
  const programList = allPrograms.filter(
    (p: { show_on_front?: boolean }) => p.show_on_front !== false
  );
  const rawSlides = (allSlides ?? []) as Slide[];
  const slidesList = filterVisibleSlides(rawSlides, accessCtx);

  const slidesById = new Map(slidesList.map((s) => [String(s.id), s]));

  const slidesByProgram = new Map<string, Slide[]>();
  for (const slide of slidesList) {
    const list = slidesByProgram.get(slide.program_id) ?? [];
    list.push(slide);
    slidesByProgram.set(slide.program_id, list);
  }

  const rawVideos = (allVideos ?? []) as Array<{
    id: string;
    program_id: string | number;
    title: string;
    description?: string | null;
    keyword_tags?: string[] | null;
    youtube_url: string | null;
    youtube_video_id?: string | null;
    external_watch_url?: string | null;
    thumbnail_url: string | null;
    visibility?: "free" | "invite_only" | "private" | null;
    content_tier?: "basic" | "pro" | "advance" | null;
    is_published?: boolean | null;
  }>;

  const visibleVideos = rawVideos.filter((video) => canViewVideo(video, accessCtx));

  const heroCarouselItems: HeroCarouselItem[] = (() => {
    if (heroMode === "selected" && heroSlideIds.length > 0) {
      const out: HeroCarouselItem[] = [];
      const videoMap = new Map(visibleVideos.map((v) => [String(v.id), v]));
      for (const raw of heroSlideIds) {
        const parsed = parseHeroSettingEntry(raw);
        if (!parsed) continue;
        if (parsed.kind === "slide") {
          const slide = slidesById.get(parsed.id);
          if (slide) out.push({ kind: "slide", slide });
        } else {
          const v = videoMap.get(parsed.id);
          if (v) out.push(videoToHeroItem(v));
        }
      }
      return out;
    }
    const slideItems: HeroCarouselItem[] = slidesList.map((slide) => ({ kind: "slide" as const, slide }));
    const videoItems: HeroCarouselItem[] = visibleVideos.map((v) => videoToHeroItem(v));
    const pool = shuffle([...slideItems, ...videoItems]);
    return pool.slice(0, heroSlideCount);
  })();

  const videosByProgram = new Map<string, VideoShelfItem[]>();
  const visibleVideosById = new Map<string, (typeof rawVideos)[number]>();
  for (const video of visibleVideos) {
    const pid = String(video.program_id);
    visibleVideosById.set(String(video.id), video);
    const list = videosByProgram.get(pid) ?? [];
    list.push({
      id: String(video.id),
      program_id: pid,
      title: video.title,
      description: video.description ?? null,
      keyword_tags: Array.isArray(video.keyword_tags) ? video.keyword_tags : [],
      youtube_url: video.youtube_url ?? null,
      youtube_video_id: video.youtube_video_id ?? null,
      external_watch_url: video.external_watch_url ?? null,
      thumbnail_url: video.thumbnail_url ?? null,
    });
    videosByProgram.set(pid, list);
  }

  const shelfRows = (shelvesData ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    sort_order: number;
    is_published: boolean;
  }>;
  const shelfItemRows = (shelfItemsData ?? []) as Array<{
    id: string;
    shelf_id: string;
    content_type: "slide" | "video";
    content_id: string;
    sort_order: number;
  }>;
  const shelfItemsByShelf = new Map<string, typeof shelfItemRows>();
  for (const row of shelfItemRows) {
    const list = shelfItemsByShelf.get(row.shelf_id) ?? [];
    list.push(row);
    shelfItemsByShelf.set(row.shelf_id, list);
  }
  const curatedShelves = shelfRows
    .map((shelf) => {
      const items = (shelfItemsByShelf.get(shelf.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item): CuratedShelfItem | null => {
          if (item.content_type === "slide") {
            const slide = slidesById.get(String(item.content_id));
            if (!slide) return null;
            return {
              id: `${shelf.id}-slide-${slide.id}`,
              type: "slide",
              title: slide.title,
              href: `/slide/${slide.id}`,
              thumbnail_url: slide.image_url ?? slide.page_image_urls?.[0] ?? null,
              external: false,
            };
          }
          const video = visibleVideosById.get(String(item.content_id));
          if (!video) return null;
          const { href, external } = curatedVideoHref(video);
          return {
            id: `${shelf.id}-video-${video.id}`,
            type: "video",
            title: video.title,
            href,
            thumbnail_url: video.thumbnail_url ?? null,
            external,
          };
        })
        .filter(Boolean) as CuratedShelfItem[];
      return {
        id: shelf.id,
        title: shelf.title,
        description: shelf.description,
        items,
      };
    })
    .filter((s) => s.items.length > 0);

  type FrontShelfOrderRow = {
    shelf_type: "program_shelf" | "video_program_shelf" | "curated_shelf";
    ref_id: string;
    sort_order: number;
    is_enabled: boolean;
  };
  const orderRows = (frontShelfOrderData ?? []) as FrontShelfOrderRow[];
  const curatedById = new Map(curatedShelves.map((s) => [s.id, s]));
  const programById = new Map(programList.map((p) => [String(p.id), p]));
  const orderedFrontShelves = orderRows
    .map((row) => {
      if (row.shelf_type === "video_program_shelf") return { key: "video_program" as const, programId: String(row.ref_id) };
      if (row.shelf_type === "program_shelf") return { key: "program" as const, programId: String(row.ref_id) };
      const curated = curatedById.get(String(row.ref_id));
      if (!curated) return null;
      return { key: "curated" as const, curated };
    })
    .filter(Boolean) as Array<
      | { key: "video_program"; programId: string }
      | { key: "program"; programId: string }
      | { key: "curated"; curated: (typeof curatedShelves)[number] }
    >;

  const fallbackFrontShelves: typeof orderedFrontShelves = [];
  for (const program of programList) {
    fallbackFrontShelves.push({ key: "program", programId: String(program.id) });
    fallbackFrontShelves.push({ key: "video_program", programId: String(program.id) });
  }
  for (const curated of curatedShelves) {
    fallbackFrontShelves.push({ key: "curated", curated });
  }
  const frontShelvesToRender = orderedFrontShelves.length > 0 ? orderedFrontShelves : fallbackFrontShelves;

  /** マイリスト：ログイン中のユーザーが保存したスライド（表示可能なもののみ・登録順） */
  let mylistSlides: Slide[] = [];
  if (accessCtx.userId) {
    const { data: userSlideRows } = await supabase
      .from("user_slides")
      .select("slide_id, created_at")
      .eq("user_id", accessCtx.userId)
      .order("created_at", { ascending: false });
    const mylistIds = new Set((userSlideRows ?? []).map((r) => String(r.slide_id)));
    if (mylistIds.size > 0) {
      mylistSlides = slidesList.filter((s) => mylistIds.has(String(s.id)));
      const orderMap = new Map((userSlideRows ?? []).map((r, i) => [String(r.slide_id), i]));
      mylistSlides.sort((a, b) => (orderMap.get(String(a.id)) ?? 0) - (orderMap.get(String(b.id)) ?? 0));
    }
  }

  /** 招待コード1つを「1シリーズ」として一括表示する用（コード名・URL用code・そのコードで見れる全スライド） */
  type InviteSeries = { codeId: string; codeName: string; codeSlug: string; slides: Slide[] };
  let inviteCodeSeries: InviteSeries[] = [];
  if (accessCtx.userId && supabaseAdmin) {
    const now = new Date().toISOString();
    const { data: userCodes } = await supabase
      .from("user_invite_codes")
      .select("invite_code_id")
      .eq("user_id", accessCtx.userId)
      .gt("expires_at", now);
    const codeIds = [...new Set((userCodes ?? []).map((r) => r.invite_code_id))];
    if (codeIds.length > 0) {
      const [
        { data: codes },
        { data: codeSlides },
      ] = await Promise.all([
        supabaseAdmin.from("invite_codes").select("id, name, code").in("id", codeIds),
        supabaseAdmin.from("invite_code_slides").select("invite_code_id, slide_id").in("invite_code_id", codeIds),
      ]);
      const slideIdsByCode = new Map<string, Set<string>>();
      for (const row of codeSlides ?? []) {
        const set = slideIdsByCode.get(row.invite_code_id) ?? new Set();
        set.add(String(row.slide_id));
        slideIdsByCode.set(row.invite_code_id, set);
      }
      const byId = new Map((codes ?? []).map((c) => [c.id, c]));
      for (const codeId of codeIds) {
        const codeRow = byId.get(codeId);
        const codeName = codeRow?.name ?? codeRow?.code ?? codeId;
        const codeSlug = codeRow?.code ?? codeId;
        const ids = slideIdsByCode.get(codeId);
        if (!ids?.size) continue;
        const codeSlidesList = slidesList.filter((s) => ids.has(String(s.id)));
        if (codeSlidesList.length > 0) {
          inviteCodeSeries.push({ codeId, codeName, codeSlug, slides: codeSlidesList });
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col" style={{ background: "var(--bg)" }}>
      {/* 「SPACE ARCHIVE」ヘッダーはメインエリア幅いっぱいに表示（中途半端に切れないように） */}
      <header
        className="w-full shrink-0 border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="mx-auto max-w-4xl px-6 py-4">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--fg)" }}
          >
            SPACE ARCHIVE
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 min-w-0">
      <main className="px-6 py-6">
        <GuestBanner />
        <HomeAnnouncementCards
          items={homeAnnouncements.map((a) => ({
            id: a.id,
            title: a.title,
            published_at: a.published_at ?? null,
          }))}
        />
        {/* ヒーロースライド（main の px を打ち消して幅いっぱいに） */}
        <section className="-mx-6 mb-6">
          <HeroSlides items={heroCarouselItems} intervalMs={5500} />
        </section>

        {/* 検索セクション（ヘッダー検索から ?q= で来た場合は初期値＋自動検索） */}
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--fg)" }}>
            気になるキーワードでスライド検索
          </h2>
          <SearchSection initialQuery={initialQuery} />
        </section>

        {/* シリーズ棚（招待コードごと ＋ 全体） */}
        <ExpandedSlideProvider>
          <section className="mt-12">
            <h2 className="mb-6 text-lg font-semibold" style={{ color: "var(--fg)" }}>
              シリーズ
            </h2>

            {/* マイリスト（ログイン中かつ1件以上あるときのみ表示） */}
            {mylistSlides.length > 0 && (
              <MylistShelf slides={mylistSlides} programs={allPrograms} className="mb-8 md:mb-10" />
            )}

            {/* 招待コードで見れるシリーズ（1コード＝1シリーズに一括。ジャンル混ぜて表示。「すべて表示」で専用ページへ） */}
            {inviteCodeSeries.length > 0 && (
              <div id="invite-codes-series" className="mb-10 scroll-mt-24">
                <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
                  <Link href="/mypage/settings" className="hover:opacity-90">
                    マイページ（アカウント）から確認
                  </Link>
                  できます
                </p>
                {inviteCodeSeries.map(({ codeId, codeName, codeSlug, slides }) => (
                  <InviteSeriesShelf
                    key={codeId}
                    id={codeId}
                    codeName={codeName}
                    codeSlug={codeSlug}
                    slides={slides}
                    programs={allPrograms}
                  />
                ))}
              </div>
            )}

            {/* すべてのシリーズ（従来どおり） */}
            {inviteCodeSeries.length > 0 && (
              <h3 className="mb-4 text-base font-medium" style={{ color: "var(--fg-muted)" }}>
                すべてのシリーズ
              </h3>
            )}

            {frontShelvesToRender.length === 0 ? (
              <p className="py-8 text-center" style={{ color: "var(--fg-muted)" }}>
                プログラムデータがありません
              </p>
            ) : (
              frontShelvesToRender.map((row, idx) => {
                if (row.key === "curated") {
                  return (
                    <CuratedShelf
                      key={`curated-${row.curated.id}-${idx}`}
                      title={row.curated.title}
                      description={row.curated.description}
                      items={row.curated.items}
                    />
                  );
                }
                if (row.key === "video_program") {
                  const program = programById.get(row.programId);
                  if (!program) return null;
                  const videos = videosByProgram.get(row.programId) ?? [];
                  if (videos.length === 0) return null;
                  return (
                    <VideoSeriesShelf
                      key={`video-program-${row.programId}-${idx}`}
                      program={program}
                      videos={videos}
                    />
                  );
                }
                if (row.key === "program") {
                  const program = programById.get(row.programId);
                  if (!program) return null;
                  return (
                    <div
                      key={`program-${row.programId}-${idx}`}
                      id={`program-${program.id}`}
                      className="scroll-mt-24"
                    >
                      <ProgramShelf
                        program={program}
                        slides={slidesByProgram.get(program.id) ?? []}
                      />
                    </div>
                  );
                }
                return null;
              })
            )}
          </section>
        </ExpandedSlideProvider>
      </main>
      </div>
    </div>
  );
}
