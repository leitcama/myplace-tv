export const dynamic = "force-dynamic";

async function postTelemetry(req: Request, ev: { type: string; message: string; meta?: Record<string, unknown> }){
  try{
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/telemetry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ts:new Date().toISOString(), ...ev }) });
  } catch {}
}

function isAllowedUrl(u: URL){
  const host = u.hostname.toLowerCase();
  return host.endsWith("googlevideo.com") || host.endsWith("ytcdn.googlevideo.com");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u");
  const verbose = url.searchParams.get("verbose") === "1";
  if (!u) return new Response(JSON.stringify({ error: "missing_u" }), { status: 400, headers: { "content-type": "application/json" } });
  let target: URL;
  try { target = new URL(u); } catch { return new Response(JSON.stringify({ error: "bad_u" }), { status: 400, headers: { "content-type": "application/json" } }); }
  if (!isAllowedUrl(target)) return new Response(JSON.stringify({ error: "forbidden_host", host: target.hostname }), { status: 400, headers: { "content-type": "application/json" } });

  const range = req.headers.get("range") || undefined;
  try{
    const upstream = await fetch(target.toString(), { headers: { ...(range ? { range } : {}) } });
    const headers = new Headers();
    const pass = ["content-type", "content-length", "accept-ranges", "content-range", "etag", "last-modified", "date", "cache-control"];
    pass.forEach(k => { const v = upstream.headers.get(k); if (v) headers.set(k, v); });
    headers.set("x-proxy", "yt-direct");
    headers.set("access-control-allow-origin", "*");
    if (verbose) headers.set("x-verbose", "1");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  } catch (e:any) {
    try{ await postTelemetry(req, { type:"proxy_error", message:"fetch_fail", meta:{ err: e?.message } }); } catch {}
    return new Response(JSON.stringify({ error: "proxy_fail", detail: e?.message || "" }), { status: 502, headers: { "content-type": "application/json" } });
  }
}