// ============================================================
// 🐉 SNAKE.JS — игра «Змейка» + средневековые статусы
// ============================================================

import {
  auth,
  getStudentByUid,
  saveStudent,
  onAuthStateChanged,
  logoutStudent
} from './firebase.js';

import { esc, showModal } from './utils.js';

// ==================== КОНФИГ ====================
const CANVAS_SIZE = 320;
const CELL_SIZE = 16;
const GRID_SIZE = CANVAS_SIZE / CELL_SIZE; // 20
const REPLAY_DAYS = 7;

const STATUSES = [
  { min: 60, name: 'Дракон', emoji: '🐉' },
  { min: 30, name: 'Рыцарь', emoji: '🐎' },
  { min: 20, name: 'Паладин', emoji: '🛡' },
  { min: 10, name: 'Воин', emoji: '⚔️' },
  { min: 5, name: 'Наёмник', emoji: '🗡' },
  { min: 0, name: 'Крыса', emoji: '🐀' }
];

function getStatusByScore(score) {
  for (const s of STATUSES) {
    if (score >= s.min) return s;
  }
  return STATUSES[STATUSES.length - 1];
}

// ==================== СОСТОЯНИЕ ====================
let studentId = null;
let student = null;
let snake = [];
let food = { x: 10, y: 10 };
let direction = { x: 0, y: 0 };
let nextDirection = { x: 0, y: 0 };
let score = 0;
let gameLoop = null;
let isPlaying = false;
let speed = 120;

const canvas = document.getElementById('snake-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const scoreEl = document.getElementById('snake-score-value');

// ==================== СТАРТ ====================
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

  const result = await getStudentByUid(user.uid);
  if (!result.success) {
    showModal('Студент не найден или заявка ещё не одобрена.', {
      title: 'Ошибка', icon: '⚠️', okText: 'Выйти',
      onConfirm: async () => { await logoutStudent(); window.location.replace('index.html'); }
    });
    return;
  }

  studentId = result.studentId;
  student = result.data;

  renderStatusBlock();
  bindEvents();

  if (!canReplay()) {
    document.getElementById('snake-start-btn').disabled = true;
    document.getElementById('snake-start-btn').textContent = '⏳ Переигровка через ' + daysUntilReplay() + ' дн.';
  }
});

// ==================== СТАТУС ====================
function renderStatusBlock() {
  const el = document.getElementById('snake-status-text');
  if (!el) return;

  const best = student.snakeBest || 0;
  const status = student.snakeStatus || null;
  const canReplayNow = canReplay();

  if (!status) {
    el.innerHTML = 'Ты ещё не играл. Сыграй — получишь статус! 🏰';
  } else {
    el.innerHTML = `Твой статус: <b style="font-size:20px;">${esc(status)}</b><br>
                    Лучший результат: <b>${best}</b> очков<br>
                    ${canReplayNow ? '✅ Можно переиграть' : '⏳ Переигровка через ' + daysUntilReplay() + ' дн.'}`;
  }
}

// ==================== ИГРА ====================
function initGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  if (scoreEl) scoreEl.textContent = '0';
  placeFood();
  draw();
}

function placeFood() {
  let ok = false;
  let attempts = 0;
  while (!ok && attempts < 500) {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    ok = !snake.some(s => s.x === food.x && s.y === food.y);
    attempts++;
  }
}

function draw() {
  if (!ctx) return;

  ctx.fillStyle = '#0f0c29';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
    ctx.stroke();
  }

  ctx.font = (CELL_SIZE - 2) + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍎', food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2);

  snake.forEach((seg, i) => {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (i === 0) {
      grad.addColorStop(0, '#a78bfa');
      grad.addColorStop(1, '#ec4899');
    } else {
      grad.addColorStop(0, '#8b5cf6');
      grad.addColorStop(1, '#ec4899');
    }
    ctx.fillStyle = grad;
    const pad = 1;
    ctx.beginPath();
    ctx.roundRect(
      seg.x * CELL_SIZE + pad,
      seg.y * CELL_SIZE + pad,
      CELL_SIZE - pad * 2,
      CELL_SIZE - pad * 2,
      4
    );
    ctx.fill();
  });
}

function step() {
  direction = { ...nextDirection };

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return endGame();
  }

  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return endGame();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    if (scoreEl) scoreEl.textContent = score;
    placeFood();
    if (speed > 60) {
      speed -= 2;
      clearInterval(gameLoop);
      gameLoop = setInterval(step, speed);
    }
  } else {
    snake.pop();
  }

  draw();
}

