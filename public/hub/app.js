/**
 * MAGIC HUB // TELEGRAM MINI APP
 * Powered by Telegram WebApp & TON Connect
 * Strict Monochrome Luxury Glassmorphism
 */

(function () {
  'use strict';

  // --- TELEGRAM WEBAPP & ORIENTATION INITIALIZATION ---
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.headerColor = '#06050c';
      tg.backgroundColor = '#06050c';
      // Disable vertical swipe-to-close so modal scrolling works reliably
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }
      // Lock orientation to portrait if supported by Telegram client
      if (typeof tg.lockOrientation === 'function') {
        tg.lockOrientation();
      }
    } catch (e) {}

    // Track dynamic viewport height to prevent keyboard / bottom clipping
    const updateViewportHeight = () => {
      const vh = tg.viewportHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
    };
    updateViewportHeight();
    tg.onEvent?.('viewportChanged', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
  } else {
    const updateViewportHeight = () => {
      document.documentElement.style.setProperty('--tg-viewport-height', `${window.innerHeight}px`);
    };
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
  }

  // Mobile Screen Orientation Lock API
  try {
    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {}

  // --- TACTILE STEALTH HAPTIC ENGINE ---
  function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
      switch (type) {
        case 'selection':
          tg.HapticFeedback.selectionChanged();
          break;
        case 'rigid':
          tg.HapticFeedback.impactOccurred('rigid');
          break;
        case 'medium':
          tg.HapticFeedback.impactOccurred('medium');
          break;
        case 'heavy':
          tg.HapticFeedback.impactOccurred('heavy');
          break;
        case 'success':
          tg.HapticFeedback.notificationOccurred('success');
          break;
        case 'error':
          tg.HapticFeedback.notificationOccurred('error');
          break;
        case 'light':
        default:
          tg.HapticFeedback.impactOccurred('light');
          break;
      }
    } else if (navigator.vibrate) {
      if (type === 'success') navigator.vibrate([30, 40, 30]);
      else if (type === 'heavy' || type === 'rigid') navigator.vibrate(35);
      else if (type === 'medium') navigator.vibrate(20);
      else navigator.vibrate(10);
    }
  }

  // --- STRICT TOAST SYSTEM ---
  const toastCapsule = document.getElementById('toastCapsule');
  const toastText = document.getElementById('toastText');
  const toastIcon = document.getElementById('toastIcon');
  let toastTimer = null;

  function showToast(message, type = 'success') {
    if (!toastCapsule || !toastText) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastText.textContent = message;
    if (toastIcon) {
      if (type === 'success') {
        toastIcon.className = 'fa-solid fa-circle-check toast-icon';
      } else if (type === 'error') {
        toastIcon.className = 'fa-solid fa-circle-exclamation toast-icon';
      } else {
        toastIcon.className = 'fa-solid fa-circle-info toast-icon';
      }
    }

    toastCapsule.classList.add('visible');
    toastTimer = setTimeout(() => {
      toastCapsule.classList.remove('visible');
    }, 2800);
  }

  // --- USER CONTEXT & ISOLATED ROOM ---
  const tgUser = tg?.initDataUnsafe?.user || null;
  const userId = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('hub_user_id') || 'dev_' + Math.floor(1000 + Math.random() * 9000));
  localStorage.setItem('hub_user_id', userId);

  const userNameStr = tgUser?.first_name ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'OPERATOR';
  const userTagStr = tgUser?.username ? `@${tgUser.username}` : `@id${userId.slice(-4)}`;

  // Every mentalist gets an isolated private room
  const roomId = 'tg_' + userId;

  // Header user handle
  const userHandleTag = document.getElementById('userHandleTag');
  if (userHandleTag) userHandleTag.textContent = userTagStr;

  // Affiliate ref link
  const refLinkInput = document.getElementById('refLinkInput');
  if (refLinkInput) {
    refLinkInput.value = `https://t.me/MagicHubBot?start=ref_${userId}`;
  }

  // State
  let forceNumber = localStorage.getItem(`hub_force_${roomId}`) || '79163428812';
  let skin = localStorage.getItem(`hub_skin_${roomId}`) || 'ios';
  let mode = 'toxic';

  const hubForceInput = document.getElementById('hubForceInput');
  const hubSaveForceBtn = document.getElementById('hubSaveForceBtn');
  if (hubForceInput) hubForceInput.value = forceNumber;

  // Sync initial room from server
  async function syncRoomFromServer() {
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.forceNumber) {
          forceNumber = data.forceNumber;
          if (hubForceInput) hubForceInput.value = forceNumber;
        }
        if (data.skin) {
          skin = data.skin;
          updateSkinUI(skin);
        }
      }
    } catch (err) {
      console.warn('Offline mode: using cached room settings');
    }
  }
  syncRoomFromServer();

  async function saveConfigToServer(newForce, newSkin, newMode) {
    try {
      await fetch(`/api/user/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          forceNumber: newForce,
          skin: newSkin,
          mode: newMode
        })
      });
    } catch (e) {}
  }

  // --- TAB NAVIGATION (BottomNav) ---
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      if (!targetTab) return;

      triggerHaptic('selection');

      navItems.forEach(n => n.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const viewEl = document.getElementById(`view-${targetTab}`);
      if (viewEl) viewEl.classList.add('active');
    });
  });

  // --- PRESET TRACKING & ACTIVE UI ---
  let userPhone = localStorage.getItem('hub_user_phone') || '79163428812';
  const hubForceLabel = document.getElementById('hubForceLabel');

  function updateForceLabelAndPlaceholder(presetType, val) {
    if (!hubForceLabel || !hubForceInput) return;
    switch(presetType) {
      case 'phone':
        hubForceLabel.textContent = '📞 НОМЕР ДЛЯ ЗВОНКА (=)';
        hubForceInput.placeholder = userPhone || '79163428812';
        break;
      case 'date':
        hubForceLabel.textContent = '📅 СЕКРЕТНАЯ ДАТА (=)';
        hubForceInput.placeholder = 'ДДММ (напр. 2009)';
        break;
      case 'time':
        hubForceLabel.textContent = '⏰ ТЕКУЩЕЕ ВРЕМЯ (=)';
        hubForceInput.placeholder = 'ЧЧММ (напр. 2054)';
        break;
      case 'pin':
        hubForceLabel.textContent = '🔑 ЗАГАДАННЫЙ PIN (=)';
        hubForceInput.placeholder = '2580';
        break;
      case 'book':
        hubForceLabel.textContent = '📖 СТРАНИЦА КНИГИ (=)';
        hubForceInput.placeholder = '147';
        break;
      default:
        hubForceLabel.textContent = 'СЕКРЕТНЫЙ РЕЗУЛЬТАТ (=)';
        hubForceInput.placeholder = 'Свое число форсирования...';
        break;
    }
  }

  function setActiveChipBtn(activeId) {
    document.querySelectorAll('.quick-presets-row .chip-btn').forEach(b => {
      if (b.id === activeId) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function detectActivePreset(val) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const todayDate = `${day}${month}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}${mins}`;

    if (val === userPhone || (val && val.length >= 10)) {
      setActiveChipBtn('hubPresetPhoneBtn');
      updateForceLabelAndPlaceholder('phone', val);
    } else if (val === todayDate) {
      setActiveChipBtn('hubPresetDateBtn');
      updateForceLabelAndPlaceholder('date', val);
    } else if (val === currentTime) {
      setActiveChipBtn('hubPresetTimeBtn');
      updateForceLabelAndPlaceholder('time', val);
    } else if (val === '2580') {
      setActiveChipBtn('hubPresetPinBtn');
      updateForceLabelAndPlaceholder('pin', val);
    } else if (val === '147') {
      setActiveChipBtn('hubPresetBookBtn');
      updateForceLabelAndPlaceholder('book', val);
    } else {
      setActiveChipBtn(null);
      updateForceLabelAndPlaceholder('custom', val);
    }
  }

  // Live input tracking to detect preset on typing
  hubForceInput?.addEventListener('input', () => {
    const val = hubForceInput.value.trim().replace(/[\s\-\(\)\+]/g, '');
    detectActivePreset(val);
  });

  // --- TRICK SETTINGS (CHAMELEON CALCULATOR) ---
  function applyAndSaveForce(val, feedbackType = 'rigid', toastMsg = null) {
    if (!val) return;
    hubForceInput.value = val;
    forceNumber = val;
    localStorage.setItem(`hub_force_${roomId}`, forceNumber);
    saveConfigToServer(forceNumber, skin, mode);
    detectActivePreset(val);
    triggerHaptic(feedbackType);
    showToast(toastMsg || `Секретный результат сохранен: ${val}`);
  }

  hubSaveForceBtn?.addEventListener('click', () => {
    const val = hubForceInput.value.trim().replace(/[\s\-\(\)\+]/g, '');
    if (val) {
      let msg = `Секретный результат сохранен: ${val}`;
      if (val.length >= 10) {
        userPhone = val;
        localStorage.setItem('hub_user_phone', userPhone);
        msg = `📞 Номер для звонка сохранен: ${val}`;
      }
      applyAndSaveForce(val, 'success', msg);

      const origText = hubSaveForceBtn.textContent;
      hubSaveForceBtn.textContent = 'OK';
      hubSaveForceBtn.style.backgroundColor = '#ffffff';
      hubSaveForceBtn.style.color = '#000000';
      setTimeout(() => {
        hubSaveForceBtn.textContent = origText;
        hubSaveForceBtn.style.backgroundColor = '';
        hubSaveForceBtn.style.color = '';
      }, 1200);
    }
  });

  // Quick presets with auto-save & active highlight
  document.getElementById('hubPresetPhoneBtn')?.addEventListener('click', () => {
    applyAndSaveForce(userPhone, 'rigid', 'Выбран сценарий: 📞 Звонок в будущее');
    setActiveChipBtn('hubPresetPhoneBtn');
    updateForceLabelAndPlaceholder('phone', userPhone);
  });

  document.getElementById('hubPresetDateBtn')?.addEventListener('click', () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const val = `${day}${month}`;
    applyAndSaveForce(val, 'rigid', 'Выбран сценарий: 📅 Дата');
    setActiveChipBtn('hubPresetDateBtn');
    updateForceLabelAndPlaceholder('date', val);
  });

  document.getElementById('hubPresetTimeBtn')?.addEventListener('click', () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const val = `${hours}${mins}`;
    applyAndSaveForce(val, 'rigid', 'Выбран сценарий: ⏰ Время');
    setActiveChipBtn('hubPresetTimeBtn');
    updateForceLabelAndPlaceholder('time', val);
  });

  document.getElementById('hubPresetPinBtn')?.addEventListener('click', () => {
    applyAndSaveForce('2580', 'rigid', 'Выбран сценарий: 🔑 PIN 2580');
    setActiveChipBtn('hubPresetPinBtn');
    updateForceLabelAndPlaceholder('pin', '2580');
  });

  document.getElementById('hubPresetBookBtn')?.addEventListener('click', () => {
    applyAndSaveForce('147', 'rigid', 'Выбран сценарий: 📖 Книга 147');
    setActiveChipBtn('hubPresetBookBtn');
    updateForceLabelAndPlaceholder('book', '147');
  });

  // Initial detection
  detectActivePreset(forceNumber);

  // Skin Switcher
  const skinBtns = document.querySelectorAll('.skin-opt-btn');
  function updateSkinUI(chosenSkin) {
    skinBtns.forEach(btn => {
      if (btn.getAttribute('data-skin') === chosenSkin) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  updateSkinUI(skin);

  skinBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = btn.getAttribute('data-skin');
      if (chosen) {
        skin = chosen;
        localStorage.setItem(`hub_skin_${roomId}`, skin);
        updateSkinUI(skin);
        saveConfigToServer(forceNumber, skin, mode);
        triggerHaptic('medium');
      }
    });
  });

  // Spectator Link Generator & Copy
  function getSpectatorUrl() {
    return `${window.location.origin}/?room=${encodeURIComponent(roomId)}&skin=${encodeURIComponent(skin)}`;
  }

  function getPeekUrl() {
    return `${window.location.origin}/performer.html?room=${encodeURIComponent(roomId)}`;
  }

  const hubCopySpectatorBtn = document.getElementById('hubCopySpectatorBtn');
  hubCopySpectatorBtn?.addEventListener('click', async () => {
    const url = getSpectatorUrl();
    try {
      await navigator.clipboard.writeText(url);
      triggerHaptic('success');
      showToast('Ссылка скопирована в буфер');

      const orig = hubCopySpectatorBtn.innerHTML;
      hubCopySpectatorBtn.innerHTML = '<i class="fa-solid fa-check"></i> ССЫЛКА СКОПИРОВАНА';
      hubCopySpectatorBtn.style.backgroundColor = '#ffffff';
      hubCopySpectatorBtn.style.color = '#000000';
      setTimeout(() => {
        hubCopySpectatorBtn.innerHTML = orig;
        hubCopySpectatorBtn.style.backgroundColor = '';
        hubCopySpectatorBtn.style.color = '';
      }, 1500);
    } catch (err) {
      prompt('Скопируйте ссылку для ярлыка:', url);
    }
  });

  document.getElementById('hubOpenCalcBtn')?.addEventListener('click', () => {
    triggerHaptic('medium');
    window.open(getSpectatorUrl(), '_blank');
  });

  document.getElementById('hubOpenPeekBtn')?.addEventListener('click', () => {
    triggerHaptic('medium');
    window.open(getPeekUrl(), '_blank');
  });

  // --- TON CONNECT UI INITIALIZATION ---
  let tonConnectUI = null;
  try {
    if (window.TON_CONNECT_UI) {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
        buttonRootId: 'tonConnectBtn'
      });
    }
  } catch (e) {
    console.warn('TON Connect init error:', e);
  }

  // Copy Referral link
  document.getElementById('copyRefBtn')?.addEventListener('click', () => {
    const input = document.getElementById('refLinkInput');
    if (input) {
      navigator.clipboard.writeText(input.value);
      triggerHaptic('success');
      showToast('Партнерская ссылка скопирована');
    }
  });

  // --- ACCESS CONTROL & ADMIN STATE ---
  let isUserAdmin = false;
  let userHasAccess = false;
  let isPending = false;
  let pendingDetails = null;
  let walletConfig = { trc20: '', ton: '' };

  const buyAccessModal = document.getElementById('buyAccessModal');
  const closeBuyModalBtn = document.getElementById('closeBuyModalBtn');
  const calcStatusBadge = document.getElementById('calcStatusBadge');
  const openCalcBtnText = document.getElementById('openCalcBtnText');
  const openCalcBtnIcon = document.getElementById('openCalcBtnIcon');
  const displayTrc20Address = document.getElementById('displayTrc20Address');
  const displayTonAddress = document.getElementById('displayTonAddress');
  const copyTrc20Btn = document.getElementById('copyTrc20Btn');
  const copyTonBtn = document.getElementById('copyTonBtn');
  const buyTxidInput = document.getElementById('buyTxidInput');
  const submitBuyRequestBtn = document.getElementById('submitBuyRequestBtn');
  const buyStatusInfo = document.getElementById('buyStatusInfo');

  const navAdminBtn = document.getElementById('navAdminBtn');
  const adminPendingCount = document.getElementById('adminPendingCount');
  const adminPendingList = document.getElementById('adminPendingList');
  const adminRefreshBtn = document.getElementById('adminRefreshBtn');
  const adminGrantInput = document.getElementById('adminGrantInput');
  const adminGrantBtn = document.getElementById('adminGrantBtn');
  const adminWalletTrc20 = document.getElementById('adminWalletTrc20');
  const adminWalletTon = document.getElementById('adminWalletTon');
  const adminSaveWalletBtn = document.getElementById('adminSaveWalletBtn');
  const adminWhitelistCount = document.getElementById('adminWhitelistCount');
  const adminWhitelistList = document.getElementById('adminWhitelistList');

  // --- TELEGRAM BACK BUTTON & MODAL CONTROLLER ---
  const pwaModal = document.getElementById('pwaModal');
  const calcModal = document.getElementById('calcSettingsModal');
  const openCalcModalCard = document.getElementById('openCalcModalCard');
  const openCalcModalBtn = document.getElementById('openCalcModalBtn');
  const closeCalcModalBtn = document.getElementById('closeCalcModalBtn');

  function updateTgBackButton() {
    if (!tg?.BackButton) return;
    const anyModalOpen = pwaModal?.classList.contains('active') || 
                         calcModal?.classList.contains('active') ||
                         buyAccessModal?.classList.contains('active');
    if (anyModalOpen) {
      tg.BackButton.show();
      tg.BackButton.onClick(closeAllModals);
    } else {
      tg.BackButton.hide();
    }
  }

  function closeAllModals() {
    pwaModal?.classList.remove('active');
    calcModal?.classList.remove('active');
    buyAccessModal?.classList.remove('active');
    updateTgBackButton();
  }

  // --- BUY ACCESS MODAL ---
  function openBuyModal() {
    triggerHaptic('medium');
    buyAccessModal?.classList.add('active');
    updateTgBackButton();
  }

  function closeBuyModal() {
    triggerHaptic('light');
    buyAccessModal?.classList.remove('active');
    updateTgBackButton();
  }

  closeBuyModalBtn?.addEventListener('click', closeBuyModal);
  buyAccessModal?.addEventListener('click', (e) => {
    if (e.target === buyAccessModal) closeBuyModal();
  });

  // --- CHAMELEON CALCULATOR MODAL ---
  function openCalcSettings() {
    triggerHaptic('medium');
    calcModal?.classList.add('active');
    updateTgBackButton();
  }

  function closeCalcSettings() {
    triggerHaptic('light');
    calcModal?.classList.remove('active');
    updateTgBackButton();
  }

  openCalcModalBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userHasAccess) {
      openCalcSettings();
    } else {
      openBuyModal();
    }
  });

  openCalcModalCard?.addEventListener('click', () => {
    if (userHasAccess) {
      openCalcSettings();
    } else {
      openBuyModal();
    }
  });

  closeCalcModalBtn?.addEventListener('click', () => {
    closeCalcSettings();
  });

  calcModal?.addEventListener('click', (e) => {
    if (e.target === calcModal) {
      closeCalcSettings();
    }
  });

  // --- PWA GUIDE MODAL ---
  document.getElementById('openPwaGuideModalBtn')?.addEventListener('click', () => {
    triggerHaptic('light');
    pwaModal?.classList.add('active');
    updateTgBackButton();
  });

  // --- GO TO ACADEMY FROM MODAL ---
  document.getElementById('hubGoToAcademyBtn')?.addEventListener('click', () => {
    triggerHaptic('light');
    closeCalcSettings();
    navItems.forEach(n => {
      if (n.getAttribute('data-tab') === 'academy') n.classList.add('active');
      else n.classList.remove('active');
    });
    tabViews.forEach(v => v.classList.remove('active'));
    document.getElementById('view-academy')?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('closePwaModalBtn')?.addEventListener('click', () => {
    pwaModal?.classList.remove('active');
    updateTgBackButton();
  });

  pwaModal?.addEventListener('click', (e) => {
    if (e.target === pwaModal) {
      pwaModal.classList.remove('active');
      updateTgBackButton();
    }
  });

  // --- ACCESS VERIFICATION ENGINE ---
  async function checkAccess() {
    try {
      const res = await fetch(`/api/access/check?userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(userTagStr)}`);
      if (res.ok) {
        const data = await res.json();
        isUserAdmin = !!data.isAdmin;
        userHasAccess = !!data.hasAccess;
        isPending = !!data.pending;
        pendingDetails = data.pendingDetails || null;
        if (data.wallet) walletConfig = data.wallet;

        updateAccessUI();

        if (isUserAdmin) {
          if (navAdminBtn) navAdminBtn.style.display = 'flex';
          loadAdminOverview();
        }
      }
    } catch (e) {
      console.warn('Access check offline:', e);
    }
  }

  function updateAccessUI() {
    // Update wallet addresses in modal
    if (displayTrc20Address) displayTrc20Address.textContent = walletConfig.trc20 || 'Адрес TRC-20 не задан';
    if (displayTonAddress) displayTonAddress.textContent = walletConfig.ton || 'Адрес TON не задан';

    if (userHasAccess) {
      if (calcStatusBadge) {
        calcStatusBadge.className = 'badge-active';
        calcStatusBadge.innerHTML = '<span class="pulse-dot"></span> ДОСТУП АКТИВЕН';
      }
      if (openCalcBtnText) openCalcBtnText.textContent = 'Настроить';
      if (openCalcBtnIcon) openCalcBtnIcon.className = 'fa-solid fa-sliders';
    } else if (isPending) {
      if (calcStatusBadge) {
        calcStatusBadge.className = 'badge-pending';
        calcStatusBadge.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> ПРОВЕРКА ОПЛАТЫ';
      }
      if (openCalcBtnText) openCalcBtnText.textContent = 'Статус заявки';
      if (openCalcBtnIcon) openCalcBtnIcon.className = 'fa-solid fa-clock';
      if (buyStatusInfo) {
        buyStatusInfo.style.display = 'flex';
        buyStatusInfo.innerHTML = '<i class="fa-solid fa-clock"></i> <span>Заявка отправлена администратору. Доступ активируется после проверки TXID.</span>';
      }
    } else {
      if (calcStatusBadge) {
        calcStatusBadge.className = 'badge-locked';
        calcStatusBadge.innerHTML = '<i class="fa-solid fa-lock"></i> ДОСТУП ЗАКРЫТ • 65 USDT';
      }
      if (openCalcBtnText) openCalcBtnText.textContent = 'Купить доступ (65 USDT)';
      if (openCalcBtnIcon) openCalcBtnIcon.className = 'fa-solid fa-lock';
      if (buyStatusInfo) {
        buyStatusInfo.style.display = 'none';
      }
    }
  }

  // Copy wallet buttons in buy modal
  copyTrc20Btn?.addEventListener('click', async () => {
    if (walletConfig.trc20) {
      try {
        await navigator.clipboard.writeText(walletConfig.trc20);
        triggerHaptic('success');
        showToast('Адрес USDT TRC-20 скопирован');
      } catch (e) {
        prompt('Скопируйте адрес:', walletConfig.trc20);
      }
    }
  });

  copyTonBtn?.addEventListener('click', async () => {
    if (walletConfig.ton) {
      try {
        await navigator.clipboard.writeText(walletConfig.ton);
        triggerHaptic('success');
        showToast('Адрес USDT TON скопирован');
      } catch (e) {
        prompt('Скопируйте адрес:', walletConfig.ton);
      }
    }
  });

  // Submit TXID buy request
  submitBuyRequestBtn?.addEventListener('click', async () => {
    const txHash = buyTxidInput?.value.trim();
    if (!txHash) {
      triggerHaptic('error');
      showToast('Введите TXID транзакции', 'error');
      return;
    }
    submitBuyRequestBtn.disabled = true;
    submitBuyRequestBtn.textContent = '...';
    try {
      const res = await fetch('/api/access/buy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username: userTagStr,
          txHash,
          network: 'USDT'
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        showToast('Заявка успешно отправлена!');
        isPending = true;
        updateAccessUI();
        closeBuyModal();
      } else {
        throw new Error(data.error || 'Ошибка отправки');
      }
    } catch (err) {
      triggerHaptic('error');
      showToast(err.message, 'error');
    } finally {
      submitBuyRequestBtn.disabled = false;
      submitBuyRequestBtn.textContent = 'ОТПРАВИТЬ';
    }
  });

  // Secure admin headers helper
  function getAdminHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
    const token = localStorage.getItem('hub_admin_token');
    if (token) headers['x-admin-token'] = token;
    return headers;
  }

  // --- ADMIN CONSOLE LOGIC ---
  async function loadAdminOverview() {
    if (!isUserAdmin) return;
    try {
      const res = await fetch(`/api/admin/overview?adminId=${encodeURIComponent(userId)}`, {
        headers: getAdminHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        renderAdminOverview(data);
      }
    } catch (e) {
      console.warn('Admin overview fetch error:', e);
    }
  }

  function renderAdminOverview(data) {
    // 1. Pending List
    const pending = data.pending || [];
    if (adminPendingCount) adminPendingCount.textContent = pending.length;
    if (adminPendingList) {
      if (pending.length === 0) {
        adminPendingList.innerHTML = '<div class="admin-empty-state">Нет новых заявок</div>';
      } else {
        adminPendingList.innerHTML = pending.map(item => `
          <div class="admin-pending-item">
            <div class="admin-pending-header">
              <div class="admin-pending-user">
                <span class="admin-pending-name">${item.username ? '@' + item.username : 'User ' + item.userId}</span>
                <span class="admin-pending-id">ID: ${item.userId}</span>
              </div>
              <span class="admin-pending-badge">${item.network || 'USDT'} • 65 USDT</span>
            </div>
            <div class="admin-pending-txid-box">
              <span class="admin-pending-txid-label">TXID:</span>
              <span class="admin-pending-txid-val">${item.txHash}</span>
            </div>
            <div class="admin-actions-row">
              <button class="admin-action-btn admin-approve-btn" data-user="${item.userId}">
                <i class="fa-solid fa-check"></i> Одобрить
              </button>
              <button class="admin-action-btn admin-reject-btn" data-user="${item.userId}">
                <i class="fa-solid fa-xmark"></i> Отклонить
              </button>
            </div>
          </div>
        `).join('');

        adminPendingList.querySelectorAll('.admin-approve-btn').forEach(btn => {
          btn.addEventListener('click', () => approveUser(btn.getAttribute('data-user')));
        });
        adminPendingList.querySelectorAll('.admin-reject-btn').forEach(btn => {
          btn.addEventListener('click', () => rejectUser(btn.getAttribute('data-user')));
        });
      }
    }

    // 2. Wallets
    if (data.wallet) {
      if (adminWalletTrc20 && !adminWalletTrc20.value) adminWalletTrc20.value = data.wallet.trc20 || '';
      if (adminWalletTon && !adminWalletTon.value) adminWalletTon.value = data.wallet.ton || '';
    }

    // 3. Whitelist
    const whitelist = data.whitelist || [];
    if (adminWhitelistCount) adminWhitelistCount.textContent = whitelist.length;
    if (adminWhitelistList) {
      if (whitelist.length === 0) {
        adminWhitelistList.innerHTML = '<div class="admin-empty-state">Список пуст</div>';
      } else {
        adminWhitelistList.innerHTML = whitelist.map(id => `
          <div class="admin-whitelist-item">
            <span class="admin-whitelist-user">
              <i class="fa-solid fa-user-check"></i> ${id}
            </span>
            ${id === '7357950968' ? '<span class="admin-pending-badge">SUPERADMIN</span>' : `
              <button class="admin-revoke-btn" data-id="${id}">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            `}
          </div>
        `).join('');

        adminWhitelistList.querySelectorAll('.admin-revoke-btn').forEach(btn => {
          btn.addEventListener('click', () => revokeUser(btn.getAttribute('data-id')));
        });
      }
    }
  }

  async function approveUser(targetUserId) {
    triggerHaptic('rigid');
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ adminId: userId, targetUserId })
      });
      const d = await res.json();
      if (d.success) {
        triggerHaptic('success');
        showToast(`Доступ одобрен: ${targetUserId}`);
        loadAdminOverview();
      }
    } catch (e) {
      showToast('Ошибка одобрения', 'error');
    }
  }

  async function rejectUser(targetUserId) {
    triggerHaptic('light');
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ adminId: userId, targetUserId })
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Заявка отклонена: ${targetUserId}`);
        loadAdminOverview();
      }
    } catch (e) {
      showToast('Ошибка отклонения', 'error');
    }
  }

  async function revokeUser(identifier) {
    if (!confirm(`Отозвать доступ у ${identifier}?`)) return;
    triggerHaptic('rigid');
    try {
      const res = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ adminId: userId, identifier })
      });
      const d = await res.json();
      if (d.success) {
        triggerHaptic('success');
        showToast(`Доступ отозван: ${identifier}`);
        loadAdminOverview();
      }
    } catch (e) {
      showToast('Ошибка отзыва', 'error');
    }
  }

  // Admin refresh button
  adminRefreshBtn?.addEventListener('click', () => {
    triggerHaptic('light');
    loadAdminOverview();
    showToast('Данные обновлены');
  });

  // Admin manual grant button
  adminGrantBtn?.addEventListener('click', async () => {
    const val = adminGrantInput?.value.trim();
    if (!val) {
      showToast('Введите @username или ID', 'error');
      return;
    }
    triggerHaptic('rigid');
    try {
      const res = await fetch('/api/admin/grant', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ adminId: userId, identifier: val })
      });
      const d = await res.json();
      if (d.success) {
        triggerHaptic('success');
        showToast(`Доступ выдан: ${val}`);
        if (adminGrantInput) adminGrantInput.value = '';
        loadAdminOverview();
      } else {
        throw new Error(d.error || 'Ошибка');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // Admin save wallet button
  adminSaveWalletBtn?.addEventListener('click', async () => {
    const trc20 = adminWalletTrc20?.value.trim() || '';
    const ton = adminWalletTon?.value.trim() || '';
    triggerHaptic('rigid');
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ adminId: userId, trc20, ton })
      });
      const d = await res.json();
      if (d.success) {
        triggerHaptic('success');
        showToast('Реквизиты сохранены');
        walletConfig = d.wallet;
        updateAccessUI();
      }
    } catch (e) {
      showToast('Ошибка сохранения реквизитов', 'error');
    }
  });

  // Initial access check
  checkAccess();

})();

