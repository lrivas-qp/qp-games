// ── Imports Firebase ──────────────────────────────────────────────────────
import { saveScore, getTopTen } from './firebase-config.js?v=1';

// ── Constantes del juego ──────────────────────────────────────────────────
const COLS = 21;
const ROWS = 21;
const START_STEP_MS = 140;   // ms por paso al inicio (más alto = más lento)
const MIN_STEP_MS = 70;      // velocidad máxima
const SPEEDUP_EVERY = 4;     // cada cuántas comidas sube la velocidad
const STEP_DECREMENT = 8;    // ms que se restan por subida de velocidad
const POINTS_PER_FOOD = 10;

// ── Estado ────────────────────────────────────────────────────────────────
const state = {
  snake: [],
  dir: { x: 1, y: 0 },
  pendingDir: null,
  food: { x: 0, y: 0 },
  score: 0,
  foodCount: 0,
  stepMs: START_STEP_MS,
  running: false,
  lastStepTime: 0,
  rafId: null,
  best: 0,
  scoreSubmitted: false,
  countdownTimer: null
};

// ── Referencias DOM ───────────────────────────────────────────────────────
const canvas        = document.getElementById('board');
const ctx           = canvas.getContext('2d');
const scoreDisplay  = document.getElementById('score-display');
const bestDisplay   = document.getElementById('best-display');
const speedDisplay  = document.getElementById('speed-display');
const startScreen   = document.getElementById('start-screen');
const gameoverScreen= document.getElementById('gameover-screen');
const finalScore    = document.getElementById('final-score');
const finalLength   = document.getElementById('final-length');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');
const countdownOverlay= document.getElementById('countdown-overlay');
const countdownNum  = document.getElementById('countdown-num');

let cell = 20; // tamaño de celda en px (se recalcula al redimensionar)

// ── Canvas responsivo ───────────────────────────────────────────────────--
function resizeCanvas() {
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const sizePx = Math.floor(Math.min(rect.width, rect.height));
  const dpr = window.devicePixelRatio || 1;

  cell = Math.floor(sizePx / COLS);
  const boardPx = cell * COLS;

  canvas.style.width = `${boardPx}px`;
  canvas.style.height = `${cell * ROWS}px`;
  canvas.width = boardPx * dpr;
  canvas.height = cell * ROWS * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw();
}

// ── Utilidades ──────────────────────────────────────────────────────────--
function randInt(n) { return Math.floor(Math.random() * n); }

function spawnFood() {
  const occupied = new Set(state.snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = { x: randInt(COLS), y: randInt(ROWS) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  state.food = pos;
}

function getSpeedLevel() {
  return Math.floor(state.foodCount / SPEEDUP_EVERY) + 1;
}

// ── Dirección / input ─────────────────────────────────────────────────────
function setDirection(dx, dy) {
  if (!state.running) return;
  // Dirección efectiva contra la cual evaluar el giro (evita reversa 180°)
  const last = state.pendingDir || state.dir;
  if (dx === -last.x && dy === -last.y) return;
  if (dx === last.x && dy === last.y) return;
  state.pendingDir = { x: dx, y: dy };
}

const KEY_DIRS = {
  ArrowUp:    [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown:  [0,  1], s: [0,  1], S: [0,  1],
  ArrowLeft:  [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [ 1, 0], d: [ 1, 0], D: [ 1, 0]
};

document.addEventListener('keydown', (e) => {
  if (document.activeElement === playerNameInput) return;
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();
    setDirection(dir[0], dir[1]);
  }
});

// Controles táctiles (d-pad)
document.querySelectorAll('.dpad-btn').forEach(btn => {
  const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const d = map[btn.dataset.dir];
  const handler = (e) => { e.preventDefault(); setDirection(d[0], d[1]); };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', handler, { passive: false });
});

// Swipe sobre el tablero
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
  else setDirection(0, dy > 0 ? 1 : -1);
  touchStart = null;
}, { passive: true });

// ── Game loop ─────────────────────────────────────────────────────────────
function loop(now) {
  if (!state.running) return;
  if (now - state.lastStepTime >= state.stepMs) {
    state.lastStepTime = now;
    step();
  }
  draw();
  state.rafId = requestAnimationFrame(loop);
}

function step() {
  // Aplicar dirección pendiente
  if (state.pendingDir) {
    state.dir = state.pendingDir;
    state.pendingDir = null;
  }

  const head = state.snake[0];
  const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };

  // Colisión con bordes
  if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
    return endGame();
  }
  // Colisión con el cuerpo (la cola se mueve, así que la última celda es válida
  // salvo que comamos; comprobamos contra todo el cuerpo excepto la cola)
  for (let i = 0; i < state.snake.length - 1; i++) {
    if (state.snake[i].x === newHead.x && state.snake[i].y === newHead.y) {
      return endGame();
    }
  }

  state.snake.unshift(newHead);

  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    // Comer
    state.score += POINTS_PER_FOOD;
    state.foodCount++;
    state.stepMs = Math.max(MIN_STEP_MS, START_STEP_MS - getSpeedLevel() * STEP_DECREMENT);
    spawnFood();
    updateHUD();
  } else {
    state.snake.pop(); // avanzar sin crecer
  }
}

