# CONTEXTO DE SESIÓN — Juego STOP! Multiplayer

## Estado actual
- El juego está **desplegado y accesible** en: https://lrivas-qp.github.io/stop-game/
- Repo GitHub: https://github.com/lrivas-qp/stop-game
- Código local: `C:\Users\lrivas\Documents\stop-game`
- Firebase proyecto: `stop-game-4f8e3`
- Firebase Realtime DB: `https://stop-game-4f8e3-default-rtdb.firebaseio.com`

## Stack técnico
- Frontend: HTML + CSS + JS vanilla (sin bundler, sin npm)
- Realtime: Firebase v10 ESM desde CDN (`https://www.gstatic.com/firebasejs/10.14.1/`)
- Hosting: GitHub Pages (rama `main`, raíz `/`)
- Base de datos: Firebase Realtime Database (plan Spark, gratuito)

## Archivos del proyecto
```
stop-game/
├── index.html              # 7 pantallas del juego
├── style.css               # Tema oscuro, responsive, animaciones
├── app.js                  # Lógica completa Firebase (~1450 líneas)
├── firebase-config.js      # Credenciales reales ya configuradas
├── database.rules.json     # Reglas de seguridad Firebase
├── README.md               # Instrucciones para el equipo
└── CONTEXTO.md             # Este archivo
```

