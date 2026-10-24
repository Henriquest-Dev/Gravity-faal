# Estado do projecto

Registo honesto do que funciona, do que foi verificado e do que falta. Última actualização: 24-10-2026.

## Jogável

- Os dois arcos completos, do início aos finais: Bill em Euclydia (reparação, exílio, ascensão) e Dipper e
  Mabel em Gravity Falls (equilíbrio, vitória com custo, ruptura). O arco 2 muda conforme o final do arco 1.
- 16 áreas construídas de raiz. As imagens do catálogo servem só de referência.
- Combate em tempo real com avisos de área, puzzles, missões, diário, mapa, inventário, gravações
  (3 ranhuras, exportar/importar, versões migradas).
- Cenas cinemáticas: chegada de autocarro a Gravity Falls, descoberta do Diário 3, fonte, visão do
  telescópio, ruptura, Dimensão do Pesadelo, coração da fenda, Bill no bunker (3 versões), Estranhagedom,
  Bebé do Tempo, Travessia e finais em cartões. Todas se podem saltar (Esc ou «Saltar»).
- Ciclo de dia e noite nos exteriores, com relógio no HUD.
- Tipo de letra próprio ao estilo da caligrafia de Bill em todo o jogo; cifra de Bill com nove inscrições.
- Cabana do Mistério pintada à mão em quatro versões (normal, Estranhagedom, destruída, reconstruída);
  no jogo a versão segue a história, no ecrã-título alternam.
- Controlos de PC remapeáveis e controlos tácteis com multitoque real.

## Verificado

- `npm test`: 98 testes (regras, finais, gravações, física, mapas e alcance, playthroughs completos,
  cenas, cifra, horas do dia).
- No navegador (Chromium com SwiftShader): todas as verificações de mecânicas, combate de todos os inimigos,
  gravações, captura de todos os mapas sem erros de consola, cenas da chegada e do diário, ecrã-título.

## Limitações conhecidas

- No ambiente de testes (WebGL por software) os fps são baixos; em hardware real o jogo corre a 60 fps.
  `?renderer=canvas` força o Canvas 2D em aparelhos com WebGL fraco.
- O áudio é sintetizado (o catálogo não traz sons): caixa de música, ambientes e efeitos.
- O APK Android compila com o Capacitor, mas não foi testado num telemóvel físico.
- Algumas expressões dos retratos vêm de quadros de gestos do catálogo; personagens secundárias têm
  poucas expressões disponíveis.

## A seguir

- Mais cenas de descoberta ao longo do arco 2 (gnomos, lago, McGucket).
- Decoração interior da Cabana mais rica e menos repetida.
- Teste em aparelho Android real.
