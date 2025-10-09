import { NextResponse } from "next/server";

export async function GET() {
  console.log("BYPASS_AUTH", process.env.BYPASS_AUTH);
  const bypassAuth = process.env.BYPASS_AUTH === "true";
  
  return NextResponse.json({ 
    bypassAuth,
    user: bypassAuth ? { id: "bypass-user" } : null 
  });
}
