/**
 * Ports the source system's notifyChatMentions() matching rule exactly:
 * a member is mentioned if the message contains "@" followed by their full
 * display name or just their first name, case-insensitive, not immediately
 * followed by another word character (so "@Jan" doesn't match "@Janet").
 */
export function findMentionedUserIds(body: string, members: { id: string; displayName: string }[]): string[] {
  if (!body.includes("@")) return [];
  const matched: string[] = [];
  for (const member of members) {
    const fullName = member.displayName.trim();
    if (!fullName) continue;
    const firstName = fullName.split(" ")[0];
    const candidates = [...new Set([fullName, firstName])].filter(Boolean);
    const isMentioned = candidates.some((candidate) => {
      const pattern = new RegExp(`@${escapeRegExp(candidate)}(?![a-zA-Z0-9_])`, "i");
      return pattern.test(body);
    });
    if (isMentioned) matched.push(member.id);
  }
  return matched;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Shared candidate-pattern builder behind findMentionedUserIds and
 * splitMessageSegments (and message-markdown.tsx's remark plugin) — one
 * definition of "what counts as this member's @mention" instead of three
 * near-duplicate regex-building loops that could drift out of sync.
 */
export function findMentionPatterns(members: { id: string; displayName: string }[]): { userId: string; pattern: RegExp }[] {
  const candidates: { userId: string; pattern: RegExp }[] = [];
  for (const member of members) {
    const fullName = member.displayName.trim();
    if (!fullName) continue;
    const firstName = fullName.split(" ")[0];
    for (const candidate of new Set([fullName, firstName])) {
      candidates.push({ userId: member.id, pattern: new RegExp(`@${escapeRegExp(candidate)}(?![a-zA-Z0-9_])`, "i") });
    }
  }
  // Longest candidate text first, so "@Jordan Lee" is tried before "@Jordan".
  candidates.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
  return candidates;
}

export type MessageSegment = { type: "text"; text: string } | { type: "mention"; text: string; userId: string };

/**
 * Same matching rule as findMentionedUserIds (full name or first name,
 * case-insensitive, not a prefix of a longer word), but returns the split
 * segments with position info so a renderer can style the "@Name" span
 * distinctly instead of just knowing *that* someone was mentioned.
 * Longer candidates are tried first so "@Jordan Lee" matches as one mention
 * rather than "@Jordan" matching alone and leaving " Lee" as plain text.
 */
export function splitMessageSegments(body: string, members: { id: string; displayName: string }[]): MessageSegment[] {
  if (!body.includes("@")) return [{ type: "text", text: body }];

  const candidates = findMentionPatterns(members);

  const segments: MessageSegment[] = [];
  function pushText(text: string) {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last?.type === "text") last.text += text;
    else segments.push({ type: "text", text });
  }

  let cursor = 0;
  while (cursor < body.length) {
    const atIndex = body.indexOf("@", cursor);
    if (atIndex === -1) {
      pushText(body.slice(cursor));
      break;
    }
    pushText(body.slice(cursor, atIndex));

    const remainder = body.slice(atIndex);
    let matched: { userId: string; length: number } | null = null;
    for (const { userId, pattern } of candidates) {
      const anchored = new RegExp(`^${pattern.source}`, "i");
      const match = anchored.exec(remainder);
      if (match && (!matched || match[0].length > matched.length)) {
        matched = { userId, length: match[0].length };
      }
    }

    if (matched) {
      segments.push({ type: "mention", text: remainder.slice(0, matched.length), userId: matched.userId });
      cursor = atIndex + matched.length;
    } else {
      pushText("@");
      cursor = atIndex + 1;
    }
  }
  return segments;
}
