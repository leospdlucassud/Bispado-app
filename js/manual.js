// =============================================
// MANUAL & LINKS OFICIAIS
// =============================================
const MG = 'https://www.churchofjesuschrist.org/study/manual/general-handbook/';

const CAPITULOS_MANUAL = [
  { n:'7',  t:'O Bispado',                     u:MG+'7?lang=por' },
  { n:'9',  t:'Sociedade de Socorro',          u:MG+'9-relief-society?lang=por' },
  { n:'10', t:'Sacerdócio Aarônico',           u:MG+'10-aaronic-priesthood?lang=por' },
  { n:'11', t:'Moças',                         u:MG+'11-young-women?lang=por' },
  { n:'12', t:'Primária',                      u:MG+'12-primary?lang=por' },
  { n:'13', t:'Escola Dominical',              u:MG+'13-sunday-school?lang=por' },
  { n:'14', t:'Membros Solteiros',             u:MG+'14-single-members?lang=por' },
  { n:'15', t:'Seminários e Institutos',       u:MG+'15-seminaries-and-institutes?lang=por' },
  { n:'18', t:'Ordenanças e Bênçãos',          u:MG+'18-priesthood-ordinances-and-blessings?lang=por' },
  { n:'22', t:'Necessidades Temporais',        u:MG+'22-providing-for-temporal-needs?lang=por' },
  { n:'23', t:'Compartilhar o Evangelho',      u:MG+'23?lang=por' },
  { n:'24', t:'Serviço Missionário',           u:MG+'24?lang=por' },
  { n:'25', t:'Templo e História da Família',  u:MG+'25-temple-and-family-history-work?lang=por' },
  { n:'26', t:'Recomendações para o Templo',   u:MG+'26-temple-recommends?lang=por' },
  { n:'29', t:'Reuniões na Igreja',            u:MG+'29-meetings-in-the-church?lang=por' },
  { n:'30', t:'Chamados na Igreja',            u:MG+'30-callings-in-the-church?lang=por' },
  { n:'31', t:'Entrevistas e Reuniões',        u:MG+'31?lang=por' },
  { n:'32', t:'Arrependimento e Conselhos',    u:MG+'32-repentance-and-membership-councils?lang=por' },
  { n:'33', t:'Registros e Relatórios',        u:MG+'33-records-and-reports?lang=por' },
  { n:'34', t:'Finanças e Auditorias',         u:MG+'34-finances-and-audits?lang=por' },
  { n:'35', t:'Cuidado das Capelas',           u:MG+'35?lang=por' },
  { n:'38', t:'Normas e Diretrizes',           u:MG+'38-church-policies-and-guidelines?lang=por' },
];

const SITES_OFICIAIS = [
  { i:'🗂️', t:'LCR — Líderes e Secretários', d:'Registros, relatórios e finanças', u:'https://lcr.churchofjesuschrist.org' },
  { i:'📚', t:'Biblioteca do Evangelho',      d:'Manuais, revistas e mídia',        u:'https://www.churchofjesuschrist.org/study/lib?lang=por' },
  { i:'📖', t:'Escrituras',                   d:'Bíblia, Livro de Mórmon, D&C',     u:'https://www.churchofjesuschrist.org/study/scriptures?lang=por' },
  { i:'🎵', t:'Música e Hinos',               d:'Hinário e músicas da Primária',    u:'https://www.churchofjesuschrist.org/media/music?lang=por' },
  { i:'🏛️', t:'Templos',                      d:'Horários e agendamento',           u:'https://www.churchofjesuschrist.org/temples?lang=por' },
  { i:'🌳', t:'FamilySearch',                 d:'História da família',              u:'https://www.familysearch.org/pt/' },
  { i:'🏠', t:'ChurchofJesusChrist.org',      d:'Site oficial da Igreja',           u:'https://www.churchofjesuschrist.org/?lang=por' },
];

function linkCard(href, icone, titulo, sub, cor) {
  return `<a class="link-card" style="--lc:${cor}" href="${href}" target="_blank" rel="noopener">
    <span class="lc-ico">${icone}</span>
    <span class="lc-txt">
      <span class="lc-title">${titulo}</span>
      <span class="lc-sub">${sub}</span>
    </span>
  </a>`;
}

