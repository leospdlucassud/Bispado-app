# Painel do Bispado

Aplicativo web (PWA) de apoio administrativo ao bispado de uma ala.
Funciona instalado no celular e continua utilizável sem conexão.

## Como publicar

Projeto estático servido pelo Netlify, com funções serverless para os dados.
Não há build: o que está no repositório é o que vai para o ar.

```bash
netlify deploy --prod
```

Para outra ala, troque **duas linhas** — o nome que aparece na tela e o
identificador dos dados no servidor:

```js
// js/config.js
export const ALA = 'Ala Palmas 4';

// netlify/functions/_ala.js
export const ALA_ID = "palmas-4";
```

Trocar só o `ALA` faria a ala nova ler e gravar nos dados da anterior.

## Estrutura

```
index.html          apenas a marcação: cabeçalho, abas, painéis e modais
convite.html        a página leve que o membro abre pelo link do convite
css/style.css       toda a folha de estilo, incluindo o tema claro
js/                 um módulo por área do app (ver ordem abaixo)
icons/              ícones do app instalado e sprite.svg (ícones da interface, Lucide/ISC)
vendor/             jsPDF (MIT), servido daqui; a página só o carrega ao gerar um PDF
manifest.webmanifest  nome, ícones e atalhos do app instalado
netlify/functions/  API — CRUD compartilhado em _crud.js; um arquivo curto por recurso;
                    _ala.js dá o nome dos stores da ala
netlify.toml        publicação e cabeçalhos de segurança (CSP etc.)
sw.js               service worker: cache offline e atualização
version.json        versão publicada — o app instalado se compara com ela
scripts/versao.mjs  sobe a versão nos quatro lugares de uma vez
tests/              testes das regras puras e da estrutura (`npm test`, sem dependências)
eslint.config.js    `npm run lint` — o npx baixa o ESLint na hora, só regras de erro
```

Antes de publicar: `npm test` e `npm run lint`. O teste de estrutura confere o
que já quebrou sem ninguém perceber — painel fora do lugar (3 abas ficaram em
branco por dois meses), módulo fora do `main.js` ou do cache offline, handler
inline, ícone inexistente, versões divergentes.

As sete coleções simples (agenda, reuniões, designações, sacramentais,
acompanhamentos, eventos e oradores) são funções de 3 linhas que delegam a
`netlify/functions/_crud.js` (o prefixo `_` faz o Netlify não tratá-lo como rota).
`membros` e `notas` têm lógica própria. Todas respondem em `/api/<recurso>`.

`sacramentais` e `oradores` declaram um campo único (`crudHandler(chave,
{ unicoPor })`): um POST com uma data de domingo (ou uma chave de orador) que
já existe **junta** no registro dela em vez de criar outro, e responde 200 com
o mesmo id. No domingo, `fundirDomingo` (de `discursos-regras.js`) não troca uma
vaga que outro aparelho já preencheu com outra pessoa — devolve
`_descartados: [n]`, e a fila conta isso como "recusada". A fila offline
(`pendentes.js`) junta do mesmo jeito, com a mesma função. O PUT nunca troca
`id`, `criadoEm` nem o campo único.

**`/api/convite`** é o único caminho da tela que o membro abre pelo link
(`/convite.html?id=<id>`; os links antigos, `/?confirmar=<id>`, são redirecionados
para ela). A página não carrega o app — uns 70 KB, para o celular de quem
recebe. O GET devolve só os campos daquela entrevista que a tela
mostra, e o PUT aceita só a resposta (`{ resposta, sugestao }`) — o status é
decidido no servidor. As regras ficam em `js/convite-regras.js`, sem DOM,
usadas pelo app e pela function. Não faça a tela do membro ler `/api/agenda`:
ela levaria para o celular dele as entrevistas sigilosas e as anotações do bispado.

### Módulos JavaScript

ES Modules: o `index.html` carrega só `js/main.js`, que importa todos os
módulos; cada um declara as próprias dependências com `import`. Exceções:
`convite.js` (entrada da `convite.html`) e `redirecionar-convite.js` (script
clássico do `<head>`, manda os links antigos do convite para a página nova).

