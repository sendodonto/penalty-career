// Gera src/game/data/crests.ts com os links dos escudos reais (TheSportsDB, chave de teste pública).
// Uso: node scripts/fetch-crests.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const COUNTRY = { 'br-a': 'Brazil', 'br-b': 'Brazil', ar: 'Argentina', pt: 'Portugal', fr: 'France', de: 'Germany', it: 'Italy', es: 'Spain', en: 'England' };
// Nome de busca quando o nome do jogo (em português) difere do cadastro da API
const QUERY = {
  avai: 'Avai', gremio: 'Gremio', 'sao-paulo': 'Sao Paulo', 'atletico-mg': 'Atletico Mineiro', sport: 'Sport Recife',
  velez: 'Velez Sarsfield', racing: 'Racing Club', famalicao: 'Famalicao', 'vitoria-sc': 'Vitoria Guimaraes',
  sporting: 'Sporting CP', braga: 'SC Braga', marseille: 'Marseille', psg: 'Paris Saint Germain',
  frankfurt: 'Eintracht Frankfurt', stuttgart: 'VfB Stuttgart', bayern: 'Bayern Munich', milan: 'AC Milan',
  inter: 'Inter Milan', 'atletico-madrid': 'Atletico Madrid', newcastle: 'Newcastle United', tottenham: 'Tottenham Hotspur',
  lyon: 'Lyon', estudiantes: 'Estudiantes de La Plata', porto: 'Porto', lille: 'Lille OSC', athletic: 'Athletic Bilbao', gladbach: 'Borussia Monchengladbach', lens: 'Lens', roma: 'AS Roma', napoli: 'Napoli', valencia: 'Valencia', sevilla: 'Sevilla',
};

const src = readFileSync(new URL('../src/game/data/clubs.ts', import.meta.url), 'utf8');
const clubs = [...src.matchAll(/c\('([a-z0-9-]+)', (?:'([^']+)'|"([^"]+)"), '[^']*', '[^']*', '([a-z-]+)'/g)].map(([, id, n1, n2, league]) => ({ id, name: n1 ?? n2, league }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const file = new URL('../src/game/data/crests.ts', import.meta.url);
let out = {};
try { out = JSON.parse(readFileSync(file, 'utf8').match(/= (\{[\s\S]*\});/)[1]); } catch { /* primeira execução */ }
for (const cl of clubs) {
  if (out[cl.id]) continue; // já resolvido numa execução anterior
  const q = QUERY[cl.id] ?? cl.name;
  const url = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(q)}`;
  let res = await fetch(url);
  while (res.status === 429) { await sleep(20000); res = await fetch(url); }
  const teams = res.ok ? (await res.json()).teams ?? [] : [];
  const hit = teams.find((t) => t.strSport === 'Soccer' && t.strCountry === (cl.id === 'monaco' ? 'Monaco' : COUNTRY[cl.league]) && t.strBadge);
  if (hit) out[cl.id] = hit.strBadge + '/small';
  console.log(hit ? 'ok  ' : 'MISS', cl.id, '->', hit?.strTeam ?? `(${res.status}) ${teams.map((t) => t.strTeam + '/' + t.strCountry).join(', ')}`);
  await sleep(2100); // limite da chave gratuita: ~30 pedidos por minuto
}
writeFileSync(file,
  `// Gerado por scripts/fetch-crests.mjs: escudos reais (TheSportsDB). Clubes sem link usam o escudo desenhado.\nexport const CRESTS: Record<string, string> = ${JSON.stringify(out, null, 2)};\n`);
console.log(Object.keys(out).length, '/', clubs.length);
