# Penalty Career

Jogo 2D de carreira de futebol em que toda partida é uma disputa de pênaltis. Vite + TypeScript + Phaser 3, menus em HTML/CSS, salvamento em LocalStorage.

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # checagem de tipos + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173
npm test           # testes unitários (regras da disputa, cobrança, carreira, salvamento)
npm run smoke      # teste E2E no Microsoft Edge instalado (BROWSER=chrome para usar o Chrome)
```

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
