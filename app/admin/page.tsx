"use client";
import { useEffect, useMemo, useState } from "react";

export default function AdminPage(){
  const [events, setEvents] = useState<any[]>([]);
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [tick, setTick] = useState(0);

  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1), 5000); return ()=>clearInterval(id); },[]);

  useEffect(()=>{
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    fetch(`/api/telemetry?${params.toString()}`, { cache: "no-store" })
      .then(r=>r.json())
      .then(d=> setEvents(d.events||[]))
      .catch(()=>{});
  }, [type, q, limit, tick]);

  const counts = useMemo(()=>{
    const m = new Map<string, number>();
    events.forEach(e=> m.set(e.type, (m.get(e.type)||0)+1));
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
  }, [events]);

  return (
    <div className="p-4 text-white space-y-4">
      <h1 className="text-xl font-semibold">Telemetry</h1>
      <div className="flex gap-2 items-center">
        <input className="bg-black/30 border border-white/10 rounded px-2 py-1" placeholder="type (comma)" value={type} onChange={e=>setType(e.target.value)} />
        <input className="bg-black/30 border border-white/10 rounded px-2 py-1" placeholder="search" value={q} onChange={e=>setQ(e.target.value)} />
        <input className="bg-black/30 border border-white/10 rounded px-2 py-1 w-24" type="number" value={limit} onChange={e=>setLimit(Number(e.target.value)||50)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="font-medium mb-2">Counts</h2>
          <ul className="space-y-1 text-sm">
            {counts.map(([k,v])=> <li key={k} className="flex justify-between"><span>{k}</span><span className="opacity-70">{v}</span></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-medium mb-2">Recent</h2>
          <div className="max-h-[60vh] overflow-auto text-xs space-y-1">
            {events.slice().reverse().map((e,i)=> (
              <div key={i} className="bg-white/5 rounded p-2">
                <div className="opacity-70">{e.ts} · {e.type}</div>
                {e.message && <div className="font-mono break-all">{e.message}</div>}
                {e.meta && <pre className="whitespace-pre-wrap opacity-80">{JSON.stringify(e.meta)}</pre>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}