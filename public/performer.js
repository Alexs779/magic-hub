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

  // Presets (Super 5 Core)
  const presetPhoneBtn = document.getElementById('presetPhoneBtn');
  const presetDateBtn = document.getElementById('presetDateBtn');
  const presetTimeBtn = document.getElementById('presetTimeBtn');
  const presetPinBtn = document.getElementById('presetPinBtn');
  const presetBookBtn = document.getElementById('presetBookBtn');
  const presetCleanBtn = document.getElementById('presetCleanBtn');

  function updateRoomUI() {
    if (roomTag) roomTag.textContent = roomId;
    if (roomInput) roomInput.value = roomId;
    if (openCalcLink) openCalcLink.href = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
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
      detectPresetByForce(forceNumber, mode);
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
      liveResultDisplay.classList.add('calculated');
    } else if (data.event === 'clear' || data.event === 'reset') {
      liveResultDisplay.textContent = '—';
      liveResultDisplay.classList.remove('calculated');
    }
  }

  // Tactical vibration engine
  function triggerHapticAlert(type = 'input') {
    if (typeof navigator.vibrate === 'function') {
      if (type === 'calculate') {
        navigator.vibrate([60, 70, 60]); // Distinct double-pulse: spectator pressed "="
      } else if (type === 'clear') {
        navigator.vibrate([25, 40, 25]);
      } else {
        navigator.vibrate(20); // Crisp single tick for key input
      }
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
    modeToxicBtn?.classList.remove('active');
    modeTimeBtn?.classList.remove('active');
    modePanicBtn?.classList.remove('active');

    if (mode === 'toxic') {
      if (modeBadge) {
        modeBadge.textContent = 'ФОРС АКТИВЕН';
        modeBadge.style.borderColor = '#c084fc';
      }
      modeToxicBtn?.classList.add('active');
    } else if (mode === 'time') {
      if (modeBadge) {
        modeBadge.textContent = 'TIME TRAVEL';
        modeBadge.style.borderColor = '#ffb74d';
      }
      modeTimeBtn?.classList.add('active');
    } else {
      if (modeBadge) {
        modeBadge.textContent = 'ЧИСТЫЙ РЕЖИМ';
        modeBadge.style.borderColor = '#00d26a';
      }
      modePanicBtn?.classList.add('active');
    }
  }

  function setSkinUI(newSkin) {
    skin = newSkin;
    skinAndroidBtn?.classList.remove('active');
    skinIosBtn?.classList.remove('active');
    skinSamsungBtn?.classList.remove('active');

    if (skinBadge) {
      if (skin === 'ios') {
        skinBadge.textContent = 'APPLE iOS 18';
        skinBadge.style.borderColor = '#ff9f0a';
      } else if (skin === 'samsung') {
        skinBadge.textContent = 'SAMSUNG';
        skinBadge.style.borderColor = '#00d26a';
      } else {
        skinBadge.textContent = 'ANDROID';
        skinBadge.style.borderColor = '#8ab4f8';
      }
    }
    if (skin === 'ios') skinIosBtn?.classList.add('active');
    else if (skin === 'samsung') skinSamsungBtn?.classList.add('active');
    else skinAndroidBtn?.classList.add('active');
  }

  // --- BUTTON HANDLERS ---
  updateForceBtn?.addEventListener('click', () => {
    const val = targetForceInput.value.trim();
    if (val) {
      forceNumber = val;
      setModeUI('toxic');
      sendConfig(forceNumber, 'toxic', skin);
      triggerHapticAlert('input');
    }
  });

  modeToxicBtn?.addEventListener('click', () => {
    setModeUI('toxic');
    sendConfig(forceNumber, 'toxic', skin);
    triggerHapticAlert('input');
  });

  modeTimeBtn?.addEventListener('click', () => {
    setModeUI('time');
    sendConfig(forceNumber, 'time', skin);
    triggerHapticAlert('input');
  });

  modePanicBtn?.addEventListener('click', () => {
    setModeUI('panic');
    sendConfig(forceNumber, 'panic', skin);
    triggerHapticAlert('clear');
  });

  // Skin Buttons (if present)
  skinAndroidBtn?.addEventListener('click', () => {
    setSkinUI('android');
    sendConfig(forceNumber, mode, 'android');
    triggerHapticAlert();
  });

  skinIosBtn?.addEventListener('click', () => {
    setSkinUI('ios');
    sendConfig(forceNumber, mode, 'ios');
    triggerHapticAlert();
  });

  skinSamsungBtn?.addEventListener('click', () => {
    setSkinUI('samsung');
    sendConfig(forceNumber, mode, 'samsung');
    triggerHapticAlert();
  });

  // --- PRESET ACTIVE UI TRACKING ---
  function setActivePresetUI(activeBtn, badgeText) {
    document.querySelectorAll('.preset-buttons .preset-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
    if (modeBadge && badgeText) {
      modeBadge.textContent = badgeText;
      modeBadge.style.borderColor = '#c084fc';
    }
  }

  function detectPresetByForce(val, currentMode) {
    if (currentMode === 'panic') {
      setActivePresetUI(presetCleanBtn, '🛡️ ЧИСТЫЙ РЕЖИМ');
      return;
    }
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const todayDate = `${day}${month}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}${mins}`;

    if (val === '79163428812' || val?.length >= 10) {
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
      setActivePresetUI(null, 'ФОРС АКТИВЕН');
    }
  }

  // Super 5 Presets with Visual Synchronization
  presetPhoneBtn?.addEventListener('click', () => {
    forceNumber = '79163428812';
    targetForceInput.value = forceNumber;
    setModeUI('toxic');
    setActivePresetUI(presetPhoneBtn, '📞 ЗВОНОК В БУДУЩЕЕ');
    sendConfig(forceNumber, 'toxic');
    triggerHapticAlert('input');
  });

  presetDateBtn?.addEventListener('click', () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    forceNumber = `${day}${month}`; // e.g. 1909
    targetForceInput.value = forceNumber;
    setModeUI('toxic');
    setActivePresetUI(presetDateBtn, '📅 ДАТА');
    sendConfig(forceNumber, 'toxic');
    triggerHapticAlert('input');
  });

  presetTimeBtn?.addEventListener('click', () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    forceNumber = `${hours}${minutes}`; // e.g. 1954
    targetForceInput.value = forceNumber;
    setModeUI('toxic');
    setActivePresetUI(presetTimeBtn, '⏰ ВРЕМЯ');
    sendConfig(forceNumber, 'toxic');
    triggerHapticAlert('input');
  });

  presetPinBtn?.addEventListener('click', () => {
    forceNumber = '2580';
    targetForceInput.value = forceNumber;
    setModeUI('toxic');
    setActivePresetUI(presetPinBtn, '🔑 PIN 2580');
    sendConfig(forceNumber, 'toxic');
    triggerHapticAlert('input');
  });

  presetBookBtn?.addEventListener('click', () => {
    forceNumber = '147';
    targetForceInput.value = forceNumber;
    setModeUI('toxic');
    setActivePresetUI(presetBookBtn, '📖 КНИГА 147');
    sendConfig(forceNumber, 'toxic');
    triggerHapticAlert('input');
  });

  presetCleanBtn?.addEventListener('click', () => {
    setModeUI('panic');
    setActivePresetUI(presetCleanBtn, '🛡️ ЧИСТЫЙ РЕЖИМ');
    sendConfig(forceNumber, 'panic');
    triggerHapticAlert('clear');
  });

  // Initial preset detection
  detectPresetByForce(forceNumber, mode);

  // Stage Mode Toggle
  const stageModeToggleBtn = document.getElementById('stageModeToggleBtn');
  let isStageMode = localStorage.getItem('chameleon_stage_mode') === 'true';

  function updateStageModeUI() {
    if (isStageMode) {
      document.body.classList.add('stage-mode');
      if (stageModeToggleBtn) stageModeToggleBtn.textContent = '⚙️ НАСТРОЙКИ';
    } else {
      document.body.classList.remove('stage-mode');
      if (stageModeToggleBtn) stageModeToggleBtn.textContent = '🎭 СЦЕНА';
    }
  }

  stageModeToggleBtn?.addEventListener('click', () => {
    isStageMode = !isStageMode;
    localStorage.setItem('chameleon_stage_mode', isStageMode);
    updateStageModeUI();
    triggerHapticAlert('input');
  });

  updateStageModeUI();

  // Stealth vs Setup Brightness toggle
  stealthModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('setup-mode');
  });

  // Emergency Notes Screen Toggle
  function activateEmergency() {
    emergencyScreen.classList.add('active');
    if (typeof navigator.vibrate === 'function') navigator.vibrate(40);
  }

  function deactivateEmergency() {
    emergencyScreen.classList.remove('active');
  }

  emergencyToggleBtn?.addEventListener('click', activateEmergency);
  exitEmergencyBtn?.addEventListener('click', deactivateEmergency);

  // --- PANIC GESTURES: 2-FINGER TAP & DOUBLE TAP ---
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Two finger tap anywhere on screen instantly activates Notes
      activateEmergency();
    }
  }, { passive: true });

  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    if (emergencyScreen.classList.contains('active')) return;
    if (e.target.closest('button, input, a')) return;

    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap on screen instantly activates Notes
      activateEmergency();
    }
    lastTap = now;
  }, { passive: true });

  // Double tap on emergency notes screen exits back to console
  let lastNotesTap = 0;
  emergencyScreen?.addEventListener('touchend', (e) => {
    if (e.target.closest('#exitEmergencyBtn')) return;
    const now = Date.now();
    if (now - lastNotesTap < 300) {
      deactivateEmergency();
    }
    lastNotesTap = now;
  }, { passive: true });

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
