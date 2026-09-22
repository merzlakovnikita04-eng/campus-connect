// ============================================================
// 👤 DASHBOARD.JS — ЛИЧНЫЙ КАБИНЕТ (v9 — диагностика)
// ============================================================

import {
  auth,
  getStudentByUid,
  getStudents,
  saveStudent,
  getAds,
  getListings,
  saveListing,
  getAbsences,
  saveAbsence,
  getVotes,
  saveVotes,
  getMyVotesToday,
  voteForCandidate,
  logoutStudent,
  onAuthStateChanged
} from './firebase.js';

import { esc, showModal } from './utils.js';

// ==================== НАСТРОЙКИ ====================
const PRICE_PREMIUM = 40;
const PRICE_LISTING = 10;
const FREE_LISTINGS = 5;
const PREMIUM_TRIAL_DAYS = 3;

// ==================== СОСТОЯНИЕ ====================
let studentId = null;
let student = null;
let studentsFilter = 'all';
let studentsSearch = '';

// ==================== СТАРТ ====================
let authResolved = false;
let initialized = false;

onAuthStateChanged(auth, async (user) => {
  if (!authResolved) {
    authResolved = true;
    if (!user) return; // ждём второго вызова
  }

  if (!user) {
    window.location.replace('index.html');
    return;
  }

  if (initialized) return;
  initialized = true;

  // Даём Firebase 500 мс, чтобы точно авторизовать запросы
  await new Promise(resolve => setTimeout(resolve, 500));

  let result;
  try {
    result = await getStudentByUid(user.uid);
  } catch (err) {
    showModal(
      'Ошибка чтения базы.\n\n' +
      'UID: ' + user.uid + '\n' +
      'Сообщение: ' + (err.message || '—'),
      { title: 'Ошибка', icon: '⚠️', okText: 'Выйти',
        onConfirm: async () => { await logoutStudent(); window.location.reload(); } }
    );
    return;
  }

  if (!result.success) {
    // Диагностика — что не так
    const allStudents = await getStudents();
    const s = allStudents.students || {};
    const withoutUid = Object.keys(s).filter(k => !s[k].uid);

    let diagnosis = 'Причина: ';

    if (Object.keys(s).length === 0) {
      diagnosis += 'в базе нет ни одного студента.';
    } else if (withoutUid.length > 0) {
      diagnosis += 'у студентов нет поля uid: ' + withoutUid.join(', ') + '. Админ должен одобрить заявку заново.';
    } else {
      diagnosis += 'твой uid не совпадает ни с одним студентом. Возможно, заявка не одобрена или удалена.';
    }

    showModal(
      diagnosis + '\n\nТвой UID: ' + user.uid +
      '\n\nОбратись к админу или войди заново.',
      {
        title: 'Нет доступа', icon: '⚠️', okText: 'Выйти',
        onConfirm: async () => {
          await logoutStudent();
          window.location.replace('index.html');
        }
      }
    );
    return;
  }

  studentId = result.studentId;
  student = result.data;

  startDashboard();
});

function startDashboard() {
  renderAvatar();
  renderProfile();
  renderAbsences();
  renderBoard();
  renderMarket();
  renderVoting();
  checkPremium();
  updateFreeListingsInfo();
  bindEvents();
}

