// "Lista de Membros" do LCR (js/membros-lcr.js) — `npm test`.
// O PDF de verdade tem nome, telefone, e-mail, nascimento e endereço de cada
// membro: aqui só entram listas SINTÉTICAS, montadas com a mesma geometria
// (corpo, colunas, quebras de linha e de página) e com pessoas inventadas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tipoDePdf } from '../js/chamados-lcr.js';
import { detectarAlaNoPdf, idadeDeNascimento, juntarNome, lerPdfMembros, parsearPdfMembros } from '../js/membros-lcr.js';

// ---------- gerador da lista COM a coluna Endereço (a que o LCR imprime, out/2026) ----------
// Medidas do PDF de 2026 (pdf.js, A4, y para cima): corpo 9; rótulos e células
// em Nome 41,8 | Sexo 139,8 | Idade 197 | Nascimento 232,5 | Endereço 289,7 |
// Telefone 374,1 | E-mail 444,9; cabeçalho em 668,8 na 1ª página e 741 nas
// outras, com os rótulos quebrados e centralizados; célula quebrada desce 12,3 pt
// por linha e as outras ficam no meio do registro; 19 pt de um registro ao outro.
const F = 9, PASSO = 12.3, ENTRE = 19;
const X = { nome: 41.8, sexo: 139.8, idade: 197, nasc: 232.5, end: 289.7, tel: 374.1, email: 444.9 };
const largura = (s, f = F) => s.length * f * 0.5;
const ACENTO = /^[À-ÿ]$/;

// rotulos: troca o texto de um rótulo do cabeçalho ({ sexo: 'Gênero' }), como outra versão do LCR
function listaComEndereco({ ala = 'Ala Exemplo 9 (000009)', data = '17 out. 2026', rotulos = {} } = {}) {
  const rot = { nome: 'Nome', sexo: 'Sexo', end: 'Endereço', ...rotulos };
  const paginas = [];
  let pg, y;
  const item = (str, x, yy, f = F, w = largura(str, f)) => pg.push({ str, transform: [f, 0, 0, f, x, yy], width: w, hasEOL: false });
  // Como o pdf.js entrega: cada letra acentuada é um trecho à parte, colado nos
  // vizinhos ("Fict"+"í"+"cio"); a que abre palavra vem depois de um vão, sem o espaço
  const texto = (s, x, yy) => {
    const partes = s.split(/([À-ÿ])/).filter(Boolean);
    let cx = x;
    partes.forEach((p, k) => {
      let vao = 0;
      if (p.endsWith(' ') && ACENTO.test(partes[k + 1] || '')) { p = p.slice(0, -1); vao = F * 0.27; }
      if (p) { item(p, cx, yy); cx += largura(p); }
      cx += vao;
    });
  };
  const pagina = () => {
    pg = [];
    paginas.push(pg);
    const primeira = paginas.length === 1;
    if (primeira) { item('Lista de Membros', 34.3, 732, 24); item('', 34.3, 712.1, 12, 0); item(ala, 34.3, 712.1, 12); }
    const yc = primeira ? 668.8 : 741;
    item(rot.nome, X.nome, yc); item(' ', 68.9, yc, F, 70.9);
    item(rot.sexo, X.sexo, yc); item('Idade', X.idade, yc);
    item('Data de', X.nasc, yc + PASSO); item('Nasciment', X.nasc, yc); item('o', X.nasc, yc - PASSO);
    texto(rot.end, X.end, yc);
    texto('Número de', X.tel, yc + PASSO / 2); item('Telefone', X.tel, yc - PASSO / 2);
    item('E-mail', X.email, yc);
    item(data, 28.3, 10.7); item('Somente para Uso da Igreja ©2026 by Intellectual Reserve, Inc.', 123.6, 10.7);
    item(String(paginas.length), 578.5, 10.7);
    y = yc - PASSO;   // linha de baixo do cabeçalho
  };
  pagina();
  const emLinhas = cel => Object.fromEntries(Object.entries(cel)
    .map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).filter(s => s !== '' && s != null)]));
  const altura = cels => Math.max(1, ...Object.values(cels).map(c => c.length));
  // põe as células centralizadas num registro cuja linha de cima fica em `topo`;
  // devolve o y da linha de baixo
  const por = (cels, topo) => {
    const n = altura(cels), meio = topo - PASSO * (n - 1) / 2;
    for (const [k, linhas] of Object.entries(cels)) {
      linhas.forEach((s, i) => texto(s, X[k], meio + PASSO * (linhas.length - 1) / 2 - PASSO * i));
      if (linhas.length) item(' ', X[k] + 40, meio, F, 30);   // o pdf.js devolve os vãos como itens em branco
    }
    return topo - PASSO * (n - 1);
  };
  const r = {
    paginas,
    pagina() { pagina(); return r; },
    // cel: { nome, sexo, idade, nasc, end, tel, email } — texto ou as linhas de um texto quebrado
    pessoa(cel, entre = ENTRE) {
      const cels = emLinhas(cel);
      if (y - entre - PASSO * (altura(cels) - 1) < 30) pagina();
      y = por(cels, y - entre);
      return r;
    },
    // registro partido pela quebra de página: as colunas de `noPe` ficam no pé
    // desta página, as outras no alto da seguinte
    partido(cel, noPe) {
      const cels = emLinhas(cel);
      const pe = Object.fromEntries(Object.entries(cels).filter(([k]) => noPe.includes(k)));
      const alto = Object.fromEntries(Object.entries(cels).filter(([k]) => !noPe.includes(k)));
      por(pe, 38 + PASSO * (altura(pe) - 1));
      pagina();
      y = por(alto, y - ENTRE);
      return r;
    },
    // uma linha avulsa numa coluna, `dy` pt abaixo da última (para as faixas sem M/F fora da quebra de página)
    solto(coluna, s, dy) { y -= dy; texto(s, X[coluna], y); return r; },
    contagem(n) { item(`Contagem: ${n}`, 43.3, y - 30); return r; },
  };
  return r;
}

