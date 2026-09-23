const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let pgPool = null;
const DATABASE_URL = process.env.DATABASE_URL;
if (DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('[AccessManager] Initialized PostgreSQL connection pool');
  } catch (err) {
    console.warn('[AccessManager] Could not initialize pg pool:', err.message);
  }
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ACCESS_FILE = path.join(DATA_DIR, 'access.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SUPER_ADMIN_ID = '7357950968';

const defaultData = {
  admins: [SUPER_ADMIN_ID],
  whitelist: [SUPER_ADMIN_ID],
  pending: [],
  processedTxHashes: [],
  leads: [],
  wallet: {
    trc20: '',
    ton: ''
  }
};

let inMemoryCache = null;

async function initDatabase() {
  if (!pgPool) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS platform_access (
        id VARCHAR(32) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const res = await pgPool.query("SELECT data FROM platform_access WHERE id = 'main'");
    if (res.rows.length > 0 && res.rows[0].data) {
      inMemoryCache = res.rows[0].data;
      console.log('[AccessManager] Successfully loaded cloud state from Neon PostgreSQL');
    } else {
      const localData = loadAccessDataFromFile();
      await pgPool.query(
        "INSERT INTO platform_access (id, data) VALUES ('main', $1) ON CONFLICT (id) DO UPDATE SET data = $1",
        [JSON.stringify(localData)]
      );
      inMemoryCache = localData;
      console.log('[AccessManager] Seeded Neon PostgreSQL cloud database with local data');
    }
  } catch (e) {
    console.error('[AccessManager] Neon PostgreSQL init warning, continuing with local fallback:', e.message);
  }
}

function loadAccessDataFromFile() {
  try {
    if (!fs.existsSync(ACCESS_FILE)) {
      saveAccessDataToFile(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(ACCESS_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.admins.includes(SUPER_ADMIN_ID)) {
      data.admins.push(SUPER_ADMIN_ID);
    }
    if (!data.whitelist.includes(SUPER_ADMIN_ID)) {
      data.whitelist.push(SUPER_ADMIN_ID);
    }
    if (!Array.isArray(data.processedTxHashes)) {
      data.processedTxHashes = [];
    }
    if (!Array.isArray(data.leads)) {
      data.leads = [];
    }
    return data;
  } catch (e) {
    console.error('[AccessManager] Error loading access data from file:', e);
    return defaultData;
  }
}

function saveAccessDataToFile(data) {
  try {
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[AccessManager] Error saving access data to file:', e);
  }
}

function loadAccessData() {
  if (inMemoryCache) {
    if (!inMemoryCache.admins.includes(SUPER_ADMIN_ID)) inMemoryCache.admins.push(SUPER_ADMIN_ID);
    if (!inMemoryCache.whitelist.includes(SUPER_ADMIN_ID)) inMemoryCache.whitelist.push(SUPER_ADMIN_ID);
    if (!Array.isArray(inMemoryCache.processedTxHashes)) inMemoryCache.processedTxHashes = [];
    if (!Array.isArray(inMemoryCache.leads)) inMemoryCache.leads = [];
    return inMemoryCache;
  }
  inMemoryCache = loadAccessDataFromFile();
  return inMemoryCache;
}

function saveAccessData(data) {
  inMemoryCache = data;
  saveAccessDataToFile(data);
  if (pgPool) {
    pgPool.query(
      "INSERT INTO platform_access (id, data, updated_at) VALUES ('main', $1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP",
      [JSON.stringify(data)]
    ).catch(err => {
      console.error('[AccessManager] Cloud DB sync error:', err.message);
    });
  }
}

// --- ANTI-FRAUD & TXID VALIDATION ---
function validateTxHash(txHash, network = 'TRC20') {
  const clean = String(txHash || '').trim();
  if (!clean) {
    return { valid: false, error: 'Хеш транзакции не может быть пустым' };
  }

  // TRC-20 (Tron) TXID: exactly 64 hex chars
  const tronRegex = /^[a-fA-F0-9]{64}$/;
  // TON TXID: 44 to 64 Base64 / URL-safe chars
  const tonRegex = /^[a-zA-Z0-9/+=_-]{44,64}$/;

  if (network === 'TRC20' || network === 'Tron') {
    if (!tronRegex.test(clean)) {
      return { valid: false, error: 'Некорректный TXID TRC-20: требуется 64-значный шестнадцатеричный хеш.' };
    }
  } else if (network === 'TON') {
    if (!tonRegex.test(clean)) {
      return { valid: false, error: 'Некорректный TXID TON: требуется 44-64 значный Base64 хеш.' };
    }
  } else {
    // General crypto tx hash (either Tron 64-hex or TON Base64)
    if (!tronRegex.test(clean) && !tonRegex.test(clean)) {
      return { valid: false, error: 'Некорректный формат хеша транзакции (TXID).' };
    }
  }

  return { valid: true, cleanHash: clean };
}

function isTxHashUsed(txHash) {
  const data = loadAccessData();
  const clean = String(txHash || '').trim().toLowerCase();
  
  const inPending = data.pending.some(p => String(p.txHash || '').trim().toLowerCase() === clean);
  const inProcessed = (data.processedTxHashes || []).map(h => String(h).trim().toLowerCase()).includes(clean);

  return inPending || inProcessed;
}

// --- TELEGRAM INITDATA AUTHENTICATION ---
function verifyTelegramInitData(initDataString, botToken) {
  if (!initDataString || !botToken) return false;
  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(key => `${key}=${params.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (e) {
    return false;
  }
}

function isAdmin(userId) {
  if (!userId) return false;
  const data = loadAccessData();
  return data.admins.includes(String(userId));
}

function hasAccess(userId, username) {
  if (!userId && !username) return false;
  const data = loadAccessData();
  if (userId && data.whitelist.includes(String(userId))) return true;
  if (username) {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    if (data.whitelist.map(u => u.replace(/^@/, '').toLowerCase()).includes(cleanUsername)) {
      return true;
    }
  }
  return false;
}

function getPendingRequest(userId) {
  const data = loadAccessData();
  return data.pending.find(p => String(p.userId) === String(userId)) || null;
}

function createBuyRequest({ userId, username, txHash, network }) {
  const cleanUserId = String(userId);
  const cleanUsername = username ? String(username).replace(/^@/, '') : '';

  // 1. Validate TXID format
  const validation = validateTxHash(txHash, network);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Replay protection / Deduplication
  if (isTxHashUsed(validation.cleanHash)) {
    throw new Error('Этот хеш транзакции (TXID) уже был использован ранее или ожидает проверки.');
  }

  const data = loadAccessData();

  // Remove any existing pending request for this user
  data.pending = data.pending.filter(p => String(p.userId) !== cleanUserId);

  const newRequest = {
    userId: cleanUserId,
    username: cleanUsername,
    txHash: validation.cleanHash,
    network: network || 'TRC20',
    createdAt: Date.now(),
    status: 'pending'
  };

  data.pending.unshift(newRequest);
  saveAccessData(data);
  return newRequest;
}

function approveRequest(adminId, targetUserId) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  const cleanTarget = String(targetUserId);

  const reqIndex = data.pending.findIndex(p => String(p.userId) === cleanTarget);
  let approvedItem = null;
  if (reqIndex !== -1) {
    approvedItem = data.pending[reqIndex];
    data.pending.splice(reqIndex, 1);
  }

  if (!data.whitelist.includes(cleanTarget)) {
    data.whitelist.push(cleanTarget);
  }
  if (approvedItem?.username && !data.whitelist.includes(approvedItem.username)) {
    data.whitelist.push(approvedItem.username);
  }

  // Mark TXID as processed to prevent replay
  if (approvedItem?.txHash) {
    if (!Array.isArray(data.processedTxHashes)) data.processedTxHashes = [];
    if (!data.processedTxHashes.includes(approvedItem.txHash)) {
      data.processedTxHashes.push(approvedItem.txHash);
    }
  }

  saveAccessData(data);
  return { success: true, targetUserId: cleanTarget };
}

function rejectRequest(adminId, targetUserId) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  data.pending = data.pending.filter(p => String(p.userId) !== String(targetUserId));
  saveAccessData(data);
  return { success: true };
}

function grantAccess(adminId, identifier) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  const clean = String(identifier).trim().replace(/^@/, '');
  if (!clean) throw new Error('Empty identifier');

  if (!data.whitelist.includes(clean)) {
    data.whitelist.push(clean);
  }

  if (Array.isArray(data.leads)) {
    const lead = data.leads.find(l => l.id === clean || (l.username && l.username.toLowerCase() === clean.toLowerCase()));
    if (lead) lead.status = 'licensed';
  }

  saveAccessData(data);
  return { success: true, identifier: clean };
}

function revokeAccess(adminId, identifier) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  const clean = String(identifier).trim().replace(/^@/, '');
  if (clean === SUPER_ADMIN_ID) throw new Error('Cannot revoke SuperAdmin');

  data.whitelist = data.whitelist.filter(id => id !== clean);
  saveAccessData(data);
  return { success: true, identifier: clean };
}

function updateWallet(adminId, { trc20, ton }) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  if (trc20 !== undefined) data.wallet.trc20 = String(trc20).trim();
  if (ton !== undefined) data.wallet.ton = String(ton).trim();
  saveAccessData(data);
  return data.wallet;
}

function recordVisitor({ userId, username, firstName, lastName, isPremium, languageCode, action }) {
  if (!userId) return null;
  const cleanId = String(userId).trim();
  const cleanUsername = username ? String(username).trim().replace(/^@/, '') : '';
  const now = new Date().toISOString();

  const data = loadAccessData();
  if (!Array.isArray(data.leads)) data.leads = [];

  const isWhitelisted = data.whitelist.includes(cleanId) || (cleanUsername && data.whitelist.includes(cleanUsername));
  const isSuperAdmin = cleanId === SUPER_ADMIN_ID;

  let lead = data.leads.find(l => l.id === cleanId || (cleanUsername && l.username && l.username.toLowerCase() === cleanUsername.toLowerCase()));

  if (lead) {
    lead.lastSeen = now;
    lead.visitsCount = (lead.visitsCount || 1) + 1;
    if (cleanUsername) lead.username = cleanUsername;
    if (firstName) lead.firstName = String(firstName).trim();
    if (lastName) lead.lastName = String(lastName).trim();
    if (isPremium !== undefined) lead.isPremium = !!isPremium;
    if (languageCode) lead.languageCode = String(languageCode).trim();
    if (!Array.isArray(lead.actions)) lead.actions = [];
    if (action && !lead.actions.includes(action)) lead.actions.push(action);

    if (isSuperAdmin) {
      lead.status = 'admin';
    } else if (isWhitelisted) {
      lead.status = 'licensed';
    } else if (action === 'clicked_buy' || lead.actions.includes('clicked_buy')) {
      lead.status = 'interested';
    }
  } else {
    lead = {
      id: cleanId,
      username: cleanUsername,
      firstName: firstName ? String(firstName).trim() : '',
      lastName: lastName ? String(lastName).trim() : '',
      isPremium: !!isPremium,
      languageCode: languageCode ? String(languageCode).trim() : 'ru',
      firstSeen: now,
      lastSeen: now,
      visitsCount: 1,
      actions: action ? [action] : ['visited'],
      status: isSuperAdmin ? 'admin' : (isWhitelisted ? 'licensed' : (action === 'clicked_buy' ? 'interested' : 'visited'))
    };
    data.leads.unshift(lead);
  }

  if (data.leads.length > 500) {
    data.leads = data.leads.slice(0, 500);
  }

  saveAccessData(data);
  return lead;
}

function getLeads(adminId) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  const leads = Array.isArray(data.leads) ? data.leads : [];
  return [...leads].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

function getOverview(adminId) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  const leads = Array.isArray(data.leads) ? data.leads : [];
  const sortedLeads = [...leads].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return {
    admins: data.admins,
    whitelist: data.whitelist,
    pending: data.pending,
    wallet: data.wallet,
    leads: sortedLeads,
    leadsStats: {
      total: leads.length,
      interested: leads.filter(l => l.status === 'interested' || (Array.isArray(l.actions) && l.actions.includes('clicked_buy'))).length,
      premium: leads.filter(l => l.isPremium).length,
      licensed: leads.filter(l => l.status === 'licensed' || data.whitelist.includes(l.id) || (l.username && data.whitelist.includes(l.username))).length
    }
  };
}

module.exports = {
  SUPER_ADMIN_ID,
  isAdmin,
  hasAccess,
  getPendingRequest,
  createBuyRequest,
  approveRequest,
  rejectRequest,
  grantAccess,
  revokeAccess,
  updateWallet,
  getOverview,
  recordVisitor,
  getLeads,
  loadAccessData,
  validateTxHash,
  isTxHashUsed,
  verifyTelegramInitData,
  initDatabase
};
