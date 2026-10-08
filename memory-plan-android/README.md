# MemoryPlan offline (Android)

APK de kiosco que abre el juego de `memory-plan/` desde archivos locales. No usa GitHub Pages, ni localhost, ni Firebase, ni analítica. El manifiesto no pide permiso de internet.

El ranking se guarda solo en `localStorage` del WebView (`qp-memoryplan-ranking`), en el almacenamiento privado de la app. El juego detecta el host `appassets.androidplatform.net` y no importa Firebase ni abre red. `syncWebAssets` deja fuera `firebase-config.js`. Sigue ahí al cerrar la app y al actualizar, siempre que no se desinstale ni se borren los datos.

`MainActivity` deja `domStorageEnabled` en true, no llama a `clearCache` / `clearData` / `deleteAllData`, y al pausar reescribe la clave para que Chromium vuelque el almacenamiento. El origen https virtual no cambia entre versiones: el `applicationId` sigue siendo `cl.queplan.memoryplan`.

## Compilar

Requisitos en la máquina de build (no en el tótem):

- JDK 17
- Android SDK con `platforms;android-35` y `build-tools;35.0.0`
- Variables `JAVA_HOME` y `ANDROID_HOME` (o `sdk.dir` en `local.properties`)

Desde esta carpeta:

```bash
./gradlew :app:syncWebAssets
./gradlew :app:assembleDebug
./gradlew :app:copyOfflineApk
```

En Windows, si el script de shell no arranca, usa `gradlew.bat` con los mismos argumentos.

`syncWebAssets` corre sola antes de `preBuild`. Copia `../memory-plan` a `app/src/main/assets`, sin el README, sin las pruebas y sin `firebase-config.js`. Esos assets son generados: no hace falta editarlos a mano. El origen https virtual `https://appassets.androidplatform.net/` (WebViewAssetLoader) permite que `localStorage` funcione sin abrir `file://` ni acceso universal entre archivos. Ese origen es el que la página usa para quedarse en el ranking local.

## Dónde queda el APK

- Build directo: `memory-plan-android/app/build/outputs/apk/debug/app-debug.apk`
- Copia lista para el tótem: `dist/MemoryPlan-offline.apk`

Es un APK debug, firmado con el keystore de depuración de Android (en el perfil del usuario, fuera de este repositorio).

## Instalar en el tótem

Con el tótem conectado por USB y la depuración USB activa:

```bash
adb install -r dist/MemoryPlan-offline.apk
```

Sin cable: copia `dist/MemoryPlan-offline.apk` al equipo y ábrelo. En Ajustes hay que permitir la instalación desde esa fuente (orígenes desconocidos / instalar apps desconocidas).

La app se llama **MemoryPlan**. El id es `cl.queplan.memoryplan`. Queda en vertical, a pantalla completa, con la pantalla encendida. Un solo Atrás no cierra; el segundo dentro de dos segundos sale.

## Actualizar sin perder el ranking

Usa el mismo `applicationId` y reinstala encima:

```bash
adb install -r dist/MemoryPlan-offline.apk
```

No desinstales la app y no uses “Borrar datos” ni “Borrar caché”. `adb install -r` reemplaza el APK y conserva el almacenamiento del WebView, donde vive el ranking. Desinstalar lo borra.

## Sin internet

El APK no declara `android.permission.INTERNET`. Los HTML, CSS, JS y SVG van dentro del paquete. En modo avión el juego y el ranking local siguen funcionando. La navegación http/https hacia otros sitios queda bloqueada; solo se sirven los assets empaquetados.
