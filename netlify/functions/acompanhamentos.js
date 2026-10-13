import { crudHandler } from "./_crud.js";

// itens sigilosos só com a sessão de Bispo ou ADM (ver _sessao.js)
export default crudHandler("acompanhamentos", { sigilo: true });

export const config = { path: "/api/acompanhamentos" };
