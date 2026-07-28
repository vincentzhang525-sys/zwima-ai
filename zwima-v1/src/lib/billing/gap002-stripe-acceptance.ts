/**
 * GAP-002 Closed Beta Stripe Test Mode acceptance (server-side).
 * Never logs Stripe secrets. Does not send email.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  assertStripeTestModeForClosedBeta,
  classifyStripeKey,
  stripeModeDiagnostic,
} from "@/lib/stripe-mode-gate";

const SMOKE_EMAIL = "gap002-stripe-smoke@zwima.internal";
const SMOKE_CREDITS = 25;
const SMOKE_AMOUNT_EUR = 1;

export type Gap002AcceptanceReport = {
  ok: boolean;
  stripeMode: string;
  secretKind: string;
  publishableKind: string;
  livemode: boolean | null;
  checkoutStatus: "PASS" | "FAIL";
  webhookSignatureStatus: "PASS" | "FAIL";
  webhookIdempotencyStatus: "PASS" | "FAIL";
  failedWebhookNoCreditStatus: "PASS" | "FAIL";
  paymentLedgerStatus: "PASS" | "FAIL";
  transactionLedgerStatus: "PASS" | "FAIL";
  creditBalanceStatus: "PASS" | "FAIL";
  ledgerConsistencyStatus: "PASS" | "FAIL";
  realEmailSent: false;
  blockers: string[];
};

function bearerMatches(expected: string | undefined, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authorizeGap002Smoke(req: Request): boolean {
  const provided =
    req.headers.get("x-gap002-smoke-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";
  const allowed = [
    process.env.SMOKE_TEST_API_KEY,
    process.env.SERVICE_ROLE_API_KEY,
    process.env.INTERNAL_SERVICE_ROLE_KEY,
  ].filter((v): v is string => Boolean(v && v.trim()));
  return allowed.some((k) => bearerMatches(k, provided));
}

async function ensureSmokeUser() {
  const existing = await prisma.user.findUnique({ where: { email: SMOKE_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: SMOKE_EMAIL,
      clerkId: `gap002_smoke_${createHash("sha256").update(SMOKE_EMAIL).digest("hex").slice(0, 24)}`,
      emailVerified: true,
      companyName: "GAP-002 Stripe Smoke",
      creditBalance: { create: { credits: 0 } },
    },
  });
}

function buildCheckoutCompletedEvent(params: {
  eventId: string;
  sessionId: string;
  userId: string;
  credits: number;
  amountEur: number;
  paymentIntentId: string;
}): Stripe.Event {
  const amountTotal = Math.round(params.amountEur * 100);
  return {
    id: params.eventId,
    object: "event",
    api_version: "2026-06-24.dahlia",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: params.sessionId,
        object: "checkout.session",
        amount_total: amountTotal,
        currency: "eur",
        payment_intent: params.paymentIntentId,
        metadata: {
          userId: params.userId,
          credits: String(params.credits),
          packageId: "gap002-smoke",
          couponCode: "",
        },
        mode: "payment",
        status: "complete",
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

async function postSignedWebhook(
  baseUrl: string,
  payload: string,
  secret: string,
): Promise<Response> {
  const stripe = getStripe();
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return fetch(`${baseUrl.replace(/\/$/, "")}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
}

export async function runGap002StripeAcceptance(options?: {
  baseUrl?: string;
}): Promise<Gap002AcceptanceReport> {
  const baseUrl = (options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://zwima-group.info").replace(
    /\/$/,
    "",
  );
  const blockers: string[] = [];
  const report: Gap002AcceptanceReport = {
    ok: false,
    stripeMode: "UNKNOWN",
    secretKind: "unknown",
    publishableKind: "unknown",
    livemode: null,
    checkoutStatus: "FAIL",
    webhookSignatureStatus: "FAIL",
    webhookIdempotencyStatus: "FAIL",
    failedWebhookNoCreditStatus: "FAIL",
    paymentLedgerStatus: "FAIL",
    transactionLedgerStatus: "FAIL",
    creditBalanceStatus: "FAIL",
    ledgerConsistencyStatus: "FAIL",
    realEmailSent: false,
    blockers,
  };

  try {
    assertStripeTestModeForClosedBeta();
  } catch (err) {
    blockers.push(err instanceof Error ? err.message : "stripe_test_mode_assert_failed");
    return report;
  }

  const diag = stripeModeDiagnostic(process.env);
  report.secretKind = diag.secretKind;
  report.publishableKind = diag.publishableKind;
  report.stripeMode = diag.secretKind === "test" ? "TEST" : diag.secretKind;

  if (classifyStripeKey(process.env.STRIPE_SECRET_KEY, "secret") === "live") {
    blockers.push("STRIPE_SECRET_KEY_live_not_allowed");
    return report;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!webhookSecret.startsWith("whsec_")) {
    blockers.push("STRIPE_WEBHOOK_SECRET_invalid_prefix");
    return report;
  }

  const stripe = getStripe();
  const balance = await stripe.balance.retrieve();
  report.livemode = Boolean(balance.livemode);
  if (balance.livemode) {
    blockers.push("stripe_account_livemode_true");
    return report;
  }
  report.stripeMode = "TEST";

  const user = await ensureSmokeUser();
  const before = await prisma.creditBalance.upsert({
    where: { userId: user.id },
    create: { userId: user.id, credits: 0 },
    update: {},
  });

  // 1) Test Mode Checkout session create
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(SMOKE_AMOUNT_EUR * 100),
            product_data: { name: "ZWIMA GAP-002 Smoke Credits" },
          },
          quantity: 1,
        },
      ],
      success_url: "https://zwima-group.info/dashboard/billing?success=1",
      cancel_url: "https://zwima-group.info/dashboard/billing?canceled=1",
      metadata: {
        userId: user.id,
        credits: String(SMOKE_CREDITS),
        packageId: "gap002-smoke",
        couponCode: "",
      },
    });
    if (!session.id || session.livemode) {
      blockers.push("checkout_session_invalid");
      return report;
    }
    report.checkoutStatus = "PASS";
  } catch (err) {
    blockers.push(err instanceof Error ? err.message.slice(0, 200) : "checkout_create_failed");
    return report;
  }

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      stripeSessionId: session.id,
      amountEur: SMOKE_AMOUNT_EUR,
      credits: SMOKE_CREDITS,
      status: "PENDING",
      packageId: "gap002-smoke",
    },
  });

  const eventId = `evt_gap002_${Date.now()}`;
  const paymentIntentId = `pi_gap002_${Date.now()}`;
  const event = buildCheckoutCompletedEvent({
    eventId,
    sessionId: session.id,
    userId: user.id,
    credits: SMOKE_CREDITS,
    amountEur: SMOKE_AMOUNT_EUR,
    paymentIntentId,
  });
  const payload = JSON.stringify(event);

  // 2) Valid signed webhook
  const okRes = await postSignedWebhook(baseUrl, payload, webhookSecret);
  if (!okRes.ok) {
    blockers.push(`webhook_failed_status_${okRes.status}`);
    return report;
  }
  report.webhookSignatureStatus = "PASS";

  const completed = await prisma.payment.findUnique({ where: { id: payment.id } });
  if (!completed || completed.status !== "COMPLETED" || completed.stripeEventId !== eventId) {
    // Webhook may create alternate payment path — also accept completed by session id
    const bySession = await prisma.payment.findFirst({ where: { stripeSessionId: session.id } });
    if (!bySession || bySession.status !== "COMPLETED") {
      blockers.push("payment_not_completed");
      return report;
    }
  }
  report.paymentLedgerStatus = "PASS";

  const afterFirst = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
  const creditedOnce = (afterFirst?.credits ?? 0) - before.credits;
  if (creditedOnce !== SMOKE_CREDITS) {
    // processRecharge may have run with invoice; still require exact delta
    blockers.push(`credit_delta_unexpected_${creditedOnce}`);
    return report;
  }
  report.creditBalanceStatus = "PASS";

  const tx = await prisma.transaction.findFirst({
    where: { userId: user.id, type: "RECHARGE", amount: SMOKE_CREDITS },
    orderBy: { createdAt: "desc" },
  });
  if (!tx) {
    blockers.push("recharge_transaction_missing");
    return report;
  }
  report.transactionLedgerStatus = "PASS";

  // 3) Replay same event — no double credit
  const replayRes = await postSignedWebhook(baseUrl, payload, webhookSecret);
  const replayBody = (await replayRes.json().catch(() => ({}))) as { duplicate?: boolean };
  const afterReplay = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
  if ((afterReplay?.credits ?? 0) !== (afterFirst?.credits ?? 0)) {
    blockers.push("idempotency_double_credit");
    return report;
  }
  if (!(replayBody.duplicate === true || replayRes.ok)) {
    blockers.push("idempotency_response_unexpected");
    return report;
  }
  report.webhookIdempotencyStatus = "PASS";

  // 4) Forged webhook — must not credit
  const forgedEventId = `evt_gap002_forged_${Date.now()}`;
  const forgedSessionId = `cs_test_forged_${Date.now()}`;
  const forged = buildCheckoutCompletedEvent({
    eventId: forgedEventId,
    sessionId: forgedSessionId,
    userId: user.id,
    credits: SMOKE_CREDITS,
    amountEur: SMOKE_AMOUNT_EUR,
    paymentIntentId: `pi_forged_${Date.now()}`,
  });
  const forgedPayload = JSON.stringify(forged);
  const forgedRes = await fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=1,v1=deadbeef",
    },
    body: forgedPayload,
  });
  const afterForged = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
  if (forgedRes.ok) {
    blockers.push("forged_webhook_accepted");
    return report;
  }
  if ((afterForged?.credits ?? 0) !== (afterFirst?.credits ?? 0)) {
    blockers.push("forged_webhook_credited");
    return report;
  }
  report.failedWebhookNoCreditStatus = "PASS";

  // 5) Ledger consistency
  const finalPayment = await prisma.payment.findFirst({
    where: { stripeSessionId: session.id, status: "COMPLETED" },
  });
  const finalTx = await prisma.transaction.findFirst({
    where: { userId: user.id, type: "RECHARGE", amount: SMOKE_CREDITS },
    orderBy: { createdAt: "desc" },
  });
  const finalBal = await prisma.creditBalance.findUnique({ where: { userId: user.id } });
  if (
    finalPayment &&
    finalTx &&
    finalBal &&
    finalPayment.credits === SMOKE_CREDITS &&
    finalBal.credits === before.credits + SMOKE_CREDITS
  ) {
    report.ledgerConsistencyStatus = "PASS";
  } else {
    blockers.push("ledger_inconsistent");
    return report;
  }

  report.ok = true;
  return report;
}
