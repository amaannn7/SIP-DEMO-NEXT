"use client";

import { useState } from "react";
import { twemojiUrl } from "@/lib/chat/twemoji";

/**
 * Renders one emoji as a Twemoji SVG image (modern, consistent art across
 * every OS) with the plain Unicode character as a fallback — an emoji this
 * app's curated list didn't anticipate, or a CDN hiccup, degrades to the
 * viewer's native emoji font instead of a broken-image icon.
 */
export function Emoji({ emoji, className = "inline-block size-[1.1em] align-[-0.2em]" }: { emoji: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span>{emoji}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN icon, not an optimizable local/S3 asset
    <img src={twemojiUrl(emoji)} alt={emoji} className={className} draggable={false} onError={() => setFailed(true)} />
  );
}
