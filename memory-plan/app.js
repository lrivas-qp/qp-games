import { nextDeck } from "./deck.js?v=1";
import { usesSharedRanking } from "./env.js?v=1";
import {
  STORAGE_KEY,
  loadRanks,
  rememberScore,
  clearRanks
} from "./local-rank.js?v=1";

var ICONS = [
  { id: "x", src: "assets/x.svg", label: "X" },
  { id: "corazon", src: "assets/corazon.svg", label: "Corazón" },
  { id: "cohete", src: "assets/cohete.svg", label: "Cohete" },
  { id: "dedos", src: "assets/dedos.svg", label: "Dedos" },
  { id: "lupa", src: "assets/lupa.svg", label: "Lupa" },
  { id: "cruz", src: "assets/cruz.svg", label: "Cruz" },
  { id: "rayo", src: "assets/rayo.svg", label: "Rayo" },
  { id: "hueso", src: "assets/hueso.svg", label: "Hueso" }
];

var MISS_MS = 900;
var IDLE_PLAY_MS = 90000;
var IDLE_MODAL_MS = 35000;
var NAME_MAX = 16;

var boardEl = document.getElementById("board");
var minsEl = document.getElementById("mins");
var segsEl = document.getElementById("segs");
var pairsEl = document.getElementById("pairs");
var keyboardEl = document.getElementById("keyboard");
var nameText = document.getElementById("name-text");
var btnSave = document.getElementById("btn-save");
var btnSkip = document.getElementById("btn-skip");
var btnAgain = document.getElementById("btn-again");
var btnRestart = document.getElementById("btn-restart");
var btnClear = document.getElementById("btn-clear");
var btnPosition = document.getElementById("btn-position");
var rankList = document.getElementById("rank-list");
var footerNote = document.getElementById("footer-note");
var livePill = document.getElementById("live-pill");
var liveLabel = document.getElementById("live-label");
var modal = document.getElementById("modal");
var modalCard = modal.querySelector(".modal-card");
var modalTime = document.getElementById("modal-time");
var modalNote = document.getElementById("modal-note");
var namePanel = document.getElementById("name-panel");
var savedPanel = document.getElementById("saved-panel");
var confetti = modal.querySelector(".confetti");

var usingShared = usesSharedRanking(location);
var firebaseApi = null;
var sharedReady = Promise.resolve(null);
var sharedFailed = false;
var stopWatch = null;

var busy = false;
var running = false;
var won = false;
var modalOpen = false;
var startTs = 0;
var elapsed = 0;
var timerId = 0;
var moves = 0;
var matched = 0;
var firstCard = null;
var resolveTimer = 0;
var finishTimer = 0;
var idleTimer = 0;
var clearTimer = 0;
var placeTimer = 0;
var nameValue = "";
var saved = false;
var saving = false;
var gameGen = 0;
var clearArmed = false;
var highlightId = "";
var lastOrder = "";
var rankRows = [];
var rankState = "ready";

function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

function formatTime(ms) {
  var total = Math.floor(Math.min(Math.max(ms, 0), 99 * 60000 + 59000) / 1000);
  return { m: pad(Math.floor(total / 60)), s: pad(total % 60) };
}

function paintClock(ms) {
  var t = formatTime(ms);
  minsEl.textContent = t.m;
  segsEl.textContent = t.s;
}

function clockLabel(ms) {
  var t = formatTime(ms);
  return t.m + ":" + t.s;
}

function paintPairs() {
  pairsEl.textContent = matched + " DE 8 PAREJAS";
}

function initials(name) {
  var word = String(name || "").trim().split(/\s+/)[0] || "";
  return word.slice(0, 2).toLocaleUpperCase("es");
}

function placeClass(index) {
  if (index === 0) return " is-gold";
  if (index === 1) return " is-silver";
  if (index === 2) return " is-bronze";
  return "";
}