const ENDERECO_1 = ['Quadra 12 Lote 34', 'Alameda 5, Casa 21', '00000-000 Cidade', 'Exemplo - XX'];
const PESSOAS = {
  ana: { nome: ['Exemplo Modelo, Ana', 'Clara'], sexo: 'F', idade: '34', nasc: '12 mar 1992', end: ENDERECO_1, tel: '(63) 90000-0001', email: 'ana.exemplo@example.com' },
  helio: { nome: 'Fictício, Hélio Augusto', sexo: 'M', idade: '41', nasc: ['3 jan', '1985'], end: ['Rua 7 n 99, Apto 302', 'Bloco 3'], tel: ['(63)', '90000-0002'], email: ['helio.ficticio.longo@example.co', 'm'] },
  agata: { nome: 'Amostra, Ana Ágata', sexo: 'F', idade: '8', nasc: '9 nov 2017', end: ['Qd 104 Sul 9', '99 - casa 2', '17 jun 2001 Setor'], tel: '', email: '' },
  bruno: { nome: 'Modelo, Bruno Henrique', sexo: 'M', idade: '19', nasc: '1 jan 2007', end: ['Setor Exemplo 1', 'Lote 9 (63) 3200'], tel: '(63) 90000-0004', email: 'bruno@example.com' },
  igor: { nome: 'Novo, Igor', sexo: 'M', idade: '25', nasc: '5 mai 2001', end: 'Rua 1', tel: '(63) 90000-0005', email: '' },
  carla: { nome: ['Teste Hipotético, Carla', 'Beatriz'], sexo: 'F', idade: '52', nasc: '30 set 1974', end: ['Alameda 20 Lote 1', 'Casa 3'], tel: '6390000006', email: 'carla@example.com' },
  dario: { nome: 'Simulado, Dário', sexo: 'M', idade: '67', nasc: '2 fev 1959', end: '', tel: '', email: 'dario@example.org' },
};
// o que o quadro guarda de cada um — e nada mais (o endereço fica de fora)
const ESPERADO = {
  ana: { name: 'Exemplo Modelo, Ana Clara', gender: 'F', age: 34, nascimento: '12 mar 1992', telefone: '(63) 90000-0001', email: 'ana.exemplo@example.com' },
  helio: { name: 'Fictício, Hélio Augusto', gender: 'M', age: 41, nascimento: '3 jan 1985', telefone: '(63) 90000-0002', email: 'helio.ficticio.longo@example.com' },
  agata: { name: 'Amostra, Ana Ágata', gender: 'F', age: 8, nascimento: '9 nov 2017', telefone: '', email: '' },
  bruno: { name: 'Modelo, Bruno Henrique', gender: 'M', age: 19, nascimento: '1 jan 2007', telefone: '(63) 90000-0004', email: 'bruno@example.com' },
  igor: { name: 'Novo, Igor', gender: 'M', age: 25, nascimento: '5 mai 2001', telefone: '(63) 90000-0005', email: '' },
  carla: { name: 'Teste Hipotético, Carla Beatriz', gender: 'F', age: 52, nascimento: '30 set 1974', telefone: '(63) 9000-0006', email: 'carla@example.com' },
  dario: { name: 'Simulado, Dário', gender: 'M', age: 67, nascimento: '2 fev 1959', telefone: '', email: 'dario@example.org' },
};

