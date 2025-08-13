import { ResolveResponse, ResolveContext, ClientProfile } from '@/types/resolver';
import { cache, cacheKey, logWithContext } from './cache';
import { getOptimalClientProfile, detectRegion } from './clients';

// Expiry configuration
export interface ExpiryConfig {
  enabled: boolean;
  refreshWindowMinutes: number; // Minutes before expiry to refresh
  maxRefreshAttempts: number;
  refreshIntervalMs: number; // How often to check for expiring manifests
  fallbackProxyEnabled: boolean;
}

// Expiry tracking state
export interface ExpiryState {
  videoId: string;
  manifestUrl: string;
  expiresAt: string;
  lastRefreshed: string;
  refreshAttempts: number;
  clientProfile: ClientProfile;
  region: string;
  correlationId: string;
}

// Refresh result
export interface RefreshResult {
  success: boolean;
  newManifest?: ResolveResponse;
  error?: string;
  refreshedAt: string;
  timeUntilExpiry: number; // milliseconds
  refreshAttempts: number;
}

// Expiry state storage
const expiryStates = new Map<string, ExpiryState>();
const refreshIntervals = new Map<string, NodeJS.Timeout>();

// Default expiry configuration
export const DEFAULT_EXPIRY_CONFIG: ExpiryConfig = {
  enabled: true,
  refreshWindowMinutes: 3, // Refresh 3 minutes before expiry
  maxRefreshAttempts: 3,
  refreshIntervalMs: 30 * 1000, // Check every 30 seconds
  fallbackProxyEnabled: false, // Disabled by default
};

// Track manifest expiry
export function trackManifestExpiry(
  videoId: string,
  manifest: ResolveResponse,
  context: ResolveContext
): void {
  if (!DEFAULT_EXPIRY_CONFIG.enabled || !manifest.expiresAt) {
    return;
  }

  const expiresAt = new Date(manifest.expiresAt);
  const now = new Date();
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  // Only track if expiry is within reasonable range (not too far in future)
  if (timeUntilExpiry > 0 && timeUntilExpiry < 24 * 60 * 60 * 1000) { // Less than 24 hours
    const state: ExpiryState = {
      videoId,
      manifestUrl: manifest.url,
      expiresAt: manifest.expiresAt,
      lastRefreshed: new Date().toISOString(),
      refreshAttempts: 0,
      clientProfile: context.clientProfile,
      region: context.region,
      correlationId: context.correlationId,
    };

    const key = `${videoId}:${context.clientProfile}:${context.region}`;
    expiryStates.set(key, state);

    // Start monitoring for this manifest
    startExpiryMonitoring(key, state);

    logWithContext('info', 'Manifest expiry tracking started', context, {
      expiresAt: manifest.expiresAt,
      timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
      refreshWindowMinutes: DEFAULT_EXPIRY_CONFIG.refreshWindowMinutes,
    });
  }
}

// Start monitoring for manifest expiry
function startExpiryMonitoring(key: string, state: ExpiryState): void {
  // Clear existing interval if any
  if (refreshIntervals.has(key)) {
    clearInterval(refreshIntervals.get(key)!);
  }

  const interval = setInterval(async () => {
    await checkAndRefreshManifest(key, state);
  }, DEFAULT_EXPIRY_CONFIG.refreshIntervalMs);

  refreshIntervals.set(key, interval);
}

// Check if manifest needs refresh and refresh if necessary
async function checkAndRefreshManifest(key: string, state: ExpiryState): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(state.expiresAt);
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();
  const refreshWindowMs = DEFAULT_EXPIRY_CONFIG.refreshWindowMinutes * 60 * 1000;

  // Check if we're within refresh window
  if (timeUntilExpiry <= refreshWindowMs && timeUntilExpiry > 0) {
    if (state.refreshAttempts < DEFAULT_EXPIRY_CONFIG.maxRefreshAttempts) {
      await refreshManifest(key, state);
    } else {
      logWithContext('warn', 'Max refresh attempts reached', {
        videoId: state.videoId,
        correlationId: state.correlationId,
        operation: 'expiry',
      }, {
        refreshAttempts: state.refreshAttempts,
        timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
      });
    }
  }

  // Clean up if expired
  if (timeUntilExpiry <= 0) {
    cleanupExpiryState(key);
  }
}

