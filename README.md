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
css/style.css       toda a folha de estilo, incluindo o tema claro
js/                 um módulo por área do app (ver ordem abaixo)
netlify/functions/  API — CRUD compartilhado em _crud.js; um arquivo curto por recurso;
                    _ala.js dá o nome dos stores da ala
sw.js               service worker: cache offline e atualização
version.json        versão publicada — o app instalado se compara com ela
scripts/versao.mjs  sobe a versão nos quatro lugares de uma vez
```

As seis coleções simples (agenda, reuniões, designações, sacramentais,
acompanhamentos, eventos) são funções de 3 linhas que delegam a
`netlify/functions/_crud.js` (o prefixo `_` faz o Netlify não tratá-lo como rota).
`membros` e `notas` têm lógica própria. Todas respondem em `/api/<recurso>`.

### Módulos JavaScript

ES Modules: o `index.html` carrega só `js/main.js`, que importa todos os
módulos; cada um declara as próprias dependências com `import`.

| Arquivo | Responsabilidade |
| --- | --- |
| `dados-membros.js` | Começa vazio (o arquivo é público); o quadro vem do PDF do LCR e fica no servidor |
| `config.js` | Constantes, estado global (`DADOS`) e nome da ala |
| `utils.js` | Formatação de data e `esc()` (escape de HTML para innerHTML) |
| `ui.js` | Troca de abas e abertura/fechamento de modais |
| `dialogo.js` | `confirmar()` e `pedirTexto()` — substituem prompt/confirm nativos |
| `chamados.js` | Nomes de quem ocupa cada chamado — ficam no servidor, editáveis no app |
| `usuario.js` | Identificação por cargo e regra de sigilo (`podeVer`) |
| `api.js` | Chamadas ao servidor, indicador de sincronização e carga inicial |
| `offline-pwa.js` | Fila offline em IndexedDB, service worker e instalação |
| `tema.js` | Tema claro/escuro e tamanho da fonte |
| `agenda.js` | Agenda de entrevistas, convite por WhatsApp e tela de confirmação |
| `acompanhamento.js` | Aba Acompanhamento |
| `reunioes.js` | Reuniões administrativas |
| `designacoes.js` | Designações do bispado |
| `calendario.js` | Calendário da ala e da estaca |
| `sacramental.js` | Planejador e ata da reunião sacramental |
| `membros.js` | Entradas, saídas e histórico de membros |
| `membros-import.js` | Leitura do PDF de membros do LCR |
| `notas.js` | Notas privadas (aparelho) e compartilhadas (nuvem) |
| `manual.js` | Manual Geral, links oficiais e roteiros de entrevista |
| `pdf.js` | Geração das atas em PDF |
| `busca.js` | Busca global |
| `inicio.js` | Tela de boas-vindas (aba Início, a primeira ao abrir): saudação, resumo, pendências e atalhos |
| `app.js` | Botão flutuante e inicialização |

### ES Modules

O app carrega como **ES Modules** desde a v5.3.0, e a migração terminou na
v5.4.0: não existe mais `onclick=` (nem outro handler inline) na marcação e
nada é exposto no `window`. Os eventos usam delegação — o HTML marca a ação
com `data-act` e cada módulo liga os seus numa função `ligar<Área>()`.

- **Arquivo novo em `js/`** → importar em `js/main.js` e incluir em `ASSETS` no `sw.js`.
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
