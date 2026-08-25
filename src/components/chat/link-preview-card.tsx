"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { extractFirstUrl } from "@/lib/chat/extract-url";
import { cn } from "@/lib/utils";

type LinkPreview = { url: string; title: string | null; description: string | null; image: string | null; siteName: string | null };

/** Renders Slack-style unfurl card for the first URL in a message body, if that URL's page carries og:/title metadata. Silent (renders nothing) on no-URL, fetch failure, or a page with no metadata — a missing preview is never an error state. */
export function LinkPreviewCard({ body, isOwn }: { body: string; isOwn: boolean }) {
  const url = extractFirstUrl(body);

  const { data } = useQuery({
    queryKey: ["chat-link-preview", url],
    queryFn: async (): Promise<LinkPreview | null> => {
      const res = await fetch(`/api/chat/link-preview?url=${encodeURIComponent(url!)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.preview ?? null;
    },
    enabled: url !== null,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!data) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      // This block-level card sits inside a right-aligned (text-align)
      // message column for own messages — text-align only repositions
      // inline content, never a block's own box, so this needs its own
      // ml-auto to actually land at the column's right edge (same fix as
      // AttachmentPreview in message-row.tsx).
      className={cn(
        "mt-1.5 flex max-w-sm overflow-hidden rounded-lg border border-border bg-muted/30 transition-colors hover:border-[var(--accent)]/50 hover:bg-muted/50",
        isOwn && "ml-auto",
      )}
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external image, not an optimizable static/S3 asset
        <img src={data.image} alt="" className="h-20 w-20 shrink-0 border-r border-border object-cover" />
      )}
      <div className="min-w-0 flex-1 px-2.5 py-2">
        <p className="flex items-center gap-1 truncate text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          <Globe className="size-2.5 shrink-0" />
          {data.siteName}
        </p>
        {data.title && <p className="mt-0.5 truncate text-[12px] font-semibold text-foreground">{data.title}</p>}
        {data.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{data.description}</p>}
      </div>
    </a>
  );
}