function paintChrome() {
  if (usingShared) {
    footerNote.textContent = "Ranking compartido entre equipos.";
    btnClear.hidden = true;
  } else {
    footerNote.textContent = "Ranking guardado en este equipo, sin internet.";
    btnClear.hidden = false;
  }
  paintLive();
}

function paintLive() {
  livePill.classList.remove("is-error", "is-local", "is-wait");
  if (!usingShared) {
    liveLabel.textContent = "EN ESTE EQUIPO";
    livePill.classList.add("is-local");
    return;
  }
  if (rankState === "loading") {
    liveLabel.textContent = "CARGANDO";
    livePill.classList.add("is-wait");
    return;
  }
  if (rankState === "error" || rankState === "stale") {
    liveLabel.textContent = "SIN RED";
    livePill.classList.add("is-error");
    return;
  }
  liveLabel.textContent = "EN VIVO";
}

function appendStatus(text, isError) {
  var item = document.createElement("li");
  item.className = "rank-status" + (isError ? " is-error" : "");
  item.textContent = text;
  rankList.appendChild(item);
}

function renderRanks() {
  rankList.textContent = "";
  paintLive();
  if (rankState === "loading") {
    appendStatus("Cargando ranking…", false);
    return;
  }
  if ((rankState === "error" || rankState === "stale") && !rankRows.length) {
    appendStatus("No se pudo cargar el ranking compartido. Revisa la conexión.", true);
    return;
  }
  if (!rankRows.length) {
    var empty = document.createElement("li");
    empty.className = "rank-empty";
    var title = document.createElement("p");
    title.textContent = usingShared
      ? "Todavía no hay puntajes compartidos."
      : "Todavía no hay puntajes en este tótem.";
    var hint = document.createElement("p");
    hint.textContent = "Completa las 8 parejas y deja tu nombre.";
    empty.appendChild(title);
    empty.appendChild(hint);
    rankList.appendChild(empty);
    return;
  }
  if (rankState === "stale") {
    appendStatus("No se pudo actualizar el ranking compartido.", true);
  }
  rankRows.forEach(function (row, index) {
    var li = document.createElement("li");
    li.className = "rank-row" + (row.id === highlightId ? " is-me" : "");
    var place = document.createElement("span");
    place.className = "rank-place" + placeClass(index);
    place.textContent = pad(index + 1);
    var avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = initials(row.name);
    var name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = row.name;
    var time = document.createElement("span");
    time.className = "rank-time";
    time.textContent = clockLabel(row.ms);
    li.appendChild(place);
    li.appendChild(avatar);
    li.appendChild(name);
    li.appendChild(time);
    rankList.appendChild(li);
  });
}

function placeOf(id) {
  for (var i = 0; i < rankRows.length; i++) {
    if (rankRows[i].id === id) return i + 1;
  }
  return -1;
}

function refreshSavedNote() {
  if (!saved || !highlightId || !modalOpen) return;
  var place = placeOf(highlightId);
  if (place !== -1) {
    clearTimeout(placeTimer);
    modalNote.textContent = usingShared
      ? "Tu tiempo quedó en el ranking compartido."
      : "Tu tiempo quedó registrado en el scoreboard.";
    return;
  }
  if (!usingShared) {
    modalNote.textContent = "Este tiempo no entra en los 6 más rápidos.";
    return;
  }
  if (rankState === "error" || rankState === "stale") {
    modalNote.textContent = "El puntaje se envió, pero el ranking compartido no confirmó la posición.";
    return;
  }
  modalNote.textContent = "Puntaje publicado. Actualizando el ranking…";
}

function showSavedPanel() {
  namePanel.hidden = true;
  savedPanel.hidden = false;
}

function paintName() {
  nameText.textContent = nameValue || "Tu nombre";
  nameText.className = nameValue ? "" : "name-placeholder";
  btnSave.disabled = saved || saving || nameValue.trim().length === 0;
  btnSave.textContent = saving ? "GUARDANDO…" : "GUARDAR PUNTAJE";
  btnSkip.disabled = saving;
}

