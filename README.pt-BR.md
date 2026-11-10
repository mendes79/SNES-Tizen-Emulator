# SNES Tizen Emulator

Emulador de Super Nintendo para Smart TVs Samsung com Tizen, empacotado como
aplicativo web (`.wgt`) e aberto pela tela inicial do lilauncher. Roda o nucleo
snes9x2002 recompilado para WebAssembly e joga em velocidade plena num SoC de TV
modesto.

Versao em ingles (principal): [README.md](README.md).

## O que e

- Dispositivo alvo: Samsung 65BU8000 (2022, Crystal UHD), Tizen 6.5, motor web
  Chromium M85.
- Nucleo: snes9x2002 recompilado para um WebAssembly enxuto, single-thread
  escalar (sem SIMD, sem threads), de modo a validar e rodar no Chromium M85.
- Entregue como pacote Tizen `.wgt`. E o mesmo WebView do navegador da TV, entao
  nao ha binario nativo do lado do app.

## Recursos

- Emulacao em velocidade plena na TV alvo (validada com medidor honesto de
  velocidade: quadros emulados por segundo real, nao FPS nominal).
- Tela de selecao de jogos sobre um wallpaper tematico, com navegacao vertical e
  painel de configuracoes.
- Configuracoes: som liga/desliga e reducao de velocidade (100%, -6%, -8%, -10%),
  persistidas localmente.
- Configuracao interativa de joystick: um assistente mapeia cada botao, com um
  diagrama do controle que destaca o botao pressionado.
- Controle: 8BitDo Ultimate 2.4G (dongle USB HID) via Gamepad API. Select+Start
  volta ao carrossel a partir de um jogo.
- Separacao de catalogo: ROMs comerciais privadas ficam locais e nunca sao
  publicadas; ROMs de distribuicao livre vao em `roms_pub/`.

## ROM livre inclusa

- 240p Test Suite (SNES), de Artemio Urbina, GNU GPL v2. Uma suite de testes de
  video que tambem serve como ROM de teste livre do emulador. Ver
  `roms_pub/CREDITS.md`.

## Estrutura do repositorio

- `index.html` e `js/` : a aplicacao (UI, input, audio, HUD, frontend libretro).
- `js/snes9x2002.wasm` / `js/snes9x2002.js` : o nucleo compilado.
- `core/` : registro de build do nucleo (build reproduzivel com Emscripten 3.1.56).
- `img/` : wallpaper, icone, diagrama do controle e overlays de destaque.
- `roms_pub/` : ROMs de distribuicao livre (publicadas).
- `roms/`, `roms.json` : ROMs comerciais privadas e catalogo (git-ignored, nao
  publicados).

## Build e instalacao (visao geral)

A ferramenta e o Tizen Studio no Windows (sdb.exe e a CLI tizen) com um perfil de
assinatura Samsung. O caminho curto:

1. Ative o Modo Desenvolvedor na TV e anote o IP.
2. Gere e assine o `.wgt` com seu perfil de certificado Samsung.
3. Instale pela rede com sdb/CLI tizen e abra.

Importante sobre distribuicao: a assinatura de apps de TV Samsung usa um
certificado de distribuidor amarrado ao DUID da TV especifica. Um `.wgt` assinado
para uma TV nao instala na TV de outra pessoa. Cada usuario precisa criar um
certificado com o DUID da propria TV (conta Samsung mais a Samsung Certificate
Extension) e assinar o pacote. Um guia de instalacao detalhado e ilustrado esta
planejado.

## Licenca

- Codigo proprio da aplicacao: MIT (ver LICENSE).
- Componentes de terceiros mantem suas licencas (ver THIRD-PARTY.md): o nucleo
  snes9x2002 sob a licenca Snes9x (nao-comercial) e o 240p Test Suite sob GPL v2.
  Este projeto e gratuito e nao-comercial.

## Creditos

- Nucleo snes9x2002: autores do Snes9x e equipe libretro.
- 240p Test Suite: Artemio Urbina e colaboradores.
- Foto do controle: Ravi Palwe no Unsplash (Unsplash License).
- Harness de referencia do GameBoy e o projeto lilauncher, no qual este emulador
  se integra.

## Relacionado

- lilauncher (tela inicial propria da TV): https://github.com/mendes79/lilauncher
