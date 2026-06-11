/** @typedef {{ ws: import('ws').WebSocket, role: 'host' | 'guest' | null, name: string, color: string }} Client */
/** @typedef {{ code: string, host: Client, guest: Client | null }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? randomCode() : code;
}

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function broadcastRoom(room, payload, except) {
  if (room.host.ws !== except) send(room.host.ws, payload);
  if (room.guest && room.guest.ws !== except) send(room.guest.ws, payload);
}

function findRoomByClient(ws) {
  for (const room of rooms.values()) {
    if (room.host.ws === ws || room.guest?.ws === ws) return room;
  }
  return null;
}

/**
 * @param {import('ws').WebSocketServer} wss
 */
export function attachMultiplayerHandlers(wss) {
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        send(ws, { type: 'error', message: 'Invalid message' });
        return;
      }

      const { type } = msg;

      if (type === 'create_room') {
        const code = randomCode();
        const client = {
          ws,
          role: 'host',
          name: String(msg.hostName || 'Host'),
          color: String(msg.hostColor || '#EAB308'),
        };
        rooms.set(code, { code, host: client, guest: null });
        send(ws, { type: 'room_created', code });
        return;
      }

      if (type === 'join_room') {
        const code = String(msg.code || '').toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          send(ws, { type: 'error', message: 'Room not found' });
          return;
        }
        if (room.guest) {
          send(ws, { type: 'error', message: 'Room is full' });
          return;
        }

        room.guest = {
          ws,
          role: 'guest',
          name: String(msg.guestName || 'Guest'),
          color: String(msg.guestColor || '#22C55E'),
        };

        send(ws, { type: 'player_joined', players: 2, role: 'guest' });
        send(room.host.ws, { type: 'player_joined', players: 2 });
        broadcastRoom(room, {
          type: 'lobby_ready',
          hostName: room.host.name,
          guestName: room.guest.name,
        });
        return;
      }

      const room = findRoomByClient(ws);
      if (!room) {
        send(ws, { type: 'error', message: 'Not in a room' });
        return;
      }

      if (type === 'start_game') {
        if (room.host.ws !== ws) {
          send(ws, { type: 'error', message: 'Only host can start' });
          return;
        }
        if (!room.guest) {
          send(ws, { type: 'error', message: 'Waiting for opponent' });
          return;
        }
        broadcastRoom(room, {
          type: 'game_start',
          seed: msg.seed,
          windLevel: msg.windLevel,
          p1Name: room.host.name,
          p2Name: room.guest.name,
          p1Color: room.host.color,
          p2Color: room.guest.color,
        });
        return;
      }

      if (type === 'action_fire' || type === 'action_move' || type === 'turn_complete' || type === 'game_over') {
        broadcastRoom(room, msg, ws);
      }
    });

    ws.on('close', () => {
      for (const [code, room] of rooms.entries()) {
        if (room.host.ws === ws) {
          if (room.guest) send(room.guest.ws, { type: 'peer_left' });
          rooms.delete(code);
        } else if (room.guest?.ws === ws) {
          room.guest = null;
          send(room.host.ws, { type: 'peer_left' });
          send(room.host.ws, { type: 'player_joined', players: 1 });
        }
      }
    });
  });
}
