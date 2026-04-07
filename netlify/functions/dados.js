const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  const store = getStore({ name: "bispado-queimados", consistency: "strong" });
  const { chave } = event.queryStringParameters || {};

  try {
    if (event.httpMethod === "GET") {
      if (!chave) {
        // Lista todas as chaves
        const { blobs } = await store.list();
        const resultado = {};
        for (const blob of blobs) {
          try { resultado[blob.key] = JSON.parse(await store.get(blob.key)); } catch {}
        }
        return { statusCode: 200, headers, body: JSON.stringify(resultado) };
      }
      const val = await store.get(chave);
      return { statusCode: 200, headers, body: val || "null" };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      await store.set(chave, JSON.stringify(body));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === "DELETE") {
      await store.delete(chave);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ erro: "Método não permitido" }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers, body: JSON.stringify({ erro: e.message }) };
  }
};
