# Penalty Career

Jogo 2D de carreira de futebol em que toda partida é uma disputa de pênaltis. Vite + TypeScript + Phaser 3, menus em HTML/CSS, salvamento em LocalStorage.

**Jogar online:** https://sendodonto.github.io/penalty-career/ (publicado pelo workflow `.github/workflows/pages.yml` a cada push na `main`).

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # checagem de tipos + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173
npm test           # testes unitários (regras da disputa, cobrança, carreira, salvamento)
npm run smoke      # teste E2E no Microsoft Edge instalado (BROWSER=chrome para usar o Chrome)
```

## Carreira

- 72 clubes reais em 9 ligas (Brasileirão Séries A e B, Argentina, Portugal, França, Alemanha, Itália, Espanha e Inglaterra), com escudos desenhados pelo jogo a partir das cores dos clubes.
- Cada temporada: liga (8 clubes, turno único), copa nacional (mata-mata) e, para quem termina entre os 2 primeiros ou vence a copa, Libertadores ou Liga dos Campeões. Acesso e rebaixamento entre as Séries A e B.
- Seleção: Copa do Mundo a cada 4 temporadas (grupos + mata-mata) e Copa América/Eurocopa no meio do ciclo, só com convocação (overall 60 ou reputação 45).
- Janela de transferências ao fim da temporada: propostas com salário por jogo e duração do contrato, ou renovação.
- Salvamento versionado (v2); carreiras da v1 são migradas automaticamente.

## Loja e eventos

- Painel da carreira com abas: Visão geral, Jogador, Competições, Loja e Carreira.
- Loja com o dinheiro do salário: chuteiras (as raras dão +1/+2 em atributos), segunda pele, meião baixo, faixa, munhequeira, luvas, cordão, braçadeira de capitão e comemorações de gol. Tudo aparece no jogador durante as partidas.
- Clima por partida (chuva, neve na Europa, neblina) com efeito leve no jogo, e imprevistos raros entre as cobranças (no máximo um por partida): invasão de campo, cachorro no gramado, apagão e **raids**.
- **Raids:** uma nave abduz o seu jogador no meio da disputa para uma partida especial: Raid Alienígena (Marte, Marcianos FC), Raid Ciborgue (Estação Orbital Ômega, Ciborgues United), Raid Canino (Planeta Latido, Matilha FC) e Raid Felino (Miaulópolis, Miau United). Vencer dá troféu, dinheiro e XP; depois você volta à Terra e a disputa original continua de onde parou.
- Em `npm run dev`, `window.__forceWeather = 'rain'`, `window.__forceIncident = 'raid'` e `window.__forceRaid = 'mars'` forçam clima e eventos para testes (não existem no build de produção).

## Jogar no celular

```bash
npm run dev:mobile   # expõe o jogo na rede local
```

Com o celular no mesmo Wi-Fi do PC, abra `http://<IP-do-PC>:5173` (o endereço aparece no terminal como "Network"). Dá para jogar em pé (a câmera fecha no lance e usa a tela inteira) ou deitado (16:9). "Adicionar à tela inicial" abre em tela cheia.

No toque: um toque na zona do gol mira e inicia a barra; um toque em qualquer lugar da tela chuta; no gol, toque o lado para onde a bola vai. `npm run smoke:mobile` testa esse fluxo emulando um celular em pé.

## Controles da cobrança

| Tecla | Ação |
|---|---|
| A / D ou ← / → | Escolher a zona |
| 1 a 5 | Zona direta (inf. esq., ângulo esq., centro, ângulo dir., inf. dir.) |
| Clique na zona | Seleciona; clicar de novo confirma |
| Espaço / Enter ou botão | Confirmar mira e parar a barra de precisão |
| Esc | Voltar para a mira |
| M | Som liga/desliga |

Parar o marcador cedo puxa a bola para fora; tarde, para cima. Sob pressão o marcador treme (Sangue-frio reduz).

### No gol (cobranças do adversário)

| Tecla | Ação |
|---|---|
| A ou ← | Mergulhar à esquerda |
| S, ↓ ou Espaço | Ficar no centro |
| D ou → | Mergulhar à direita |
| Clique no gol | Lado pela posição do clique |

No chute o jogo entra em câmera lenta: veja a bola e reaja. A altura o goleiro acerta sozinho; quanto mais cedo no voo você reage (faixa azul da barra de reação), mais longe ele alcança.

## Estrutura

- `src/game/systems/` — regras puras e testáveis: `PenaltyResolver` (cobrança), `GoalkeeperAI`, `Shootout` (5 + alternadas, encerramento antecipado), `MatchManager`, `League`, `Career` (XP, dinheiro, reputação, temporadas, propostas), `SaveManager` (save versionado e validado).
- `src/game/scenes/PenaltyScene.ts` — renderização e entrada; só anima um resultado já resolvido.
- `src/game/entities/` — cobrador, goleiro e bola articulados; estádio e rede.
- `src/ui/` — telas HTML (menu, criação, painel, preparação, resultado, configurações).
