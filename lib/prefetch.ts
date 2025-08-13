import { ResolveResponse, ResolveContext } from '@/types/resolver';
import { cache, cacheKey, logWithContext } from './cache';
import { getOptimalClientProfile, detectRegion } from './clients';

// Prefetch configuration
export interface PrefetchConfig {
  enabled: boolean;
  lookAheadSeconds: number; // How far ahead to prefetch
  prefetchWindow: number; // Window in seconds before boundary to start prefetching
  maxConcurrentPrefetches: number;
  cacheTTL: number; // TTL for prefetched manifests
}

// Prefetch result
export interface PrefetchResult {
  videoId: string;
  success: boolean;
  manifest?: ResolveResponse;
  error?: string;
  prefetchedAt: string;
  expiresAt: string;
  clientProfile: string;
  region: string;
}

// Prefetch state
interface PrefetchState {
  activePrefetches: Map<string, Promise<PrefetchResult>>;
  prefetchHistory: PrefetchResult[];
  lastScheduleCheck: number;
  currentSchedule: any;
}

const prefetchState: PrefetchState = {
  activePrefetches: new Map(),
  prefetchHistory: [],
  lastScheduleCheck: 0,
  currentSchedule: null,
};

// Default prefetch configuration
export const DEFAULT_PREFETCH_CONFIG: PrefetchConfig = {
  enabled: true,
  lookAheadSeconds: 30, // Look 30 seconds ahead
  prefetchWindow: 10, // Start prefetching 10 seconds before boundary
  maxConcurrentPrefetches: 3,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// Get next video ID from schedule
async function getNextVideoId(currentTime: number, lookAheadSeconds: number): Promise<string | null> {
  try {
    // Fetch current schedule
    const now = Math.floor(currentTime / 1000);
    const response = await fetch(`/api/now?t=${now}`);
    
    if (!response.ok) {
      console.warn('Failed to fetch schedule for prefetch');
      return null;
    }
    
    const schedule = await response.json();
    if (!schedule || !schedule.next) {
      return null;
    }
    
    // Check if next item is within lookahead window
    const nextStartTime = schedule.next.start;
    const timeUntilNext = nextStartTime - now;
    
    if (timeUntilNext <= lookAheadSeconds && timeUntilNext > 0) {
      return schedule.next.videoId;
    }
    
    return null;
  } catch (error) {
    console.warn('Error getting next video ID for prefetch:', error);
    return null;
  }
}

// Prefetch a single video manifest
async function prefetchVideoManifest(
  videoId: string, 
  config: PrefetchConfig,
  headers: Record<string, string | undefined> = {}
): Promise<PrefetchResult> {
  const startTime = Date.now();
  const correlationId = `prefetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Detect region and optimal client profile
    const region = detectRegion(headers);
    const userAgent = headers['user-agent'];
    const clientProfile = getOptimalClientProfile(region, userAgent);
    
    const context: ResolveContext = {
      videoId,
      clientProfile,
      region,
      correlationId,
      userAgent,
      operation: 'prefetch',
    };
    
    logWithContext('info', 'Starting prefetch', context);
    
    // Check if already cached
    const cacheKeyName = cacheKey('prefetch', videoId, clientProfile, region);
    const cached = await cache.get<PrefetchResult>(cacheKeyName);
    
    if (cached && new Date(cached.expiresAt) > new Date()) {
      logWithContext('info', 'Prefetch cache hit', context);
      return cached;
    }
    
    // Resolve video manifest
    const resolveResponse = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(videoId)}&clientProfile=${clientProfile}&region=${region}`, {
      cache: 'no-store',
    });
    
    if (!resolveResponse.ok) {
      const errorData = await resolveResponse.json().catch(() => ({}));
      throw new Error(`prefetch_failed_${resolveResponse.status}: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const manifest: ResolveResponse = await resolveResponse.json();
    
    if (!manifest?.type || !manifest?.url) {
      throw new Error('no_manifest');
    }
    
    // Create prefetch result
    const result: PrefetchResult = {
      videoId,
      success: true,
      manifest,
      prefetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + config.cacheTTL).toISOString(),
      clientProfile,
      region,
    };
    
    // Cache the result
    await cache.set(cacheKeyName, result, config.cacheTTL);
    
    const duration = Date.now() - startTime;
    logWithContext('info', 'Prefetch completed', context, { 
      duration, 
      tier: manifest.tier,
      type: manifest.type,
    });
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const result: PrefetchResult = {
      videoId,
      success: false,
      error: error?.message || String(error),
      prefetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + config.cacheTTL).toISOString(),
      clientProfile: 'WEB',
      region: 'US',
    };
    
    logWithContext('error', 'Prefetch failed', { correlationId, videoId, operation: 'prefetch' }, { 
      error: result.error, 
      duration 
    });
    
    return result;
  }
}

// Main prefetch function
export async function runPrefetch(
  currentTime: number,
  config: PrefetchConfig = DEFAULT_PREFETCH_CONFIG,
  headers: Record<string, string | undefined> = {}
): Promise<PrefetchResult[]> {
  if (!config.enabled) {
    return [];
  }
  
  try {
    // Get next video ID
    const nextVideoId = await getNextVideoId(currentTime, config.lookAheadSeconds);
    
    if (!nextVideoId) {
      return [];
    }
    
    // Check if already prefetching
    if (prefetchState.activePrefetches.has(nextVideoId)) {
      const existingPrefetch = await prefetchState.activePrefetches.get(nextVideoId);
      return existingPrefetch ? [existingPrefetch] : [];
    }
    
    // Check concurrent prefetch limit
    if (prefetchState.activePrefetches.size >= config.maxConcurrentPrefetches) {
      console.warn('Max concurrent prefetches reached');
      return [];
    }
    
    // Start prefetch
    const prefetchPromise = prefetchVideoManifest(nextVideoId, config, headers);
    prefetchState.activePrefetches.set(nextVideoId, prefetchPromise);
    
    const result = await prefetchPromise;
    
    // Clean up
    prefetchState.activePrefetches.delete(nextVideoId);
    
    // Add to history
    prefetchState.prefetchHistory.push(result);
    
    // Keep history manageable
    if (prefetchState.prefetchHistory.length > 100) {
      prefetchState.prefetchHistory = prefetchState.prefetchHistory.slice(-100);
    }
    
    return [result];
    
  } catch (error) {
    console.error('Prefetch error:', error);
    return [];
  }
}

// Get prefetched manifest
export async function getPrefetchedManifest(
  videoId: string,
  clientProfile: string,
  region: string
): Promise<ResolveResponse | null> {
  try {
    const cacheKeyName = cacheKey('prefetch', videoId, clientProfile, region);
    const cached = await cache.get<PrefetchResult>(cacheKeyName);
    
    if (cached && cached.success && cached.manifest && new Date(cached.expiresAt) > new Date()) {
      return cached.manifest;
    }
    
    return null;
  } catch (error) {
    console.warn('Error getting prefetched manifest:', error);
    return null;
  }
}

// Get prefetch statistics
export function getPrefetchStats(): {
  activePrefetches: number;
  historyLength: number;
  recentResults: PrefetchResult[];
  successRate: number;
} {
  const recentResults = prefetchState.prefetchHistory.slice(-20);
  const successCount = recentResults.filter(r => r.success).length;
  const successRate = recentResults.length > 0 ? (successCount / recentResults.length) * 100 : 0;
  
  return {
    activePrefetches: prefetchState.activePrefetches.size,
    historyLength: prefetchState.prefetchHistory.length,
    recentResults,
    successRate,
  };
}

// Clear prefetch cache
export async function clearPrefetchCache(): Promise<void> {
  try {
    // Clear all prefetch-related cache entries
    // This is a simplified implementation - in production you'd use cache tags or patterns
    console.log('Clearing prefetch cache');
  } catch (error) {
    console.error('Error clearing prefetch cache:', error);
  }
}

// Prefetch health check
export function getPrefetchHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getPrefetchStats();
  
  if (stats.successRate >= 80) return 'healthy';
  if (stats.successRate >= 50) return 'warning';
  return 'critical';
}