// Receives the daily math report from the app and writes it into the
// "BCG Daily Tracker" Notion database (ticks "Math app", fills "Math report").
// Needs one Netlify environment variable: NOTION_TOKEN (a Notion internal integration secret).
const DB_ID = "4cfd852c-d520-4e10-a3c9-0856cf968a1c";
const APP_KEY = "m-trainer-iulia";
const NV = "2022-06-28";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function notion(path, method, body) {
  const r = await fetch("https://api.notion.com/v1/" + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NV, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${j.message || ""}`);
  return j;
}

export default async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
  if (req.method === "OPTIONS") return new Response("", { headers: cors });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
  if (!process.env.NOTION_TOKEN) return new Response("NOTION_TOKEN not set", { status: 500, headers: cors });
  try {
    const { key, date, report, practiced, workoutDone } = await req.json();
    if (key !== APP_KEY || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || typeof report !== "string")
      return new Response("bad request", { status: 400, headers: cors });
    const props = { "Math report": { rich_text: [{ text: { content: report.slice(0, 1990) } }] } };
    if (practiced) props["Math app"] = { checkbox: true };
    if (workoutDone) props["Workout"] = { checkbox: true };
    const q = await notion(`databases/${DB_ID}/query`, "POST", { filter: { property: "Date", date: { equals: date } }, page_size: 1 });
    if (q.results.length) {
      await notion(`pages/${q.results[0].id}`, "PATCH", { properties: props });
    } else {
      const [y, m, d] = date.split("-").map(Number);
      const title = `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
      await notion("pages", "POST", { parent: { database_id: DB_ID }, properties: { ...props, Day: { title: [{ text: { content: title } }] }, Date: { date: { start: date } } } });
    }
    return new Response("ok", { headers: cors });
  } catch (e) {
    return new Response("error: " + e.message, { status: 502, headers: cors });
  }
};
