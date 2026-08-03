import { NextRequest, NextResponse } from "next/server";
import { CCAAS, resolverCP } from "@/lib/territorio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get("cp");
  return NextResponse.json({
    ccaas: CCAAS,
    zona: cp ? resolverCP(cp) : null,
  });
}
