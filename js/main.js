// =============================================
// PONTO DE ENTRADA (ES Modules)
// Cada módulo declara suas próprias dependências com `import`, então aqui basta
// carregá-los todos: o import solto garante que módulos que ninguém importa
// (tema, offline-pwa) também avaliem e registrem seus listeners (`ligar*()`).
// A ordem abaixo é só de leitura — quem manda na avaliação é o grafo de imports.
//
// Arquivo novo em js/ → incluir aqui E em ASSETS no sw.js.
// =============================================
import './dados-membros.js';
import './config.js';
import './utils.js';
import './ui.js';
import './dialogo.js';
import './usuario.js';
import './api.js';
import './offline-pwa.js';
import './tema.js';
import './agenda.js';
import './acompanhamento.js';
import './reunioes.js';
import './designacoes.js';
import './calendario.js';
import './sacramental.js';
import './membros.js';
import './membros-import.js';
import './notas.js';
import './manual.js';
import './pdf.js';
import './busca.js';
import './app.js';
