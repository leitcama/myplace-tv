import { NextResponse } from "next/server";

export async function GET() {
  try{
    const serverTime = new Date().toISOString();
    return NextResponse.json({ ok: true, serverTime });
  } catch (e:any){
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}