// ==================== 🎨 АВАТАРКА ====================
function getAvatarColor(name) {
  const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function getAvatarHTML(s, size) {
  size = size || 'big';
  if (s.avatar) {
    return `<img src="${esc(s.avatar)}" alt="${esc(s.name)}" class="${size === 'big' ? 'profile-avatar' : 'student-avatar-mini'}">`;
  }
  const letter = esc(s.name.charAt(0).toUpperCase());
  const color = getAvatarColor(s.name);
  const cls = size === 'big' ? 'profile-avatar-letter' : 'student-avatar-mini-letter';
  return `<div class="${cls}" style="background: linear-gradient(135deg, ${color}, ${color}cc);">${letter}</div>`;
}

function renderAvatar() {
  const container = document.getElementById('avatar-container');
  if (!container) return;
  container.innerHTML = getAvatarHTML(student, 'big');
}

// ==================== 👤 ПРОФИЛЬ ====================
function renderProfile() {
  const nameEl = document.getElementById('profile-name');
  const groupEl = document.getElementById('profile-group');
  const idEl = document.getElementById('profile-id');
  const bioEl = document.getElementById('profile-bio');

  if (nameEl) nameEl.textContent = student.name;
  if (groupEl) groupEl.textContent = student.group;
  if (idEl) idEl.textContent = studentId;
  if (bioEl) bioEl.textContent = student.bio ? `«${student.bio}»` : '';

  const actionsEl = document.getElementById('profile-actions');
  if (!actionsEl) return;

  const btns = [];

  if (student.phone && student.showPhone) {
    btns.push(`<a href="tel:${esc(student.phone.replace(/\s/g, ''))}" class="btn-contact btn-call">📞 Позвонить</a>`);
  }

  if (student.telegram && student.showTelegram) {
    const tg = esc(student.telegram.replace('@', ''));
    btns.push(`<a href="https://t.me/${tg}" target="_blank" class="btn-contact btn-tg">💬 Telegram</a>`);
  }

  actionsEl.innerHTML = btns.join('');
  renderGallery();
}

function checkPremium() {
  const now = Date.now();
  const hasPremium = student.premium === true;
  const trialActive = student.premiumTrialUntil && student.premiumTrialUntil > now;
  const badge = document.getElementById('premium-badge');
  const statusEl = document.getElementById('premium-status');

  if (hasPremium || trialActive) {
    if (badge) badge.classList.remove('hidden');
    if (statusEl) {
      if (trialActive && !hasPremium) {
        const daysLeft = Math.ceil((student.premiumTrialUntil - now) / (1000 * 60 * 60 * 24));
        statusEl.textContent = '🎁 Пробный период: осталось ' + daysLeft + ' дн.';
      } else {
        statusEl.textContent = '✅ Premium активен';
      }
    }
  } else {
    if (badge) badge.classList.add('hidden');
  }
}

// ==================== 🎛️ СОБЫТИЯ ====================
function bindEvents() {
  const profileView = document.getElementById('profile-view');
  const profileEdit = document.getElementById('profile-edit');

  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn && profileView && profileEdit) {
    editBtn.addEventListener('click', () => {
      document.getElementById('edit-phone').value = student.phone || '';
      document.getElementById('edit-show-phone').checked = student.showPhone !== false;
      document.getElementById('edit-telegram').value = student.telegram || '';
      document.getElementById('edit-show-telegram').checked = student.showTelegram !== false;
      document.getElementById('edit-bio').value = student.bio || '';

      profileView.classList.add('hidden');
      profileEdit.classList.remove('hidden');
    });
  }

  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn && profileView && profileEdit) {
    cancelBtn.addEventListener('click', () => {
      profileView.classList.remove('hidden');
      profileEdit.classList.add('hidden');
    });
  }

  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const updates = {
        phone: document.getElementById('edit-phone').value.trim(),
        showPhone: document.getElementById('edit-show-phone').checked,
        telegram: document.getElementById('edit-telegram').value.trim().replace('@', ''),
        showTelegram: document.getElementById('edit-show-telegram').checked,
        bio: document.getElementById('edit-bio').value.trim()
      };

      await saveStudent(studentId, updates);
      Object.assign(student, updates);

      renderProfile();
      profileView.classList.remove('hidden');
      profileEdit.classList.add('hidden');

      showModal('Профиль сохранён!', { title: 'Готово!', icon: '✅' });
    });
  }

  const avatarEditBtn = document.getElementById('avatar-edit-btn');
  if (avatarEditBtn) {
    avatarEditBtn.addEventListener('click', () => {
      const input = document.getElementById('edit-avatar-input');
      if (input) input.click();
    });
  }

  const avatarInput = document.getElementById('edit-avatar-input');
  if (avatarInput) avatarInput.addEventListener('change', handleAvatarChange);

  const avatarCamera = document.getElementById('edit-avatar-camera');
  if (avatarCamera) avatarCamera.addEventListener('change', handleAvatarChange);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      showModal('Выйти из личного кабинета?', {
        title: 'Выход', icon: '🚪', showCancel: true, okText: 'Выйти',
        onConfirm: async () => {
          await logoutStudent();
          window.location.replace('index.html');
        }
      });
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');

      if (btn.dataset.tab === 'students') renderStudentsTab();
    });
  });

  const absenceForm = document.getElementById('absence-form');
  const absenceDate = document.getElementById('absence-date');
  if (absenceDate) absenceDate.valueAsDate = new Date();

  if (absenceForm) {
    absenceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const absenceId = 'abs_' + Date.now();

      await saveAbsence(absenceId, {
        studentId: studentId,
        studentName: student.name,
        uid: auth.currentUser ? auth.currentUser.uid : null,
        date: absenceDate.value,
        reason: document.getElementById('absence-reason').value,
        comment: document.getElementById('absence-comment').value.trim(),
        createdAt: new Date().toLocaleString('ru-RU')
      });

      absenceForm.reset();
      absenceDate.valueAsDate = new Date();
      renderAbsences();
      showModal('Отметка отправлена.', { title: 'Готово!', icon: '✅' });
    });
  }

  const newListingBtn = document.getElementById('new-listing-btn');
  const listingForm = document.getElementById('listing-form');
  if (newListingBtn && listingForm) {
    newListingBtn.addEventListener('click', () => listingForm.classList.toggle('hidden'));
  }

  const cancelListingBtn = document.getElementById('cancel-listing');
  if (cancelListingBtn && listingForm) {
    cancelListingBtn.addEventListener('click', () => {
      listingForm.classList.add('hidden');
      listingForm.reset();
    });
  }

  if (listingForm) {
    listingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = await getListings();
      const listings = data.listings || [];
      const myCount = listings.filter(l => l.authorId === studentId).length;
      const freeLeft = Math.max(0, FREE_LISTINGS - myCount);
      const isFree = freeLeft > 0;

      const doPublish = async () => {
        const listingId = 'lst_' + Date.now();

        const isPremium = !!(student.premium === true ||
          (student.premiumTrialUntil && student.premiumTrialUntil > Date.now()));

        const result = await saveListing(listingId, {
          title: document.getElementById('listing-title').value.trim(),
          desc: document.getElementById('listing-desc').value.trim(),
          price: document.getElementById('listing-price').value || 0,
          phone: document.getElementById('listing-phone').value.trim(),
          telegram: document.getElementById('listing-telegram')?.value.trim().replace('@', '') || '',
          author: student.name,
          authorId: studentId,
          uid: auth.currentUser ? auth.currentUser.uid : null,
          premium: isPremium,
          createdAt: new Date().toISOString()
        });

        if (!result || !result.success) {
          const errMsg = result && result.error ? result.error : 'Неизвестная ошибка';
          console.error('❌ Ошибка публикации:', errMsg);
          showModal('❌ Не удалось опубликовать.\n\nПричина: ' + errMsg, {
            title: 'Ошибка', icon: '⚠️'
          });
          return;
        }

        listingForm.reset();
        listingForm.classList.add('hidden');
        await renderMarket();
        await updateFreeListingsInfo();

        showModal(isFree ? 'Объявление опубликовано бесплатно! 🎁' : 'Объявление опубликовано!', {
          title: 'Готово!', icon: isFree ? '🎁' : '💳'
        });
      };

      if (isFree) {
        doPublish();
      } else {
        showModal('Оплатить ' + PRICE_LISTING + ' ₽ за размещение?', {
          title: 'Оплата ' + PRICE_LISTING + ' ₽',
          icon: '💳', showCancel: true, okText: 'Оплатить',
          onConfirm: doPublish
        });
      }
    });
  }

  const searchInput = document.getElementById('students-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      studentsSearch = e.target.value;
      renderStudentsTab();
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      studentsFilter = btn.dataset.filter;
      renderStudentsTab();
    });
  });

  const buyPremiumBtn = document.getElementById('buy-premium');
  if (buyPremiumBtn) {
    buyPremiumBtn.addEventListener('click', handleBuyPremium);
  }
}