// Uma lista com todas as armadilhas do PDF real
function listaDeExemplo(opcoes) {
  return listaComEndereco(opcoes)
    .pessoa(PESSOAS.ana)
    .pessoa(PESSOAS.helio)
    .pessoa(PESSOAS.agata)
    .partido(PESSOAS.bruno, ['sexo', 'idade', 'nasc'])   // o M/F no pé; nome, endereço e contatos no alto da seguinte
    .pessoa(PESSOAS.igor)
    .partido(PESSOAS.carla, ['nome', 'end'])             // o nome no pé; o M/F e o resto no alto da seguinte
    .pessoa(PESSOAS.dario)
    .contagem(7);
}
const ORDEM = ['ana', 'helio', 'agata', 'bruno', 'igor', 'carla', 'dario'];

test('lista com Endereço: cada membro com os seus dados, na ordem do PDF', () => {
  const lista = listaDeExemplo();
  assert.equal(lista.paginas.length, 3, 'o gerador deveria ter partido a lista em 3 páginas');
  const leitura = lerPdfMembros(lista.paginas);
  assert.deepEqual(leitura.membros, ORDEM.map(k => ESPERADO[k]));
  assert.equal(leitura.endereco, true);
  assert.equal(leitura.contagem, 7);
  assert.equal(leitura.repetidos, 0);
  assert.deepEqual(parsearPdfMembros(lista.paginas), leitura.membros, 'parsearPdfMembros é o mesmo quadro');
  assert.equal(tipoDePdf(lista.paginas), 'membros');
  assert.deepEqual(detectarAlaNoPdf(lista.paginas), { nome: 'Ala Exemplo 9', unidade: '000009' });
});

test('o endereço não vaza para idade, nascimento, telefone nem e-mail — e não é guardado', () => {
  const { membros } = lerPdfMembros(listaDeExemplo().paginas);
  for (const m of membros) assert.deepEqual(Object.keys(m), ['name', 'gender', 'age', 'nascimento', 'telefone', 'email']);
  const tudo = JSON.stringify(membros);
  for (const pedaco of ['Quadra', 'Qd', 'Lote', 'Alameda', 'Rua', 'Casa', 'casa', 'Apto', 'Bloco', 'Setor', 'Sul', 'Cidade', '00000-000', '3200', '104'])
    assert.ok(!tudo.includes(pedaco), `"${pedaco}" do endereço apareceu no quadro`);
  // "17 jun 2001" no endereço da Ágata não vira nascimento, nem "99"/"104" vira idade
  const agata = membros.find(m => m.name.startsWith('Amostra'));
  assert.equal(agata.nascimento, '9 nov 2017');
  assert.equal(agata.age, 8);
});

test('registro partido pela quebra de página fica inteiro, e o vizinho com o seu telefone', () => {
  const { membros } = lerPdfMembros(listaDeExemplo().paginas);
  const por = n => membros.find(m => m.name.startsWith(n));
  assert.deepEqual(por('Modelo, Bruno'), ESPERADO.bruno, 'o M/F no pé e o resto na página seguinte');
  assert.deepEqual(por('Teste Hipotético'), ESPERADO.carla, 'o nome no pé e o M/F na página seguinte');
  // o 1º registro completo da página seguinte não fica com o telefone do partido
  assert.equal(por('Novo, Igor').telefone, '(63) 90000-0005');
  assert.equal(por('Simulado, Dário').email, 'dario@example.org');
});

