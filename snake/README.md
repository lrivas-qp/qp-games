# Snake - Juego Web de la Culebrita

El clásico juego de la serpiente: come, crece y sobrevive sin chocar contigo mismo ni con los bordes. Cuanto más comes, más rápido vas. Incluye ranking online global. Standalone (HTML/CSS/JS puro), se juega desde cualquier navegador.

---

## Configuracion rapida

### Paso 1: Obtener credenciales de Firebase

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/settings/general](https://console.firebase.google.com/project/stop-game-4f8e3/settings/general)
2. En la seccion **"Tus apps"**, copia el objeto `firebaseConfig`
3. Abre `firebase-config.js` y reemplaza los valores placeholder por los de tu proyecto

### Paso 2: Habilitar Realtime Database

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/database](https://console.firebase.google.com/project/stop-game-4f8e3/database)
2. **"Crear base de datos"** → modo de prueba

### Paso 3: Aplicar reglas de seguridad

En **Realtime Database → Reglas**, permite lectura/escritura en el nodo de rankings:

```json
{
  "rules": {
    "snake": {
      "rankings": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> Nota: este juego comparte el mismo proyecto Firebase que los demas juegos de **qp-games**. Combina estas reglas con las de los otros nodos (`rooms`, `typing-maniac`, etc.) en un solo bloque `rules`.

### Paso 4: Desplegar en GitHub Pages

Vive dentro del monorepo **[qp-games](https://github.com/lrivas-qp/qp-games)** y se publica automaticamente con GitHub Actions en cada push a `main`.

Disponible en: **https://lrivas-qp.github.io/qp-games/snake/**

---

## Como jugar

- **Objetivo**: come la comida roja para crecer y sumar puntos. Evita chocar con los bordes o con tu propio cuerpo.
- **Controles**: flechas del teclado o **WASD**. En pantalla tactil, usa la cruceta o desliza el dedo (swipe) sobre el tablero. No se puede girar 180 grados de un golpe.
- **Velocidad**: cada pocas comidas la serpiente acelera (sube el indicador SPEED).
- **Puntuacion**: +10 puntos por comida. Al perder puedes guardar tu puntuacion con tu nombre y entrar al **Top 10** global.
- Tu mejor marca local se guarda en el indicador **BEST**.

---

## Uso en totem (pantalla tactil)

Pensado para un totem vertical (tipico **1080x1920**) y tambien para escritorio y movil. El tablero queda arriba y la cruceta abajo, visible sin hacer scroll.

- La cruceta aparece sola si el navegador reporta puntero grueso (`pointer: coarse`), sin hover (`hover: none`) o puntos de contacto (`navigator.maxTouchPoints > 0`).
- Algunos totems informan un puntero fino y la cruceta no sale. Forzala con el parametro **`?touch=1`**:
  `https://lrivas-qp.github.io/qp-games/snake/?touch=1`
- Para esconderla (PC con pantalla tactil que se juega con teclado): **`?touch=0`**.
- Cada tecla de la cruceta es grande (unos 150–180 px en el totem). Tambien siguen valiendo las flechas, WASD y el swipe sobre el tablero.

---

## Estructura del proyecto

```
snake/
├── index.html           # Interfaz del juego
├── style.css            # Estilos visuales
├── app.js               # Logica del juego (movimiento, colisiones, render en canvas)
├── firebase-config.js   # Conexion a Firebase y funciones de ranking (saveScore / getTopTen)
└── README.md            # Este archivo
```

---

## Notas tecnicas

- **Compatibilidad**: cualquier navegador moderno (Chrome, Firefox, Safari, Edge)
- **Sin instalacion**: HTML/CSS/JS puro, sin Node.js ni build
- **Render**: `<canvas>` redibujado con `requestAnimationFrame`, grilla de 21x21
- **Ranking online**: Firebase Realtime Database; las puntuaciones se guardan en `snake/rankings` con clave derivada del nombre (sin duplicados)
- **GitHub Pages**: sitio estatico servido con HTTPS sin costo adicional