function typeChar(ch) {
  if (saved || saving || !modalOpen) return;
  if (ch === " " && (nameValue.length === 0 || nameValue.slice(-1) === " ")) return;
  if (nameValue.length >= NAME_MAX) return;
  nameValue += ch;
  paintName();
  bumpIdle();
}

function backspace() {
  if (saved || saving || !modalOpen) return;
  nameValue = nameValue.slice(0, -1);
  paintName();
  bumpIdle();
}

function makeKey(label, aria, onPress, extra) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "key" + (extra ? " " + extra : "");
  btn.textContent = label;
  btn.setAttribute("aria-label", aria);
  btn.addEventListener("click", onPress);
  return btn;
}

function buildKeyboard() {
  var rows = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];
  rows.forEach(function (letters, index) {
    var row = document.createElement("div");
    row.className = "key-row";
    letters.split("").forEach(function (letter) {
      row.appendChild(makeKey(letter, letter, function () { typeChar(letter); }));
    });
    if (index === 2) {
      row.appendChild(makeKey("⌫", "Borrar", backspace, "wide"));
    }
    keyboardEl.appendChild(row);
  });
  var spaceRow = document.createElement("div");
  spaceRow.className = "key-row";
  spaceRow.appendChild(makeKey("ESPACIO", "Espacio", function () { typeChar(" "); }, "space"));
  keyboardEl.appendChild(spaceRow);
}

function buildConfetti() {
  var colors = ["#22c8ec", "#41b4e4", "#6ae7bb", "#ffffff", "#e2a61e", "#ff6d7b"];
  for (var i = 0; i < 18; i++) {
    var bit = document.createElement("i");
    bit.style.left = (4 + (i * 5.3) % 92) + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = (i * 0.18) + "s";
    bit.style.animationDuration = (2.6 + (i % 5) * 0.35) + "s";
    bit.style.width = (8 + (i % 3) * 4) + "px";
    bit.style.height = (12 + (i % 4) * 4) + "px";
    confetti.appendChild(bit);
  }
}

