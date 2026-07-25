import { getReadyHealth } from "@/lib/ops-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await getReadyHealth();
  const status = body.status === "unhealthy" ? 503 : 200;
  return Response.json(body, { status });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
