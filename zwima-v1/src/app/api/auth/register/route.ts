import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/resend";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const companyName = String(body.companyName || "").trim();
    const country = String(body.country || "").trim();

    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "User sync failed" }, { status: 500 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendVerificationEmail({
      to: email,
      companyName,
      verifyUrl: `${appUrl}/dashboard`,
    });

    if (companyName || country) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.user.update({
        where: { id: user.id },
        data: { companyName: companyName || user.companyName, country: country || user.country },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
