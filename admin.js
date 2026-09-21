// ============================================================
// 🛠️ ADMIN.JS — АДМИН-ПАНЕЛЬ (v3)
// ============================================================

import {
  auth,
  getPending,
  deletePending,
  approvePending,
  getStudents,
  saveStudent,
  deleteStudent,
  getAds,
  saveAd,
  deleteAd,
  getListings,
  deleteListing,
  getAbsences,
  deleteAbsence,
  getVotes,
  saveVotes,
  logoutStudent
} from './firebase.js';

const ADMIN_PASSWORD = "finall_129";

const adminGate = document.getElementById('admin-gate');
const adminPanel = document.getElementById('admin-panel');
const adminLoginForm = document.getElementById('admin-login-form');

if (sessionStorage.getItem('isAdmin') === 'true') {
  adminGate.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  initPanel();
}

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-password').value;
    const errEl = document.getElementById('admin-login-error');
    errEl.textContent = '';

    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem('isAdmin', 'true');
      adminGate.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      initPanel();
    } else {
      errEl.textContent = '❌ Неверный пароль';
      document.getElementById('admin-password').value = '';
    }
  });
}

const adminLogoutBtn = document.getElementById('admin-logout');
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    showModal('Выйти из админ-панели?', {
      title: 'Выход', icon: '🚪', showCancel: true, okText: 'Выйти',
      onConfirm: () => {
        sessionStorage.removeItem('isAdmin');
        location.reload();
      }
    });
  });
}

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

function initPanel() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  renderAll();

  const addStudentForm = document.getElementById('add-student-form');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('new-st-id').value.trim().toUpperCase();

      const studentsData = await getStudents();
      if (studentsData.students && studentsData.students[id]) {
        showModal('Студент с таким номером уже есть.', { title: 'Ошибка', icon: '⚠️' });
        return;
      }

      const data = {
        name: document.getElementById('new-st-name').value.trim(),
        group: document.getElementById('new-st-group').value.trim(),
        spec: document.getElementById('new-st-spec').value.trim(),
        premium: false,
        createdAt: new Date().toISOString()
      };

      await saveStudent(id, data);
      e.target.reset();
      renderAll();
      showModal('Студент добавлен (пароль студент задаёт сам через регистрацию).', {
        title: 'Готово!', icon: '✅'
      });
    });
  }

  const addAdForm = document.getElementById('add-ad-form');
  if (addAdForm) {
    addAdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = 'ad_' + Date.now();
      const result = await saveAd(id, {
        emoji: document.getElementById('ad-emoji').value.trim() || '📌',
        title: document.getElementById('ad-title').value.trim(),
        desc: document.getElementById('ad-desc').value.trim(),
        contact: document.getElementById('ad-contact').value.trim(),
        status: 'approved',
        createdAt: new Date().toISOString()
      });

      if (result.success) {
        e.target.reset();
        renderAll();
        showModal('Заведение добавлено.', { title: 'Готово!', icon: '📢' });
      } else {
        showModal('Не удалось добавить: ' + result.error, { title: 'Ошибка', icon: '⚠️' });
      }
    });
  }

  const addCandidateForm = document.getElementById('add-candidate-form');
  if (addCandidateForm) {
    addCandidateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = document.getElementById('candidate-category').value;
      const name = document.getElementById('candidate-name').value.trim();
      if (!name) return;

      const votesData = await getVotes();
      const votes = votesData.votes || {};
      if (!votes[category]) votes[category] = { options: [] };
      if (!votes[category].options) votes[category].options = [];

      votes[category].options.push({ name: name, votes: 0 });
      await saveVotes(votes);
      e.target.reset();
      renderAll();
      showModal('Кандидат добавлен.', { title: 'Готово!', icon: '🏆' });
    });
  }

  const resetVotesBtn = document.getElementById('reset-votes');
  if (resetVotesBtn) {
    resetVotesBtn.addEventListener('click', () => {
      showModal('Сбросить все голоса?', {
        title: 'Внимание!', icon: '⚠️', showCancel: true, okText: 'Сбросить',
        onConfirm: async () => {
          const votesData = await getVotes();
          const votes = votesData.votes || {};
          Object.keys(votes).forEach(cat => {
            if (votes[cat].options) {
              votes[cat].options.forEach(o => o.votes = 0);
            }
          });
          await saveVotes(votes);
          localStorage.removeItem('votedToday');
          renderAll();
          showModal('Все голоса сброшены.', { title: 'Готово!', icon: '✅' });
        }
      });
    });
  }
}

async function renderAll() {
  await renderStats();
  await renderRequests();
  await renderStudents();
  await renderAbsences();
  await renderAds();
  await renderListings();
  await renderVotes();
}

