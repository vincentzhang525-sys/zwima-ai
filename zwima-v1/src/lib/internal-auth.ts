import { requireAdmin } from "@/lib/admin";

export class InternalAuthError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "InternalAuthError";
  }
}

export async function requireInternalServiceRole(req: Request) {
  const headerKey =
    req.headers.get("x-service-role-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const expected = process.env.SERVICE_ROLE_API_KEY ?? process.env.INTERNAL_SERVICE_ROLE_KEY;
  if (expected && headerKey === expected) {
    return true;
  }

  try {
    await requireAdmin();
    return true;
  } catch {
    throw new InternalAuthError();
  }
}
