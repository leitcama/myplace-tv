import { 
  ErrorType, 
  ErrorContext, 
  classifyError, 
  trackError,
  getErrorDefinition 
} from './error-taxonomy';
import { 
  RecoveryConfig, 
  DEFAULT_RECOVERY_CONFIG,
  handleAutoRecovery,
  getRecoveryState,
  initializeRecoveryState 
} from './error-recovery';

// Watchdog configuration
export interface WatchdogConfig {
  enabled: boolean;
  startupTimeoutMs: number;
  stallTimeoutMs: number;
  maxStallDurationMs: number;
  healthCheckIntervalMs: number;
  errorThreshold: number;
  recoveryEnabled: boolean;
  qualityDowngradeEnabled: boolean;
}

// Watchdog state
export interface WatchdogState {
  videoId: string;
  startTime: number;
  lastHealthCheck: number;
  stallStartTime?: number;
  stallCount: number;
  errorCount: number;
  recoveryAttempts: number;
  qualityLevel: number;
  isHealthy: boolean;
  isStalled: boolean;
  lastError?: ErrorType;
  lastErrorTime?: number;
}

// Watchdog event types
export enum WatchdogEventType {
  STARTUP_TIMEOUT = 'startup_timeout',
  STALL_DETECTED = 'stall_detected',
  STALL_RESOLVED = 'stall_resolved',
  ERROR_DETECTED = 'error_detected',
  RECOVERY_TRIGGERED = 'recovery_triggered',
  HEALTH_RESTORED = 'health_restored',
  QUALITY_DOWNGRADED = 'quality_downgraded',
}

// Watchdog event
export interface WatchdogEvent {
  type: WatchdogEventType;
  videoId: string;
  timestamp: string;
  details: any;
  errorType?: ErrorType;
  recoveryAction?: string;
  duration?: number;
}

// Watchdog state storage
const watchdogStates = new Map<string, WatchdogState>();
const watchdogIntervals = new Map<string, NodeJS.Timeout>();

// Default watchdog configuration
export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  enabled: true,
  startupTimeoutMs: 5000, // 5 seconds startup timeout
  stallTimeoutMs: 3000, // 3 seconds stall detection
  maxStallDurationMs: 10000, // 10 seconds max stall
  healthCheckIntervalMs: 1000, // 1 second health checks
  errorThreshold: 3, // 3 errors before triggering recovery
  recoveryEnabled: true,
  qualityDowngradeEnabled: true,
};

// Initialize watchdog for a video
export function initializeWatchdog(
  videoId: string,
  config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): WatchdogState {
  const state: WatchdogState = {
    videoId,
    startTime: Date.now(),
    lastHealthCheck: Date.now(),
    stallCount: 0,
    errorCount: 0,
    recoveryAttempts: 0,
    qualityLevel: 1080,
    isHealthy: true,
    isStalled: false,
  };
  
  watchdogStates.set(videoId, state);
  
  // Start health monitoring
  startHealthMonitoring(videoId, config);
  
  console.log(`🔄 Watchdog initialized for ${videoId}`);
  
  return state;
}

// Start health monitoring
function startHealthMonitoring(videoId: string, config: WatchdogConfig): void {
  // Clear existing interval if any
  if (watchdogIntervals.has(videoId)) {
    clearInterval(watchdogIntervals.get(videoId)!);
  }
  
  const interval = setInterval(() => {
    checkVideoHealth(videoId, config);
  }, config.healthCheckIntervalMs);
  
  watchdogIntervals.set(videoId, interval);
}