// ==================== АВАТАРКА ====================
function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showModal('Фото слишком большое. Максимум 5 МБ.', { title: 'Ошибка', icon: '⚠️' });
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      await saveStudent(studentId, { avatar: dataUrl });
      student.avatar = dataUrl;

      renderAvatar();
      showModal('Аватарка обновлена!', { title: 'Готово!', icon: '📸' });
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ==================== ГАЛЕРЕЯ ====================
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const photos = student.photos || [];
  let html = photos.map((photo, i) => `
    <div class="gallery-item">
      <img src="${esc(photo)}" alt="Фото ${i + 1}" onclick="viewGalleryPhoto(${i})">
      <button class="gallery-delete" onclick="deleteGalleryPhoto(event, ${i})">✕</button>
    </div>
  `).join('');

  if (photos.length < 20) {
    html += `<button class="gallery-add" id="gallery-add-btn">+</button>`;
  }

  grid.innerHTML = html;

  const addBtn = document.getElementById('gallery-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showModal('Фото слишком большое (макс. 5 МБ).', { title: 'Ошибка', icon: '⚠️' });
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let w = img.width, h = img.height;
            if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize; }
            else if (h > maxSize) { w = w * maxSize / h; h = maxSize; }

            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            if (!student.photos) student.photos = [];
            student.photos.push(dataUrl);
            await saveStudent(studentId, { photos: student.photos });

            renderGallery();
            showModal('Фото добавлено!', { title: 'Готово!', icon: '📸' });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
}

