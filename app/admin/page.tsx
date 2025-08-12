"use client";
import { useEffect, useState } from "react";

type TelemetryEvent = { ts:string; type:string; data?:Record<string,unknown> };

export default function Admin(){
  const [summary, setSummary] = useState<{ total:number; counts:Record<string,number> }|null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);

  async function load(){
    try{
      const r = await fetch("/api/telemetry", { cache:"no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setSummary(j.summary); setEvents(j.recent);
    } catch {}
  }

  useEffect(()=>{ load(); const id=setInterval(load, 5000); return ()=>clearInterval(id); },[]);

  return (
    <main className="min-h-screen bg-ink text-white px-3 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Admin · Telemetry</h1>
        {summary && (
          <div className="glass rounded-xl p-4">
            <div className="font-medium mb-2">Summary</div>
            <div className="text-sm opacity-80 mb-2">Total events: {summary.total}</div>
            <ul className="text-sm grid grid-cols-2 gap-2">
              {Object.entries(summary.counts).map(([k,v])=> (
                <li key={k} className="glass rounded px-3 py-2 flex items-center justify-between">
                  <span>{k}</span><span className="opacity-80">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="glass rounded-xl p-4">
          <div className="font-medium mb-2">Recent events</div>
          <ul className="divide-y divide-white/10">
            {events.map((e, i)=> (
              <li key={i} className="py-2 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-xs opacity-70">{e.ts}</div>
                  <div className="font-medium truncate">{e.type}</div>
                </div>
                <div className="text-xs opacity-70 max-w-[50%] truncate">{JSON.stringify(e.data)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}