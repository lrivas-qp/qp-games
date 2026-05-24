// ── Imports Firebase (firebase-config.js escrito por otro agente) ────────
import { saveScore, getTopTen } from './firebase-config.js';

// ── Lista de palabras en español (sin tildes para facilitar tipeo) ────────
const WORD_LIST = [
  // 3 letras
  'sol','mar','paz','luz','rey','pan','sal','rio','mil','fin',
  'ser','ver','dar','gas','van','ley','don','son','hay','mal',
  // 4 letras
  'amor','vida','casa','luna','hora','cara','aire','beso','gato','pato',
  'roca','nube','flor','mesa','lobo','hoja','boca','mano','vino','lago',
  'rosa','rana','toro','nido','piel','copa','capa','dama','dedo','hilo',
  'mapa','ropa','saco','vaso','foto','pico','foca','vale','bala','pozo',
  // 5 letras
  'cielo','playa','campo','verde','amigo','mundo','brisa','calle','dulce','norte',
  'pluma','reina','rumbo','salto','tigre','turno','viaje','bruma','cobra','limon',
  'papel','perro','prado','vapor','villa','zorro','piano','circo','claro','coral',
  'corte','curva','fibra','forma','fruta','globo','guapo','gusto','hueso','humor',
  'juego','largo','lista','lucha','madre','manta','marca','miedo','mosca','tabla',
  'texto','trigo',
  // 6 letras
  'bosque','ciudad','fuerte','gloria','guerra','humano','juntos','ladron','marina','modelo',
  'olivar','paloma','pastor','pueblo','rancho','rapido','ritual','sangre','terror','tiempo',
  'tirano','torres','vecino','violin','visita','zapato','bronce','camino','centro','cocina',
  'colina','corona','cuarto','doctor','escoba','escudo','espejo','fuente','garras','granja',
  'jardin','letras','llaves','mejora','moneda','motivo',
  // 7 letras
  'brillar','captura','cristal','destino','espacio','estudio','familia','gigante','impacto','jornada',
  'mensaje','milagro','montana','noventa','pantano','platano','pobreza','primero','proceso','sagrado',
  'sendero','sistema','termino','trabajo','treinta','tributo','triunfo','urgente','ventana','verdura',
  'villano',
  // 8+ letras
  'absoluto','academia','acuarela','aventura','ballesta','capitulo','catalogo','contrato',
  'corredor','cubierta','descuido','edificio','elemento','fantasia','generoso','gobierno',
  'grandeza','imaginar','interior','mariscal','negociar','novedoso','objetivo','operador',
  'paradoja','posicion','precioso','receptor','relacion','renovado','respaldo','sencillo',
  'sinfonia','sociedad','solucion','sorpresa','sustento','tribunal','universo','variable','voluntad'
];

// ── Constantes del juego ─────────────────────────────────────────────────
const BASE_SPEED = 0.3;
const SPAWN_BASE_MS = 1000;
const POINTS_PER_CHAR = 10;
const WORDS_BASE = 10;          // palabras para completar nivel 1
const WORDS_PER_LEVEL = 3;      // palabras extra por cada nivel adicional
const FREEZE_DURATION = 5000;
const SLOW_DURATION = 6000;     // ms que dura el slow
const MAX_WORDS_ON_SCREEN = 10;
const LIVES_START = 3;

// ── Power-ups (palabras especiales de colores) ────────────────────────────
const POWERUP_TYPES = {
  fire:  { words: ['fuego','brasa','llama'],  color: '#f97316', label: '🔥 ¡FUEGO ARCANO!',    effect: () => applyFire()  },
  ice:   { words: ['hielo','nieve','polar'],  color: '#38bdf8', label: '❄️ ¡TIEMPO CONGELADO!', effect: () => applyIce()   },
  slow:  { words: ['pausa','lento','calma'],  color: '#fbbf24', label: '⏳ ¡CÁMARA LENTA!',     effect: () => applySlow()  },
  heal:  { words: ['salud','curar','sana'],   color: '#4ade80', label: '💚 ¡VIDA RECUPERADA!',  effect: () => applyHeal()  },
  bonus: { words: ['extra','bono','plus'],    color: '#e879f9', label: '⭐ ¡PUNTOS EXTRA!',     effect: () => applyBonus() },
};

// ── Estado del juego ─────────────────────────────────────────────────────
const state = {
  score: 0,
  level: 1,
  lives: LIVES_START,
  isRunning: false,
  isFrozen: false,
  isSlowed: false,
  freezeTimer: null,
  slowTimer: null,
  words: [],
  typedBuffer: '',
  matchedWordIndex: -1,
  wordsTyped: 0,
  lastSpawnTime: 0,
  lastFrameTime: 0,
  animFrameId: null,
  levelUpTimer: null,
  scoreSubmitted: false
};

