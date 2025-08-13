import { 
  ErrorType, 
  ErrorContext, 
  ErrorEvent,
  getErrorDefinition, 
  getNextRecoveryAction, 
  shouldAutoRecover, 
  trackError 
} from './error-taxonomy';
import { RecoveryAction } from './error-taxonomy';

// Re-export RecoveryAction for convenience
export { RecoveryAction };

// Recovery configuration
export interface RecoveryConfig {
  enabled: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeoutMs: number;
  qualityDowngradeSteps: number[];
  autoRecoveryEnabled: boolean;
  userActionRequired: boolean;
}

// Recovery state
export interface RecoveryState {
  videoId: string;
  currentError: ErrorType;
  retryCount: number;
  recoveryAttempts: number;
  lastRecoveryAction?: RecoveryAction;
  lastRecoveryTime?: string;
  recoveryInProgress: boolean;
  qualityLevel: number;
  originalQualityLevel: number;
}

// Recovery result
export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  duration: number;
  error?: string;
  newQualityLevel?: number;
  nextAction?: RecoveryAction;
}

// Recovery state storage
const recoveryStates = new Map<string, RecoveryState>();

// Default recovery configuration
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: true,
  maxRecoveryAttempts: 5,
  recoveryTimeoutMs: 10000, // 10 seconds
  qualityDowngradeSteps: [720, 480, 360, 240], // Quality levels to try
  autoRecoveryEnabled: true,
  userActionRequired: false,
};

// Initialize recovery state for a video
export function initializeRecoveryState(videoId: string, qualityLevel: number = 1080): RecoveryState {
  const state: RecoveryState = {
    videoId,
    currentError: ErrorType.UNKNOWN,
    retryCount: 0,
    recoveryAttempts: 0,
    recoveryInProgress: false,
    qualityLevel,
    originalQualityLevel: qualityLevel,
  };
  
  recoveryStates.set(videoId, state);
  return state;
}

// Get recovery state for a video
export function getRecoveryState(videoId: string): RecoveryState | null {
  return recoveryStates.get(videoId) || null;
}

// Update recovery state
export function updateRecoveryState(videoId: string, updates: Partial<RecoveryState>): void {
  const state = recoveryStates.get(videoId);
  if (state) {
    Object.assign(state, updates);
  }
}

// Execute recovery action
export async function executeRecoveryAction(
  videoId: string,
  errorType: ErrorType,
  context: Partial<ErrorContext>,
  config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG
): Promise<RecoveryResult> {
  const startTime = Date.now();
  const state = getRecoveryState(videoId) || initializeRecoveryState(videoId);
  
  // Check if recovery is enabled
  if (!config.enabled) {
    return {
      success: false,
      action: RecoveryAction.IGNORE,
      duration: Date.now() - startTime,
      error: 'Recovery disabled',
    };
  }
  
  // Check if max recovery attempts reached
  if (state.recoveryAttempts >= config.maxRecoveryAttempts) {
    return {
      success: false,
      action: RecoveryAction.IGNORE,
      duration: Date.now() - startTime,
      error: 'Max recovery attempts reached',
    };
  }
  
  // Get next recovery action
  const action = getNextRecoveryAction(errorType, state.retryCount);
  if (!action) {
    return {
      success: false,
      action: RecoveryAction.IGNORE,
      duration: Date.now() - startTime,
      error: 'No recovery action available',
    };
  }
  
  // Update state
  state.currentError = errorType;
  state.retryCount++;
  state.recoveryAttempts++;
  state.lastRecoveryAction = action;
  state.lastRecoveryTime = new Date().toISOString();
  state.recoveryInProgress = true;
  
  console.log(`🔄 Executing recovery action: ${action} for ${errorType}`, {
    videoId,
    retryCount: state.retryCount,
    recoveryAttempts: state.recoveryAttempts,
  });
  
  try {
    let result: RecoveryResult;
    
    switch (action) {
      case RecoveryAction.RETRY:
        result = await executeRetry(videoId, context);
        break;
        
      case RecoveryAction.DOWNGRADE_QUALITY:
        result = await executeQualityDowngrade(videoId, state, config);
        break;
        
      case RecoveryAction.RE_RESOLVE:
        result = await executeReResolve(videoId, context);
        break;
        
      case RecoveryAction.REFRESH_MANIFEST:
        result = await executeManifestRefresh(videoId, context);
        break;
        
      case RecoveryAction.SWITCH_TIER:
        result = await executeTierSwitch(videoId, context);
        break;
        
      case RecoveryAction.WAIT_AND_RETRY:
        result = await executeWaitAndRetry(videoId, context);
        break;
        
      case RecoveryAction.ZAP:
        result = await executeZap(videoId, context);
        break;
        
      case RecoveryAction.IGNORE:
        result = {
          success: true,
          action,
          duration: Date.now() - startTime,
        };
        break;
        
      default:
        result = {
          success: false,
          action,
          duration: Date.now() - startTime,
          error: 'Unknown recovery action',
        };
    }
    
    // Update state
    state.recoveryInProgress = false;
    if (result.success) {
      state.retryCount = 0; // Reset retry count on success
    }
    
    // Track recovery attempt
    trackError(
      errorType,
      `Recovery attempt: ${action}`,
      context,
      state.retryCount,
      action,
      result.success,
      result.duration
    );
    
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    state.recoveryInProgress = false;
    
    console.error(`🔄 Recovery action failed: ${action}`, error);
    
    // Track failed recovery
    trackError(
      errorType,
      `Recovery failed: ${error.message}`,
      context,
      state.retryCount,
      action,
      false,
      duration
    );
    
    return {
      success: false,
      action,
      duration,
      error: error.message,
    };
  }
}

