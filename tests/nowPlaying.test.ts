import { describe, it, expect } from "vitest";
import { positionAt, nextIndex, nextN, totalDuration } from "@/lib/schedule/now";
import type { ChannelConfig, ChannelItem } from "@/lib/schedule/types";

const items: ChannelItem[] = [
  { kind: "yt", id: "a", title: "A", duration: 10 },
  { kind: "yt", id: "b", title: "B", duration: 20 },
  { kind: "bump", slug: "x", title: "X", duration: 5 }
] as any;

const cfg: ChannelConfig = {
  channel: "Test",
  epochStart: new Date("2025-01-01T00:00:00Z").toISOString(),
  items,
  bumpers: { x: { kind: "yt", id: "bump-id" } }
};

describe("schedule math", () => {
  it("computes totalDuration", () => {
    expect(totalDuration(items)).toBe(35);
  });

  it("positionAt at epochStart is first item offset 0", () => {
    const pos = positionAt(new Date(cfg.epochStart), cfg.epochStart, cfg.items);
    expect(pos).toEqual({ index: 0, offset: 0 });
  });

  it("positionAt progresses within first item", () => {
    const t = new Date(new Date(cfg.epochStart).getTime() + 7_000);
    const pos = positionAt(t, cfg.epochStart, cfg.items);
    expect(pos).toEqual({ index: 0, offset: 7 });
  });

  it("wraps to second item after 10s", () => {
    const t = new Date(new Date(cfg.epochStart).getTime() + 10_000);
    const pos = positionAt(t, cfg.epochStart, cfg.items);
    expect(pos).toEqual({ index: 1, offset: 0 });
  });

  it("wrap-around to start after full cycle", () => {
    const total = totalDuration(items) * 1000;
    const t = new Date(new Date(cfg.epochStart).getTime() + total);
    const pos = positionAt(t, cfg.epochStart, cfg.items);
    expect(pos).toEqual({ index: 0, offset: 0 });
  });

  it("nextIndex cycles", () => {
    expect(nextIndex(0, items as any)).toBe(1);
    expect(nextIndex(1, items as any)).toBe(2);
    expect(nextIndex(2, items as any)).toBe(0);
  });

  it("nextN produces correct eta and order", () => {
    const base = new Date(cfg.epochStart);
    const list = nextN(cfg, base, 3);
    expect(list.length).toBe(3);
    expect(list[0].title).toBe("B");
    expect(new Date(list[0].etaISO).getTime()).toBe(base.getTime() + 10_000);
  });
});