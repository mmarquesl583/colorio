# Guia do projeto — color.io

Mapa de "quero mudar X → mexe no arquivo Y". Ler isso antes de abrir o
código evita ficar procurando às cegas.

## Como o projeto é organizado

```
client/    → o site (React + Vite + TypeScript). Roda no navegador.
server/    → o servidor (Node + ws). Dono da verdade: pontuação, timer, quem é o mestre, etc.
shared/    → código que os dois lados importam (tipos, matemática de cor, temas, pontuação).
```

`client` e `server` são dois processos separados que só se falam por
WebSocket (mensagens JSON). `shared/` não roda sozinho — é só uma
pasta de arquivos `.ts` que ambos importam diretamente (sem build
step próprio).

**Regra de ouro:** o servidor é dono de tudo que é "verdade do jogo"
(pontuação, cor secreta, quem já confirmou, tempo restante). O cliente
só *mostra* o que o servidor manda e envia intenções ("eu quero
confirmar essa cor"). Se uma mudança envolve "quem ganhou quantos
pontos" ou "o que é considerado válido", ela vai no `server/`, não no
`client/`.

---

## "Eu quero..." → onde mexer

| Quero... | Arquivo(s) |
|---|---|
| Mudar o texto de uma tela (título, botão, aviso) | `client/src/screens/*.tsx` (o texto está direto no JSX, sem arquivo de tradução) |
| Mudar cor, espaçamento, fonte, algo visual | inline no componente (`style={{...}}`) ou `client/src/styles/global.css` pras classes `corio-*` |
| Adicionar/remover um tema (tipo "Clash Royale") | `shared/gameData.ts` → array `LOBBY_THEMES` |
| Adicionar perguntas pro modo "Frase da IA" de um tema | `shared/aiQuestions.ts` → chave `AI_QUESTIONS[idDoTema]` (o `id` tem que bater com o `id` em `LOBBY_THEMES`) |
| Mudar a fórmula de pontuação (curva de pontos por distância de cor) | `shared/scoring.ts` → `scoreFromDeltaE` |
| Mudar os bônus (velocidade, MVP da rodada) | `shared/gameData.ts` (valores `SPEED_BONUS_MAX`, `ROUND_MVP_BONUS`) + `server/src/room.ts` → `computeReveal()` (é onde os bônus são somados) |
| Mudar quando os badges PERFEITO/QUASE PERFEITO/ÓTIMO aparecem | `shared/scoring.ts` → `badgeFromDeltaE` |
| Mudar quantos jogadores mínimo/máximo, rodadas, tempo de rodada | `shared/gameData.ts` (`MIN_PLAYERS`, `MAX_PLAYERS`, `MIN_ROUNDS`, `MAX_ROUNDS`, `PLACING_SECONDS`) |
| Mudar as regras de "quantos jogadores pra começar a partida" | `server/src/room.ts` → `startMatch()` (hoje: 1 no modo IA, 2 nos outros) |
| Mudar o seletor de cor (quadrado, barra de matiz, campos RGB) | `client/src/components/ColorPicker.tsx` |
| Mudar a animação/telas de revelação do resultado da rodada | `client/src/components/RevealModal.tsx` |
| Mudar o que acontece quando uma rodada começa/termina | `server/src/room.ts` → `startRound()` / `computeReveal()` |
| Adicionar um novo tipo de mensagem cliente→servidor ou servidor→cliente | `shared/types.ts` (`ClientMessage`/`ServerMessage`) **e** `server/src/index.ts` (o `switch` que trata as mensagens) **e** `client/src/ws.ts` (quem envia/recebe) |
| Adicionar um campo novo ao estado da sala (que o cliente precisa ver) | `shared/types.ts` → `RoomStateView` **e** `server/src/room.ts` → `stateFor()` (é quem monta esse objeto) |
| Mudar as cores/avatares dos jogadores | `shared/gameData.ts` → `PLAYER_PALETTE` |
| Mudar o layout mobile vs desktop | classes `corio-*` em `client/src/styles/global.css` (breakpoints `@media (min-width: ...)`) — o mobile é sempre o estilo "base", o desktop entra por cima com `!important` nas classes de escala (`corio-title`, `corio-card`, etc.) |
| Mudar o painel de imagem decorativa da tela inicial | `client/src/components/ColorArtPanel.tsx` |
| Mudar como o app conecta no servidor (URL do WebSocket) | `client/src/ws.ts` → constante `WS_URL` (usa `VITE_WS_URL` se definida, senão adivinha pelo endereço da página) |
| Mudar o deploy do servidor (Render) | `render.yaml` na raiz |
| Mudar o deploy do site (Vercel) | configurado direto no painel da Vercel (Root Directory = `client`, env var `VITE_WS_URL`) — não tem arquivo de config no repo |

---

## Como uma partida funciona (visão geral)

1. **Home** (`HomeScreen.tsx`) → jogador digita nome, escolhe criar ou
   entrar com código.
2. **Lobby** (`LobbyScreen.tsx`, só pra quem está criando) → escolhe
   jogadores/rodadas/temas/modo de frase, manda `create_room`.
3. **Sala de espera** (`WaitingScreen.tsx`) → mostra o código, quem já
   entrou. O anfitrião manda `start_match`.
4. **Rodada** (`GameScreen.tsx`) → duas variações:
   - **Modo "Frase dos jogadores"**: um jogador vira "Mestre da Cor"
     (`master-writing`), recebe uma cor secreta aleatória e escreve
     uma frase. Os outros adivinham (`placing`).
   - **Modo "Frase da IA"**: não tem mestre humano. O servidor sorteia
     uma pergunta de `AI_QUESTIONS` (se o tema tiver banco cadastrado)
     e a cor secreta *é* a resposta daquela pergunta, convertida de
     hex pra HSL. Todo mundo já cai direto em `placing`.
5. **Revelação** (`RevealModal.tsx`) → quando todos confirmam (ou o
   tempo acaba), o servidor calcula a distância de cada palpite até a
   cor secreta (Delta E 2000, `shared/color.ts`), converte em pontos
   (`shared/scoring.ts`), soma bônus, e manda o resultado. O cliente
   anima a revelação em cima disso.
6. Repete até `numRounds`, aí a sala fica no placar final (não tem uma
   tela de "fim de jogo" dedicada hoje — os jogadores só veem o placar
   subir a cada rodada).

O estado inteiro de uma sala vive **na memória do servidor**, dentro
de um objeto `Room` (`server/src/room.ts`). Não tem banco de dados —
se o servidor reiniciar (ex: um novo deploy), toda sala em andamento
some. Isso é intencional (é um jogo casual, não precisa persistir).

---

## Onde cada arquivo fica

### `client/src/`
- `App.tsx` — decide qual tela mostrar (`Home` → `Lobby` → sala →
  `Waiting`/`Game`, dependendo do estado da conexão).
- `ws.ts` — hook `useRoomConnection()`: abre o WebSocket, guarda o
  último estado que o servidor mandou, expõe funções (`createRoom`,
  `joinRoom`, `send`, `leaveRoom`).
- `screens/HomeScreen.tsx` — tela inicial (nome + criar/entrar).
- `screens/LobbyScreen.tsx` — configurar a sala antes de criar.
- `screens/WaitingScreen.tsx` — sala de espera antes da partida.
- `screens/GameScreen.tsx` — a tela da rodada em si (a mais complexa;
  contém os cards de "Mestre escrevendo", "cor enviada", os pills de
  SALA/RODADA/TEMPO, etc). O quadrado de escolher cor e o painel de
  chat/placar são componentes separados, importados aqui.
- `components/ColorPicker.tsx` — o seletor de cor (quadrado
  saturação×luminosidade + barra de matiz + campos RGB).
- `components/ChatPlacar.tsx` — as abas/painéis de placar e chat
  dentro da rodada.
- `components/RevealModal.tsx` — a animação de revelar quem acertou
  mais.
- `components/RoundIntroModal.tsx` — o popup "Vamos adivinhar" que
  mostra a frase antes do jogador poder escolher a cor.
- `components/AppShell.tsx` — o wrapper de fundo/layout que envolve
  toda tela (fundo com gradiente, centraliza no desktop).
- `components/ColorArtPanel.tsx` — as bolhas coloridas decorativas ao
  lado do formulário da Home no desktop.
- `components/Logo.tsx` — o "color.io" com gradiente.
- `styles/global.css` — tudo que não é inline: animações (`@keyframes
  corio-*`), o sistema de escala pra desktop (`corio-title`,
  `corio-card`, `corio-eyebrow`...), grids responsivos.

### `server/src/`
- `index.ts` — abre o servidor HTTP+WebSocket, roteia cada mensagem
  recebida (`create_room`, `join_room`, `pick_color`, etc.) pro método
  certo da `Room`.
- `room.ts` — **o coração do jogo**. Uma instância de `Room` por sala
  ativa (guardadas no `Map` em `index.ts`). Métodos principais:
  `startMatch`, `startRound`, `submitPhrase`, `pickColor`,
  `confirmColor`, `computeReveal`, `readyNext`. `stateFor()` monta o
  objeto que cada jogador recebe (cada um vê uma versão ligeiramente
  diferente — só o mestre vê `masterSecret`, por exemplo).
- `id.ts` — gera código de sala (4 letras) e ids de jogador/chat.

### `shared/`
- `types.ts` — todo o "contrato" entre cliente e servidor:
  `ClientMessage`, `ServerMessage`, `RoomStateView`, etc. Se você
  adicionar um campo aqui que o servidor não preenche ou o cliente não
  lê, o TypeScript não vai avisar sozinho — confira os dois lados.
- `gameData.ts` — temas (`LOBBY_THEMES`), paleta de cor dos jogadores,
  banco de frases genéricas (`AI_PHRASE_BANK`, usado só quando um tema
  não tem perguntas cadastradas em `aiQuestions.ts`), e as constantes
  de regra (min/max jogadores, rodadas, duração da rodada, valores dos
  bônus).
- `aiQuestions.ts` — banco de perguntas por tema pro modo "Frase da
  IA". Cada entrada tem `pergunta` + `hex` (o hex é literalmente a cor
  secreta da rodada). Pra adicionar um tema novo aqui, o `id` da chave
  precisa bater com o `id` de algum item em `LOBBY_THEMES`.
