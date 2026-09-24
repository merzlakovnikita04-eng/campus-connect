// ============================================================
// 👤 DASHBOARD.JS — ЛИЧНЫЙ КАБИНЕТ (v15 — без Premium)
// ============================================================

import {
  auth,
  getStudentByUid,
  getStudentById,
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
  setWhereabout,
  getWhereabouts,
  clearMyWhereabout,
  sendMessage,
  logoutStudent,
  onAuthStateChanged
} from './firebase.js';

import { esc, showModal } from './utils.js';

let studentId = null;
let student = null;
let studentsFilter = 'all';
let studentsSearch = '';

let authResolved = false;
let initialized = false;

onAuthStateChanged(auth, async (user) => {
  if (!authResolved) {
    authResolved = true;
    if (!user) return;
  }

  if (!user) {
    window.location.replace('index.html');
    return;
  }

  if (initialized) return;
  initialized = true;

  await new Promise(r => setTimeout(r, 500));

  let result;
  try {
    result = await getStudentByUid(user.uid);
  } catch (err) {
    showModal('Ошибка чтения students.\n\n' + (err.message || '—'),
      { title: 'Ошибка 1', icon: '⚠️', okText: 'Выйти',
        onConfirm: async () => { await logoutStudent(); window.location.reload(); } });
    return;
  }

  if (!result.success) {
    showModal('Студент не найден по uid.\n\nUID: ' + user.uid,
      { title: 'Ошибка 2', icon: '⚠️', okText: 'Выйти',
        onConfirm: async () => { await logoutStudent(); window.location.reload(); } });
    return;
  }

  studentId = result.studentId;
  student = result.data;

  try {
    renderAvatar();
    renderProfile();
    bindEvents();
  } catch (err) {
    showModal('Ошибка отрисовки профиля.\n\n' + (err.message || '—'),
      { title: 'Ошибка 3', icon: '⚠️' });
    return;
  }

  safeCall(renderAbsences, 'отсутствий');
  safeCall(renderBoard, 'рекламы');
  safeCall(renderMarket, 'маркетплейса');
  safeCall(renderVoting, 'голосования');
  safeCall(renderWhereabouts, 'Рядом');

  setInterval(() => {
    if (student) safeCall(renderWhereabouts, 'Рядом (авто)');
  }, 30000);
});

async function safeCall(fn, name) {
  try {
    await fn();
  } catch (err) {
    console.warn('⚠️ Не удалось загрузить блок ' + name + ':', err);
  }
}

function getTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

      if (btn.dataset.tab === 'students') safeCall(renderStudentsTab, 'студентов');
      if (btn.dataset.tab === 'nearby') safeCall(renderWhereabouts, 'Рядом');
    });
  });

  const imHereBtn = document.getElementById('im-here-btn');
  if (imHereBtn) {
    imHereBtn.addEventListener('click', showPlaceChooser);
  }

  const contactSendBtn = document.getElementById('contact-send-btn');
  if (contactSendBtn) {
    contactSendBtn.addEventListener('click', async () => {
      const textArea = document.getElementById('contact-text');
      const text = textArea.value.trim();

      if (!text || text.length < 5) {
        showModal('Напиши хотя бы 5 символов.', { title: 'Внимание', icon: '⚠️' });
        return;
      }

      contactSendBtn.disabled = true;
      contactSendBtn.textContent = '⏳ Отправка...';

      const result = await sendMessage({
        from: student.name,
        studentId: studentId,
        text: text
      });

      if (result.success) {
        textArea.value = '';
        showModal('Сообщение отправлено! Админ ответит.', { title: 'Готово!', icon: '📤' });
      } else {
        showModal('Ошибка: ' + result.error, { title: 'Ошибка', icon: '⚠️' });
      }

      contactSendBtn.disabled = false;
      contactSendBtn.textContent = '📤 Отправить';
    });
  }

  const absenceForm = document.getElementById('absence-form');
  const absenceDate = document.getElementById('absence-date');

  if (absenceDate) absenceDate.value = getTodayLocal();

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
      absenceDate.value = getTodayLocal();
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

      const listingId = 'lst_' + Date.now();
      const tgField = document.getElementById('listing-telegram');

      const result = await saveListing(listingId, {
        title: document.getElementById('listing-title').value.trim(),
        desc: document.getElementById('listing-desc').value.trim(),
        price: document.getElementById('listing-price').value || 0,
        phone: document.getElementById('listing-phone').value.trim(),
        telegram: tgField ? tgField.value.trim().replace('@', '') : '',
        author: student.name,
        authorId: studentId,
        uid: auth.currentUser ? auth.currentUser.uid : null,
        createdAt: new Date().toISOString()
      });

      if (!result || !result.success) {
        const errMsg = result && result.error ? result.error : 'Неизвестная ошибка';
        showModal('❌ Не удалось опубликовать.\n\nПричина: ' + errMsg,
          { title: 'Ошибка', icon: '⚠️' });
        return;
      }

      listingForm.reset();
      listingForm.classList.add('hidden');
      await renderMarket();

      showModal('Объявление опубликовано!', { title: 'Готово!', icon: '🛒' });
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
}

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

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const photos = student.photos || [];
  let html = photos.map((photo, i) => `
    <div class="gallery-item">
      <img src="${esc(photo)}" alt="Фото ${i + 1}" onclick="viewGalleryPhoto(${i})">
      <button class="gallery-delete" onclick="deleteGalleryPhoto(event, ${i})" type="button">✕</button>
    </div>
  `).join('');

  if (photos.length < 20) {
    html += `<button class="gallery-add" id="gallery-add-btn" type="button">+</button>`;
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
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('gallery-view-modal').remove()" type="button">Закрыть</button>
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

const PLACES = [
  { id: 'lecture', emoji: '📚', name: 'На лекции', needClassroom: true },
  { id: 'entrance', emoji: '🚪', name: 'У входа', needClassroom: false },
  { id: 'kb', emoji: '🛒', name: 'КБ', needClassroom: false },
  { id: 'chizhik', emoji: '🍔', name: 'Чижик', needClassroom: false },
  { id: 'magnit', emoji: '🏪', name: 'Магнит', needClassroom: false },
  { id: 'other', emoji: '✏️', name: 'Другое', needClassroom: false, custom: true }
];

async function renderWhereabouts() {
  const data = await getWhereabouts();
  const list = data.whereabouts || [];
  const container = document.getElementById('whereabouts-list');
  if (!container) return;

  const myUid = auth.currentUser ? auth.currentUser.uid : null;

  if (!list.length) {
    container.innerHTML = '<p class="muted">Пока никого нет</p>';
    return;
  }

  const grouped = {};
  list.forEach(w => {
    const key = w.place + (w.classroom ? '|' + w.classroom : '');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(w);
  });

  let html = '';
  Object.keys(grouped).forEach(key => {
    const items = grouped[key];
    const first = items[0];
    const isMe = first.uid === myUid;

    html += `
      <div class="card" style="${isMe ? 'border-color: rgba(139, 92, 246, 0.6);' : ''}">
        <h4>${esc(first.place)}${first.classroom ? ' · каб. ' + esc(first.classroom) : ''} — ${items.length} чел.</h4>
        <ul style="list-style:none; margin-top:8px; padding:0;">
          ${items.map(w => `<li style="padding:2px 0;">${esc(w.studentName)}${w.uid === myUid ? ' (Вы)' : ''}</li>`).join('')}
        </ul>
      </div>
    `;
  });

  container.innerHTML = html;
}

function showPlaceChooser() {
  const modalId = 'place-chooser';
  const old = document.getElementById(modalId);
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="padding: 24px 20px;">
      <div class="modal-icon">📍</div>
      <div class="modal-title">Где ты сейчас?</div>
      <div id="place-buttons" style="display:flex; flex-direction:column; gap:8px; margin:18px 0;">
        ${PLACES.map(p => `
          <button class="btn-secondary" data-place="${esc(p.id)}" style="width:100%; text-align:left;" type="button">
            ${esc(p.emoji)} ${esc(p.name)}
          </button>
        `).join('')}
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="place-cancel" type="button">Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#place-cancel').onclick = () => modal.remove();

  modal.querySelectorAll('[data-place]').forEach(btn => {
    btn.addEventListener('click', () => {
      const placeId = btn.dataset.place;
      const place = PLACES.find(p => p.id === placeId);
      modal.remove();
      handlePlaceSelected(place);
    });
  });
}

function handlePlaceSelected(place) {
  const isCustom = place.custom;
  const needsValue = isCustom || place.needClassroom;

  if (!needsValue) {
    doSetWhereabout(place.emoji + ' ' + place.name, '');
    return;
  }

  const modalId = 'place-input';
  const old = document.getElementById(modalId);
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="padding: 24px 20px;">
      <div class="modal-icon">${esc(place.emoji)}</div>
      <div class="modal-title">${isCustom ? 'Куда именно?' : 'Какой кабинет?'}</div>
      <input type="text" id="place-input-field" style="width:100%; padding:14px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); border-radius:12px; color:#fff; font-size:16px; margin:14px 0; box-sizing:border-box;"
        placeholder="${isCustom ? 'Например: холл, крыльцо...' : 'Например: 305'}" maxlength="30">
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="place-input-cancel" type="button">Отмена</button>
        <button class="modal-btn modal-btn-ok" id="place-input-ok" type="button">Отметиться</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector('#place-input-field');
  input.focus();

  modal.querySelector('#place-input-cancel').onclick = () => modal.remove();

  const submit = async () => {
    const value = input.value.trim();
    if (!value) {
      input.style.borderColor = '#ef4444';
      return;
    }

    const finalPlace = isCustom ? value : place.emoji + ' ' + place.name;
    const classroom = isCustom ? '' : value;

    await doSetWhereabout(finalPlace, classroom);
    modal.remove();
  };

  modal.querySelector('#place-input-ok').onclick = submit;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

async function doSetWhereabout(place, classroom) {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;

  const result = await setWhereabout(studentId, student.name, uid, place, classroom);

  if (!result.success) {
    showModal('Ошибка: ' + result.error, { title: 'Ошибка', icon: '⚠️' });
    return;
  }

  await renderWhereabouts();
  showModal('Отметка поставлена! Исчезнет через 15 минут.', { title: 'Готово!', icon: '📍' });
}

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

async function renderMarket() {
  const data = await getListings();
  const listings = data.listings || [];
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
            <h4>${esc(l.title)}</h4>
            <p>${esc(l.desc)}</p>
            <p><b>${esc(l.price)} ₽</b></p>
            <p class="muted">📞 ${esc(l.phone)} · ${esc(l.author)}</p>
            ${tgBtn}
          </div>
        `;
      }).join('')
    : '<p class="muted">Объявлений пока нет</p>';
}

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
          <b>${esc(s.name)}${isMe ? ' (Вы)' : ''}</b>
          <small>Группа: ${esc(s.group)}${s.bio ? ' · ' + esc(s.bio) : ''}</small>
        </div>
        <div class="student-item-arrow">›</div>
      </div>
    `;
  }).join('');
}

window.viewStudentProfile = async (id) => {
  const data = await getStudentById(id);
  const s = data.data;
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
        <h2 class="profile-name">${esc(s.name)}</h2>
        <p class="profile-subtitle">Группа: ${esc(s.group)} · ${esc(id)}</p>
        ${s.bio ? `<p class="profile-bio">«${esc(s.bio)}»</p>` : ''}
        ${btns.length ? `<div class="profile-actions">${btns.join('')}</div>` : ''}
      </div>
      <div class="modal-actions" style="margin-top:18px;">
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('student-profile-modal').remove()" type="button">Закрыть</button>
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

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

  let myVotes = {};
  try {
    const myVotesData = await getMyVotesToday(studentId);
    myVotes = myVotesData.voted || {};
  } catch (err) {
    console.warn('⚠️ Не удалось загрузить мои голоса:', err);
  }

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
                    onclick="vote('${esc(category.replace(/'/g, "\\'"))}', ${i})" type="button">
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
