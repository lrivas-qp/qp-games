# Typing Maniac - Juego Web de Mecanografia

Juego arcade de mecanografia: escribe las palabras que caen antes de que lleguen al fondo. Inspirado en el clasico Typing Maniac, con niveles de dificultad creciente, comodines y un ranking online global. No requiere instalacion ni cuenta de usuario — se juega desde cualquier navegador.

---

## Configuracion rapida

### Paso 1: Obtener credenciales de Firebase

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/settings/general](https://console.firebase.google.com/project/stop-game-4f8e3/settings/general)
2. En la seccion **"Tus apps"**, haz click en el icono **`</>`** (Agregar app web si aun no hay ninguna)
3. Copia el objeto `firebaseConfig` que aparece en el fragmento de codigo
4. Abre el archivo `firebase-config.js` y reemplaza los valores placeholder por los de tu proyecto (`apiKey`, `messagingSenderId`, `appId`, etc.)

### Paso 2: Habilitar Realtime Database

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/database](https://console.firebase.google.com/project/stop-game-4f8e3/database)
2. Haz click en **"Crear base de datos"**
3. Selecciona **"Comenzar en modo de prueba"** (test mode) y confirma

### Paso 3: Aplicar reglas de seguridad

1. En la consola de Firebase, ve a **Realtime Database → Reglas**
2. Asegurate de permitir lectura/escritura en el nodo de rankings:

   ```json
   {
     "rules": {
       "typing-maniac": {
         "rankings": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
3. Haz click en **"Publicar"**

> Nota: este juego comparte el mismo proyecto Firebase que **STOP!** (`stop-game-4f8e3`). Si usas la misma base de datos, combina estas reglas con las del nodo `rooms` del otro juego en un solo bloque `rules`.

### Paso 4: Desplegar en GitHub Pages

Este juego vive dentro del monorepo **[qp-games](https://github.com/lrivas-qp/qp-games)** y se publica automaticamente con GitHub Actions en cada push a `main`.

Disponible en: **https://lrivas-qp.github.io/qp-games/typing-maniac/**

> Nota: GitHub Pages puede tardar 1-2 minutos en desplegar la primera vez.

---

## Como jugar

### Objetivo

Escribe las palabras que van cayendo antes de que toquen el fondo. **Cada palabra que llega al fondo cuesta una vida** — empiezas con **3 vidas** y el juego termina al perderlas todas.

### Controles

- **Teclas alfabeticas**: escriben en el buffer; se resalta automaticamente la palabra que coincide (priorizando la mas cercana al fondo). Al completarla, se destruye y suma puntos.
- **[BACKSPACE]**: borra el ultimo caracter del buffer.

### Comodines (cajita de la derecha)

- De vez en cuando, una palabra normal aparece **iluminada con el color de un comodin**.
- Al escribir esa palabra, **capturas** el comodin: se guarda en la **cajita** (apila hasta **5**).
- Para **usar** un comodin guardado, escribe su **palabra clave**:

  | Comodin | Palabra clave | Efecto |
  |---------|---------------|--------|
  | 🔥 Fuego Arcano | `fuego` | Destruye todas las palabras en pantalla y suma sus puntos |
  | ❄️ Tiempo Congelado | `frio` | Congela la caida de palabras por unos segundos |
  | ⏳ Camara Lenta | `lento` | Ralentiza la caida temporalmente |
  | 💚 Vida Extra | `cura` | Recupera una vida |
  | ⭐ Puntos Extra | `bonus` | Otorga puntos extra |

### Niveles y puntuacion

- Subes de nivel al escribir suficientes palabras (la dificultad y velocidad aumentan con cada nivel).
- Los puntos por palabra dependen de su longitud y del nivel actual: palabras mas largas y niveles mas altos valen mas.
- Al terminar la partida puedes **guardar tu puntuacion** con tu nombre y aparecer en el **Top 10** global.

---

## Estructura del proyecto

```
typing-maniac/
├── index.html           # Interfaz del juego (HTML + estructura)
├── style.css            # Estilos visuales
├── app.js               # Logica del juego (caida, escritura, comodines, niveles)
├── firebase-config.js   # Conexion a Firebase y funciones de ranking (saveScore / getTopTen)
└── README.md            # Este archivo
```

---

## Notas tecnicas

- **Compatibilidad**: funciona en cualquier navegador moderno (Chrome, Firefox, Safari, Edge)
- **Sin instalacion**: no requiere Node.js, npm ni servidor propio — es HTML/CSS/JS puro
- **Game loop**: usa `requestAnimationFrame` para la caida y deteccion de colisiones
- **Ranking online**: usa Firebase Realtime Database; las puntuaciones se guardan en `typing-maniac/rankings` con clave derivada del nombre (mismo nombre sobreescribe, sin duplicados)
- **GitHub Pages**: al ser un sitio estatico, GitHub Pages lo sirve sin costo adicional con HTTPS incluido
