import { auth, currentUser } from "@clerk/nextjs/server";

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "admin@zwima-group.info";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase();
  if (!email || !adminEmails().has(email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
