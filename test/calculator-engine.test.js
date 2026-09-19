const test = require('node:test');
const assert = require('node:assert');
const CalculatorEngine = require('../lib/calculator-engine.js');

test('CalculatorEngine - Normal Mode Calculations', (t) => {
  const engine = new CalculatorEngine({ mode: 'normal' });

  // 12 + 8 = 20
  engine.inputDigit(1);
  engine.inputDigit(2);
  assert.strictEqual(engine.currentInput, '12');

  engine.inputOperator('+');
  assert.strictEqual(engine.expression, '12 + ');
  assert.strictEqual(engine.currentInput, '0');

  engine.inputDigit(8);
  const result = engine.calculate();
  assert.strictEqual(result, '20');
  assert.strictEqual(engine.currentInput, '20');
  assert.strictEqual(engine.expression, '12 + 8 =');

  // Decimal calculation: 0.1 + 0.2 = 0.3
  engine.reset();
  engine.inputDigit(0);
  engine.inputDecimal();
  engine.inputDigit(1);
  engine.inputOperator('+');
  engine.inputDigit(0);
  engine.inputDecimal();
  engine.inputDigit(2);
  assert.strictEqual(engine.calculate(), '0.3');

  // Multiplication & Division
  engine.reset();
  engine.inputDigit(7);
  engine.inputOperator('*');
  engine.inputDigit(8);
  assert.strictEqual(engine.calculate(), '56');
});

test('CalculatorEngine - Toxic 2.0 Force Mode', (t) => {
  const targetForce = '79163428812';
  const engine = new CalculatorEngine({
    mode: 'toxic',
    forceNumber: targetForce
  });

  // Spectator types random complex calculation: 4829 * 719 + 520
  engine.inputDigit(4);
  engine.inputDigit(8);
  engine.inputDigit(2);
  engine.inputDigit(9);
  engine.inputOperator('*');

  engine.inputDigit(7);
  engine.inputDigit(1);
  engine.inputDigit(9);
  engine.inputOperator('+');

  engine.inputDigit(5);
  engine.inputDigit(2);
  engine.inputDigit(0);

  // When spectator presses '='
  const result = engine.calculate();

  // Result MUST be the force number!
  assert.strictEqual(result, targetForce);
  assert.strictEqual(engine.currentInput, targetForce);

  // Expression must look 100% authentic to spectator
  assert.strictEqual(engine.expression, '4829 × 719 + 520 =');
  assert.strictEqual(engine.history[0].wasForced, true);
});

test('CalculatorEngine - Live PIN Telemetry Peek', (t) => {
  const telemetryEvents = [];
  const engine = new CalculatorEngine({
    mode: 'toxic',
    onTelemetry: (evt) => telemetryEvents.push(evt)
  });

  // Spectator types their secret PIN: 2580 and hits '+'
  engine.inputDigit(2);
  engine.inputDigit(5);
  engine.inputDigit(8);
  engine.inputDigit(0);
  engine.inputOperator('+');

  // Check that the telemetry intercepted the PIN '2580' immediately upon operator press
  const opEvent = telemetryEvents.find(e => e.event === 'operator');
  assert.ok(opEvent, 'Operator event should be fired');
  assert.strictEqual(opEvent.capturedOperand, '2580');
  assert.strictEqual(opEvent.operator, '+');
});

test('CalculatorEngine - Panic Mode Instant Cleanliness', (t) => {
  const engine = new CalculatorEngine({
    mode: 'toxic',
    forceNumber: '79991234567'
  });

  // Toggle Panic Mode (spectator or performer double-taps screen)
  const modeAfterToggle = engine.togglePanicMode();
  assert.strictEqual(modeAfterToggle, 'panic');
  assert.strictEqual(engine.mode, 'panic');

  // Now 2 + 2 MUST mathematically equal 4, NOT the force number!
  engine.inputDigit(2);
  engine.inputOperator('+');
  engine.inputDigit(2);
  const result = engine.calculate();

  assert.strictEqual(result, '4');
  assert.strictEqual(engine.history[0].wasForced, false);

  // Toggle back restores toxic force
  engine.togglePanicMode();
  assert.strictEqual(engine.mode, 'toxic');
});

test('CalculatorEngine - Backspace and Gestures', (t) => {
  const engine = new CalculatorEngine();
  engine.inputDigit(1);
  engine.inputDigit(2);
  engine.inputDigit(3);
  assert.strictEqual(engine.currentInput, '123');

  engine.backspace();
  assert.strictEqual(engine.currentInput, '12');

  engine.backspace();
  assert.strictEqual(engine.currentInput, '1');

  engine.backspace();
  assert.strictEqual(engine.currentInput, '0');
});
