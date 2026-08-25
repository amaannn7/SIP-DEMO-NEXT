import { startChatWsServer } from "@/lib/chat/ws-server";

startChatWsServer().catch((err) => {
  console.error("Chat WebSocket server failed to start:", err);
  process.exit(1);
});
