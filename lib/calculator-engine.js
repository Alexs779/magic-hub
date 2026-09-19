/**
 * Chameleon Calculator Engine
 * Core business & mentalism logic for Android Material You Calculator
 */

class CalculatorEngine {
  constructor(options = {}) {
    this.forceNumber = options.forceNumber || '79163428812';
    this.mode = options.mode || 'toxic'; // 'toxic' | 'normal' | 'panic'
    this.onTelemetry = options.onTelemetry || null;

    this.reset();
  }

  reset() {
    this.currentInput = '0';
    this.expression = '';
    this.lastResult = null;
    this.isResultShown = false;
    this.history = [];
    this.lastOperand = '';
    this.emitTelemetry('reset');
  }

  clear() {
    if (this.currentInput !== '0' && !this.isResultShown) {
      this.currentInput = '0';
    } else {
      this.reset();
    }
    this.emitTelemetry('clear');
  }

  backspace() {
    if (this.isResultShown) {
      // If showing result, backspace clears
      this.reset();
      return;
    }
    if (this.currentInput.length > 1) {
      this.currentInput = this.currentInput.slice(0, -1);
    } else {
      this.currentInput = '0';
    }
    this.emitTelemetry('backspace');
  }

  inputDigit(digit) {
    if (this.isResultShown) {
      this.currentInput = String(digit);
      this.expression = '';
      this.isResultShown = false;
    } else {
      if (this.currentInput === '0' && digit !== '.') {
        this.currentInput = String(digit);
      } else {
        this.currentInput += String(digit);
      }
    }
    this.emitTelemetry('digit', { digit });
  }

  inputDecimal() {
    if (this.isResultShown) {
      this.currentInput = '0.';
      this.expression = '';
      this.isResultShown = false;
    } else if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
    this.emitTelemetry('decimal');
  }

  inputOperator(op) {
    // Standardize operator display
    const symbolMap = {
      '+': '+',
      '-': '−',
      '*': '×',
      '×': '×',
      '/': '÷',
      '÷': '÷',
      '%': '%'
    };
    const displayOp = symbolMap[op] || op;

    // Live PIN telemetry hook: when an operator is pressed, the operand just entered is captured
    const capturedOperand = this.currentInput;
    this.lastOperand = capturedOperand;

    if (this.isResultShown) {
      this.expression = `${this.currentInput} ${displayOp} `;
      this.isResultShown = false;
      this.currentInput = '0';
    } else {
      if (this.expression.endsWith('+ ') || this.expression.endsWith('− ') ||
          this.expression.endsWith('× ') || this.expression.endsWith('÷ ')) {
        if (this.currentInput === '0') {
          // Replace operator if user hasn't typed new number
          this.expression = this.expression.slice(0, -2) + `${displayOp} `;
          this.emitTelemetry('operator', { operator: displayOp, capturedOperand });
          return;
        }
      }
      this.expression += `${this.currentInput} ${displayOp} `;
      this.currentInput = '0';
    }

    this.emitTelemetry('operator', { operator: displayOp, capturedOperand });
  }

  toggleSign() {
    if (this.currentInput !== '0') {
      if (this.currentInput.startsWith('-')) {
        this.currentInput = this.currentInput.slice(1);
      } else {
        this.currentInput = '-' + this.currentInput;
      }
      this.emitTelemetry('toggle_sign');
    }
  }

  calculate() {
    const fullExpr = this.expression + this.currentInput;
    const capturedFinalOperand = this.currentInput;

    // If empty or already evaluated
    if (!this.expression && !this.isResultShown) {
      // Nothing to calculate
      return this.currentInput;
    }

    // Mentalism Toxic 2.0 Force Mode
    if (this.mode === 'toxic') {
      const displayExpr = fullExpr + ' =';
      const forcedResult = String(this.forceNumber);

      this.history.push({
        expression: fullExpr,
        result: forcedResult,
        wasForced: true
      });

      this.expression = displayExpr;
      this.currentInput = forcedResult;
      this.lastResult = forcedResult;
      this.isResultShown = true;

      this.emitTelemetry('calculate', {
        expression: fullExpr,
        result: forcedResult,
        wasForced: true,
        capturedFinalOperand
      });

      return forcedResult;
    }

    // Normal or Panic mode: evaluate mathematically
    try {
      const evalString = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');

      // Safe evaluation with math sanitization
      if (!/^[\d\s+\-*/.()]+$/.test(evalString)) {
        throw new Error('Invalid expression characters');
      }

      // Safe Function evaluation
      const mathResult = Function(`'use strict'; return (${evalString})`)();
      
      let formattedResult;
      if (!isFinite(mathResult)) {
        formattedResult = 'Ошибка';
      } else {
        // Fix floating point quirks like 0.1 + 0.2 = 0.30000000000000004
        formattedResult = String(Math.round(mathResult * 1e10) / 1e10);
      }

      this.history.push({
        expression: fullExpr,
        result: formattedResult,
        wasForced: false
      });

      this.expression = fullExpr + ' =';
      this.currentInput = formattedResult;
      this.lastResult = formattedResult;
      this.isResultShown = true;

      this.emitTelemetry('calculate', {
        expression: fullExpr,
        result: formattedResult,
        wasForced: false,
        capturedFinalOperand
      });

      return formattedResult;
    } catch (e) {
      this.currentInput = 'Ошибка';
      this.isResultShown = true;
      this.emitTelemetry('error', { error: e.message });
      return 'Ошибка';
    }
  }

  setForceNumber(num) {
    this.forceNumber = String(num).trim();
    this.emitTelemetry('config_change', { forceNumber: this.forceNumber });
  }

  setMode(newMode) {
    if (['toxic', 'normal', 'panic'].includes(newMode)) {
      this.mode = newMode;
      this.emitTelemetry('mode_change', { mode: this.mode });
    }
  }

  togglePanicMode() {
    if (this.mode === 'panic') {
      this.mode = 'toxic';
    } else {
      this.mode = 'panic';
    }
    this.emitTelemetry('panic_toggle', { mode: this.mode });
    return this.mode;
  }

  emitTelemetry(event, data = {}) {
    if (typeof this.onTelemetry === 'function') {
      this.onTelemetry({
        event,
        timestamp: Date.now(),
        currentInput: this.currentInput,
        expression: this.expression,
        mode: this.mode,
        forceNumber: this.forceNumber,
        ...data
      });
    }
  }

  getState() {
    return {
      currentInput: this.currentInput,
      expression: this.expression,
      isResultShown: this.isResultShown,
      mode: this.mode,
      forceNumber: this.forceNumber
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalculatorEngine;
}
