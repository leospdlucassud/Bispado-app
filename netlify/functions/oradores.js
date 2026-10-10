import { crudHandler } from "./_crud.js";

// Ajustes do rodízio de discursos por pessoa (organização, posição preferida,
// discurso anterior ao app, pausa). Esparsa: só quem tem ajuste ou foi
// adicionado à mão. Nunca guarda telefone nem motivo — a API não tem senha.
export default crudHandler("oradores", { unicoPor: "chave" });

export const config = { path: "/api/oradores" };
