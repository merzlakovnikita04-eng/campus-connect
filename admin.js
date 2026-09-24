// ============================================================
// 🛠️ ADMIN.JS — АДМИН-ПАНЕЛЬ (v7 — удаление кандидатов)
// ============================================================

import {
  auth,
  loginAdmin,
  logoutStudent,
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
  getMessages,
  deleteMessage
} from './firebase.js';

import { esc, showModal, downloadCSV } from './utils.js';

const adminGate = document.getElementById('admin-gate');
const adminPanel = document.getElementById('admin-panel');
const adminLoginForm = document.getElementById('admin-login-form');

auth.onAuthStateChanged((user) => {
  if (user) {
    adminGate.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    if (!adminPanel.dataset.inited) {
      adminPanel.dataset.inited = 'true';
      initPanel();
    }
  }
});

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errEl = document.getElementById('admin-login-error');
    const submitBtn = adminLoginForm.querySelector('button[type="submit"]');

    errEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Проверка...';

    const result = await loginAdmin(email, password);

    if (result.success) {
      adminGate.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      if (!adminPanel.dataset.inited) {
        adminPanel.dataset.inited = 'true';
        initPanel();
      }
    } else {
      errEl.textContent = '❌ ' + result.error;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
      document.getElementById('admin-password').value = '';
    }
  });
}

