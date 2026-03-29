import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });

const userConnections = new Map<string, WebSocket>();

/** One Mac iMessage agent per API — no per-login UUID in .env for Connect scan. */
let localIMessageAgent: WebSocket | null = null;

function parseUpgradeUrl(urlStr: string | undefined): URL | null {
  if (!urlStr) return null;
  try {
    return new URL(urlStr, 'http://localhost');
  } catch {
    return null;
  }
}

function parseUserIdFromUpgradeUrl(urlStr: string | undefined): string | undefined {
  const u = parseUpgradeUrl(urlStr);
  if (!u) return undefined;
  const id = u.searchParams.get('userId')?.trim();
  return id && id !== 'undefined' ? id : undefined;
}

function isLocalIMessageAgentSocket(urlStr: string | undefined): boolean {
  const u = parseUpgradeUrl(urlStr);
  if (!u) return false;
  return u.searchParams.get('agent') === 'imessage';
}

wss.on('connection', (ws, req) => {
  if (isLocalIMessageAgentSocket(req.url)) {
    if (localIMessageAgent && localIMessageAgent.readyState === WebSocket.OPEN) {
      try {
        localIMessageAgent.close();
      } catch {
        /* ignore */
      }
    }
    localIMessageAgent = ws;
    ws.on('close', () => {
      if (localIMessageAgent === ws) localIMessageAgent = null;
    });
    return;
  }

  const userId = parseUserIdFromUpgradeUrl(req.url);
  if (userId) {
    userConnections.set(userId, ws);

    ws.on('close', () => {
      if (userConnections.get(userId) === ws) userConnections.delete(userId);
    });
  }
});

export function broadcastToUser(userId: string, payload: object): boolean {
  const ws = userConnections.get(userId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

/** Connect “Scan all chats” — any logged-in user; payload must include `userId`. */
export function broadcastScanToLocalIMessageAgent(payload: object): boolean {
  const ws = localIMessageAgent;
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

export function sendScanToAgent(userId: string): boolean {
  const payload = { type: 'scan_all' as const, userId };
  return (
    broadcastScanToLocalIMessageAgent(payload) || broadcastToUser(userId, payload)
  );
}

export function sendScanCancelToAgent(userId: string): boolean {
  const payload = { type: 'scan_cancel' as const, userId };
  return (
    broadcastScanToLocalIMessageAgent(payload) || broadcastToUser(userId, payload)
  );
}

/** Helps explain 503 when Connect scan cannot find an agent WebSocket. */
export function describeAgentWsStatus(requestedUserId: string): {
  localIMessageAgentConnected: boolean;
  connectedForThisUser: boolean;
  anyUserSocketConnected: boolean;
  connectedIdsSample: string[];
} {
  const localOk = !!(localIMessageAgent && localIMessageAgent.readyState === WebSocket.OPEN);
  const ws = userConnections.get(requestedUserId);
  const connectedForThisUser = !!ws && ws.readyState === WebSocket.OPEN;
  const openIds = [...userConnections.entries()]
    .filter(([, w]) => w.readyState === WebSocket.OPEN)
    .map(([id]) => id);
  return {
    localIMessageAgentConnected: localOk,
    connectedForThisUser,
    anyUserSocketConnected: openIds.length > 0,
    connectedIdsSample: openIds.slice(0, 3),
  };
}

export function attachWebSocketServer(server: any) {
  server.on('upgrade', (request: any, socket: any, head: any) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
}

export async function handleLocationUpdate(userId: string, latitude: number, longitude: number) {
  // WebSocket push for live UI feedback (location_ping.ts handles the iMessage outbox)
  broadcastToUser(userId, { type: 'location_updated', latitude, longitude });
}
