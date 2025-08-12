import { ChannelConfig, ChannelItem, Now } from "./types";

export const totalDuration = (items: ChannelItem[]) => items.reduce((s,i)=>s + Math.max(0, i.duration||0), 0);

export function positionAt(now: Date, epochStart: string, items: ChannelItem[]): Now {
  const total = totalDuration(items); if (!total) return { index:0, offset:0 };
  const t = (((now.getTime() - new Date(epochStart).getTime())/1000) % total + total) % total;
  let acc = 0;
  for (let i=0;i<items.length;i++){ const d = items[i].duration; if (t < acc + d) return { index:i, offset:Math.floor(t-acc) }; acc += d; }
  return { index: items.length-1, offset: 0 };
}

export const nextIndex = (i:number, items:ChannelItem[]) => (i + 1) % items.length;

export function resolveVideoId(cfg: ChannelConfig, item: ChannelItem): string {
  if (item.kind === "yt" && item.id) return item.id;
  if (item.kind === "bump" && item.slug) return cfg.bumpers[item.slug]?.id || "";
  return "";
}

export function nextN(cfg: ChannelConfig, now: Date, count=36){
  const pos = positionAt(now, cfg.epochStart, cfg.items);
  const out: Array<{ title:string; kind:string; duration:number; etaISO:string }> = [];
  let t = cfg.items[pos.index].duration - pos.offset;
  let idx = pos.index;
  for (let k=0;k<count;k++){ idx = nextIndex(idx, cfg.items); const it = cfg.items[idx];
    out.push({ title: it.title, kind: it.kind, duration: it.duration, etaISO: new Date(now.getTime()+t*1000).toISOString() }); t += it.duration; }
  return out;
}
