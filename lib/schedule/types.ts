export type ItemKind = "yt" | "bump";
export type ChannelItem = { kind: ItemKind; id?: string; slug?: string; title: string; duration: number };
export type Bumper = { kind: "yt"; id: string };
export type ChannelRules = { insertBumperEvery?: number; preferBumperAtWallClock?: string[] };
export type ChannelConfig = { channel: string; epochStart: string; items: ChannelItem[]; bumpers: Record<string, Bumper>; rules?: ChannelRules; };
export type Now = { index: number; offset: number };
