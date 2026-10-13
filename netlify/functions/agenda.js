import { crudHandler } from "./_crud.js";

// itens sigilosos só com a sessão de Bispo ou ADM (ver _sessao.js)
export default crudHandler("agenda", { sigilo: true });

export const config = { path: "/api/agenda" };
