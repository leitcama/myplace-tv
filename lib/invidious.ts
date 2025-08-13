import { ResolveContext } from '@/types/resolver';

// Invidious endpoints (multiple instances for redundancy)
export const INVIDIOUS_ENDPOINTS = [
  'https://invidious.projectsegfau.lt',
  'https://invidious.slipfox.xyz',
  'https://invidious.privacydev.net',
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://invidious.weblibre.org',
  'https://invidious.poast.org',
  'https://invidious.moomoo.me',
];

// Rate limiting and backoff configuration
interface EndpointState {
  lastUsed: number;
  consecutiveFailures: number;
  backoffUntil: number;
}

const endpointStates = new Map<string, EndpointState>();

// Exponential backoff with jitter
function calculateBackoff(failures: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, failures), maxDelay);
  const jitter = Math.random() * 0.1 * delay; // 10% jitter
  return delay + jitter;
}

// Get available endpoints (not in backoff)
function getAvailableEndpoints(): string[] {
  const now = Date.now();
  return INVIDIOUS_ENDPOINTS.filter(endpoint => {
    const state = endpointStates.get(endpoint);
    if (!state) return true;
    return now >= state.backoffUntil;
  });
}

// Record endpoint success/failure
function recordEndpointResult(endpoint: string, success: boolean) {
  const state = endpointStates.get(endpoint) || {
    lastUsed: 0,
    consecutiveFailures: 0,
    backoffUntil: 0,
  };
  
  state.lastUsed = Date.now();
  
  if (success) {
    state.consecutiveFailures = 0;
    state.backoffUntil = 0;
  } else {
    state.consecutiveFailures++;
    state.backoffUntil = Date.now() + calculateBackoff(state.consecutiveFailures);
  }
  
  endpointStates.set(endpoint, state);
}

// Try to resolve video using Invidious
export async function tryInvidious(videoId: string, context: ResolveContext): Promise<{
  type: 'dash' | 'hls' | 'file';
  url: string;
  title?: string;
  duration?: number;
} | null> {
  const availableEndpoints = getAvailableEndpoints();
  
  if (availableEndpoints.length === 0) {
    // All endpoints are in backoff, try the least recently used one
    const sortedEndpoints = INVIDIOUS_ENDPOINTS.sort((a, b) => {
      const stateA = endpointStates.get(a);
      const stateB = endpointStates.get(b);
      return (stateA?.lastUsed || 0) - (stateB?.lastUsed || 0);
    });
    
    if (sortedEndpoints.length > 0) {
      availableEndpoints.push(sortedEndpoints[0]);
    }
  }
  
  // Try each available endpoint
  for (const base of availableEndpoints) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${base}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': 'midwest-tv/0.1 (+https://example.com)',
          'Accept': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        recordEndpointResult(base, false);
        continue;
      }
      
      const data = await response.json();
      
      // Check if video is available
      if (!data || data.error || !data.formatStreams) {
        recordEndpointResult(base, false);
        continue;
      }
      
      // Prefer DASH, then HLS, then progressive
      const streams = data.formatStreams || [];
      
      // Find DASH manifest
      const dashStream = streams.find((s: any) => s.type === 'application/dash+xml');
      if (dashStream?.url) {
        recordEndpointResult(base, true);
        return {
          type: 'dash',
          url: dashStream.url,
          title: data.title,
          duration: data.lengthSeconds,
        };
      }
      
      // Find HLS manifest
      const hlsStream = streams.find((s: any) => s.type === 'application/x-mpegURL');
      if (hlsStream?.url) {
        recordEndpointResult(base, true);
        return {
          type: 'hls',
          url: hlsStream.url,
          title: data.title,
          duration: data.lengthSeconds,
        };
      }
      
      // Find best progressive stream
      const progressiveStreams = streams
        .filter((s: any) => s.hasAudio && s.hasVideo && s.container === 'mp4')
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (progressiveStreams.length > 0) {
        recordEndpointResult(base, true);
        return {
          type: 'file',
          url: progressiveStreams[0].url,
          title: data.title,
          duration: data.lengthSeconds,
        };
      }
      
      recordEndpointResult(base, false);
      
    } catch (error) {
      recordEndpointResult(base, false);
      console.warn(`Invidious endpoint ${base} failed:`, error);
    }
  }
  
  return null;
}

// Get Invidious endpoint statistics
export function getInvidiousStats() {
  const stats = {
    totalEndpoints: INVIDIOUS_ENDPOINTS.length,
    availableEndpoints: getAvailableEndpoints().length,
    endpointStates: {} as Record<string, any>,
  };
  
  for (const endpoint of INVIDIOUS_ENDPOINTS) {
    const state = endpointStates.get(endpoint);
    if (state) {
      stats.endpointStates[endpoint] = {
        consecutiveFailures: state.consecutiveFailures,
        lastUsed: new Date(state.lastUsed).toISOString(),
        backoffUntil: state.backoffUntil > 0 ? new Date(state.backoffUntil).toISOString() : null,
        isAvailable: Date.now() >= state.backoffUntil,
      };
    }
  }
  
  return stats;
}