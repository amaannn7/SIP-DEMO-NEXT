import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone server bundle for the Docker image
  // (see Dockerfile) — no need to ship the full node_modules tree.
  output: "standalone",
  experimental: {
    serverActions: {
      // sendMessageAction (chat attachments) already validates a 5MB cap
      // client-side and server-side (MAX_ATTACHMENT_BYTES in composer.tsx /
      // actions.ts) — but Next's own default Server Action body limit is
      // 1MB, well under that, so any attachment over 1MB never even reached
      // that validation; it hit this framework-level limit first. 6mb gives
      // the 5MB file itself a little headroom for the rest of the
      // multipart form fields (conversationId, body, replyToId).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
