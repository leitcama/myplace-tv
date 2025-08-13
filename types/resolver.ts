// Resolver response types
export interface ResolveResponse {
  type: 'dash' | 'hls' | 'file';
  url: string;
  expiresAt: string | null;
  cdnHost: string | null;
  tier: 'youtube' | 'piped' | 'invidious';
  clientProfile?: string;
  resolutionLadder?: ResolutionInfo[];
  correlationId: string;
  timestamp: string;
}

export interface ResolutionInfo {
  itag: number;
  quality: string;
  bitrate?: number;
  width?: number;
  height?: number;
  container: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface PlayerResponse {
  videoId: string;
  playerResponse: any;
  timestamp: string;
  clientProfile: string;
  region?: string;
}

export interface DecipherContext {
  baseJsHash: string;
  nTransform: string;
  timestamp: string;
}

// Client profiles for different YouTube clients
export type ClientProfile = 'WEB' | 'ANDROID' | 'TV' | 'IOS';

// Client configuration for different profiles
export interface ClientConfig {
  name: string;
  version: string;
  platform: string;
  userAgent: string;
  innertubeApiKey: string;
  innertubeContext: any;
}

// Regional information
export interface RegionalInfo {
  country: string;
  region: string;
  timezone: string;
  language: string;
}

// Resolver request context
export interface ResolveContext {
  videoId: string;
  clientProfile?: ClientProfile;
  region?: string;
  correlationId: string;
  userAgent?: string;
  operation: string;
}

// Error types for better error handling
export interface ResolveError {
  code: 'video_not_found' | 'age_restricted' | 'private_video' | 'region_blocked' | 'decipher_failed' | 'network_error' | 'rate_limited' | 'unknown';
  message: string;
  tier?: string;
  correlationId: string;
  timestamp: string;
}

// Cache entry types
export interface CachedResolveResult {
  result: ResolveResponse;
  cachedAt: string;
  ttl: number;
}

export interface CachedPlayerResponse {
  playerResponse: any;
  cachedAt: string;
  ttl: number;
  clientProfile: string;
  region?: string;
  baseJsHash?: string;
  signatureVersion?: string;
}