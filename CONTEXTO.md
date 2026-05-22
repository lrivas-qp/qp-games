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
├── index.html          # 7 pantallas del juego
├── style.css           # Tema oscuro, responsive, animaciones
├── app.js              # Lógica completa Firebase (~1394 líneas)
├── firebase-config.js  # Credenciales reales ya configuradas
├── database.rules.json # Reglas de seguridad Firebase
├── README.md           # Instrucciones para el equipo
└── CONTEXTO.md         # Este archivo
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

## Flujo del juego (7 pantallas)
1. **Home** → ingresar nombre + código de sala (o crear sala nueva)
2. **Lobby** → host configura categorías/letras/rondas/tiempo, comparte código
3. **Countdown** → letra aleatoria revelada con animación 3-2-1
4. **Playing** → llenar categorías; STOP habilitado solo cuando todas están llenas; timer sincronizado por Firebase
5. **Validating** → categoría por categoría (10 seg c/u), votación por mayoría
6. **Round Scores** → resultados de la ronda, host avanza
7. **Final Scores** → ganador y ranking total

## Reglas del juego implementadas
- 12 categorías por defecto: Nombre, Apellido, Animal, Ciudad, País, Comida, Color, Marca, Cosa/Objeto, Profesión, Película/Serie, Deporte
- Letras fáciles por defecto: A B C D E F G H I J L M N O P R S T U V
- Solo puede dar STOP quien llenó todas las categorías
- Si se acaba el tiempo, para automáticamente
- Validación: votos inválidos >= mitad de jugadores → respuesta = 0 pts
- Puntuación: respuesta única válida = 100 pts, repetida válida = 50 pts, inválida/vacía = 0 pts
- Host es árbitro de la fase de validación (avanza categorías, calcula scores)
- Si host se desconecta, el jugador con `joinedAt` más temprano hereda el rol

## Historial de bugs corregidos (en esta sesión)
1. Clase CSS `letter-toggle` → `btn-letter-toggle` (app.js líneas 477, 491, 512)
2. Clase CSS `vote-buttons` → `answer-vote-buttons` (app.js línea 902)
3. 14 clases JS sin definición CSS → agregadas a style.css
4. Clases `score-round`/`score-total` → `score-points-round`/`score-points-total`
5. `textContent` destruía child spans en `#validation-my-answer-display`
6. `btn-play-again` nunca visible para el host
7. Countdown interval sin registrar en `local` → no se limpiaba al cambiar fase
8. `processValidationCategory` usaba snapshot stale en vez de `local.currentRoom`
9. **SyntaxError crítico**: regex `/[.#$[]/]/g` → `/[.#$[\]/]/g` en variable `sc` (línea 1057) — este era el bug que impedía cargar el juego

## Herramientas disponibles
- **MCP Playwright**: instalado como `@playwright/mcp`, configurado en `C:\Users\lrivas\.claude\.mcp.json`. Activo en nuevas sesiones. Usar para probar el juego en navegador real.
- **gh CLI**: instalado (v2.92.0). Autenticado con cuenta `lrivas-qp`.
- **git**: disponible, remote configurado hacia `lrivas-qp/stop-game`

## Comandos útiles para esta sesión
```powershell
# Push de cambios
cd C:\Users\lrivas\Documents\stop-game
git add -A && git commit -m "fix: descripcion" && git push

# Ver estado de GitHub Pages
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
gh api repos/lrivas-qp/stop-game/pages | ConvertFrom-Json | Select status, html_url
```

## TODO — Lo que falta probar y corregir
- [ ] Verificar que "Crear sala nueva" funciona (SyntaxError ya corregido, pendiente confirmar)
- [ ] Verificar que "Unirse a sala" con código funciona para otros jugadores
- [ ] Probar flujo completo: lobby → countdown → playing → STOP → validación → scores
- [ ] Verificar timer sincronizado entre múltiples tabs/dispositivos
- [ ] Verificar que el botón STOP se deshabilita correctamente hasta llenar todas las categorías
- [ ] Verificar fase de validación: que los votos se guardan y se calculan bien
- [ ] Probar con 2+ jugadores simultáneos (abrir 2 tabs o 2 dispositivos)
- [ ] Verificar que si el host se va, otro jugador hereda el rol

## Prompt para nueva sesión
Pegar esto al inicio de una nueva sesión de Claude Code:

---
Tengo un juego web multiplayer "STOP!" ya desplegado. Lee el archivo `C:\Users\lrivas\Documents\stop-game\CONTEXTO.md` para tener todo el contexto. Luego usa el MCP de Playwright para abrir https://lrivas-qp.github.io/stop-game/ en el navegador, probar "Crear sala nueva", detectar errores en consola del navegador, y corregir lo que falte. El repo está en `C:\Users\lrivas\Documents\stop-game` y en GitHub `lrivas-qp/stop-game`. Haz push de cada corrección.
---
