import { NextResponse } from "next/server";
import { 
  getExpiryStats, 
  getExpiryHealth, 
  getAllExpiryStates, 
  triggerManualRefresh, 
  clearAllExpiryStates,
  DEFAULT_EXPIRY_CONFIG 
} from "@/lib/expiry";
import { ClientProfile } from "@/types/resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const clientProfile = searchParams.get("clientProfile");
    const region = searchParams.get("region");

    const stats = getExpiryStats();
    const health = getExpiryHealth();
    const allStates = getAllExpiryStates();

    // Filter states if specific video/client/region requested
    let filteredStates = allStates;
    if (videoId || clientProfile || region) {
      filteredStates = allStates.filter(state => {
        if (videoId && state.videoId !== videoId) return false;
        if (clientProfile && state.clientProfile !== clientProfile) return false;
        if (region && state.region !== region) return false;
        return true;
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health,
      stats,
      config: DEFAULT_EXPIRY_CONFIG,
      states: filteredStates.slice(-20), // Last 20 states
      totalStates: filteredStates.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "expiry_stats_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const clientProfile = searchParams.get("clientProfile") || "WEB";
    const region = searchParams.get("region") || "US";

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId_required", message: "videoId is required for manual refresh" },
        { status: 400 }
      );
    }

    console.log('🔄 Manual expiry refresh triggered via API', { videoId, clientProfile, region });
    
    const result = await triggerManualRefresh(videoId, clientProfile as ClientProfile, region);
    
    if (!result) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        success: false,
        message: "No expiry state found for this video",
        videoId,
        clientProfile,
        region,
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      result,
      videoId,
      clientProfile,
      region,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "expiry_refresh_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearAllExpiryStates();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: true,
      message: "All expiry states cleared",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "expiry_clear_failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}