test('acentos soltos: colados na palavra, e com espaço quando abrem palavra', () => {
  const { membros } = lerPdfMembros(listaDeExemplo().paginas);
  assert.ok(membros.some(m => m.name === 'Fictício, Hélio Augusto'));
  assert.ok(membros.some(m => m.name === 'Amostra, Ana Ágata'), 'o Á que abre o prenome vem depois de um vão');
  // com a largura, o vão decide; sem ela (PDF antigo), o acento cola na letra anterior
  const p = (txt, x, w = txt.length * 4.5) => ({ txt, x, fs: 9, w });
  assert.equal(juntarNome([p('Ana', 10), p('Á', 26), p('gata', 31.6)]), 'Ana Ágata');
  assert.equal(juntarNome([p('Fl', 10), p('á', 19), p('via', 23.5)]), 'Flávia');
  const s = (txt, x) => ({ txt, x, fs: 10, w: 0 });
  assert.equal(juntarNome([s('Fl', 10), s('á', 20), s('via', 25)]), 'Flávia');
});

test('e-mail, data e telefone quebrados em duas linhas se juntam', () => {
  const { membros } = lerPdfMembros(listaDeExemplo().paginas);
  const helio = membros.find(m => m.name.startsWith('Fictício'));
  assert.equal(helio.email, 'helio.ficticio.longo@example.com');
  assert.equal(helio.nascimento, '3 jan 1985');
  assert.equal(helio.telefone, '(63) 90000-0002');
  // o "o" de "Nascimento", quebrado uma linha abaixo do cabeçalho, não entra no 1º registro
  assert.equal(membros[0].nascimento, '12 mar 1992');
});

test('pedaço solto na célula não estraga a data, e telefone nunca fica com letra', () => {
  const lista = listaComEndereco()
    .pessoa({ ...PESSOAS.igor, nasc: ['5 mai', '2001', 'o'], tel: ['(63) 90000-0005', 'recado'] })
    .pessoa({ ...PESSOAS.dario, tel: 'ramal 12345678' })
    .contagem(2);
  const [igor, dario] = lerPdfMembros(lista.paginas).membros;
  assert.equal(igor.nascimento, '5 mai 2001');
  assert.equal(igor.telefone, '(63) 90000-0005');
  assert.equal(dario.telefone, '');
});

test('Contagem do LCR: lida para a prévia conferir', () => {
  const certa = lerPdfMembros(listaDeExemplo().paginas);
  assert.equal(certa.contagem, certa.membros.length);
  // um registro a menos (p. ex. o PDF cortado): a contagem não bate e a prévia avisa
  const lista = listaComEndereco().pessoa(PESSOAS.ana).pessoa(PESSOAS.igor).contagem(3);
  const curta = lerPdfMembros(lista.paginas);
  assert.equal(curta.membros.length, 2);
  assert.equal(curta.contagem, 3);
  // nomes iguais ficam um só — e a diferença aparece em `repetidos`
  const dupla = lerPdfMembros(listaComEndereco().pessoa(PESSOAS.igor).pessoa({ ...PESSOAS.igor, tel: '' }).contagem(2).paginas);
  assert.equal(dupla.membros.length, 1);
  assert.equal(dupla.repetidos, 1);
  assert.equal(dupla.membros[0].telefone, '(63) 90000-0005', 'fica o registro mais completo');
  assert.equal(lerPdfMembros([]).contagem, null);
  assert.deepEqual(lerPdfMembros([]).membros, []);
});

test('registros colados demais se separam pelo M/F mais perto', () => {
  const lista = listaComEndereco()
    .pessoa({ ...PESSOAS.igor, end: '' })
    .pessoa({ ...PESSOAS.dario }, 13)   // 13 pt: menos que o vão entre registros
    .contagem(2);
  assert.deepEqual(lerPdfMembros(lista.paginas).membros, [{ ...ESPERADO.igor }, ESPERADO.dario]);
});

test('linha sem M/F no meio da página fica com o registro mais perto', () => {
  const lista = listaComEndereco()
    .pessoa({ ...PESSOAS.igor, end: '' })
    .solto('nome', 'Segundo', 16)   // longe demais para a faixa do Igor, mais longe ainda da do Dário
    .pessoa(PESSOAS.dario)
    .solto('end', 'Rua 9 Lote 2', 17)   // depois do último registro: fica com ele (e é descartada)
    .contagem(2);
  assert.deepEqual(lerPdfMembros(lista.paginas).membros, [{ ...ESPERADO.igor, name: 'Novo, Igor Segundo' }, ESPERADO.dario]);
});

