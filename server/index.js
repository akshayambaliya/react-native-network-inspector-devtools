'use strict';

/**
 * Web panel relay server.
 *
 * Bridges the RN app (a single "mobile" WebSocket client, see
 * `src/utils/webSync.ts`) with any number of browser tabs (the "web" role,
 * see `web/app.js`). The mobile client is the source of truth: it owns the
 * reducer state and only ever *receives* actions to dispatch locally, so
 * toggling/adding/editing a mock from the browser behaves identically to
 * doing it on-device (same reducer, same AsyncStorage persistence).
 *
 * Protocol (JSON messages over WebSocket):
 *   mobile -> server: { type: 'hello', role: 'mobile' }
 *   mobile -> server: { type: 'state', payload: NetworkLoggerState }
 *   web    -> server: { type: 'hello', role: 'web' }
 *   web    -> server: { type: 'action', payload: NetworkLoggerAction }
 *   server -> web:    { type: 'state', payload: NetworkLoggerState }
 *   server -> web:    { type: 'status', payload: { mobileConnected: boolean } }
 *   server -> mobile: { type: 'action', payload: NetworkLoggerAction }
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const WEB_DIR = path.join(__dirname, '..', 'web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  const requestedPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(WEB_DIR, path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, ''));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/**
 * Starts the HTTP + WebSocket relay server.
 * @param {{ port?: number }} options
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
function startServer(options = {}) {
  const port = options.port || 8973;

  const httpServer = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server: httpServer });

  /** @type {WebSocket | null} */
  let mobileSocket = null;
  /** @type {Set<WebSocket>} */
  const webSockets = new Set();
  /** @type {unknown} */
  let lastState = null;

  const broadcastToWeb = (message) => {
    const data = JSON.stringify(message);
    for (const client of webSockets) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  };

  wss.on('connection', (socket) => {
    let role = null;

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames
      }

      if (message.type === 'hello') {
        role = message.role === 'mobile' ? 'mobile' : 'web';
        if (role === 'mobile') {
          mobileSocket = socket;
          broadcastToWeb({ type: 'status', payload: { mobileConnected: true } });
        } else {
          webSockets.add(socket);
          if (lastState) socket.send(JSON.stringify({ type: 'state', payload: lastState }));
          socket.send(
            JSON.stringify({ type: 'status', payload: { mobileConnected: !!mobileSocket } })
          );
        }
        return;
      }

      if (role === 'mobile' && message.type === 'state') {
        lastState = message.payload;
        broadcastToWeb({ type: 'state', payload: lastState });
        return;
      }

      if (role === 'web' && message.type === 'action') {
        if (mobileSocket && mobileSocket.readyState === mobileSocket.OPEN) {
          mobileSocket.send(JSON.stringify({ type: 'action', payload: message.payload }));
        }
      }
    });

    socket.on('close', () => {
      if (socket === mobileSocket) {
        mobileSocket = null;
        broadcastToWeb({ type: 'status', payload: { mobileConnected: false } });
      }
      webSockets.delete(socket);
    });
  });

  return new Promise((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, () => {
      resolve({
        port,
        close: () =>
          new Promise((res) => {
            wss.close();
            httpServer.close(() => res());
          }),
      });
    });
  });
}

module.exports = { startServer };
