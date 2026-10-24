# Gravity Falls — Dimensões

Jogo de aventura e exploração 2D em pixel art no universo de Gravity Falls, com dois arcos narrativos
(Bill em Euclydia; Dipper e Mabel em Gravity Falls), combate em tempo real, puzzles, escolhas com
consequências persistentes e finais diferentes em cada arco. Web (PC e telemóvel) e Android via Capacitor.

- **Motor:** Phaser 3.90.0 (versão fixada) · TypeScript 5.9 · Vite 7 · Capacitor 8.5
- **Dados editáveis em JSON:** mapas, missões, diálogos, personagens, inimigos, objectos, finais
- **Funciona sem servidor:** todos os recursos vão no build (`dist/`) e no APK
- **Jogar no navegador:** https://henriquest-dev.github.io/Gravity-faal/ (build em `play/`, servido pelo GitHub Pages)

O estado real (o que funciona, o que foi testado e o que falta) está em [`ESTADO.md`](ESTADO.md).

## Comandos

```bash
npm install                 # instalar dependências
npm run dev                 # desenvolvimento em http://localhost:5173 (?debug liga o modo de depuração)
npm run build               # verificação de tipos + build web em dist/
npm run preview             # servir o build de dist/
npm test                    # testes automáticos (regras, finais, gravação, física, mapas, playthroughs)
```

Android (Capacitor, `webDir: dist`):

```bash
npx cap add android         # só na primeira vez (a pasta android/ já está no repositório)
npm run cap:sync            # build web + copia para android/app/src/main/assets/public
npm run cap:open            # abrir no Android Studio
npm run android:apk         # APK de teste: android/app/build/outputs/apk/debug/app-debug.apk
```

`android:apk` precisa do Android SDK (plataforma 36, build-tools 36) e de JDK 21. Sem Android Studio, basta
instalar as *command-line tools* e indicar o caminho em `android/local.properties` (`sdk.dir=/caminho/sdk`)
ou na variável `ANDROID_HOME`:

