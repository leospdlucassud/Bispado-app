// Identificador da ala nos nomes dos stores do Netlify Blobs. Trocar de ala é
// trocar só esta linha: o app passa a usar stores novos e vazios, e os dados da
// ala anterior ficam guardados no Netlify, sem acesso pelo app (não são apagados).
// O prefixo "_" faz o Netlify não tratar este arquivo como rota.
export const ALA_ID = "palmas-4";
