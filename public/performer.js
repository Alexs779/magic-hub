/**
 * Chameleon Calculator - Performer Stealth Console
 */

(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('room') || localStorage.getItem('chameleon_room') || 'default';
  localStorage.setItem('chameleon_room', roomId);

  let forceNumber = '79163428812';
  let mode = 'toxic'; // 'toxic' | 'panic' | 'time'
  let skin = 'android'; // 'android' | 'ios' | 'samsung'
  let ws = null;

  // DOM Elements
  const roomTag = document.getElementById('roomTag');
  const deviceCount = document.getElementById('deviceCount');
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
  const modeToxicBtn = document.getElementById('modeToxicBtn');
  const modeTimeBtn = document.getElementById('modeTimeBtn');
  const modePanicBtn = document.getElementById('modePanicBtn');
  const skinBadge = document.getElementById('skinBadge');
  const skinAndroidBtn = document.getElementById('skinAndroidBtn');
  const skinIosBtn = document.getElementById('skinIosBtn');
  const skinSamsungBtn = document.getElementById('skinSamsungBtn');
  const roomInput = document.getElementById('roomInput');
  const switchRoomBtn = document.getElementById('switchRoomBtn');
  const openCalcLink = document.getElementById('openCalcLink');
  const copyCalcLinkBtn = document.getElementById('copyCalcLinkBtn');

  // Presets
  const presetPhoneBtn = document.getElementById('presetPhoneBtn');
  const presetDateBtn = document.getElementById('presetDateBtn');
  const presetTimeBtn = document.getElementById('presetTimeBtn');
  const presetPinBtn = document.getElementById('presetPinBtn');

  function updateRoomUI() {
    roomTag.textContent = roomId;
    roomInput.value = roomId;
    const calcUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    openCalcLink.href = calcUrl;
  }

  updateRoomUI();

  // --- WEBSOCKET CONNECTION ---
  function connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${encodeURIComponent(roomId)}&role=performer`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Performer WS] Connected to room:', roomId);
      deviceCount.textContent = '● В сети';
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      deviceCount.textContent = '○ Отключен';
      setTimeout(connectWs, 2500);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function handleServerMessage(msg) {
    if (msg.type === 'init' || msg.type === 'config_updated') {
      if (msg.forceNumber) {
        forceNumber = msg.forceNumber;
        targetForceInput.value = forceNumber;
      }
      if (msg.mode) {
        setModeUI(msg.mode);
      }
      if (msg.skin) {
        setSkinUI(msg.skin);
      }
      if (msg.connectedDevices !== undefined) {
        deviceCount.textContent = `● ${msg.connectedDevices} устр.`;
      }
      if (msg.lastTelemetry) {
        renderTelemetry(msg.lastTelemetry);
      }
    } else if (msg.type === 'device_joined' || msg.type === 'device_left') {
      if (msg.connectedDevices !== undefined) {
        deviceCount.textContent = `● ${msg.connectedDevices} устр.`;
      }
    } else if (msg.type === 'telemetry') {
      renderTelemetry(msg.payload);
      triggerHapticAlert();
    }
  }

  function renderTelemetry(data) {
    if (!data) return;

    // 1. Live Expression
    if (data.expression || data.currentInput) {
      liveExpressionDisplay.textContent = (data.expression || '') + (data.currentInput !== undefined ? data.currentInput : '');
    }

    // 2. Captured PIN / Operand
    if (data.capturedOperand) {
      capturedPinDisplay.textContent = data.capturedOperand;
    } else if (data.capturedFinalOperand) {
      capturedPinDisplay.textContent = data.capturedFinalOperand;
    }

    // 3. Final Calculated Result
    if (data.event === 'calculate') {
      liveResultDisplay.textContent = `${data.result} ${data.wasForced ? '(ФОРСИРОВАНО)' : '(ТОЧНО)'}`;
    } else if (data.event === 'clear' || data.event === 'reset') {
      liveResultDisplay.textContent = '—';
    }
  }

  function triggerHapticAlert() {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(30);
    }
  }

  function sendConfig(newForce, newMode, newSkin) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_config',
        payload: {
          forceNumber: newForce !== undefined ? newForce : forceNumber,
          mode: newMode !== undefined ? newMode : mode,
          skin: newSkin !== undefined ? newSkin : skin
        }
      }));
    }
  }

  function setModeUI(newMode) {
    mode = newMode;
    modeToxicBtn.classList.remove('active');
    modeTimeBtn.classList.remove('active');
    modePanicBtn.classList.remove('active');

    if (mode === 'toxic') {
      modeBadge.textContent = 'TOXIC АКТИВЕН';
      modeBadge.style.borderColor = '#8ab4f8';
      modeToxicBtn.classList.add('active');
    } else if (mode === 'time') {
      modeBadge.textContent = 'TIME TRAVEL';
      modeBadge.style.borderColor = '#ffb74d';
      modeTimeBtn.classList.add('active');
    } else {
      modeBadge.textContent = 'PANIC (ОБЫЧНЫЙ)';
      modeBadge.style.borderColor = '#ff8a80';
      modePanicBtn.classList.add('active');
    }
  }

  function setSkinUI(newSkin) {
    skin = newSkin;
    skinAndroidBtn.classList.remove('active');
    skinIosBtn.classList.remove('active');
    skinSamsungBtn.classList.remove('active');

    if (skin === 'ios') {
      skinBadge.textContent = 'APPLE iOS 18';
      skinBadge.style.borderColor = '#ff9f0a';
      skinIosBtn.classList.add('active');
    } else if (skin === 'samsung') {
      skinBadge.textContent = 'SAMSUNG';
      skinBadge.style.borderColor = '#00d26a';
      skinSamsungBtn.classList.add('active');
    } else {
      skinBadge.textContent = 'ANDROID';
      skinBadge.style.borderColor = '#8ab4f8';
      skinAndroidBtn.classList.add('active');
    }
  }

  // --- BUTTON HANDLERS ---
  updateForceBtn.addEventListener('click', () => {
    const val = targetForceInput.value.trim();
    if (val) {
      forceNumber = val;
      sendConfig(forceNumber, mode, skin);
      triggerHapticAlert();
    }
  });

  modeToxicBtn.addEventListener('click', () => {
    setModeUI('toxic');
    sendConfig(forceNumber, 'toxic', skin);
  });

  modeTimeBtn.addEventListener('click', () => {
    setModeUI('time');
    sendConfig(forceNumber, 'time', skin);
  });

  modePanicBtn.addEventListener('click', () => {
    setModeUI('panic');
    sendConfig(forceNumber, 'panic', skin);
  });

  // Skin Buttons
  skinAndroidBtn.addEventListener('click', () => {
    setSkinUI('android');
    sendConfig(forceNumber, mode, 'android');
    triggerHapticAlert();
  });

  skinIosBtn.addEventListener('click', () => {
    setSkinUI('ios');
    sendConfig(forceNumber, mode, 'ios');
    triggerHapticAlert();
  });

  skinSamsungBtn.addEventListener('click', () => {
    setSkinUI('samsung');
    sendConfig(forceNumber, mode, 'samsung');
    triggerHapticAlert();
  });

  // Presets
  presetPhoneBtn.addEventListener('click', () => {
    forceNumber = '79163428812';
    targetForceInput.value = forceNumber;
    sendConfig(forceNumber, 'toxic');
  });

  presetDateBtn.addEventListener('click', () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    forceNumber = `${day}${month}`; // e.g. 0309
    targetForceInput.value = forceNumber;
    sendConfig(forceNumber, 'toxic');
  });

  presetTimeBtn.addEventListener('click', () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    forceNumber = `${hours}${minutes}`; // e.g. 1450
    targetForceInput.value = forceNumber;
    sendConfig(forceNumber, 'toxic');
  });

  presetPinBtn.addEventListener('click', () => {
    forceNumber = '2580';
    targetForceInput.value = forceNumber;
    sendConfig(forceNumber, 'toxic');
  });

  // Stealth vs Setup Brightness toggle
  stealthModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('setup-mode');
  });

  // Emergency Notes Screen
  emergencyToggleBtn.addEventListener('click', () => {
    emergencyScreen.classList.add('active');
  });

  exitEmergencyBtn.addEventListener('click', () => {
    emergencyScreen.classList.remove('active');
  });

  // Room switcher
  switchRoomBtn.addEventListener('click', () => {
    const newRoom = roomInput.value.trim().toLowerCase();
    if (newRoom && newRoom !== roomId) {
      window.location.search = `?room=${encodeURIComponent(newRoom)}`;
    }
  });

  // Copy Calculator URL
  copyCalcLinkBtn.addEventListener('click', () => {
    const calcUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(calcUrl).then(() => {
      const origText = copyCalcLinkBtn.textContent;
      copyCalcLinkBtn.textContent = 'Скопировано!';
      setTimeout(() => { copyCalcLinkBtn.textContent = origText; }, 1500);
    });
  });

  connectWs();
})();
