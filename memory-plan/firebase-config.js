import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  query,
  orderByChild,
  limitToFirst,
  onValue
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZEueX7LlMb1RCEO0f96kKJMeOJGHI4WM",
  authDomain: "stop-game-4f8e3.firebaseapp.com",
  databaseURL: "https://stop-game-4f8e3-default-rtdb.firebaseio.com",
  projectId: "stop-game-4f8e3",
  storageBucket: "stop-game-4f8e3.firebasestorage.app",
  messagingSenderId: "734539466367",
  appId: "1:734539466367:web:844d8129a2d7741a4b214a"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

const RANKINGS_PATH = "memory-plan/rankings";
const TOP_N = 6;
const NAME_MAX = 16;
const MAX_MS = 7200000;

function withTimeout(promise, ms, message) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error(message));
    }, ms);
    promise.then(function (value) {
      clearTimeout(timer);
      resolve(value);
    }, function (err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function sanitizeEntry(entry) {
  var name = String((entry && entry.name) || "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  var ms = Math.round(Number(entry && entry.ms));
  var moves = Math.round(Number(entry && entry.moves));
  var timestamp = Math.round(Number(entry && (entry.timestamp != null ? entry.timestamp : entry.at)));
  if (!name) throw new Error("Nombre inválido");
  if (!isFinite(ms) || ms <= 0 || ms > MAX_MS) throw new Error("Tiempo inválido");
  if (!isFinite(moves) || moves < 0 || moves > 9999) moves = 0;
  if (!isFinite(timestamp) || timestamp <= 0) timestamp = Date.now();
  return { name: name, ms: ms, moves: moves, timestamp: timestamp };
}

/**
 * Crea una entrada nueva con push ID. El nombre no es la clave: dos jugadores
 * homónimos no se pisan.
 */
export async function saveScore(entry) {
  var data = sanitizeEntry(entry);
  var entryRef = push(ref(db, RANKINGS_PATH));
  await withTimeout(set(entryRef, data), 8000, "Firebase timeout");
  return { id: entryRef.key, name: data.name, ms: data.ms, moves: data.moves, timestamp: data.timestamp };
}

/**
 * Top 6 por menor tiempo. El error de red o de reglas no se disfraza de lista vacía.
 */
export function watchTop(callback) {
  var active = true;
  var rankingsRef = query(ref(db, RANKINGS_PATH), orderByChild("ms"), limitToFirst(TOP_N));
  var timer = setTimeout(function () {
    if (!active) return;
    callback(null, new Error("Firebase timeout"));
  }, 8000);

  var unsubscribe = onValue(rankingsRef, function (snapshot) {
    clearTimeout(timer);
    if (!active) return;
    var rows = [];
    snapshot.forEach(function (child) {
      var val = child.val() || {};
      if (typeof val.name !== "string" || typeof val.ms !== "number" || !isFinite(val.ms)) return;
      rows.push({
        id: child.key,
        name: val.name,
        ms: val.ms,
        moves: typeof val.moves === "number" ? val.moves : 0,
        timestamp: typeof val.timestamp === "number" ? val.timestamp : 0
      });
    });
    rows.sort(function (a, b) {
      return a.ms - b.ms || a.moves - b.moves || a.timestamp - b.timestamp;
    });
    callback(rows.slice(0, TOP_N), null);
  }, function (err) {
    clearTimeout(timer);
    if (!active) return;
    callback(null, err || new Error("Firebase error"));
  });

  return function stop() {
    active = false;
    clearTimeout(timer);
    unsubscribe();
  };
}
