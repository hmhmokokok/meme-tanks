export type OnlineRole = 'host' | 'guest';
export type LobbyStatus = 'idle' | 'connecting' | 'waiting' | 'ready' | 'error';

export type MultiplayerMessage =
  | { type: 'room_created'; code: string }
  | { type: 'player_joined'; players: number }
  | { type: 'lobby_ready'; hostName: string; guestName: string }
  | { type: 'game_start'; seed: number; windLevel: string; p1Name: string; p2Name: string; p1Color: string; p2Color: string }
  | { type: 'action_fire'; playerId: 'p1' | 'p2'; weaponId: string; angle: number; power: number }
  | { type: 'action_move'; playerId: 'p1' | 'p2'; direction: 'forward' | 'back' }
  | { type: 'turn_complete'; playerId: 'p1' | 'p2' }
  | { type: 'game_over'; winner: string }
  | { type: 'error'; message: string }
  | { type: 'peer_left' };

function getWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname || 'localhost';

  if (import.meta.env.DEV) {
    return `${protocol}://${host}:3001`;
  }

  // Production: same host as the app (Render/Railway serve WS on same port)
  return `${protocol}://${window.location.host}`;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private onMessage: ((msg: MultiplayerMessage) => void) | null = null;

  connect(onMessage: (msg: MultiplayerMessage) => void): Promise<void> {
    this.onMessage = onMessage;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(getWsUrl());
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('Could not connect to game server'));
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as MultiplayerMessage;
          this.onMessage?.(msg);
        } catch {
          /* ignore malformed */
        }
      };
      this.ws.onclose = () => {
        this.onMessage?.({ type: 'peer_left' });
      };
    });
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  createRoom(hostName: string, hostColor: string) {
    this.send({ type: 'create_room', hostName, hostColor });
  }

  joinRoom(code: string, guestName: string, guestColor: string) {
    this.send({ type: 'join_room', code: code.toUpperCase(), guestName, guestColor });
  }

  startGame(payload: {
    seed: number;
    windLevel: string;
    p1Name: string;
    p2Name: string;
    p1Color: string;
    p2Color: string;
  }) {
    this.send({ type: 'start_game', ...payload });
  }

  broadcastFire(playerId: 'p1' | 'p2', weaponId: string, angle: number, power: number) {
    this.send({ type: 'action_fire', playerId, weaponId, angle, power });
  }

  broadcastMove(playerId: 'p1' | 'p2', direction: 'forward' | 'back') {
    this.send({ type: 'action_move', playerId, direction });
  }

  broadcastTurnComplete(playerId: 'p1' | 'p2') {
    this.send({ type: 'turn_complete', playerId });
  }

  broadcastGameOver(winner: string) {
    this.send({ type: 'game_over', winner });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