| Arquivo | Responsabilidade |
| --- | --- |
| `dados-membros.js` | Começa vazio (o arquivo é público); o quadro vem do PDF do LCR e fica no servidor |
| `config.js` | Constantes, estado global (`DADOS`), nome da ala, a tabela única de cargos (`CARGOS_INFO`) e as cores de status |
| `pendentes.js` | Reaplica a fila offline sobre o que veio do servidor (sem DOM, testado) |
| `convite-regras.js` | Regras do convite sem DOM: o que o membro pode ler (`tipoNoConvite`) e o que a resposta grava |
| `crud-regras.js` | Upsert por campo único (`inserirOuMesclar`, `limparCorpo`), usado pelo servidor e pela fila (sem DOM, testado) |
| `discursos-regras.js` | Rodízio de discursos sem DOM: datas por partes, chave do nome, estado da vaga, histórico, sugestões, mensagem do WhatsApp, pendências do Início (testado) |
| `utils.js` | Formatação de data, `esc()` (escape de HTML para innerHTML), `ico()` (ícone do sprite) e `carregarScript()` |
| `ui.js` | Troca de abas e abertura/fechamento de modais |
| `dialogo.js` | `confirmar()` e `pedirTexto()` — substituem prompt/confirm nativos |
| `chamados.js` | Nomes de quem ocupa cada chamado — ficam no servidor, editáveis no app |
| `usuario.js` | Identificação por cargo e regra de sigilo (`podeVer`) |
| `api.js` | Chamadas ao servidor, indicador de sincronização e carga inicial |
| `offline-pwa.js` | Fila offline em IndexedDB, service worker e instalação |
| `tema.js` | Tema claro/escuro e tamanho da fonte |
| `agenda.js` | Agenda de entrevistas e convite por WhatsApp, e-mail ou link |
| `convite.js` | A tela do membro (`convite.html`): mostra o convite e grava a resposta |
| `redirecionar-convite.js` | Script clássico: leva `/?confirmar=<id>` para `/convite.html?id=<id>` |
| `acompanhamento.js` | Aba Acompanhamento |
| `reunioes.js` | Reuniões administrativas |
| `designacoes.js` | Designações do bispado |
| `calendario.js` | Calendário da ala e da estaca |
| `sacramental.js` | Aba Sacramental: as 3 vistas, "Atas por mês", formulário da ata (grava só o que mudou) e `gravarCamposDomingo` |
| `rodizio.js` | Vistas "Próximos domingos" e "Rodízio": vagas, seletor de orador, convite por WhatsApp, ficha da pessoa |
| `membros.js` | Entradas, saídas e histórico de membros |
| `membros-import.js` | Leitura do PDF de membros do LCR |
| `notas.js` | Notas privadas (aparelho) e compartilhadas (nuvem) |
| `manual.js` | Manual Geral, links oficiais e roteiros de entrevista |
| `pdf.js` | Geração das atas em PDF (o jsPDF só é baixado no primeiro uso) |
| `busca.js` | Busca global |
| `inicio.js` | Tela de boas-vindas (aba Início, a primeira ao abrir): saudação, resumo, pendências e atalhos |
| `app.js` | Botão flutuante e inicialização |

### ES Modules

O app carrega como **ES Modules** desde a v5.3.0, e a migração terminou na
v5.4.0: não existe mais `onclick=` (nem outro handler inline) na marcação e
nada é exposto no `window`. Os eventos usam delegação — o HTML marca a ação
com `data-act` e cada módulo liga os seus numa função `ligar<Área>()`.

- **Arquivo novo em `js/`** → importar em `js/main.js` e incluir em `ASSETS` no `sw.js`
  (o `npm test` acusa se faltar um dos dois).
- Binding importado é somente-leitura: para trocar um valor de outro módulo,
  use o setter que ele exporta (`setMembros`, `setNomesCargos`…).
- No console do navegador nada do app existe (`window.esc` é `undefined`);
  teste clicando na interface.

## Pontos de atenção

- **Sigilo não é segurança.** `podeVer()` esconde itens sigilosos de quem não
  está identificado como Bispo, mas não há senha e os dados ficam no mesmo
  banco. Serve para não expor um assunto delicado na tela errada. Para o que
  não pode sair do aparelho do bispo, use as Notas privadas.
- **Ao criar uma tela que liste entrevistas ou acompanhamentos**, aplique o
  filtro `podeVer` também no contador e na busca, não só na lista.
- **Ao alterar qualquer arquivo**, rode `node scripts/versao.mjs patch` (ou
  `minor`/`major`) — senão o navegador continua servindo a versão antiga.
- **Novo arquivo em `js/` ou `css/`** precisa entrar em `ASSETS` no `sw.js`
  para continuar disponível offline.
- Medidas em `vh` precisam ser divididas por `var(--zoom)`, porque o controle
  de tamanho de fonte usa `zoom` e o `vh` ignora essa escala.
- **Cores: use os tokens, não hex.** Texto e fundo usam `var(--text1)`,
  `var(--text-corpo)`, `var(--text2)`, `var(--text3)`, `var(--bg1..4)` — o tema
  claro só redefine esses valores no `:root`. Cor de destaque (de área, de
  status, de responsável) escrita no HTML vai como `style="--c:#34d399"`, não
  `color:#34d399`: uma regra no fim do `style.css` aplica e escurece no tema
  claro. Cor escrita direto fica presa ao tema escuro e some no creme.