// ── Referencias DOM ──────────────────────────────────────────────────────
const gameArea      = document.getElementById('game-area');
const scoreDisplay  = document.getElementById('score-display');
const levelDisplay  = document.getElementById('level-display');
const livesDisplay  = document.getElementById('lives-display');
const bufferDisplay = document.getElementById('typed-buffer-display');
const startScreen   = document.getElementById('start-screen');
const gameoverScreen= document.getElementById('gameover-screen');
const finalScore    = document.getElementById('final-score');
const finalLevel    = document.getElementById('final-level');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');
const spellNotice   = document.getElementById('spell-notice');

// ── Utilidades ───────────────────────────────────────────────────────────
function getGameAreaHeight() { return gameArea.getBoundingClientRect().height; }
function getGameAreaWidth()  { return gameArea.getBoundingClientRect().width; }

function getWordSpeed() {
  const base = BASE_SPEED + (state.level - 1) * 0.2;
  return state.isSlowed ? base * 0.4 : base;
}

function getSpawnInterval() {
  // Nivel 1: 1000ms (1 palabra/seg → pantalla se llena de a poco)
  // Nivel 6: 600ms (límite mínimo — lluvia constante)
  return Math.max(600, SPAWN_BASE_MS - (state.level - 1) * 80);
}

function getWordFontSize() {
  // Nivel 1: 20px (pequeño, caben más palabras)
  // Nivel 10: 36px (más grande y amenazante)
  return Math.min(36, 20 + (state.level - 1) * 2);
}

