export var STORAGE_KEY = "qp-memoryplan-ranking";
export var TOP_N = 6;
export var NAME_MAX = 16;
export var MAX_MS = 7200000;

export function byRank(a, b) {
  return a.ms - b.ms || a.moves - b.moves || a.timestamp - b.timestamp;
}

export function normalizeEntry(entry, index) {
  if (!entry || typeof entry.name !== "string") return null;
  var name = entry.name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  var ms = Number(entry.ms);
  var moves = Number(entry.moves);
  var timestamp = Number(entry.timestamp != null ? entry.timestamp : entry.at);
  if (!name || !isFinite(ms) || ms <= 0 || ms > MAX_MS) return null;
  if (!isFinite(moves) || moves < 0) moves = 0;
  if (!isFinite(timestamp) || timestamp <= 0) timestamp = Date.now();
  moves = Math.min(9999, Math.round(moves));
  ms = Math.round(ms);
  timestamp = Math.round(timestamp);
  var id = typeof entry.id === "string" && entry.id
    ? entry.id
    : "legacy-" + timestamp + "-" + (index || 0);
  return { id: id, name: name, ms: ms, moves: moves, timestamp: timestamp };
}

export function loadRanks(storage) {
  try {
    var raw = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    var rows = [];
    raw.forEach(function (row, index) {
      var clean = normalizeEntry(row, index);
      if (clean) rows.push(clean);
    });
    rows.sort(byRank);
    return rows.slice(0, TOP_N);
  } catch (err) {
    return [];
  }
}

export function saveRanks(storage, rows) {
  storage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, TOP_N)));
}

export function clearRanks(storage) {
  storage.removeItem(STORAGE_KEY);
}

export function rememberScore(storage, entry) {
  var clean = normalizeEntry(entry, 0);
  if (!clean) throw new Error("Puntaje inválido");
  if (!entry || typeof entry.id !== "string" || !entry.id) {
    clean.id = "local-" + clean.timestamp + "-" + Math.random().toString(36).slice(2, 8);
  }
  var rows = loadRanks(storage);
  rows.push(clean);
  rows.sort(byRank);
  var top = rows.slice(0, TOP_N);
  saveRanks(storage, top);
  var placed = false;
  top.forEach(function (row) {
    if (row.id === clean.id) placed = true;
  });
  return { id: clean.id, rows: top, placed: placed };
}
