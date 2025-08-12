import { NextResponse } from "next/server";
import { getStatus, setCookieString, setCookiesFilePath, getCookieString, getCookiesFilePath } from "@/lib/server/ytCreds";

export const dynamic = "force-dynamic";

export async function GET(){
  const s = getStatus();
  return NextResponse.json({ ok: true, status: s });
}

export async function POST(req: Request){
  try{
    const body = await req.json().catch(()=>({}));
    if (typeof body.cookie === "string") setCookieString(body.cookie);
    if (typeof body.cookiesFile === "string") setCookiesFilePath(body.cookiesFile);
    return NextResponse.json({ ok: true, status: getStatus() });
  } catch (e:any){
    return NextResponse.json({ ok: false, error: e?.message||"bad_json" }, { status: 400 });
  }
}