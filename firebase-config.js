// ── Firebase v10 Modular SDK — Typing Maniac ─────────────────────────────
// INSTRUCCIONES: Crea un proyecto Firebase en https://console.firebase.google.com
// Activa Realtime Database (modo test) y rellena las credenciales abajo.
// Si quieres reusar el proyecto stop-game-4f8e3, solo cambia las credenciales.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  query,
  orderByChild,
  limitToLast,
  get
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

// ── Credenciales (reemplaza con las tuyas desde Firebase Console) ─────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Inicialización ────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Ruta raíz en la RTDB donde se guardan los rankings
const RANKINGS_PATH = 'typing-maniac/rankings';

// ── Estructura de datos en Firebase Realtime Database ────────────────────
// typing-maniac/
//   rankings/
//     {auto-id}/
//       nombreJugador  : string   — Nombre del jugador
//       puntuacion     : number   — Puntuación final
//       nivelAlcanzado : number   — Nivel máximo alcanzado
//       timestamp      : number   — Date.now() al guardar

/**
 * Guarda la puntuación de un jugador en Firebase RTDB.
 * Usa push() para generar un ID único automáticamente.
 * @param {string} playerName  - Nombre del jugador
 * @param {number} score       - Puntuación final
 * @param {number} level       - Nivel alcanzado
 * @returns {Promise<void>}
 */
export async function saveScore(playerName, score, level) {
  const rankingsRef = ref(db, RANKINGS_PATH);
  await push(rankingsRef, {
    nombreJugador:  String(playerName).trim().substring(0, 30) || 'Anónimo',
    puntuacion:     Number(score)  || 0,
    nivelAlcanzado: Number(level)  || 1,
    timestamp:      Date.now()
  });
}

/**
 * Obtiene el Top 10 de puntuaciones ordenado de mayor a menor.
 * Usa limitToLast(10) + orderByChild('puntuacion') de la RTDB.
 * Llama callback(rankings, null) en éxito o callback(null, error) en fallo.
 * @param {Function} callback - (rankings: Array|null, error: Error|null) => void
 */
export function getTopTen(callback) {
  let called = false;
  function once(rankings, err) {
    if (called) return;
    called = true;
    callback(rankings, err);
  }

  // Timeout de 4s por si Firebase cuelga con credenciales placeholder
  const timeout = setTimeout(() => once([], null), 4000);

  try {
    const rankingsRef = ref(db, RANKINGS_PATH);
    const top10Query = query(rankingsRef, orderByChild('puntuacion'), limitToLast(10));
    get(top10Query)
      .then(snapshot => {
        clearTimeout(timeout);
        if (!snapshot.exists()) { once([], null); return; }
        const entries = [];
        snapshot.forEach(child => entries.push({ id: child.key, ...child.val() }));
        entries.sort((a, b) => b.puntuacion - a.puntuacion);
        once(entries, null);
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error('[Firebase] Error obteniendo top 10:', err);
        once(null, err);
      });
  } catch (err) {
    clearTimeout(timeout);
    once(null, err);
  }
}
