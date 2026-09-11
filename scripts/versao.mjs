#!/usr/bin/env node
// =============================================
// VERSÃO DO APP — atualiza todos os lugares de uma vez
//
//   node scripts/versao.mjs            → mostra a versão atual e confere
//   node scripts/versao.mjs patch      → 5.14.0 → 5.14.1
//   node scripts/versao.mjs minor      → 5.14.0 → 5.15.0
//   node scripts/versao.mjs major      → 5.14.0 → 6.0.0
//   node scripts/versao.mjs 5.20.3     → define exatamente
//   node scripts/versao.mjs 5.13.0 --forcar   → permite voltar atrás
//
// Precisam andar juntos: js/config.js (o que o app acha que é), version.json
// (o que está publicado) e o CACHE do sw.js (invalida o cache) — divergindo, o
// app instalado pode achar que está desatualizado sem estar. O package.json vai
// junto só para não ficar um número parado lá.
// =============================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Cada alvo sabe se achar e se reescrever, para o script não depender de formatação.
const ALVOS = [
  {
    nome: 'js/config.js',
    arquivo: join(RAIZ, 'js/config.js'),
    achar: /export const VERSAO = '([^']+)';/,
    trocar: (s, v) => s.replace(/export const VERSAO = '[^']+';/, `export const VERSAO = '${v}';`),
  },
  {
    nome: 'version.json',
    arquivo: join(RAIZ, 'version.json'),
    achar: /"versao"\s*:\s*"([^"]+)"/,
    trocar: (s, v) => s.replace(/"versao"\s*:\s*"[^"]+"/, `"versao": "${v}"`),
  },
  {
    // nao e lido pelo app, mas um numero parado aqui confunde quem abre o arquivo
    nome: 'package.json',
    arquivo: join(RAIZ, 'package.json'),
    achar: /"version"\s*:\s*"([^"]+)"/,
    trocar: (s, v) => s.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${v}"`),
  },
  {
    nome: 'sw.js',
    arquivo: join(RAIZ, 'sw.js'),
    achar: /const CACHE = 'bispado-app-v([^']+)';/,
    trocar: (s, v) => s.replace(/const CACHE = 'bispado-app-v[^']+';/, `const CACHE = 'bispado-app-v${v}';`),
  },
];

function lerAtual() {
  return ALVOS.map(alvo => {
    let texto;
    try { texto = readFileSync(alvo.arquivo, 'utf8'); }
    catch { throw new Error(`Não consegui ler ${alvo.nome}`); }
    const m = texto.match(alvo.achar);
    if (!m) throw new Error(`Não achei a versão em ${alvo.nome} — o formato mudou?`);
    return { ...alvo, texto, versao: m[1] };
  });
}

// Compara por número: como texto, '5.9.0' seria maior que '5.13.0'.
function comparar(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function proxima(atual, tipo) {
  const [ma, mi, pa] = atual.split('.').map(n => parseInt(n, 10) || 0);
  if (tipo === 'major') return `${ma + 1}.0.0`;
  if (tipo === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

const args = process.argv.slice(2);
const forcar = args.includes('--forcar');
const alvo = args.find(a => a !== '--forcar');

let estado;
try { estado = lerAtual(); }
catch (e) { console.error('✗ ' + e.message); process.exit(1); }

const divergentes = new Set(estado.map(e => e.versao)).size > 1;

// Sem argumento: só relata
if (!alvo) {
  console.log('Versão em cada lugar:');
  estado.forEach(e => console.log(`  ${e.nome.padEnd(14)} ${e.versao}`));
  if (divergentes) {
    console.error('\n✗ DIVERGENTES — rode: node scripts/versao.mjs <versao> --forcar');
    process.exit(1);
  }
  console.log(`\n✓ Consistente: ${estado[0].versao}`);
  console.log('Para subir: node scripts/versao.mjs patch|minor|major|<versao>');
  process.exit(0);
}

if (divergentes && !forcar) {
  console.error('✗ Os três estão divergentes:');
  estado.forEach(e => console.error(`  ${e.nome.padEnd(14)} ${e.versao}`));
  console.error('Use --forcar para alinhar todos na versão informada.');
  process.exit(1);
}

const atual = estado[0].versao;
const nova = ['patch', 'minor', 'major'].includes(alvo) ? proxima(atual, alvo) : alvo;

if (!/^\d+\.\d+\.\d+$/.test(nova)) {
  console.error(`✗ "${nova}" não é uma versão válida (use 5.14.1)`);
  process.exit(1);
}
if (comparar(nova, atual) <= 0 && !forcar) {
  console.error(`✗ ${nova} não é maior que a atual (${atual}).`);
  console.error('  Voltar atrás deixa o app instalado à frente do servidor e ele não atualiza.');
  console.error('  Se é mesmo o que você quer: --forcar');
  process.exit(1);
}

estado.forEach(e => writeFileSync(e.arquivo, e.trocar(e.texto, nova), 'utf8'));

// Confere relendo, em vez de confiar na escrita
const depois = lerAtual();
const ok = depois.every(e => e.versao === nova);
depois.forEach(e => console.log(`  ${e.nome.padEnd(14)} ${e.versao}`));
if (!ok) { console.error('\n✗ Algum arquivo não ficou com a versão nova.'); process.exit(1); }
console.log(`\n✓ ${atual} → ${nova} em todos os arquivos.`);
console.log('  Falta: commit + push (o Netlify publica sozinho).');
