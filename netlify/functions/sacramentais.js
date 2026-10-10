import { crudHandler } from "./_crud.js";
import { fundirDomingo } from "../../js/discursos-regras.js";

// Um registro por domingo: o POST de uma data que já existe junta no registro
// dela, sem trocar a vaga que outro aparelho já preencheu (fundirDomingo).
export default crudHandler("sacramentais", { unicoPor: "data", fundir: fundirDomingo });

export const config = { path: "/api/sacramentais" };
