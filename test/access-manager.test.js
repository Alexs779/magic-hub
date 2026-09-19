const test = require('node:test');
const assert = require('node:assert');
const accessManager = require('../lib/access-manager.js');
const { startServer, stopServer } = require('../server.js');

test('AccessManager - Core Access & Admin Logic', (t) => {
  const superAdmin = '7357950968';
  const testUser = '1122334455';
  const testUsername = 'test_magician';

  // 1. SuperAdmin checks
  assert.strictEqual(accessManager.isAdmin(superAdmin), true);
  assert.strictEqual(accessManager.hasAccess(superAdmin), true);
  assert.strictEqual(accessManager.isAdmin(testUser), false);

  // 2. Buy request creation
  const buyReq = accessManager.createBuyRequest({
    userId: testUser,
    username: testUsername,
    txHash: '0xabc123456789deadbeef',
    network: 'TRC20'
  });
  assert.strictEqual(buyReq.userId, testUser);
  assert.strictEqual(buyReq.txHash, '0xabc123456789deadbeef');

  const pending = accessManager.getPendingRequest(testUser);
  assert.notStrictEqual(pending, null);
  assert.strictEqual(pending.txHash, '0xabc123456789deadbeef');

  // 3. Admin approval
  const approveRes = accessManager.approveRequest(superAdmin, testUser);
  assert.strictEqual(approveRes.success, true);
  assert.strictEqual(accessManager.hasAccess(testUser), true);
  assert.strictEqual(accessManager.hasAccess(null, testUsername), true);
  assert.strictEqual(accessManager.getPendingRequest(testUser), null);

  // 4. Manual grant & revoke
  const manualUser = '9988776655';
  assert.strictEqual(accessManager.hasAccess(manualUser), false);
  accessManager.grantAccess(superAdmin, manualUser);
  assert.strictEqual(accessManager.hasAccess(manualUser), true);

  accessManager.revokeAccess(superAdmin, manualUser);
  assert.strictEqual(accessManager.hasAccess(manualUser), false);

  // 5. Protect SuperAdmin from revocation
  assert.throws(() => {
    accessManager.revokeAccess(superAdmin, superAdmin);
  }, /Cannot revoke SuperAdmin/);

  // 6. Non-admin unauthorized actions
  assert.throws(() => {
    accessManager.approveRequest('random_intruder', testUser);
  }, /Unauthorized/);
});

test('Access API & Admin REST Endpoints', async (t) => {
  const { port } = await startServer(0);
  const baseUrl = `http://127.0.0.1:${port}`;
  const superAdmin = '7357950968';
  const buyerId = '5544332211';

  // 1. GET /api/access/check for guest
  const res1 = await fetch(`${baseUrl}/api/access/check?userId=${buyerId}&username=guest_buyer`);
  const data1 = await res1.json();
  assert.strictEqual(data1.isAdmin, false);
  assert.strictEqual(data1.hasAccess, false);

  // 2. POST /api/access/buy-request
  const res2 = await fetch(`${baseUrl}/api/access/buy-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: buyerId,
      username: '@guest_buyer',
      txHash: 'TX999888777666',
      network: 'TRC20'
    })
  });
  const data2 = await res2.json();
  assert.strictEqual(data2.success, true);

  // 3. GET /api/admin/overview as SuperAdmin
  const res3 = await fetch(`${baseUrl}/api/admin/overview?adminId=${superAdmin}`);
  const data3 = await res3.json();
  assert.ok(Array.isArray(data3.pending));
  assert.ok(data3.pending.some(p => p.userId === buyerId));

  // 4. POST /api/admin/approve
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

  // 5. Re-check access for buyer
  const res5 = await fetch(`${baseUrl}/api/access/check?userId=${buyerId}&username=guest_buyer`);
  const data5 = await res5.json();
  assert.strictEqual(data5.hasAccess, true);

  await stopServer();
});
