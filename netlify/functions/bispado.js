import { crudHandler } from "./_crud.js";

// Quem ocupa cada chamado do bispado. Fica no servidor (e nao no aparelho) para
// todo mundo ver os mesmos nomes. Chamados mudam: a tela permite editar.
export default crudHandler("bispado");

export const config = { path: "/api/bispado" };
