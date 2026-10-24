"""Second writing pass over every dialogue: character voice, beats and moods.

Each entry maps a node to a list of beats (speaker id or None to keep the
node's speaker, mood, text). The first beat replaces the node's text; the
others become new nodes chained after it, and the node's choices and `next`
move to the last beat. Effects stay on the first beat. Choice texts can be
rewritten too; the openings used by the playthrough tests are kept.
Run once: python3 tools/rewrite_dialogues.py
"""
import json

NAMES = {
    'bill_child': 'Bill', 'bill': 'Bill', 'professor': 'Professor Círculo', 'merchant': 'Mercador Quadrado', 'tri': 'Tri',
    'elder': 'Anciã Hexágono', 'stan': 'Stan', 'dipper': 'Dipper', 'mabel': 'Mabel', 'soos': 'Soos', 'wendy': 'Wendy',
    'pacifica': 'Pacifica', 'mcgucket': 'McGucket', 'ford': 'Ford', 'blendin': 'Blendin', 'baby': 'Bebé do Tempo', '': '',
}

B = {
  'arc1': {
    'professor': {
      'p1': [(None, 'surprised', 'Bill! Outra vez a olhar para o sol de olho fechado?'),
             (None, 'thinking', 'Os teus colegas andam a dizer que vês «arestas a mais» nas coisas. Que tal me contares tu, em vez deles?')],
      'p2': [(None, 'thinking', 'Hum. Formas que tremem... Há um texto antigo sobre isso. Diz que a fonte de cristal reage a quem vê demasiado.'),
             (None, 'happy', 'Vai tocar-lhe. E depois volta e conta-me tudo, com os ângulos todos.')],
      'p2b': [(None, 'neutral', 'Está bem. Mas se um dia vires, vai à fonte. O cristal não mente, mesmo quando nós mentimos.')],
      'p_hint': [(None, 'thinking', 'Três pontos da praça parecem-me... tortos. Um junto à casa a noroeste, outro no extremo leste, outro do outro lado do rio.'),
                 (None, 'neutral', 'Fecha um pouco esse teu olho e olha com o outro lado dele.')],
      'p_reported': [(None, 'surprised', 'Uma porta no céu. E alguém do outro lado.'),
                     (None, 'thinking', 'Vou estudar isto com todo o cuidado. Obrigado por confiares em mim, Bill. Nem toda a gente confiaria.')],
      'p_default': [(None, 'happy', 'Um círculo não tem princípio nem fim, Bill. As melhores perguntas também não.')],
    },
    'merchant': {
      'm1': [(None, 'angry', 'Tu! As minhas caixas mudaram de sítio sozinhas quando passaste.'),
             (None, 'angry', 'Uma andou meio metro. Caixas não andam. Isto é obra tua, não é?')],
      'm_honest': [(None, 'thinking', '...Hum. Pelo menos és honesto, o que é mais do que diz metade desta praça.'),
                   (None, 'neutral', 'Arruma-as tu, então. E ensina esse olho a pedir licença.')],
      'm_lie': [(None, 'angry', 'O vento. Pois. Nesta praça não sopra vento há dez anos.')],
      'm_scare': [(None, 'scared', 'Afasta-te da minha banca!'),
                  ('', None, 'O mercador recua, a tremer. À volta, as janelas fecham-se uma a uma.')],
      'm_scared': [(None, 'scared', 'Não tenho nada para ti. Não tenho nada para ninguém.')],
      'm_default': [(None, 'neutral', 'Triângulos, quadrados, círculos... todos pagam o mesmo preço. É a única coisa justa nesta terra.')],
    },
    'artisan_plaza': {
      't1': [(None, 'surprised', 'Bill! Andas estranho. Os outros dizem que o teu olho brilha à noite.'),
             (None, 'sad', 'Vais ao observatório, não vais? Vê-se na tua cara.')],
      't_prom': [(None, 'happy', 'Então vou fazer-te um colar de triângulos para quando voltares.'),
                 (None, 'smug', 'E se te atrasares, faço-te um de quadrados. Vais odiar.')],
      't_noprom': [(None, 'sad', '...Está bem. Cuida-te, olho-mágico.')],
      't_wait': [(None, 'happy', 'O colar já vai a meio. Antes do pôr-do-sol, lembra-te.')],
      't_default': [(None, 'thinking', 'Estou a esculpir um prisma que reflecte para dentro. Ainda não sei para que serve. Acho que é para ninguém.')],
    },
    'tri_house': {
      't1': [(None, 'surprised', 'Bill! A porta estava aberta, desculpa ter entrado.'),
             (None, 'sad', 'Andas estranho. Os outros dizem que o teu olho brilha. Vais ao observatório, não vais?')],
      't_prom': [(None, 'happy', 'Então vou fazer-te um colar de triângulos para quando voltares.'),
                 (None, 'neutral', 'A Anciã está do outro lado do rio, se precisares do selo. Ela finge que é severa, mas gosta de ti.')],
      't_noprom': [(None, 'sad', '...Está bem. A Anciã tem o selo do observatório, do outro lado do rio.'),
                   (None, 'sad', 'Cuida-te, olho-mágico.')],
    },
    'elder': {
      'e1': [(None, 'neutral', 'Ainda és novo para o observatório, Bill.'),
             (None, 'thinking', 'Primeiro aprende a ver o que a praça esconde. Depois falamos do céu.')],
      'e_token': [(None, 'thinking', 'Disseram-me que encontraste as três anomalias. A fonte escolheu-te.'),
                  (None, 'neutral', 'Diz-me, criança: o que vês quando fechas o olho?')],
      'e_give': [(None, 'neutral', 'Leva o Selo. O portão do norte abre-se a quem traga selo e geometria.'),
                 (None, 'sad', 'E Bill... há portas que não voltam a fechar. Lembra-te que fui eu que ta abri.')],
      'e_after': [(None, 'neutral', 'O observatório espera-te a norte da praça. Ele tem paciência. Eu já não tanta.')],
    },
    'telescope_vision': {
      'v1': [('bill_child', 'scared', 'O telescópio range. A visão desaparece, mas a voz fica, colada ao ouvido.')],
      'v2': [('bill_child', 'thinking', 'Uma porta no céu. Alguém do outro lado que sabe o meu nome. O que é que eu faço com isto?')],
      'v3': [('', None, 'Um estrondo, lá em baixo. A cidade racha como vidro. A ruptura começou: a saída é pelo sul.')],
    },
    'elder_rupture': {
      'r1': [(None, 'scared', 'Bill! A fenda abriu-se onde estava a fonte.'),
             (None, 'sad', 'Há gente presa: o Professor, o Mercador, a Tri. E a fenda... a fenda chama por ti. Ouço-a dizer o teu nome.')],
      'r2': [(None, 'neutral', 'Antes de entrares, diz-me ao que vais. Quero ouvir da tua boca.')],
      'r3': [(None, 'neutral', 'Vai quando estiveres pronto.'),
             (None, 'thinking', 'Mas os presos ainda podem ser salvos. E um estilhaço geométrico pode reparar a fonte, se o souberes usar.')],
      'r_after': [(None, 'sad', 'A fenda não espera para sempre. Mas ninguém te obriga a chegar ao coração sozinho.')],
    },
    'rescue_professor': {
      'a': [(None, 'surprised', 'Bill?! Vieste buscar-me através do vazio?')],
      'ok': [(None, 'happy', 'Obrigado, rapaz. Um círculo fecha-se sempre, e hoje fechou-se do lado certo.'),
             ('', None, 'O Professor afasta-se em segurança, a contar os passos.')],
      'no': [(None, 'sad', 'Então vai. Eu espero aqui. O círculo há-de fechar, mais cedo ou mais tarde.')],
    },
    'rescue_merchant': {
      'scared': [(None, 'scared', 'Não te aproximes!'),
                 (None, 'sad', '...Mas também não tenho para onde ir.')],
      'a': [(None, 'sad', 'Estou preso nesta ilha com a mercadoria toda. Ajudas-me?')],
      'ok': [(None, 'thinking', 'Talvez tenha sido injusto contigo, miúdo. Obrigado. A sério.')],
      'deal': [(None, 'angry', 'Negócio é negócio. Toma, e tira-me daqui antes que me arrependa.')],
      'no': [(None, 'angry', 'Típico. Igualzinho a toda a gente.')],
    },
    'rescue_tri': {
      'prom': [(None, 'happy', 'Vieste! Prometeste e vieste.'),
               ('', None, 'Ela segura um colar de triângulos meio acabado, com os dedos cheios de pó.')],
      'a': [(None, 'sad', 'Bill... pensei que ninguém me encontrava aqui debaixo.')],
      'ok': [(None, 'neutral', 'Lá dentro, não te esqueças de quem és.'),
             (None, 'sad', 'Promete-me isso também. Gosto de promessas tuas.')],
    },
    'pyronica': {
      'a': [(None, 'smug', 'Um triangulozinho com um olho enorme. Que amoroso.'),
            (None, 'smug', 'Queres a chave do vazio? Então ganha-a.')],
      'info': [(None, 'smug', 'Ele quer-te, criança. Todos nós queremos. Agora dança!')],
      'fight': [(None, 'smug', 'Hahaha! Cuidado com os círculos de fogo, docinho.')],
      'deal': [(None, 'smug', 'Tens cara de quem cumpre o que promete. Que raro, por aqui.'),
               (None, 'smug', 'Proposta: a chave do vazio agora... e um favor teu, um dia. Um diazinho qualquer.')],
      'bye': [(None, 'smug', 'Delicioso. Até um dia, Bill.'),
              ('', None, 'Pyronica desfaz-se em fumo cor-de-rosa. O cheiro a enxofre fica.')],
    },
    'bola8': {
      'a': [('', None, 'Bola 8 rosna. As correntes chocalham.'),
            (None, 'angry', 'NINGUÉM... PASSA.')],
      'calm': [('', None, 'Bola 8 rosna. Mas as correntes nos pulsos estão em carne viva, e ele estremece a cada movimento.')],
      'thanks': [(None, 'neutral', '...obrigado... pequeno.'),
                 ('', None, 'Bola 8 afasta-se para o vazio. Pela primeira vez em muito tempo, sem fazer barulho.')],
    },
    'heart': {
      'guarded': [('', None, 'Bola 8 não te deixa chegar ao coração. Primeiro tens de passar por ele.')],
      'broken': [('bill_child', 'sad', 'Lembras-te da Tri. Prometeste voltar antes do pôr-do-sol. Aqui não há sol.')],
      'h1': [('', None, 'O coração bate ao ritmo do teu olho.'),
             ('Bill Cipher', 'smug', 'Podes fechar-me. Podes deixar-me. Ou podes ser-me. Tudo o que fizeste até aqui pesa nesta escolha.')],
      'done': [('', None, 'O coração já respondeu. Só se ouve o silêncio.')],
    },
  },
  'arc2': {
    'soos': {
      'a': [(None, 'happy', 'Ei, meus! Bem-vindos à Cabana do Mistério!'),
            (None, 'smug', 'Já experimentaram o Buraco Misterioso? É um buraco. Muito misterioso. Custa dois dólares.')],
      'hook': [(None, 'thinking', 'A Mabel tem uma caixa na sala, à direita. Acho que é um gancho!'),
               (None, 'smug', 'O Stan disse para não vos dizer, por isso... eu não disse nada. Pisca-pisca.')],
      'waddles': [(None, 'happy', 'O Waddles voltou! Estava a dormir dentro do meu boné, meu. Acho que agora somos família.')],
    },
    'wendy': {
      'a': [(None, 'neutral', 'Ei, miúdos. O Stan quer-vos lá dentro.'),
            (None, 'smug', 'Diz que é «trabalho», o que quer dizer que é pior.')],
      'b': [(None, 'thinking', 'Luzes no lago, hã? Cuidado com a ravina a leste. Só com corda é que se passa.'),
            (None, 'neutral', 'E a gruta é escura que nem breu. Levem luz. A sério.')],
    },
    'waddles': {'a': [(None, 'happy', 'Oinc!'), ('', None, 'O Waddles dá uma volta sobre si próprio, feliz da vida.')]},
    'bill_shack': {
      'a': [('', None, 'Do outro lado do pátio, um triângulo amarelo e translúcido olha para vocês.'),
            ('bill', 'smug', 'Gémeos Pines. Conheço-vos de um sítio onde ainda não estiveram.'),
            ('bill', 'smug', 'Quando quiserem um acordo... chamem. Eu oiço sempre.')],
    },
    'stan': {
      's1': [(None, 'neutral', 'Ah, aí estão vocês. Regras da Cabana, decorem-nas:'),
             (None, 'angry', 'Não se toca nas atracções. Ninguém vai à floresta à noite. E NINGUÉM pergunta pelas luzes do lago.')],
      's1b': [(None, 'surprised', 'Reflexos! Patos fosforescentes! Sei lá.'),
              (None, 'neutral', 'Vão à cidade, arranjem-me clientes e fiquem longe de problemas.'),
              (None, 'smug', 'A lanterna está na gaveta da secretária. É só para... ler. Ler à noite. Como pessoas normais.')],
      's1c': [(None, 'happy', 'Ajudar? Isso é música para a minha carteira. Tragam turistas da cidade!'),
              (None, 'neutral', 'E fiquem longe da floresta. A lanterna está na gaveta da secretária, se precisarem... de contar dinheiro no escuro.')],
      's2': [(None, 'angry', 'Já foram à cidade? Os turistas não se arrastam sozinhos até cá. Bem, alguns sim. Mas pagam menos.')],
      's_key': [(None, 'surprised', 'Esse cartão... onde é que vocês...'),
                (None, 'sad', 'A estante ao fundo da loja. Usem-no.'),
                (None, 'sad', 'E se virem alguém com seis dedos, digam-lhe que o irmão dele ainda está à espera.')],
      's_late': [(None, 'surprised', 'Estabilizador dimensional?! Eu não ouvi isso. Nunca ouvi. Ninguém ouviu.'),
                 (None, 'sad', '...Tenham cuidado lá em baixo, está bem?')],
    },
    'ford_home': {'a': [(None, 'sad', 'Trinta anos.'), (None, 'happy', 'Obrigado, miúdos. E digam ao Stan que o diário ficou em boas mãos. Ele vai fingir que não se importa.')]},
    'pacifica': {
      'dipper': [(None, 'smug', 'Ew. O irmão esquisito. Eu não falo com quem usa colete.'),
                 (None, 'smug', 'Se for importante, manda a tua irmã.')],
      'm1': [(None, 'smug', 'Mabel. Gostei da camisola. ...Não, a sério, não gostei.'),
             (None, 'neutral', 'O que é que queres?')],
      'm2': [(None, 'scared', '...Um triângulo. Amarelo. A flutuar por cima do lago.'),
             (None, 'scared', 'Tinha um olho. E sorriu-me.'),
             (None, 'angry', 'Pronto, contei. Agora desaparece.')],
      'after': [(None, 'angry', 'Já te disse tudo. E não, não estou com medo. Os Northwest não têm medo.')],
    },
    'felicia': {
      'a': [(None, 'happy', 'Olá! Sou a Felícia.'),
            (None, 'thinking', 'Conhecem aquela sensação de que alguém está a ler o vosso nome numa lista?'),
            (None, 'thinking', 'Os relógios da cidade atrasam dez segundos sempre que as luzes aparecem. Eu contei. Contei muitas vezes.')],
      'after': [(None, 'thinking', 'Dez segundos. Sempre dez. Nunca nove.')],
    },
    'wendy_town': {'a': [(None, 'neutral', 'A loja de ferragens tem caixotes de material à porta.'), (None, 'smug', 'O McGucket costuma «pedir emprestado» de lá. Se ele precisar de fio, é por aí.')]},
    'waddles_lost': {
      'dipper': [('', None, 'O Waddles foge do Dipper e enfia-se atrás de um arbusto. Com a Mabel talvez tenha mais sorte.')],
      'mabel': [('mabel', 'happy', 'Waddles! Anda cá, meu porquinho lindo!'),
                ('', None, 'O Waddles hesita e cheira o ar. Quer comida. Uma bolacha de milho, talvez?')],
      'ok': [('', None, 'A Mabel estende a bolacha de milho. O Waddles corre para ela aos tropeções.'),
             ('mabel', 'happy', 'Vamos para casa, Waddles! Ninguém te volta a perder. Prometo.')],
    },
    'mcgucket': {
      'm1': [(None, 'surprised', 'Ehh?! Visitas! O quê? Luzes? Portais? Hmm-hmm!'),
             (None, 'happy', 'Eu sei fazer um estabilizador dimensional! Sei, sei. Acho que sei.'),
             (None, 'thinking', 'Preciso de três peças: uma engrenagem do pátio da sucata, uma célula de energia, que perdi no lago, hehe, e uma bobine de fio das ferragens da cidade.')],
      'm1b': [(None, 'happy', 'Ganham não ser engolidos pelo tempo! Bom negócio! Hehe!')],
      'm3': [(None, 'thinking', 'O portão da sucata tem duas placas de pressão, uma de cada lado.'),
             (None, 'happy', 'Precisa de dois pesos ao mesmo tempo. Um para cada gémeo! Hmm-hmm!')],
      'm2': [(None, 'neutral', 'Engrenagem, célula, bobine! Depois montem tudo na consola grande, aqui dentro.')],
      'done': [(None, 'surprised', 'O estabilizador! Funciona!'),
               (None, 'thinking', 'Agora prendam-no a um portal... mas que portal? Debaixo de uma cabana, talvez. Hmm-hmm.')],
    },
    'bill_ally': {
      'a': [(None, 'neutral', 'Gémeos. Eu fechei uma fenda há muito tempo, em Euclydia. Custou-me quase tudo.'),
            (None, 'thinking', 'Esta não é minha: vem do futuro. Alguém está a usar o tempo como uma lâmina.')],
      'b': [(None, 'smug', 'Não deviam. Ninguém devia confiar num triângulo.'),
            (None, 'thinking', 'Mas olhem para a fenda: tem a cor errada. É temporal. Quando o estabilizador ligar o portal, a cidade vai sofrer. Estejam lá.')],
      'c': [(None, 'neutral', 'Ajudo. Com uma condição.'),
            (None, 'sad', 'Quando tudo acabar, fechem as portas por dentro. Mesmo que eu fique do lado de fora.')],
      'after': [(None, 'neutral', 'O portal espera pelo estabilizador. Eu espero por vocês. Sou bom a esperar.')],
    },
    'bill_deal': {
      'a': [(None, 'smug', 'Olá, Pines. Querem um atalho?'),
            (None, 'smug', 'Abro o portal sem perigo para a cidade... em troca de um bocadinho do vosso tempo. Ninguém dá pela falta de um ano.')],
      'yes': [(None, 'happy', 'Fantástico!'),
              ('', None, 'O sorriso dele não chega ao olho.'),
              (None, 'smug', 'A cidade vai sofrer um pouco menos. Vocês, um pouco mais.')],
      'no': [(None, 'smug', 'Toda a gente diz isso. Até ao dia em que deixa de dizer.')],
      'after': [(None, 'smug', 'O acordo continua de pé. Ou não. Depende de vocês, como tudo o que interessa.')],
    },
    'bill_threat': {
      'a': [('', None, 'Bill cresce até encher a sala, envolto em chamas azuis.'),
            (None, 'angry', 'Pequenos Pines! Esta cidade é uma janela, e eu vou abri-la de par em par.'),
            (None, 'smug', 'Os meus amigos vão fazer-vos companhia. Eles adoram companhia.')],
      'b': [(None, 'smug', 'Já ganhei. Em Euclydia. Isto é só desporto.')],
      'c': [(None, 'smug', 'Que liguem o portal. Vão fazê-lo de qualquer maneira: é a única forma de salvarem a cidade.'),
            (None, 'angry', 'HAHAHAHA!')],
      'after': [(None, 'smug', 'Tic-tac, Pines.')],
    },
    'rescue_soos': {
      'a': [(None, 'scared', 'Meus! A laje caiu-me em cima do boné!'), (None, 'neutral', 'Eu estou bem. O boné nem por isso.')],
      'ok': [(None, 'happy', 'Valeu, meus! Vou para a Cabana proteger o Stan.'), (None, 'thinking', 'Ou os chocolates. Logo vejo quem precisa mais.')],
    },
    'rescue_pacifica': {
      'd': [(None, 'angry', 'Não fiques aí parado! Tira-me desta ilha!')],
      'm': [(None, 'surprised', 'Mabel?! Vieste... por mim?')],
      'ok': [(None, 'sad', 'Obrigada.'), (None, 'angry', 'Não contes a ninguém que eu disse obrigada.'),
             ('', None, 'Pacifica volta para terra firme pelo gancho da Mabel, de olhos fechados.')],
    },
    'rescue_wendy': {
      'busy': [(None, 'angry', 'Agora não, miúdos! Cuidado com os dentes!'), (None, 'neutral', 'Ajudem-me a afastar aqueles Teeth.')],
      'ok': [(None, 'happy', 'Uau. Vocês são mais duros do que parecem. Obrigada, a sério.')],
    },
    'blendin': {
      'a': [(None, 'scared', 'Ah, não, não, não, não.'),
            (None, 'neutral', 'Agente Blendin Blandin, Polícia do Tempo. Alguém ligou um portal sem âncora.'),
            (None, 'scared', 'E o Bebé do Tempo vai apagar esta cidade inteira da linha temporal!')],
      'help': [(None, 'surprised', 'Ajudar?! Ninguém me ajuda desde o ano 207012.'),
               (None, 'neutral', 'Tomem: a fita temporal. Abre o portal para a Cidade do Tempo. No Arquivo há prisioneiros que sabem como parar isto.')],
      'force': [(None, 'scared', 'Está bem, está bem! Fita temporal. Não digam a ninguém. Por favor.')],
      'after': [(None, 'scared', 'O portal está ali ao lado. A fita temporal abre-o. Despachem-se!')],
    },
    'hectorgon_ally': {'a': [('', None, 'Hectorgon ajeita o chapéu.'), (None, 'neutral', 'O pequeno de Euclydia pediu-me para não vos fazer mal. Hmph.'), (None, 'angry', 'Os Teeth não estão do meu lado. Nem do vosso.')]},
    'pyronica_town': {
      'a': [(None, 'smug', 'Pines! O vosso amigo triangular manda cumprimentos. Ardentes.')],
      'leave': [(None, 'angry', 'Hmph. Têm coragem, miúdos. E confiam uns nos outros.'), (None, 'smug', 'Que aborrecido. Volto quando for divertido.')],
    },
    'bola8_town': {
      'a': [(None, 'angry', 'NINGUÉM... PASSA.')],
      'calm': [('', None, 'Bola 8 olha para os pulsos, livres há muito tempo.'), (None, 'sad', '...o pequeno de Euclydia... foi bom para mim. Eu... vou embora.')],
    },
    'blendin_city': {
      'a': [(None, 'neutral', 'Vocês! Tomem o meu passe de agente.'),
            (None, 'thinking', 'O Arquivo fica a norte, mas a ponte só existe no passado. A alavanca do terraço oeste muda isso.'),
            (None, 'neutral', 'E o código das celas: relógio, ampulheta, engrenagem. Decorem.')],
      'cold': [(None, 'angry', 'Vocês ameaçaram-me.'), (None, 'sad', '...Mas o Bebé do Tempo é pior do que vocês. O passe tem um preço: registo uma dívida temporal no vosso nome.')],
      'sorry': [(None, 'surprised', 'Um pedido de desculpas... registado!'), (None, 'happy', 'O passe é vosso. De graça. Que dia estranho.')],
      'after': [(None, 'neutral', 'Arquivo a norte, no passado. Arena a leste, no presente. A alavanca do tempo está no terraço oeste.')],
    },
    'rescue_ford': {
      'a': [('', None, 'Um homem de seis dedos e olhar cansado levanta a cabeça.'),
            (None, 'surprised', 'Pines? Vocês são... família.'),
            (None, 'thinking', 'Ouçam. O Bebé do Tempo só pode ser ferido quando recupera de um ataque.'),
            (None, 'neutral', 'E há outra forma: biberões de areia temporal, no armazém deste Arquivo.')],
      'b': [(None, 'neutral', 'Eu vou à frente até às linhas temporais. Encontramo-nos lá.'), (None, 'sad', '...Obrigado.')],
    },
    'prisoner_felicia': {
      'a': [(None, 'thinking', 'Estou aqui há... dez segundos? Dez anos? Os relógios mentem cá dentro.'),
            ('', None, 'É igual à Felícia da cidade. Igual demais.')],
      'free': [(None, 'happy', 'Livre! Obrigada, Pines.'), (None, 'thinking', 'Se me virem na cidade... finjam que não sabem de nada.')],
    },
    'baby_intro': {
      'b1': [('', None, 'O Bebé do Tempo abre os olhos. A ampulheta na testa acende-se.'), (None, 'angry', 'QUEM OUSA ACORDAR-ME?')],
      'b2': [(None, 'angry', 'PASSAR? NINGUÉM PASSA.'), (None, 'angry', 'A NÃO SER QUE ME VENÇAM... OU ME DÊEM ALGO MELHOR.')],
      'bottle': [('', None, 'Os olhos dele fixam-se no biberão. Hesita.')],
      'reject': [(None, 'angry', 'NÃO QUERO!'), ('', None, 'Empurra o biberão para longe. Talvez com mais jeito... e com mais gente do vosso lado.')],
      'calm': [('', None, 'Ele bebe. Boceja. Adormece a flutuar, com o polegar na boca.'), ('', None, 'O caminho para norte abre-se em silêncio.')],
      'bargain': [(None, 'smug', 'UM ACORDO. QUATRO ANOS DO VOSSO TEMPO.'), (None, 'angry', 'ACEITE.')],
      'fight': [(None, 'angry', 'ENTÃO SINTAM O TEMPO!')],
      'after': [(None, 'sad', '...')],
    },
    'baby_after': {'a': [('', None, 'O Bebé do Tempo resmunga a dormir. Ou conta os anos que lhe devem.')]},
    'bill_final': {
      'ally': [(None, 'neutral', 'Chegaram. Três portões: restaurar, sacrificar, dominar.'),
               (None, 'sad', 'Eu já escolhi uma vez. Fechei. Não vos vou dizer o que escolher.'),
               (None, 'neutral', 'Só isto: tudo o que fizeram até aqui conta.')],
      'amb': [(None, 'smug', 'O portão de Euclydia é o mais bonito, não acham?'), (None, 'smug', 'Escolham. Eu fico a ver. Adoro ver.')],
    },
    'bill_final_threat': {'a': [(None, 'angry', 'A ESCOLHA É VOSSA, PINES. MAS EU SEI BEM QUAL ESCOLHERIA.'), ('', None, 'Quando ele fala, o portão de Euclydia brilha mais.')]},
    'ford_final': {
      'a': [(None, 'thinking', 'Restaurar o tempo funciona melhor quando a dívida temporal é pequena e as pessoas confiam umas nas outras.'),
            (None, 'sad', 'Sacrificar custa sempre alguém.'), (None, 'angry', 'Dominar... é o que o Bill faria.')],
    },
    'gate_restore': {'a': [('', None, 'Fechar as fendas por dentro e devolver cada segundo ao seu lugar. Tudo o que fizeram até aqui decide se o tempo aceita.')]},
    'gate_sacrifice': {'a': [('', None, 'Para fechar tudo depressa, alguma coisa tem de ficar do lado de lá: o estabilizador, a fita temporal... e uma memória.')]},
    'gate_dominate': {'a': [('', None, 'Segurar as linhas temporais nas vossas mãos. Ninguém voltaria a apagar Gravity Falls, porque seriam vocês a decidir tudo.')]},
  },
}