function closeModal() {
  modalOpen = false;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openModal() {
  modalOpen = true;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  paintName();
  modalCard.focus();
  bumpIdle();
}

function showVictory() {
  if (!won) return;
  saved = false;
  saving = false;
  nameValue = "";
  modalTime.textContent = clockLabel(elapsed);
  modalNote.textContent = usingShared
    ? "Escribe tu nombre para quedar en el ranking compartido."
    : "Escribe tu nombre para quedar en el scoreboard.";
  namePanel.hidden = false;
  savedPanel.hidden = true;
  paintName();
  openModal();
}

function finishGame() {
  stopClock();
  busy = true;
  won = true;
  clearTimeout(finishTimer);
  finishTimer = setTimeout(showVictory, 650);
  bumpIdle();
}

function onCardClick(card) {
  if (busy || won || card.classList.contains("is-up")) return;
  startClock();
  bumpIdle();
  card.classList.add("is-up");
  card.setAttribute("aria-label", "Carta " + card.dataset.label);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  moves += 1;
  busy = true;
  var second = card;
  var isMatch = firstCard.dataset.icon === second.dataset.icon;

  if (isMatch) {
    firstCard.classList.add("is-match");
    second.classList.add("is-match");
    firstCard.setAttribute("aria-label", "Par de " + firstCard.dataset.label);
    second.setAttribute("aria-label", "Par de " + second.dataset.label);
    matched += 1;
    paintPairs();
    var done = matched === ICONS.length;
    firstCard = null;
    if (done) {
      resolveTimer = setTimeout(finishGame, 700);
      return;
    }
    resolveTimer = setTimeout(function () {
      busy = false;
    }, 280);
    return;
  }

  firstCard.classList.add("is-miss");
  second.classList.add("is-miss");
  var missA = firstCard;
  var missB = second;
  firstCard = null;
  resolveTimer = setTimeout(function () {
    missA.classList.remove("is-up", "is-miss");
    missB.classList.remove("is-up", "is-miss");
    missA.setAttribute("aria-label", "Carta oculta");
    missB.setAttribute("aria-label", "Carta oculta");
    busy = false;
  }, MISS_MS);
}

function stopClock() {
  if (timerId) {
    clearInterval(timerId);
    timerId = 0;
  }
  if (running) {
    elapsed = Date.now() - startTs;
    running = false;
    paintClock(elapsed);
  }
}

function startClock() {
  if (running || won) return;
  running = true;
  startTs = Date.now() - elapsed;
  timerId = setInterval(function () {
    elapsed = Date.now() - startTs;
    paintClock(elapsed);
  }, 100);
}

function renderBoard() {
  boardEl.textContent = "";
  var dealt = nextDeck(ICONS, lastOrder);
  lastOrder = dealt.key;
  dealt.deck.forEach(function (icon) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.icon = icon.id;
    btn.dataset.label = icon.label;
    btn.setAttribute("aria-label", "Carta oculta");

    var inner = document.createElement("span");
    inner.className = "card-inner";

    var back = document.createElement("span");
    back.className = "face back";
    var backImg = document.createElement("img");
    backImg.src = "assets/lupa-blanca.svg";
    backImg.alt = "";
    backImg.draggable = false;
    back.appendChild(backImg);

    var front = document.createElement("span");
    front.className = "face front";
    var frontImg = document.createElement("img");
    frontImg.src = icon.src;
    frontImg.alt = "";
    frontImg.draggable = false;
    front.appendChild(frontImg);

    inner.appendChild(back);
    inner.appendChild(front);
    btn.appendChild(inner);
    btn.addEventListener("click", function () { onCardClick(btn); });
    boardEl.appendChild(btn);
  });
}

function newGame() {
  gameGen += 1;
  clearTimeout(resolveTimer);
  clearTimeout(finishTimer);
  stopClock();
  busy = false;
  won = false;
  running = false;
  elapsed = 0;
  moves = 0;
  matched = 0;
  firstCard = null;
  saved = false;
  saving = false;
  nameValue = "";
  clearArmed = false;
  clearTimeout(clearTimer);
  clearTimeout(placeTimer);
  btnClear.textContent = "Vaciar ranking";
  paintClock(0);
  paintPairs();
  closeModal();
  renderBoard();
  renderRanks();
  window.scrollTo(0, 0);
  try {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  } catch (err) {}
  bumpIdle();
}

function onRankSnapshot(rows, err) {
  if (err) {
    rankState = rankRows.length ? "stale" : "error";
  } else {
    rankRows = rows || [];
    rankState = "ready";
  }
  renderRanks();
  refreshSavedNote();
}

function beginSharedImport() {
  sharedFailed = false;
  if (!rankRows.length) {
    rankState = "loading";
    renderRanks();
  }
  sharedReady = import("./firebase-config.js?v=1").then(function (mod) {
    firebaseApi = mod;
    if (!stopWatch) stopWatch = mod.watchTop(onRankSnapshot);
    return mod;
  }).catch(function (err) {
    sharedFailed = true;
    if (!firebaseApi) {
      rankState = rankRows.length ? "stale" : "error";
      renderRanks();
    }
    throw err;
  });
  return sharedReady;
}

function bootRanking() {
  paintChrome();
  if (!usingShared) {
    try {
      rankRows = loadRanks(localStorage);
    } catch (err) {
      rankRows = [];
    }
    rankState = "ready";
    renderRanks();
    return;
  }
  rankRows = [];
  beginSharedImport();
}

