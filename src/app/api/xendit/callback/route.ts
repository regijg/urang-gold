import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { message: "Xendit callback is disabled for the apartment deployment." },
    { status: 200 }
  );
}
