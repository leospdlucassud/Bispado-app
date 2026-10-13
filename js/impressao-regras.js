// =============================================
// REGRAS DO TOPO DA FOLHA IMPRESSA (sem DOM)
// impressao.js lê da aba aberta o que ela está mostrando — o mês, a vista, os
// filtros, as buscas — e daqui sai a linha de detalhe do topo da folha. À
// parte para os testes (tests/) rodarem direto no Node.
// =============================================

const limpo = s => String(s ?? '').replace(/\s+/g, ' ').trim();

// "Todas (6)" → "Todas": a contagem é da tela, que pode estar paginada
export const semContagem = s => limpo(s).replace(/\s*\(\d+\)$/, '');

// Sigilo: com um item sigiloso na lista, o termo da busca NÃO vai para o papel.
// O card sai mascarado ("🔒 Entrevista sigilosa · data · situação"), mas um
// "Busca: “Rosa”" logo acima dizia de quem era — e o "Ver →" da busca geral
// monta essa folha sozinho (preenche a busca da Agenda com o nome).
export function detalheDaFolha({ periodo = [], filtros = [], selecoes = [], buscas = [], temSigiloso = false } = {}) {
  const partes = [...periodo, ...filtros.map(semContagem), ...selecoes];
  const termos = buscas.map(limpo).filter(Boolean);
  if (termos.length) {
    if (temSigiloso) partes.push('Lista filtrada por uma busca (o termo não sai no papel, por sigilo)');
    else partes.push(...termos.map(t => `Busca: “${t}”`));
  }
  if (temSigiloso) partes.push('Itens sigilosos saem sem nome nem assunto');
  return [...new Set(partes.map(limpo).filter(Boolean))].join(' · ');
}
