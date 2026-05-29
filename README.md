# 🎮 Juegos QP

Monorepo con la colección de juegos web de QP. Cada juego vive en su propia carpeta y es completamente autónomo (HTML/CSS/JS + Firebase). Una página central (`index.html`) actúa como portal de bienvenida con acceso a cada juego.

**🔗 En vivo:** https://lrivas-qp.github.io/qp-games/

## Juegos

| Juego | Carpeta | Descripción |
|-------|---------|-------------|
| 🛑 **STOP!** | [`stop-game/`](./stop-game/) | El clásico Stop / Tutti Frutti multijugador en tiempo real. |
| ⌨️ **Typing Maniac** | [`typing-maniac/`](./typing-maniac/) | Escribe las palabras que caen antes de que lleguen al fondo. |

## Estructura

```
qp-games/
├── index.html              # Portal de bienvenida "Juegos QP"
├── .github/workflows/      # Despliegue unificado a GitHub Pages
├── stop-game/              # Juego STOP! (autónomo)
└── typing-maniac/          # Juego Typing Maniac (autónomo)
```

## Despliegue

El repositorio se publica automáticamente en GitHub Pages mediante GitHub Actions en cada push a `main`. La raíz del sitio sirve el portal; cada juego es accesible en su subruta:

- Portal: `/qp-games/`
- STOP!: `/qp-games/stop-game/`
- Typing Maniac: `/qp-games/typing-maniac/`

## Agregar un juego nuevo

1. Crea una carpeta con el juego autónomo (rutas relativas a recursos).
2. Agrega una tarjeta `<a class="game-card" href="./mi-juego/">` en `index.html`.
3. Push a `main` — el workflow despliega todo automáticamente.
