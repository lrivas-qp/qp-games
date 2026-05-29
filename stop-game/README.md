# Stop / Bachillerato - Juego Web Multijugador

Juego clásico de Stop (también conocido como Bachillerato) para jugar en tiempo real con hasta 14 jugadores desde cualquier navegador. No requiere instalación ni cuenta de usuario — basta con compartir el código de sala.

---

## Configuracion rapida

### Paso 1: Obtener credenciales de Firebase

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/settings/general](https://console.firebase.google.com/project/stop-game-4f8e3/settings/general)
2. En la seccion **"Tus apps"**, haz click en el icono **`</>`** (Agregar app web si aun no hay ninguna)
3. Copia el objeto `firebaseConfig` que aparece en el fragmento de codigo
4. Abre el archivo `firebase-config.js` y reemplaza los valores placeholder:
   - `TU_API_KEY_AQUI` → tu `apiKey`
   - `TU_MESSAGING_SENDER_ID` → tu `messagingSenderId`
   - `TU_APP_ID` → tu `appId`

### Paso 2: Habilitar Realtime Database

1. Ve a [https://console.firebase.google.com/project/stop-game-4f8e3/database](https://console.firebase.google.com/project/stop-game-4f8e3/database)
2. Haz click en **"Crear base de datos"**
3. Selecciona **"Comenzar en modo de prueba"** (test mode) y confirma

### Paso 3: Aplicar reglas de seguridad

1. En la consola de Firebase, ve a **Realtime Database → Reglas**
2. Borra el contenido actual y pega estas reglas:

   ```json
   {
     "rules": {
       "rooms": {
         "$roomCode": {
           ".read": true,
           ".write": true,
           "players": {
             "$playerId": {
               ".validate": "newData.hasChildren(['name', 'isHost', 'connected'])"
             }
           }
         }
       }
     }
   }
   ```
3. Haz click en **"Publicar"**

### Paso 4: Desplegar en GitHub Pages

```bash
# Desde la carpeta del proyecto
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/lrivas-qp/stop-game.git
git push -u origin main
```

Luego en GitHub:

1. Ve al repositorio → **Settings → Pages**
2. En **Source**, selecciona `Deploy from a branch`
3. Rama: `main` | Carpeta: `/ (root)`
4. Haz click en **Save**

Tu juego estara disponible en: **https://lrivas-qp.github.io/stop-game/**

> Nota: GitHub Pages puede tardar 1-2 minutos en desplegar la primera vez.

---

## Como jugar

### Preparacion

1. El **host** abre el juego y hace click en **"Crear sala"**
2. Se genera un **codigo de sala** de 4 letras — compartelo con los demas jugadores (WhatsApp, chat, etc.)
3. Los **hasta 14 jugadores** ingresan el codigo y su nombre para unirse
4. El host configura la partida:
   - **Categorias**: Nombre, Animal, Fruta, Color, Pais, etc. (personalizables)
   - **Letras disponibles**: cuales letras pueden salir en el juego
   - **Numero de rondas**
   - **Tiempo por ronda** (en segundos)

### Desarrollo de una ronda

1. El host inicia la ronda
2. Se revela la **letra de la ronda** con un countdown de 3 segundos
3. Todos los jugadores comienzan a llenar las categorias con palabras que empiecen con esa letra
4. El juego se detiene cuando:
   - Un jugador completa **todas** las categorias y presiona **STOP** (detiene el juego para todos), o
   - Se **acaba el tiempo** (el juego para automaticamente)

### Validacion de respuestas

- Se revisa **categoria por categoria**, con **10 segundos** por categoria
- Cada jugador puede ver las respuestas de todos
- Se vota por cada respuesta: pulgar arriba (valida) o pulgar abajo (invalida)
- La **mayoria simple** decide si una respuesta cuenta o no

### Puntuacion

| Situacion | Puntos |
|-----------|--------|
| Respuesta unica valida (nadie mas la tuvo) | **100 pts** |
| Respuesta compartida valida (otro jugador tuvo lo mismo) | **50 pts** |
| Respuesta invalida o en blanco | **0 pts** |

Gana quien acumule mas puntos al final de todas las rondas.

---

## Estructura del proyecto

```
stop-game/
├── index.html           # Interfaz del juego (HTML + estructura)
├── style.css            # Estilos visuales
├── app.js               # Logica del juego y sincronizacion con Firebase
├── firebase-config.js   # COMPLETAR con tus credenciales de Firebase
└── README.md            # Este archivo
```

---

## Notas tecnicas

- **Compatibilidad**: funciona en cualquier navegador moderno (Chrome, Firefox, Safari, Edge)
- **Sin instalacion**: no requiere Node.js, npm ni servidor propio — es HTML/CSS/JS puro
- **Sincronizacion en tiempo real**: usa Firebase Realtime Database con websockets; los cambios se propagan a todos los jugadores en milisegundos
- **Capacidad**: soporta 14+ jugadores simultaneos dentro del plan gratuito (Spark) de Firebase, que incluye 1 GB de almacenamiento y 10 GB/mes de transferencia
- **Seguridad**: las reglas de Realtime Database (ver Paso 3) permiten lectura/escritura solo dentro de salas validas, con validacion de estructura de jugadores
- **GitHub Pages**: al ser un sitio estatico, GitHub Pages lo sirve sin costo adicional con HTTPS incluido