// ── Render ──────────────────────────────────────────────────────────────--
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw() {
  const W = cell * COLS;
  const H = cell * ROWS;

  // Fondo
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, W, H);

  // Grid sutil
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, H); ctx.stroke();
  }
  for (let j = 1; j < ROWS; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * cell); ctx.lineTo(W, j * cell); ctx.stroke();
  }

  // Comida
  const f = state.food;
  ctx.fillStyle = '#f43f5e';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 12;
  roundRect(f.x * cell + cell * 0.15, f.y * cell + cell * 0.15, cell * 0.7, cell * 0.7, cell * 0.2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Serpiente
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const s = state.snake[i];
    const isHead = i === 0;
    ctx.fillStyle = isHead ? '#86efac' : '#22c55e';
    if (isHead) { ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14; }
    const pad = cell * 0.08;
    roundRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.25);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── HUD ─────────────────────────────────────────────────────────────────--
function updateHUD() {
  scoreDisplay.textContent = state.score;
  bestDisplay.textContent = state.best;
  speedDisplay.textContent = getSpeedLevel();
}

// ── Init y control ──────────────────────────────────────────────────────--
function resetState() {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  state.snake = [
    { x: cx,     y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy }
  ];
  state.dir = { x: 1, y: 0 };
  state.pendingDir = null;
  state.score = 0;
  state.foodCount = 0;
  state.stepMs = START_STEP_MS;
  state.scoreSubmitted = false;
  state.lastStepTime = 0;
  spawnFood();
  updateHUD();
}

/** Muestra cuenta regresiva y luego arranca el loop */
function startWithCountdown() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  resetState();
  startScreen.classList.remove('active');
  gameoverScreen.classList.remove('active');
  draw();

  let count = 3;
  countdownNum.textContent = count;
  countdownOverlay.classList.add('active');
  countdownNum.style.animation = 'none';
  requestAnimationFrame(() => { countdownNum.style.animation = ''; });

  state.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNum.textContent = count;
      countdownNum.style.animation = 'none';
      requestAnimationFrame(() => { countdownNum.style.animation = ''; });
    } else {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      countdownOverlay.classList.remove('active');
      state.running = true;
      state.lastStepTime = performance.now();
      state.rafId = requestAnimationFrame(loop);
    }
  }, 700);
}

function endGame() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('snake-best', String(state.best));
  }
  updateHUD();

  finalScore.textContent = state.score;
  finalLength.textContent = state.snake.length;

  const savedName = localStorage.getItem('snake-name');
  playerNameInput.value = savedName || '';

  const submitBtn = document.getElementById('btn-submit-score');
  submitBtn.textContent = '💾 GUARDAR PUNTUACIÓN';
  submitBtn.disabled = false;

  gameoverScreen.classList.add('active');
  if (savedName) playerNameInput.select();
}

// ── Botones UI ────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startWithCountdown);

document.getElementById('btn-play-again').addEventListener('click', () => {
  gameoverScreen.classList.remove('active');
  startWithCountdown();
});

document.getElementById('btn-submit-score').addEventListener('click', async () => {
  if (state.scoreSubmitted) return;
  const name = playerNameInput.value.trim() || 'Anónimo';
  const btn = document.getElementById('btn-submit-score');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    await saveScore(name, state.score);
    localStorage.setItem('snake-name', name);
    state.scoreSubmitted = true;
    btn.textContent = '✅ Guardado!';
    loadLeaderboard();
  } catch (err) {
    console.error('Error guardando score:', err);
    btn.textContent = '❌ Error - Reintenta';
    btn.disabled = false;
  }
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
  gameoverScreen.classList.remove('active');
  startScreen.classList.add('active');
  loadLeaderboard();
});

// ── Leaderboard ─────────────────────────────────────────────────────────--
function renderLeaderboard(rankings) {
  leaderboardList.innerHTML = '';
  if (!rankings || rankings.length === 0) {
    leaderboardList.innerHTML = '<li class="lb-loading">¡Sé el primero en jugar!</li>';
    return;
  }
  const rankSymbols = ['🥇','🥈','🥉'];
  const rankClasses = ['gold','silver','bronze'];
  rankings.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'lb-item';
    const rankContent = i < 3
      ? `<span class="lb-rank ${rankClasses[i]}">${rankSymbols[i]}</span>`
      : `<span class="lb-rank">#${i + 1}</span>`;
    li.innerHTML = `
      ${rankContent}
      <span class="lb-name">${escapeHtml(entry.nombreJugador || 'Anónimo')}</span>
      <span class="lb-score">${entry.puntuacion || 0}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function loadLeaderboard() {
  leaderboardList.innerHTML = '<li class="lb-loading">Cargando ranking...</li>';
  getTopTen((rankings, err) => {
    if (err) {
      leaderboardList.innerHTML = '<li class="lb-loading">Sin conexión Firebase</li>';
      return;
    }
    renderLeaderboard(rankings);
  });
}

// ── Arranque ──────────────────────────────────────────────────────────────
state.best = parseInt(localStorage.getItem('snake-best') || '0', 10) || 0;
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
updateHUD();
loadLeaderboard();