## Reglas Firebase (aplicar si no están activas)
Ir a: https://console.firebase.google.com/project/stop-game-4f8e3/database/stop-game-4f8e3-default-rtdb/rules
y publicar:
```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

---

## Qué hace el juego (flujo completo)

El juego STOP! es un juego de palabras multiplayer para hasta 20 jugadores.

### Flujo de 7 pantallas:
1. **Home** → el jugador ingresa su nombre y código de sala, o crea una sala nueva.
   - El nombre se guarda en `localStorage` para futuras sesiones.
   - Si la URL tiene `?room=CODIGO`, el campo de sala se pre-llena automáticamente.
   - Si además hay nombre guardado en localStorage, el jugador entra directo a la sala (auto-join).

2. **Lobby** → sala de espera antes de iniciar.
   - El host ve configuración: categorías, rondas, segundos por ronda, letras disponibles.
   - Los jugadores ven la lista de quiénes están conectados.
   - El host puede compartir enlace de invitación (`?room=CODIGO`).
   - Mínimo 2 jugadores para iniciar. Máximo 20.
   - Solo el host puede iniciar el juego.

3. **Countdown** → se revela la letra con animación 3-2-1.
   - El host genera la letra y transiciona a Playing al llegar a 0.

4. **Playing** → cada jugador llena los campos de las categorías activas con la letra de la ronda.
   - El botón STOP solo se habilita cuando TODOS los campos están llenos.
   - Cualquier jugador puede presionar STOP una vez que los llenó todos.
   - Al presionar STOP: se notifica a todos, los inputs se bloquean, y 2 segundos después se pasa a Validating.
   - Si se acaba el tiempo, ocurre lo mismo (timer sincronizado por Firebase).

5. **Validating** → se validan las respuestas categoría por categoría.
   - Cada categoría tiene un timer dinámico: `max(10, jugadores_conectados × 2)` segundos.
   - Se muestran las respuestas de TODOS los jugadores (excepto la propia).
   - Por defecto, la respuesta está marcada como ✓ válida.
   - Cualquier jugador puede marcar ✗ inválida la respuesta de otro.
   - El host avanza automáticamente al terminar el timer de cada categoría.

6. **Round Scores** → resultados de la ronda y ranking acumulado.
   - Solo el host puede avanzar a la siguiente ronda o al resultado final.

7. **Final Scores** → clasificación final, ganador destacado con confetti.
   - El host puede iniciar una nueva partida (vuelve a Lobby).

### Reglas de puntuación:
- Respuesta única válida = **100 pts**
- Respuesta repetida válida = **50 pts**
- Respuesta vacía = **0 pts**
- Respuesta invalidada por votación = **0 pts**

### Reglas de validación:
- Umbral de invalidación: `invalidVotes >= totalPlayers / 2` (mitad o más vota inválido → 0 pts)
- La validación es por comparación case-insensitive (normalizada a minúsculas)

### Configuración del juego (host):
- **Categorías por defecto**: Nombre, Apellido, Animal, Ciudad, País, Comida, Color, Marca, Cosa/Objeto, Profesión, Película/Serie, Deporte
- **Letras disponibles**: A B C D E F G H I J L M N O P R S T U V (fáciles, sin K W X Y Z)
- **Rondas**: 1–10 (default 3)
- **Segundos por ronda**: 30–300 (default 90)

### Gestión de salas:
- Código de sala: 4 letras + 2 dígitos (6 chars alfanumérico, sin guión), ej. `AZEE27`
- Las salas expiran a las 4 horas de creación
- Si el host se desconecta, el jugador con `joinedAt` más temprano hereda el rol de host

---

## Historial de bugs corregidos (sesiones anteriores)

1. **Clase CSS faltante** `letter-toggle` → `btn-letter-toggle` (app.js)
2. **Clase CSS faltante** `vote-buttons` → `answer-vote-buttons` (app.js)
3. **14 clases JS sin definición CSS** → agregadas a style.css
4. **Clases score** `score-round`/`score-total` → `score-points-round`/`score-points-total`
5. **`textContent` destruía child spans** en `#validation-my-answer-display`
6. **`btn-play-again` nunca visible** para el host → corregido
7. **Countdown interval sin limpiar** al cambiar de fase → ahora registrado en `local.countdownInterval`
8. **`processValidationCategory` usaba snapshot stale** → ahora usa `local.currentRoom`
9. **SyntaxError crítico**: regex `/[.#$[]/]/g` → `/[.#$[\]/]/g` (línea de `sc`) — impedía cargar el juego
10. **`.hidden { display: none !important; }` vs `style.display`**: el `!important` es NECESARIO para que la clase `.hidden` venza selectores ID (ej. `#loading-overlay { display: flex }`). Todo show/hide de elementos que tienen clase `.hidden` en el HTML debe hacerse con `classList.add/remove/toggle('hidden')`, NUNCA con `element.style.display`.
11. **Favicon** añadido (SVG inline) para eliminar error 404 en consola
12. **Responsive config categorías** sobresalían → max 3 columnas, `min-width: 0; overflow: hidden`
13. **Botón STOP tapaba últimas categorías** → botón fijo en footer (`position: fixed`), `padding-bottom` en lista
14. **Botones de votación**: rediseño a iconos ✓/✗ circulares, no se muestra la respuesta propia, `active` class para estado seleccionado
15. **Código de sala muy largo** (era `XXXX-NNNN` 9 chars) → ahora 6 chars alfanumérico sin guión
16. **Sala sin expiración** → ahora expiran a las 4 horas (`createdAt` + `expiresAt`)
17. **Loading overlay atascado** tras recargar: `#loading-overlay { display: flex }` (ID) vencía a `.hidden { display: none }` (clase) sin `!important`. Restaurado `!important` y convertidos todos los JS show/hide a `classList`.
18. **`game-stopped-notice` nunca visible** tras restaurar `!important`: usaba `style.display = 'block'` → cambiado a `classList.remove('hidden')`
19. **Enlace de invitación**: `?room=CODIGO` pre-llena sala; si hay nombre en localStorage hace auto-join
20. **Formulario no se limpiaba entre rondas**: `renderPlaying` solo creaba inputs si el container estaba vacío → ahora siempre hace `innerHTML = ''` primero
21. **STOP sin transición inmediata**: al presionar STOP, ahora el host cancela el timer y transiciona en 2 segundos en lugar de esperar el tiempo restante
22. **Duración de validación fija**: ahora es dinámica (`max(10, jugadores × 2)` segundos) guardada en Firebase para todos los clientes
23. **Mobile inputs desbordaban**: `.category-row` con `overflow: hidden`, `.category-input` con `font-size: 16px` (evita zoom iOS) y `min-width: 0`
24. **Countdown atascado en siguiente ronda**: `clearTimers()` se llamaba en cada Firebase update dentro de la fase countdown, matando el interval. Movido dentro del bloque condicional de cambio de fase.
25. **Botones ✓/✗ no reflejaban votos al instante**: la pantalla de validación solo re-renderizaba al cambiar categoría. Ahora `renderValidating` corre en cada update de Firebase (pero el timer solo se reinicia al cambiar categoría).
26. **CSS ✗ activo poco visible**: fondo rojo sólido + texto blanco cuando ✗ está seleccionado; ✓ inactivo más neutro/gris

---

## Detalles técnicos críticos

### Patrón `classList` vs `style.display`
- `.hidden { display: none !important; }` en CSS — el `!important` es OBLIGATORIO para que funcione contra selectores ID.
- Elementos con clase `.hidden` en el HTML: usar SOLO `classList.add/remove/toggle('hidden')` en JS. NUNCA `element.style.display`.
- Elementos sin clase `.hidden` (ej. `#home-invite-hint` con `style="display:none"`): se puede usar `style.display` directamente.