// Check video health
function checkVideoHealth(videoId: string, config: WatchdogConfig): void {
  const state = watchdogStates.get(videoId);
  if (!state) return;
  
  const now = Date.now();
  const timeSinceStart = now - state.startTime;
  const timeSinceLastHealth = now - state.lastHealthCheck;
  
  // Check for startup timeout
  if (timeSinceStart > config.startupTimeoutMs && !state.isHealthy) {
    handleStartupTimeout(videoId, state, config);
    return;
  }
  
  // Check for stall timeout
  if (state.isStalled && state.stallStartTime) {
    const stallDuration = now - state.stallStartTime;
    
    if (stallDuration > config.stallTimeoutMs) {
      handleStallDetected(videoId, state, config, stallDuration);
    }
    
    if (stallDuration > config.maxStallDurationMs) {
      handleMaxStallExceeded(videoId, state, config, stallDuration);
    }
  }
  
  // Check for error threshold
  if (state.errorCount >= config.errorThreshold) {
    handleErrorThresholdExceeded(videoId, state, config);
  }
  
  state.lastHealthCheck = now;
}

// Handle startup timeout
function handleStartupTimeout(videoId: string, state: WatchdogState, config: WatchdogConfig): void {
  const errorType = ErrorType.STARTUP_TIMEOUT;
  const context: Partial<ErrorContext> = {
    videoId,
    userAgent: navigator.userAgent,
    correlationId: `watchdog_${Date.now()}`,
  };
  
  console.log(`🚨 Startup timeout detected for ${videoId}`);
  
  // Track error
  trackError(errorType, 'Video startup exceeded timeout threshold', context, state.recoveryAttempts);
  
  // Update state
  state.lastError = errorType;
  state.lastErrorTime = Date.now();
  state.errorCount++;
  
  // Trigger recovery if enabled
  if (config.recoveryEnabled) {
    triggerRecovery(videoId, errorType, context, config);
  }
  
  // Emit watchdog event
  emitWatchdogEvent(WatchdogEventType.STARTUP_TIMEOUT, videoId, {
    timeoutMs: config.startupTimeoutMs,
    errorCount: state.errorCount,
  }, errorType);
}

// Handle stall detected
function handleStallDetected(videoId: string, state: WatchdogState, config: WatchdogConfig, stallDuration: number): void {
  const errorType = ErrorType.NETWORK_STALL;
  const context: Partial<ErrorContext> = {
    videoId,
    userAgent: navigator.userAgent,
    correlationId: `watchdog_${Date.now()}`,
  };
  
  console.log(`🚨 Stall detected for ${videoId} (${stallDuration}ms)`);
  
  // Track error
  trackError(errorType, `Network stall detected: ${stallDuration}ms`, context, state.recoveryAttempts);
  
  // Update state
  state.lastError = errorType;
  state.lastErrorTime = Date.now();
  state.errorCount++;
  state.stallCount++;
  
  // Trigger recovery if enabled
  if (config.recoveryEnabled) {
    triggerRecovery(videoId, errorType, context, config);
  }
  
  // Emit watchdog event
  emitWatchdogEvent(WatchdogEventType.STALL_DETECTED, videoId, {
    stallDuration,
    stallCount: state.stallCount,
    errorCount: state.errorCount,
  }, errorType);
}

// Handle max stall exceeded
function handleMaxStallExceeded(videoId: string, state: WatchdogState, config: WatchdogConfig, stallDuration: number): void {
  const errorType = ErrorType.NETWORK_STALL;
  const context: Partial<ErrorContext> = {
    videoId,
    userAgent: navigator.userAgent,
    correlationId: `watchdog_${Date.now()}`,
  };
  
  console.log(`🚨 Max stall duration exceeded for ${videoId} (${stallDuration}ms)`);
  
  // Track error
  trackError(errorType, `Max stall duration exceeded: ${stallDuration}ms`, context, state.recoveryAttempts);
  
  // Update state
  state.lastError = errorType;
  state.lastErrorTime = Date.now();
  state.errorCount++;
  
  // Trigger aggressive recovery
  if (config.recoveryEnabled) {
    triggerRecovery(videoId, errorType, context, config);
  }
  
  // Emit watchdog event
  emitWatchdogEvent(WatchdogEventType.STALL_DETECTED, videoId, {
    stallDuration,
    maxStallDuration: config.maxStallDurationMs,
    errorCount: state.errorCount,
  }, errorType);
}

