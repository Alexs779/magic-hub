const http = require('http');
const path = require('path');
const os = require('os');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3030;

// Security & Anti-Cloning HTTP Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org telegram:;");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory rate limiter for payments & sensitive actions
const buyRateLimit = new Map();
function checkBuyRateLimit(identifier) {
  const now = Date.now();
  const record = buyRateLimit.get(identifier);
  if (!record || now > record.resetAt) {
    buyRateLimit.set(identifier, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 mins window
    return true;
  }
  if (record.count >= 3) {
    return false; // max 3 requests per 15 minutes
  }
  record.count++;
  return true;
}

// In-memory room management for mentalist sessions
// room = { id, forceNumber, mode, lastTelemetry: null, clients: Set<WebSocket> }
const rooms = new Map();

function getOrCreateRoom(roomId = 'default') {
  const cleanId = String(roomId).trim().toLowerCase() || 'default';
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, {
      id: cleanId,
      forceNumber: '79163428812', // default force (phone number format)
      mode: 'toxic',              // 'toxic' | 'normal' | 'panic' | 'time'
      skin: 'android',            // 'android' | 'ios' | 'samsung'
      lastTelemetry: null,
      history: [],
      clients: new Set()
    });
  }
  return rooms.get(cleanId);
}

// REST API for status & diagnostics
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    activeRooms: rooms.size,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  res.json({
    id: room.id,
    forceNumber: room.forceNumber,
    mode: room.mode,
    skin: room.skin,
    lastTelemetry: room.lastTelemetry,
    connectedDevices: room.clients.size
  });
});

app.post('/api/user/config', (req, res) => {
  const { roomId, forceNumber, skin, mode } = req.body || {};
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  const room = getOrCreateRoom(roomId);
  if (forceNumber !== undefined) room.forceNumber = String(forceNumber).trim();
  if (skin !== undefined) room.skin = skin;
  if (mode !== undefined) room.mode = mode;

  broadcastToRoom(room, {
    type: 'config_updated',
    forceNumber: room.forceNumber,
    skin: room.skin,
    mode: room.mode
  });

  res.json({
    success: true,
    room: {
      id: room.id,
      forceNumber: room.forceNumber,
      skin: room.skin,
      mode: room.mode
    }
  });
});

const accessManager = require('./lib/access-manager');

app.get('/hub', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hub', 'index.html'));
});

// --- ACCESS & ADMIN REST API ---
app.get('/api/access/check', (req, res) => {
  const { userId, username } = req.query || {};
  const isAdmin = accessManager.isAdmin(userId);
  const hasAccess = isAdmin || accessManager.hasAccess(userId, username);
  const pending = accessManager.getPendingRequest(userId);
  const data = accessManager.loadAccessData();

  res.json({
    userId,
    username,
    isAdmin,
    hasAccess,
    pending: !!pending,
    pendingDetails: pending,
    wallet: data.wallet
  });
});

