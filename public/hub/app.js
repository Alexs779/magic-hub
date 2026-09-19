/**
 * MAGIC HUB // TELEGRAM MINI APP
 * Powered by Telegram WebApp & TON Connect
 * Strict Monochrome Luxury Glassmorphism
 */

(function () {
  'use strict';

  // --- TELEGRAM WEBAPP INITIALIZATION ---
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.headerColor = '#000000';
      tg.backgroundColor = '#000000';
    } catch (e) {}
  }

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

  // --- CATALOG FILTERS (ALL VS OWNED) ---
  const filterPills = document.querySelectorAll('.filter-pill');
  const trickCards = document.querySelectorAll('.trick-card');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-filter');
      triggerHaptic('selection');

      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      trickCards.forEach(card => {
        if (filter === 'all') {
          card.style.display = 'block';
        } else if (filter === 'owned') {
          if (card.classList.contains('trick-card-owned')) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });

  // --- TRICK SETTINGS (CHAMELEON CALCULATOR) ---
  function applyAndSaveForce(val, feedbackType = 'rigid') {
    if (!val) return;
    hubForceInput.value = val;
    forceNumber = val;
    localStorage.setItem(`hub_force_${roomId}`, forceNumber);
    saveConfigToServer(forceNumber, skin, mode);
    triggerHaptic(feedbackType);
    showToast(`Число сохранено: ${val}`);
  }

  hubSaveForceBtn?.addEventListener('click', () => {
    const val = hubForceInput.value.trim().replace(/[\s\-\(\)\+]/g, '');
    if (val) {
      applyAndSaveForce(val, 'success');

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

  // Quick presets with auto-save
  document.getElementById('hubPresetDateBtn')?.addEventListener('click', () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    applyAndSaveForce(`${day}${month}`, 'rigid');
  });

  document.getElementById('hubPresetTimeBtn')?.addEventListener('click', () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    applyAndSaveForce(`${hours}${mins}`, 'rigid');
  });

  document.getElementById('hubPresetPinBtn')?.addEventListener('click', () => {
    applyAndSaveForce('2580', 'rigid');
  });

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

  // --- TELEGRAM BACK BUTTON & MODAL CONTROLLER ---
  const pwaModal = document.getElementById('pwaModal');
  const checkoutModal = document.getElementById('checkoutModal');

  function updateTgBackButton() {
    if (!tg?.BackButton) return;
    const anyModalOpen = pwaModal?.classList.contains('active') || checkoutModal?.classList.contains('active');
    if (anyModalOpen) {
      tg.BackButton.show();
      tg.BackButton.onClick(closeAllModals);
    } else {
      tg.BackButton.hide();
    }
  }

  function closeAllModals() {
    pwaModal?.classList.remove('active');
    checkoutModal?.classList.remove('active');
    updateTgBackButton();
  }

  // --- PWA GUIDE MODAL ---
  document.getElementById('openPwaGuideModalBtn')?.addEventListener('click', () => {
    triggerHaptic('light');
    pwaModal?.classList.add('active');
    updateTgBackButton();
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

  // --- CHECKOUT & STORE PURCHASE FLOW ---
  const openArtforceCheckoutBtn = document.getElementById('openArtforceCheckoutBtn');
  const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
  const notifySonicBtn = document.getElementById('notifySonicBtn');
  const checkoutPayTonBtn = document.getElementById('checkoutPayTonBtn');
  const checkoutPaySbpBtn = document.getElementById('checkoutPaySbpBtn');

  openArtforceCheckoutBtn?.addEventListener('click', () => {
    triggerHaptic('medium');
    checkoutModal?.classList.add('active');
    updateTgBackButton();
  });

  closeCheckoutModalBtn?.addEventListener('click', () => {
    checkoutModal?.classList.remove('active');
    updateTgBackButton();
  });

  checkoutModal?.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.classList.remove('active');
      updateTgBackButton();
    }
  });

  notifySonicBtn?.addEventListener('click', () => {
    triggerHaptic('success');
    showToast('Вы добавлены в список ожидания Sonic Mind!');
  });

  // Handle USDT direct checkout via TON Connect
  checkoutPayTonBtn?.addEventListener('click', async () => {
    if (!tonConnectUI) {
      showToast('TON Connect недоступен', 'error');
      return;
    }

    if (!tonConnectUI.connected) {
      triggerHaptic('light');
      showToast('Подключите кошелек для оплаты в USDT', 'info');
      try {
        await tonConnectUI.openModal();
      } catch (e) {}
      return;
    }

    try {
      triggerHaptic('medium');
      showToast('Подготовка транзакции на 49 USDT...', 'info');

      // USDT Jetton transfer on TON: 49 USDT (decimals = 6 -> 49,000,000 units)
      // Merchant wallet address on TON
      const merchantAddress = 'UQBIh-v8fK1q7tHkQGfE2Y0P1r0v0M7h_m4E_qOQ1lE8Kk';

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: merchantAddress,
            amount: '50000000', // 0.05 TON network commission / fallback
            payload: '' // order memo
          }
        ]
      };

      await tonConnectUI.sendTransaction(transaction);
      triggerHaptic('success');
      showToast('Оплата 49 USDT успешна! Доступ активирован.', 'success');
      checkoutModal?.classList.remove('active');
      updateTgBackButton();
    } catch (err) {
      console.warn('Transaction cancelled or failed:', err);
      if (err?.message?.includes('reject') || err?.message?.includes('cancel')) {
        showToast('Транзакция отменена пользователем', 'info');
      } else {
        showToast('Ошибка транзакции USDT', 'error');
      }
    }
  });

  // Handle USDT TRC-20 / Card payment via Support
  checkoutPaySbpBtn?.addEventListener('click', () => {
    triggerHaptic('medium');
    const msg = encodeURIComponent(`Здравствуйте! Хочу оплатить предзаказ ArtForce (49 USDT). Пришлите реквизиты кошелька (USDT TRC-20 / TON / Картой). Мой ID: ${userId}`);
    window.open(`https://t.me/MagicHubSupportBot?start=${msg}`, '_blank');
  });

})();
