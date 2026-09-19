const test = require('node:test');
const assert = require('node:assert');
const { WebSocket } = require('ws');
const { server, startServer, stopServer } = require('../server.js');

test('Server WebSocket Telemetry & Config Flow', async (t) => {
  const { port } = await startServer(0);
  const wsUrl = `ws://127.0.0.1:${port}`;
  const testRoom = 'test-room-' + Date.now();

  // Helper to create a WS client with message queue
  function createClient(role) {
    const ws = new WebSocket(`${wsUrl}?room=${testRoom}&role=${role}`);
    const messages = [];
    const listeners = [];

    ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (listeners.length > 0) {
        const fn = listeners.shift();
        fn(parsed);
      } else {
        messages.push(parsed);
      }
    });

    function nextMessage(filterFn = null, timeout = 3000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('nextMessage timeout')), timeout);

        function check() {
          if (messages.length > 0) {
            for (let i = 0; i < messages.length; i++) {
              if (!filterFn || filterFn(messages[i])) {
                clearTimeout(timer);
                return resolve(messages.splice(i, 1)[0]);
              }
            }
          }
          listeners.push((msg) => {
            if (!filterFn || filterFn(msg)) {
              clearTimeout(timer);
              resolve(msg);
            } else {
              check();
            }
          });
        }
        check();
      });
    }

    const openPromise = new Promise((res) => ws.on('open', res));
    return { ws, openPromise, nextMessage };
  }

  const performer = createClient('performer');
  await performer.openPromise;

  const calculator = createClient('calculator');
  await calculator.openPromise;

  // 1. Calculator receives init message
  const initMsg = await calculator.nextMessage((m) => m.type === 'init');
  assert.strictEqual(initMsg.type, 'init');
  assert.strictEqual(initMsg.roomId, testRoom);

  // 2. Performer sets new force number
  performer.ws.send(JSON.stringify({
    type: 'set_config',
    payload: { forceNumber: '12345678', mode: 'toxic' }
  }));

  const updatedConfig = await calculator.nextMessage((m) => m.type === 'config_updated');
  assert.strictEqual(updatedConfig.forceNumber, '12345678');

  // 3. Calculator sends live PIN telemetry
  calculator.ws.send(JSON.stringify({
    type: 'telemetry',
    payload: {
      event: 'operator',
      capturedOperand: '9988',
      operator: '+',
      expression: '9988 + '
    }
  }));

  const telemetry = await performer.nextMessage((m) => m.type === 'telemetry');
  assert.strictEqual(telemetry.payload.capturedOperand, '9988');
  assert.strictEqual(telemetry.payload.operator, '+');

  performer.ws.terminate();
  calculator.ws.terminate();
  await stopServer();
});
