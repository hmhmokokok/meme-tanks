import { WebSocketServer } from 'ws';
import { attachMultiplayerHandlers } from './multiplayerLogic.mjs';

const PORT = Number(process.env.PORT) || 3001;
const wss = new WebSocketServer({ port: PORT });

attachMultiplayerHandlers(wss);

console.log(`Meme Tanks multiplayer server on ws://localhost:${PORT}`);
