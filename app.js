// ── Imports Firebase (firebase-config.js escrito por otro agente) ────────
import { saveScore, getTopTen } from './firebase-config.js';

// ── Lista de palabras (100+, ordenadas de cortas a largas) ───────────────
const WORD_LIST = [
  // 3 letras
  'cat','dog','run','fly','hit','bad','big','old','new','red',
  'hot','sky','sun','sea','map','cup','top','web','win','far',
  // 4 letras
  'jump','fire','wind','rain','cold','dark','fast','slow','bold','wave',
  'lock','ship','drop','star','ring','frog','drum','lamp','book','flow',
  // 5 letras
  'storm','flame','frost','sword','magic','ghost','chaos','power','light','night',
  'cloud','blade','water','earth','stone','snake','blast','crisp','prize','trace',
  // 6 letras
  'battle','castle','dragon','shadow','forest','planet','rocket','bridge','frozen','silver',
  'flying','strong','wonder','mighty','clever','shiver','broken','candle','mirror','charge',
  // 7 letras
  'thunder','crystal','phantom','warrior','kingdom','freedom','capture','blazing','network','silence',
  'ancient','balance','chapter','diamond','factory','forward','harvest','journey','lantern','monster',
  // 8+ letras
  'absolute','backbone','carnival','champion','database','emerging','fountain','guardian',
  'heritage','infinity','keyboard','labyrinth','memorial','navigate','operator','paradise',
  'quantity','remember','skeleton','strategy','treasure','ultimate','velocity','wireless'
];

// ── Constantes del juego ─────────────────────────────────────────────────
const BASE_SPEED = 0.6;          // px por frame (60fps ≈ 36px/s)
const SPAWN_BASE_MS = 2800;      // ms entre palabras nivel 1
const POINTS_PER_CHAR = 10;      // puntos base por carácter
const LEVEL_UP_SCORE = 500;      // puntos para subir de nivel
const FREEZE_DURATION = 5000;    // ms que dura el hielo
const MAX_WORDS_ON_SCREEN = 8;   // palabras máximas simultáneas
const LIVES_START = 3;

// ── Estado del juego ─────────────────────────────────────────────────────
const state = {
  score: 0,
  level: 1,
  lives: LIVES_START,
  isRunning: false,
  isFrozen: false,
  freezeTimer: null,
  words: [],            // [{ text, el, x, y, active, matched }]
  typedBuffer: '',
  matchedWordIndex: -1,
  spells: { fire: 3, ice: 3 },
  lastSpawnTime: 0,
  lastFrameTime: 0,
  animFrameId: null,
  nextLevelScore: LEVEL_UP_SCORE,
  scoreSubmitted: false
};

// ── Referencias DOM ──────────────────────────────────────────────────────
const gameArea      = document.getElementById('game-area');
const scoreDisplay  = document.getElementById('score-display');
const levelDisplay  = document.getElementById('level-display');
const livesDisplay  = document.getElementById('lives-display');
const bufferDisplay = document.getElementById('typed-buffer-display');
const fireCount     = document.getElementById('fire-count');
const iceCount      = document.getElementById('ice-count');
const startScreen   = document.getElementById('start-screen');
const gameoverScreen= document.getElementById('gameover-screen');
const finalScore    = document.getElementById('final-score');
const finalLevel    = document.getElementById('final-level');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');
const levelNotice   = document.getElementById('level-up-notice');
const spellNotice   = document.getElementById('spell-notice');

// ── Utilidades ───────────────────────────────────────────────────────────
function getGameAreaHeight() { return gameArea.getBoundingClientRect().height; }
function getGameAreaWidth()  { return gameArea.getBoundingClientRect().width; }

function getWordSpeed() {
  return BASE_SPEED + (state.level - 1) * 0.4;
}

function getSpawnInterval() {
  return Math.max(900, SPAWN_BASE_MS - (state.level - 1) * 220);
}

