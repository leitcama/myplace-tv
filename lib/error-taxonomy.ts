// Error taxonomy for precise error handling and quick recovery
export enum ErrorType {
  // Startup errors
  STARTUP_TIMEOUT = 'startup_timeout',
  MANIFEST_4XX = 'manifest_4xx',
  MANIFEST_5XX = 'manifest_5xx',
  
  // Playback errors
  SEGMENT_4XX = 'segment_4xx',
  SEGMENT_5XX = 'segment_5xx',
  NETWORK_STALL = 'network_stall',
  DECODER_ERROR = 'decoder_error',
  
  // Resolver errors
  DECIPHER_ERROR = 'decipher_error',
  TIER_FALLBACK = 'tier_fallback',
  
  // Quality errors
  QUALITY_SWITCH_FAILED = 'quality_switch_failed',
  BUFFER_UNDERRUN = 'buffer_underrun',
  
  // Expiry errors
  MANIFEST_EXPIRED = 'manifest_expired',
  URL_EXPIRED = 'url_expired',
  
  // Unknown errors
  UNKNOWN = 'unknown',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Recovery action types
export enum RecoveryAction {
  RETRY = 'retry',
  DOWNGRADE_QUALITY = 'downgrade_quality',
  RE_RESOLVE = 're_resolve',
  ZAP = 'zap',
  REFRESH_MANIFEST = 'refresh_manifest',
  SWITCH_TIER = 'switch_tier',
  WAIT_AND_RETRY = 'wait_and_retry',
  IGNORE = 'ignore',
}

// Error taxonomy definition
export interface ErrorDefinition {
  type: ErrorType;
  severity: ErrorSeverity;
  description: string;
  recoveryActions: RecoveryAction[];
  maxRetries: number;
  retryDelayMs: number;
  autoRecover: boolean;
  requiresUserAction: boolean;
}

// Error taxonomy mapping
export const ERROR_TAXONOMY: Record<ErrorType, ErrorDefinition> = {
  [ErrorType.STARTUP_TIMEOUT]: {
    type: ErrorType.STARTUP_TIMEOUT,
    severity: ErrorSeverity.HIGH,
    description: 'Video startup exceeded timeout threshold',
    recoveryActions: [RecoveryAction.RE_RESOLVE, RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.MANIFEST_4XX]: {
    type: ErrorType.MANIFEST_4XX,
    severity: ErrorSeverity.HIGH,
    description: 'Manifest request returned 4xx error',
    recoveryActions: [RecoveryAction.RE_RESOLVE, RecoveryAction.SWITCH_TIER, RecoveryAction.ZAP],
    maxRetries: 3,
    retryDelayMs: 2000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.MANIFEST_5XX]: {
    type: ErrorType.MANIFEST_5XX,
    severity: ErrorSeverity.MEDIUM,
    description: 'Manifest request returned 5xx error',
    recoveryActions: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.SWITCH_TIER, RecoveryAction.ZAP],
    maxRetries: 3,
    retryDelayMs: 5000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.SEGMENT_4XX]: {
    type: ErrorType.SEGMENT_4XX,
    severity: ErrorSeverity.MEDIUM,
    description: 'Segment request returned 4xx error',
    recoveryActions: [RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.REFRESH_MANIFEST, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.SEGMENT_5XX]: {
    type: ErrorType.SEGMENT_5XX,
    severity: ErrorSeverity.LOW,
    description: 'Segment request returned 5xx error',
    recoveryActions: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.ZAP],
    maxRetries: 3,
    retryDelayMs: 2000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.NETWORK_STALL]: {
    type: ErrorType.NETWORK_STALL,
    severity: ErrorSeverity.MEDIUM,
    description: 'Network connection stalled during playback',
    recoveryActions: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.ZAP],
    maxRetries: 3,
    retryDelayMs: 3000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.DECODER_ERROR]: {
    type: ErrorType.DECODER_ERROR,
    severity: ErrorSeverity.HIGH,
    description: 'Video decoder encountered an error',
    recoveryActions: [RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.RE_RESOLVE, RecoveryAction.ZAP],
    maxRetries: 1,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.DECIPHER_ERROR]: {
    type: ErrorType.DECIPHER_ERROR,
    severity: ErrorSeverity.HIGH,
    description: 'YouTube signature deciphering failed',
    recoveryActions: [RecoveryAction.SWITCH_TIER, RecoveryAction.RE_RESOLVE, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 2000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.TIER_FALLBACK]: {
    type: ErrorType.TIER_FALLBACK,
    severity: ErrorSeverity.LOW,
    description: 'Fallback to lower tier resolver',
    recoveryActions: [RecoveryAction.IGNORE],
    maxRetries: 0,
    retryDelayMs: 0,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.QUALITY_SWITCH_FAILED]: {
    type: ErrorType.QUALITY_SWITCH_FAILED,
    severity: ErrorSeverity.LOW,
    description: 'Quality level switch failed',
    recoveryActions: [RecoveryAction.IGNORE, RecoveryAction.DOWNGRADE_QUALITY],
    maxRetries: 1,
    retryDelayMs: 500,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.BUFFER_UNDERRUN]: {
    type: ErrorType.BUFFER_UNDERRUN,
    severity: ErrorSeverity.MEDIUM,
    description: 'Playback buffer underrun',
    recoveryActions: [RecoveryAction.DOWNGRADE_QUALITY, RecoveryAction.WAIT_AND_RETRY],
    maxRetries: 2,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.MANIFEST_EXPIRED]: {
    type: ErrorType.MANIFEST_EXPIRED,
    severity: ErrorSeverity.MEDIUM,
    description: 'Manifest has expired',
    recoveryActions: [RecoveryAction.REFRESH_MANIFEST, RecoveryAction.RE_RESOLVE, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.URL_EXPIRED]: {
    type: ErrorType.URL_EXPIRED,
    severity: ErrorSeverity.HIGH,
    description: 'Video URL has expired',
    recoveryActions: [RecoveryAction.REFRESH_MANIFEST, RecoveryAction.RE_RESOLVE, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 1000,
    autoRecover: true,
    requiresUserAction: false,
  },
  
  [ErrorType.UNKNOWN]: {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    description: 'Unknown error occurred',
    recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ZAP],
    maxRetries: 2,
    retryDelayMs: 2000,
    autoRecover: false,
    requiresUserAction: true,
  },
};

// Error context for tracking
export interface ErrorContext {
  videoId: string;
  timestamp: string;
  userAgent: string;
  networkType?: string;
  currentQuality?: string;
  playbackTime?: number;
  correlationId?: string;
  clientProfile?: string;
  region?: string;
  tier?: string;
}

// Error event for tracking
export interface ErrorEvent {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  context: ErrorContext;
  retryCount: number;
  recoveryAction?: RecoveryAction;
  success: boolean;
  duration?: number;
}

// Error tracking state
interface ErrorTrackingState {
  errors: ErrorEvent[];
  errorCounts: Record<ErrorType, number>;
  recoverySuccessRates: Record<ErrorType, number>;
  lastError?: ErrorEvent;
  totalErrors: number;
  totalRecoveries: number;
}

// Error tracking storage
const errorTrackingState: ErrorTrackingState = {
  errors: [],
  errorCounts: Object.values(ErrorType).reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<ErrorType, number>),
  recoverySuccessRates: Object.values(ErrorType).reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<ErrorType, number>),
  totalErrors: 0,
  totalRecoveries: 0,
};

