const playwrightPath = 'C:\\Users\\lrivas\\AppData\\Roaming\\npm\\node_modules\\@playwright\\mcp\\node_modules\\playwright';
const { chromium } = require(playwrightPath);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const URL = 'https://lrivas-qp.github.io/stop-game/';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400, executablePath: CHROME_PATH });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleAll = [];
  page.on('console', msg => {
    consoleAll.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  console.log('Abriendo', URL);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Verificar estado inicial
  const initState = await page.evaluate(() => {
    const overlay = document.getElementById('loading-overlay');
    const homeErr = document.getElementById('home-error');
    return {
      overlayDisplay: getComputedStyle(overlay).display,
      overlayClass: overlay.className,
      homeErrDisplay: getComputedStyle(homeErr).display,
      activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(s => s.id),
    };
  });
  console.log('Estado inicial:', JSON.stringify(initState, null, 2));

  // Ingresar nombre
  await page.fill('#input-player-name', 'TestPlayer');
  await page.screenshot({ path: 'screenshot-1-home.png' });
  console.log('Screenshot 1: Home con nombre rellenado');

  // Hacer clic en Crear sala nueva
  console.log('Haciendo clic en Crear sala nueva...');
  await page.click('#btn-create-room');

  // Esperar (puede tardar por Firebase)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshot-2-after-create.png' });

  const afterCreate = await page.evaluate(() => {
    const overlay = document.getElementById('loading-overlay');
    const configSection = document.getElementById('config-section');
    const btnStart = document.getElementById('btn-start-game');
    const lobbyCRoomCode = document.getElementById('lobby-room-code');
    const btnStop = document.getElementById('btn-stop');
    return {
      activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(s => s.id),
      overlayDisplay: getComputedStyle(overlay).display,
      configSectionDisplay: getComputedStyle(configSection).display,
      configSectionClass: configSection.className,
      btnStartDisplay: getComputedStyle(btnStart).display,
      btnStartClass: btnStart.className,
      lobbyRoomCode: lobbyCRoomCode ? lobbyCRoomCode.textContent : 'NOT FOUND',
    };
  });
  console.log('Estado después de Crear sala:', JSON.stringify(afterCreate, null, 2));

  if (consoleErrors.length > 0) {
    console.log('\n=== ERRORES DE CONSOLA ===');
    consoleErrors.forEach(e => console.log(' -', e));
  } else {
    console.log('\nSin errores de consola de tipo "error".');
  }

  if (consoleAll.length > 0) {
    console.log('\n=== TODO CONSOLE ===');
    consoleAll.forEach(e => console.log(' -', e));
  }

  console.log('\nCerrando en 5s...');
  await page.waitForTimeout(5000);
  await browser.close();
})().catch(err => {
  console.error('Error en test:', err.message);
  process.exit(1);
});
