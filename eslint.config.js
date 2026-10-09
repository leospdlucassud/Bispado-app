// ESLint (configuração "flat", ESLint 10). Rodar com `npm run lint`.
// Sem dependência instalada: o npx baixa o ESLint na hora, e as regras são
// escritas aqui (em vez de importar @eslint/js) para não exigir node_modules.
// Só regras que apontam erro de verdade — nada de estilo.
const REGRAS = {
  'no-undef': 'error',               // variável que não existe (ex.: função que saiu do window)
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-dupe-else-if': 'error',
  'no-unreachable': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-const-assign': 'error',
  'no-import-assign': 'error',
  'no-func-assign': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-finally': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-compare-neg-zero': 'error',
  'no-constant-binary-expression': 'error',
  'no-loss-of-precision': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-sparse-arrays': 'error',
  'no-unused-private-class-members': 'error',
  'no-useless-backreference': 'error',
  'no-shadow-restricted-names': 'error',
  'no-delete-var': 'error',
  'no-with': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
};

const comuns = [
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'structuredClone', 'URL', 'URLSearchParams', 'fetch', 'Request', 'Response', 'Headers',
  'AbortController', 'AbortSignal', 'Blob', 'TextEncoder', 'TextDecoder', 'atob', 'btoa',
  'crypto', 'performance', 'Intl', 'FormData',
];
const navegador = [
  ...comuns, 'window', 'document', 'navigator', 'location', 'history', 'localStorage',
  'sessionStorage', 'indexedDB', 'caches', 'matchMedia', 'getComputedStyle', 'requestAnimationFrame',
  'cancelAnimationFrame', 'alert', 'confirm', 'prompt', 'Event', 'CustomEvent', 'KeyboardEvent',
  'HTMLElement', 'Node', 'NodeFilter', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'FileReader', 'Image', 'DOMParser', 'CSS', 'screen', 'scrollTo', 'open', 'print', 'self',
  'IDBKeyRange', 'BroadcastChannel', 'visualViewport', 'innerWidth', 'innerHeight', 'addEventListener',
  'removeEventListener', 'dispatchEvent', 'devicePixelRatio', 'isSecureContext',
  // bibliotecas carregadas por <script> (pdf.js e jsPDF, sob demanda)
  'pdfjsLib', 'jspdf',
];
const lista = nomes => Object.fromEntries(nomes.map(n => [n, 'readonly']));

export default [
  { ignores: ['vendor/**', 'node_modules/**', 'dist/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: lista(navegador) },
    rules: REGRAS,
  },
  {
    // script clássico do <head> (não é módulo)
    files: ['js/redirecionar-convite.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2024, sourceType: 'script',
      globals: lista([...comuns, 'self', 'caches', 'clients', 'location', 'indexedDB', 'registration']),
    },
    rules: REGRAS,
  },
  {
    files: ['netlify/**/*.js', 'netlify/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2024, sourceType: 'module',
      globals: lista([...comuns, 'process', 'Buffer', 'global', 'globalThis']),
    },
    rules: REGRAS,
  },
];
