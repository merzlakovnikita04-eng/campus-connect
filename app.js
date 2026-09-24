// ============================================================
// 📱 CAMPUS CONNECT — ЛОГИКА (v8 — змейка после регистрации)
// ============================================================

import {
  auth,
  createPendingAccount,
  loginStudent,
  sendMessage,
  onAuthStateChanged,
  getNextStudentNumber
} from './firebase.js';

import { esc, showModal } from './utils.js';

// ==================== 📝 ВХОД ====================
const loginForm = document.getElementById('login-form');

if (loginForm) {
  onAuthStateChanged(auth, () => {});

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
      window.location.replace('dashboard.html');
    } else {
      errEl.textContent = '❌ ' + esc(result.error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
      document.getElementById('student-password').value = '';
    }
  });
}

// ==================== 💬 СВЯЗАТЬСЯ С АДМИНОМ ====================
const contactAdminBtn = document.getElementById('contact-admin-btn');

if (contactAdminBtn) {
  contactAdminBtn.addEventListener('click', showContactForm);
}

function showContactForm() {
  const old = document.getElementById('contact-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'contact-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="padding: 24px 20px; text-align:left;">
      <div class="modal-icon" style="text-align:center;">💬</div>
      <div class="modal-title" style="text-align:center;">Связаться с админом</div>
      <p class="muted" style="text-align:center; margin-bottom:14px;">Опиши проблему — админ ответит.</p>

      <label style="display:block; font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:6px; text-transform:uppercase; font-weight:600;">Как тебя зовут (необязательно)</label>
      <input type="text" id="contact-from" placeholder="Например: Иванов И.И." maxlength="60" style="width:100%; padding:13px 15px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); border-radius:12px; font-size:15px; color:#fff; margin-bottom:12px; box-sizing:border-box;">

      <label style="display:block; font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:6px; text-transform:uppercase; font-weight:600;">Сообщение</label>
      <textarea id="contact-text-area" rows="4" placeholder="Опиши проблему..." maxlength="500" style="width:100%; padding:13px 15px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); border-radius:12px; font-size:15px; color:#fff; margin-bottom:12px; box-sizing:border-box; resize:vertical; font-family:inherit;"></textarea>

      <p id="contact-error" style="color:#fca5a5; font-size:13px; min-height:18px; margin-bottom:12px;"></p>

      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" id="contact-cancel" type="button">Отмена</button>
        <button class="modal-btn modal-btn-ok" id="contact-submit" type="button">Отправить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#contact-cancel').onclick = () => modal.remove();

  modal.querySelector('#contact-submit').onclick = async () => {
    const from = modal.querySelector('#contact-from').value.trim() || 'Аноним';
    const text = modal.querySelector('#contact-text-area').value.trim();
    const errEl = modal.querySelector('#contact-error');

    if (!text || text.length < 5) {
      errEl.textContent = 'Напиши хотя бы 5 символов';
      return;
    }

    const btn = modal.querySelector('#contact-submit');
    btn.disabled = true;
    btn.textContent = '⏳ Отправка...';

    const result = await sendMessage({ from, text });

    if (result.success) {
      modal.remove();
      showModal('Сообщение отправлено! Админ ответит.', { title: 'Готово!', icon: '📤' });
    } else {
      errEl.textContent = 'Ошибка: ' + result.error;
      btn.disabled = false;
      btn.textContent = 'Отправить';
    }
  };

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// ==================== 🗜 СЖАТИЕ ФОТО ====================
function compressImage(file, maxSize = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Это не изображение'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (w > h && w > maxSize) {
          h = Math.round(h * maxSize / w);
          w = maxSize;
        } else if (h > maxSize) {
          w = Math.round(w * maxSize / h);
          h = maxSize;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Не удалось открыть изображение'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

// ==================== 📝 РЕГИСТРАЦИЯ ====================
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

  if (photoInput && photoPreview) {
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) {
        photoPreview.classList.add('hidden');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        errEl.textContent = '⚠️ Файл слишком большой (макс. 10 МБ)';
        photoInput.value = '';
        photoPreview.classList.add('hidden');
        return;
      }

      errEl.textContent = '';
      try {
        const compressed = await compressImage(file, 900, 0.7);
        photoPreview.src = compressed;
        photoPreview.classList.remove('hidden');
      } catch (e) {
        errEl.textContent = '⚠️ ' + e.message;
        photoPreview.classList.add('hidden');
      }
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
    submitBtn.textContent = '⏳ Сжатие фото...';

    try {
      const photoBase64 = await compressImage(photoFile, 900, 0.7);

      if (photoBase64.length > 1000000) {
        errEl.textContent = '⚠️ Фото слишком тяжёлое даже после сжатия. Попробуйте другое.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
        return;
      }

      submitBtn.textContent = '⏳ Отправка...';

      const newId = await getNextStudentNumber();

      const result = await createPendingAccount(newId, password, {
        name: name,
        group: group,
        spec: spec,
        photo: photoBase64
      });

      if (result.success) {
        showModal(
          'Ваш номер: ' + newId + '\n\n🔐 Пароль сохранён.\n\nДождитесь одобрения админа — потом сможешь играть в змейку и получать статусы!',
          {
            title: 'Заявка отправлена!',
            icon: '✅',
            okText: 'Понятно',
            onConfirm: () => { window.location.replace('index.html'); }
          }
        );
      } else {
        errEl.textContent = '❌ ' + esc(result.error);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
      }
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error);
      errEl.textContent = '❌ ' + esc(error.message || 'Произошла ошибка. Попробуйте позже.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
    }
  });
}

// ==================== 🔄 ТАБЫ ====================
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

window.switchTab = switchTab;