// Refresh a manifest
async function refreshManifest(key: string, state: ExpiryState): Promise<RefreshResult> {
  const startTime = Date.now();
  const context: ResolveContext = {
    videoId: state.videoId,
    clientProfile: state.clientProfile,
    region: state.region,
    correlationId: `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    operation: 'refresh',
  };

  try {
    logWithContext('info', 'Starting manifest refresh', context, {
      refreshAttempts: state.refreshAttempts + 1,
      timeUntilExpiry: Math.round((new Date(state.expiresAt).getTime() - Date.now()) / 1000),
    });

    // Attempt to refresh the manifest
    const response = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(state.videoId)}&clientProfile=${state.clientProfile}&region=${state.region}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`refresh_failed_${response.status}`);
    }

    const newManifest: ResolveResponse = await response.json();

    if (!newManifest?.type || !newManifest?.url) {
      throw new Error('no_manifest');
    }

    // Update state
    state.refreshAttempts++;
    state.lastRefreshed = new Date().toISOString();
    state.manifestUrl = newManifest.url;
    state.expiresAt = newManifest.expiresAt || state.expiresAt;

    // Cache the new manifest
    const cacheKeyName = cacheKey('resolveOutcome', state.videoId, state.clientProfile, state.region);
    await cache.set(cacheKeyName, {
      result: newManifest,
      cachedAt: new Date().toISOString(),
      ttl: 4 * 60 * 1000, // 4 minutes
    }, 4 * 60 * 1000);

    const duration = Date.now() - startTime;
    const timeUntilExpiry = new Date(state.expiresAt).getTime() - Date.now();

    logWithContext('info', 'Manifest refresh successful', context, {
      duration,
      refreshAttempts: state.refreshAttempts,
      timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
      tier: newManifest.tier,
      type: newManifest.type,
    });

    return {
      success: true,
      newManifest,
      refreshedAt: new Date().toISOString(),
      timeUntilExpiry,
      refreshAttempts: state.refreshAttempts,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    state.refreshAttempts++;

    logWithContext('error', 'Manifest refresh failed', context, {
      error: error?.message || String(error),
      duration,
      refreshAttempts: state.refreshAttempts,
    });

    return {
      success: false,
      error: error?.message || String(error),
      refreshedAt: new Date().toISOString(),
      timeUntilExpiry: new Date(state.expiresAt).getTime() - Date.now(),
      refreshAttempts: state.refreshAttempts,
    };
  }
}

// Get expiry state for a video
export function getExpiryState(videoId: string, clientProfile: ClientProfile, region: string): ExpiryState | null {
  const key = `${videoId}:${clientProfile}:${region}`;
  return expiryStates.get(key) || null;
}

// Get all expiry states
export function getAllExpiryStates(): ExpiryState[] {
  return Array.from(expiryStates.values());
}

// Clean up expiry state
function cleanupExpiryState(key: string): void {
  if (refreshIntervals.has(key)) {
    clearInterval(refreshIntervals.get(key)!);
    refreshIntervals.delete(key);
  }
  expiryStates.delete(key);
}

// Manual refresh trigger
export async function triggerManualRefresh(
  videoId: string,
  clientProfile: ClientProfile,
  region: string
): Promise<RefreshResult | null> {
  const key = `${videoId}:${clientProfile}:${region}`;
  const state = expiryStates.get(key);

  if (!state) {
    return null;
  }

  return await refreshManifest(key, state);
}

// Get expiry statistics
export function getExpiryStats(): {
  totalTracked: number;
  activeIntervals: number;
  expiringSoon: number;
  refreshAttempts: number;
  averageTimeUntilExpiry: number;
} {
  const now = Date.now();
  const refreshWindowMs = DEFAULT_EXPIRY_CONFIG.refreshWindowMinutes * 60 * 1000;
  
  let expiringSoon = 0;
  let totalRefreshAttempts = 0;
  let totalTimeUntilExpiry = 0;
  let validManifests = 0;

  Array.from(expiryStates.values()).forEach(state => {
    const timeUntilExpiry = new Date(state.expiresAt).getTime() - now;
    
    if (timeUntilExpiry > 0) {
      if (timeUntilExpiry <= refreshWindowMs) {
        expiringSoon++;
      }
      totalTimeUntilExpiry += timeUntilExpiry;
      validManifests++;
    }
    
    totalRefreshAttempts += state.refreshAttempts;
  });

  return {
    totalTracked: expiryStates.size,
    activeIntervals: refreshIntervals.size,
    expiringSoon,
    refreshAttempts: totalRefreshAttempts,
    averageTimeUntilExpiry: validManifests > 0 ? Math.round(totalTimeUntilExpiry / validManifests / 1000) : 0,
  };
}

// Clear all expiry states
export function clearAllExpiryStates(): void {
  Array.from(expiryStates.keys()).forEach(key => {
    cleanupExpiryState(key);
  });
}

// Get expiry health status
export function getExpiryHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getExpiryStats();
  
  if (stats.expiringSoon === 0 && stats.refreshAttempts === 0) return 'healthy';
  if (stats.expiringSoon <= 2 && stats.refreshAttempts <= 5) return 'warning';
  return 'critical';
}