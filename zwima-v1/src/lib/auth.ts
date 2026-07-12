import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

export async function getCurrentDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (user) return user;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  user = await prisma.user.create({
    data: {
      clerkId: userId,
      email,
      companyName: (clerkUser.unsafeMetadata?.companyName as string) || null,
      country: (clerkUser.unsafeMetadata?.country as string) || null,
      emailVerified: clerkUser.emailAddresses[0]?.verification?.status === "verified",
      creditBalance: { create: { credits: 1000 } },
    },
  });

  return user;
}

export async function requireDbUser() {
  const user = await getCurrentDbUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