function getWordFontSize() {
  return Math.min(48, 18 + state.level * 3);
}

/** Filtra palabras por longitud según el nivel actual */
function getWordPool() {
  let minLen, maxLen;
  if (state.level <= 2)      { minLen = 3; maxLen = 4; }
  else if (state.level <= 4) { minLen = 4; maxLen = 6; }
  else if (state.level <= 6) { minLen = 5; maxLen = 7; }
  else                        { minLen = 6; maxLen = 20; }
  return WORD_LIST.filter(w => w.length >= minLen && w.length <= maxLen);
}

/** Elige una palabra aleatoria que no esté activa en pantalla */
function pickWord() {
  const pool = getWordPool();
  const active = new Set(state.words.map(w => w.text));
  const available = pool.filter(w => !active.has(w));
  if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return available[Math.floor(Math.random() * available.length)];
}

// ── Elementos de palabras ────────────────────────────────────────────────

/** Crea un elemento DOM para una palabra que cae */
function createWordElement(word, x, fontSize) {
  const el = document.createElement('div');
  el.className = 'word-card';
  el.innerHTML = `<span class="remaining-part">${word}</span>`;
  el.style.left = `${x}px`;
  el.style.top = '-60px';
  el.style.fontSize = `${fontSize}px`;
  gameArea.appendChild(el);
  return el;
}

/** Actualiza el resaltado de la palabra que coincide con el buffer */
function updateWordHighlight(wordObj) {
  const typed = state.typedBuffer;
  if (typed.length === 0) {
    wordObj.el.innerHTML = `<span class="remaining-part">${wordObj.text}</span>`;
    return;
  }
  const text = wordObj.text;
  const typedPart = text.substring(0, typed.length);
  const remainingPart = text.substring(typed.length);
  wordObj.el.innerHTML = `<span class="typed-part">${typedPart}</span><span class="remaining-part">${remainingPart}</span>`;
}

// ── Spawn de palabras ────────────────────────────────────────────────────

/** Lanza una nueva palabra en posición aleatoria horizontal */
function spawnWord(now) {
  if (!state.isRunning || state.words.length >= MAX_WORDS_ON_SCREEN) return;
  if (now - state.lastSpawnTime < getSpawnInterval()) return;
  state.lastSpawnTime = now;

  const word = pickWord();
  const fontSize = getWordFontSize();
  const maxX = Math.max(40, getGameAreaWidth() - word.length * fontSize * 0.6 - 40);
  const x = Math.floor(Math.random() * maxX) + 20;

  const el = createWordElement(word, x, fontSize);
  state.words.push({ text: word, el, x, y: -60, active: true, matched: false });
}

// ── Actualización de posición ────────────────────────────────────────────

/** Mueve todas las palabras hacia abajo un frame */
function updateWords() {
  if (state.isFrozen) return;
  const speed = getWordSpeed();
  const areaHeight = getGameAreaHeight();

  for (const wordObj of state.words) {
    if (!wordObj.active) continue;
    wordObj.y += speed;
    wordObj.el.style.top = `${wordObj.y}px`;

    // Marcar como peligrosa si está en 60% inferior
    if (wordObj.y > areaHeight * 0.6) {
      wordObj.el.classList.add('danger');
    } else {
      wordObj.el.classList.remove('danger');
    }
  }
}

// ── Verificación de Game Over ────────────────────────────────────────────

/** Elimina palabras que llegaron al fondo y descuenta vidas */
function checkGameOver() {
  const areaHeight = getGameAreaHeight();
  const toRemove = [];

  for (let i = 0; i < state.words.length; i++) {
    const wordObj = state.words[i];
    if (!wordObj.active) continue;
    if (wordObj.y > areaHeight) {
      toRemove.push(i);
      loseLife();
    }
  }

  // Eliminar en orden inverso para no desplazar índices
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    if (state.words[idx].el.parentNode) state.words[idx].el.remove();
    state.words.splice(idx, 1);
  }
}