// Classify error based on various inputs
export function classifyError(
  error: any,
  context: Partial<ErrorContext> = {}
): ErrorType {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status || error?.statusCode;
  
  // Check for specific error patterns
  if (errorMessage.includes('timeout') || errorMessage.includes('startup')) {
    return ErrorType.STARTUP_TIMEOUT;
  }
  
  if (errorCode >= 400 && errorCode < 500) {
    if (errorMessage.includes('manifest') || errorMessage.includes('m3u8') || errorMessage.includes('mpd')) {
      return ErrorType.MANIFEST_4XX;
    }
    if (errorMessage.includes('segment') || errorMessage.includes('chunk')) {
      return ErrorType.SEGMENT_4XX;
    }
    if (errorMessage.includes('expired') || errorMessage.includes('403')) {
      return ErrorType.URL_EXPIRED;
    }
  }
  
  if (errorCode >= 500) {
    if (errorMessage.includes('manifest') || errorMessage.includes('m3u8') || errorMessage.includes('mpd')) {
      return ErrorType.MANIFEST_5XX;
    }
    if (errorMessage.includes('segment') || errorMessage.includes('chunk')) {
      return ErrorType.SEGMENT_5XX;
    }
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('stall') || errorMessage.includes('connection')) {
    return ErrorType.NETWORK_STALL;
  }
  
  if (errorMessage.includes('decoder') || errorMessage.includes('codec') || errorMessage.includes('format')) {
    return ErrorType.DECODER_ERROR;
  }
  
  if (errorMessage.includes('decipher') || errorMessage.includes('signature') || errorMessage.includes('transform')) {
    return ErrorType.DECIPHER_ERROR;
  }
  
  if (errorMessage.includes('fallback') || errorMessage.includes('tier')) {
    return ErrorType.TIER_FALLBACK;
  }
  
  if (errorMessage.includes('quality') || errorMessage.includes('switch') || errorMessage.includes('level')) {
    return ErrorType.QUALITY_SWITCH_FAILED;
  }
  
  if (errorMessage.includes('buffer') || errorMessage.includes('underrun') || errorMessage.includes('starvation')) {
    return ErrorType.BUFFER_UNDERRUN;
  }
  
  if (errorMessage.includes('expired') || errorMessage.includes('manifest')) {
    return ErrorType.MANIFEST_EXPIRED;
  }
  
  return ErrorType.UNKNOWN;
}

