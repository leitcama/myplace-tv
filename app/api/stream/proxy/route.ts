export const dynamic = "force-dynamic";

function isAllowedUrl(u: URL){
  const host = u.hostname.toLowerCase();
  return host.endsWith("googlevideo.com") || host.endsWith("ytcdn.googlevideo.com");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  if (!u) return new Response(JSON.stringify({ error: "missing_u" }), { status: 400, headers: { "content-type": "application/json" } });
  let target: URL;
  try { target = new URL(u); } catch { return new Response(JSON.stringify({ error: "bad_u" }), { status: 400, headers: { "content-type": "application/json" } }); }
  if (!isAllowedUrl(target)) return new Response(JSON.stringify({ error: "forbidden_host" }), { status: 400, headers: { "content-type": "application/json" } });

  const range = req.headers.get("range") || undefined;
  const upstream = await fetch(target.toString(), { headers: { ...(range ? { range } : {}) } });
  const headers = new Headers();
  // Pass through key headers
  const pass = ["content-type", "content-length", "accept-ranges", "content-range", "etag", "last-modified", "date", "cache-control"];
  pass.forEach(k => { const v = upstream.headers.get(k); if (v) headers.set(k, v); });
  headers.set("x-proxy", "yt-direct");
  // Avoid CORS issues (same-origin src) but set anyway
  headers.set("access-control-allow-origin", "*");

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}