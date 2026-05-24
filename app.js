import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getDatabase, ref, set, get, update, push, onValue, off,
  serverTimestamp, runTransaction, remove, onDisconnect
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  'Nombre', 'Apellido', 'Animal', 'Ciudad', 'País',
  'Comida', 'Color', 'Marca', 'Cosa/Objeto', 'Profesión',
  'Película/Serie', 'Deporte'
];

const DEFAULT_LETTERS = ['A','B','C','D','E','F','G','H','I','J','L','M','N','O','P','R','S','T','U','V'];

// ─────────────────────────────────────────────
// ESTADO LOCAL
// ─────────────────────────────────────────────
const local = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  db: null,
  roomRef: null,
  roomListener: null,
  countdownInterval: null,
  roundTimerInterval: null,
  validationTimerInterval: null,
  currentRoom: null,
  answerDebounceTimers: {},
  lastRenderedPhase: null,
  lastValidationCategoryIndex: -1,
  stopTransitionScheduled: false
};

// ─────────────────────────────────────────────
// INICIALIZACIÓN DE FIREBASE
// ─────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
local.db = db;

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('hidden', !show);
}

function showHomeError(msg) {
  const el = document.getElementById('home-error');
  if (el) { el.textContent = msg; el.classList.toggle('hidden', !msg); }
}

function showInviteHint(code) {
  const el_hint = el('home-invite-hint');
  if (el_hint) { el_hint.textContent = `Uniéndote a sala ${code}`; el_hint.style.display = 'block'; }
}

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  const digits = String(Math.floor(10 + Math.random() * 90));
  return code + digits;
}

function getOrCreatePlayerId() {
  let id = sessionStorage.getItem('stop_player_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('stop_player_id', id);
  }
  return id;
}

function clearTimers() {
  if (local.countdownInterval) { clearInterval(local.countdownInterval); local.countdownInterval = null; }
  if (local.roundTimerInterval) { clearInterval(local.roundTimerInterval); local.roundTimerInterval = null; }
  if (local.validationTimerInterval) { clearInterval(local.validationTimerInterval); local.validationTimerInterval = null; }
}

function detachRoomListener() {
  if (local.roomRef && local.roomListener) {
    off(local.roomRef, 'value', local.roomListener);
    local.roomListener = null;
  }
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function el(id) { return document.getElementById(id); }

// ─────────────────────────────────────────────
// CREAR SALA
// ─────────────────────────────────────────────
async function createRoom() {
  const nameInput = el('input-player-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) { showHomeError('Ingresa tu nombre'); return; }
  localStorage.setItem('stop_player_name', name);

  showLoading(true);
  showHomeError('');

  local.playerId = getOrCreatePlayerId();
  local.playerName = name;
  local.isHost = true;

  const roomCode = generateRoomCode();
  local.roomCode = roomCode;

  const now = Date.now();
  const roomData = {
    createdAt: now,
    expiresAt: now + 4 * 60 * 60 * 1000,
    config: {
      categories: DEFAULT_CATEGORIES,
      availableLetters: DEFAULT_LETTERS,
      totalRounds: 3,
      roundDuration: 90,
      validationDuration: 10
    },
    state: {
      phase: 'lobby',
      currentRound: 0,
      currentLetter: null,
      roundStartedAt: null,
      stoppedBy: null,
      stoppedByName: null,
      stoppedAt: null,
      validationCategoryIndex: 0,
      validationStartedAt: null,
      usedLetters: []
    },
    players: {
      [local.playerId]: {
        name: local.playerName,
        isHost: true,
        connected: true,
        totalScore: 0,
        joinedAt: Date.now()
      }
    }
  };

  try {
    const roomRef = ref(db, `rooms/${roomCode}`);
    await set(roomRef, roomData);
    setupOnDisconnect(roomCode, local.playerId);
    attachRoomListener(roomCode);
    showLoading(false);
    showScreen('screen-lobby');
  } catch (err) {
    showLoading(false);
    showHomeError('Error al crear la sala. Intenta de nuevo.');
    console.error(err);
  }
}

// ─────────────────────────────────────────────
// UNIRSE A SALA
// ─────────────────────────────────────────────
async function joinRoom() {
  const nameInput = el('input-player-name');
  const codeInput = el('input-room-code');
  const name = nameInput ? nameInput.value.trim() : '';
  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

  if (!name) { showHomeError('Ingresa tu nombre'); return; }
  if (!code) { showHomeError('Ingresa el código de la sala'); return; }
  localStorage.setItem('stop_player_name', name);

  showLoading(true);
  showHomeError('');

  local.playerId = getOrCreatePlayerId();
  local.playerName = name;
  local.isHost = false;
  local.roomCode = code;

  try {
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      showLoading(false);
      showHomeError('Sala no encontrada');
      return;
    }

    const room = snapshot.val();
    if (room.expiresAt && Date.now() > room.expiresAt) {
      showLoading(false);
      showHomeError('Esta sala ha expirado');
      return;
    }
    const phase = room.state && room.state.phase;
    if (phase && phase !== 'lobby') {
      showLoading(false);
      showHomeError('La partida ya ha comenzado');
      return;
    }

    const players = room.players || {};
    const playerCount = Object.keys(players).length;
    if (playerCount >= 20) {
      showLoading(false);
      showHomeError('La sala está llena (máximo 20 jugadores)');
      return;
    }

    const playerRef = ref(db, `rooms/${code}/players/${local.playerId}`);
    await set(playerRef, {
      name: local.playerName,
      isHost: false,
      connected: true,
      totalScore: 0,
      joinedAt: Date.now()
    });

    setupOnDisconnect(code, local.playerId);
    attachRoomListener(code);
    showLoading(false);
    showScreen('screen-lobby');
  } catch (err) {
    showLoading(false);
    showHomeError('Error al unirse a la sala. Intenta de nuevo.');
    console.error(err);
  }
}

// ─────────────────────────────────────────────
// ON DISCONNECT
// ─────────────────────────────────────────────
function setupOnDisconnect(roomCode, playerId) {
  const connRef = ref(db, `rooms/${roomCode}/players/${playerId}/connected`);
  onDisconnect(connRef).set(false);
}

// ─────────────────────────────────────────────
// LISTENER PRINCIPAL DE LA SALA
// ─────────────────────────────────────────────
function attachRoomListener(roomCode) {
  detachRoomListener();
  local.roomRef = ref(db, `rooms/${roomCode}`);
  local.roomListener = onValue(local.roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      clearTimers();
      showScreen('screen-home');
      return;
    }
    const room = snapshot.val();
    local.currentRoom = room;
    handleRoomUpdate(room);
  });
}

