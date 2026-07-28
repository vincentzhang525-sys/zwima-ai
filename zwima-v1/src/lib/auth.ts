import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import type { User as ClerkUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

function resolveClerkEmail(clerkUser: ClerkUser): string | null {
  const primary =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses.find((e) => e.verification?.status === "verified")?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  return primary ? primary.trim().toLowerCase() : null;
}

async function loadClerkProfile(userId: string): Promise<ClerkUser | null> {
  const fromSession = await currentUser();
  if (fromSession?.id === userId) return fromSession;

  try {
    const client = await clerkClient();
    return await client.users.getUser(userId);
  } catch {
    return null;
  }
}

async function ensureCreditBalance(userId: string) {
  await prisma.creditBalance.upsert({
    where: { userId },
    create: { userId, credits: 1000 },
    update: {},
  });
}

export async function getCurrentDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (user) return user;

  const clerkUser = await loadClerkProfile(userId);
  if (!clerkUser) return null;

  const email = resolveClerkEmail(clerkUser);
  if (!email) return null;

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    user = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId: userId,
        emailVerified:
          clerkUser.emailAddresses.some((e) => e.verification?.status === "verified") ||
          existingByEmail.emailVerified,
        companyName: existingByEmail.companyName ?? (clerkUser.unsafeMetadata?.companyName as string) ?? null,
        country: existingByEmail.country ?? (clerkUser.unsafeMetadata?.country as string) ?? null,
      },
    });
    // Accept pending invites on first successful Clerk link (GAP-012 Viewer path).
    await prisma.organizationMember.updateMany({
      where: { userId: user.id, accepted: false },
      data: { accepted: true },
    });
    await ensureCreditBalance(user.id);
    return user;
  }

  try {
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        companyName: (clerkUser.unsafeMetadata?.companyName as string) || null,
        country: (clerkUser.unsafeMetadata?.country as string) || null,
        emailVerified: clerkUser.emailAddresses.some((e) => e.verification?.status === "verified"),
        creditBalance: { create: { credits: 1000 } },
      },
    });
    return user;
  } catch {
    user =
      (await prisma.user.findUnique({ where: { clerkId: userId } })) ??
      (await prisma.user.findUnique({ where: { email } }));
    return user;
  }
}

export async function requireDbUser() {
  const user = await getCurrentDbUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
