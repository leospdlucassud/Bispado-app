// =============================================
// PONTO DE ENTRADA (ES Modules)
// Cada módulo declara suas próprias dependências com `import`, então aqui basta
// carregá-los todos: o import solto garante que módulos que ninguém importa
// (tema, offline-pwa) também avaliem e registrem seus listeners (`ligar*()`).
// A ordem abaixo é só de leitura — quem manda na avaliação é o grafo de imports.
//
// Arquivo novo em js/ → incluir aqui E em ASSETS no sw.js. Exceções: convite.js
// (entrada da página convite.html — importá-lo aqui abriria a tela do membro) e
// redirecionar-convite.js (script clássico do <head>); esses só vão no ASSETS.
// =============================================
import './dados-membros.js';
import './config.js';
import './convite-regras.js';
import './utils.js';
import './crud-regras.js';
import './discursos-regras.js';
import './reunioes-regras.js';
import './chamados-lcr.js';
import './membros-lcr.js';
import './crescimento-lcr.js';
import './pdf-icones.js';
import './pdf-progresso.js';
import './graficos.js';
import './ui.js';
import './dialogo.js';
import './chamados.js';
import './sessao.js';
import './usuario.js';
import './api.js';
import './offline-pwa.js';
import './pendentes.js';
import './tema.js';
import './agenda.js';
import './acompanhamento.js';
import './reunioes.js';
import './designacoes.js';
import './calendario.js';
import './sacramental.js';
import './rodizio.js';
import './membros.js';
import './membros-import.js';
import './chamados-ala.js';
import './crescimento.js';
import './notas.js';
import './manual.js';
import './pdf.js';
import './busca.js';
import './inicio.js';
import './app.js';
