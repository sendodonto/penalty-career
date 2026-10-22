// Teste de fumaça como celular: só toques, jogando em pé e girando no meio da partida.
// Uso: npm run smoke:mobile (SHOTS=pasta para capturas)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const snap = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const fail = (msg) => { console.error('FALHA:', msg); process.exitCode = 1; };
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

const server = await createServer({ server: { port: 5195, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: process.env.BROWSER ?? 'msedge' });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: PORTRAIT, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:5195/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (!(await page.evaluate(() => matchMedia('(pointer: coarse)').matches))) fail('emulação de toque inativa');
  const tapEl = (sel) => page.locator(sel).first().tap();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  await page.waitForTimeout(600);
  await snap(page, 'm01-menu');
  await tapEl('[data-a="new"]');
  await page.locator('input[name="name"]').fill('Lia Torres');
  await tapEl('[data-k="hair"][data-v="3"]');
  await tapEl('button[type="submit"]');
  await tapEl('[data-go]');
  await snap(page, 'm02-dashboard');
  if (await overflow()) fail('rolagem horizontal no painel');
  await tapEl('[data-a="play"]');
  await tapEl('[data-a="play"]');
  await page.waitForSelector('#stage:not([hidden]) canvas');

  // Raid aleatório no meio da disputa: joga a partida especial, volta à Terra e segue a disputa original
  const matchOver = async () => {
    if (!(await page.locator('.result-head:visible').count())) return false;
    if (!(await page.locator('[data-a="back"]:visible', { hasText: 'Voltar à Terra' }).count())) return true;
    console.log('Raid durante a partida: voltando à Terra');
    await page.click('[data-a="back"]');
    await page.waitForTimeout(600);
    return false;
  };
  const hint = async () => (await page.locator('[data-hint]').textContent()) ?? '';
  /** Mundo 1280x720 -> tela, nos dois enquadramentos da câmera (ver PenaltyScene.applyLayout). */
  const at = async (x, y) => {
    const b = await page.locator('#canvas canvas').boundingBox();
    if (b.height > b.width) {
      const k = b.width / 560;
      const top = 425 - b.height / k / 2;
      return [b.x + (x - 360) * k, b.y + (y - top) * k];
    }
    return [b.x + (x / 1280) * b.width, b.y + (y / 720) * b.height];
  };
  const tapWorld = async (x, y) => page.touchscreen.tap(...(await at(x, y)));

  let kicks = 0;
  let defenses = 0;
  let rotated = false;
  const t0 = Date.now();
  while (!(await matchOver())) {
    if (Date.now() - t0 > 420000) throw new Error('partida não terminou');
    const h = await hint();
    if (h.includes('Toque na zona')) {
      await page.waitForTimeout(350);
      if (kicks === 0) await snap(page, 'm03-aim-portrait');
      await tapWorld(640 + 0.78 * 210, 372 - 0.18 * 150); // um toque: mira na zona 5 e inicia a barra
      await page.waitForFunction(() => document.querySelector('[data-hint]')?.textContent?.includes('Toque na tela'), null, { timeout: 3000 });
      await page.waitForTimeout(250 + Math.random() * 700);
      if (kicks === 0) await snap(page, 'm04-power-portrait');
      await tapWorld(kicks % 2 ? 640 : 520, kicks % 2 ? 880 : 470); // botão CHUTAR ou qualquer ponto
      kicks++;
      await page.waitForTimeout(1600);
      if (kicks === 1) await snap(page, 'm05-kick-portrait');
    } else if (h.includes('VOCÊ NO GOL')) {
      const before = await page.locator('[data-dots="b"] li.hit, [data-dots="b"] li.miss').count();
      if (!rotated && defenses === 1) {
        // Gira para deitado no meio da partida e volta: o layout se refaz sem perder o estado.
        await page.setViewportSize(LANDSCAPE);
        await page.waitForTimeout(400);
        await snap(page, 'm06-landscape');
        await page.setViewportSize(PORTRAIT);
        await page.waitForTimeout(300);
        rotated = true;
      }
      await page.waitForTimeout(1800);
      await tapWorld([470, 640, 810][defenses % 3], 300);
      if (defenses === 0) await snap(page, 'm07-guard-portrait');
      defenses++;
      await page.waitForFunction((n) => document.querySelectorAll('[data-dots="b"] li.hit, [data-dots="b"] li.miss').length > n, before, { timeout: 20000 });
      await page.waitForTimeout(500);
      if (defenses === 1) await snap(page, 'm08-defense-result');
    } else {
      await tapWorld(640, 520);
      await page.waitForTimeout(450);
    }
  }
  console.log(`Partida em pé: ${kicks} cobranças e ${defenses} defesas por toque; placar ${(await page.locator('.result-score').innerText()).replace(/\s+/g, ' ')}`);
  if (!rotated) console.log('(a partida acabou antes do teste de girar)');
  await snap(page, 'm09-result');
  await tapEl('[data-a="back"]');
  if (await overflow()) fail('rolagem horizontal no painel após a partida');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('penalty-career/save')).career.matchesPlayed);
  if (saved !== 1) fail(`partidas salvas = ${saved}`);
  else console.log('Carreira salva após a partida no celular: OK');
} catch (e) {
  fail(e.stack ?? e);
} finally {
  if (errors.length) fail('erros no console:\n' + errors.join('\n'));
  else console.log('Console sem erros.');
  await browser.close();
  await server.close();
}