function renderManual(filtro) {
  const q = (filtro || '').trim().toLowerCase();
  const caps = document.getElementById('lista-capitulos');
  const sites = document.getElementById('lista-sites');
  const vazio = document.getElementById('manual-vazio');
  if (!caps || !sites) return;

  const filtrados = q
    ? CAPITULOS_MANUAL.filter(c => (c.n + ' ' + c.t).toLowerCase().includes(q))
    : CAPITULOS_MANUAL;

  caps.innerHTML = filtrados.map(c =>
    linkCard(c.u, `<strong style="color:#c9a84c">${c.n}</strong>`, c.t, `Capítulo ${c.n} ↗`, '#c9a84c')
  ).join('');

  if (vazio) vazio.style.display = filtrados.length ? 'none' : 'block';

  if (!sites.innerHTML) {
    sites.innerHTML = SITES_OFICIAIS.map(s =>
      linkCard(s.u, s.i, s.t, s.d + ' ↗', '#34d399')
    ).join('');
  }
}

function filtrarManual(v) { renderManual(v); }

// =============================================
// ROTEIROS DE ENTREVISTA
// Assuntos de cada entrevista, na ordem, com atalho para o texto oficial.
// O texto das perguntas não é reproduzido aqui: é material da Intellectual
// Reserve. O campo de anotações permite guardar a versão que a ala usa.
// =============================================
const MG26 = 'https://www.churchofjesuschrist.org/study/manual/general-handbook/26-temple-recommends?lang=por';

const ROTEIROS = [
  {
    id: 'recom-renovacao', icone: '🏛️', cor: '#c9a84c',
    titulo: 'Renovação de Recomendação para o Templo',
    sub: 'Bispo ou conselheiro designado · depois, presidência da estaca',
    ref: 'Cap. 26.3', url: MG26,
    temas: [
      'Testemunho do Pai Eterno, de Jesus Cristo e do Espírito Santo',
      'Testemunho da Expiação do Salvador e de Seu papel',
      'Testemunho da Restauração do evangelho',
      'Apoio ao Presidente da Igreja e às autoridades gerais e locais',
      'Envolvimento com grupos ou ensinamentos contrários à Igreja',
      'Lei da castidade',
      'Tratamento dado aos familiares',
      'Cumprimento dos convênios já feitos',
      'Esforço por manter-se digno',
      'Honestidade no trato com os outros',
      'Lei do dízimo',
      'Palavra de Sabedoria',
      'Obrigações legais e familiares, inclusive pensão e guarda',
      'Pecados graves ainda não resolvidos com o líder do sacerdócio',
      'Se considera digno de entrar na casa do Senhor',
    ],
  },
  {
    id: 'recom-primeira', icone: '⛪', cor: '#e8b040',
    titulo: 'Primeira Recomendação — Investidura e Selamento',
    sub: 'Mesmos assuntos da renovação, com preparo adicional',
    ref: 'Cap. 26.3', url: MG26,
    temas: [
      'Todos os assuntos da renovação de recomendação',
      'Compreensão dos convênios que serão feitos no templo',
      'Preparação espiritual e instrução prévia recebida',
      'Tempo de filiação e dignidade sustentada',
    ],
  },
  {
    id: 'recom-limitada', icone: '💧', cor: '#5b9bd5',
    titulo: 'Recomendação de Uso Limitado — Jovens',
    sub: 'Batismos vicários · jovens dos 11 aos 17 anos',
    ref: 'Cap. 26.3', url: MG26,
    temas: [
      'Testemunho do Pai, do Filho e do Espírito Santo',
      'Testemunho da Restauração',
      'Lei da castidade',
      'Palavra de Sabedoria',
      'Honestidade',
      'Esforço por guardar os mandamentos e ser digno',
    ],
  },
  {
    id: 'ordenacao-sa', icone: '🙏', cor: '#d4a030',
    titulo: 'Ordenação ao Sacerdócio Aarônico',
    sub: 'Diácono, mestre e sacerdote · conduzida pelo bispo',
    ref: 'Cap. 18.10',
    url: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/18-priesthood-ordinances-and-blessings?lang=por',
    temas: [
      'Testemunho do evangelho restaurado',
      'Compreensão dos deveres do ofício a receber',
      'Dignidade pessoal e disposição de guardar os mandamentos',
      'Frequência às reuniões e participação no quórum',
      'Consentimento dos pais, quando aplicável',
    ],
  },
  {
    id: 'batismo-crianca', icone: '👶', cor: '#34d399',
    titulo: 'Batismo de Criança de Registro — 8 anos',
    sub: 'Entrevista feita pelo bispo ou conselheiro designado',
    ref: 'Cap. 18.7',
    url: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/18-priesthood-ordinances-and-blessings?lang=por',
    temas: [
      'Compreensão do batismo e do convênio que fará',
      'Fé em Jesus Cristo e no arrependimento',
      'Disposição de guardar os mandamentos',
      'Compreensão do dom do Espírito Santo',
    ],
  },
  {
    id: 'jovens-anual', icone: '🧭', cor: '#a78bfa',
    titulo: 'Entrevista com Jovens',
    sub: 'Anual dos 12 aos 15 · semestral dos 16 aos 17',
    ref: 'Cap. 31.2',
    url: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/31?lang=por',
    temas: [
      'Testemunho pessoal e vida de oração',
      'Estudo das escrituras e frequência às reuniões',
      'Lei da castidade e normas de Para o Vigor da Juventude',
      'Palavra de Sabedoria',
      'Uso de mídia e internet',
      'Relacionamento com a família',
      'Preparação para o templo, a missão e o futuro',
    ],
  },
  {
    id: 'missao', icone: '✉️', cor: '#60a5fa',
    titulo: 'Preparação para a Missão',
    sub: 'Entrevista do bispo antes do formulário de recomendação',
    ref: 'Cap. 24.4',
    url: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/24?lang=por',
    temas: [
      'Testemunho e conversão pessoal',
      'Dignidade — mesmos assuntos da recomendação para o templo',
      'Saúde física e emocional',
      'Situação financeira e preparo da família',
      'Formação acadêmica e dívidas pendentes',
      'Desejo sincero de servir',
    ],
  },
  {
    id: 'dignidade', icone: '⚖️', cor: '#e07060',
    titulo: 'Dignidade e Arrependimento',
    sub: 'Somente o bispo · sigilo absoluto',
    ref: 'Cap. 32',
    url: 'https://www.churchofjesuschrist.org/study/manual/general-handbook/32-repentance-and-membership-councils?lang=por',
    temas: [
      'Ouvir sem pressa, buscando o discernimento do Espírito',
      'Natureza e circunstâncias do que foi confessado',
      'Sinceridade do arrependimento e desejo de mudar',
      'Necessidade de conselho de condição de membro',
      'Encaminhamento a apoio profissional, quando necessário',
      'Acompanhamento posterior e fortalecimento espiritual',
    ],
  },
];