test('a idade que falta sai do nascimento', () => {
  const lista = listaComEndereco().pessoa({ ...PESSOAS.dario, idade: '' }).contagem(1);
  const [m] = lerPdfMembros(lista.paginas).membros;
  assert.equal(m.age, idadeDeNascimento('2 fev 1959'));
  assert.ok(m.age > 60);
});

// ---------- rótulos diferentes: o endereço nunca vai para o e-mail ----------
// Pedaços de todos os endereços desta lista — nenhum pode aparecer no quadro
const PEDACOS_DE_ENDERECO = ['Quadra', 'Qd', 'Lote', 'Alameda', 'Rua', 'Casa', 'casa', 'Apto', 'Bloco', 'Setor', 'Sul', 'Cidade', '00000-000', '3200', '104'];
const semEndereco = membros => {
  const tudo = JSON.stringify(membros);
  for (const pedaco of PEDACOS_DE_ENDERECO) assert.ok(!tudo.includes(pedaco), `"${pedaco}" do endereço apareceu no quadro`);
};

test('com o Endereço e o cabeçalho não reconhecido ("Gênero", LCR em inglês), o PDF não é lido', () => {
  for (const rotulos of [{ sexo: 'Gênero' }, { nome: 'Name', sexo: 'Gender', end: 'Address' }, { nome: 'Nombre', end: 'Dirección' }]) {
    const lista = listaDeExemplo({ rotulos });
    const leitura = lerPdfMembros(lista.paginas);
    assert.equal(leitura.endereco, true, `a coluna do endereço se reconhece pelo rótulo dela (${rotulos.end || 'Endereço'})`);
    assert.equal(leitura.semCabecalho, true, 'sem as colunas, a importação explica em vez de ler');
    assert.deepEqual(leitura.membros, [], 'o leitor pelo formato juntaria o endereço no e-mail');
    assert.equal(leitura.contagem, 7);
    assert.equal(tipoDePdf(lista.paginas), 'membros', 'segue sendo a Lista de Membros (não o "sem texto")');
  }
  assert.equal(lerPdfMembros(listaDeExemplo().paginas).semCabecalho, false);
});

test('"Address" no lugar de "Endereço", com Nome e Sexo: lido pelas colunas, como o de sempre', () => {
  const leitura = lerPdfMembros(listaDeExemplo({ rotulos: { end: 'Address' } }).paginas);
  assert.equal(leitura.endereco, true);
  assert.deepEqual(leitura.membros, ORDEM.map(k => ESPERADO[k]));
});

test('rótulo do endereço desconhecido: o leitor pelo formato tira o e-mail só da célula dele', () => {
  // "Residência" não se reconhece como Endereço: segue o leitor pelo formato, e o
  // endereço na linha do M/F ficava à esquerda do e-mail — antes, "Quadra7Lote12"
  // + "teodoro@…" passava no RE_EMAIL; o telefone fora da forma, encostado no
  // e-mail, também colava
  const lista = listaComEndereco({ rotulos: { end: 'Residência' } })
    .pessoa({ nome: 'Exemplo, Teodoro', sexo: 'M', idade: '30', nasc: '4 abr 1996', end: 'Quadra 7 Lote 12', tel: '(63) 90000-0008', email: 'teodoro@example.com' })
    .pessoa({ nome: 'Exemplo, Úrsula', sexo: 'F', idade: '28', nasc: '6 jun 1998', end: ['Qd 104 Sul', 'Alameda 9 Lote 2', 'Setor Exemplo'], tel: '', email: 'ursula@example.com' })
    .pessoa({ nome: 'Exemplo, Vítor', sexo: 'M', idade: '33', nasc: '7 jul 1993', end: '', tel: '+556390000-0009', email: 'vitor@example.com' })
    .pessoa(PESSOAS.helio)
    .contagem(4);
  const leitura = lerPdfMembros(lista.paginas);
  assert.equal(leitura.endereco, false);
  assert.equal(leitura.semCabecalho, false);
  const email = n => leitura.membros.find(m => m.name.includes(n))?.email;
  assert.equal(email('Teodoro'), 'teodoro@example.com');
  assert.equal(email('rsula'), 'ursula@example.com');
  assert.equal(email('tor'), 'vitor@example.com');
  assert.equal(email('Hélio'), 'helio.ficticio.longo@example.com', 'a linha quebrada do e-mail segue junta');
  semEndereco(leitura.membros.map(m => m.email));
});