window.viewGalleryPhoto = (index) => {
  const photo = student.photos[index];
  if (!photo) return;

  const old = document.getElementById('gallery-view-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'gallery-view-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 90vw; padding: 12px;">
      <img src="${esc(photo)}" style="width:100%; max-height:75vh; object-fit:contain; border-radius:12px;">
      <div class="modal-actions" style="margin-top:14px;">
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('gallery-view-modal').remove()">Закрыть</button>
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

window.deleteGalleryPhoto = (event, index) => {
  event.stopPropagation();
  showModal('Удалить это фото?', {
    title: 'Подтверждение', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      student.photos.splice(index, 1);
      await saveStudent(studentId, { photos: student.photos });
      renderGallery();
    }
  });
};

// ==================== 📅 ОТСУТСТВИЯ ====================
async function renderAbsences() {
  const data = await getAbsences();
  const mine = (data.absences || []).filter(a => a.studentId === studentId);
  const el = document.getElementById('absence-list');
  if (!el) return;

  el.innerHTML = mine.length
    ? mine.map(a => `
        <div class="list-item">
          <div>
            <b>${esc(a.date)}</b> — ${esc(a.reason)}
            ${a.comment ? `<br><small>${esc(a.comment)}</small>` : ''}
          </div>
        </div>
      `).join('')
    : '<p class="muted">Пока нет отметок</p>';
}

// ==================== 📢 РЕКЛАМА ====================
async function renderBoard() {
  const data = await getAds();
  const approved = (data.ads || []).filter(a => a.status === 'approved' || !a.status);
  const el = document.getElementById('board-list');
  if (!el) return;

  el.innerHTML = approved.length
    ? approved.map(a => `
        <div class="card">
          <h4>${esc(a.emoji || '📌')} ${esc(a.title)}</h4>
          <p>${esc(a.desc)}</p>
          <p class="muted">${esc(a.contact)}</p>
        </div>
      `).join('')
    : '<p class="muted">Пока нет заведений.</p>';
}

// ==================== 🛒 МАРКЕТПЛЕЙС ====================
async function updateFreeListingsInfo() {
  const data = await getListings();
  const listings = data.listings || [];
  const myCount = listings.filter(l => l.authorId === studentId).length;
  const freeLeft = Math.max(0, FREE_LISTINGS - myCount);
  const info = document.getElementById('free-listings-info');

  if (info) {
    if (freeLeft > 0) {
      info.innerHTML = '🎁 У тебя осталось <b>' + freeLeft + '</b> бесплатных объявлений';
    } else {
      info.innerHTML = '💳 Следующее объявление — <b>' + PRICE_LISTING + ' ₽</b>';
    }
  }

  const btn = document.getElementById('listing-submit-btn');
  if (btn) {
    btn.textContent = freeLeft > 0
      ? '🎁 Опубликовать бесплатно'
      : '💳 Оплатить ' + PRICE_LISTING + ' ₽ и опубликовать';
  }
}

async function renderMarket() {
  const data = await getListings();
  const listings = data.listings || [];
  listings.sort((a, b) => (b.premium ? 1 : 0) - (a.premium ? 1 : 0));
  const el = document.getElementById('market-list');
  if (!el) return;

  el.innerHTML = listings.length
    ? listings.map(l => {
        const tg = l.telegram ? esc(l.telegram) : '';
        const tgBtn = tg
          ? `<a href="https://t.me/${tg}" target="_blank" class="btn-contact btn-tg"
                style="margin-top:8px; display:inline-flex;">💬 Написать в Telegram</a>`
          : '';
        return `
          <div class="card">
            <h4>${l.premium ? '⭐ ' : ''}${esc(l.title)}</h4>
            <p>${esc(l.desc)}</p>
            <p><b>${esc(l.price)} ₽</b></p>
            <p class="muted">📞 ${esc(l.phone)} · ${esc(l.author)}</p>
            ${tgBtn}
          </div>
        `;
      }).join('')
    : '<p class="muted">Объявлений пока нет</p>';
}

// ==================== 👥 СТУДЕНТЫ ====================
async function renderStudentsTab() {
  const data = await getStudents();
  const students = data.students || {};
  const container = document.getElementById('students-list-view');
  if (!container) return;

  let ids = Object.keys(students);

  if (studentsFilter === 'group') {
    ids = ids.filter(id => students[id].group === student.group);
  }

  if (studentsSearch.trim()) {
    const q = studentsSearch.trim().toLowerCase();
    ids = ids.filter(id => {
      const s = students[id];
      return s.name.toLowerCase().includes(q) || (s.group && s.group.toLowerCase().includes(q));
    });
  }

  if (!ids.length) {
    container.innerHTML = '<p class="muted">Никого не найдено</p>';
    return;
  }

  ids.sort((a, b) => students[a].name.localeCompare(students[b].name));

  container.innerHTML = ids.map(id => {
    const s = students[id];
    const isMe = id === studentId;
    return `
      <div class="student-item" onclick="viewStudentProfile('${esc(id)}')">
        ${getAvatarHTML(s, 'mini')}
        <div class="student-item-info">
          <b>${esc(s.name)}${isMe ? ' (Вы)' : ''}${s.premium ? ' ⭐' : ''}</b>
          <small>Группа: ${esc(s.group)}${s.bio ? ' · ' + esc(s.bio) : ''}</small>
        </div>
        <div class="student-item-arrow">›</div>
      </div>
    `;
  }).join('');
}

window.viewStudentProfile = async (id) => {
  const data = await getStudents();
  const s = data.students[id];
  if (!s) return;

  if (id === studentId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const profileBtn = document.querySelector('.tab-btn[data-tab="profile"]');
    if (profileBtn) profileBtn.classList.add('active');
    document.getElementById('tab-profile').classList.add('active');
    return;
  }

  const btns = [];
  if (s.phone && s.showPhone) {
    btns.push(`<a href="tel:${esc(s.phone.replace(/\s/g, ''))}" class="btn-contact btn-call">📞 Позвонить</a>`);
  }
  if (s.telegram && s.showTelegram) {
    const tg = esc(s.telegram.replace('@', ''));
    btns.push(`<a href="https://t.me/${tg}" target="_blank" class="btn-contact btn-tg">💬 Telegram</a>`);
  }

  const old = document.getElementById('student-profile-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'student-profile-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="padding: 24px 20px;">
      <div class="student-profile-view">
        ${getAvatarHTML(s, 'big')}
        <h2 class="profile-name">${esc(s.name)}${s.premium ? ' ⭐' : ''}</h2>
        <p class="profile-subtitle">Группа: ${esc(s.group)} · ${esc(id)}</p>
        ${s.bio ? `<p class="profile-bio">«${esc(s.bio)}»</p>` : ''}
        ${btns.length ? `<div class="profile-actions">${btns.join('')}</div>` : ''}
      </div>
      <div class="modal-actions" style="margin-top:18px;">
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('student-profile-modal').remove()">Закрыть</button>
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

// ==================== 🏆 ГОЛОСОВАНИЕ ====================
async function renderVoting() {
  const data = await getVotes();
  const votes = data.votes || {};
  const container = document.getElementById('voting-container');
  if (!container) return;

  const categories = Object.keys(votes);
  if (!categories.length) {
    container.innerHTML = '<p class="muted">Категорий пока нет</p>';
    return;
  }

  const myVotesData = await getMyVotesToday(studentId);
  const myVotes = myVotesData.voted || {};

  container.innerHTML = categories.map(category => {
    const options = votes[category].options || [];
    const alreadyVoted = myVotes[category] === true;

    return `
      <div class="vote-category">
        <h3>${esc(category)}</h3>
        ${options.length
          ? options.map((opt, i) => `
              <div class="vote-option">
                <span>${esc(opt.name)}</span>
                <span style="display:flex; align-items:center; gap:8px;">
                  <span class="count">${esc(opt.votes)} 🗳</span>
                  <button ${alreadyVoted ? 'disabled' : ''}
                    onclick="vote('${esc(category.replace(/'/g, "\\'"))}', ${i})">
                    ${alreadyVoted ? 'Уже голосовал' : 'Голосовать'}
                  </button>
                </span>
              </div>
            `).join('')
          : '<p class="muted">Кандидатов пока нет</p>'}
      </div>
    `;
  }).join('');
}

window.vote = async (category, index) => {
  showModal('Проголосовать за этого кандидата?\n\nГолос нельзя отменить.', {
    title: 'Подтверждение',
    icon: '🗳️',
    showCancel: true,
    okText: 'Голосовать',
    onConfirm: async () => {
      const result = await voteForCandidate(category, index, studentId);

      if (!result.success) {
        showModal(result.error, { title: 'Ошибка', icon: '⚠️' });
        return;
      }

      await renderVoting();
      showModal('Голос учтён. Спасибо!', { title: '✅', icon: '🗳️' });
    }
  });
};

// ==================== 💎 ПРЕМИУМ ====================
function handleBuyPremium() {
  const now = Date.now();
  const hasPremium = student.premium === true;
  const trialUsed = student.premiumTrialUsed === true;
  const trialActive = student.premiumTrialUntil && student.premiumTrialUntil > now;

  if (hasPremium) {
    showModal('У вас уже активирован Premium.', { title: 'Premium', icon: '💎' });
    return;
  }

  if (trialActive) {
    const daysLeft = Math.ceil((student.premiumTrialUntil - now) / (1000 * 60 * 60 * 24));
    showModal('Пробный период активен. Осталось ' + daysLeft + ' дн.\n\nОформить за ' + PRICE_PREMIUM + ' ₽/мес?', {
      title: 'Premium', icon: '💎', showCancel: true, okText: 'Оформить',
      onConfirm: activatePremium
    });
    return;
  }

  if (!trialUsed) {
    showModal('🎁 Подарок!\n\nПопробуй Premium на ' + PREMIUM_TRIAL_DAYS + ' дней бесплатно.\n\nПотом — ' + PRICE_PREMIUM + ' ₽/мес.', {
      title: 'Попробовать бесплатно?', icon: '🎁',
      showCancel: true, okText: 'Попробовать', cancelText: 'Купить сразу',
      onConfirm: activateTrial,
      onCancel: () => {
        showModal('Оформить Premium за ' + PRICE_PREMIUM + ' ₽/мес?', {
          title: 'Premium', icon: '💎', showCancel: true, okText: 'Оформить',
          onConfirm: activatePremium
        });
      }
    });
    return;
  }

  showModal('Оформить Premium за ' + PRICE_PREMIUM + ' ₽/мес?', {
    title: 'Premium', icon: '💎', showCancel: true, okText: 'Оформить',
    onConfirm: activatePremium
  });
}

async function activateTrial() {
  const trialUntil = Date.now() + (PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await saveStudent(studentId, {
    premiumTrialUsed: true,
    premiumTrialUntil: trialUntil
  });
  student.premiumTrialUsed = true;
  student.premiumTrialUntil = trialUntil;

  checkPremium();
  renderMarket();
  showModal('🎁 Пробный период активен!', { title: 'Попробуй Premium!', icon: '🎁' });
}

async function activatePremium() {
  await saveStudent(studentId, {
    premium: true,
    premiumTrialUntil: null
  });
  student.premium = true;
  student.premiumTrialUntil = null;

  checkPremium();
  renderMarket();
  showModal('Premium активирован!', { title: 'Поздравляем!', icon: '💎' });
                                          }