// ─────────────────────────────────────────────
// MANEJO CENTRAL DE ACTUALIZACIONES DE SALA
// ─────────────────────────────────────────────
function handleRoomUpdate(room) {
  if (room.expiresAt && Date.now() > room.expiresAt) {
    clearTimers();
    detachRoomListener();
    if (local.isHost) remove(ref(db, `rooms/${local.roomCode}`)).catch(console.error);
    showScreen('screen-home');
    showHomeError('La sala expiró (límite de 4 horas)');
    return;
  }

  const phase = room.state && room.state.phase ? room.state.phase : 'lobby';

  // Detectar si el host actual se desconectó y reasignar host
  handleHostReassignment(room);

  switch (phase) {
    case 'lobby':
      clearTimers();
      renderLobby(room);
      if (local.lastRenderedPhase !== 'lobby') showScreen('screen-lobby');
      break;
    case 'countdown':
      if (local.lastRenderedPhase !== 'countdown') {
        clearTimers();
        showScreen('screen-countdown');
        renderCountdown(room);
      }
      break;
    case 'playing':
      if (local.lastRenderedPhase !== 'playing') {
        clearTimers();
        showScreen('screen-playing');
        renderPlaying(room);
        startRoundTimer(room.state.roundStartedAt, room.config.roundDuration, room);
      } else {
        renderPlayingPartial(room);
      }
      break;
    case 'validating': {
      const catChanged = local.lastRenderedPhase !== 'validating' ||
                         room.state.validationCategoryIndex !== local.lastValidationCategoryIndex;
      if (catChanged) {
        clearTimers();
        showScreen('screen-validating');
        local.lastValidationCategoryIndex = room.state.validationCategoryIndex;
        const valDuration = room.state.validationDuration || room.config.validationDuration || 10;
        startValidationTimer(room.state.validationStartedAt, valDuration, room);
      }
      renderValidating(room); // siempre re-renderizar para reflejar cambios de votos
      break;
    }
    case 'round-scores': {
      clearTimers();
      const isFirstRoundScoresRender = local.lastRenderedPhase !== 'round-scores';
      if (isFirstRoundScoresRender) {
        showScreen('screen-round-scores');
        renderRoundScores(room);
      } else {
        // Re-render si el ranking no muestra a todos los jugadores (race condition de Firebase)
        const scoresList = el('round-scores-list');
        const expectedCount = Object.keys(room.players || {}).length;
        if (scoresList && scoresList.children.length !== expectedCount) {
          renderRoundScores(room);
        }
      }
      break;
    }
    case 'final-scores':
      clearTimers();
      if (local.lastRenderedPhase !== 'final-scores') {
        showScreen('screen-final-scores');
      }
      renderFinalScores(room);
      break;
    default:
      break;
  }

  local.lastRenderedPhase = phase;
}

// ─────────────────────────────────────────────
// REASIGNACIÓN DE HOST
// ─────────────────────────────────────────────
function handleHostReassignment(room) {
  if (!room.players) return;
  const players = room.players;
  const hostPlayer = Object.entries(players).find(([, p]) => p.isHost && p.connected);
  if (hostPlayer) return; // hay host conectado, nada que hacer

  // No hay host conectado: el jugador con joinedAt más temprano toma el host
  const connected = Object.entries(players).filter(([, p]) => p.connected);
  if (connected.length === 0) return;

  connected.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const newHostId = connected[0][0];

  if (newHostId === local.playerId && !local.isHost) {
    local.isHost = true;
    const updates = {};
    // Quitar host a todos
    Object.keys(players).forEach(pid => { updates[`players/${pid}/isHost`] = false; });
    // Asignar a nuevo host
    updates[`players/${newHostId}/isHost`] = true;
    update(ref(db, `rooms/${local.roomCode}`), updates).catch(console.error);
  }
}

// ─────────────────────────────────────────────
// LOBBY
// ─────────────────────────────────────────────
function renderLobby(room) {
  const players = room.players || {};
  const playerList = Object.entries(players);
  const connectedPlayers = playerList.filter(([, p]) => p.connected);

  // Detectar si yo soy host actualizado
  if (players[local.playerId]) {
    local.isHost = players[local.playerId].isHost === true;
  }

  // Código de sala
  const codeEl = el('lobby-room-code');
  if (codeEl) codeEl.textContent = local.roomCode;

  // Contador de jugadores
  const countEl = el('lobby-player-count');
  if (countEl) countEl.textContent = `${connectedPlayers.length}/20 jugadores`;

  // Lista de jugadores
  const listEl = el('lobby-players-list');
  if (listEl) {
    listEl.innerHTML = '';
    playerList
      .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
      .forEach(([pid, p]) => {
        const li = document.createElement('li');
        li.className = `player-item${p.connected ? '' : ' disconnected'}`;
        const isMe = pid === local.playerId;
        const hostBadge = p.isHost ? ' <span class="host-badge">(Host)</span>' : '';
        const meBadge = isMe ? ' <span class="me-badge">(Tú)</span>' : '';
        li.innerHTML = `<span class="player-name">${escapeHtml(p.name)}${hostBadge}${meBadge}</span>`;
        listEl.appendChild(li);
      });
  }

  // Config section visible solo para host
  const configSection = el('config-section');
  if (configSection) configSection.classList.toggle('hidden', !local.isHost);

  // Renderizar configuración
  renderLobbyConfig(room);

  // Botón iniciar solo para host
  const btnStart = el('btn-start-game');
  const startHint = el('lobby-start-hint');
  const needMorePlayers = connectedPlayers.length < 2;
  if (btnStart) {
    btnStart.classList.toggle('hidden', !local.isHost);
    btnStart.disabled = needMorePlayers;
  }
  if (startHint) {
    startHint.classList.toggle('hidden', !local.isHost || !needMorePlayers);
  }

  // Mensaje de estado para no-host
  const statusMsg = el('lobby-status-msg');
  if (statusMsg) {
    statusMsg.textContent = local.isHost ? '' : 'Esperando que el host inicie la partida...';
    statusMsg.style.display = local.isHost ? 'none' : 'block';
  }
}