CHOICES = {
  ('professor', 'p1'): ['Vejo coisas que não estão lá. Formas a tremer.', 'Não vejo nada, professor. Eles inventam.'],
  ('telescope_vision', 'v2'): ['Corro a contar ao Professor Círculo.', 'Guardo isto para mim. A descoberta é MINHA.'],
}


def main():
    for arc, spec in B.items():
        p = f'src/data/dialogues/{arc}.json'
        dlgs = json.load(open(p, encoding='utf8'))
        by = {d['id']: d for d in dlgs}
        for did, nodes in spec.items():
            d = by[did]
            for nid, beats in nodes.items():
                n = d['nodes'][nid]
                if n.get('_rewritten'):
                    continue
                first = beats[0]
                if first[0] is not None:
                    n['speaker'] = NAMES.get(first[0], first[0])
                n['text'] = first[2]
                if first[1]:
                    n['mood'] = first[1]
                prev = n
                tail_choices, tail_next = n.pop('choices', None), n.pop('next', None)
                for i, (who, mood, text) in enumerate(beats[1:], start=2):
                    bid = f'{nid}__{i}'
                    node = {'id': bid, 'speaker': n['speaker'] if who is None else NAMES.get(who, who), 'text': text}
                    if mood:
                        node['mood'] = mood
                    d['nodes'][bid] = node
                    prev['next'] = bid
                    prev = node
                if tail_choices:
                    prev['choices'] = tail_choices
                if tail_next:
                    prev['next'] = tail_next
        for (did, nid), texts in CHOICES.items():
            if did in by:
                node = by[did]['nodes'][nid]
                # choices may have moved to the last beat
                while 'choices' not in node and node.get('next', '').startswith(nid + '__'):
                    node = by[did]['nodes'][node['next']]
                for c, t in zip(node.get('choices', []), texts):
                    c['text'] = t
        json.dump(dlgs, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
        print('rewrote', p)


if __name__ == '__main__':
    main()
