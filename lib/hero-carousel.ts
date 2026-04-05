/**
 * site_settings.hero_slide_ids の1要素を解釈する。
 * - 従来: スライドIDのみの文字列（プレフィックスなし）→ スライドとして扱う
 * - 新形式: slide:… / video:…
 */
export function parseHeroSettingEntry(raw: string): { kind: "slide" | "video"; id: string } | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("video:")) return { kind: "video", id: t.slice(6).trim() };
  if (t.startsWith("slide:")) return { kind: "slide", id: t.slice(6).trim() };
  return { kind: "slide", id: t };
}

export function formatHeroSlideEntry(id: string): string {
  return `slide:${id}`;
}

export function formatHeroVideoEntry(id: string): string {
  return `video:${id}`;
}

export function heroSelectionIncludesSlide(heroIds: string[], slideId: string): boolean {
  const sid = String(slideId);
  return heroIds.some((e) => {
    const p = parseHeroSettingEntry(e);
    return p?.kind === "slide" && String(p.id) === sid;
  });
}

export function heroSelectionIncludesVideo(heroIds: string[], videoId: string): boolean {
  const vid = String(videoId);
  return heroIds.some((e) => {
    const p = parseHeroSettingEntry(e);
    return p?.kind === "video" && String(p.id) === vid;
  });
}
