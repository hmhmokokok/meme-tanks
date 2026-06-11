import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { attachMultiplayerHandlers } from './multiplayerLogic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

attachMultiplayerHandlers(wss);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Meme Tanks live at http://0.0.0.0:${PORT}`);
  console.log(`WebSocket multiplayer on ws://0.0.0.0:${PORT}`);
});
