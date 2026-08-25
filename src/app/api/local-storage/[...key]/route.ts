import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { readObject } from "@/lib/storage/local";

// Serves files written by lib/storage/local.ts — the filesystem fallback
// used when S3_ENDPOINT isn't configured (see lib/storage/s3.ts). Requires
// a valid session but doesn't re-derive per-object authorization here: the
// key itself is an unguessable randomUUID() that was only ever handed to a
// client that had already passed the real access check at the point it was
// generated (e.g. canAccessConversation, for chat attachments) — the same
// trust model a real signed S3 URL has (time-limited and unguessable, not
// re-checked against the viewer's session on every fetch).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { key } = await params;
  // Each segment is checked individually (not just "no .. anywhere in the
  // joined string") so a segment can't smuggle a traversal past a naive
  // string search — e.g. a segment that is itself literally "..".
  if (key.some((segment) => segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const { body, contentType } = await readObject(key.join("/"));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
