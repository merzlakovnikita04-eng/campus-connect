// ============================================================
// 📱 CAMPUS CONNECT — ЛОГИКА (Firebase)
// ============================================================

import {
  auth,
  savePending,
  loginStudent,
  onAuthStateChanged
} from './firebase.js';

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

const loginForm = document.getElementById('login-form');

if (loginForm) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const savedId = localStorage.getItem('studentId');
      if (savedId) location.href = 'dashboard.html';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('student-id').value.trim().toUpperCase();
    const password = document.getElementById('student-password').value;
    const errEl = document.getElementById('login-error');
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    errEl.textContent = '';
    errEl.style.color = '#d32f2f';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Проверка...';

    const result = await loginStudent(studentId, password);

    if (result.success) {
      errEl.style.color = '#10b981';
      errEl.textContent = '✅ Вход выполнен!';
      setTimeout(() => location.href = 'dashboard.html', 500);
    } else {
      errEl.textContent = '❌ ' + result.error;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
      document.getElementById('student-password').value = '';
    }
  });
}

const registerForm = document.getElementById('register-form');

if (registerForm) {
  const photoInput = document.getElementById('reg-photo');
  const photoPreview = document.getElementById('photo-preview');
  const errEl = document.getElementById('register-error');
  const passwordInput = document.getElementById('reg-password');
  const password2Input = document.getElementById('reg-password2');

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const pwd = passwordInput.value;
      const hint = document.getElementById('password-hint');
      if (!hint) return;

      if (pwd.length === 0) {
        hint.textContent = 'Буквы и цифры — надёжнее';
        hint.style.color = 'rgba(255,255,255,0.45)';
      } else if (pwd.length < 8) {
        hint.textContent = '🔴 Мало символов (' + pwd.length + '/8)';
        hint.style.color = '#fca5a5';
      } else if (!/[a-zA-Zа-яА-Я]/.test(pwd) || !/\d/.test(pwd)) {
        hint.textContent = '🟡 Хорошо, но добавь буквы и цифры';
        hint.style.color = '#fbbf24';
      } else {
        hint.textContent = '🟢 Надёжный пароль';
        hint.style.color = '#10b981';
      }
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) {
        photoPreview.classList.add('hidden');
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        errEl.textContent = '⚠️ Фото слишком большое (макс. 3 МБ)';
        photoInput.value = '';
        photoPreview.classList.add('hidden');
        return;
      }
      errEl.textContent = '';
      const reader = new FileReader();
      reader.onload = (e) => {
        photoPreview.src = e.target.result;
        photoPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    errEl.style.color = '#d32f2f';

    const name = document.getElementById('reg-name').value.trim();
    const group = document.getElementById('reg-group').value.trim();
    const spec = document.getElementById('reg-spec').value.trim();
    const photoFile = photoInput.files[0];
    const password = passwordInput.value;
    const password2 = password2Input.value;
    const agree = document.getElementById('reg-agree').checked;
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    if (!photoFile) { errEl.textContent = '📷 Прикрепите фото студенческого'; return; }
    if (password.length < 8) { errEl.textContent = '🔐 Пароль должен быть минимум 8 символов'; return; }
    if (password !== password2) { errEl.textContent = '🔐 Пароли не совпадают'; return; }
    if (!agree) { errEl.textContent = '✅ Нужно согласие на обработку данных'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Отправка...';

    let counter = parseInt(localStorage.getItem('studentCounter') || '0') + 1;
    localStorage.setItem('studentCounter', counter.toString());
    const newId = 'СТ-' + new Date().getFullYear() + '-' + String(counter).padStart(3, '0');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const photoBase64 = e.target.result;
      const result = await savePending(newId, {
        name: name, group: group, spec: spec, photo: photoBase64, password: password
      });

      if (result.success) {
        showModal('Ваш номер: ' + newId + '\n\n🔐 Пароль сохранён.\n\nДождитесь одобрения админа.', {
          title: 'Заявка отправлена!', icon: '✅', okText: 'Понятно',
          onConfirm: () => { location.href = 'index.html'; }
        });
      } else {
        errEl.textContent = '❌ Ошибка: ' + result.error;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
      }
    };
    reader.readAsDataURL(photoFile);
  });
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

window.switchTab = switchTab;
