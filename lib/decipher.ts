import ytdl from 'ytdl-core';
import { ResolveContext } from '@/types/resolver';

// Decipher error types
export enum DecipherErrorType {
  NETWORK_ERROR = 'network_error',
  SIGNATURE_DECODE_ERROR = 'signature_decode_error',
  BASE_JS_ERROR = 'base_js_error',
  RATE_LIMITED = 'rate_limited',
  AGE_RESTRICTED = 'age_restricted',
  PRIVATE_VIDEO = 'private_video',
  REGION_BLOCKED = 'region_blocked',
  UNKNOWN = 'unknown',
}

// Decipher result interface
export interface DecipherResult {
  success: boolean;
  data?: any;
  error?: {
    type: DecipherErrorType;
    message: string;
    details?: any;
  };
  baseJsHash?: string;
  signatureVersion?: string;
  timestamp: string;
}

// Base.js hash tracking
interface BaseJsInfo {
  hash: string;
  firstSeen: string;
  lastSeen: string;
  signatureVersion: string;
  failureCount: number;
  successCount: number;
}

const baseJsCache = new Map<string, BaseJsInfo>();

// Extract base.js hash from player response
function extractBaseJsHash(playerResponse: any): string | null {
  try {
    // Try multiple paths to find base.js hash
    const paths = [
      'playerJsUrl',
      'player_response.playerJsUrl',
      'playerResponse.playerJsUrl',
      'assets.js',
      'player_response.assets.js',
      'playerResponse.assets.js',
    ];
    
    for (const path of paths) {
      const value = path.split('.').reduce((obj, key) => obj?.[key], playerResponse);
      if (value && typeof value === 'string') {
        // Extract hash from URL like "https://www.youtube.com/s/player/abc123/base.js"
        const match = value.match(/\/s\/player\/([a-f0-9]+)\//);
        if (match) return match[1];
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Classify error based on ytdl-core error
function classifyError(error: any): DecipherErrorType {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || '';
  
  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return DecipherErrorType.NETWORK_ERROR;
  }
  
  // Signature decode errors
  if (message.includes('signature') || message.includes('decipher') || message.includes('transform')) {
    return DecipherErrorType.SIGNATURE_DECODE_ERROR;
  }
  
  // Base.js errors
  if (message.includes('base.js') || message.includes('player.js')) {
    return DecipherErrorType.BASE_JS_ERROR;
  }
  
  // Rate limiting
  if (message.includes('rate') || message.includes('quota') || code === '429') {
    return DecipherErrorType.RATE_LIMITED;
  }
  
  // Age restrictions
  if (message.includes('age') || message.includes('restricted')) {
    return DecipherErrorType.AGE_RESTRICTED;
  }
  
  // Private videos
  if (message.includes('private') || message.includes('unavailable')) {
    return DecipherErrorType.PRIVATE_VIDEO;
  }
  
  // Region blocking
  if (message.includes('region') || message.includes('country') || message.includes('blocked')) {
    return DecipherErrorType.REGION_BLOCKED;
  }
  
  return DecipherErrorType.UNKNOWN;
}

// Track base.js hash
function trackBaseJsHash(hash: string, success: boolean, signatureVersion?: string) {
  const now = new Date().toISOString();
  const existing = baseJsCache.get(hash);
  
  if (existing) {
    existing.lastSeen = now;
    if (success) {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }
  } else {
    baseJsCache.set(hash, {
      hash,
      firstSeen: now,
      lastSeen: now,
      signatureVersion: signatureVersion || 'unknown',
      failureCount: success ? 0 : 1,
      successCount: success ? 1 : 0,
    });
  }
  
  // Keep cache size manageable
  if (baseJsCache.size > 100) {
    const oldest = Array.from(baseJsCache.entries())
      .sort((a, b) => new Date(a[1].firstSeen).getTime() - new Date(b[1].firstSeen).getTime())[0];
    if (oldest) {
      baseJsCache.delete(oldest[0]);
    }
  }
}

// Main decipher function
export async function decipherVideo(videoId: string, context: ResolveContext): Promise<DecipherResult> {
  const startTime = Date.now();
  
  try {
    // Get client configuration
    const { getClientConfig } = await import('./clients');
    const clientConfig = getClientConfig(context.clientProfile || 'WEB');
    
    // Attempt to get video info with client-specific configuration
    const info = await ytdl.getInfo(videoId, {
      requestOptions: {
        headers: {
          'User-Agent': clientConfig.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      },
    });
    
    // Extract base.js hash
    const playerResponse = (info as any).player_response || (info as any).playerResponse || {};
    const baseJsHash = extractBaseJsHash(playerResponse);
    
    // Determine signature version
    const signatureVersion = baseJsHash ? 'v1' : 'unknown';
    
    // Track successful decipher
    if (baseJsHash) {
      trackBaseJsHash(baseJsHash, true, signatureVersion);
    }
    
    return {
      success: true,
      data: info,
      baseJsHash,
      signatureVersion,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error: any) {
    const errorType = classifyError(error);
    const duration = Date.now() - startTime;
    
    // Try to extract base.js hash from error context
    let baseJsHash: string | undefined;
    let signatureVersion: string | undefined;
    
    try {
      // Sometimes the error contains player response info
      const errorData = error?.data || error?.response?.data;
      if (errorData) {
        baseJsHash = extractBaseJsHash(errorData);
        signatureVersion = baseJsHash ? 'v1' : 'unknown';
      }
    } catch (e) {
      // Ignore extraction errors
    }
    
    // Track failed decipher
    if (baseJsHash) {
      trackBaseJsHash(baseJsHash, false, signatureVersion);
    }
    
    return {
      success: false,
      error: {
        type: errorType,
        message: error?.message || String(error),
        details: {
          duration,
          videoId,
          clientProfile: context.clientProfile,
          region: context.region,
          baseJsHash,
          signatureVersion,
        },
      },
      baseJsHash,
      signatureVersion,
      timestamp: new Date().toISOString(),
    };
  }
}

// Get decipher statistics
export function getDecipherStats() {
  const stats = {
    totalBaseJsHashes: baseJsCache.size,
    baseJsHashes: {} as Record<string, any>,
    errorDistribution: {} as Record<DecipherErrorType, number>,
  };
  
  // Convert base.js cache to serializable format
  Array.from(baseJsCache.entries()).forEach(([hash, info]) => {
    stats.baseJsHashes[hash] = {
      ...info,
      successRate: info.successCount + info.failureCount > 0 
        ? ((info.successCount / (info.successCount + info.failureCount)) * 100).toFixed(1) + '%'
        : '0%',
    };
  });
  
  return stats;
}

// Check if base.js hash is known to be problematic
export function isBaseJsHashProblematic(hash: string): boolean {
  const info = baseJsCache.get(hash);
  if (!info) return false;
  
  const totalAttempts = info.successCount + info.failureCount;
  const failureRate = totalAttempts > 0 ? info.failureCount / totalAttempts : 0;
  
  // Consider problematic if failure rate > 80% and at least 5 attempts
  return failureRate > 0.8 && totalAttempts >= 5;
}

// Get signature version from base.js hash
export function getSignatureVersion(hash: string): string {
  const info = baseJsCache.get(hash);
  return info?.signatureVersion || 'unknown';
}