app.post('/api/access/buy-request', (req, res) => {
  const { userId, username, txHash, network } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // Anti-Spam Rate Limiting (max 3 requests per 15 minutes)
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkBuyRateLimit(String(userId)) || !checkBuyRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Слишком много запросов. Пожалуйста, подождите 15 минут перед следующей попыткой.' });
  }

  try {
    const request = accessManager.createBuyRequest({ userId, username, txHash, network });
    res.json({ success: true, request });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Helper for hardened admin authentication
function isAuthorizedAdmin(req) {
  const adminId = req.query.adminId || req.body?.adminId;
  const adminToken = req.headers['x-admin-token'] || req.query.adminToken || req.body?.adminToken;
  const initData = req.headers['x-telegram-init-data'];

  // 1. If ADMIN_SECRET_KEY is configured in env, require matching token
  if (process.env.ADMIN_SECRET_KEY) {
    if (adminToken === process.env.ADMIN_SECRET_KEY) return true;
  }

  // 2. If BOT_TOKEN is configured and initData is provided, verify Telegram cryptographic signature
  if (process.env.BOT_TOKEN && initData) {
    const isValid = accessManager.verifyTelegramInitData(initData, process.env.BOT_TOKEN);
    if (isValid) {
      try {
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        if (userJson) {
          const userObj = JSON.parse(userJson);
          if (accessManager.isAdmin(userObj.id)) return true;
        }
      } catch (e) {}
    }
  }

  // 3. Baseline check: is the adminId recognized as admin
  return accessManager.isAdmin(adminId);
}

// Admin endpoints
app.get('/api/admin/overview', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const adminId = req.query.adminId || accessManager.SUPER_ADMIN_ID;
  res.json(accessManager.getOverview(adminId));
});

app.post('/api/admin/approve', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const { adminId, targetUserId } = req.body || {};
  try {
    const result = accessManager.approveRequest(adminId, targetUserId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/reject', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const { adminId, targetUserId } = req.body || {};
  try {
    const result = accessManager.rejectRequest(adminId, targetUserId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/grant', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const { adminId, identifier } = req.body || {};
  try {
    const result = accessManager.grantAccess(adminId, identifier);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/revoke', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const { adminId, identifier } = req.body || {};
  try {
    const result = accessManager.revokeAccess(adminId, identifier);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/wallet', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden: not an admin' });
  }
  const { adminId, trc20, ton } = req.body || {};
  try {
    const wallet = accessManager.updateWallet(adminId, { trc20, ton });
    res.json({ success: true, wallet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// WebSocket realtime synchronization
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roomId = url.searchParams.get('room') || 'default';
  const role = url.searchParams.get('role') || 'calculator'; // 'calculator' | 'performer'
  const skinParam = url.searchParams.get('skin');

  ws.roomId = roomId;
  ws.role = role;
  ws.isAlive = true;

  const room = getOrCreateRoom(roomId);
  if (skinParam && ['android', 'ios', 'samsung'].includes(skinParam)) {
    room.skin = skinParam;
  }
  room.clients.add(ws);

  // Send initial room state to newly connected client
  ws.send(JSON.stringify({
    type: 'init',
    roomId: room.id,
    role: ws.role,
    forceNumber: room.forceNumber,
    mode: room.mode,
    skin: room.skin,
    lastTelemetry: room.lastTelemetry,
    connectedDevices: room.clients.size
  }));

  // Broadcast device status update to all in room
  broadcastToRoom(room, {
    type: 'device_joined',
    role: ws.role,
    connectedDevices: room.clients.size
  }, ws);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      handleMessage(ws, room, data);
    } catch (err) {
      console.error('[WS Error] Invalid JSON:', err.message);
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    broadcastToRoom(room, {
      type: 'device_left',
      role: ws.role,
      connectedDevices: room.clients.size
    });
    // Clean up empty rooms after 1 hour if inactive
    if (room.clients.size === 0 && room.id !== 'default') {
      setTimeout(() => {
        if (room.clients.size === 0) {
          rooms.delete(room.id);
        }
      }, 3600000);
    }
  });
});

function handleMessage(senderWs, room, data) {
  switch (data.type) {
    case 'telemetry':
      // Live spectator input coming from the calculator
      room.lastTelemetry = data.payload;
      if (data.payload && data.payload.event === 'calculate') {
        room.history.push(data.payload);
      }
      // Broadcast immediately to performer(s) with ultra-low latency (< 20ms)
      broadcastToRole(room, 'performer', {
        type: 'telemetry',
        payload: data.payload,
        timestamp: Date.now()
      });
      break;

    case 'set_config':
      // Performer updating target force number, mode, or skin
      if (data.payload) {
        if (data.payload.forceNumber !== undefined) {
          room.forceNumber = String(data.payload.forceNumber).trim();
        }
        if (data.payload.mode !== undefined) {
          room.mode = data.payload.mode;
        }
        if (data.payload.skin !== undefined) {
          room.skin = data.payload.skin;
        }
      }
      // Broadcast update to all devices in the room (especially the calculator)
      broadcastToRoom(room, {
        type: 'config_updated',
        forceNumber: room.forceNumber,
        mode: room.mode,
        skin: room.skin
      });
      break;

    case 'panic_toggle':
      // Toggle panic mode
      room.mode = room.mode === 'panic' ? 'toxic' : 'panic';
      broadcastToRoom(room, {
        type: 'config_updated',
        forceNumber: room.forceNumber,
        mode: room.mode
      });
      break;

    case 'request_sync':
      senderWs.send(JSON.stringify({
        type: 'sync_response',
        forceNumber: room.forceNumber,
        mode: room.mode,
        lastTelemetry: room.lastTelemetry
      }));
      break;
  }
}

function broadcastToRoom(room, messageObj, excludeWs = null) {
  const json = JSON.stringify(messageObj);
  for (const client of room.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function broadcastToRole(room, targetRole, messageObj) {
  const json = JSON.stringify(messageObj);
  for (const client of room.clients) {
    if (client.role === targetRole && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// Heartbeat ping/pong every 30s to keep websockets alive across mobile sleeping
const heartbeatInterval = setInterval(() => {
  for (const room of rooms.values()) {
    for (const ws of room.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000);
heartbeatInterval.unref(); // Allow Node process to exit when idle

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Helper to get local network IP address
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

function startServer(port = PORT, host = '0.0.0.0') {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const localIps = getLocalIpAddresses();
      console.log('='.repeat(65));
      console.log(`🔮 Chameleon Calculator Server is running on port ${actualPort}`);
      console.log(`📱 Spectator Calculator (Local):     http://localhost:${actualPort}`);
      if (localIps.length > 0) {
        localIps.forEach(ip => {
          console.log(`📱 Spectator Calculator (Wi-Fi):     http://${ip}:${actualPort}`);
          console.log(`🕶️ Performer Stealth Peek (Wi-Fi):  http://${ip}:${actualPort}/performer.html`);
        });
      }
      console.log(`🕶️ Performer Stealth Peek (Local):  http://localhost:${actualPort}/performer.html`);
      console.log('='.repeat(65));
      resolve({ server, port: actualPort });
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    clearInterval(heartbeatInterval);
    for (const room of rooms.values()) {
      for (const ws of room.clients) {
        ws.terminate();
      }
    }
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    wss.close(() => {
      server.close(() => {
        resolve();
      });
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, wss, getOrCreateRoom, startServer, stopServer };
