import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "Experimental Pulse scores have been retired", successor: "/api/indices" }, {
    status: 410, headers: { "Link": '</api/indices>; rel="successor-version"', "Cache-Control": "public, s-maxage=300" },
  });
}