// ---------- o formato antigo (jun/2026), SEM a coluna Endereço ----------
// Corpo 10 e sem largura (width 0); o cabeçalho em 3 linhas de Y; o nome quebra
// acima e abaixo da linha do M/F (±6,5 pt); um registro a cada 32 pt; acentos
// soltos. Lido pelo formato de cada trecho, como sempre foi.
function listaAntiga(pessoas, { ala = 'Ala Exemplo 9 (000009)', contagem = null } = {}) {
  const pg = [];
  const item = (str, x, y) => pg.push({ str, transform: [10, 0, 0, 10, x, y], width: 0, hasEOL: false });
  const texto = (s, x, y) => {
    let cx = x;
    for (const p of s.split(/([À-ÿ])/).filter(Boolean)) { item(p, cx, y); cx += p.length * 5; }
  };
  item('Lista de Membros', 40, 790); item(ala, 40, 772);
  item('Nome', 40, 720); item('Sexo', 186, 720); item('Idade', 222, 720); item('E-mail', 452, 720);
  item('Data de', 262, 726); item('Nascimento', 262, 714); item('Número de', 352, 726); item('Telefone', 352, 714);
  let y = 690;
  for (const p of pessoas) {
    const nome = Array.isArray(p.nome) ? p.nome : [p.nome];
    nome.forEach((s, i) => texto(s, 40, y + 6.5 * (nome.length - 1) - 13 * i));
    item(p.sexo, 190, y);
    if (p.idade) item(p.idade, 226, y);
    if (p.nasc) item(p.nasc, 262, y);
    if (p.tel) item(p.tel, 352, y);
    if (p.email) item(p.email, 452, y);
    y -= 32;
  }
  if (contagem != null) item(`Contagem: ${contagem}`, 40, y + 18);   // 14 pt abaixo do último registro
  item('25 jun. 2026', 30, 20); item('Somente para Uso da Igreja', 140, 20);
  return [pg];
}

test('formato antigo (sem Endereço) segue lido pelo formato, como antes', () => {
  const paginas = listaAntiga([
    { nome: ['Exemplo Modelo, Ana', 'Clara'], sexo: 'F', idade: '34', nasc: '12 mar 1992', tel: '(63) 90000-0001', email: 'ana.exemplo@example.com' },
    { nome: 'Fictício, Flávia', sexo: 'F', idade: '', nasc: '03 fev 2010', tel: '', email: '' },
    { nome: 'Novo, Igor', sexo: 'M', idade: '25', nasc: '5 mai 2001', tel: '63900000005', email: 'igor@example.com' },
  ]);
  const leitura = lerPdfMembros(paginas);
  assert.equal(leitura.endereco, false);
  assert.equal(leitura.contagem, null);
  assert.deepEqual(leitura.membros, [
    { name: 'Exemplo Modelo, Ana Clara', gender: 'F', age: 34, nascimento: '12 mar 1992', telefone: '(63) 90000-0001', email: 'ana.exemplo@example.com' },
    { name: 'Fictício, Flávia', gender: 'F', age: idadeDeNascimento('03 fev 2010'), nascimento: '03 fev 2010', telefone: '', email: '' },
    { name: 'Novo, Igor', gender: 'M', age: 25, nascimento: '5 mai 2001', telefone: '(63) 90000-0005', email: 'igor@example.com' },
  ]);
  assert.equal(tipoDePdf(paginas), 'membros');
  assert.deepEqual(detectarAlaNoPdf(paginas), { nome: 'Ala Exemplo 9', unidade: '000009' });
});

test('formato antigo com "Contagem" no fim: lida, e fora do nome do último', () => {
  const paginas = listaAntiga([
    { nome: 'Exemplar, Fábio', sexo: 'M', idade: '45', nasc: '20 abr 1981', tel: '', email: '' },
    { nome: 'Jovem, Kauã', sexo: 'M', idade: '13', nasc: '4 nov 2012', tel: '', email: '' },
  ], { contagem: 2 });
  const leitura = lerPdfMembros(paginas);
  assert.deepEqual(leitura.membros.map(m => m.name), ['Exemplar, Fábio', 'Jovem, Kauã']);
  assert.equal(leitura.contagem, 2);
});
