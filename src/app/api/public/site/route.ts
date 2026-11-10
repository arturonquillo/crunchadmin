import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site";

export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
