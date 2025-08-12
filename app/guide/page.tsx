import cfg from "@/public/channel.json";
import type { ChannelConfig } from "@/lib/schedule/types";
import { nextN, positionAt } from "@/lib/schedule/now";

export default async function GuidePage() {
  const config = cfg as unknown as ChannelConfig;
  const now = new Date();
  const pos = positionAt(now, config.epochStart, config.items);
  const upcoming = nextN(config, now, 36);

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-semibold mb-4">{config.channel} — Guide</h1>
      <p className="mb-6 text-sm text-white/70">Currently playing index {pos.index}. Schedule generated from server time.</p>
      <ol className="space-y-2 list-decimal pl-6">
        {upcoming.map((it, i) => (
          <li key={i} className="flex items-center justify-between">
            <div>
              <span className="font-medium">{it.title}</span>
              <span className="ml-2 text-xs uppercase text-white/60">{it.kind}</span>
            </div>
            <time className="text-white/70 text-sm">{new Date(it.etaISO).toLocaleTimeString()}</time>
          </li>
        ))}
      </ol>
    </main>
  );
}