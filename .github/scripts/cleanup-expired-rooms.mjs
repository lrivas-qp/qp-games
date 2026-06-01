#!/usr/bin/env node
/**
 * Elimina de la Realtime Database las salas de STOP! que ya expiraron.
 *
 * Usa la REST API de RTDB (no requiere credenciales: las reglas permiten
 * lectura en /rooms y escritura por sala). Pensado para correr en un cron de
 * GitHub Actions, por lo que es liviano: lee solo las claves (shallow) y el
 * campo expiresAt de cada sala, y borra las vencidas.
 *
 * Variables de entorno:
 *   RTDB_URL  URL base de la base (por defecto la del proyecto stop-game-4f8e3)
 *   DRY_RUN   '1' para solo listar lo que se borraría, sin borrar
 */

const BASE = (process.env.RTDB_URL || 'https://stop-game-4f8e3-default-rtdb.firebaseio.com').replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === '1';
const FALLBACK_TTL_MS = 4 * 60 * 60 * 1000; // 4h para salas sin expiresAt

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const now = Date.now();
  const keys = await getJson('/rooms.json?shallow=true');
  if (!keys) { console.log('No hay salas. Nada que limpiar.'); return; }

  const codes = Object.keys(keys);
  console.log(`Salas encontradas: ${codes.length}`);

  let deleted = 0, kept = 0, failed = 0;

  for (const code of codes) {
    const safe = encodeURIComponent(code);
    let expired = false;

    const expiresAt = await getJson(`/rooms/${safe}/expiresAt.json`);
    if (typeof expiresAt === 'number') {
      expired = now > expiresAt;
    } else {
      // Sala sin expiresAt: usar createdAt + TTL; si tampoco hay, es basura → borrar
      const createdAt = await getJson(`/rooms/${safe}/createdAt.json`);
      expired = typeof createdAt === 'number' ? (now > createdAt + FALLBACK_TTL_MS) : true;
    }

    if (!expired) { kept++; continue; }

    if (DRY_RUN) {
      console.log(`[dry-run] se borraría: ${code}`);
      deleted++;
      continue;
    }

    const del = await fetch(`${BASE}/rooms/${safe}.json`, { method: 'DELETE' });
    if (del.ok) { deleted++; console.log(`Borrada: ${code}`); }
    else { failed++; console.error(`Error borrando ${code}: ${del.status} ${await del.text()}`); }
  }

  console.log(`Resumen -> borradas: ${deleted}, vigentes: ${kept}, fallidas: ${failed}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