- **Rodízio de discursos** (vistas da Sacramental):
  - o nome do orador mora no domingo (`orador{n}`, em ordem natural) — a ata é a
    verdade; o histórico do rodízio é derivado dos domingos, nada é guardado à parte;
  - o estado do convite (`orador{n}Status`, datas, `Por`) só vale quando
    `orador{n}Chave` é a chave do nome atual: trocar a pessoa nunca herda resposta;
  - toda escrita de domingo passa por `gravarCamposDomingo` (de `sacramental.js`),
    com só os campos que mudaram, uma por vez em cada domingo;
  - a identidade é `chavePessoa(nome)` — o `id` do membro muda a cada importação
    do LCR. Telefone, sexo e idade só saem de um membro com a chave idêntica e
    único no quadro, lidos na hora;
  - **nunca gravar** telefone do orador, motivo de pausa ou de "não convidar", nem
    histórico de recusas (a API não tem senha); a mensagem leva só o primeiro nome;
  - 5/10/15 min e "jovem no 1º discurso" são costume, não norma do Manual:
    ficam como padrões editáveis em `discursos-regras.js`.
- **Cargos: só em `CARGOS_INFO`** (de `config.js`) — código, nome, cor e ícone.
  Use `nomeDoResponsavel()`, `corDoCargo()` e `cargoInfo()`; antes cada tela
  tinha a sua cópia da tabela, e cada cópia, a sua falha. A cor de cada status
  da entrevista está nos tokens `--st-*` do `style.css` (com versão no tema claro),
  e `COR_STATUS` aponta para eles.
- **Ícones da interface:** `ico('nome')` (de `utils.js`) ou, no HTML,
  `<svg class="ico" aria-hidden="true"><use href="/icons/sprite.svg#i-nome"/></svg>`.
  Ícone novo: copie as formas de `lucide-static/icons/<nome>.svg` (versão 0.460.0)
  para um `<symbol id="i-<nome>">` no `icons/sprite.svg`. No `<select>` do
  celular as abas continuam com emoji — `<option>` não aceita SVG.
- **CSP (`netlify.toml`):** nenhum script inline, e só carregam scripts do próprio
  site e do cdnjs. Uma biblioteca ou fonte de outro endereço é bloqueada em
  silêncio (o erro só aparece no console) — inclua o endereço na política.
- **Modais: sempre por `abrirModal(id, opções)` e `fecharModal(id)`** (de `ui.js`),
  nunca mexendo na classe `open` à mão. A pilha de `ui.js` dá a todos o Esc, o
  Voltar do Android (cada modal tem uma entrada no histórico), o ✕, o toque fora,
  o "Descartar o que foi digitado?" e a volta do foco. Opções: `obrigatorio`
  (não fecha por gesto), `semConfirmacao`, `travarSeSujo` (diálogo curto que,
  com texto digitado, só fecha por ✕/Esc), `aoFechar`. Nunca chame `history.pushState`
  direto: use `registrarNoHistorico` (de `ui.js`), que respeita um Voltar em andamento. `confirmar()` e
  `pedirTexto()` (de `dialogo.js`) já usam a pilha.
- **Abas:** `switchTab(aba)` grava `#aba` no histórico — o Voltar volta para a aba
  anterior. Para só redesenhar a aba atual, nada muda (`reativarAbaAtual`).
- **Gravação sem sinal:** toda escrita passa por `apiFetch` (de `api.js`) — sem
  sinal ela vai para a fila (IndexedDB) e o módulo chama `avisarPendente()` no
  `catch`. Com algo na fila, uma escrita nova espera a fila sair. A cada carga, o
  que está na fila é reaplicado por cima dos dados (`js/pendentes.js`), e a barra
  mostra "⚠ N alterações não enviadas". Não use `fetch` direto para gravar: a
  alteração se perderia sem aviso (era o caso das notas compartilhadas).
- **Datas:** "hoje" é `dataLocal()` (de `utils.js`); `toISOString()` está em UTC
  e, depois das 21h, devolve o dia seguinte.
- **Ao inserir dados do usuário via `innerHTML`**, passe por `esc()` (de `utils.js`).
  Não crie funções de escape locais — havia 7 e foram unificadas numa só.
- **Não use `prompt`, `alert` nem `confirm` nativos.** Para perguntar algo use
  `await pedirTexto(...)`; para confirmar, `await confirmar(...)`; para avisos,
  `toast(...)`. Funções que passam a usar `await confirmar` precisam ser `async`.

## Versionamento

`MAJOR.MINOR.PATCH`: maior para reestruturações, menor para funcionalidades
novas, patch para correções.

A versão mora em quatro lugares — `VERSAO` em `js/config.js` (o rodapé mostra
esta), `version.json`, o `CACHE` do `sw.js` e o `package.json` — e **não se
edita à mão**:

```bash
node scripts/versao.mjs patch     # ou minor, major, ou a versão exata
node scripts/versao.mjs           # sem argumento: só confere se os quatro batem
```

O script recusa voltar a versão (o app instalado ficaria à frente do servidor
e nunca se atualizaria). O app instalado compara a própria versão com
`/version.json` ao abrir e se atualiza sozinho quando a publicada é maior.
