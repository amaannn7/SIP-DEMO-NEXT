/** First http(s) URL in a message body, or null — chat only ever previews the first link, matching Slack's own unfurl behavior. Shared between server (link-preview.ts) and client (LinkPreviewCard) code, so it can't import "server-only". */
export function extractFirstUrl(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match ? match[0] : null;
}
