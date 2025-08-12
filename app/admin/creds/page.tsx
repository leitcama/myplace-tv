"use client";
import { useEffect, useState } from "react";

export default function CredsPage(){
  const [cookie, setCookie] = useState("");
  const [status, setStatus] = useState<string>("");

  async function submit(){
    try{
      setStatus("Saving...");
      const r = await fetch("/api/ytcreds", { method: "POST", headers: { "content-type":"application/json" }, body: JSON.stringify({ cookie }) });
      const j = await r.json();
      setStatus(r.ok ? `Saved. hasCookie=${String(j.status?.hasCookie)} len=${j.status?.cookieLen}` : `Error: ${j.error||r.status}`);
    } catch(e:any){ setStatus(`Error: ${e?.message||String(e)}`); }
  }

  useEffect(()=>{ (async()=>{
    try{ const r = await fetch("/api/ytcreds"); const j = await r.json(); setStatus(`hasCookie=${String(j.status?.hasCookie)} len=${j.status?.cookieLen}`); } catch{}
  })(); },[]);

  return (
    <main className="min-h-screen bg-black text-white p-4 space-y-4">
      <h1 className="text-lg font-semibold">YouTube Cookies</h1>
      <p className="text-sm opacity-75">Paste your youtube.com Cookie header value below and press Save. This enables direct playback.</p>
      <textarea className="w-full h-40 bg-white/5 border border-white/10 rounded p-2 font-mono text-xs" value={cookie} onChange={e=>setCookie(e.target.value)} placeholder="Paste Cookie: SID=...; HSID=...; ..." />
      <button onClick={submit} className="px-4 py-2 rounded bg-white/10 border border-white/20">Save</button>
      <div className="text-xs opacity-80">{status}</div>
    </main>
  );
}