function loseLife() {
  if (state.lives <= 0) return;
  state.lives--;
  updateHUD();
  if (state.lives === 0) endGame();
}

// ── Escritura y coincidencia ─────────────────────────────────────────────

/** Procesa una tecla alfanumérica: actualiza buffer y verifica coincidencias */
function handleTyping(key) {
  if (!state.isRunning) return;
  state.typedBuffer += key;
  updateBufferDisplay();
  findMatch();
}

/** Busca si el buffer coincide con el inicio de alguna palabra activa */
function findMatch() {
  const buf = state.typedBuffer;

  // Si ya teníamos un match previo, mantenerlo si sigue siendo válido
  if (state.matchedWordIndex >= 0 && state.matchedWordIndex < state.words.length) {
    const current = state.words[state.matchedWordIndex];
    if (current.active && current.text.startsWith(buf)) {
      updateWordHighlight(current);
      if (buf === current.text) {
        destroyWord(state.matchedWordIndex);
        return;
      }
      return; // seguimos con la misma palabra
    } else {
      // Perdimos la coincidencia con esa palabra — resetear
      current.el.classList.remove('matched');
      updateWordHighlight(current);
      state.matchedWordIndex = -1;
    }
  }

  // Buscar nueva coincidencia
  let bestIdx = -1;
  for (let i = 0; i < state.words.length; i++) {
    const w = state.words[i];
    if (!w.active) continue;
    if (w.text.startsWith(buf)) {
      // Priorizar la palabra más abajo (mayor y)
      if (bestIdx === -1 || w.y > state.words[bestIdx].y) bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    state.matchedWordIndex = bestIdx;
    const matched = state.words[bestIdx];
    matched.el.classList.add('matched');
    updateWordHighlight(matched);

    if (buf === matched.text) {
      destroyWord(bestIdx);
    }
  } else {
    // Ninguna coincidencia — si llevamos >2 chars sin match, limpiar buffer
    if (buf.length > 2) {
      clearBuffer();
    }
  }
}

/** Destruye la palabra en el índice dado y suma puntos */
function destroyWord(index) {
  const wordObj = state.words[index];
  if (!wordObj || !wordObj.active) return;

  wordObj.active = false;
  wordObj.matched = false;
  wordObj.el.classList.add('destroying');
  wordObj.el.classList.remove('matched');

  // Puntos según longitud de la palabra
  const len = wordObj.text.length;
  let pts;
  if (len <= 4) pts = 10 * state.level;
  else if (len <= 7) pts = 20 * state.level;
  else pts = 30 * state.level;

  addScore(pts);
  clearBuffer();

  // Remover del DOM tras la animación (300ms)
  setTimeout(() => {
    if (wordObj.el.parentNode) wordObj.el.remove();
    const idx = state.words.indexOf(wordObj);
    if (idx >= 0) state.words.splice(idx, 1);
  }, 320);

  state.matchedWordIndex = -1;
}

// ── Buffer ───────────────────────────────────────────────────────────────

function updateBufferDisplay() {
  bufferDisplay.textContent = state.typedBuffer || '';
}

function clearBuffer() {
  state.typedBuffer = '';
  state.matchedWordIndex = -1;
  updateBufferDisplay();
  // Quitar highlight de todas las palabras
  for (const w of state.words) {
    w.el.classList.remove('matched');
    if (w.active) {
      w.el.innerHTML = `<span class="remaining-part">${w.text}</span>`;
    }
  }
}

// ── Puntuación y nivel ───────────────────────────────────────────────────

function addScore(pts) {
  state.score += pts;
  updateHUD();
  checkLevelUp();
}

function checkLevelUp() {
  if (state.score >= state.nextLevelScore) {
    state.level++;
    state.nextLevelScore += LEVEL_UP_SCORE + (state.level - 1) * 200;
    showLevelUpNotice();
    updateHUD();
  }
}

function showLevelUpNotice() {
  levelNotice.textContent = `LEVEL ${state.level}!`;
  levelNotice.classList.remove('hidden');
  // Forzar re-trigger de la animación
  levelNotice.style.animation = 'none';
  requestAnimationFrame(() => {
    levelNotice.style.animation = '';
    setTimeout(() => levelNotice.classList.add('hidden'), 1500);
  });
}

// ── HUD ──────────────────────────────────────────────────────────────────

function updateHUD() {
  scoreDisplay.textContent = state.score;
  levelDisplay.textContent = state.level;
  livesDisplay.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, LIVES_START - state.lives));
  fireCount.textContent = `x${state.spells.fire}`;
  iceCount.textContent  = `x${state.spells.ice}`;

  // Spell buttons
  document.getElementById('spell-fire').classList.toggle('used', state.spells.fire <= 0);
  document.getElementById('spell-ice').classList.toggle('used', state.spells.ice <= 0);
}

