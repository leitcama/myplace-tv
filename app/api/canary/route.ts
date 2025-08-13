import { NextResponse } from "next/server";
import { triggerCanaryTest, getCanaryStats, getCanaryHealth, isCanaryTestDue } from "@/lib/canary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = getCanaryStats();
    const health = getCanaryHealth();
    const isDue = isCanaryTestDue();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health,
      isDue,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "canary_stats_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    console.log('🚨 Manual canary test triggered via API');
    const result = await triggerCanaryTest();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "canary_test_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}