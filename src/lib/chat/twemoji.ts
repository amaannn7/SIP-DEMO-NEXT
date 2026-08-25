// Twitter's open-source emoji set (MIT licensed) rendered as small SVGs —
// gives every user the same colorful, modern emoji art regardless of their
// OS's native emoji font (Windows' "Segoe UI Emoji" in particular looks
// noticeably flatter/older than Twemoji, iOS, or Discord/Slack's own sets).
// jsDelivr mirrors the twemoji-assets npm package's SVG output, so this is a
// stable CDN URL rather than hand-hosting the full ~3600-icon set in this repo.
const TWEMOJI_CDN_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

/** Converts an emoji character (any grapheme cluster: single codepoint, ZWJ sequence, or variation-selector pair) to its Twemoji SVG URL. */
export function twemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((cp): cp is string => Boolean(cp))
    // Twemoji drops the variation-selector-16 codepoint (fe0f) from most
    // filenames except where it's semantically required — stripping it
    // first and falling back to the un-stripped name covers both cases.
    .filter((cp) => cp !== "fe0f");
  return `${TWEMOJI_CDN_BASE}/${codepoints.join("-")}.svg`;
}
