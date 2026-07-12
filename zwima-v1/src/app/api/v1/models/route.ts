import { NextResponse } from "next/server";
import { getAllAdapters } from "@/lib/providers/router";

export async function GET() {
  const adapters = getAllAdapters();
  const providers = adapters.map((a) => ({ slug: a.slug, name: a.name }));
  const models = adapters.flatMap((a) => a.models());

  return NextResponse.json({ providers, models });
}