// Get error definition
export function getErrorDefinition(type: ErrorType): ErrorDefinition {
  return ERROR_TAXONOMY[type] || ERROR_TAXONOMY[ErrorType.UNKNOWN];
}

// Track error event
export function trackError(
  type: ErrorType,
  message: string,
  context: Partial<ErrorContext>,
  retryCount: number = 0,
  recoveryAction?: RecoveryAction,
  success: boolean = false,
  duration?: number
): void {
  const definition = getErrorDefinition(type);
  const errorEvent: ErrorEvent = {
    type,
    severity: definition.severity,
    message,
    context: {
      videoId: context.videoId || 'unknown',
      timestamp: new Date().toISOString(),
      userAgent: context.userAgent || 'unknown',
      networkType: context.networkType,
      currentQuality: context.currentQuality,
      playbackTime: context.playbackTime,
      correlationId: context.correlationId,
      clientProfile: context.clientProfile,
      region: context.region,
      tier: context.tier,
    },
    retryCount,
    recoveryAction,
    success,
    duration,
  };
  
  // Update tracking state
  errorTrackingState.errors.push(errorEvent);
  errorTrackingState.errorCounts[type]++;
  errorTrackingState.totalErrors++;
  errorTrackingState.lastError = errorEvent;
  
  // Keep only last 100 errors
  if (errorTrackingState.errors.length > 100) {
    errorTrackingState.errors.shift();
  }
  
  // Update recovery success rate
  if (recoveryAction && recoveryAction !== RecoveryAction.IGNORE) {
    errorTrackingState.totalRecoveries++;
    if (success) {
      const currentRate = errorTrackingState.recoverySuccessRates[type];
      const totalErrors = errorTrackingState.errorCounts[type];
      errorTrackingState.recoverySuccessRates[type] = 
        ((currentRate * (totalErrors - 1)) + 1) / totalErrors;
    }
  }
  
  console.log(`🚨 Error tracked: ${type} (${definition.severity})`, {
    message,
    retryCount,
    recoveryAction,
    success,
    duration,
  });
}

