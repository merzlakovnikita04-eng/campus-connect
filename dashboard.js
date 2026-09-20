// ============================================================
// 👤 DASHBOARD.JS — ЛИЧНЫЙ КАБИНЕТ (Firebase)
// ============================================================

import {
  auth,
  db,
  getStudents,
  saveStudent,
  getAds,
  getListings,
  saveListing,
  getAbsences,
  saveAbsence,
  getVotes,
  saveVotes,
  logoutStudent,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from './firebase.js';

// ==================== НАСТРОЙКИ ====================
const PRICE_PREMIUM = 40;
const PRICE_LISTING = 10;
const FREE_LISTINGS = 5;
const PREMIUM_TRIAL_DAYS = 3;

// ==================== ПРОВЕРКА ВХОДА ====================
const studentId = localStorage.getItem('studentId');
if (!studentId) location.href = 'index.html';

let student = null;

// ==================== СТАРТ ====================
window.addEventListener('DOMContentLoaded', async () => {
  await loadStudent();
  if (student) {
    renderAvatar();
    renderProfile();
    renderAbsences();
    renderBoard();
    renderMarket();
    renderVoting();
    checkPremium();
    updateFreeListingsInfo();
  }
});

// ==================== ЗАГРУЗКА СТУДЕНТА ====================
async function loadStudent() {
  try {
    const data = await getStudents();
    student = data.students[studentId];

    if (!student) {
      showModal('Студент не найден в базе.', {
        title: 'Ошибка', icon: '⚠️',
        onConfirm: () => {
          localStorage.removeItem('studentId');
          location.href = 'index.html';
        }
      });
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error);
  }
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
    return `<img src="${s.avatar}" alt="${s.name}" class="${size === 'big' ? 'profile-avatar' : 'student-avatar-mini'}">`;
  }
  const letter = s.name.charAt(0).toUpperCase();
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
  document.getElementById('profile-name').textContent = student.name;
  document.getElementById('profile-group').textContent = student.group;
  document.getElementById('profile-id').textContent = studentId;

  const bioEl = document.getElementById('profile-bio');
  bioEl.textContent = student.bio ? `«${student.bio}»` : '';

  const actionsEl = document.getElementById('profile-actions');
  const btns = [];

  if (student.phone && student.showPhone) {
    btns.push(`<a href="tel:${student.phone.replace(/\s/g, '')}" class="btn-contact btn-call">📞 Позвонить</a>`);
  }

  if (student.telegram && student.showTelegram) {
    const tg = student.telegram.replace('@', '');
    btns.push(`<a href="https://t.me/${tg}" target="_blank" class="btn-contact btn-tg">💬 Telegram</a>`);
  }

  actionsEl.innerHTML = btns.join('');
  renderGallery();
}

function checkPremium() {
  const now = Date.now();
  const hasPremium = student.premium === true;
  const trialActive = student.premiumTrialUntil && student.premiumTrialUntil > now;

  if (hasPremium || trialActive) {
    document.getElementById('premium-badge').classList.remove('hidden');
    if (trialActive && !hasPremium) {
      const daysLeft = Math.ceil((student.premiumTrialUntil - now) / (1000 * 60 * 60 * 24));
      document.getElementById('premium-status').textContent = '🎁 Пробный период: осталось ' + daysLeft + ' дн.';
    } else {
      document.getElementById('premium-status').textContent = '✅ Premium активен';
    }
  }
}

// ==================== РЕДАКТИРОВАНИЕ ====================
const profileView = document.getElementById('profile-view');
const profileEdit = document.getElementById('profile-edit');

document.getElementById('edit-profile-btn').addEventListener('click', () => {
  document.getElementById('edit-phone').value = student.phone || '';
  document.getElementById('edit-show-phone').checked = student.showPhone !== false;
  document.getElementById('edit-telegram').value = student.telegram || '';
  document.getElementById('edit-show-telegram').checked = student.showTelegram !== false;
  document.getElementById('edit-bio').value = student.bio || '';

  profileView.classList.add('hidden');
  profileEdit.classList.remove('hidden');
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
  profileView.classList.remove('hidden');
  profileEdit.classList.add('hidden');
});