function ensureFirebase() {
  if (firebaseApi) return Promise.resolve(firebaseApi);
  if (sharedFailed) beginSharedImport();
  return sharedReady.then(function (mod) {
    if (!mod) throw new Error("Firebase no disponible");
    return mod;
  });
}

function saveScore() {
  var name = nameValue.trim().replace(/\s+/g, " ");
  if (!name || saved || saving || !modalOpen || !won) return;
  var gen = gameGen;
  var entry = { name: name, ms: elapsed, moves: moves, timestamp: Date.now() };
  saving = true;
  paintName();
  bumpIdle();

  var pending = usingShared
    ? ensureFirebase().then(function (mod) { return mod.saveScore(entry); })
    : Promise.resolve().then(function () { return rememberScore(localStorage, entry); });

  pending.then(function (result) {
    if (gen !== gameGen) return;
    saved = true;
    saving = false;
    highlightId = result.id;
    if (!usingShared) {
      rankRows = result.rows;
      rankState = "ready";
      renderRanks();
    }
    refreshSavedNote();
    showSavedPanel();
    paintName();
    if (usingShared && placeOf(highlightId) === -1) {
      clearTimeout(placeTimer);
      placeTimer = setTimeout(function () {
        if (!saved || !modalOpen || placeOf(highlightId) !== -1) return;
        if (rankState === "error" || rankState === "stale") {
          modalNote.textContent = "El puntaje se envió, pero el ranking compartido no confirmó la posición.";
          return;
        }
        modalNote.textContent = "Este tiempo no entra en los 6 más rápidos.";
      }, 2500);
    }
    bumpIdle();
  }).catch(function () {
    if (gen !== gameGen) return;
    saving = false;
    paintName();
    modalNote.textContent = usingShared
      ? "No se pudo publicar el puntaje. Revisa la conexión e inténtalo de nuevo."
      : "No se pudo guardar el puntaje en este equipo.";
  });
}

function bumpIdle() {
  clearTimeout(idleTimer);
  var wait = 0;
  if (modalOpen || won) wait = IDLE_MODAL_MS;
  else if (running || matched > 0) wait = IDLE_PLAY_MS;
  if (!wait) return;
  idleTimer = setTimeout(newGame, wait);
}

btnSave.addEventListener("click", saveScore);
btnSkip.addEventListener("click", newGame);
btnAgain.addEventListener("click", newGame);
btnRestart.addEventListener("click", newGame);
btnPosition.addEventListener("click", function () {
  closeModal();
  bumpIdle();
});
btnClear.addEventListener("click", function () {
  if (usingShared) return;
  if (!clearArmed) {
    clearArmed = true;
    btnClear.textContent = "Toca de nuevo para vaciar";
    clearTimeout(clearTimer);
    clearTimer = setTimeout(function () {
      clearArmed = false;
      btnClear.textContent = "Vaciar ranking";
    }, 2500);
    return;
  }
  clearArmed = false;
  clearTimeout(clearTimer);
  btnClear.textContent = "Vaciar ranking";
  try {
    clearRanks(localStorage);
  } catch (err) {}
  highlightId = "";
  rankRows = [];
  rankState = "ready";
  renderRanks();
});

document.addEventListener("pointerdown", bumpIdle);
document.addEventListener("keydown", function (ev) {
  if (!modalOpen || saved) return;
  if (ev.key === "Backspace") {
    backspace();
    ev.preventDefault();
    return;
  }
  if (ev.key === "Enter") {
    saveScore();
    ev.preventDefault();
    return;
  }
  if (ev.key === " ") {
    typeChar(" ");
    ev.preventDefault();
    return;
  }
  if (/^[a-zA-ZñÑ]$/.test(ev.key)) {
    typeChar(ev.key.toLocaleUpperCase("es"));
    ev.preventDefault();
  }
});

buildKeyboard();
buildConfetti();
bootRanking();
newGame();

window.addEventListener("pagehide", function () {
  if (stopWatch) stopWatch();
});