### Estado local (`local` object, app.js línea ~22)
```javascript
const local = {
  playerId, playerName, roomCode, isHost,
  db, roomRef, roomListener,
  countdownInterval, roundTimerInterval, validationTimerInterval,
  currentRoom, answerDebounceTimers,
  lastRenderedPhase, lastValidationCategoryIndex,
  stopTransitionScheduled  // evita doble transición al detectar stoppedBy
};
```

### `handleRoomUpdate` — lógica de re-render
- `countdown`: solo re-renderiza (y limpia timers) al cambiar de fase
- `playing`: solo llama `renderPlaying + startRoundTimer` al cambiar de fase; updates parciales van a `renderPlayingPartial`
- `validating`: **siempre** llama `renderValidating` (para actualizar votos); timer solo se reinicia al cambiar categoría o fase
- Demás fases: solo re-renderiza si `lastRenderedPhase` cambió

### Transición STOP
- Cualquier jugador escribe `stoppedBy` en Firebase (con transaction para evitar dobles)
- `renderPlayingPartial` detecta `stoppedBy`, deshabilita inputs y STOP button
- Si es host y `stopTransitionScheduled === false`: clearInterval del timer, programa `transitionToValidating()` en 2000ms
- El timer de ronda también escribe `stoppedBy: 'TIMER'` → mismo flujo

---

## Herramientas disponibles

- **MCP Playwright**: instalado como `@playwright/mcp`, configurado en `C:\Users\lrivas\.claude\.mcp.json`. Activo en nuevas sesiones. Usar para probar el juego en navegador real.
- **Chrome instalado**: `C:\Program Files\Google\Chrome\Application\chrome.exe` — usar como `executablePath` en scripts Playwright (NO descargar Chromium).
- **Scripts de test**: `test-playwright.cjs` y `test-playwright-invite.cjs` en la raíz. Requieren playwright desde `C:\Users\lrivas\AppData\Roaming\npm\node_modules\@playwright\mcp\node_modules\playwright`.
- **gh CLI**: instalado (v2.92.0). Autenticado con cuenta `lrivas-qp`.
- **git**: disponible, remote configurado hacia `lrivas-qp/stop-game`.

## Comandos útiles
```powershell
# Push de cambios
cd C:\Users\lrivas\Documents\stop-game
git add -A && git commit -m "fix: descripcion" && git push

# Ver estado de GitHub Pages
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
gh api repos/lrivas-qp/stop-game/pages | ConvertFrom-Json | Select status, html_url
```

---

## Features implementadas
- ✅ Sala con código corto alfanumérico (6 chars, ej. `AZEE27`)
- ✅ Sala expira en 4 horas
- ✅ Máximo 20 jugadores
- ✅ Enlace de invitación `?room=CODIGO` con auto-join si hay nombre en localStorage
- ✅ Nombre guardado en localStorage entre sesiones
- ✅ Configuración de categorías, rondas, tiempo y letras (solo host)
- ✅ Contador de jugadores conectados en tiempo real
- ✅ Timer de ronda sincronizado por Firebase
- ✅ STOP habilitado solo al llenar todas las categorías
- ✅ Transición inmediata al presionar STOP (2 segundos de espera)
- ✅ Validación por votación con icons ✓/✗
- ✅ Timer de validación dinámico (jugadores × 2 segundos)
- ✅ No aparece la respuesta propia en validación
- ✅ Formulario se limpia entre rondas
- ✅ Herencia de host si el host se desconecta
- ✅ Pantalla final con confetti y botón "Jugar de nuevo"
- ✅ Responsive + mobile friendly (iOS sin zoom, inputs sin desborde)

## TODO — Pendiente de probar
- [ ] Flujo completo con 2+ jugadores simultáneos
- [ ] Verificar que el timer se sincroniza entre múltiples dispositivos
- [ ] Verificar herencia de host cuando el host abandona
- [ ] Probar en iPhone (iOS zoom, inputs)
- [ ] Verificar cálculo de scores al final de todas las rondas

---

## Prompt para nueva sesión
Pegar esto al inicio de una nueva sesión de Claude Code:

---
Tengo un juego web multiplayer "STOP!" ya desplegado. Lee el archivo `C:\Users\lrivas\Documents\stop-game\CONTEXTO.md` para tener todo el contexto antes de hacer cualquier cosa. El repo está en `C:\Users\lrivas\Documents\stop-game` y en GitHub `lrivas-qp/stop-game`. El juego está en https://lrivas-qp.github.io/stop-game/. Hay un MCP de Playwright disponible para probar en el navegador, usa Chrome desde `C:\Program Files\Google\Chrome\Application\chrome.exe` (NO descargues Chromium). Haz push de cada corrección que hagas.
---
