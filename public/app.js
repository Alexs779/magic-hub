/**
 * Chameleon Calculator - Client Application (Android Material You)
 */

(function () {
  'use strict';

  // --- AUDIO & HAPTIC FEEDBACK ---
  let audioCtx = null;
  function playClickSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.02);
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  function triggerHaptic(type = 'click') {
    if (typeof navigator.vibrate === 'function') {
      if (type === 'click') {
        navigator.vibrate(15);
      } else if (type === 'panic') {
        navigator.vibrate([40, 60, 40]);
      } else if (type === 'arm') {
        navigator.vibrate([60]);
      }
    }
  }

  // --- STATE & ENGINE ---
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room') || localStorage.getItem('chameleon_room') || 'default';
  localStorage.setItem('chameleon_room', roomId);

  let forceNumber = localStorage.getItem('chameleon_force') || '79163428812';
  let mode = localStorage.getItem('chameleon_mode') || 'toxic'; // 'toxic' | 'panic' | 'time'
  let skin = urlParams.get('skin') || localStorage.getItem('chameleon_skin') || 'android'; // 'android' | 'ios' | 'samsung'
  let currentInput = '0';
  let expression = '';
  let isResultShown = false;
  let historyList = [];

  // DOM Elements
  const mainDisplay = document.getElementById('mainDisplay');
  const historyLine = document.getElementById('historyLine');
  const displayArea = document.getElementById('displayArea');
  const clearBtn = document.getElementById('clearBtn');
  const equalsBtn = document.getElementById('equalsBtn');
  const dotBtn = document.getElementById('dotBtn');
  const menuBtn = document.getElementById('menuBtn');
  const secretStatusSpot = document.getElementById('secretStatusSpot');
  const menuModal = document.getElementById('menuModal');
  const secretConfigModal = document.getElementById('secretConfigModal');
  const secretForceInput = document.getElementById('secretForceInput');
  const secretModeSelect = document.getElementById('secretModeSelect');
  const secretSkinSelect = document.getElementById('secretSkinSelect');
  const secretSaveBtn = document.getElementById('secretSaveBtn');
  const secretOpenPerformerBtn = document.getElementById('secretOpenPerformerBtn');
  const secretCloseBtn = document.getElementById('secretCloseBtn');
  const currentRoomDisplay = document.getElementById('currentRoomDisplay');
  const drawerPillBtn = document.getElementById('drawerPillBtn');
  const scientificPanel = document.getElementById('scientificPanel');

  function applySkin(skinName) {
    skin = ['android', 'ios', 'samsung'].includes(skinName) ? skinName : 'android';
    localStorage.setItem('chameleon_skin', skin);
    document.body.classList.remove('skin-android', 'skin-ios', 'skin-samsung');
    document.body.classList.add(`skin-${skin}`);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      if (skin === 'ios') metaTheme.setAttribute('content', '#000000');
      else if (skin === 'samsung') metaTheme.setAttribute('content', '#171717');
      else metaTheme.setAttribute('content', '#1e1f22');
    }
  }
  applySkin(skin);

  if (currentRoomDisplay) currentRoomDisplay.textContent = roomId;

  // --- WEBSOCKET REALTIME CONNECTION ---
  let ws = null;
  let wsReconnectTimer = null;

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${encodeURIComponent(roomId)}&role=calculator&skin=${encodeURIComponent(skin)}`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Chameleon WS] Connected as Calculator in room:', roomId);
        sendTelemetry('client_ready');
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          handleWsMessage(data);
        } catch (err) {
          console.error('[WS Error] parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[Chameleon WS] Disconnected. Reconnecting in 2s...');
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.warn('[Chameleon WS] Socket error:', err);
        ws.close();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWebSocket, 2000);
  }

  function handleWsMessage(msg) {
    if (msg.type === 'init') {
      if (msg.forceNumber) {
        forceNumber = String(msg.forceNumber);
        localStorage.setItem('chameleon_force', forceNumber);
      }
      if (msg.mode) {
        mode = msg.mode;
        localStorage.setItem('chameleon_mode', mode);
      }
      // If client has an explicit skin from URL or localStorage, preserve it!
      const explicitSkin = urlParams.get('skin') || localStorage.getItem('chameleon_skin');
      if (explicitSkin) {
        applySkin(explicitSkin);
      } else if (msg.skin) {
        applySkin(msg.skin);
      }
    } else if (msg.type === 'config_updated') {
      if (msg.forceNumber) {
        forceNumber = String(msg.forceNumber);
        localStorage.setItem('chameleon_force', forceNumber);
      }
      if (msg.mode) {
        mode = msg.mode;
        localStorage.setItem('chameleon_mode', mode);
      }
      if (msg.skin) {
        applySkin(msg.skin);
      }
    }
  }

  function sendTelemetry(event, extra = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        event,
        timestamp: Date.now(),
        currentInput,
        expression,
        mode,
        skin,
        forceNumber,
        ...extra
      };
      ws.send(JSON.stringify({
        type: 'telemetry',
        payload
      }));
    }
  }

  connectWebSocket();

  // --- DISPLAY & FONT SCALING ---
  function updateDisplay() {
    mainDisplay.textContent = currentInput;
    historyLine.textContent = expression;

    // Clear button label: 'C' when there is input, 'AC' when zero and no expression
    if (currentInput !== '0' && !isResultShown) {
      clearBtn.textContent = 'C';
    } else {
      clearBtn.textContent = 'AC';
    }

    // Dynamic font-size scaling for Android Google Calculator feel
    const len = currentInput.length;
    if (len > 14) {
      mainDisplay.style.fontSize = '1.8rem';
    } else if (len > 10) {
      mainDisplay.style.fontSize = '2.3rem';
    } else if (len > 7) {
      mainDisplay.style.fontSize = '2.8rem';
    } else {
      mainDisplay.style.fontSize = '3.6rem';
    }
  }

  // --- CALCULATOR OPERATIONS ---
  function inputDigit(digit) {
    playClickSound();
    triggerHaptic('click');

    // Reset iOS active operator highlight
    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));

    if (isResultShown) {
      currentInput = String(digit);
      expression = '';
      isResultShown = false;
    } else {
      if (currentInput === '0' && digit !== '.') {
        currentInput = String(digit);
      } else {
        currentInput += String(digit);
      }
    }
    updateDisplay();
    sendTelemetry('digit', { digit });
  }

  function inputDecimal() {
    playClickSound();
    triggerHaptic('click');

    // Reset iOS active operator highlight
    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));

    if (isResultShown) {
      currentInput = '0.';
      expression = '';
      isResultShown = false;
    } else if (!currentInput.includes('.')) {
      currentInput += '.';
    }
    updateDisplay();
    sendTelemetry('decimal');
  }

  function inputOperator(op) {
    playClickSound();
    triggerHaptic('click');

    const symbolMap = { '/': '÷', '*': '×', '-': '−', '+': '+', '%': '%' };
    const displayOp = symbolMap[op] || op;

    // In iOS skin: highlight operator button with white background
    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));
    const opBtn = document.querySelector(`.btn-op[data-op="${op}"]`);
    if (opBtn && skin === 'ios') {
      opBtn.classList.add('active-op');
    }

    const capturedOperand = currentInput;

    if (isResultShown) {
      expression = `${currentInput} ${displayOp} `;
      isResultShown = false;
      currentInput = '0';
    } else {
      if (expression.endsWith('+ ') || expression.endsWith('− ') ||
          expression.endsWith('× ') || expression.endsWith('÷ ')) {
        if (currentInput === '0') {
          expression = expression.slice(0, -2) + `${displayOp} `;
          updateDisplay();
          sendTelemetry('operator', { operator: displayOp, capturedOperand });
          return;
        }
      }
      expression += `${currentInput} ${displayOp} `;
      currentInput = '0';
    }

    updateDisplay();
    sendTelemetry('operator', { operator: displayOp, capturedOperand });
  }

  function backspace() {
    playClickSound();
    triggerHaptic('click');

    if (isResultShown) {
      currentInput = '0';
      expression = '';
      isResultShown = false;
    } else if (currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
    } else {
      currentInput = '0';
    }
    updateDisplay();
    sendTelemetry('backspace');
  }

  function clearAll() {
    playClickSound();
    triggerHaptic('click');

    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));

    if (currentInput !== '0' && !isResultShown) {
      currentInput = '0';
    } else {
      currentInput = '0';
      expression = '';
      isResultShown = false;
    }
    updateDisplay();
    sendTelemetry('clear');
  }

  function calculate() {
    playClickSound();
    triggerHaptic('click');

    document.querySelectorAll('.btn-op').forEach(b => b.classList.remove('active-op'));

    const fullExpr = expression + currentInput;
    const capturedFinalOperand = currentInput;

    if (!expression && !isResultShown) {
      return;
    }

    // Mentalism Toxic 2.0 Force Mode OR Time Travel Mode
    if (mode === 'toxic' || mode === 'time') {
      const displayExpr = fullExpr + ' =';
      let forcedResult = String(forceNumber);

      if (mode === 'time') {
        const d = new Date();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        forcedResult = `${hours}${minutes}`;
      }

      historyList.push({ expression: fullExpr, result: forcedResult, wasForced: true });
      expression = displayExpr;
      currentInput = forcedResult;
      isResultShown = true;

      updateDisplay();
      sendTelemetry('calculate', {
        expression: fullExpr,
        result: forcedResult,
        wasForced: true,
        capturedFinalOperand
      });
      return;
    }

    // Normal / Panic Mode: mathematically evaluate
    try {
      const sanitized = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');

      if (!/^[\d\s+\-*/.()]+$/.test(sanitized)) {
        throw new Error('Invalid input');
      }

      const evalResult = Function(`'use strict'; return (${sanitized})`)();
      let formattedResult;
      if (!isFinite(evalResult)) {
        formattedResult = 'Ошибка';
      } else {
        formattedResult = String(Math.round(evalResult * 1e10) / 1e10);
      }

      historyList.push({ expression: fullExpr, result: formattedResult, wasForced: false });
      expression = fullExpr + ' =';
      currentInput = formattedResult;
      isResultShown = true;

      updateDisplay();
      sendTelemetry('calculate', {
        expression: fullExpr,
        result: formattedResult,
        wasForced: false,
        capturedFinalOperand
      });
    } catch (e) {
      currentInput = 'Ошибка';
      isResultShown = true;
      updateDisplay();
      sendTelemetry('error', { error: e.message });
    }
  }

  // --- SECRET TRIGGERS & PANIC MODE ---
  function togglePanicMode() {
    mode = mode === 'panic' ? 'toxic' : 'panic';
    localStorage.setItem('chameleon_mode', mode);

    // Distinct tactile feedback: 1 buzz for Clean/Normal mode, 2 buzzes for Toxic Force
    if (typeof navigator.vibrate === 'function') {
      if (mode === 'panic') {
        navigator.vibrate(35); // 1 firm buzz: Clean mode
      } else {
        navigator.vibrate([25, 45, 25]); // 2 quick buzzes: Force mode
      }
    }
    console.log('[Chameleon] Mode toggled to:', mode);

    sendTelemetry('mode_change', { mode });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_config',
        payload: { mode }
      }));
    }
  }

  // Trigger 1: Double-tap with two fingers anywhere on screen
  let lastTouchTime = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const now = Date.now();
      if (now - lastTouchTime < 400) {
        togglePanicMode();
      }
      lastTouchTime = now;
    }
  }, { passive: true });

  // Trigger 2: Triple tap on the status indicator spot (top-left)
  let statusTapCount = 0;
  let statusTapTimer = null;
  if (secretStatusSpot) {
    secretStatusSpot.addEventListener('click', () => {
      statusTapCount++;
      clearTimeout(statusTapTimer);
      if (statusTapCount >= 3) {
        togglePanicMode();
        statusTapCount = 0;
      } else {
        statusTapTimer = setTimeout(() => { statusTapCount = 0; }, 400);
      }
    });
  }

  // Trigger 3: Long-press on decimal button (.) for 800ms
  let dotPressTimer = null;
  if (dotBtn) {
    dotBtn.addEventListener('touchstart', () => {
      dotPressTimer = setTimeout(() => {
        triggerHaptic('arm');
        togglePanicMode();
      }, 800);
    }, { passive: true });

    dotBtn.addEventListener('touchend', () => {
      if (dotPressTimer) clearTimeout(dotPressTimer);
    });
    dotBtn.addEventListener('touchcancel', () => {
      if (dotPressTimer) clearTimeout(dotPressTimer);
    });
  }

  // Trigger 3b: Long-press on AC button (1.2s) opens Secret Config Modal
  let acPressTimer = null;
  if (clearBtn) {
    clearBtn.addEventListener('touchstart', () => {
      acPressTimer = setTimeout(() => {
        triggerHaptic('arm');
        openSecretModal();
      }, 1200);
    }, { passive: true });
    clearBtn.addEventListener('mousedown', () => {
      acPressTimer = setTimeout(() => {
        triggerHaptic('arm');
        openSecretModal();
      }, 1200);
    });
    clearBtn.addEventListener('touchend', () => { if (acPressTimer) clearTimeout(acPressTimer); });
    clearBtn.addEventListener('mouseup', () => { if (acPressTimer) clearTimeout(acPressTimer); });
    clearBtn.addEventListener('touchcancel', () => { if (acPressTimer) clearTimeout(acPressTimer); });
  }

  // Trigger 4: 3-4 taps on 3-dots Menu button opens Secret In-App Config
  let menuTapCount = 0;
  let menuTapTimer = null;
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuTapCount++;
    clearTimeout(menuTapTimer);

    if (menuTapCount >= 3) {
      // 3 rapid taps -> open secret modal
      openSecretModal();
      menuTapCount = 0;
    } else {
      // Wait to see if user taps again
      menuTapTimer = setTimeout(() => {
        if (menuTapCount === 1) {
          openMenuModal();
        }
        menuTapCount = 0;
      }, 450);
    }
  });

  // Normal 3-dots Menu
  function openMenuModal() {
    menuModal.classList.add('active');
  }

  function closeMenuModal() {
    menuModal.classList.remove('active');
  }

  menuModal.addEventListener('click', closeMenuModal);

  // Backdoor: Clicking 'Справка' in the normal menu immediately opens Secret Settings
  const menuHelp = document.getElementById('menuHelp');
  if (menuHelp) {
    menuHelp.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenuModal();
      openSecretModal();
    });
  }

  // Secret Modal Logic
  function openSecretModal() {
    secretForceInput.value = forceNumber;
    secretModeSelect.value = mode;
    if (secretSkinSelect) secretSkinSelect.value = skin;
    secretConfigModal.classList.add('active');
    setTimeout(() => {
      secretForceInput.focus();
    }, 150);
  }

  function closeSecretModal() {
    secretConfigModal.classList.remove('active');
  }

  secretCloseBtn.addEventListener('click', closeSecretModal);

  // Quick preset helper buttons in Secret Modal
  const presetPrefix8Btn = document.getElementById('presetPrefix8Btn');
  const presetPrefix7Btn = document.getElementById('presetPrefix7Btn');
  const presetClearBtn = document.getElementById('presetClearBtn');

  if (presetPrefix8Btn) {
    presetPrefix8Btn.addEventListener('click', () => {
      secretForceInput.value = '89';
      secretForceInput.focus();
    });
  }
  if (presetPrefix7Btn) {
    presetPrefix7Btn.addEventListener('click', () => {
      secretForceInput.value = '79';
      secretForceInput.focus();
    });
  }
  if (presetClearBtn) {
    presetClearBtn.addEventListener('click', () => {
      secretForceInput.value = '';
      secretForceInput.focus();
    });
  }

  secretSaveBtn.addEventListener('click', () => {
    const rawVal = secretForceInput.value.trim().replace(/[\s\-\(\)\+]/g, '');
    if (rawVal) {
      forceNumber = rawVal;
      localStorage.setItem('chameleon_force', forceNumber);
    }
    mode = secretModeSelect.value;
    localStorage.setItem('chameleon_mode', mode);

    if (secretSkinSelect) {
      skin = secretSkinSelect.value;
      applySkin(skin);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_config',
        payload: { forceNumber, mode, skin }
      }));
    }

    triggerHaptic('arm');
    const originalText = secretSaveBtn.textContent;
    secretSaveBtn.textContent = '✔ НАСТРОЙКИ СОХРАНЕНЫ!';
    secretSaveBtn.style.backgroundColor = '#4caf50';
    secretSaveBtn.style.color = '#ffffff';

    setTimeout(() => {
      secretSaveBtn.textContent = originalText;
      secretSaveBtn.style.backgroundColor = '#a8c7fa';
      secretSaveBtn.style.color = '#041e49';
      closeSecretModal();
    }, 900);
  });

  secretOpenPerformerBtn.addEventListener('click', () => {
    window.location.href = `/performer.html?room=${encodeURIComponent(roomId)}`;
  });

  // Check if ?setup=1 or ?config=1 in URL
  if (urlParams.has('setup') || urlParams.has('config')) {
    setTimeout(openSecretModal, 300);
  }

  // --- TOUCH GESTURE: SWIPE ON DISPLAY (LEFT: BACKSPACE, RIGHT: SECRET TOGGLE) ---
  let touchStartX = 0;
  let touchStartY = 0;

  displayArea.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  displayArea.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY);
      // Horizontal swipe left of at least 35px: Backspace
      if (diffX < -35 && diffY < 45) {
        backspace();
      } else if (diffX > 45 && diffY < 45) {
        // Horizontal swipe right of at least 45px: Secret toggle Clean ↔ Toxic!
        togglePanicMode();
      }
    }
  }, { passive: true });

  // --- KEYPAD BUTTON DELEGATION ---
  let lastClearTapTime = 0;

  document.querySelector('.keypad-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const num = btn.dataset.num;
    const op = btn.dataset.op;
    const action = btn.dataset.action;

    if (num !== undefined) {
      inputDigit(num);
    } else if (op !== undefined) {
      inputOperator(op);
    } else if (action === 'decimal') {
      inputDecimal();
    } else if (action === 'clear') {
      const now = Date.now();
      // Rapid double tap on AC / C within 350ms secretly toggles Clean ↔ Toxic!
      if (now - lastClearTapTime < 350) {
        togglePanicMode();
        lastClearTapTime = 0;
        return;
      }
      lastClearTapTime = now;
      clearAll();
    } else if (action === 'backspace') {
      backspace();
    } else if (action === 'equals') {
      calculate();
    } else if (action === 'percent') {
      inputOperator('%');
    }
  });

  // Scientific drawer toggle
  if (drawerPillBtn && scientificPanel) {
    drawerPillBtn.addEventListener('click', () => {
      drawerPillBtn.classList.toggle('expanded');
      scientificPanel.classList.toggle('open');
      triggerHaptic('click');
    });
  }

  // Keyboard support (for testing / desktop preview)
  window.addEventListener('keydown', (e) => {
    if (secretConfigModal.classList.contains('active')) return;

    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
    } else if (e.key === '.' || e.key === ',') {
      inputDecimal();
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      inputOperator(e.key);
    } else if (e.key === 'Enter' || e.key === '=') {
      calculate();
    } else if (e.key === 'Backspace') {
      backspace();
    } else if (e.key === 'Escape') {
      clearAll();
    }
  });

  // Service Worker Registration for PWA Offline
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('[PWA] SW register skipped:', err.message);
      });
    });
  }

  updateDisplay();
})();
