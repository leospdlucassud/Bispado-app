# Painel do Bispado

Aplicativo web (PWA) de apoio administrativo ao bispado de uma ala.
Funciona instalado no celular e continua utilizável sem conexão.

## Como publicar

Projeto estático servido pelo Netlify, com funções serverless para os dados.
Não há build: o que está no repositório é o que vai para o ar.

```bash
netlify deploy --prod
```

Para outra ala, troque **uma única linha** em `js/config.js`:

```js
const ALA = 'Ala Queimados';
```

## Estrutura

```
index.html          apenas a marcação: cabeçalho, abas, painéis e modais
css/style.css       toda a folha de estilo, incluindo o tema claro
js/                 um módulo por área do app (ver ordem abaixo)
netlify/functions/  API — CRUD compartilhado em _crud.js; um arquivo curto por recurso
sw.js               service worker: cache offline e atualização
```

As seis coleções simples (agenda, reuniões, designações, sacramentais,
acompanhamentos, eventos) são funções de 3 linhas que delegam a
`netlify/functions/_crud.js` (o prefixo `_` faz o Netlify não tratá-lo como rota).
`membros` e `notas` têm lógica própria. Todas respondem em `/api/<recurso>`.

### Módulos JavaScript

Carregados como scripts clássicos, **na ordem declarada no `index.html`** —
os primeiros definem o que os seguintes usam, e `app.js` fecha a inicialização.

| Arquivo | Responsabilidade |
| --- | --- |
| `dados-membros.js` | Quadro de membros embutido; substituído ao importar o PDF do LCR |
| `config.js` | Constantes, estado global (`DADOS`) e nome da ala |
| `utils.js` | Formatação de data e `esc()` (escape de HTML para innerHTML) |
| `ui.js` | Troca de abas e abertura/fechamento de modais |
| `dialogo.js` | `confirmar()` e `pedirTexto()` — substituem prompt/confirm nativos |
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
| `app.js` | Botão flutuante e inicialização |

### Migração para ES Modules (em andamento)

Desde a v5.3.0 o app carrega como **ES Modules**: `index.html` tem uma única
tag `<script type="module" src="js/main.js">`, e `main.js` importa o grafo de
módulos. Cada arquivo `js/` usa `export` nos seus símbolos.

**Ponte temporária:** como o HTML ainda usa `onclick="..."` (que só enxerga o
escopo global), `main.js` copia todos os `export` de cada módulo para o `window`.
Isso mantém os handlers inline funcionando. A ponte será removida por fases,
trocando os `onclick` por `addEventListener` (delegação de evento) área por área.
Até lá, ao adicionar uma função chamada por `onclick`, garanta que ela tem `export`.

## Pontos de atenção

- **Sigilo não é segurança.** `podeVer()` esconde itens sigilosos de quem não
  está identificado como Bispo, mas não há senha e os dados ficam no mesmo
  banco. Serve para não expor um assunto delicado na tela errada. Para o que
  não pode sair do aparelho do bispo, use as Notas privadas.
- **Ao criar uma tela que liste entrevistas ou acompanhamentos**, aplique o
  filtro `podeVer` também no contador e na busca, não só na lista.
- **Ao alterar qualquer arquivo**, suba a versão no rodapé do `index.html` e o
  `CACHE` do `sw.js` — senão o navegador continua servindo a versão antiga.
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

`MAJOR.MINOR.PATCH` no rodapé do `index.html`.
Maior para reestruturações, menor para funcionalidades novas, patch para correções.
