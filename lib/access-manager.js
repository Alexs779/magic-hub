const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
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
  wallet: {
    trc20: 'TLyv7R2cK8eZ9qP... (укажите адрес в админке)',
    ton: 'UQ... (укажите адрес в админке)'
  }
};

function loadAccessData() {
  try {
    if (!fs.existsSync(ACCESS_FILE)) {
      saveAccessData(defaultData);
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
    return data;
  } catch (e) {
    console.error('[AccessManager] Error loading access data:', e);
    return defaultData;
  }
}

function saveAccessData(data) {
  try {
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[AccessManager] Error saving access data:', e);
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
  const data = loadAccessData();
  const cleanUserId = String(userId);
  const cleanUsername = username ? String(username).replace(/^@/, '') : '';

  // Remove any existing pending request for this user
  data.pending = data.pending.filter(p => String(p.userId) !== cleanUserId);

  const newRequest = {
    userId: cleanUserId,
    username: cleanUsername,
    txHash: String(txHash || '').trim(),
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

function getOverview(adminId) {
  if (!isAdmin(adminId)) throw new Error('Unauthorized');
  const data = loadAccessData();
  return {
    admins: data.admins,
    whitelist: data.whitelist,
    pending: data.pending,
    wallet: data.wallet
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
  loadAccessData
};