document.getElementById('save-profile-btn').addEventListener('click', async () => {
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

// ==================== АВАТАРКА ====================
document.getElementById('avatar-edit-btn').addEventListener('click', () => {
  document.getElementById('edit-avatar-input').click();
});

// Общая функция обработки фото (для галереи И камеры)
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

document.getElementById('edit-avatar-input').addEventListener('change', handleAvatarChange);

const avatarCameraInput = document.getElementById('edit-avatar-camera');
if (avatarCameraInput) {
  avatarCameraInput.addEventListener('change', handleAvatarChange);
}

// ==================== ГАЛЕРЕЯ ====================
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const photos = student.photos || [];
  let html = photos.map((photo, i) => `
    <div class="gallery-item">
      <img src="${photo}" alt="Фото ${i + 1}" onclick="viewGalleryPhoto(${i})">
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
      <img src="${photo}" style="width:100%; max-height:75vh; object-fit:contain; border-radius:12px;">
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

// ==================== 🚪 ВЫХОД ====================
document.getElementById('logout-btn').addEventListener('click', () => {
  showModal('Выйти из личного кабинета?', {
    title: 'Выход', icon: '🚪', showCancel: true, okText: 'Выйти',
    onConfirm: async () => {
      await logoutStudent();
      localStorage.removeItem('studentId');
      location.href = 'index.html';
    }
  });
});

// ==================== 🔄 ТАБЫ ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'students') renderStudentsTab();
  });
});

// ==================== 📅 ОТСУТСТВИЕ ====================
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

async function renderAbsences() {
  const data = await getAbsences();
  const mine = (data.absences || []).filter(a => a.studentId === studentId);
  const el = document.getElementById('absence-list');
  if (!el) return;

  el.innerHTML = mine.length
    ? mine.map(a => `
        <div class="list-item">
          <div>
            <b>${a.date}</b> — ${a.reason}
            ${a.comment ? `<br><small>${a.comment}</small>` : ''}
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
          <h4>${a.emoji || '📌'} ${a.title}</h4>
          <p>${a.desc}</p>
          <p class="muted">${a.contact}</p>
        </div>
      `).join('')
    : '<p class="muted">Пока нет заведений.</p>';
}

// ==================== 🛒 МАРКЕТПЛЕЙС ====================
const listingForm = document.getElementById('listing-form');
const newListingBtn = document.getElementById('new-listing-btn');

if (newListingBtn) {
  newListingBtn.addEventListener('click', () => listingForm.classList.toggle('hidden'));
}

const cancelListingBtn = document.getElementById('cancel-listing');
if (cancelListingBtn) {
  cancelListingBtn.addEventListener('click', () => listingForm.classList.add('hidden'));
}

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
      await saveListing(listingId, {
        title: document.getElementById('listing-title').value.trim(),
        desc: document.getElementById('listing-desc').value.trim(),
        price: document.getElementById('listing-price').value,
        phone: document.getElementById('listing-phone').value.trim(),
        author: student.name,
        authorId: studentId,
        premium: student.premium || (student.premiumTrialUntil && student.premiumTrialUntil > Date.now()),
        createdAt: new Date().toISOString()
      });

      listingForm.reset();
      listingForm.classList.add('hidden');
      renderMarket();
      updateFreeListingsInfo();

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

async function renderMarket() {
  const data = await getListings();
  const listings = data.listings || [];
  listings.sort((a, b) => (b.premium ? 1 : 0) - (a.premium ? 1 : 0));
  const el = document.getElementById('market-list');
  if (!el) return;

  el.innerHTML = listings.length
    ? listings.map(l => `
        <div class="card">
          <h4>${l.premium ? '⭐ ' : ''}${l.title}</h4>
          <p>${l.desc}</p>
          <p><b>${l.price} ₽</b></p>
          <p class="muted">📞 ${l.phone} · ${l.author}</p>
        </div>
      `).join('')
    : '<p class="muted">Объявлений пока нет</p>';
}

// ==================== 👥 СТУДЕНТЫ ====================
let studentsFilter = 'all';
let studentsSearch = '';

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
      <div class="student-item" onclick="viewStudentProfile('${id}')">
        ${getAvatarHTML(s, 'mini')}
        <div class="student-item-info">
          <b>${s.name}${isMe ? ' (Вы)' : ''}${s.premium ? ' ⭐' : ''}</b>
          <small>Группа: ${s.group}${s.bio ? ' · ' + s.bio : ''}</small>
        </div>
        <div class="student-item-arrow">›</div>
      </div>
    `;
  }).join('');
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

window.viewStudentProfile = async (id) => {
  const data = await getStudents();
  const s = data.students[id];
  if (!s) return;

  if (id === studentId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="profile"]').classList.add('active');
    document.getElementById('tab-profile').classList.add('active');
    return;
  }

  const btns = [];
  if (s.phone && s.showPhone) {
    btns.push(`<a href="tel:${s.phone.replace(/\s/g, '')}" class="btn-contact btn-call">📞 Позвонить</a>`);
  }
  if (s.telegram && s.showTelegram) {
    const tg = s.telegram.replace('@', '');
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
        <h2 class="profile-name">${s.name}${s.premium ? ' ⭐' : ''}</h2>
        <p class="profile-subtitle">Группа: ${s.group} · ${id}</p>
        ${s.bio ? `<p class="profile-bio">«${s.bio}»</p>` : ''}
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
  const votedToday = JSON.parse(localStorage.getItem('votedToday') || '{}');
  const today = new Date().toDateString();
  const container = document.getElementById('voting-container');
  if (!container) return;

  const categories = Object.keys(votes);
  if (!categories.length) {
    container.innerHTML = '<p class="muted">Категорий пока нет</p>';
    return;
  }

  container.innerHTML = categories.map(category => {
    const options = votes[category].options || [];
    const votedKey = studentId + '_' + category;
    const alreadyVoted = votedToday[votedKey] === today;

    return `
      <div class="vote-category">
        <h3>${category}</h3>
        ${options.length
          ? options.map((opt, i) => `
              <div class="vote-option">
                <span>${opt.name}</span>
                <span style="display:flex; align-items:center; gap:8px;">
                  <span class="count">${opt.votes} 🗳</span>
                  <button ${alreadyVoted ? 'disabled' : ''}
                    onclick="vote('${category.replace(/'/g, "\\'")}', ${i})">
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
  const data = await getVotes();
  const votes = data.votes;
  const votedToday = JSON.parse(localStorage.getItem('votedToday') || '{}');
  const today = new Date().toDateString();
  const key = studentId + '_' + category;

  if (votedToday[key] === today) {
    showModal('Вы уже голосовали сегодня.', { title: 'Уже голосовали', icon: '🗳️' });
    return;
  }

  votes[category].options[index].votes++;
  await saveVotes(votes);

  votedToday[key] = today;
  localStorage.setItem('votedToday', JSON.stringify(votedToday));
  renderVoting();
  showModal('Голос учтён. Спасибо!', { title: '✅', icon: '🗳️' });
};

// ==================== 💎 ПРЕМИУМ ====================
document.getElementById('buy-premium').addEventListener('click', () => {
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
});

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

// ==================== 🪟 МОДАЛКИ ====================
function showModal(message, options) {
  options = options || {};
  const title = options.title || 'Сообщение';
  const icon = options.icon || '💬';
  const okText = options.okText || 'ОК';
  const cancelText = options.cancelText || 'Отмена';
  const showCancel = options.showCancel || false;
  const onConfirm = options.onConfirm || null;
  const onCancel = options.onCancel || null;

  const old = document.getElementById('app-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'app-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">${icon}</div>
      <div class="modal-title">${title}</div>
      <div class="modal-text">${message}</div>
      <div class="modal-actions">
        ${showCancel ? '<button class="modal-btn modal-btn-cancel" id="modal-cancel">' + cancelText + '</button>' : ''}
        <button class="modal-btn modal-btn-ok" id="modal-ok">${okText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function close() {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 150);
  }

  document.getElementById('modal-ok').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };

  if (showCancel) {
    document.getElementById('modal-cancel').onclick = () => {
      close();
      if (onCancel) onCancel();
    };
  }
}

window.showModal = showModal;
