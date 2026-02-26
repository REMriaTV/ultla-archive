import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExpandedSlideProvider } from "@/components/ExpandedSlideContext";
import { AnnouncementCardWhenLoggedIn } from "@/components/AnnouncementCardWhenLoggedIn";
import { GuestBanner } from "@/components/GuestBanner";
import { HeroSlides } from "@/components/HeroSlides";
import { InviteSeriesShelf, MylistShelf, ProgramShelf } from "@/components/ProgramShelf";
import { SearchSection } from "@/components/SearchSection";
import { getAccessContext, filterVisibleSlides } from "@/lib/access";
import type { Slide } from "@/lib/types";

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
    { data: siteSettings },
    { data: latestAnnouncement },
  ] = await Promise.all([
    supabase
      .from("programs")
      .select("*")
      .order("started_year", { ascending: true, nullsFirst: false }),
    accessCtx.isAdmin && supabaseAdmin
      ? supabaseAdmin.from("slides").select("*")
      : supabase.from("slides").select("*"),
    supabase.from("site_settings").select("subtitle, hero_mode, hero_slide_count, hero_slide_ids").eq("id", "main").single(),
    supabase
      .from("announcements")
      .select("id, title, body, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const subtitle = typeof siteSettings?.subtitle === "string" ? siteSettings.subtitle : DEFAULT_SUBTITLE;
  const heroMode = siteSettings?.hero_mode === "selected" ? "selected" : "random";
  const heroSlideCount = typeof siteSettings?.hero_slide_count === "number" && siteSettings.hero_slide_count >= 1 && siteSettings.hero_slide_count <= 20
    ? siteSettings.hero_slide_count
    : 5;
  const heroSlideIdsRaw = siteSettings?.hero_slide_ids;
  const heroSlideIds = Array.isArray(heroSlideIdsRaw) ? heroSlideIdsRaw.filter((id: unknown) => typeof id === "string") : [];

  const latestAnnouncementDate =
    latestAnnouncement?.published_at
      ? new Date(latestAnnouncement.published_at).toLocaleDateString("ja-JP")
      : "";

  if (programsError) console.error("Programs fetch error:", programsError);
  if (slidesError) console.error("Slides fetch error:", slidesError);

  const allPrograms = programs ?? [];
  const programList = allPrograms.filter(
    (p: { show_on_front?: boolean }) => p.show_on_front !== false
  );
  const rawSlides = (allSlides ?? []) as Slide[];
  const slidesList = filterVisibleSlides(rawSlides, accessCtx);

  const slidesById = new Map(slidesList.map((s) => [String(s.id), s]));
  const heroSlides =
    heroMode === "selected" && heroSlideIds.length > 0
      ? heroSlideIds.map((id) => slidesById.get(id)).filter(Boolean) as Slide[]
      : shuffle(slidesList).slice(0, heroSlideCount);

  const slidesByProgram = new Map<string, Slide[]>();
  for (const slide of slidesList) {
    const list = slidesByProgram.get(slide.program_id) ?? [];
    list.push(slide);
    slidesByProgram.set(slide.program_id, list);
  }

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
        {latestAnnouncement && (
          <AnnouncementCardWhenLoggedIn
            title={latestAnnouncement.title}
            publishedAt={latestAnnouncementDate || null}
          />
        )}
        {/* ヒーロースライド（main の px を打ち消して幅いっぱいに） */}
        <section className="-mx-6 mb-6">
          <HeroSlides slides={heroSlides} intervalMs={5500} />
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
                  <Link href="/mypage/invite-codes" className="hover:opacity-90">
                    招待コードの追加・確認
                  </Link>
                  はマイページから
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
            {programList.length === 0 ? (
              <p className="py-8 text-center" style={{ color: "var(--fg-muted)" }}>
                プログラムデータがありません
              </p>
            ) : (
              programList.map((program) => (
                <div
                  key={program.id}
                  id={`program-${program.id}`}
                  className="scroll-mt-24"
                >
                  <ProgramShelf
                    program={program}
                    slides={slidesByProgram.get(program.id) ?? []}
                  />
                </div>
              ))
            )}
          </section>
        </ExpandedSlideProvider>
      </main>
      </div>
    </div>
  );
}
