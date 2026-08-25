import { createServer } from "node:http";
import { parse as parseUrl } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import postgres from "postgres";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { canAccessConversation } from "@/lib/db/queries/chat";
import { CHAT_NOTIFY_CHANNEL, type ChatEvent } from "./events";

const SESSION_COOKIE = "session_id";
const PORT = Number(process.env.CHAT_WS_PORT ?? 4001);

type Client = { ws: WebSocket; userId: string; orgId: string };

const clients = new Set<Client>();

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function authenticate(sessionId: string): Promise<{ userId: string; orgId: string } | null> {
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())),
    with: { user: { columns: { id: true, orgId: true, isActive: true } } },
  });
  if (!row || !row.user.isActive) return null;
  return { userId: row.user.id, orgId: row.user.orgId };
}

async function fanOut(event: ChatEvent) {
  const targets = [...clients].filter((c) => c.orgId === event.orgId);
  const payload = JSON.stringify(event);
  await Promise.all(
    targets.map(async (client) => {
      // One client's failure (a broken/half-closed socket, an access check
      // that throws on a transient DB blip) must not `Promise.all`-reject
      // and silently cancel delivery to every *other* client still waiting
      // on this same event — each client's send is independent.
      try {
        const allowed = await canAccessConversation(event.orgId, event.conversationId, client.userId);
        if (!allowed) return;
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(payload);
        }
      } catch (err) {
        console.error("Chat WS fan-out failed for one client:", err);
      }
    }),
  );
}

export async function startChatWsServer(): Promise<void> {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parseUrl(req.url ?? "");
    if (pathname !== "/chat-ws") {
      socket.destroy();
      return;
    }
    const sessionId = parseCookie(req.headers.cookie, SESSION_COOKIE);
    const identity = sessionId ? await authenticate(sessionId) : null;
    if (!identity) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Client = { ws, userId: identity.userId, orgId: identity.orgId };
      clients.add(client);
      ws.on("close", () => clients.delete(client));
      ws.on("error", () => clients.delete(client));
    });
  });

  // A dedicated connection for LISTEN, separate from `db`'s pool — a LISTEN
  // session holds its connection open indefinitely, which would starve the
  // ordinary queries this process also makes (canAccessConversation, in
  // fanOut) if it shared the same pooled client.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const listenSql = postgres(databaseUrl, { max: 1 });
  await listenSql.listen(CHAT_NOTIFY_CHANNEL, (payload) => {
    try {
      const event = JSON.parse(payload) as ChatEvent;
      void fanOut(event);
    } catch {
      // Malformed payload — ignore rather than crash the relay.
    }
  });

  server.listen(PORT, () => {
    console.log(`Chat WebSocket server listening on :${PORT}`);
  });
}
