export function shuffle(list, random) {
  var rng = typeof random === "function" ? random : Math.random;
  var arr = list.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function orderKey(deck) {
  return deck.map(function (icon) { return icon.id; }).join("|");
}

/**
 * Arma el mazo duplicado y lo baraja con Fisher-Yates.
 * Si el orden coincide con el anterior, reintenta una vez para que el cambio se note.
 */
export function nextDeck(icons, previousKey, random) {
  var deck = [];
  icons.forEach(function (icon) {
    deck.push(icon);
    deck.push(icon);
  });
  var next = shuffle(deck, random);
  var key = orderKey(next);
  if (previousKey && key === previousKey) {
    next = shuffle(deck, random);
    key = orderKey(next);
  }
  return { deck: next, key: key };
}
