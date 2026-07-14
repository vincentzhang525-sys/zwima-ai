import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getCurrentDbUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  createProviderModel,
  listModelsWithLifecycle,
  updateModelLifecycle,
} from "@/lib/model-lifecycle/lifecycle-service";

export async function GET() {
  try {
    await requireAdmin();
    const models = await listModelsWithLifecycle();
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { providerId, modelCode, displayName, contextWindow, region, euAvailable, status } = body;
    if (!providerId || !modelCode || !displayName) {
      return NextResponse.json({ error: "providerId, modelCode, displayName required" }, { status: 400 });
    }
    const model = await createProviderModel({
      providerId,
      modelCode,
      displayName,
      contextWindow,
      region,
      euAvailable,
      status,
    });
    await writeAudit({
      userId: user?.id,
      action: `Created model ${modelCode}`,
      category: "ADMIN",
      detail: { providerId, modelCode },
    });
    return NextResponse.json({ model });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const user = await getCurrentDbUser();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const model = await updateModelLifecycle(id, fields);
    await writeAudit({
      userId: user?.id,
      action: `Updated model lifecycle ${model.modelCode}`,
      category: "ADMIN",
      detail: fields,
    });
    return NextResponse.json({ model });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