```bash
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Outras ferramentas:

```bash
npm run assets:extract      # regenera public/assets a partir do catálogo .docx (Python 3 + Pillow)
npm run maps:build          # regenera src/data/maps/*.json a partir de tools/maps/*.mjs
# testes no navegador (com `npm run dev` a correr; usam Playwright/Chromium):
npm run e2e:maps            # captura os 16 mapas e reporta erros da consola
npm run e2e:mechanics       # 35 verificações de movimento, profundidade, água, ponte, salto, diálogo, multitoque
npm run e2e:combat          # todos os tipos de inimigo atacam com aviso e recebem dano
npm run e2e:save            # gravar no menu, recarregar, continuar, posição inválida, ranhura corrompida
npm run e2e:perf            # fps e custo de actualização por área (`?renderer=canvas` para Canvas 2D)
node tools/e2e/cutscenes.mjs <pasta> [id...]   # reproduz cenas cinemáticas e guarda quadros
node tools/e2e/ui.mjs <pasta>                  # ecrã-título, HUD, diálogo com retrato, diário (TOUCH=1 para telemóvel)
npm run build:pages         # actualiza play/ (a versão publicada); fazer commit de play/ para publicar
```

`?nocs` desliga as cenas cinemáticas (aplica só os seus efeitos); os testes no navegador usam-no.

## Controlos

| Acção | PC (remapeável em Opções) | Telemóvel |
|---|---|---|
| Mover | WASD / setas | joystick à esquerda (zona morta, empurrar até ao fim corre) |
| Correr | Shift | botão de correr no canto inferior esquerdo (alterna) ou joystick no máximo |
| Interagir | E | botão dourado com o olho (mostra a acção) |
| Acção principal | J ou clique esquerdo no mundo | botão grande no canto |
| Capacidade | K (o rato aponta) | triângulo: tocar = mira automática, arrastar = apontar |
| Mudar capacidade | R / Tab | setas em círculo |
| Saltar · Esquivar | Espaço · L | botões no arco à volta do botão principal |
| Alternar Dipper/Mabel | Q | dois triângulos |
| Inventário · Mapa · Diário · Pausa | I · M · N · Esc | quatro botões no canto superior direito |
| Avançar diálogo | Enter (também E / J) | tocar na caixa |
| Saltar cena | Esc | «Saltar», no canto superior direito |
| Depuração | F3 (ou `?debug`) | Opções → Modo de depuração |

Durante diálogos e menus o jogo usa um contexto de controlos próprio: a tecla que avança uma fala nunca
salta nem ataca, e teclas mantidas premidas ao mudar de contexto são ignoradas até serem largadas.
O multitoque é real: cada dedo mantém o seu `pointerId` (largar um botão não cancela o joystick).

## Organização

```
assets-src/                 catálogo original (.docx) de onde saem todos os recursos
tools/extract_catalog.py    pipeline de recursos → public/assets (+ metadata/manifest.json)
tools/maps/*.mjs            autoria dos 16 mapas (pintura deliberada da grelha + objectos)
tools/build-maps.mjs        gera src/data/maps/*.json
tools/e2e/*.mjs             testes no navegador
public/assets/              personagens, animações, objectos (+ variantes @2/@3), texturas, cenários de referência
src/core/                   lógica pura e testável: grelha/colisões, pathfinding, estados, condições,
                            efeitos, missões, diálogos, finais, gravações
src/data/                   JSON: maps/, dialogues/, cutscenes/, quests, endings, items, abilities, characters, enemies, props, tiles, journal
src/game/assets.ts          carregamento validado por área, animações a partir do manifest
src/game/scenes/            Boot (manifest + recursos globais), Menu, World
src/game/world/             construção dos mapas: terreno com transições, edifícios compostos, objectos
src/game/entities/          Actor (pés + elevação + sombra), Npc, Enemy (IA por comportamento)
src/game/systems/           Input (contextos, remapeamento), Combat (avisos = área de dano), Fx (pools), Audio,
                            Cutscene (realizador das cenas: câmara, actores, falas, cartões, saltar)
src/game/ui/                HUD, diálogos com retratos e expressões, menus em forma de diário, gravações,
                            mapa, controlos tácteis com glifos próprios (DOM); icons.ts e portraits.ts
tests/                      Vitest
android/                    projecto Capacitor
```

## Recursos e escala

O pacote original (PNGs + índices JSON) não veio anexado; só o catálogo `.docx`, que embute todas as folhas
em resolução completa. `tools/extract_catalog.py` recupera dele os **1 344 quadros, 42 folhas, 120 objectos,
24 texturas e 16 cenários**, remove o fundo, mede por linha os limites visíveis e a linha dos pés (pivô) e
escreve `public/assets/metadata/manifest.json`. As folhas individuais são lidas como 8 colunas × 4 linhas
(sul, oeste, este, norte); as colectivas por linha (personagem, estado ou efeito), com a perspectiva de cada
linha registada — linhas só de lado (natação) são espelhadas para oeste, nunca reaproveitadas como outras direcções.

No catálogo todos os objectos estavam normalizados a ~112 px (um cogumelo do tamanho de um pinheiro). Para uma
escala coerente com as personagens (~66 px) e a grelha de 32 px, o pipeline gera variantes 1/2 e 1/3 por
amostragem de moda (mantém o píxel nítido) e `src/data/props.json` define a escala de cada objecto, a pegada de
colisão pela base e se é saltável. As texturas de 32 px são desenhadas a 2× para terem a mesma densidade de
píxel dos sprites. Complementos gerados (marcados no código como tal): transições entre materiais, margens de
água com espuma, faces de paredes e falésias, escadas de mão, tabuleiros de ponte, sombras, alavancas, postes de
ancoragem e os símbolos dos anéis.

As imagens de `environments/` são só referência de composição (e arte do ecrã de carregamento): cada nível é
construído de raiz com terreno, caminhos, água, paredes, falésias, pontes, objectos, colisões, entradas,
saídas, gatilhos e estado persistente.
