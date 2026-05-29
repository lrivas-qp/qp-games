const playwrightPath = 'C:\\Users\\lrivas\\AppData\\Roaming\\npm\\node_modules\\@playwright\\mcp\\node_modules\\playwright';
const { chromium } = require(playwrightPath);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const path = require('path');

const BASE_URL = 'https://lrivas-qp.github.io/stop-game/';
const SCREENSHOT_DIR = 'C:\\Users\\lrivas\\Documents\\stop-game\\';

const results = [];

function log(msg) {
  console.log(msg);
}

function pass(testName, detail) {
  results.push({ test: testName, status: 'PASS', detail });
  log(`✅ PASS: ${testName}${detail ? ' — ' + detail : ''}`);
}

function fail(testName, detail) {
  results.push({ test: testName, status: 'FAIL', detail });
  log(`❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  let roomCode = null;

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Create room and get share link
  // ─────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log('TEST 1: Crear sala y verificar botón "Compartir enlace"');
  log('═══════════════════════════════════════════');

  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();

  const consoleErrors1 = [];
  page1.on('console', msg => { if (msg.type() === 'error') consoleErrors1.push(msg.text()); });
  page1.on('pageerror', err => consoleErrors1.push('PAGE ERROR: ' + err.message));

  try {
    await page1.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Enter host name
    await page1.fill('#input-player-name', 'HostPlayer');

    // Click create room
    await page1.click('#btn-create-room');

    // Wait for Firebase
    await page1.waitForTimeout(6000);

    const lobbyState = await page1.evaluate(() => {
      const activeScreens = Array.from(document.querySelectorAll('.screen.active')).map(s => s.id);
      const roomCodeEl = document.getElementById('lobby-room-code');
      const shareBtn = document.getElementById('lobby-share-link-btn');
      return {
        activeScreens,
        roomCode: roomCodeEl ? roomCodeEl.textContent.trim() : null,
        shareBtnExists: !!shareBtn,
        shareBtnVisible: shareBtn ? getComputedStyle(shareBtn).display !== 'none' : false,
        shareBtnText: shareBtn ? shareBtn.textContent.trim() : null,
      };
    });

    log('Lobby state: ' + JSON.stringify(lobbyState, null, 2));

    const lobbyActive = lobbyState.activeScreens.includes('screen-lobby');
    if (!lobbyActive) {
      fail('Test 1 - Lobby visible', `Active screens: ${lobbyState.activeScreens.join(', ')}`);
    } else {
      pass('Test 1 - Lobby visible');
    }

    if (lobbyState.roomCode && lobbyState.roomCode.length > 0) {
      pass('Test 1 - Room code shown', lobbyState.roomCode);
      roomCode = lobbyState.roomCode;
    } else {
      fail('Test 1 - Room code shown', 'roomCode was empty or null');
    }

    if (lobbyState.shareBtnExists && lobbyState.shareBtnVisible) {
      pass('Test 1 - Botón "Compartir enlace" existe y es visible', lobbyState.shareBtnText);
    } else {
      fail('Test 1 - Botón "Compartir enlace" existe y es visible', `exists=${lobbyState.shareBtnExists}, visible=${lobbyState.shareBtnVisible}`);
    }

    // Try clicking the share button (to test it is clickable)
    if (lobbyState.shareBtnExists) {
      try {
        // Grant clipboard write permission
        await ctx1.grantPermissions(['clipboard-write', 'clipboard-read']);
        await page1.click('#lobby-share-link-btn');
        await page1.waitForTimeout(500);
        // Check if clipboard has expected content
        const clipboardText = await page1.evaluate(() => navigator.clipboard.readText().catch(() => 'CLIPBOARD_READ_ERROR'));
        log('Clipboard after share click: ' + clipboardText);
        if (clipboardText && clipboardText.includes('?room=')) {
          pass('Test 1 - Compartir enlace copia URL con ?room=', clipboardText);
        } else {
          fail('Test 1 - Compartir enlace copia URL con ?room=', 'Clipboard: ' + clipboardText);
        }
      } catch (e) {
        fail('Test 1 - Click en Compartir enlace', e.message);
      }
    }

    await page1.screenshot({ path: SCREENSHOT_DIR + 'screenshot-invite-1-lobby.png' });
    log('Screenshot guardado: screenshot-invite-1-lobby.png');

  } catch (e) {
    fail('Test 1 - General', e.message);
    log('Error: ' + e.stack);
  }

  if (consoleErrors1.length > 0) {
    log('\nErrores de consola en Test 1:');
    consoleErrors1.forEach(e => log('  - ' + e));
  }

  await ctx1.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Open invite URL without saved name
  // ─────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log('TEST 2: Abrir enlace de invitación SIN nombre guardado');
  log('═══════════════════════════════════════════');

  const testRoomCode = roomCode || 'ABCD-1234';
  const inviteURL = BASE_URL + '?room=' + testRoomCode;
  log('Invite URL: ' + inviteURL);

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();

  const consoleErrors2 = [];
  page2.on('console', msg => { if (msg.type() === 'error') consoleErrors2.push(msg.text()); });
  page2.on('pageerror', err => consoleErrors2.push('PAGE ERROR: ' + err.message));

  try {
    // Ensure no localStorage name
    await page2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page2.evaluate(() => localStorage.removeItem('stop_player_name'));

    // Now navigate to invite URL
    await page2.goto(inviteURL, { waitUntil: 'networkidle', timeout: 30000 });
    await page2.waitForTimeout(2000);

    const inviteState = await page2.evaluate((code) => {
      const roomInput = document.getElementById('input-room-code');
      const nameInput = document.getElementById('input-player-name');
      const inviteHint = document.getElementById('home-invite-hint');
      const activeScreens = Array.from(document.querySelectorAll('.screen.active')).map(s => s.id);
      return {
        activeScreens,
        roomInputValue: roomInput ? roomInput.value : null,
        nameInputValue: nameInput ? nameInput.value : null,
        inviteHintExists: !!inviteHint,
        inviteHintVisible: inviteHint ? getComputedStyle(inviteHint).display !== 'none' : false,
        inviteHintText: inviteHint ? inviteHint.textContent.trim() : null,
        localStorageName: localStorage.getItem('stop_player_name'),
      };
    }, testRoomCode);

    log('Invite state (no name): ' + JSON.stringify(inviteState, null, 2));

    // Verify room code pre-filled
    if (inviteState.roomInputValue === testRoomCode) {
      pass('Test 2 - Input de código prellenado', inviteState.roomInputValue);
    } else {
      fail('Test 2 - Input de código prellenado', `Expected "${testRoomCode}", got "${inviteState.roomInputValue}"`);
    }

    // Verify invite hint shown
    if (inviteState.inviteHintExists && inviteState.inviteHintVisible) {
      pass('Test 2 - Hint de invitación visible', inviteState.inviteHintText);
    } else {
      fail('Test 2 - Hint de invitación visible', `exists=${inviteState.inviteHintExists}, visible=${inviteState.inviteHintVisible}`);
    }

    // Verify no auto-join (should be on home screen)
    const onHome = inviteState.activeScreens.includes('screen-home');
    const notInLobby = !inviteState.activeScreens.includes('screen-lobby');
    if (onHome && notInLobby) {
      pass('Test 2 - No hizo auto-join (está en home screen)');
    } else {
      fail('Test 2 - No hizo auto-join (está en home screen)', `Active screens: ${inviteState.activeScreens.join(', ')}`);
    }

    await page2.screenshot({ path: SCREENSHOT_DIR + 'screenshot-invite-2-no-name.png' });
    log('Screenshot guardado: screenshot-invite-2-no-name.png');

  } catch (e) {
    fail('Test 2 - General', e.message);
    log('Error: ' + e.stack);
  }

  if (consoleErrors2.length > 0) {
    log('\nErrores de consola en Test 2:');
    consoleErrors2.forEach(e => log('  - ' + e));
  }

  await ctx2.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Open invite URL WITH name in localStorage
  // ─────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log('TEST 3: Abrir enlace de invitación CON nombre en localStorage');
  log('═══════════════════════════════════════════');

  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();

  const consoleErrors3 = [];
  page3.on('console', msg => { if (msg.type() === 'error') consoleErrors3.push(msg.text()); });
  page3.on('pageerror', err => consoleErrors3.push('PAGE ERROR: ' + err.message));

  try {
    // First, set localStorage on the origin
    await page3.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page3.evaluate(() => {
      localStorage.setItem('stop_player_name', 'InvitedPlayer');
    });

    // Now navigate to invite URL
    await page3.goto(inviteURL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for Firebase auto-join
    await page3.waitForTimeout(6000);

    const autoJoinState = await page3.evaluate(() => {
      const activeScreens = Array.from(document.querySelectorAll('.screen.active')).map(s => s.id);
      const lobbyPlayersList = document.getElementById('lobby-players-list');
      const localName = localStorage.getItem('stop_player_name');
      // Look for player name in lobby
      const playerItems = lobbyPlayersList
        ? Array.from(lobbyPlayersList.querySelectorAll('li, .player-item, [class*="player"]')).map(el => el.textContent.trim())
        : [];
      return {
        activeScreens,
        localStorageName: localName,
        playerItems,
        lobbyPlayersListHTML: lobbyPlayersList ? lobbyPlayersList.innerHTML : 'NOT FOUND',
      };
    });

    log('Auto-join state: ' + JSON.stringify(autoJoinState, null, 2));

    // Check if lobby screen is active (auto-joined)
    const inLobby = autoJoinState.activeScreens.includes('screen-lobby');
    if (inLobby) {
      pass('Test 3 - Auto-join exitoso (lobby screen activo)');
    } else {
      fail('Test 3 - Auto-join exitoso (lobby screen activo)', `Active screens: ${autoJoinState.activeScreens.join(', ')}`);
    }

    // Verify player name appears in lobby
    const nameFound = autoJoinState.playerItems.some(item => item.includes('InvitedPlayer'))
      || autoJoinState.lobbyPlayersListHTML.includes('InvitedPlayer');
    if (nameFound) {
      pass('Test 3 - Nombre "InvitedPlayer" aparece en el lobby');
    } else {
      fail('Test 3 - Nombre "InvitedPlayer" aparece en el lobby', 'Players list: ' + JSON.stringify(autoJoinState.playerItems));
    }

    await page3.screenshot({ path: SCREENSHOT_DIR + 'screenshot-invite-3-autojoin.png' });
    log('Screenshot guardado: screenshot-invite-3-autojoin.png');

  } catch (e) {
    fail('Test 3 - General', e.message);
    log('Error: ' + e.stack);
  }

  if (consoleErrors3.length > 0) {
    log('\nErrores de consola en Test 3:');
    consoleErrors3.forEach(e => log('  - ' + e));
  }

  await ctx3.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Name pre-filled from localStorage on fresh load
  // ─────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log('TEST 4: Nombre prellenado desde localStorage en nueva sesión');
  log('═══════════════════════════════════════════');

  const ctx4 = await browser.newContext();
  const page4 = await ctx4.newPage();

  const consoleErrors4 = [];
  page4.on('console', msg => { if (msg.type() === 'error') consoleErrors4.push(msg.text()); });
  page4.on('pageerror', err => consoleErrors4.push('PAGE ERROR: ' + err.message));

  try {
    // First load to set localStorage
    await page4.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page4.evaluate(() => {
      localStorage.setItem('stop_player_name', 'SavedPlayer');
    });

    // Reload to check if name is pre-filled
    await page4.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page4.waitForTimeout(1000);

    const nameState = await page4.evaluate(() => {
      const nameInput = document.getElementById('input-player-name');
      const localName = localStorage.getItem('stop_player_name');
      return {
        nameInputValue: nameInput ? nameInput.value : null,
        localStorageName: localName,
        activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(s => s.id),
      };
    });

    log('Name pre-fill state: ' + JSON.stringify(nameState, null, 2));

    if (nameState.nameInputValue === 'SavedPlayer') {
      pass('Test 4 - Nombre prellenado desde localStorage', nameState.nameInputValue);
    } else {
      fail('Test 4 - Nombre prellenado desde localStorage', `Expected "SavedPlayer", got "${nameState.nameInputValue}"`);
    }

    await page4.screenshot({ path: SCREENSHOT_DIR + 'screenshot-invite-4-prefill.png' });
    log('Screenshot guardado: screenshot-invite-4-prefill.png');

  } catch (e) {
    fail('Test 4 - General', e.message);
    log('Error: ' + e.stack);
  }

  if (consoleErrors4.length > 0) {
    log('\nErrores de consola en Test 4:');
    consoleErrors4.forEach(e => log('  - ' + e));
  }

  await ctx4.close();

  // ─────────────────────────────────────────────────────────────
  // Final summary
  // ─────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log('RESUMEN DE RESULTADOS');
  log('═══════════════════════════════════════════');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    log(`${icon} ${r.test}${r.detail ? ': ' + r.detail : ''}`);
  });
  log(`\nTotal: ${passed} passed, ${failed} failed`);
  log('Room code used: ' + (roomCode || 'N/A (fallback ABCD-1234)'));

  await browser.close();

  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Fatal error in test suite:', err.message);
  console.error(err.stack);
  process.exit(1);
});