async function renderStats() {
  const studentsData = await getStudents();
  const pendingData = await getPending();
  const listingsData = await getListings();
  const adsData = await getAds();
  const absencesData = await getAbsences();

  const students = studentsData.students || {};
  const pending = pendingData.pending || [];
  const listings = listingsData.listings || [];
  const ads = adsData.ads || [];
  const absences = absencesData.absences || [];

  const keys = Object.keys(students);
  const now = Date.now();

  // ✅ Считаем и платных, и на триале
  const premiumCount = keys.filter(k => {
    const s = students[k];
    return s.premium === true ||
           (s.premiumTrialUntil && s.premiumTrialUntil > now);
  }).length;

  // ✅ Отдельно считаем только платных — для дохода
  const paidPremiumCount = keys.filter(k => students[k].premium === true).length;

  setText('stat-students', keys.length);
  setText('stat-pending', pending.length);
  setText('stat-premium', premiumCount);
  setText('stat-listings', listings.length);
  setText('stat-ads', ads.length);
  setText('stat-absences', absences.length);

  const incomeMarket = listings.length * 10;
  const incomePremium = paidPremiumCount * 40;
  const incomeAds = ads.length * 1000;

  setText('stat-income-market', incomeMarket + ' ₽');
  setText('stat-income-premium', incomePremium + ' ₽');
  setText('stat-income-total', (incomeMarket + incomePremium + incomeAds) + ' ₽');
  setText('stat-income-month', '0 ₽');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function renderRequests() {
  const data = await getPending();
  const pending = data.pending || [];
  const el = document.getElementById('requests-list');
  if (!el) return;

  if (!pending.length) {
    el.innerHTML = '<p class="muted">Заявок нет</p>';
    return;
  }

  el.innerHTML = pending.map((p) => `
    <div class="request-card">
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <img src="${p.photo}" alt="Фото" class="request-photo" onclick="viewPhoto('${p.id}')">
        <div class="request-info">
          <b>${p.name || '—'}</b>
          <small>Номер: <b>${p.id}</b></small>
          <small>Группа: ${p.group || '—'}</small>
          <small>Специальность: ${p.spec || '—'}</small>
          <small>🔐 Пароль: задан в Auth</small>
          <small class="muted">Отправлено: ${p.createdAt || '—'}</small>
        </div>
      </div>
      <div class="request-actions">
        <button class="btn-approve" onclick="approveRequest('${p.id}')">✅ Одобрить</button>
        <button class="btn-reject" onclick="rejectRequest('${p.id}')">❌ Отклонить</button>
      </div>
    </div>
  `).join('');
}

window.viewPhoto = async (studentId) => {
  const data = await getPending();
  const req = (data.pending || []).find(p => p.id === studentId);
  if (!req) return;

  const old = document.getElementById('photo-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'photo-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 90vw; padding: 16px;">
      <img src="${req.photo}" style="width:100%; max-height:70vh; object-fit:contain; border-radius:8px;">
      <div class="modal-actions" style="margin-top:14px;">
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('photo-modal').remove()">Закрыть</button>
      </div>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

window.approveRequest = async (studentId) => {
  const data = await getPending();
  const req = (data.pending || []).find(p => p.id === studentId);
  if (!req) return;

  showModal('Одобрить заявку от ' + req.name + '?\n\nНомер: ' + req.id, {
    title: 'Подтверждение', icon: '✅', showCancel: true, okText: 'Одобрить',
    onConfirm: async () => {
      const result = await approvePending(studentId);
      if (!result.success) {
        showModal('Ошибка: ' + result.error, { title: 'Ошибка', icon: '⚠️' });
        return;
      }
      renderAll();
      showModal('Студент одобрен!\n\nНомер: ' + studentId, {
        title: 'Готово!', icon: '✅'
      });
    }
  });
};

window.rejectRequest = async (studentId) => {
  const data = await getPending();
  const req = (data.pending || []).find(p => p.id === studentId);
  if (!req) return;

  showModal('Отклонить заявку от ' + req.name + '?\n\nЗаявка будет удалена.', {
    title: 'Подтверждение', icon: '❌', showCancel: true, okText: 'Отклонить',
    onConfirm: async () => {
      await deletePending(studentId);
      renderAll();
      showModal('Заявка отклонена.', { title: 'Готово', icon: '❌' });
    }
  });
};

async function renderStudents() {
  const data = await getStudents();
  const students = data.students || {};
  const el = document.getElementById('students-list');
  if (!el) return;
  const keys = Object.keys(students);
  const now = Date.now();

  if (!keys.length) {
    el.innerHTML = '<p class="muted">Студентов пока нет</p>';
    return;
  }

  el.innerHTML = keys.map(id => {
    const s = students[id];
    const hasPremium = s.premium === true || (s.premiumTrialUntil && s.premiumTrialUntil > now);
    return `
      <div class="list-item">
        <div>
          <b>${id}</b> — ${s.name}
          <br><small>${s.group} · ${s.spec || ''} ${hasPremium ? '⭐' : ''}</small>
        </div>
        <div class="actions">
          <button onclick="togglePremium('${id}')"
            style="background:${s.premium ? '#d32f2f' : '#f59e0b'}; margin-right:6px;">
            ${s.premium ? 'Снять ⭐' : 'Premium'}
          </button>
          <button onclick="deleteStudentConfirm('${id}')">Удалить</button>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteStudentConfirm = (id) => {
  showModal('Удалить студента ' + id + '?', {
    title: 'Внимание!', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      await deleteStudent(id);
      renderAll();
      showModal('Студент удалён.', { title: 'Готово', icon: '✅' });
    }
  });
};

window.togglePremium = async (id) => {
  const data = await getStudents();
  const s = data.students[id];
  if (!s) return;
  s.premium = !s.premium;
  await saveStudent(id, s);
  renderAll();
};

async function renderAbsences() {
  const data = await getAbsences();
  const absences = data.absences || [];
  const el = document.getElementById('absences-list');
  if (!el) return;

  if (!absences.length) {
    el.innerHTML = '<p class="muted">Отметок нет</p>';
    return;
  }

  el.innerHTML = absences.map((a) => `
    <div class="list-item">
      <div>
        <b>${a.date || '—'}</b> — ${a.studentName || '—'} (${a.studentId || '—'})
        <br><small>${a.reason || ''}${a.comment ? ' · ' + a.comment : ''}</small>
      </div>
      <div class="actions">
        <button onclick="deleteAbsenceConfirm('${a.id}')">Удалить</button>
      </div>
    </div>
  `).join('');
}

window.deleteAbsenceConfirm = (id) => {
  showModal('Удалить эту отметку?', {
    title: 'Подтверждение', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      await deleteAbsence(id);
      renderAll();
    }
  });
};

async function renderAds() {
  const data = await getAds();
  const ads = data.ads || [];
  const el = document.getElementById('ads-list');
  if (!el) return;

  el.innerHTML = ads.length
    ? ads.map(a => `
        <div class="card">
          <h4>${a.emoji || '📌'} ${a.title}</h4>
          <p>${a.desc}</p>
          <p class="muted">${a.contact}</p>
          <button class="btn-secondary" onclick="deleteAdConfirm('${a.id}')"
            style="margin-top:8px;">🗑️ Удалить</button>
        </div>
      `).join('')
    : '<p class="muted">Активных заведений нет</p>';
}

window.deleteAdConfirm = (id) => {
  showModal('Удалить это заведение?', {
    title: 'Подтверждение', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      await deleteAd(id);
      renderAll();
    }
  });
};

async function renderListings() {
  const data = await getListings();
  const listings = data.listings || [];
  const el = document.getElementById('admin-listings');
  if (!el) return;

  if (!listings.length) {
    el.innerHTML = '<p class="muted">Объявлений нет</p>';
    return;
  }

  el.innerHTML = listings.map((l) => `
    <div class="card">
      <h4>${l.premium ? '⭐ ' : ''}${l.title || '—'}</h4>
      <p>${l.desc || ''}</p>
      <p><b>${l.price || 0} ₽</b></p>
      <p class="muted">📞 ${l.phone || ''} · ${l.author || ''}</p>
      <button class="btn-secondary" onclick="deleteListingConfirm('${l.id}')"
        style="margin-top:8px;">🗑️ Удалить</button>
    </div>
  `).join('');
}

window.deleteListingConfirm = (id) => {
  showModal('Удалить объявление?', {
    title: 'Подтверждение', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      await deleteListing(id);
      renderAll();
    }
  });
};

async function renderVotes() {
  const data = await getVotes();
  const votes = data.votes || {};
  const el = document.getElementById('votes-results');
  if (!el) return;
  const keys = Object.keys(votes);

  if (!keys.length) {
    el.innerHTML = '<p class="muted">Категорий нет</p>';
    return;
  }

  el.innerHTML = keys.map(cat => `
    <div class="list-item" style="flex-direction:column; align-items:flex-start;">
      <b style="margin-bottom:8px;">${cat}</b>
      ${votes[cat].options && votes[cat].options.length
        ? votes[cat].options.map(c => `<div>${c.name} — <b>${c.votes}</b> голосов</div>`).join('')
        : '<small class="muted">Кандидатов нет</small>'}
    </div>
  `).join('');
}

window.exportStudents = async () => {
  const data = await getStudents();
  const students = data.students || {};
  const rows = [['Номер', 'ФИО', 'Группа', 'Специальность', 'Premium']];

  Object.keys(students).forEach(id => {
    const s = students[id];
    rows.push([id, s.name, s.group, s.spec || '', s.premium ? 'Да' : 'Нет']);
  });

  downloadCSV(rows, 'students.csv');
};

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showModal('Файл скачан.', { title: 'Готово!', icon: '📥' });
                                                    }