/** Filtra palabras por longitud según el nivel actual */
function getWordPool() {
  let minLen, maxLen;
  if (state.level === 1)      { minLen = 3; maxLen = 3; } // solo 3 letras, pantalla llena y fácil
  else if (state.level === 2) { minLen = 3; maxLen = 4; }
  else if (state.level <= 4)  { minLen = 3; maxLen = 5; }
  else if (state.level <= 6)  { minLen = 4; maxLen = 6; }
  else if (state.level <= 8)  { minLen = 5; maxLen = 7; }
  else                         { minLen = 6; maxLen = 20; }
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
function createWordElement(word, x, fontSize, type = 'normal') {
  const el = document.createElement('div');
  el.className = 'word-card';
  if (type !== 'normal') el.classList.add(`powerup-${type}`);
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

  // 15% de probabilidad de power-up, máx 1 por tipo en pantalla
  let wordText, wordType = 'normal';
  if (Math.random() < 0.15) {
    const activeTypes = new Set(state.words.filter(w => w.type !== 'normal').map(w => w.type));
    const available = Object.keys(POWERUP_TYPES).filter(t => !activeTypes.has(t));
    if (available.length > 0) {
      wordType = available[Math.floor(Math.random() * available.length)];
      const pool = POWERUP_TYPES[wordType].words;
      wordText = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  if (wordType === 'normal') wordText = pickWord();

  const fontSize = getWordFontSize();
  const maxX = Math.max(40, getGameAreaWidth() - wordText.length * fontSize * 0.6 - 40);
  const x = Math.floor(Math.random() * maxX) + 20;

  const el = createWordElement(wordText, x, fontSize, wordType);
  state.words.push({ text: wordText, el, x, y: -60, active: true, matched: false, type: wordType });
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
      if (wordObj.type === 'normal') loseLife(); // solo palabras normales cuestan vida
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

/** Destruye la palabra en el índice dado y aplica efecto */
function destroyWord(index) {
  const wordObj = state.words[index];
  if (!wordObj || !wordObj.active) return;

  wordObj.active = false;
  wordObj.matched = false;
  wordObj.el.classList.add('destroying');
  wordObj.el.classList.remove('matched');

  if (wordObj.type && wordObj.type !== 'normal') {
    // Activar power-up
    const pu = POWERUP_TYPES[wordObj.type];
    showSpellNotice(pu.label, pu.color);
    pu.effect();
  } else {
    // Puntuación normal
    const len = wordObj.text.length;
    let pts;
    if (len <= 4)      pts = 10 * state.level;
    else if (len <= 7) pts = 20 * state.level;
    else               pts = 30 * state.level;
    addScore(pts);
    state.wordsTyped++;
    updateProgressBar();
    checkLevelUp();
  }

  clearBuffer();

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
}

/** Verifica si se completaron las palabras necesarias para el nivel actual */
function checkLevelUp() {
  const needed = WORDS_BASE + (state.level - 1) * WORDS_PER_LEVEL;
  if (state.wordsTyped >= needed) {
    state.level++;
    state.wordsTyped = 0;
    showLevelUpScreen();
    updateHUD();
  }
}

/** Actualiza la barra de progreso basada en palabras tipeadas */
function updateProgressBar() {
  const needed = WORDS_BASE + (state.level - 1) * WORDS_PER_LEVEL;
  const pct = Math.min(100, (state.wordsTyped / needed) * 100);
  document.getElementById('level-progress-fill').style.width = `${pct}%`;
}

function showLevelUpScreen() {
  state.isRunning = false;
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);

  // Nuke todas las word-cards del DOM (captura también las que están en animación .destroying)
  gameArea.querySelectorAll('.word-card').forEach(el => el.remove());
  state.words = [];
  state.matchedWordIndex = -1;
  clearBuffer();

  const overlay = document.getElementById('levelup-overlay');
  const levelEl = document.getElementById('levelup-level-num');
  const countEl = document.getElementById('levelup-countdown');

  levelEl.textContent = state.level;
  countEl.textContent = '3';

  // Re-trigger la animación del número
  levelEl.style.animation = 'none';
  requestAnimationFrame(() => { levelEl.style.animation = ''; });

  overlay.classList.add('active');

  let count = 3;
  state.levelUpTimer = setInterval(() => {
    count--;
    if (count > 0) {
      countEl.textContent = String(count);
    } else {
      clearInterval(state.levelUpTimer);
      state.levelUpTimer = null;
      overlay.classList.remove('active');
      document.getElementById('level-progress-fill').style.width = '0%';
      state.isRunning = true;
      state.animFrameId = requestAnimationFrame(gameLoop);
    }
  }, 1000);
}

// ── HUD ──────────────────────────────────────────────────────────────────

function updateHUD() {
  scoreDisplay.textContent = state.score;
  levelDisplay.textContent = state.level;
  livesDisplay.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, LIVES_START - state.lives));
  updateProgressBar();
}

// ── Efectos de Power-ups ─────────────────────────────────────────────────

function applyFire() {
  const toDestroy = [...state.words.filter(w => w.active && w.type === 'normal')];
  if (toDestroy.length === 0) return;
  let totalPts = 0;
  for (const w of toDestroy) {
    w.active = false;
    w.el.classList.add('destroying');
    const len = w.text.length;
    if (len <= 4) totalPts += 10 * state.level;
    else if (len <= 7) totalPts += 20 * state.level;
    else totalPts += 30 * state.level;
    setTimeout(() => { if (w.el.parentNode) w.el.remove(); }, 320);
  }
  state.words = state.words.filter(w => !toDestroy.includes(w));
  // Reiniciar reloj de spawn para evitar avalancha de palabras tras la limpieza
  state.lastSpawnTime = state.lastFrameTime + 1500;
  addScore(totalPts);
  // Actualizar texto de la notificación con los puntos ganados
  const notice = document.getElementById('spell-notice');
  if (notice) notice.textContent = `🔥 ¡FUEGO ARCANO! +${totalPts} pts`;
  updateHUD();
}

function applyIce() {
  if (state.isFrozen) return;
  state.isFrozen = true;
  for (const w of state.words) { if (w.active) w.el.classList.add('frozen'); }
  if (state.freezeTimer) clearTimeout(state.freezeTimer);
  state.freezeTimer = setTimeout(() => {
    state.isFrozen = false;
    for (const w of state.words) w.el.classList.remove('frozen');
  }, FREEZE_DURATION);
}

function applySlow() {
  state.isSlowed = true;
  if (state.slowTimer) clearTimeout(state.slowTimer);
  state.slowTimer = setTimeout(() => { state.isSlowed = false; }, SLOW_DURATION);
}

function applyHeal() {
  state.lives = Math.min(LIVES_START + 2, state.lives + 1);
  updateHUD();
}

function applyBonus() {
  addScore(50 * state.level);
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
 */
function gameLoop(timestamp) {
  if (!state.isRunning) return;
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
  // Detener loop anterior y timers pendientes
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  if (state.freezeTimer) { clearTimeout(state.freezeTimer); state.freezeTimer = null; }
  if (state.slowTimer) { clearTimeout(state.slowTimer); state.slowTimer = null; }
  if (state.levelUpTimer) { clearInterval(state.levelUpTimer); state.levelUpTimer = null; }

  // Limpiar palabras del DOM
  for (const w of state.words) { if (w.el.parentNode) w.el.remove(); }

  // Resetear estado
  state.score = 0;
  state.level = 1;
  state.lives = LIVES_START;
  state.isRunning = true;
  state.isFrozen = false;
  state.isSlowed = false;
  state.freezeTimer = null;
  state.slowTimer = null;
  state.words = [];
  state.typedBuffer = '';
  state.matchedWordIndex = -1;
  state.wordsTyped = 0;
  state.lastSpawnTime = 0;
  state.lastFrameTime = 0;
  state.levelUpTimer = null;
  state.scoreSubmitted = false;

  updateHUD();
  updateProgressBar();
  updateBufferDisplay();

  // Ocultar overlays
  startScreen.classList.remove('active');
  gameoverScreen.classList.remove('active');
  document.getElementById('levelup-overlay').classList.remove('active');
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
  if (document.activeElement === playerNameInput) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    state.typedBuffer = state.typedBuffer.slice(0, -1);
    updateBufferDisplay();
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
    leaderboardList.innerHTML = '<li class="lb-loading">Sin conexión Firebase</li>';
    return;
  }
  renderLeaderboard(rankings);
});