// Execute retry action
async function executeRetry(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  // Simple retry - just return success to trigger retry logic
  return {
    success: true,
    action: RecoveryAction.RETRY,
    duration: Date.now() - startTime,
  };
}

// Execute quality downgrade
async function executeQualityDowngrade(
  videoId: string, 
  state: RecoveryState, 
  config: RecoveryConfig
): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  // Find next quality level
  const currentIndex = config.qualityDowngradeSteps.indexOf(state.qualityLevel);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  
  if (nextIndex < config.qualityDowngradeSteps.length) {
    const newQuality = config.qualityDowngradeSteps[nextIndex];
    state.qualityLevel = newQuality;
    
    console.log(`🔄 Quality downgraded to ${newQuality}p`);
    
    return {
      success: true,
      action: RecoveryAction.DOWNGRADE_QUALITY,
      duration: Date.now() - startTime,
      newQualityLevel: newQuality,
    };
  }
  
  return {
    success: false,
    action: RecoveryAction.DOWNGRADE_QUALITY,
    duration: Date.now() - startTime,
    error: 'No lower quality available',
  };
}

// Execute re-resolve action
async function executeReResolve(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  try {
    // Trigger re-resolve via API
    const response = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(videoId)}`, {
      cache: 'no-store',
    });
    
    if (response.ok) {
      const result = await response.json();
      
      return {
        success: true,
        action: RecoveryAction.RE_RESOLVE,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        success: false,
        action: RecoveryAction.RE_RESOLVE,
        duration: Date.now() - startTime,
        error: `Re-resolve failed: ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      action: RecoveryAction.RE_RESOLVE,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

// Execute manifest refresh
async function executeManifestRefresh(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  try {
    // Trigger manifest refresh via expiry API
    const response = await fetch(`/api/expiry?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
    });
    
    if (response.ok) {
      const result = await response.json();
      
      return {
        success: result.success,
        action: RecoveryAction.REFRESH_MANIFEST,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        success: false,
        action: RecoveryAction.REFRESH_MANIFEST,
        duration: Date.now() - startTime,
        error: `Manifest refresh failed: ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      action: RecoveryAction.REFRESH_MANIFEST,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

// Execute tier switch
async function executeTierSwitch(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  try {
    // Try different client profiles for tier switching
    const profiles = ['WEB', 'ANDROID', 'TV', 'IOS'];
    const currentProfile = context.clientProfile || 'WEB';
    const nextProfile = profiles[(profiles.indexOf(currentProfile) + 1) % profiles.length];
    
    const response = await fetch(`/api/video/playback/resolve?videoId=${encodeURIComponent(videoId)}&clientProfile=${nextProfile}`, {
      cache: 'no-store',
    });
    
    if (response.ok) {
      const result = await response.json();
      
      return {
        success: true,
        action: RecoveryAction.SWITCH_TIER,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        success: false,
        action: RecoveryAction.SWITCH_TIER,
        duration: Date.now() - startTime,
        error: `Tier switch failed: ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      action: RecoveryAction.SWITCH_TIER,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

// Execute wait and retry
async function executeWaitAndRetry(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  // Wait for a short period before retry
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    action: RecoveryAction.WAIT_AND_RETRY,
    duration: Date.now() - startTime,
  };
}

// Execute zap (skip to next video)
async function executeZap(videoId: string, context: Partial<ErrorContext>): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  // Zap action - trigger next video
  // This would typically be handled by the parent component
  console.log(`🔄 Zapping to next video: ${videoId}`);
  
  return {
    success: true,
    action: RecoveryAction.ZAP,
    duration: Date.now() - startTime,
  };
}

// Auto-recovery handler
export async function handleAutoRecovery(
  errorType: ErrorType,
  error: any,
  context: Partial<ErrorContext>,
  config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG
): Promise<RecoveryResult | null> {
  // Check if auto-recovery is enabled
  if (!config.autoRecoveryEnabled) {
    return null;
  }
  
  // Check if error should auto-recover
  if (!shouldAutoRecover(errorType)) {
    return null;
  }
  
  // Execute recovery action
  return await executeRecoveryAction(context.videoId || 'unknown', errorType, context, config);
}

// Get recovery statistics
export function getRecoveryStats(): {
  totalRecoveries: number;
  successfulRecoveries: number;
  recoverySuccessRate: number;
  activeRecoveries: number;
  recoveryStates: RecoveryState[];
} {
  const states = Array.from(recoveryStates.values());
  const activeRecoveries = states.filter(state => state.recoveryInProgress).length;
  const totalRecoveries = states.reduce((sum, state) => sum + state.recoveryAttempts, 0);
  const successfulRecoveries = states.filter(state => state.retryCount === 0 && state.recoveryAttempts > 0).length;
  
  return {
    totalRecoveries,
    successfulRecoveries,
    recoverySuccessRate: totalRecoveries > 0 ? (successfulRecoveries / totalRecoveries) * 100 : 0,
    activeRecoveries,
    recoveryStates: states.slice(-10), // Last 10 states
  };
}

// Get recovery health status
export function getRecoveryHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getRecoveryStats();
  
  if (stats.recoverySuccessRate < 50) return 'critical';
  if (stats.recoverySuccessRate < 80 || stats.activeRecoveries > 3) return 'warning';
  return 'healthy';
}

// Clear recovery states
export function clearRecoveryStates(): void {
  recoveryStates.clear();
}

// Reset recovery state for a video
export function resetRecoveryState(videoId: string): void {
  recoveryStates.delete(videoId);
}