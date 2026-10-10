import { crudHandler } from "./_crud.js";
import { fundirDomingo, travarVagas } from "../../js/discursos-regras.js";

// Um registro por domingo: o POST de uma data que já existe junta no registro
// dela, sem trocar a vaga que outro aparelho já preencheu (fundirDomingo). E
// nem o POST nem o PUT gravam numa vaga que mudou depois que o aparelho a viu
// (travarVagas).
export default crudHandler("sacramentais", { unicoPor: "data", fundir: fundirDomingo, travar: travarVagas });

export const config = { path: "/api/sacramentais" };
