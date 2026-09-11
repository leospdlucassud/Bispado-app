// Quadro de membros. Começa VAZIO de propósito: este arquivo é público (o
// navegador precisa baixá-lo para o app funcionar), então nome e idade de
// membros reais não podem morar aqui. O quadro da ala vem do PDF do LCR,
// importado na aba Membros, e fica no servidor (/api/membros).
export let MEMBROS = [];

// O quadro é substituído quando chega roster do servidor ou de um PDF do LCR.
// Binding importado é somente-leitura, então a troca passa por aqui.
export function setMembros(lista) { MEMBROS = lista; }
