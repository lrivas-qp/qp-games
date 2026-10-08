# MemoryPlan

Juego de memoria de QuePlan para un tótem vertical (1080×1920), sin internet. Hay que encontrar las 8 parejas. El cronómetro parte al voltear la primera carta y se detiene al completar el tablero.

La página es una sola: el juego ocupa la pantalla y el ranking (`#ranking`) queda debajo. «VER RANKING» baja hasta esa sección.

## Cómo jugar

- Toca una carta para voltearla. La segunda cierra el intento.
- Si coinciden, el par queda abierto con borde verde menta.
- Si no coinciden, el borde se pone rojo, las cartas se sacuden y vuelven a taparse.
- Arriba se lee cuántas parejas van (`0 DE 8 PAREJAS`) y **REINICIAR** arma un tablero nuevo.
- Al completar las 8, se abre un cartel. El nombre se escribe con el teclado en pantalla (máximo 16 caracteres) y recién ahí se guarda el tiempo.
- Si se cierra el cartel sin nombre, el tiempo no entra al ranking.
- Entran los 6 mejores tiempos. Si todavía no hay puntajes, el scoreboard queda vacío.

## Instalar en el tótem

1. Copia la carpeta `memory-plan` al equipo. No necesita red: las letras son las del sistema (Arial, Arial Nova, Segoe UI) y no carga fuentes externas.
2. Ábrela en Chrome a pantalla completa.
3. El ranking vive en `localStorage` de ese navegador, clave `qp-memoryplan-ranking`. No se sincroniza con otros equipos.
4. Si alguien deja una partida a medias, el tablero se reinicia solo a los 90 segundos. Con el cartel de victoria abierto, a los 35 segundos vuelve un tablero nuevo y, si no había nombre, no se guarda nada.
5. Para borrar el ranking del evento, en el pie del scoreboard toca **Vaciar ranking** dos veces.

Ejemplo de kiosco en Windows:

```
chrome --kiosk --autoplay-policy=no-user-gesture-required "file:///C:/ruta/memory-plan/index.html"
```

## Estructura

```
memory-plan/
├── index.html
├── style.css
├── app.js
├── assets/          # Íconos SVG del tablero y la lupa del reverso
└── README.md
```

En 1080×1920 el juego llena la pantalla. En un monitor más ancho el fondo sigue de lado a lado y el contenido se mantiene al ancho del tótem.

## Origen

Interfaces de Daniel Carranza (8 de octubre de 2026), alineadas a la maqueta de MemoryPlan: header, cronómetro, grilla 4×4, acierto y error, cartel de victoria y scoreboard. El nombre y el ranking local se mantienen porque el tótem es compartido y no tiene internet.
