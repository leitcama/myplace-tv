import { NextResponse } from "next/server";
import { getSyntheticStats, getSyntheticHealth, forceRunSyntheticTests } from "@/lib/synthetic-monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const stats = getSyntheticStats();
    
    if (!stats) {
      return NextResponse.json(
        { error: "synthetic_monitoring_not_initialized" },
        { status: 503 }
      );
    }
    
    return NextResponse.json({
      health: stats.health,
      config: stats.config,
      lastRun: stats.lastRun,
      consecutiveFailures: stats.consecutiveFailures,
      alertHistory: stats.alertHistory,
      isRunning: stats.isRunning,
      nextRunTime: stats.nextRunTime,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('Synthetic monitoring GET error:', error);
    return NextResponse.json(
      { error: "synthetic_monitoring_error", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    
    switch (action) {
      case 'run_tests':
        const testRun = await forceRunSyntheticTests();
        return NextResponse.json({
          success: true,
          testRun,
          message: 'Synthetic tests triggered successfully',
        });
        
      case 'get_stats':
        const stats = getSyntheticStats();
        return NextResponse.json({
          success: true,
          stats,
        });
        
      default:
        return NextResponse.json(
          { error: "invalid_action", message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
  } catch (error: any) {
    console.error('Synthetic monitoring POST error:', error);
    return NextResponse.json(
      { error: "synthetic_monitoring_error", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}