const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const accessManager = require('../lib/access-manager.js');
const { startServer, stopServer } = require('../server.js');

test('AccessManager - Core Access & Admin Logic', (t) => {
  const superAdmin = '7357950968';
  const testUser = '1122334455';
  const testUsername = 'test_magician';
  const validTronTx = 'e1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80';

  // 1. SuperAdmin checks
  assert.strictEqual(accessManager.isAdmin(superAdmin), true);
  assert.strictEqual(accessManager.hasAccess(superAdmin), true);
  assert.strictEqual(accessManager.isAdmin(testUser), false);

  // 2. Anti-fraud: invalid TXID format rejected
  assert.throws(() => {
    accessManager.createBuyRequest({
      userId: testUser,
      username: testUsername,
      txHash: 'invalid_short_hash',
      network: 'TRC20'
    });
  }, /Некорректный TXID/);

  // 3. Valid Buy request creation
  const buyReq = accessManager.createBuyRequest({
    userId: testUser,
    username: testUsername,
    txHash: validTronTx,
    network: 'TRC20'
  });
  assert.strictEqual(buyReq.userId, testUser);
  assert.strictEqual(buyReq.txHash, validTronTx);

  const pending = accessManager.getPendingRequest(testUser);
  assert.notStrictEqual(pending, null);
  assert.strictEqual(pending.txHash, validTronTx);

  // 4. Anti-fraud: Duplicate TXID rejected (Replay protection)
  assert.throws(() => {
    accessManager.createBuyRequest({
      userId: 'another_user',
      username: 'another_magician',
      txHash: validTronTx,
      network: 'TRC20'
    });
  }, /уже был использован ранее/);

  // 5. Admin approval
  const approveRes = accessManager.approveRequest(superAdmin, testUser);
  assert.strictEqual(approveRes.success, true);
  assert.strictEqual(accessManager.hasAccess(testUser), true);
  assert.strictEqual(accessManager.hasAccess(null, testUsername), true);
  assert.strictEqual(accessManager.getPendingRequest(testUser), null);

  // 6. Manual grant & revoke
  const manualUser = '9988776655';
  assert.strictEqual(accessManager.hasAccess(manualUser), false);
  accessManager.grantAccess(superAdmin, manualUser);
  assert.strictEqual(accessManager.hasAccess(manualUser), true);

  accessManager.revokeAccess(superAdmin, manualUser);
  assert.strictEqual(accessManager.hasAccess(manualUser), false);

  // 7. Protect SuperAdmin from revocation
  assert.throws(() => {
    accessManager.revokeAccess(superAdmin, superAdmin);
  }, /Cannot revoke SuperAdmin/);

  // 8. Non-admin unauthorized actions
  assert.throws(() => {
    accessManager.approveRequest('random_intruder', testUser);
  }, /Unauthorized/);

  // 9. Telegram initData HMAC validation
  const testBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const dataParams = new URLSearchParams({
    auth_date: '1726770000',
    query_id: 'AAG_xyz',
    user: JSON.stringify({ id: 7357950968, first_name: 'Operator' })
  });
  const sortedKeys = Array.from(dataParams.keys()).sort();
  const dataCheckString = sortedKeys.map(k => `${k}=${dataParams.get(k)}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(testBotToken).digest();
  const validHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  dataParams.set('hash', validHash);

  assert.strictEqual(accessManager.verifyTelegramInitData(dataParams.toString(), testBotToken), true);
  assert.strictEqual(accessManager.verifyTelegramInitData(dataParams.toString() + 'tampered', testBotToken), false);
});

test('Access API & Admin REST Endpoints with Security Headers', async (t) => {
  const { port } = await startServer(0);
  const baseUrl = `http://127.0.0.1:${port}`;
  const superAdmin = '7357950968';
  const buyerId = '5544332211';
  const validTx = 'f0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a5968778695a4b3c2d1e0f';

  // 1. Check Security Headers
  const headRes = await fetch(`${baseUrl}/api/status`);
  assert.strictEqual(headRes.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(headRes.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.ok(headRes.headers.get('content-security-policy').includes('frame-ancestors'));

  // 2. GET /api/access/check for guest
  const res1 = await fetch(`${baseUrl}/api/access/check?userId=${buyerId}&username=guest_buyer`);
  const data1 = await res1.json();
  assert.strictEqual(data1.isAdmin, false);
  assert.strictEqual(data1.hasAccess, false);

  // 3. POST /api/access/buy-request with valid TXID
  const res2 = await fetch(`${baseUrl}/api/access/buy-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: buyerId,
      username: '@guest_buyer',
      txHash: validTx,
      network: 'TRC20'
    })
  });
  const data2 = await res2.json();
  assert.strictEqual(data2.success, true);

  // 4. GET /api/admin/overview as SuperAdmin
  const res3 = await fetch(`${baseUrl}/api/admin/overview?adminId=${superAdmin}`);
  const data3 = await res3.json();
  assert.ok(Array.isArray(data3.pending));
  assert.ok(data3.pending.some(p => p.userId === buyerId));

  // 5. POST /api/admin/approve
  const res4 = await fetch(`${baseUrl}/api/admin/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminId: superAdmin,
      targetUserId: buyerId
    })
  });
  const data4 = await res4.json();
  assert.strictEqual(data4.success, true);

  // 6. Re-check access for buyer
  const res5 = await fetch(`${baseUrl}/api/access/check?userId=${buyerId}&username=guest_buyer`);
  const data5 = await res5.json();
  assert.strictEqual(data5.hasAccess, true);

  await stopServer();
});
