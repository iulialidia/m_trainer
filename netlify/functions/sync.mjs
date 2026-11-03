// Cloud copy of the app's progress, so the laptop and the iPhone share one notebook.
// Stored in Netlify Blobs (built into Netlify, no setup needed), one entry per sync code.
//   GET  /.netlify/functions/sync?code=...           → { doc, ver }   (doc = null if nothing saved yet)
//   PUT  /.netlify/functions/sync  { code, doc, baseVer } → { ver }
//        409 + { doc, ver } if the cloud copy changed since baseVer (the app then merges and retries)
import { getStore } from "@netlify/blobs";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function keyFor(code) {
  const data = new TextEncoder().encode("m-trainer|" + code.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return "p/" + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: cors });
  try {
    const store = getStore({ name: "m-trainer-sync", consistency: "strong" });
    if (req.method === "GET") {
      const code = new URL(req.url).searchParams.get("code") || "";
      if (code.trim().length < 6) return json({ error: "code too short" }, 400);
      const entry = await store.get(await keyFor(code), { type: "json" });
      return json(entry || { doc: null, ver: 0 });
    }
    if (req.method === "PUT") {
      const { code, doc, baseVer } = await req.json();
      if (typeof code !== "string" || code.trim().length < 6 || !doc || typeof doc !== "object") return json({ error: "bad request" }, 400);
      const body = JSON.stringify(doc);
      if (body.length > 4_000_000) return json({ error: "too big" }, 413);
      const key = await keyFor(code);
      const cur = (await store.get(key, { type: "json" })) || { doc: null, ver: 0 };
      if ((cur.ver || 0) !== (baseVer || 0)) return json(cur, 409);     // someone else saved first → merge on the device
      const ver = (cur.ver || 0) + 1;
      await store.setJSON(key, { doc, ver, savedAt: new Date().toISOString() });
      return json({ ver });
    }
    return json({ error: "GET or PUT only" }, 405);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 502);
  }
};