- `color.ts` — toda a matemática de cor: conversões (HSL↔RGB↔Hex↔Lab)
  e a distância perceptual Delta E 2000 usada pra pontuar.
- `scoring.ts` — curva de pontos por Delta E, e os limites dos badges.

---

## Cuidados / pegadinhas já encontradas

- **Nunca dependa de um objeto vindo do WebSocket num `useEffect` pela
  referência.** Cada mensagem do servidor passa por
  `JSON.stringify`/`JSON.parse`, então mesmo que o conteúdo seja
  idêntico, o cliente recebe um objeto *novo* toda vez. Um
  `useEffect(() => {...}, [results])` reagia a *qualquer* broadcast
  (até uma mensagem de chat) e reiniciava a animação de revelação do
  zero — foi corrigido trocando a dependência por
  `results.secretHex` (uma string, que aí sim só muda quando a
  rodada muda de verdade). Se for depender de algo que vem da rede,
  prefira um campo primitivo (string/number) e estável, não o objeto
  inteiro.
- **O quadrado do seletor de cor não é forçado a ser quadrado** — ele
  usa `aspect-ratio` pra não ficar gigante/torto em telas muito altas.
  Se mexer nesse layout, teste numa janela bem alta além do celular.
- **`.corio-card`, `.corio-title`, `.corio-eyebrow` etc. usam
  `!important`** nas regras de desktop (`@media (min-width: 900px)`)
  de propósito — é a forma de sobrescrever o tamanho que já vem como
  `style` inline (inline sempre vence uma classe normal, mas não vence
  uma classe com `!important`). Se criar um elemento de texto novo que
  deveria escalar no desktop, usa uma dessas classes em vez de inventar
  tamanho novo.
- **`AI_QUESTIONS[theme.id]` só existe pros temas que já têm banco
  próprio.** Tema sem banco cai automaticamente no
  `AI_PHRASE_BANK` genérico (frase solta, cor 100% aleatória, sem
  relação com a frase) — não quebra, só fica sem graça. Olha o `if
  (isAi)` em `startRound()` no `room.ts` se for mexer nisso.
- **Sem banco de dados.** Qualquer coisa que devesse "lembrar depois
  que a sala acabar" (histórico de partidas, estatísticas de longo
  prazo) precisaria de uma peça nova (banco + rota), não existe hoje.

---

## Rodando local

```bash
cd server && npm install && npm run dev   # servidor ws em :8787
cd client && npm install && npm run dev   # site em :5173
```

Abra `http://localhost:5173` em duas abas/dispositivos pra testar com
"dois jogadores".

## Publicando

`git push` na branch `main` já redeploya sozinho: o Render (servidor)
e a Vercel (site) estão ambos conectados ao repositório do GitHub e
reagem a cada push.
