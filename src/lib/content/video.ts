/*
 * Video URLs the LMS can play. Anything else is rejected at validation time
 * so students never get a broken player.
 */

export type VideoSource =
  | { provider: "youtube"; embedUrl: string }
  | { provider: "vimeo"; embedUrl: string }
  | { provider: "file"; src: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoUrl(raw: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  let ytId: string | null = null;
  if (host === "youtu.be") ytId = url.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") ytId = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      ytId = m?.[1] ?? null;
    }
  }
  if (ytId !== null) {
    return YT_ID.test(ytId) ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}` } : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:^|\/)(\d{5,12})(?:\/|$)/);
    return m ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` } : null;
  }

  if (/\.(mp4|webm)$/i.test(url.pathname)) return { provider: "file", src: url.toString() };
  return null;
}