// Get next recovery action
export function getNextRecoveryAction(
  type: ErrorType,
  retryCount: number
): RecoveryAction | null {
  const definition = getErrorDefinition(type);
  
  if (retryCount >= definition.maxRetries) {
    return null;
  }
  
  const actions = definition.recoveryActions;
  return actions[Math.min(retryCount, actions.length - 1)] || null;
}

// Check if error should auto-recover
export function shouldAutoRecover(type: ErrorType): boolean {
  const definition = getErrorDefinition(type);
  return definition.autoRecover;
}

// Check if error requires user action
export function requiresUserAction(type: ErrorType): boolean {
  const definition = getErrorDefinition(type);
  return definition.requiresUserAction;
}

// Get error statistics
export function getErrorStats(): {
  totalErrors: number;
  totalRecoveries: number;
  errorCounts: Record<ErrorType, number>;
  recoverySuccessRates: Record<ErrorType, number>;
  recentErrors: ErrorEvent[];
  errorDistribution: Record<ErrorSeverity, number>;
} {
  const errorDistribution = Object.values(ErrorSeverity).reduce((acc, severity) => {
    acc[severity] = 0;
    return acc;
  }, {} as Record<ErrorSeverity, number>);
  
  // Calculate error distribution by severity
  errorTrackingState.errors.forEach(error => {
    errorDistribution[error.severity]++;
  });
  
  return {
    totalErrors: errorTrackingState.totalErrors,
    totalRecoveries: errorTrackingState.totalRecoveries,
    errorCounts: { ...errorTrackingState.errorCounts },
    recoverySuccessRates: { ...errorTrackingState.recoverySuccessRates },
    recentErrors: errorTrackingState.errors.slice(-20), // Last 20 errors
    errorDistribution,
  };
}

// Get error health status
export function getErrorHealth(): 'healthy' | 'warning' | 'critical' {
  const stats = getErrorStats();
  const recentErrors = stats.recentErrors.filter(
    error => Date.now() - new Date(error.context.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
  );
  
  const criticalErrors = recentErrors.filter(error => error.severity === ErrorSeverity.CRITICAL).length;
  const highErrors = recentErrors.filter(error => error.severity === ErrorSeverity.HIGH).length;
  
  if (criticalErrors > 0) return 'critical';
  if (highErrors > 2 || recentErrors.length > 10) return 'warning';
  return 'healthy';
}

// Clear error tracking
export function clearErrorTracking(): void {
  errorTrackingState.errors = [];
  Object.keys(errorTrackingState.errorCounts).forEach(key => {
    errorTrackingState.errorCounts[key as ErrorType] = 0;
  });
  Object.keys(errorTrackingState.recoverySuccessRates).forEach(key => {
    errorTrackingState.recoverySuccessRates[key as ErrorType] = 0;
  });
  errorTrackingState.totalErrors = 0;
  errorTrackingState.totalRecoveries = 0;
  errorTrackingState.lastError = undefined;
}

// Map Shaka Player events to error types
export function mapShakaEventToErrorType(event: any): ErrorType {
  const eventType = event?.type;
  
  switch (eventType) {
    case 'error':
      return classifyError(event.detail);
    case 'buffering':
      return ErrorType.BUFFER_UNDERRUN;
    case 'qualitychanged':
      return ErrorType.QUALITY_SWITCH_FAILED;
    default:
      return ErrorType.UNKNOWN;
  }
}

// Map hls.js events to error types
export function mapHlsEventToErrorType(event: any): ErrorType {
  const eventType = event?.type;
  
  switch (eventType) {
    case 'error':
      return classifyError(event.details);
    case 'bufferstalled':
      return ErrorType.BUFFER_UNDERRUN;
    case 'levelswitching':
      return ErrorType.QUALITY_SWITCH_FAILED;
    default:
      return ErrorType.UNKNOWN;
  }
}