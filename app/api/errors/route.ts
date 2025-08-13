import { NextResponse } from "next/server";
import { 
  getErrorStats, 
  getErrorHealth, 
  clearErrorTracking,
  ErrorType,
  trackError 
} from "@/lib/error-taxonomy";
import { 
  getRecoveryStats, 
  getRecoveryHealth, 
  clearRecoveryStates,
  executeRecoveryAction,
  RecoveryAction 
} from "@/lib/error-recovery";
import { 
  getWatchdogStats, 
  getWatchdogHealth, 
  clearAllWatchdogStates,
  getAllWatchdogStates 
} from "@/lib/enhanced-watchdog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const errorType = searchParams.get("errorType");

    // Get error statistics
    const errorStats = getErrorStats();
    const errorHealth = getErrorHealth();
    
    // Get recovery statistics
    const recoveryStats = getRecoveryStats();
    const recoveryHealth = getRecoveryHealth();
    
    // Get watchdog statistics
    const watchdogStats = getWatchdogStats();
    const watchdogHealth = getWatchdogHealth();
    const allWatchdogStates = getAllWatchdogStates();

    // Filter watchdog states if specific video requested
    let filteredWatchdogStates = allWatchdogStates;
    if (videoId) {
      filteredWatchdogStates = allWatchdogStates.filter(state => state.videoId === videoId);
    }

    // Filter error counts if specific error type requested
    let filteredErrorCounts = errorStats.errorCounts;
    if (errorType && errorType in ErrorType) {
      const filteredCounts: Record<ErrorType, number> = {} as Record<ErrorType, number>;
      filteredCounts[errorType as ErrorType] = errorStats.errorCounts[errorType as ErrorType];
      filteredErrorCounts = filteredCounts;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      errors: {
        health: errorHealth,
        stats: {
          totalErrors: errorStats.totalErrors,
          totalRecoveries: errorStats.totalRecoveries,
          errorCounts: filteredErrorCounts,
          recoverySuccessRates: errorStats.recoverySuccessRates,
          errorDistribution: errorStats.errorDistribution,
        },
        recentErrors: errorStats.recentErrors.slice(-10), // Last 10 errors
      },
      recovery: {
        health: recoveryHealth,
        stats: recoveryStats,
        states: recoveryStats.recoveryStates.slice(-10), // Last 10 states
      },
      watchdog: {
        health: watchdogHealth,
        stats: watchdogStats,
        states: filteredWatchdogStates.slice(-10), // Last 10 states
      },
      filters: {
        videoId: videoId || null,
        errorType: errorType || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "error_stats_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const videoId = searchParams.get("videoId");
    const errorType = searchParams.get("errorType") as ErrorType;
    const recoveryAction = searchParams.get("recoveryAction") as RecoveryAction;

    if (!action) {
      return NextResponse.json(
        { error: "action_required", message: "Action parameter is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "track_error":
        if (!videoId || !errorType) {
          return NextResponse.json(
            { error: "missing_params", message: "videoId and errorType are required for track_error" },
            { status: 400 }
          );
        }

        const body = await req.json();
        const message = body.message || "Manual error tracking";
        const context = body.context || {};

        trackError(errorType, message, { videoId, ...context });

        return NextResponse.json({
          timestamp: new Date().toISOString(),
          success: true,
          action: "track_error",
          videoId,
          errorType,
          message,
        });

      case "execute_recovery":
        if (!videoId || !errorType) {
          return NextResponse.json(
            { error: "missing_params", message: "videoId and errorType are required for execute_recovery" },
            { status: 400 }
          );
        }

        const recoveryContext = { videoId, userAgent: "API" };
        const result = await executeRecoveryAction(videoId, errorType, recoveryContext);

        return NextResponse.json({
          timestamp: new Date().toISOString(),
          success: true,
          action: "execute_recovery",
          videoId,
          errorType,
          result,
        });

      case "manual_recovery":
        if (!videoId || !recoveryAction) {
          return NextResponse.json(
            { error: "missing_params", message: "videoId and recoveryAction are required for manual_recovery" },
            { status: 400 }
          );
        }

        const manualContext = { videoId, userAgent: "API" };
        const manualResult = await executeRecoveryAction(
          videoId, 
          errorType || ErrorType.UNKNOWN, 
          manualContext
        );

        return NextResponse.json({
          timestamp: new Date().toISOString(),
          success: true,
          action: "manual_recovery",
          videoId,
          recoveryAction,
          result: manualResult,
        });

      default:
        return NextResponse.json(
          { error: "invalid_action", message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "error_action_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const target = searchParams.get("target") || "all";

    switch (target) {
      case "errors":
        clearErrorTracking();
        break;
      case "recovery":
        clearRecoveryStates();
        break;
      case "watchdog":
        clearAllWatchdogStates();
        break;
      case "all":
        clearErrorTracking();
        clearRecoveryStates();
        clearAllWatchdogStates();
        break;
      default:
        return NextResponse.json(
          { error: "invalid_target", message: `Unknown target: ${target}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Cleared ${target} data`,
      target,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "clear_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}