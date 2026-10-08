export var OFFLINE_HOST = "appassets.androidplatform.net";

/**
 * La web publicada (GitHub Pages, localhost u otro http/https) comparte ranking.
 * El APK y cualquier origen que no sea http(s) —file incluido— quedan en local.
 */
export function usesSharedRanking(loc) {
  var protocol = String((loc && loc.protocol) || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return false;
  var host = String((loc && loc.hostname) || "").toLowerCase();
  if (host === OFFLINE_HOST) return false;
  return true;
}
