import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAZEueX7LlMb1RCEO0f96kKJMeOJGHI4WM",
  authDomain:        "stop-game-4f8e3.firebaseapp.com",
  databaseURL:       "https://stop-game-4f8e3-default-rtdb.firebaseio.com",
  projectId:         "stop-game-4f8e3",
  storageBucket:     "stop-game-4f8e3.firebasestorage.app",
  messagingSenderId: "734539466367",
  appId:             "1:734539466367:web:844d8129a2d7741a4b214a"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

const RANKINGS_PATH = 'typing-maniac/rankings';

/**
 * Genera una clave estable a partir del nombre del jugador.
 * Mismo nombre → misma clave → set() sobreescribe la entrada anterior.
 */
function nameToKey(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 20) || 'anonimo';
}

/**
 * Guarda (o sobreescribe) la puntuación de un jugador en Firebase RTDB.
 * Usa set() con clave derivada del nombre para que el mismo jugador no genere duplicados.
 */
export async function saveScore(playerName, score, level) {
  const name = String(playerName).trim().substring(0, 30) || 'Anonimo';
  const key  = nameToKey(name);
  const playerRef = ref(db, `${RANKINGS_PATH}/${key}`);
  const savePromise = set(playerRef, {
    nombreJugador:  name,
    puntuacion:     Number(score)  || 0,
    nivelAlcanzado: Number(level)  || 1,
    timestamp:      Date.now()
  });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Firebase timeout')), 5000)
  );
  await Promise.race([savePromise, timeout]);
}

/**
 * Obtiene el Top 10 de puntuaciones ordenado de mayor a menor.
 * Deduplica por nombre (por si hay entradas viejas con push()) quedándose con la mayor.
 */
export function getTopTen(callback) {
  let called = false;
  function once(rankings, err) {
    if (called) return;
    called = true;
    callback(rankings, err);
  }

  const timeout = setTimeout(() => once([], null), 4000);

  try {
    const rankingsRef = ref(db, RANKINGS_PATH);
    onValue(rankingsRef, (snapshot) => {
      clearTimeout(timeout);
      if (!snapshot.exists()) { once([], null); return; }

      // Deduplicar por nombre: si hay duplicados, queda la puntuación más alta
      const bestByName = new Map();
      snapshot.forEach(child => {
        const entry = { id: child.key, ...child.val() };
        const existing = bestByName.get(entry.nombreJugador);
        if (!existing || entry.puntuacion > existing.puntuacion) {
          bestByName.set(entry.nombreJugador, entry);
        }
      });

      const entries = [...bestByName.values()];
      entries.sort((a, b) => b.puntuacion - a.puntuacion);
      once(entries.slice(0, 10), null);
    }, (err) => {
      clearTimeout(timeout);
      console.error('[Firebase] Error obteniendo top 10:', err);
      once(null, err);
    }, { onlyOnce: true });
  } catch (err) {
    clearTimeout(timeout);
    once(null, err);
  }
}