function startGame() {
  if (isPlaying) return;

  if (!canReplay()) {
    showModal('Ты недавно играл. Переигровка через ' + daysUntilReplay() + ' дн.', {
      title: 'Подожди', icon: '⏳'
    });
    return;
  }

  isPlaying = true;
  speed = 120;
  initGame();

  document.getElementById('snake-game-block').classList.remove('hidden');
  document.getElementById('snake-result-block').classList.add('hidden');
  document.getElementById('snake-start-btn').disabled = true;
  document.getElementById('snake-start-btn').textContent = '🎮 Игра идёт...';

  if (gameLoop) clearInterval(gameLoop);
  gameLoop = setInterval(step, speed);
}

function endGame() {
  isPlaying = false;
  if (gameLoop) clearInterval(gameLoop);

  const status = getStatusByScore(score);

  document.getElementById('snake-result-title').textContent = 'Игра окончена!';
  document.getElementById('snake-result-status').innerHTML =
    `Твой статус: ${esc(status.emoji)} <b>${esc(status.name)}</b>`;
  document.getElementById('snake-result-score').textContent =
    `Очки: ${score}. Лучший результат: ${Math.max(score, student.snakeBest || 0)}.`;

  document.getElementById('snake-result-block').classList.remove('hidden');
  document.getElementById('snake-game-block').classList.add('hidden');
  document.getElementById('snake-start-btn').disabled = false;
  document.getElementById('snake-start-btn').textContent = '▶️ Начать игру';
}

// ==================== СОХРАНЕНИЕ ====================
async function saveResult() {
  if (!student || !studentId) return;

  const status = getStatusByScore(score);
  const best = Math.max(score, student.snakeBest || 0);

  const now = Date.now();
  const replayAt = now + REPLAY_DAYS * 24 * 60 * 60 * 1000;

  const updates = {
    snakeBest: best,
    snakeStatus: status.emoji + ' ' + status.name,
    snakePlayedAt: now,
    snakeCanReplayAt: replayAt
  };

  const result = await saveStudent(studentId, updates);

  if (!result.success) {
    showModal('Не удалось сохранить: ' + result.error, { title: 'Ошибка', icon: '⚠️' });
    return;
  }

  Object.assign(student, updates);

  renderStatusBlock();

  showModal(
    `Результат сохранён!\n\nСтатус: ${status.emoji} ${status.name}\nОчки: ${score}\nПереигровка через ${REPLAY_DAYS} дн.`,
    { title: 'Готово!', icon: '🏰', okText: 'В кабинет',
      onConfirm: () => { window.location.href = 'dashboard.html'; } }
  );
}

// ==================== ПЕРЕИГРОВКА ====================
function canReplay() {
  if (!student) return true;
  if (!student.snakeCanReplayAt) return true;
  return Date.now() >= student.snakeCanReplayAt;
}

function daysUntilReplay() {
  if (!student || !student.snakeCanReplayAt) return 0;
  const diff = student.snakeCanReplayAt - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ==================== СОБЫТИЯ ====================
function bindEvents() {
  const startBtn = document.getElementById('snake-start-btn');
  if (startBtn) startBtn.addEventListener('click', startGame);

  const saveBtn = document.getElementById('snake-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveResult);

  const againBtn = document.getElementById('snake-again-btn');
  if (againBtn) {
    againBtn.addEventListener('click', () => {
      if (!canReplay()) {
        showModal('Переигровка через ' + daysUntilReplay() + ' дн.', { title: 'Подожди', icon: '⏳' });
        return;
      }
      document.getElementById('snake-result-block').classList.add('hidden');
      document.getElementById('snake-game-block').classList.remove('hidden');
      startGame();
    });
  }

  document.querySelectorAll('[data-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir === 'up' && direction.y !== 1) nextDirection = { x: 0, y: -1 };
      if (dir === 'down' && direction.y !== -1) nextDirection = { x: 0, y: 1 };
      if (dir === 'left' && direction.x !== 1) nextDirection = { x: -1, y: 0 };
      if (dir === 'right' && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.key === 'ArrowUp' && direction.y !== 1) nextDirection = { x: 0, y: -1 };
    if (e.key === 'ArrowDown' && direction.y !== -1) nextDirection = { x: 0, y: 1 };
    if (e.key === 'ArrowLeft' && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    if (e.key === 'ArrowRight' && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    e.preventDefault();
  });
}