// ── Hechizos ────────────────────────────────────────────────────────────

/** Activa el hechizo de Fuego: destruye todas las palabras en pantalla */
function activateFire() {
  if (!state.isRunning || state.spells.fire <= 0) return;
  state.spells.fire--;
  showSpellNotice('🔥 FUEGO ARCANO!', '#f97316');

  const toDestroy = [...state.words.filter(w => w.active)];
  for (const w of toDestroy) {
    w.active = false;
    w.el.classList.add('destroying');
    setTimeout(() => { if (w.el.parentNode) w.el.remove(); }, 320);
  }
  state.words = state.words.filter(w => !toDestroy.includes(w));
  addScore(300);
  clearBuffer();
  updateHUD();
}

/** Activa el hechizo de Hielo: congela las palabras 5 segundos */
function activateIce() {
  if (!state.isRunning || state.spells.ice <= 0) return;
  if (state.isFrozen) return; // ya está congelado
  state.spells.ice--;
  state.isFrozen = true;
  showSpellNotice('❄️ TIEMPO CONGELADO!', '#38bdf8');

  // Aplicar clase visual a todas las palabras
  for (const w of state.words) {
    if (w.active) w.el.classList.add('frozen');
  }

  // Limpiar timer anterior si existe
  if (state.freezeTimer) clearTimeout(state.freezeTimer);
  state.freezeTimer = setTimeout(() => {
    state.isFrozen = false;
    for (const w of state.words) w.el.classList.remove('frozen');
  }, FREEZE_DURATION);

  updateHUD();
}

function showSpellNotice(text, color) {
  spellNotice.textContent = text;
  spellNotice.style.color = color;
  spellNotice.style.textShadow = `0 0 20px ${color}`;
  spellNotice.classList.remove('hidden');
  spellNotice.style.animation = 'none';
  requestAnimationFrame(() => {
    spellNotice.style.animation = '';
    setTimeout(() => spellNotice.classList.add('hidden'), 1200);
  });
}

// ── Game Loop ────────────────────────────────────────────────────────────

/**
 * Game loop principal usando requestAnimationFrame.
 * Recibe el timestamp de alta resolución del browser.
 * - Calcula deltaTime para movimiento independiente del framerate
 * - Llama a spawn, update y checkGameOver en cada frame
 */
function gameLoop(timestamp) {
  if (!state.isRunning) return;

  // Calcular delta (no se usa para velocidad simple basada en frames,
  // pero se guarda para extensibilidad)
  state.lastFrameTime = timestamp;

  spawnWord(timestamp);
  updateWords();
  checkGameOver();

  if (state.isRunning) {
    state.animFrameId = requestAnimationFrame(gameLoop);
  }
}

// ── Init y control ───────────────────────────────────────────────────────

