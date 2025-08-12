"use client";
import GuideModal from "@/components/GuideModal";
import cfg from "@/public/channel.json";
import type { ChannelConfig } from "@/lib/schedule/types";
import { nextN } from "@/lib/schedule/now";
import { useMemo, useState } from "react";

export default function GuidePage(){
  const config = cfg as unknown as ChannelConfig;
  const [open, setOpen] = useState(true);
  const items = useMemo(()=> nextN(config, new Date(), 72), [config]);
  return (
    <main className="min-h-screen bg-ink text-white px-3 py-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold mb-4">Program Guide</h1>
        <p className="opacity-80 mb-4">Here’s what’s coming up on the channel. This page is informational.</p>
        <div className="glass rounded-xl p-4">
          <ul className="divide-y divide-white/10">
            {items.map((it, i) => (
              <li key={i} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase opacity-70">{it.kind === "bump" ? "IDENT" : "Video"}</div>
                  <div className="font-medium truncate">{it.title}</div>
                </div>
                <div className="text-sm opacity-80 whitespace-nowrap">
                  {new Date(it.etaISO).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <GuideModal open={open} onClose={()=>setOpen(false)} items={items} />
    </main>
  );
}