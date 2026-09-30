import { NextResponse } from "next/server";

// Resolution evidence is acquired only by the scheduled GitHub publisher.
// The legacy unauthenticated mutation endpoint is deliberately retired.
export async function POST() {
  return NextResponse.json({ error: "Public outcome ingestion is disabled" }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
