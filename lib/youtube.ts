/** YouTube の watch / shorts / youtu.be / embed から 11 文字の動画 ID を抽出 */
export function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "").slice(0, 11) || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const fromQuery = u.searchParams.get("v");
      if (fromQuery) return fromQuery.slice(0, 11);
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].slice(0, 11);
    }
    return null;
  } catch {
    return null;
  }
}
