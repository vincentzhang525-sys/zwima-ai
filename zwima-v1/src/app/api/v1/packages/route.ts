import { NextResponse } from "next/server";
import { listCreditPackages } from "@/lib/stripe";
import { isStripePreviewDisabled } from "@/lib/stripe-preview-guard";

function mapPackages(
  packages: Awaited<ReturnType<typeof listCreditPackages>>,
) {
  return packages.map((p) => ({
    id: p.id,
    label: p.label,
    amountEur: String(p.amountEur),
    credits: p.credits,
  }));
}

function emptyCatalogResponse(status = 200) {
  return NextResponse.json(
    {
      stripePreviewDisabled: isStripePreviewDisabled(),
      packages: [] as Array<{
        id: string;
        label: string;
        amountEur: string;
        credits: number;
      }>,
    },
    { status },
  );
}

/**
 * Public package catalog.
 * - Empty catalog → HTTP 200 with packages: []
 * - Preview read failures → HTTP 200 empty catalog (no opaque 500)
 * - Non-preview read failures → sanitized controlled 503
 * - Never creates, seeds, or mutates package records
 */
export async function GET() {
  try {
    const packages = await listCreditPackages();
    return NextResponse.json({
      stripePreviewDisabled: isStripePreviewDisabled(),
      packages: mapPackages(packages),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Package catalog unavailable";
    const sanitized = message
      .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted]")
      .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "[redacted]")
      .slice(0, 200);

    console.error("[v1/packages] catalog read failed:", sanitized);

    // Preview must never surface opaque 500s for catalog reads.
    if ((process.env.VERCEL_ENV || "").toLowerCase() === "preview") {
      return emptyCatalogResponse(200);
    }

    return NextResponse.json(
      {
        error: {
          code: "PACKAGE_CATALOG_UNAVAILABLE",
          message: "Unable to load credit packages.",
        },
        stripePreviewDisabled: isStripePreviewDisabled(),
        packages: [],
      },
      { status: 503 },
    );
  }
}
