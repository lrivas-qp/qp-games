# 🎮 Juegos QP

Monorepo con la colección de juegos web de QP. Cada juego vive en su propia carpeta y es autónomo (HTML/CSS/JS). STOP!, Typing Maniac, Snake y la web de MemoryPlan usan Firebase. El APK offline de MemoryPlan guarda el ranking en el equipo, sin internet. Una página central (`index.html`) actúa como portal de bienvenida con acceso a cada juego.

**🔗 En vivo:** https://lrivas-qp.github.io/qp-games/

## Juegos

| Juego | Carpeta | Descripción |
|-------|---------|-------------|
| 🛑 **STOP!** | [`stop-game/`](./stop-game/) | El clásico Stop / Tutti Frutti multijugador en tiempo real. |
| ⌨️ **Typing Maniac** | [`typing-maniac/`](./typing-maniac/) | Escribe las palabras que caen antes de que lleguen al fondo. |
| 🐍 **Snake** | [`snake/`](./snake/) | La culebrita clásica: come, crece y no choques. Con ranking online. |
| 🧠 **MemoryPlan** | [`memory-plan/`](./memory-plan/) | Memoria para tótem 1080×1920. Ranking compartido en la web; local en el APK. |

## Estructura

```
qp-games/
├── index.html              # Portal de bienvenida "Juegos QP"
├── firebase-rules.json     # Reglas de la Realtime Database (todos los juegos)
├── .github/workflows/      # Despliegue unificado a GitHub Pages
├── stop-game/              # Juego STOP! (autónomo)
├── typing-maniac/          # Juego Typing Maniac (autónomo)
├── snake/                  # Juego Snake (autónomo)
├── memory-plan/            # Juego MemoryPlan (web con ranking compartido)
└── memory-plan-android/    # APK offline, ranking solo en el equipo
```

## Backend (Firebase)

Todos los juegos comparten el mismo proyecto de Firebase Realtime Database. Las reglas de seguridad de **todos** los juegos están versionadas en [`firebase-rules.json`](./firebase-rules.json). Al agregar un juego que use la base de datos, añade su nodo a ese archivo y publícalo en la consola (Realtime Database → Reglas).

### Limpieza automática de salas (STOP!)

Las salas de STOP! tienen un `expiresAt` (4 h). Un workflow programado las elimina de la base para no acumular salas viejas:

- **Workflow:** [`.github/workflows/cleanup-rooms.yml`](./.github/workflows/cleanup-rooms.yml) — corre cada 6 horas (y se puede lanzar a mano con opción *dry-run*).
- **Script:** [`.github/scripts/cleanup-expired-rooms.mjs`](./.github/scripts/cleanup-expired-rooms.mjs) — usa la REST API de RTDB (sin credenciales) para borrar las salas vencidas.
- Requiere permiso de lectura a nivel de `rooms` en las reglas (ya incluido en `firebase-rules.json`).

## Despliegue

El repositorio se publica automáticamente en GitHub Pages mediante GitHub Actions en cada push a `main`. La raíz del sitio sirve el portal; cada juego es accesible en su subruta:

- Portal: `/qp-games/`
- STOP!: `/qp-games/stop-game/`
- Typing Maniac: `/qp-games/typing-maniac/`
- Snake: `/qp-games/snake/`
- MemoryPlan: `/qp-games/memory-plan/`

## Agregar un juego nuevo

1. Crea una carpeta con el juego autónomo (rutas relativas a recursos).
2. Agrega una tarjeta `<a class="game-card" href="./mi-juego/">` en `index.html`.
3. Si usa la base de datos, agrega su nodo a `firebase-rules.json` y publícalo en la consola de Firebase.
4. Push a `main` — el workflow despliega todo automáticamente.
