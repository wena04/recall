import { supabase } from '../lib/supabase';
import WebSocket from 'ws';

const wss = new WebSocket.Server({ noServer: true });

const userConnections = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  const userId = req.url?.split('=')[1];
  if (userId) {
    userConnections.set(userId, ws);

    ws.on('close', () => {
      userConnections.delete(userId);
    });
  }
});

export function attachWebSocketServer(server: any) {
  server.on('upgrade', (request: any, socket: any, head: any) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
}

async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('notification_frequency, notification_imessage_to, last_notification_sent_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
}

async function getMemoriesNear(latitude: number, longitude: number, userId: string) {
  const { data, error } = await supabase.rpc('find_memories_near', {
    lat: latitude,
    long: longitude,
    user_id: userId,
  });

  if (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
  return data;
}

function shouldSendNotification(user: any) {
  if (!user || user.notification_frequency === 'off') {
    return false;
  }

  if (!user.last_notification_sent_at) {
    return true; // Always send if never sent before
  }

  const now = new Date();
  const lastSent = new Date(user.last_notification_sent_at);
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / 1000 / 60 / 60;

  switch (user.notification_frequency) {
    case 'hourly':
      return hoursSinceLastSent >= 1;
    case 'daily':
      return hoursSinceLastSent >= 24;
    default:
      return false;
  }
}

export async function handleLocationUpdate(userId: string, latitude: number, longitude: number) {
  const user = await getUser(userId);

  if (shouldSendNotification(user)) {
    const memories = await getMemoriesNear(latitude, longitude, userId);

    if (memories.length > 0) {
      const ws = userConnections.get(userId);
      if (ws) {
        const message = `📍 Welcome! Based on your saved reels from last month, here are ${memories.length} spots you wanted to check out...`;
        ws.send(JSON.stringify({ type: 'notification', message }));

        // Update the last notification sent time
        await supabase
          .from('users')
          .update({ last_notification_sent_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }
  }
}