// Handle error threshold exceeded
function handleErrorThresholdExceeded(videoId: string, state: WatchdogState, config: WatchdogConfig): void {
  const errorType = state.lastError || ErrorType.UNKNOWN;
  const context: Partial<ErrorContext> = {
    videoId,
    userAgent: navigator.userAgent,
    correlationId: `watchdog_${Date.now()}`,
  };
  
  console.log(`🚨 Error threshold exceeded for ${videoId} (${state.errorCount} errors)`);
  
  // Track error
  trackError(errorType, `Error threshold exceeded: ${state.errorCount} errors`, context, state.recoveryAttempts);
  
  // Trigger recovery
  if (config.recoveryEnabled) {
    triggerRecovery(videoId, errorType, context, config);
  }
  
  // Emit watchdog event
  emitWatchdogEvent(WatchdogEventType.ERROR_DETECTED, videoId, {
    errorCount: state.errorCount,
    errorThreshold: config.errorThreshold,
    lastError: errorType,
  }, errorType);
}

// Trigger recovery
async function triggerRecovery(
  videoId: string,
  errorType: ErrorType,
  context: Partial<ErrorContext>,
  config: WatchdogConfig
): Promise<void> {
  const state = watchdogStates.get(videoId);
  if (!state) return;
  
  state.recoveryAttempts++;
  
  console.log(`🔄 Triggering recovery for ${videoId} (attempt ${state.recoveryAttempts})`);
  
  try {
    const result = await handleAutoRecovery(errorType, { message: 'Watchdog triggered recovery' }, context, {
      ...DEFAULT_RECOVERY_CONFIG,
      enabled: config.recoveryEnabled,
      autoRecoveryEnabled: config.recoveryEnabled,
    });
    
    if (result) {
      console.log(`🔄 Recovery result: ${result.success ? 'success' : 'failed'} (${result.action})`);
      
      // Emit watchdog event
      emitWatchdogEvent(WatchdogEventType.RECOVERY_TRIGGERED, videoId, {
        success: result.success,
        action: result.action,
        duration: result.duration,
        error: result.error,
      }, errorType, result.action);
      
      // Handle quality downgrade
      if (result.success && result.newQualityLevel && config.qualityDowngradeEnabled) {
        handleQualityDowngrade(videoId, result.newQualityLevel);
      }
    }
  } catch (error: any) {
    console.error(`🔄 Recovery failed for ${videoId}`, error);
    
    // Emit watchdog event
    emitWatchdogEvent(WatchdogEventType.RECOVERY_TRIGGERED, videoId, {
      success: false,
      error: error.message,
    }, errorType);
  }
}

// Handle quality downgrade
function handleQualityDowngrade(videoId: string, newQualityLevel: number): void {
  const state = watchdogStates.get(videoId);
  if (!state) return;
  
  state.qualityLevel = newQualityLevel;
  
  console.log(`🔄 Quality downgraded to ${newQualityLevel}p for ${videoId}`);
  
  // Emit watchdog event
  emitWatchdogEvent(WatchdogEventType.QUALITY_DOWNGRADED, videoId, {
    newQualityLevel,
    previousQualityLevel: state.qualityLevel,
  });
}

