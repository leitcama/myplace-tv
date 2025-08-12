export type TelemetryEvent = {
  ts: string;
  type: string;
  data?: Record<string, unknown>;
};

class TelemetryStore {
  private events: TelemetryEvent[] = [];
  private maxEvents = 200;

  add(event: TelemetryEvent) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  getEvents(): TelemetryEvent[] { return [...this.events].reverse(); }

  getSummary() {
    const counts: Record<string, number> = {};
    for (const e of this.events) { counts[e.type] = (counts[e.type] ?? 0) + 1; }
    return { total: this.events.length, counts };
  }
}

// Singleton instance (module scoped)
export const telemetry = new TelemetryStore();