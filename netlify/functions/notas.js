import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const STORE_NAME = "notas";
const KEY = "all";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const store = getStore(STORE_NAME);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // GET — return all
  if (req.method === "GET") {
    try {
      const raw = await store.get(KEY);
      const data = raw ? JSON.parse(raw) : [];
      return new Response(JSON.stringify(data), { headers: CORS });
    } catch {
      return new Response("[]", { headers: CORS });
    }
  }

  // POST — add
  if (req.method === "POST") {
    const body = await req.json();
    body.id = body.id || "n_" + Date.now();
    body.criadaEm = body.criadaEm || new Date().toISOString();
    let data = [];
    try { const raw = await store.get(KEY); data = raw ? JSON.parse(raw) : []; } catch {}
    data.push(body);
    await store.set(KEY, JSON.stringify(data));
    return new Response(JSON.stringify(body), { headers: CORS });
  }

  // PUT — update
  if (req.method === "PUT" && id) {
    const body = await req.json();
    let data = [];
    try { const raw = await store.get(KEY); data = raw ? JSON.parse(raw) : []; } catch {}
    data = data.map((n) => (n.id === id ? { ...n, ...body } : n));
    await store.set(KEY, JSON.stringify(data));
    return new Response(JSON.stringify(body), { headers: CORS });
  }

  // DELETE
  if (req.method === "DELETE" && id) {
    let data = [];
    try { const raw = await store.get(KEY); data = raw ? JSON.parse(raw) : []; } catch {}
    data = data.filter((n) => n.id !== id);
    await store.set(KEY, JSON.stringify(data));
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
};