// Report video health
export function reportVideoHealth(
  videoId: string,
  isHealthy: boolean,
  isStalled: boolean = false,
  error?: any
): void {
  const state = watchdogStates.get(videoId);
  if (!state) return;
  
  const wasHealthy = state.isHealthy;
  const wasStalled = state.isStalled;
  
  state.isHealthy = isHealthy;
  state.isStalled = isStalled;
  
  // Handle stall start
  if (isStalled && !wasStalled) {
    state.stallStartTime = Date.now();
  }
  
  // Handle stall end
  if (!isStalled && wasStalled) {
    state.stallStartTime = undefined;
    emitWatchdogEvent(WatchdogEventType.STALL_RESOLVED, videoId, {
      stallCount: state.stallCount,
    });
  }
  
  // Handle health restoration
  if (isHealthy && !wasHealthy) {
    state.errorCount = 0; // Reset error count on health restoration
    emitWatchdogEvent(WatchdogEventType.HEALTH_RESTORED, videoId, {
      recoveryAttempts: state.recoveryAttempts,
    });
  }
  
  // Handle error
  if (error) {
    const errorType = classifyError(error, { videoId });
    const context: Partial<ErrorContext> = {
      videoId,
      userAgent: navigator.userAgent,
      correlationId: `watchdog_${Date.now()}`,
    };
    
    trackError(errorType, error.message || String(error), context, state.recoveryAttempts);
    
    state.lastError = errorType;
    state.lastErrorTime = Date.now();
    state.errorCount++;
  }
}

// Get watchdog state
export function getWatchdogState(videoId: string): WatchdogState | null {
  return watchdogStates.get(videoId) || null;
}

// Get all watchdog states
export function getAllWatchdogStates(): WatchdogState[] {
  return Array.from(watchdogStates.values());
}

// Get watchdog statistics
export function getWatchdogStats(): {
  totalVideos: number;
  healthyVideos: number;
  stalledVideos: number;
  totalStalls: number;
  totalErrors: number;
  totalRecoveries: number;
  averageRecoveryAttempts: number;
} {
  const states = Array.from(watchdogStates.values());
  const healthyVideos = states.filter(state => state.isHealthy).length;
  const stalledVideos = states.filter(state => state.isStalled).length;
  const totalStalls = states.reduce((sum, state) => sum + state.stallCount, 0);
  const totalErrors = states.reduce((sum, state) => sum + state.errorCount, 0);
  const totalRecoveries = states.reduce((sum, state) => sum + state.recoveryAttempts, 0);
  const averageRecoveryAttempts = states.length > 0 ? totalRecoveries / states.length : 0;
  
  return {
    totalVideos: states.length,
    healthyVideos,
    stalledVideos,
    totalStalls,
    totalErrors,
    totalRecoveries,
    averageRecoveryAttempts,
  };
}

// Get watchdog health status
export function getWatchdogHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getWatchdogStats();
  
  if (stats.stalledVideos > 0 || stats.totalErrors > 5) return 'critical';
  if (stats.totalErrors > 2 || stats.averageRecoveryAttempts > 2) return 'warning';
  return 'healthy';
}

// Stop watchdog for a video
export function stopWatchdog(videoId: string): void {
  if (watchdogIntervals.has(videoId)) {
    clearInterval(watchdogIntervals.get(videoId)!);
    watchdogIntervals.delete(videoId);
  }
  
  watchdogStates.delete(videoId);
  
  console.log(`🔄 Watchdog stopped for ${videoId}`);
}

// Clear all watchdog states
export function clearAllWatchdogStates(): void {
  // Clear all intervals
  Array.from(watchdogIntervals.values()).forEach(interval => clearInterval(interval));
  watchdogIntervals.clear();
  
  // Clear all states
  watchdogStates.clear();
  
  console.log(`🔄 All watchdog states cleared`);
}

// Emit watchdog event (placeholder for event system)
function emitWatchdogEvent(
  type: WatchdogEventType,
  videoId: string,
  details: any,
  errorType?: ErrorType,
  recoveryAction?: string
): void {
  const event: WatchdogEvent = {
    type,
    videoId,
    timestamp: new Date().toISOString(),
    details,
    errorType,
    recoveryAction,
  };
  
  console.log(`🔄 Watchdog event: ${type}`, event);
  
  // Send to telemetry
  if (typeof window !== 'undefined' && window.navigator) {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'watchdog_event',
        ...event,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {}); // Silently fail
  }
}