function renderLobbyConfig(room) {
  const config = room.config || {};
  const categories = config.categories || DEFAULT_CATEGORIES;
  const availableLetters = config.availableLetters || DEFAULT_LETTERS;

  // Categorías
  const catList = el('config-categories-list');
  if (catList) {
    // Solo re-renderizar si está vacío o si es host
    if (catList.children.length === 0 || local.isHost) {
      catList.innerHTML = '';
      DEFAULT_CATEGORIES.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'category-checkbox-label';
        const checked = categories.includes(cat);
        const disabled = local.isHost ? '' : 'disabled';
        label.innerHTML = `<input type="checkbox" class="config-category-cb" value="${escapeHtml(cat)}" ${checked ? 'checked' : ''} ${disabled}> ${escapeHtml(cat)}`;
        catList.appendChild(label);
      });

      if (local.isHost) {
        catList.querySelectorAll('.config-category-cb').forEach(cb => {
          cb.addEventListener('change', () => updateLobbyConfig(room));
        });
      }
    }
  }

  // Rondas
  const roundsEl = el('config-rounds');
  if (roundsEl) {
    if (!roundsEl._listenerAdded) {
      roundsEl.value = config.totalRounds || 3;
      if (local.isHost) {
        roundsEl.addEventListener('change', () => updateLobbyConfig(room));
        roundsEl._listenerAdded = true;
      } else {
        roundsEl.disabled = true;
      }
    } else {
      roundsEl.value = config.totalRounds || 3;
    }
  }

  // Duración
  const durationEl = el('config-duration');
  if (durationEl) {
    if (!durationEl._listenerAdded) {
      durationEl.value = config.roundDuration || 90;
      if (local.isHost) {
        durationEl.addEventListener('change', () => updateLobbyConfig(room));
        durationEl._listenerAdded = true;
      } else {
        durationEl.disabled = true;
      }
    } else {
      durationEl.value = config.roundDuration || 90;
    }
  }

  // Letras
  const lettersEl = el('config-letters-list');
  if (lettersEl) {
    if (lettersEl.children.length === 0 || local.isHost) {
      lettersEl.innerHTML = '';
      DEFAULT_LETTERS.forEach(letter => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-letter-toggle${availableLetters.includes(letter) ? ' active' : ''}`;
        btn.textContent = letter;
        btn.dataset.letter = letter;
        if (!local.isHost) btn.disabled = true;
        if (local.isHost) {
          btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            updateLobbyConfig(room);
          });
        }
        lettersEl.appendChild(btn);
      });
    } else {
      // Actualizar estado activo sin re-renderizar
      lettersEl.querySelectorAll('.btn-letter-toggle').forEach(btn => {
        const letter = btn.dataset.letter;
        btn.classList.toggle('active', availableLetters.includes(letter));
      });
    }
  }
}

function updateLobbyConfig(room) {
  if (!local.isHost) return;

  const selectedCategories = [];
  document.querySelectorAll('.config-category-cb:checked').forEach(cb => {
    selectedCategories.push(cb.value);
  });
  if (selectedCategories.length === 0) {
    // Requiere al menos 1 categoría
    return;
  }

  const selectedLetters = [];
  document.querySelectorAll('.btn-letter-toggle.active').forEach(btn => {
    selectedLetters.push(btn.dataset.letter);
  });
  if (selectedLetters.length === 0) return;

  const roundsEl = el('config-rounds');
  const durationEl = el('config-duration');
  const totalRounds = roundsEl ? parseInt(roundsEl.value) || 3 : 3;
  const roundDuration = durationEl ? parseInt(durationEl.value) || 90 : 90;

  update(ref(db, `rooms/${local.roomCode}/config`), {
    categories: selectedCategories,
    availableLetters: selectedLetters,
    totalRounds: Math.min(Math.max(1, totalRounds), 10),
    roundDuration: Math.min(Math.max(30, roundDuration), 300)
  }).catch(console.error);
}

// ─────────────────────────────────────────────
// COPIAR CÓDIGO DE SALA
// ─────────────────────────────────────────────
function setupCopyBtn() {
  const btn = el('lobby-copy-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(local.roomCode).then(() => {
      btn.textContent = '¡Copiado!';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = local.roomCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    });
  });

  const btnShareLink = el('lobby-share-link-btn');
  if (btnShareLink) {
    btnShareLink.addEventListener('click', () => {
      const url = `${window.location.origin}${window.location.pathname}?room=${local.roomCode}`;
      navigator.clipboard.writeText(url).then(() => {
        btnShareLink.textContent = '¡Enlace copiado!';
        setTimeout(() => { btnShareLink.textContent = 'Compartir enlace'; }, 2000);
      }).catch(() => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        btnShareLink.textContent = '¡Enlace copiado!';
        setTimeout(() => { btnShareLink.textContent = 'Compartir enlace'; }, 2000);
      });
    });
  }
}

// ─────────────────────────────────────────────
// INICIAR JUEGO (HOST)
// ─────────────────────────────────────────────
async function startGame() {
  if (!local.isHost) return;
  const room = local.currentRoom;
  if (!room) return;

  const players = room.players || {};
  const connected = Object.values(players).filter(p => p.connected);
  if (connected.length < 2) return;

  const config = room.config || {};
  const availableLetters = config.availableLetters || DEFAULT_LETTERS;
  const usedLetters = (room.state && room.state.usedLetters) || [];

  const remaining = availableLetters.filter(l => !usedLetters.includes(l));
  const letter = remaining.length > 0
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : availableLetters[Math.floor(Math.random() * availableLetters.length)];

  const newUsed = [...usedLetters, letter];

  await update(ref(db, `rooms/${local.roomCode}/state`), {
    phase: 'countdown',
    currentRound: (room.state.currentRound || 0) + 1,
    currentLetter: letter,
    roundStartedAt: null,
    stoppedBy: null,
    stoppedByName: null,
    stoppedAt: null,
    validationCategoryIndex: 0,
    validationStartedAt: null,
    usedLetters: newUsed
  });
}

// ─────────────────────────────────────────────
// COUNTDOWN
// ─────────────────────────────────────────────
function renderCountdown(room) {
  const letterEl = el('countdown-letter');
  const numberEl = el('countdown-number');
  const letter = room.state && room.state.currentLetter ? room.state.currentLetter : '?';

  if (letterEl) letterEl.textContent = letter;

  let count = 3;
  if (numberEl) numberEl.textContent = count;

  local.countdownInterval = setInterval(async () => {
    count--;
    if (count > 0) {
      if (numberEl) numberEl.textContent = count;
    } else {
      clearInterval(local.countdownInterval);
      local.countdownInterval = null;
      if (local.isHost) {
        // Transicionar a playing
        await update(ref(db, `rooms/${local.roomCode}/state`), {
          phase: 'playing',
          roundStartedAt: Date.now()
        });
      }
    }
  }, 1000);
}

// ─────────────────────────────────────────────
// PLAYING
// ─────────────────────────────────────────────
function renderPlaying(room) {
  const state = room.state || {};
  const config = room.config || {};
  const categories = config.categories || DEFAULT_CATEGORIES;
  const totalRounds = config.totalRounds || 3;

  // Letra
  const letterEl = el('game-letter-display');
  if (letterEl) letterEl.textContent = state.currentLetter || '?';

  // Info de ronda
  const roundInfo = el('game-round-info');
  if (roundInfo) roundInfo.textContent = `Ronda ${state.currentRound} de ${totalRounds}`;

  // Contador de jugadores conectados
  updatePlayingPlayerCount(room);

  // Crear inputs de categorías (siempre limpiar para rondas nuevas)
  const container = el('game-categories-container');
  if (container) {
    container.innerHTML = '';
    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-row';
      row.innerHTML = `
        <span class="category-label">${escapeHtml(cat)}</span>
        <input class="category-input" type="text" data-category="${escapeHtml(cat)}" placeholder="Escribe aquí..." autocomplete="off">
      `;
      container.appendChild(row);
    });

    // Restaurar respuestas previas
    const roundNum = state.currentRound;
    const prevAnswers = room.rounds && room.rounds[roundNum] && room.rounds[roundNum].answers && room.rounds[roundNum].answers[local.playerId];
    if (prevAnswers) {
      container.querySelectorAll('.category-input').forEach(input => {
        const cat = input.dataset.category;
        if (prevAnswers[cat]) input.value = prevAnswers[cat];
      });
    }

    // Event listeners con debounce
    container.querySelectorAll('.category-input').forEach(input => {
      input.addEventListener('input', () => {
        checkStopButton();
        const cat = input.dataset.category;
        if (local.answerDebounceTimers[cat]) clearTimeout(local.answerDebounceTimers[cat]);
        local.answerDebounceTimers[cat] = setTimeout(() => {
          saveAnswer(cat, input.value);
        }, 500);
      });
    });
  }

  checkStopButton();

  // STOP button
  const btnStop = el('btn-stop');
  if (btnStop && !btnStop._listenerAdded) {
    btnStop.addEventListener('click', pressStop);
    btnStop._listenerAdded = true;
  }

  // Notice de stop
  const notice = el('game-stopped-notice');
  if (notice) notice.classList.add('hidden');
}

function renderPlayingPartial(room) {
  updatePlayingPlayerCount(room);
  // Si alguien ya presionó stop, mostrar aviso
  const state = room.state || {};
  if (state.stoppedBy) {
    const notice = el('game-stopped-notice');
    if (notice) {
      notice.textContent = `¡${escapeHtml(state.stoppedByName || 'Alguien')} presionó STOP!`;
      notice.classList.remove('hidden');
    }
    // Deshabilitar inputs
    document.querySelectorAll('.category-input').forEach(i => i.disabled = true);
    const btnStop = el('btn-stop');
    if (btnStop) btnStop.disabled = true;

    // Host: detener timer y transicionar en 2 segundos
    if (local.isHost && !local.stopTransitionScheduled) {
      local.stopTransitionScheduled = true;
      if (local.roundTimerInterval) {
        clearInterval(local.roundTimerInterval);
        local.roundTimerInterval = null;
      }
      setTimeout(() => {
        local.stopTransitionScheduled = false;
        transitionToValidating();
      }, 2000);
    }
  }
}

function updatePlayingPlayerCount(room) {
  const players = room.players || {};
  const connected = Object.values(players).filter(p => p.connected).length;
  const countEl = el('game-player-count-display');
  if (countEl) countEl.textContent = `${connected} jugadores`;
}

async function saveAnswer(category, value) {
  if (!local.roomCode || !local.playerId) return;
  const room = local.currentRoom;
  if (!room) return;
  const roundNum = room.state && room.state.currentRound ? room.state.currentRound : 1;
  const safeCat = category.replace(/[.#$[\]/]/g, '_');
  try {
    await set(ref(db, `rooms/${local.roomCode}/rounds/${roundNum}/answers/${local.playerId}/${safeCat}`), value);
  } catch (err) {
    console.error('Error guardando respuesta:', err);
  }
}

function checkStopButton() {
  const btnStop = el('btn-stop');
  if (!btnStop) return;
  const inputs = document.querySelectorAll('.category-input');
  if (inputs.length === 0) { btnStop.disabled = true; return; }
  const allFilled = Array.from(inputs).every(i => i.value.trim() !== '');
  btnStop.disabled = !allFilled;
}

async function pressStop() {
  if (!local.roomCode || !local.playerId) return;
  const stateRef = ref(db, `rooms/${local.roomCode}/state`);

  try {
    await runTransaction(stateRef, (currentState) => {
      if (!currentState || currentState.phase !== 'playing') return; // Abortar
      if (currentState.stoppedBy) return; // Ya se presionó stop
      return {
        ...currentState,
        stoppedBy: local.playerId,
        stoppedByName: local.playerName,
        stoppedAt: Date.now()
      };
    });

    // Guardar respuestas pendientes
    document.querySelectorAll('.category-input').forEach(input => {
      const cat = input.dataset.category;
      if (local.answerDebounceTimers[cat]) {
        clearTimeout(local.answerDebounceTimers[cat]);
        delete local.answerDebounceTimers[cat];
      }
      saveAnswer(cat, input.value);
    });

    // La transición a validating la maneja renderPlayingPartial al detectar stoppedBy
  } catch (err) {
    console.error('Error en STOP transaction:', err);
  }
}

// ─────────────────────────────────────────────
// TIMER DE RONDA
// ─────────────────────────────────────────────
function startRoundTimer(roundStartedAt, roundDuration, room) {
  if (!roundStartedAt) return;
  clearTimers();

  const timerEl = el('game-timer-display');
  const timerBar = el('game-timer-bar');

  const tick = async () => {
    const elapsed = (Date.now() - roundStartedAt) / 1000;
    const remaining = Math.max(0, roundDuration - elapsed);

    if (timerEl) timerEl.textContent = formatTime(remaining);
    if (timerBar) {
      const pct = (remaining / roundDuration) * 100;
      timerBar.style.width = `${pct}%`;
      timerBar.style.backgroundColor = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    }

    if (remaining <= 0) {
      clearInterval(local.roundTimerInterval);
      local.roundTimerInterval = null;
      if (local.isHost) {
        // Verificar que aún estamos en playing
        const current = local.currentRoom;
        if (current && current.state && current.state.phase === 'playing') {
          await update(ref(db, `rooms/${local.roomCode}/state`), {
            stoppedBy: 'TIMER',
            stoppedByName: 'El tiempo'
          });
          // renderPlayingPartial detectará stoppedBy y programará la transición en 2s
        }
      }
    }
  };

  tick();
  local.roundTimerInterval = setInterval(tick, 1000);
}

async function transitionToValidating() {
  if (!local.isHost) return;
  const room = local.currentRoom;
  if (!room || !room.state || room.state.phase === 'validating') return;

  const categories = (room.config && room.config.categories) || DEFAULT_CATEGORIES;
  const roundNum = room.state.currentRound || 1;

  // Inicializar nodos de validación para todas las categorías y jugadores
  const players = room.players || {};
  const updates = {};

  categories.forEach(cat => {
    const safeCat = cat.replace(/[.#$[\]/]/g, '_');
    Object.keys(players).forEach(pid => {
      const answerPath = `rounds/${roundNum}/answers/${pid}/${safeCat}`;
      const answer = room.rounds && room.rounds[roundNum] && room.rounds[roundNum].answers &&
                     room.rounds[roundNum].answers[pid] && room.rounds[roundNum].answers[pid][safeCat];
      updates[`rounds/${roundNum}/validation/${safeCat}/${pid}`] = {
        answer: answer || '',
        invalidVotes: {},
        finalValid: null,
        score: null
      };
    });
  });

  const connectedCount = Object.values(players).filter(p => p.connected).length;
  const validationDuration = Math.max(2, connectedCount * 2);

  updates['state/phase'] = 'validating';
  updates['state/validationCategoryIndex'] = 0;
  updates['state/validationStartedAt'] = Date.now();
  updates['state/validationDuration'] = validationDuration;

  try {
    await update(ref(db, `rooms/${local.roomCode}`), updates);
  } catch (err) {
    console.error('Error transicionando a validating:', err);
  }
}

// ─────────────────────────────────────────────
// VALIDATING
// ─────────────────────────────────────────────
function renderValidating(room) {
  const state = room.state || {};
  const config = room.config || {};
  const categories = config.categories || DEFAULT_CATEGORIES;
  const catIndex = state.validationCategoryIndex || 0;
  const currentCat = categories[catIndex];
  if (!currentCat) return;

  const safeCat = currentCat.replace(/[.#$[\]/]/g, '_');
  const roundNum = state.currentRound || 1;

  // Nombre de categoría y progreso
  const catNameEl = el('validation-category-name');
  if (catNameEl) catNameEl.textContent = currentCat;

  const catProgress = el('validation-category-progress');
  if (catProgress) catProgress.textContent = `Categoría ${catIndex + 1} de ${categories.length}`;

  // Mi respuesta
  const myAnswerEl = el('validation-my-answer-display');
  const myValidation = room.rounds && room.rounds[roundNum] && room.rounds[roundNum].validation &&
                       room.rounds[roundNum].validation[safeCat] && room.rounds[roundNum].validation[safeCat][local.playerId];
  if (myAnswerEl) {
    const myAnswerTextEl = myAnswerEl.querySelector('.my-answer-text');
    const answerText = myValidation && myValidation.answer ? myValidation.answer : '(sin respuesta)';
    if (myAnswerTextEl) {
      myAnswerTextEl.textContent = answerText;
    } else {
      myAnswerEl.textContent = answerText;
    }
  }

  // Respuestas de todos
  const answersContainer = el('validation-answers-container');
  if (!answersContainer) return;
  answersContainer.innerHTML = '';

  const players = room.players || {};
  const validation = (room.rounds && room.rounds[roundNum] && room.rounds[roundNum].validation && room.rounds[roundNum].validation[safeCat]) || {};

  Object.entries(players)
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
    .filter(([pid]) => pid !== local.playerId)
    .forEach(([pid, player]) => {
      const vData = validation[pid] || { answer: '', invalidVotes: {}, finalValid: null };
      const myVoteInvalid = vData.invalidVotes && vData.invalidVotes[local.playerId];

      const card = document.createElement('div');
      card.className = 'answer-card';
      card.dataset.playerId = pid;
      card.dataset.category = safeCat;

      card.innerHTML = `
        <span class="answer-player-name">${escapeHtml(player.name)}</span>
        <span class="answer-text">${escapeHtml(vData.answer || '(sin respuesta)')}</span>
        <div class="answer-vote-buttons">
          <button class="btn-vote-valid${myVoteInvalid ? '' : ' active'}" data-player-id="${pid}" title="De acuerdo">✓</button>
          <button class="btn-vote-invalid${myVoteInvalid ? ' active' : ''}" data-player-id="${pid}" title="No estoy de acuerdo">✗</button>
        </div>
      `;

      card.querySelector('.btn-vote-valid').addEventListener('click', () => voteValid(pid, safeCat, roundNum));
      card.querySelector('.btn-vote-invalid').addEventListener('click', () => voteInvalid(pid, safeCat, roundNum));

      answersContainer.appendChild(card);
    });
}

async function voteInvalid(targetPlayerId, safeCat, roundNum) {
  try {
    await set(
      ref(db, `rooms/${local.roomCode}/rounds/${roundNum}/validation/${safeCat}/${targetPlayerId}/invalidVotes/${local.playerId}`),
      true
    );
  } catch (err) {
    console.error('Error votando inválido:', err);
  }
}

async function voteValid(targetPlayerId, safeCat, roundNum) {
  try {
    await remove(
      ref(db, `rooms/${local.roomCode}/rounds/${roundNum}/validation/${safeCat}/${targetPlayerId}/invalidVotes/${local.playerId}`)
    );
  } catch (err) {
    console.error('Error quitando voto inválido:', err);
  }
}

// ─────────────────────────────────────────────
// TIMER DE VALIDACIÓN
// ─────────────────────────────────────────────
function startValidationTimer(validationStartedAt, validationDuration, room) {
  if (!validationStartedAt) return;
  clearTimers();

  const timerEl = el('validation-timer-display');
  const timerBar = el('validation-timer-bar');

  const tick = async () => {
    const elapsed = (Date.now() - validationStartedAt) / 1000;
    const remaining = Math.max(0, validationDuration - elapsed);

    if (timerEl) timerEl.textContent = formatTime(remaining);
    if (timerBar) {
      const pct = (remaining / validationDuration) * 100;
      timerBar.style.width = `${pct}%`;
      timerBar.style.backgroundColor = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    }

    if (remaining <= 0) {
      clearInterval(local.validationTimerInterval);
      local.validationTimerInterval = null;
      if (local.isHost) {
        await processValidationCategory(local.currentRoom);
      }
    }
  };

  tick();
  local.validationTimerInterval = setInterval(tick, 1000);
}

// ─────────────────────────────────────────────
// PROCESAR CATEGORÍA DE VALIDACIÓN (HOST)
// ─────────────────────────────────────────────
async function processValidationCategory(room) {
  if (!local.isHost) return;

  const state = room.state || {};
  const config = room.config || {};
  const categories = config.categories || DEFAULT_CATEGORIES;
  const catIndex = state.validationCategoryIndex || 0;
  const currentCat = categories[catIndex];
  if (!currentCat) return;

  const safeCat = currentCat.replace(/[.#$[\]/]/g, '_');
  const roundNum = state.currentRound || 1;
  const players = room.players || {};
  const totalPlayers = Object.keys(players).length;
  // Inválido si >= mitad vota en contra; válido requiere < mitad de votos en contra
  const invalidThreshold = totalPlayers / 2;

  const validation = (room.rounds && room.rounds[roundNum] && room.rounds[roundNum].validation && room.rounds[roundNum].validation[safeCat]) || {};

  // Paso 1: Calcular finalValid por jugador
  const validAnswers = {};
  const updates = {};

  Object.entries(players).forEach(([pid]) => {
    const vData = validation[pid] || { answer: '', invalidVotes: {} };
    const invalidCount = vData.invalidVotes ? Object.keys(vData.invalidVotes).length : 0;
    const isValid = invalidCount < invalidThreshold && (vData.answer || '').trim() !== '';
    updates[`rounds/${roundNum}/validation/${safeCat}/${pid}/finalValid`] = isValid;
    if (isValid) {
      validAnswers[pid] = (vData.answer || '').toLowerCase().trim();
    }
  });

  // Paso 2: Contar repeticiones entre respuestas válidas
  const answerCounts = {};
  Object.values(validAnswers).forEach(ans => {
    answerCounts[ans] = (answerCounts[ans] || 0) + 1;
  });

  // Paso 3: Calcular puntos
  Object.entries(players).forEach(([pid]) => {
    let score = 0;
    if (validAnswers[pid] !== undefined) {
      const ans = validAnswers[pid];
      score = answerCounts[ans] === 1 ? 100 : 50;
    }
    updates[`rounds/${roundNum}/validation/${safeCat}/${pid}/score`] = score;
  });

  // Avanzar índice o ir a round-scores
  const nextIndex = catIndex + 1;
  if (nextIndex < categories.length) {
    // Siguiente categoría
    updates['state/validationCategoryIndex'] = nextIndex;
    updates['state/validationStartedAt'] = Date.now();
  } else {
    // Todas las categorías procesadas → calcular totales y pasar a round-scores
    // Calcular scores de ronda
    const roundScores = {};
    Object.keys(players).forEach(pid => {
      roundScores[pid] = 0;
    });

    // Sumar scores de todas las categorías procesadas en este round
    const roundValidation = (room.rounds && room.rounds[roundNum] && room.rounds[roundNum].validation) || {};

    // Categorías ya procesadas (0 to catIndex-1) y la actual
    const processedCats = categories.slice(0, catIndex); // catIndex aún no incluye la actual
    // La actual está en `updates`
    processedCats.forEach(cat => {
      const sc = cat.replace(/[.#$[\]/]/g, '_');
      const catValidation = roundValidation[sc] || {};
      Object.keys(players).forEach(pid => {
        const pv = catValidation[pid] || {};
        roundScores[pid] += pv.score || 0;
      });
    });

    // Agregar scores de la categoría actual (desde updates)
    Object.keys(players).forEach(pid => {
      roundScores[pid] += updates[`rounds/${roundNum}/validation/${safeCat}/${pid}/score`] || 0;
    });

    // Guardar round scores y actualizar totales
    Object.entries(players).forEach(([pid]) => {
      updates[`rounds/${roundNum}/scores/${pid}`] = roundScores[pid];
      // Acumular en total
      const currentTotal = players[pid].totalScore || 0;
      updates[`players/${pid}/totalScore`] = currentTotal + (roundScores[pid] || 0);
    });

    updates['state/phase'] = 'round-scores';
  }

  try {
    await update(ref(db, `rooms/${local.roomCode}`), updates);
  } catch (err) {
    console.error('Error procesando validación:', err);
  }
}

// ─────────────────────────────────────────────
// ROUND SCORES
// ─────────────────────────────────────────────
function renderRoundScores(room) {
  const state = room.state || {};
  const config = room.config || {};
  const players = room.players || {};
  const roundNum = state.currentRound || 1;
  const totalRounds = config.totalRounds || 3;
  const categories = config.categories || DEFAULT_CATEGORIES;

  const titleEl = el('round-scores-title');
  if (titleEl) titleEl.textContent = `Resultados - Ronda ${roundNum}`;

  // Desglose por categoría
  const breakdownEl = el('round-scores-breakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = '';
    const roundValidation = (room.rounds && room.rounds[roundNum] && room.rounds[roundNum].validation) || {};

    categories.forEach(cat => {
      const safeCat = cat.replace(/[.#$[\]/]/g, '_');
      const catValidation = roundValidation[safeCat] || {};

      const section = document.createElement('div');
      section.className = 'breakdown-category';
      section.innerHTML = `<h4 class="breakdown-cat-title">${escapeHtml(cat)}</h4>`;

      const table = document.createElement('table');
      table.className = 'breakdown-table';
      table.innerHTML = '<tr><th>Jugador</th><th>Respuesta</th><th>Puntos</th></tr>';

      Object.entries(players)
        .sort((a, b) => (b[1].totalScore || 0) - (a[1].totalScore || 0))
        .forEach(([pid, player]) => {
          const pv = catValidation[pid] || { answer: '', finalValid: null, score: 0 };
          const tr = document.createElement('tr');
          tr.className = pv.finalValid === false ? 'invalid-answer' : '';
          tr.innerHTML = `
            <td>${escapeHtml(player.name)}</td>
            <td>${escapeHtml(pv.answer || '(sin respuesta)')}${pv.finalValid === false ? ' ✗' : ''}</td>
            <td>${pv.score || 0}</td>
          `;
          table.appendChild(tr);
        });

      section.appendChild(table);
      breakdownEl.appendChild(section);
    });
  }

  // Ranking de esta ronda
  const scoresList = el('round-scores-list');
  if (scoresList) {
    scoresList.innerHTML = '';
    const roundScores = (room.rounds && room.rounds[roundNum] && room.rounds[roundNum].scores) || {};

    Object.entries(players)
      .sort((a, b) => (roundScores[b[0]] || 0) - (roundScores[a[0]] || 0))
      .forEach(([pid, player], index) => {
        const li = document.createElement('li');
        li.className = `score-item${pid === local.playerId ? ' me' : ''}`;
        li.innerHTML = `
          <span class="score-rank">#${index + 1}</span>
          <span class="score-name">${escapeHtml(player.name)}</span>
          <span class="score-points-round">+${roundScores[pid] || 0} pts</span>
          <span class="score-points-total">${player.totalScore || 0}</span>
        `;
        scoresList.appendChild(li);
      });
  }

  // Botón siguiente ronda (solo host)
  const btnNext = el('btn-next-round');
  const waitingMsg = el('round-scores-waiting');

  if (btnNext) btnNext.classList.toggle('hidden', !local.isHost);
  if (waitingMsg) waitingMsg.style.display = local.isHost ? 'none' : 'block';

  if (btnNext && !btnNext._listenerAdded) {
    btnNext.addEventListener('click', () => {
      const room = local.currentRoom;
      if (!room) return;
      const tr = (room.config && room.config.totalRounds) || 3;
      const cr = (room.state && room.state.currentRound) || 1;
      advanceFromRoundScores(tr, cr);
    });
    btnNext._listenerAdded = true;
  }
}

async function advanceFromRoundScores(totalRounds, currentRound) {
  if (!local.isHost) return;
  local.lastRenderedPhase = null; // Forzar re-render
  local.lastValidationCategoryIndex = -1;

  if (currentRound >= totalRounds) {
    // Ir a final scores
    await update(ref(db, `rooms/${local.roomCode}/state`), {
      phase: 'final-scores'
    });
  } else {
    // Siguiente ronda → countdown
    const room = local.currentRoom;
    if (!room) return;
    const config = room.config || {};
    const availableLetters = config.availableLetters || DEFAULT_LETTERS;
    const usedLetters = (room.state && room.state.usedLetters) || [];

    const remaining = availableLetters.filter(l => !usedLetters.includes(l));
    const letter = remaining.length > 0
      ? remaining[Math.floor(Math.random() * remaining.length)]
      : availableLetters[Math.floor(Math.random() * availableLetters.length)];

    const newUsed = [...usedLetters, letter];

    await update(ref(db, `rooms/${local.roomCode}/state`), {
      phase: 'countdown',
      currentRound: currentRound + 1,
      currentLetter: letter,
      roundStartedAt: null,
      stoppedBy: null,
      stoppedByName: null,
      stoppedAt: null,
      validationCategoryIndex: 0,
      validationStartedAt: null,
      usedLetters: newUsed
    });
  }
}

// ─────────────────────────────────────────────
// FINAL SCORES
// ─────────────────────────────────────────────
function renderFinalScores(room) {
  const players = room.players || {};

  const sorted = Object.entries(players)
    .sort((a, b) => (b[1].totalScore || 0) - (a[1].totalScore || 0));

  const winner = sorted[0];
  const winnerEl = el('final-winner-name');
  if (winnerEl) {
    winnerEl.textContent = winner ? `¡${escapeHtml(winner[1].name)} gana!` : '¡Fin del juego!';
  }

  const finalList = el('final-scores-list');
  if (finalList) {
    finalList.innerHTML = '';
    sorted.forEach(([pid, player], index) => {
      const li = document.createElement('li');
      li.className = `final-score-item${pid === local.playerId ? ' me' : ''}${index === 0 ? ' winner' : ''}`;
      li.innerHTML = `
        <span class="final-rank">#${index + 1}</span>
        <span class="final-name">${escapeHtml(player.name)}</span>
        <span class="final-score">${player.totalScore || 0} pts</span>
      `;
      finalList.appendChild(li);
    });
  }

  // Botones
  const btnPlayAgain = el('btn-play-again');
  const btnHome = el('btn-home-final');

  if (btnPlayAgain) {
    btnPlayAgain.classList.toggle('hidden', !local.isHost);
    if (!btnPlayAgain._listenerAdded) {
      btnPlayAgain.addEventListener('click', playAgain);
      btnPlayAgain._listenerAdded = true;
    }
  }
  if (btnHome && !btnHome._listenerAdded) {
    btnHome.addEventListener('click', goHome);
    btnHome._listenerAdded = true;
  }
}

async function playAgain() {
  if (!local.isHost) return;
  const room = local.currentRoom;
  if (!room) return;

  const players = room.players || {};

  // Resetear scores de jugadores
  const updates = {};
  Object.keys(players).forEach(pid => {
    updates[`players/${pid}/totalScore`] = 0;
  });

  // Resetear rounds
  updates['rounds'] = null;

  // Volver a lobby
  updates['state'] = {
    phase: 'lobby',
    currentRound: 0,
    currentLetter: null,
    roundStartedAt: null,
    stoppedBy: null,
    stoppedByName: null,
    stoppedAt: null,
    validationCategoryIndex: 0,
    validationStartedAt: null,
    usedLetters: []
  };

  local.lastRenderedPhase = null;
  local.lastValidationCategoryIndex = -1;

  try {
    await update(ref(db, `rooms/${local.roomCode}`), updates);
  } catch (err) {
    console.error('Error en play again:', err);
  }
}

function goHome() {
  clearTimers();
  detachRoomListener();

  if (local.roomCode && local.playerId) {
    update(ref(db, `rooms/${local.roomCode}/players/${local.playerId}`), { connected: false }).catch(() => {});
  }

  local.playerId = null;
  local.playerName = null;
  local.roomCode = null;
  local.isHost = false;
  local.currentRoom = null;
  local.lastRenderedPhase = null;
  local.lastValidationCategoryIndex = -1;
  local.answerDebounceTimers = {};

  showScreen('screen-home');
}

async function leaveLobby() {
  clearTimers();
  detachRoomListener();

  if (local.roomCode && local.playerId) {
    try {
      if (local.isHost) {
        // Si el host sale del lobby, eliminar la sala
        await remove(ref(db, `rooms/${local.roomCode}`));
      } else {
        await remove(ref(db, `rooms/${local.roomCode}/players/${local.playerId}`));
      }
    } catch (err) {
      console.error('Error al salir del lobby:', err);
    }
  }

  local.playerId = null;
  local.playerName = null;
  local.roomCode = null;
  local.isHost = false;
  local.currentRoom = null;
  local.lastRenderedPhase = null;
  local.lastValidationCategoryIndex = -1;
  local.answerDebounceTimers = {};

  showScreen('screen-home');
}

// ─────────────────────────────────────────────
// ESCAPE HTML
// ─────────────────────────────────────────────
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN DE EVENT LISTENERS
// ─────────────────────────────────────────────
function initEventListeners() {
  const btnCreate = el('btn-create-room');
  if (btnCreate) btnCreate.addEventListener('click', createRoom);

  const btnJoin = el('btn-join-room');
  if (btnJoin) btnJoin.addEventListener('click', joinRoom);

  // Enter en inputs de home
  const nameInput = el('input-player-name');
  const codeInput = el('input-room-code');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = codeInput ? codeInput.value.trim() : '';
        if (code) joinRoom(); else createRoom();
      }
    });
  }
  if (codeInput) {
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinRoom();
    });
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    });
  }

  const btnStart = el('btn-start-game');
  if (btnStart) btnStart.addEventListener('click', startGame);

  const btnLeave = el('btn-leave-lobby');
  if (btnLeave) btnLeave.addEventListener('click', leaveLobby);

  setupCopyBtn();

  // Pre-fill name from localStorage
  const savedName = localStorage.getItem('stop_player_name');
  if (savedName) {
    const nameInput = el('input-player-name');
    if (nameInput && !nameInput.value) nameInput.value = savedName;
  }

  // Handle invite URL (?room=XXXX-0000)
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('room');
  if (inviteCode) {
    const codeInput = el('input-room-code');
    if (codeInput) codeInput.value = inviteCode.toUpperCase();
    if (savedName) {
      const nameInput = el('input-player-name');
      if (nameInput) nameInput.value = savedName;
      // Auto-join after brief delay to let Firebase init
      setTimeout(() => joinRoom(), 300);
    } else {
      const nameInput = el('input-player-name');
      if (nameInput) {
        nameInput.focus();
        nameInput.placeholder = 'Ingresa tu nombre para unirte';
      }
      showInviteHint(inviteCode.toUpperCase());
    }
  }
}

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showLoading(false);
  showScreen('screen-home');
  initEventListeners();
});
