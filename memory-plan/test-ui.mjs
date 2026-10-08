import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

const MOCK = `
const rows = [];
const listeners = [];
function top() {
  return rows.slice().sort((a, b) => a.ms - b.ms || a.moves - b.moves || a.timestamp - b.timestamp).slice(0, 6);
}
function emit() {
  const list = top();
  listeners.forEach((cb) => cb(list, null));
}
export async function saveScore(entry) {
  window.__mpSaves = (window.__mpSaves || 0) + 1;
  await new Promise((resolve) => setTimeout(resolve, 180));
  const id = "push-" + rows.length;
  rows.push({
    id,
    name: entry.name,
    ms: entry.ms,
    moves: entry.moves,
    timestamp: entry.timestamp
  });
  emit();
  return { id, name: entry.name, ms: entry.ms, moves: entry.moves, timestamp: entry.timestamp };
}
export function watchTop(callback) {
  callback(top(), null);
  listeners.push(callback);
  return () => {};
}
`;

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!rel) rel = "index.html";
    const file = path.resolve(root, rel);
    const base = path.resolve(root);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("no");
        return;
      }
      const type = types[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function deckKey(page) {
  return page.$$eval(".card", (cards) => cards.map((card) => card.dataset.icon).join("|"));
}

async function winGame(page) {
  for (let pair = 0; pair < 8; pair++) {
    const icons = await page.$$eval(".card", (cards) => cards.map((card) => ({
      icon: card.dataset.icon,
      taken: card.classList.contains("is-match") || card.classList.contains("is-up")
    })));
    const first = icons.findIndex((card) => !card.taken);
    const second = icons.findIndex((card, index) => index !== first && !card.taken && card.icon === icons[first].icon);
    assert.ok(first >= 0 && second >= 0, "hay una pareja disponible");
    await page.locator(".card").nth(first).click();
    await page.locator(".card").nth(second).click();
    await page.waitForFunction(
      (count) => document.querySelectorAll(".card.is-match").length >= count,
      (pair + 1) * 2
    );
    await page.waitForTimeout(400);
  }
  await page.locator("#modal").waitFor({ state: "visible" });
}

async function typeName(page, name) {
  for (const letter of name) {
    await page.getByRole("button", { name: letter, exact: true }).click();
  }
}

function watchNet(page, bucket) {
  page.on("request", (request) => {
    const url = request.url();
    if (/firebase-config\.js|gstatic\.com|firebaseio\.com|googleapis\.com/i.test(url)) bucket.push(url);
  });
}

const server = await startServer();
const port = server.address().port;
const browser = await chromium.launch({
  args: ["--host-resolver-rules=MAP appassets.androidplatform.net 127.0.0.1"]
});

try {
  const web = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const webHits = [];
  watchNet(web, webHits);
  await web.route("**/firebase-config.js*", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript; charset=utf-8",
    body: MOCK
  }));
  await web.goto("http://127.0.0.1:" + port + "/index.html");
  await web.waitForSelector("#footer-note");
  assert.match(await web.locator("#footer-note").innerText(), /compartido/i);
  assert.equal(await web.locator("#btn-clear").isHidden(), true);
  await web.waitForFunction(() => document.querySelector(".card"));

  let previous = await deckKey(web);
  for (let i = 0; i < 3; i++) {
    await web.locator("#btn-restart").click();
    const next = await deckKey(web);
    assert.notEqual(next, previous, "REINICIAR debe cambiar el mazo");
    previous = next;
  }

  await winGame(web);
  await typeName(web, "ANA");
  await web.locator("#btn-save").click();
  await web.evaluate(() => document.getElementById("btn-save").click());
  await web.waitForFunction(() => (window.__mpSaves || 0) >= 1);
  assert.equal(await web.evaluate(() => window.__mpSaves), 1);
  await web.waitForFunction(() => document.body.innerText.includes("ANA"));
  assert.match(await web.locator("#modal-note").innerText(), /compartido|Actualizando/);
  assert.equal(await web.evaluate(() => localStorage.getItem("qp-memoryplan-ranking")), null);
  assert.ok(webHits.every((url) => /firebase-config\.js/.test(url) && !/gstatic|firebaseio|googleapis/.test(url)));
  assert.ok(webHits.some((url) => /firebase-config\.js/.test(url)));

  const beforeAgain = await deckKey(web);
  await web.locator("#btn-again").click();
  await web.waitForFunction((key) => {
    const now = [...document.querySelectorAll(".card")].map((card) => card.dataset.icon).join("|");
    return now && now !== key;
  }, beforeAgain);

  await web.close();

  const broken = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await broken.addInitScript(() => {
    localStorage.setItem("qp-memoryplan-ranking", JSON.stringify([
      { id: "local-1", name: "LOCALNO", ms: 1000, moves: 8, timestamp: 1700000000000 }
    ]));
  });
  await broken.route("**/firebase-config.js*", (route) => route.abort("failed"));
  await broken.goto("http://127.0.0.1:" + port + "/index.html");
  await broken.waitForSelector(".rank-status.is-error");
  const brokenText = await broken.locator("#rank-list").innerText();
  assert.match(brokenText, /No se pudo cargar el ranking compartido/);
  assert.match(brokenText, /conexión/);
  assert.match(await broken.locator("#live-label").innerText(), /SIN RED/);
  assert.doesNotMatch(brokenText, /LOCALNO/);
  assert.match(await broken.locator("#footer-note").innerText(), /compartido/i);
  await broken.close();

  const denied = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await denied.route("**/firebase-config.js*", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript; charset=utf-8",
    body: `
      export async function saveScore() {
        var err = new Error("PERMISSION_DENIED: Permission denied");
        err.code = "PERMISSION_DENIED";
        throw err;
      }
      export function watchTop(callback) {
        var err = new Error("Permission denied");
        err.code = "PERMISSION_DENIED";
        callback(null, err);
        return function () {};
      }
    `
  }));
  await denied.goto("http://127.0.0.1:" + port + "/index.html");
  await denied.waitForSelector(".rank-status.is-error");
  assert.match(await denied.locator("#live-label").innerText(), /SIN REGLAS/);
  assert.doesNotMatch(await denied.locator("#live-label").innerText(), /SIN RED/);
  assert.match(await denied.locator("#rank-list").innerText(), /Faltan las reglas/);
  await winGame(denied);
  await typeName(denied, "ANA");
  await denied.locator("#btn-save").click();
  await denied.waitForFunction(() => /rechazó el puntaje/i.test(document.getElementById("modal-note").textContent));
  await denied.close();

  const offline = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const offlineHits = [];
  watchNet(offline, offlineHits);
  await offline.goto("http://appassets.androidplatform.net:" + port + "/index.html");
  assert.equal(await offline.evaluate(() => location.hostname), "appassets.androidplatform.net");
  assert.match(await offline.locator("#footer-note").innerText(), /sin internet/i);
  await offline.waitForSelector(".card");
  await winGame(offline);
  await typeName(offline, "LIA");
  await offline.locator("#btn-save").click();
  await offline.waitForFunction(() => document.body.innerText.includes("LIA"));
  const raw = await offline.evaluate(() => localStorage.getItem("qp-memoryplan-ranking"));
  assert.match(raw, /LIA/);
  await offline.reload();
  await offline.waitForFunction(() => document.body.innerText.includes("LIA"));
  const after = await offline.evaluate(() => localStorage.getItem("qp-memoryplan-ranking"));
  assert.match(after, /LIA/);
  assert.deepEqual(offlineHits, [], "el origen offline no debe pedir Firebase: " + offlineHits.join(" "));

  const beforeRestart = await deckKey(offline);
  await offline.locator("#btn-restart").click();
  assert.notEqual(await deckKey(offline), beforeRestart);

  await offline.locator("#btn-clear").click();
  await offline.locator("#btn-clear").click();
  await offline.waitForSelector(".rank-empty");
  await offline.reload();
  await offline.waitForSelector(".rank-empty");
  assert.equal(await offline.evaluate(() => localStorage.getItem("qp-memoryplan-ranking")), null);
  await offline.close();

  console.log("test-ui: ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
