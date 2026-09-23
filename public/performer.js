/**
 * Chameleon Calculator - Performer Stealth Console
 * Minimalist, ultra-high-contrast mentalism telemetry & control
 */

(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('room') || localStorage.getItem('chameleon_room') || 'default';
  localStorage.setItem('chameleon_room', roomId);

  // Screen orientation lock
  try {
    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {}

  let forceNumber = localStorage.getItem('hub_user_phone') || '79163428812';
  let mode = 'toxic'; // 'toxic' | 'panic'
  let skin = 'ios';
  let ws = null;

  // DOM Elements
  const roomTag = document.getElementById('roomTag');
  const deviceCount = document.getElementById('deviceCount');
  const statusDot = document.getElementById('statusDot');
  const stealthModeToggle = document.getElementById('stealthModeToggle');
  const emergencyToggleBtn = document.getElementById('emergencyToggleBtn');
  const exitEmergencyBtn = document.getElementById('exitEmergencyBtn');
  const emergencyScreen = document.getElementById('emergencyScreen');

  const capturedPinDisplay = document.getElementById('capturedPinDisplay');
  const liveExpressionDisplay = document.getElementById('liveExpressionDisplay');
  const liveResultDisplay = document.getElementById('liveResultDisplay');
  const modeBadge = document.getElementById('modeBadge');

  const targetForceInput = document.getElementById('targetForceInput');
  const updateForceBtn = document.getElementById('updateForceBtn');

  // Presets (Super 5 Core)
  const presetPhoneBtn = document.getElementById('presetPhoneBtn');
  const presetDateBtn = document.getElementById('presetDateBtn');
  const presetTimeBtn = document.getElementById('presetTimeBtn');
  const presetPinBtn = document.getElementById('presetPinBtn');
  const presetBookBtn = document.getElementById('presetBookBtn');
  const presetCleanBtn = document.getElementById('presetCleanBtn');

  if (roomTag) roomTag.textContent = roomId;
  if (targetForceInput) targetForceInput.value = forceNumber;

  // --- WEBSOCKET ENGINE ---
  function connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${encodeURIComponent(roomId)}&role=performer`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Performer WS] Connected to room:', roomId);
      if (statusDot) statusDot.className = 'status-dot online';
      if (deviceCount) deviceCount.textContent = '● В сети';
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('[Performer WS] parse error:', e);
      }
    };

    ws.onclose = () => {
      if (statusDot) statusDot.className = 'status-dot';
      if (deviceCount) deviceCount.textContent = '○ Отключен';
      setTimeout(connectWs, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function handleServerMessage(msg) {
    if (msg.type === 'init' || msg.type === 'config_updated') {
      if (msg.forceNumber) {
        forceNumber = msg.forceNumber;
        if (targetForceInput) targetForceInput.value = forceNumber;
      }
      if (msg.mode) {
        mode = msg.mode;
      }
      if (msg.skin) {
        skin = msg.skin;
      }
      detectPresetByForce(forceNumber, mode);
      if (msg.connectedDevices !== undefined && deviceCount) {
        deviceCount.textContent = `● ${msg.connectedDevices} устр.`;
      }
      if (msg.lastTelemetry) {
        renderTelemetry(msg.lastTelemetry);
      }
    } else if (msg.type === 'device_joined' || msg.type === 'device_left') {
      if (msg.connectedDevices !== undefined && deviceCount) {
        deviceCount.textContent = `● ${msg.connectedDevices} устр.`;
      }
    } else if (msg.type === 'telemetry') {
      const data = msg.payload;
      renderTelemetry(data);
      if (data?.event === 'calculate') {
        triggerHapticAlert('calculate');
      } else if (data?.event === 'clear' || data?.event === 'reset') {
        triggerHapticAlert('clear');
      } else {
        triggerHapticAlert('input');
      }
    }
  }

  function renderTelemetry(data) {
    if (!data) return;

    // 1. Live Formula Stream
    if (data.expression || data.currentInput !== undefined) {
      const expr = (data.expression || '') + (data.currentInput !== undefined ? data.currentInput : '');
      if (liveExpressionDisplay) liveExpressionDisplay.textContent = expr || 'Ожидание зрителя...';
    }

    // 2. Captured Hero PIN / Secret Operand
    if (data.capturedOperand) {
      if (capturedPinDisplay) capturedPinDisplay.textContent = data.capturedOperand;
    } else if (data.capturedFinalOperand) {
      if (capturedPinDisplay) capturedPinDisplay.textContent = data.capturedFinalOperand;
    }

    // 3. Calculated Final Result
    if (data.event === 'calculate') {
      if (liveResultDisplay) {
        liveResultDisplay.textContent = `${data.result} ${data.wasForced ? '(ФОРСИРОВАНО)' : '(ТОЧНО)'}`;
        liveResultDisplay.classList.add('calculated');
      }
    } else if (data.event === 'clear' || data.event === 'reset') {
      if (liveResultDisplay) {
        liveResultDisplay.textContent = '—';
        liveResultDisplay.classList.remove('calculated');
      }
    }
  }

  // Tactile haptic feedback
  function triggerHapticAlert(type = 'input') {
    if (typeof navigator.vibrate === 'function') {
      if (type === 'calculate') {
        navigator.vibrate([60, 60, 60]); // Distinct double-pulse on '='
      } else if (type === 'clear') {
        navigator.vibrate([30, 40]);
      } else {
        navigator.vibrate(20); // Sharp micro-tick on keystroke
      }
    }
  }

  function sendConfig(newForce, newMode) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_config',
        payload: {
          forceNumber: newForce !== undefined ? newForce : forceNumber,
          mode: newMode !== undefined ? newMode : mode,
          skin: skin
        }
      }));
    }
  }

  // --- PRESET ACTIVE UI TRACKING ---
  function setActivePresetUI(activeBtn, badgeText, badgeColor = '#c084fc') {
    document.querySelectorAll('.preset-tiles-grid .preset-tile').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
    if (modeBadge && badgeText) {
      modeBadge.textContent = badgeText;
      modeBadge.style.borderColor = badgeColor;
      modeBadge.style.color = badgeColor;
    }
  }

  function detectPresetByForce(val, currentMode) {
    if (currentMode === 'panic') {
      setActivePresetUI(presetCleanBtn, '🛡️ ЧИСТЫЙ РЕЖИМ', '#22c55e');
      return;
    }
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const todayDate = `${day}${month}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}${mins}`;

    const savedPhone = localStorage.getItem('hub_user_phone') || '79163428812';

    if (val === savedPhone || (val && val.length >= 10)) {
      setActivePresetUI(presetPhoneBtn, '📞 ЗВОНОК В БУДУЩЕЕ');
    } else if (val === todayDate) {
      setActivePresetUI(presetDateBtn, '📅 ДАТА');
    } else if (val === currentTime) {
      setActivePresetUI(presetTimeBtn, '⏰ ВРЕМЯ');
    } else if (val === '2580') {
      setActivePresetUI(presetPinBtn, '🔑 PIN 2580');
    } else if (val === '147') {
      setActivePresetUI(presetBookBtn, '📖 КНИГА 147');
    } else {
      setActivePresetUI(null, '⚡ СВОЕ ЧИСЛО');
    }
  }

  // --- 1-TOUCH PRESET HANDLERS ---
  presetPhoneBtn?.addEventListener('click', () => {
    forceNumber = localStorage.getItem('hub_user_phone') || '79163428812';
    mode = 'toxic';
    targetForceInput.value = forceNumber;
    setActivePresetUI(presetPhoneBtn, '📞 ЗВОНОК В БУДУЩЕЕ');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('input');
  });

  presetDateBtn?.addEventListener('click', () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    forceNumber = `${day}${month}`;
    mode = 'toxic';
    targetForceInput.value = forceNumber;
    setActivePresetUI(presetDateBtn, '📅 ДАТА');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('input');
  });

  presetTimeBtn?.addEventListener('click', () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    forceNumber = `${hours}${minutes}`;
    mode = 'toxic';
    targetForceInput.value = forceNumber;
    setActivePresetUI(presetTimeBtn, '⏰ ВРЕМЯ');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('input');
  });

  presetPinBtn?.addEventListener('click', () => {
    forceNumber = '2580';
    mode = 'toxic';
    targetForceInput.value = forceNumber;
    setActivePresetUI(presetPinBtn, '🔑 PIN 2580');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('input');
  });

  presetBookBtn?.addEventListener('click', () => {
    forceNumber = '147';
    mode = 'toxic';
    targetForceInput.value = forceNumber;
    setActivePresetUI(presetBookBtn, '📖 КНИГА 147');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('input');
  });

  presetCleanBtn?.addEventListener('click', () => {
    mode = 'panic';
    setActivePresetUI(presetCleanBtn, '🛡️ ЧИСТЫЙ РЕЖИМ', '#22c55e');
    sendConfig(forceNumber, mode);
    triggerHapticAlert('clear');
  });

  // Custom force number
  updateForceBtn?.addEventListener('click', () => {
    const val = targetForceInput.value.trim().replace(/[\s\-\(\)\+]/g, '');
    if (val) {
      forceNumber = val;
      mode = 'toxic';
      sendConfig(forceNumber, mode);
      detectPresetByForce(forceNumber, mode);
      triggerHapticAlert('input');
    }
  });

  // --- EMERGENCY DISGUISE & STEALTH CONTROLS ---
  function toggleEmergency(show) {
    if (show) {
      emergencyScreen?.classList.add('active');
    } else {
      emergencyScreen?.classList.remove('active');
    }
  }

  emergencyToggleBtn?.addEventListener('click', () => {
    toggleEmergency(true);
    triggerHapticAlert('clear');
  });

  exitEmergencyBtn?.addEventListener('click', () => {
    toggleEmergency(false);
  });

  // 2-Finger secret tap anywhere to trigger emergency screen
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const isActive = emergencyScreen?.classList.contains('active');
      toggleEmergency(!isActive);
      triggerHapticAlert('clear');
    }
  }, { passive: false });

  // Brightness / Setup mode toggle
  stealthModeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('setup-mode');
    triggerHapticAlert('input');
  });

  // Start WebSocket
  connectWs();
  detectPresetByForce(forceNumber, mode);
})();