/** Inicializa o reinicia el juego desde cero */
function initGame() {
  // Detener loop anterior
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  if (state.freezeTimer) clearTimeout(state.freezeTimer);

  // Limpiar palabras del DOM
  for (const w of state.words) { if (w.el.parentNode) w.el.remove(); }

  // Resetear estado
  state.score = 0;
  state.level = 1;
  state.lives = LIVES_START;
  state.isRunning = true;
  state.isFrozen = false;
  state.freezeTimer = null;
  state.words = [];
  state.typedBuffer = '';
  state.matchedWordIndex = -1;
  state.spells = { fire: 3, ice: 3 };
  state.lastSpawnTime = 0;
  state.lastFrameTime = 0;
  state.nextLevelScore = LEVEL_UP_SCORE;
  state.scoreSubmitted = false;

  updateHUD();
  updateBufferDisplay();

  // Ocultar overlays
  startScreen.classList.remove('active');
  gameoverScreen.classList.remove('active');
  levelNotice.classList.add('hidden');
  spellNotice.classList.add('hidden');

  // Limpiar inputs del game over
  playerNameInput.value = '';

  // Iniciar loop
  state.animFrameId = requestAnimationFrame(gameLoop);
}

/** Termina la partida */
function endGame() {
  state.isRunning = false;
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);

  // Mostrar resultados
  finalScore.textContent = state.score;
  finalLevel.textContent = state.level;
  gameoverScreen.classList.add('active');
  playerNameInput.focus();
}

// ── Teclado ──────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // No capturar si el foco está en el input del nombre
  if (document.activeElement === playerNameInput) return;

  // Hechizos
  if (e.code === 'Digit1') { e.preventDefault(); activateFire(); return; }
  if (e.code === 'Digit2') { e.preventDefault(); activateIce(); return; }
  if (e.code === 'Space')  { e.preventDefault(); activateFire(); return; }

  // Borrar
  if (e.key === 'Backspace') {
    e.preventDefault();
    state.typedBuffer = state.typedBuffer.slice(0, -1);
    updateBufferDisplay();
    // Re-evaluar match con buffer reducido
    if (state.matchedWordIndex >= 0) {
      const w = state.words[state.matchedWordIndex];
      if (w && w.active) {
        if (!w.text.startsWith(state.typedBuffer)) {
          w.el.classList.remove('matched');
          w.el.innerHTML = `<span class="remaining-part">${w.text}</span>`;
          state.matchedWordIndex = -1;
        } else {
          updateWordHighlight(w);
        }
      }
    }
    return;
  }

  // Letras
  if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    handleTyping(e.key.toLowerCase());
  }
});

// ── Botones UI ───────────────────────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', initGame);

document.getElementById('btn-play-again').addEventListener('click', () => {
  gameoverScreen.classList.remove('active');
  initGame();
});

document.getElementById('btn-submit-score').addEventListener('click', async () => {
  if (state.scoreSubmitted) return;
  const name = playerNameInput.value.trim() || 'Anónimo';
  const btn = document.getElementById('btn-submit-score');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    await saveScore(name, state.score, state.level);
    state.scoreSubmitted = true;
    btn.textContent = '✅ Guardado!';
  } catch (err) {
    console.error('Error guardando score:', err);
    btn.textContent = '❌ Error - Reintenta';
    btn.disabled = false;
  }
});

// Clicks en botones de hechizos
document.getElementById('spell-fire').addEventListener('click', activateFire);
document.getElementById('spell-ice').addEventListener('click', activateIce);

// ── Leaderboard ──────────────────────────────────────────────────────────

/** Renderiza el top 10 en el leaderboard de la pantalla de inicio */
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
      <span class="lb-level">Lv${entry.nivelAlcanzado || 1}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Inicio: cargar leaderboard ───────────────────────────────────────────

getTopTen((rankings, err) => {
  if (err) {
    console.error('Error cargando ranking:', err);
    leaderboardList.innerHTML = '<li class="lb-loading">Sin conexión Firebase</li>';
    return;
  }
  renderLeaderboard(rankings);
});
