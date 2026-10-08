import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nextDeck, orderKey, shuffle } from "./deck.js";
import { usesSharedRanking } from "./env.js";
import { STORAGE_KEY, TOP_N, loadRanks, rememberScore, clearRanks } from "./local-rank.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    dump() {
      return Object.assign({}, data);
    }
  };
}

const icons = [
  { id: "x" }, { id: "corazon" }, { id: "cohete" }, { id: "dedos" },
  { id: "lupa" }, { id: "cruz" }, { id: "rayo" }, { id: "hueso" }
];

const dealt = nextDeck(icons, "");
assert.equal(dealt.deck.length, 16);
const counts = {};
dealt.deck.forEach((icon) => {
  counts[icon.id] = (counts[icon.id] || 0) + 1;
});
icons.forEach((icon) => assert.equal(counts[icon.id], 2));

let previous = "";
for (let i = 0; i < 12; i++) {
  const next = nextDeck(icons, previous);
  if (previous) assert.notEqual(next.key, previous);
  assert.equal(orderKey(next.deck), next.key);
  previous = next.key;
}

let calls = 0;
const scripted = () => {
  calls += 1;
  return calls <= 3 ? 0.999999 : 0;
};
const pair = [{ id: "a" }, { id: "b" }];
const first = nextDeck(pair, "", scripted);
assert.equal(first.key, "a|a|b|b");
const second = nextDeck(pair, first.key, scripted);
assert.notEqual(second.key, first.key);
assert.deepEqual(shuffle([{ id: "a" }, { id: "b" }], () => 0).map((icon) => icon.id), ["b", "a"]);

assert.equal(usesSharedRanking({ protocol: "https:", hostname: "lrivas-qp.github.io" }), true);
assert.equal(usesSharedRanking({ protocol: "http:", hostname: "localhost" }), true);
assert.equal(usesSharedRanking({ protocol: "http:", hostname: "127.0.0.1" }), true);
assert.equal(usesSharedRanking({ protocol: "https:", hostname: "appassets.androidplatform.net" }), false);
assert.equal(usesSharedRanking({ protocol: "file:", hostname: "" }), false);

const stored = memoryStorage();
const saved = rememberScore(stored, { name: "  Ana  Pérez ", ms: 15321.4, moves: 12, timestamp: 1700000000000 });
assert.match(saved.id, /^local-/);
assert.equal(saved.placed, true);
const reloaded = loadRanks(memoryStorage(stored.dump()));
assert.equal(reloaded.length, 1);
assert.equal(reloaded[0].name, "Ana Pérez");
assert.equal(reloaded[0].ms, 15321);
assert.equal(reloaded[0].id, saved.id);
assert.equal(reloaded[0].timestamp, 1700000000000);

const legacy = memoryStorage();
legacy.setItem(STORAGE_KEY, JSON.stringify([{ name: "Luis", ms: 20000, moves: 11, at: 1700000001000 }]));
const legacyRows = loadRanks(legacy);
assert.equal(legacyRows[0].name, "Luis");
assert.equal(legacyRows[0].timestamp, 1700000001000);

const many = memoryStorage();
for (let i = 0; i < 8; i++) {
  rememberScore(many, { name: "J" + i, ms: 10000 + i * 1000, moves: 8, timestamp: 1700000000000 + i });
}
const top = loadRanks(memoryStorage(many.dump()));
assert.equal(top.length, TOP_N);
assert.equal(top[0].name, "J0");
assert.equal(top[5].name, "J5");
assert.equal(loadRanks(memoryStorage(many.dump()))[0].id, top[0].id);

assert.throws(() => rememberScore(memoryStorage(), { name: " ", ms: 10, moves: 8, timestamp: 1 }));
clearRanks(stored);
assert.deepEqual(loadRanks(stored), []);

const rules = JSON.parse(fs.readFileSync(path.join(root, "firebase-rules.json"), "utf8"));
const rankings = rules.rules["memory-plan"].rankings;
assert.equal(rankings[".read"], true);
assert.deepEqual(rankings[".indexOn"], ["ms"]);
assert.equal(rankings[".write"], undefined);
const entry = rankings.$entryId;
assert.match(entry[".write"], /!data\.exists\(\)/);
assert.match(entry[".validate"], /name/);
assert.match(entry[".validate"], /ms/);
assert.match(entry[".validate"], /moves/);
assert.match(entry[".validate"], /timestamp/);
assert.equal(rules.rules.snake.rankings[".read"], true);
assert.equal(rules.rules["typing-maniac"].rankings[".read"], true);

const firebaseSrc = fs.readFileSync(path.join(root, "memory-plan", "firebase-config.js"), "utf8");
assert.match(firebaseSrc, /push\(/);
assert.match(firebaseSrc, /memory-plan\/rankings/);
assert.match(firebaseSrc, /orderByChild\("ms"\)/);
assert.match(firebaseSrc, /limitToFirst/);
assert.doesNotMatch(firebaseSrc, /nameToKey/);

const appSrc = fs.readFileSync(path.join(root, "memory-plan", "app.js"), "utf8");
assert.match(appSrc, /import\("\.\/firebase-config\.js\?v=1"\)/);
assert.match(appSrc, /if \(!usingShared\)/);
assert.match(appSrc, /btnRestart\.addEventListener\("click", newGame\)/);
assert.match(appSrc, /btnAgain\.addEventListener\("click", newGame\)/);
assert.match(appSrc, /btnSkip\.addEventListener\("click", newGame\)/);
assert.match(appSrc, /idleTimer = setTimeout\(newGame, wait\)/);
assert.match(appSrc, /nextDeck\(ICONS, lastOrder\)/);

const activity = fs.readFileSync(path.join(root, "memory-plan-android", "app", "src", "main", "java", "cl", "queplan", "memoryplan", "MainActivity.java"), "utf8");
assert.match(activity, /setDomStorageEnabled\(true\)/);
assert.match(activity, /appassets\.androidplatform\.net/);
assert.match(activity, /flushDomStorage/);
assert.doesNotMatch(activity, /clearCache|clearData|deleteAllData|removeAllCookie/);

const manifest = fs.readFileSync(path.join(root, "memory-plan-android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
assert.match(manifest, /android\.permission\.INTERNET/);
assert.match(manifest, /tools:node="remove"/);

const gradle = fs.readFileSync(path.join(root, "memory-plan-android", "app", "build.gradle"), "utf8");
assert.match(gradle, /exclude "firebase-config\.js"/);

console.log("test-ranking: ok");
