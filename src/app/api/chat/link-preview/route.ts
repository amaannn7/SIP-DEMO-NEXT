import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchLinkPreview } from "@/lib/chat/link-preview";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ success: false, error: "url required" }, { status: 400 });
  }

  const preview = await fetchLinkPreview(url);
  return NextResponse.json({ success: true, preview });
}