const chaveNotaRoteiro = id => 'roteiro_notas_' + id;

function renderRoteiros() {
  const el = document.getElementById('lista-roteiros');
  if (!el) return;

  el.innerHTML = ROTEIROS.map(r => {
    const nota = localStorage.getItem(chaveNotaRoteiro(r.id)) || '';
    return `
    <div class="ord-card" id="rot-${r.id}">
      <div class="ord-header" onclick="toggleOrd('rot-${r.id}')">
        <div class="ord-icon">${r.icone}</div>
        <div class="ord-info">
          <div class="ord-titulo">${esc(r.titulo)}</div>
          <div class="ord-sub">${esc(r.sub)}</div>
        </div>
        <span class="ord-badge" style="background:rgba(255,255,255,.06);color:${r.cor}">${r.temas.length} temas</span>
        <span class="ord-arrow">▼</span>
      </div>
      <div class="ord-body">
        <div class="ord-autoridade"><span>📖 Manual Geral — ${esc(r.ref)}</span></div>
        <ol style="margin:10px 0 0 18px;padding:0;color:#c8d8e8;font-size:12.5px;line-height:1.8">
          ${r.temas.map(t => `<li>${esc(t)}</li>`).join('')}
        </ol>
        <div style="margin-top:12px">
          <label style="color:#8eacc8;font-size:10px;display:block;margin-bottom:4px">Anotações da ala (salvas neste aparelho)</label>
          <textarea class="form-input" rows="3" placeholder="Cole aqui o texto oficial das perguntas ou observações da entrevista…"
            style="font-size:12px;padding:8px 10px;resize:vertical"
            onchange="salvarNotaRoteiro('${r.id}', this.value)">${esc(nota)}</textarea>
        </div>
        <div class="ord-ref" style="margin-top:10px">
          <a href="${r.url}" target="_blank" rel="noopener">Abrir o texto oficial — ${esc(r.ref)} ↗</a>
        </div>
      </div>
    </div>`;
  }).join('');
}

function salvarNotaRoteiro(id, texto) {
  const t = (texto || '').trim();
  if (t) localStorage.setItem(chaveNotaRoteiro(id), t);
  else localStorage.removeItem(chaveNotaRoteiro(id));
  toast('Anotação salva');
}
