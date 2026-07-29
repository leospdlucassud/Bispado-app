import { getStore } from "@netlify/blobs";

const STORE = "bispado-queimados";

const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function getAll(store, key) {
  try {
    const raw = await store.get(key, { type: "json" });
    if (Array.isArray(raw)) return raw;
    await store.setJSON(key, []);
    return [];
  } catch {
    await store.setJSON(key, []).catch(() => {});
    return [];
  }
}

// Cria um handler CRUD completo para uma coleção guardada em Netlify Blobs.
// Todas as coleções (agenda, reuniões, designações, etc.) compartilham este
// comportamento — muda só a chave.
export function crudHandler(key) {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

    let store;
    try { store = getStore(STORE); }
    catch (e) { return new Response(JSON.stringify({ error: "Blobs: " + e.message }), { status: 500, headers: H }); }

    const id = new URL(req.url).searchParams.get("id");

    try {
      if (req.method === "GET") {
        return new Response(JSON.stringify(await getAll(store, key)), { headers: H });
      }
      if (req.method === "POST") {
        const body = await req.json();
        const data = await getAll(store, key);
        const item = { ...body, id: Date.now().toString(), criadoEm: new Date().toISOString() };
        data.push(item);
        await store.setJSON(key, data);
        return new Response(JSON.stringify(item), { status: 201, headers: H });
      }
      if (req.method === "PUT" && id) {
        const body = await req.json();
        const data = await getAll(store, key);
        const idx = data.findIndex(i => i.id === id);
        if (idx === -1) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: H });
        data[idx] = { ...data[idx], ...body, atualizadoEm: new Date().toISOString() };
        await store.setJSON(key, data);
        return new Response(JSON.stringify(data[idx]), { headers: H });
      }
      if (req.method === "DELETE" && id) {
        const data = await getAll(store, key);
        await store.setJSON(key, data.filter(i => i.id !== id));
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: H });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: H });
    }
  };
}