const adminLogoutBtn = document.getElementById('admin-logout');
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    showModal('Выйти из админ-панели?', {
      title: 'Выход', icon: '🚪', showCancel: true, okText: 'Выйти',
      onConfirm: async () => {
        await logoutStudent();
        location.reload();
      }
    });
  });
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
      showModal('Студент добавлен.', { title: 'Готово!', icon: '✅' });
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
  await renderMessages();
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

  const premiumCount = keys.filter(k => {
    const s = students[k];
    return s.premium === true ||
           (s.premiumTrialUntil && s.premiumTrialUntil > now);
  }).length;

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
        <img src="${esc(p.photo)}" alt="Фото" class="request-photo" onclick="viewPhoto('${esc(p.id)}')">
        <div class="request-info">
          <b>${esc(p.name) || '—'}</b>
          <small>Номер: <b>${esc(p.id)}</b></small>
          <small>Группа: ${esc(p.group) || '—'}</small>
          <small>Специальность: ${esc(p.spec) || '—'}</small>
          <small>🔐 Пароль: задан в Auth</small>
          <small class="muted">Отправлено: ${esc(p.createdAt) || '—'}</small>
        </div>
      </div>
      <div class="request-actions">
        <button class="btn-approve" onclick="approveRequest('${esc(p.id)}')" type="button">✅ Одобрить</button>
        <button class="btn-reject" onclick="rejectRequest('${esc(p.id)}')" type="button">❌ Отклонить</button>
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
      <img src="${esc(req.photo)}" style="width:100%; max-height:70vh; object-fit:contain; border-radius:8px;">
      <div class="modal-actions" style="margin-top:14px;">
        <button class="modal-btn modal-btn-ok" onclick="document.getElementById('photo-modal').remove()" type="button">Закрыть</button>
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
          <b>${esc(id)}</b> — ${esc(s.name)}
          <br><small>${esc(s.group)} · ${esc(s.spec)} ${hasPremium ? '⭐' : ''}</small>
        </div>
        <div class="actions">
          <button onclick="togglePremium('${esc(id)}')"
            style="background:${s.premium ? '#d32f2f' : '#f59e0b'}; margin-right:6px;" type="button">
            ${s.premium ? 'Снять ⭐' : 'Premium'}
          </button>
          <button onclick="deleteStudentConfirm('${esc(id)}')" type="button">Удалить</button>
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
        <b>${esc(a.date) || '—'}</b> — ${esc(a.studentName) || '—'} (${esc(a.studentId) || '—'})
        <br><small>${esc(a.reason)}${a.comment ? ' · ' + esc(a.comment) : ''}</small>
      </div>
      <div class="actions">
        <button onclick="deleteAbsenceConfirm('${esc(a.id)}')" type="button">Удалить</button>
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
          <h4>${esc(a.emoji || '📌')} ${esc(a.title)}</h4>
          <p>${esc(a.desc)}</p>
          <p class="muted">${esc(a.contact)}</p>
          <button class="btn-secondary" onclick="deleteAdConfirm('${esc(a.id)}')"
            style="margin-top:8px;" type="button">🗑️ Удалить</button>
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
      <h4>${l.premium ? '⭐ ' : ''}${esc(l.title) || '—'}</h4>
      <p>${esc(l.desc)}</p>
      <p><b>${esc(l.price) || 0} ₽</b></p>
      <p class="muted">📞 ${esc(l.phone)} · ${esc(l.author)}</p>
      ${l.telegram ? `<p class="muted">💬 ${esc(l.telegram)}</p>` : ''}
      <button class="btn-secondary" onclick="deleteListingConfirm('${esc(l.id)}')"
        style="margin-top:8px;" type="button">🗑️ Удалить</button>
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

  el.innerHTML = keys.map(cat => {
    const options = votes[cat].options || [];
    return `
      <div class="list-item" style="flex-direction:column; align-items:stretch;">
        <b style="margin-bottom:10px; font-size:16px;">${esc(cat)}</b>
        ${options.length
          ? options.map((c, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 12px; background:rgba(0,0,0,0.25); border-radius:10px; margin-bottom:6px;">
                <span>${esc(c.name)} — <b>${esc(c.votes)}</b> 🗳</span>
                <button onclick="deleteCandidate('${esc(cat.replace(/'/g, "\\'"))}', ${i})"
                  style="background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; font-family:inherit;"
                  type="button">❌ Удалить</button>
              </div>
            `).join('')
          : '<small class="muted">Кандидатов нет</small>'}
      </div>
    `;
  }).join('');
}

window.deleteCandidate = async (category, index) => {
  const data = await getVotes();
  const votes = data.votes || {};
  if (!votes[category] || !votes[category].options) return;

  const candidate = votes[category].options[index];
  if (!candidate) return;

  showModal('Удалить кандидата "' + candidate.name + '" из категории "' + category + '"?', {
    title: 'Удаление', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      votes[category].options.splice(index, 1);
      await saveVotes(votes);
      renderAll();
      showModal('Кандидат удалён.', { title: 'Готово', icon: '✅' });
    }
  });
};

async function renderMessages() {
  const data = await getMessages();
  const messages = data.messages || [];
  const el = document.getElementById('messages-list');
  if (!el) return;

  if (!messages.length) {
    el.innerHTML = '<p class="muted">Сообщений нет</p>';
    return;
  }

  el.innerHTML = messages.map(m => {
    const date = m.createdAt ? new Date(m.createdAt).toLocaleString('ru-RU') : '—';
    return `
      <div class="list-item" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px;">
          <b>${esc(m.from || 'Аноним')}${m.studentId ? ' · ' + esc(m.studentId) : ''}</b>
          <small class="muted" style="font-size:12px;">${esc(date)}</small>
        </div>
        <div style="padding:10px 14px; background:rgba(0,0,0,0.25); border-radius:10px; margin-bottom:10px; font-size:14px; line-height:1.5; white-space:pre-wrap;">${esc(m.text)}</div>
        <button class="btn-secondary" onclick="deleteMessageConfirm('${esc(m.id)}')" style="align-self:flex-start;" type="button">🗑️ Удалить</button>
      </div>
    `;
  }).join('');
}

window.deleteMessageConfirm = (id) => {
  showModal('Удалить это сообщение?', {
    title: 'Подтверждение', icon: '🗑️', showCancel: true, okText: 'Удалить',
    onConfirm: async () => {
      await deleteMessage(id);
      renderAll();
    }
  });
};

window.exportStudents = async () => {
  const data = await getStudents();
  const students = data.students || {};
  const rows = [['Номер', 'ФИО', 'Группа', 'Специальность', 'Premium']];

  Object.keys(students).forEach(id => {
    const s = students[id];
    rows.push([id, s.name, s.group, s.spec || '', s.premium ? 'Да' : 'Нет']);
  });

  downloadCSV(rows, 'students.csv');
  showModal('Файл скачан.', { title: 'Готово!', icon: '📥' });
};
