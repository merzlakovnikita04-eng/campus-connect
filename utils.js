// ============================================================
// 🛠️ UTILS.JS — общие утилиты
// ============================================================

// Экранирование HTML — защита от XSS
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Модалка — общая для всех страниц
export function showModal(message, options) {
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
      <div class="modal-text">${esc(message)}</div>
      <div class="modal-actions">
        ${showCancel ? '<button class="modal-btn modal-btn-cancel" id="modal-cancel">' + esc(cancelText) + '</button>' : ''}
        <button class="modal-btn modal-btn-ok" id="modal-ok">${esc(okText)}</button>
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

// Скачивание CSV
export function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
