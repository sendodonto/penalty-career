// Teste de fumaça no navegador: cria carreira, joga disputas (teclado e mouse), recarrega e confere o salvamento.
// Uso: npm run smoke  (usa o Microsoft Edge instalado; BROWSER=chrome para o Chrome; SHOTS=pasta para capturas)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const snap = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const fail = (msg) => { console.error('FALHA:', msg); process.exitCode = 1; };

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: process.env.BROWSER ?? 'msedge' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:5199/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await snap(page, '01-menu');

  await page.click('[data-a="new"]');
  await page.fill('input[name="name"]', 'Rafael Duarte');
  await page.fill('input[name="number"]', '9');
  await page.click('[data-k="hair"][data-v="2"]');
  await page.click('[data-k="skin"][data-v="2"]');
  await snap(page, '02-create');
  await page.click('button[type="submit"]');
  await snap(page, '03-first-club');
  await page.click('[data-go]');
  await snap(page, '04-dashboard');

  const hint = () => page.locator('[data-hint]').textContent();
  const canvasPoint = async (x, y) => {
    const b = await page.locator('#canvas canvas').boundingBox();
    return { x: b.x + (x / 1280) * b.width, y: b.y + (y / 720) * b.height };
  };

  async function playMatch(n, useMouse) {
    await page.click('[data-a="play"]');
    if (n === 1) await snap(page, '05-prep');
    await page.click('[data-a="play"]');
    await page.waitForSelector('#stage:not([hidden]) canvas');
    let kicks = 0;
    const t0 = Date.now();
    while (!(await page.locator('.result-head').count())) {
      if (Date.now() - t0 > 180000) throw new Error('partida não terminou');
      const h = (await hint()) ?? '';
      if (h.includes('mirar')) {
        await page.waitForTimeout(350); // o jogo ignora confirmações nos primeiros 0,3 s de cada vez
        if (n === 1 && kicks === 0) await snap(page, '06-aim');
        if (useMouse && kicks === 0) {
          // zona 5 (inferior direito): 1º clique seleciona, 2º confirma
          const z = await canvasPoint(640 + 0.78 * 210, 372 - 0.18 * 150);
          await page.mouse.click(z.x, z.y);
          await page.waitForTimeout(150); // o Phaser lê o ponteiro uma vez por quadro: dois cliques no mesmo quadro viram um
          await page.mouse.click(z.x, z.y);
        } else {
          await page.keyboard.press(`Digit${1 + Math.floor(Math.random() * 5)}`);
          await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'KeyD');
          await page.keyboard.press('Space');
        }
        await page.waitForFunction(() => document.querySelector('[data-hint]')?.textContent?.includes('CHUTAR'), null, { timeout: 3000 });
        await page.waitForTimeout(200 + Math.random() * 900);
        if (n === 1 && kicks === 0) await snap(page, '07-power');
        if (useMouse && kicks === 0) {
          const k = await canvasPoint(776, 677);
          await page.mouse.click(k.x, k.y);
        } else await page.keyboard.press('Space');
        kicks++;
        await page.waitForTimeout(n === 1 && kicks === 1 ? 2400 : 1500);
        if (n === 1 && kicks === 1) await snap(page, '08-kick-result');
      } else {
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
      }
    }
    if (kicks < 3) fail(`apenas ${kicks} cobranças do usuário`);
    const score = await page.locator('.result-score').innerText();
    console.log(`Partida ${n}: ${kicks} cobranças do usuário, placar ${score.replace(/\s+/g, ' ')}`);
    if (n === 1) await snap(page, '09-result');
    await page.click('[data-a="back"]');
  }

  await playMatch(1, true);
  const saved1 = await page.evaluate(() => JSON.parse(localStorage.getItem('penalty-career/save')));
  if (saved1.saveVersion !== 2 || saved1.career.matchesPlayed !== 1 || saved1.career.calendar.length !== 9) fail('salvamento após a partida 1');
  if (saved1.career.money <= 250 || saved1.career.history.length !== 1) fail('recompensas não aplicadas');
  console.log(`Após partida 1: nível ${saved1.career.level}, XP ${saved1.career.xp}, $${saved1.career.money}, rep ${saved1.career.reputation}, pontos ${saved1.career.skillPoints}`);

  await page.click('[data-a="tab:player"]');
  if (saved1.career.skillPoints > 0) await page.click('[data-a="point:precision"]');
  const trainBtn = page.locator('[data-a="train:power"]');
  if (await trainBtn.isEnabled()) await trainBtn.click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('penalty-career/save')).career);
  console.log(`Atributos após ponto/treino: ${JSON.stringify(after.attributes)} (antes ${JSON.stringify(saved1.career.attributes)}), $${after.money}`);

  await playMatch(2, false);

  await page.reload();
  if (!(await page.locator('[data-a="continue"]').count())) fail('botão Continuar ausente após recarregar');
  await page.click('[data-a="continue"]');
  await page.click('[data-a="tab:career"]');
  const played = await page.locator('.career-nums b').first().innerText();
  if (played !== '2') fail(`partidas após recarregar = ${played}`);
  console.log('Recarregar + Continuar: OK, partidas =', played);

  // Loja: com saldo injetado, compra uma chuteira pela interface e confere o save
  await page.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('penalty-career/save'));
    f.career.money = 5000;
    localStorage.setItem('penalty-career/save', JSON.stringify(f));
  });
  await page.reload();
  await page.click('[data-a="continue"]');
  await page.click('[data-a="tab:shop"]');
  await snap(page, '10-shop');
  await page.click('[data-a="buy:boots-neon"]');
  const shop = await page.evaluate(() => JSON.parse(localStorage.getItem('penalty-career/save')).career);
  if (shop.money !== 3500 || shop.wardrobe?.equipped?.boots !== 'boots-neon') fail('compra na loja');
  else console.log('Loja: chuteira Neon comprada e equipada, saldo atualizado: OK');
  await page.click('[data-a="tab:overview"]');

  for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await snap(page, `10-dashboard-${w}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail(`rolagem horizontal em ${w}x${h}`);
  }
  await page.click('[data-a="play"]');
  await page.click('[data-a="play"]');
  await page.waitForFunction(() => document.querySelector('[data-hint]')?.textContent?.includes('mirar'));
  await snap(page, '11-match-1920');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await snap(page, '12-match-1280');

  // Fim de temporada: força o calendário encerrado com uma proposta e aceita a transferência
  await page.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('penalty-career/save'));
    f.career.calendar = [];
    f.career.offers = [
      { clubId: f.career.clubId, salary: 600, seasons: 2, renewal: true },
      { clubId: 'flamengo', salary: 1500, seasons: 3, renewal: false },
    ];
    localStorage.setItem('penalty-career/save', JSON.stringify(f));
  });
  await page.reload();
  await page.click('[data-a="continue"]');
  await snap(page, '14-season-end');
  await page.click('[data-a="sign:flamengo"]');
  const moved = await page.evaluate(() => JSON.parse(localStorage.getItem('penalty-career/save')).career);
  if (moved.clubId !== 'flamengo' || moved.season !== 2 || moved.age !== 19 || moved.contract.salary !== 1500 || moved.comps[0].name !== 'Brasileirão Série A') fail('transferência/nova temporada');
  else console.log('Fim de temporada + transferência para o Flamengo (Série A, contrato novo): OK');
  await snap(page, '15-new-club');

  await page.evaluate(() => localStorage.setItem('penalty-career/save', '{quebrado'));
  await page.reload();
  if (!(await page.locator('.warn').count())) fail('salvamento corrompido não detectado');
  await snap(page, '13-corrupt');
  await page.click('[data-a="delete"]');
  await page.click('.modal [data-v="1"]');
  if (await page.locator('[data-a="continue"], .warn').count()) fail('apagar carreira não limpou o estado');
  console.log('Salvamento corrompido detectado e apagado: OK');
} catch (e) {
  fail(e.stack ?? e);
} finally {
  if (errors.length) fail('erros no console:\n' + errors.join('\n'));
  else console.log('Console sem erros.');
  await browser.close();
  await server.close();
}
