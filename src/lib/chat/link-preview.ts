import "server-only";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 512 * 1024;

const cache = new Map<string, { at: number; preview: LinkPreview | null }>();

// Blocks the classic SSRF targets (cloud metadata endpoints, loopback,
// private ranges) before the fetch ever goes out — a message body is
// arbitrary user input, and this fetch runs with the server's own network
// access, so a URL like http://169.254.169.254/... or http://localhost:4001
// must never reach `fetch()` here.
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "169.254.169.254" || h.endsWith(".local")) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const cached = cache.get(rawUrl);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.preview;

  const preview = await unfurl(rawUrl);
  cache.set(rawUrl, { at: Date.now(), preview });
  return preview;
}

async function unfurl(rawUrl: string): Promise<LinkPreview | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isPrivateOrLoopbackHost(parsed.hostname)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    // Stream-cap the read — a malicious/huge page shouldn't tie this
    // process up buffering megabytes just to unfurl a chat link.
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    while (bytes < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // The <head> (where OG tags live) is always near the top — no need to
      // keep reading once it's closed.
      if (html.includes("</head>")) break;
    }
    void reader.cancel().catch(() => {});

    const title = extractMeta(html, "og:title") ?? extractTitleTag(html);
    const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");
    const image = extractMeta(html, "og:image");
    const siteName = extractMeta(html, "og:site_name") ?? parsed.hostname;

    if (!title && !description && !image) return null;

    return {
      url: parsed.toString(),
      title,
      description,
      image: image ? resolveUrl(image, parsed) : null,
      siteName,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveUrl(maybeRelative: string, base: URL): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}
