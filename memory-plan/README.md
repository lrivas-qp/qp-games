# MemoryPlan

Juego de memoria de QuePlan para un tótem vertical (1080×1920). Hay que encontrar las 8 parejas. El cronómetro parte al voltear la primera carta y se detiene al completar el tablero.

La página es una sola: el juego ocupa la pantalla y el ranking (`#ranking`) queda debajo. «VER RANKING» baja hasta esa sección.

## Cómo jugar

- Toca una carta para voltearla. La segunda cierra el intento.
- Si coinciden, el par queda abierto con borde verde menta.
- Si no coinciden, el borde se pone rojo, las cartas se sacuden y vuelven a taparse.
- Arriba se lee cuántas parejas van (`0 DE 8 PAREJAS`). **REINICIAR**, **JUGAR DE NUEVO** y el reinicio por inactividad arman un tablero nuevo: el mazo se baraja con Fisher-Yates y, si el orden saliera idéntico al anterior, se baraja una vez más.
- Al completar las 8, se abre un cartel. El nombre se escribe con el teclado en pantalla (máximo 16 caracteres) y recién ahí se guarda el tiempo.
- Si se cierra el cartel sin nombre, el tiempo no entra al ranking.
- Se ven los 6 mejores tiempos. Si todavía no hay puntajes, el scoreboard queda vacío.

## Ranking según el entorno

`app.js` es un módulo. Decide la fuente con el origen de la página (`env.js`):

| Origen | Ranking |
|---|---|
| GitHub Pages, localhost u otro `http`/`https` | Compartido, Firebase Realtime Database, nodo `memory-plan/rankings` |
| `https://appassets.androidplatform.net` (APK) | Solo `localStorage`, clave `qp-memoryplan-ranking` |
| `file://` u otro protocolo | Solo local. El APK es el kiosco sin red |

En la web no se lee ni se copia el `localStorage` anterior: esos puntajes no se suben al ranking global. Cada guardado usa un push ID, así dos personas con el mismo nombre no se pisan. La lista pide los 6 menores `ms` (`orderByChild` + `limitToFirst`). Si Firebase no responde, el scoreboard muestra el error; el juego sigue, pero no guarda en silencio en el equipo.

El APK no importa `firebase-config.js` (el `import()` dinámico solo corre fuera del host `appassets`). La tarea `syncWebAssets` además excluye ese archivo del paquete. Hace falta publicar `firebase-rules.json` en la consola de Firebase para que la web pueda leer y crear puntajes. El workflow de GitHub Pages no despliega esas reglas.

Para previsualizar en el navegador hace falta un servidor local (`npx serve memory-plan` o similar). Un `file://` no carga módulos ES en Chrome.

## Instalar en el tótem

El tótem sin internet usa el APK de `memory-plan-android/` (ver su README). Ahí el ranking vive en el `localStorage` del WebView y sigue al cerrar la app. **Vaciar ranking** (dos toques) solo existe en ese modo y borra la lista local.

Si alguien deja una partida a medias, el tablero se reinicia solo a los 90 segundos. Con el cartel de victoria abierto, a los 35 segundos vuelve un tablero nuevo y, si no había nombre, no se guarda nada.

## Estructura

```
memory-plan/
├── index.html
├── style.css
├── app.js
├── env.js              # web compartida vs APK/local
├── deck.js             # Fisher-Yates
├── local-rank.js       # ranking del APK
├── firebase-config.js  # solo web; no va dentro del APK
├── assets/
└── README.md
```

En 1080×1920 el juego llena la pantalla. En un monitor más ancho el fondo sigue de lado a lado y el contenido se mantiene al ancho del tótem.

## Origen

Interfaces de Daniel Carranza (8 de octubre de 2026), alineadas a la maqueta de MemoryPlan.
