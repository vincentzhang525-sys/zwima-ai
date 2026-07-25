import { getLiveHealth } from "@/lib/ops-health";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getLiveHealth());
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
