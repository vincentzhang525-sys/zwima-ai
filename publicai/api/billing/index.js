const { getAuthedClient, getAdminClient, parseBody, json, handleOptions, withCors, writeAuditLog, getClientIp } = require("../lib/supabase");
const { resolvePaymentProvider, assertPaymentOperational } = require("../lib/payments");
const commerce = require("../lib/commerce");

const PLAN_ORDER = commerce.PLAN_ORDER;

function currentPlan(raw) {
  const value = String(raw || "free").toLowerCase();
  return PLAN_ORDER.includes(value) ? value : "free";
}

async function ensureReferralCode(client, userId) {
  const { data: existing } = await client.from("referral_codes").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;
  const code = commerce.generateReferralCode(userId);
  const { data } = await client.from("referral_codes").insert({ user_id: userId, code }).select().single();
  return data;
}

async function loadPlanCatalog(client) {
  const { data } = await client.from("subscription_plans").select("*").eq("status", "active").order("monthly_price");
  return data || [];
}

async function loadPackages(client) {
  const { data } = await client.from("credit_packages").select("*").eq("status", "active").order("credits");
  return data || [];
}

async function completeCheckout(client, { user, order, checkout }) {
  await client
    .from("orders")
    .update({ status: "pending", provider_ref: checkout.sessionId || checkout.checkoutId || null })
    .eq("id", order.id);
  await client.from("commerce_transactions").insert({
    user_id: user.id,
    order_id: order.id,
    provider: checkout.provider,
    provider_ref: checkout.sessionId || checkout.checkoutId,
    amount: order.total,
    currency: order.currency,
    status: "pending",
  });
  return {
    pending: true,
    checkoutUrl: checkout.checkoutUrl,
    orderNumber: order.order_number,
    sessionId: checkout.sessionId || checkout.checkoutId,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  try {
    const { client, user } = await getAuthedClient(req);

    if (req.method === "GET") {
      const invoiceId = String(req.query?.invoice || req.query?.id || "").trim();
      if (invoiceId) {
        const { data: inv } = await client
          .from("invoices")
          .select("*")
          .or(`invoice_number.eq.${invoiceId},id.eq.${invoiceId}`)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!inv) return json(res, 404, { error: "Invoice not found" });
        return json(res, 200, {
          invoice: {
            invoiceNumber: inv.invoice_number,
            company: inv.company,
            vat: inv.vat,
            country: inv.country,
            currency: inv.currency,
            subtotal: Number(inv.subtotal),
            tax: Number(inv.tax),
            total: Number(inv.total),
            status: inv.status,
            downloadUrl: inv.download_url || `/api/billing/invoice?id=${inv.invoice_number}`,
            createdAt: inv.created_at,
          },
        });
      }

      const [
        { data: wallet },
        { data: sub },
        { data: payments },
        { data: orders },
        { data: transactions },
        { data: invoices },
        { data: methods },
        plans,
        packages,
        referralCode,
        { data: referrals },
      ] = await Promise.all([
        client.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        client.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        client.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        client.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        client.from("commerce_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        client.from("invoices").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        client.from("payment_methods").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        loadPlanCatalog(client),
        loadPackages(client),
        ensureReferralCode(client, user.id),
        client.from("referrals").select("*").eq("referrer_user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      const planId = currentPlan(sub?.plan);
      const planDetails = plans.find((p) => p.id === planId) || plans[0];

      return json(res, 200, {
        billing: {
          currentPlan: planId,
          planDetails: planDetails
            ? {
                id: planDetails.id,
                name: planDetails.name,
                monthlyCredits: Number(planDetails.monthly_credits),
                maxApiKeys: planDetails.max_api_keys,
                maxTeamMembers: planDetails.max_team_members,
                availableModels: planDetails.available_models,
                priorityRouting: planDetails.priority_routing,
                rateLimit: planDetails.rate_limit,
                monthlyPrice: Number(planDetails.monthly_price),
                annualPrice: Number(planDetails.annual_price),
              }
            : null,
          status: sub?.status || "active",
          remainingCredits: Number(wallet?.balance) || 0,
          renewAt: sub?.renew_at || null,
          paymentMethod: methods?.find((m) => m.is_default)?.label || methods?.[0]?.label || "Not configured",
          plans: plans.map((p) => ({
            id: p.id,
            name: p.name,
            monthlyCredits: Number(p.monthly_credits),
            maxApiKeys: p.max_api_keys,
            maxTeamMembers: p.max_team_members,
            priorityRouting: p.priority_routing,
            rateLimit: p.rate_limit,
            monthlyPrice: Number(p.monthly_price),
            annualPrice: Number(p.annual_price),
          })),
          creditPackages: packages.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            credits: Number(p.credits),
            price: Number(p.price),
            currency: p.currency,
            taxRate: Number(p.tax_rate),
          })),
          orders: (orders || []).map((o) => ({
            id: o.id,
            orderNumber: o.order_number,
            type: o.order_type,
            total: Number(o.total),
            currency: o.currency,
            status: o.status,
            provider: o.provider,
            createdAt: o.created_at,
          })),
          transactions: (transactions || []).map((t) => ({
            id: t.id,
            provider: t.provider,
            amount: Number(t.amount),
            currency: t.currency,
            status: t.status,
            createdAt: t.created_at,
          })),
          invoices: (invoices || []).map((row) => ({
            id: row.id,
            invoiceNumber: row.invoice_number,
            amount: Number(row.total),
            currency: row.currency,
            status: row.status,
            downloadUrl: row.download_url,
            createdAt: row.created_at,
          })),
          payments: (payments || []).map((row) => ({
            id: row.id,
            amount: Number(row.amount) || 0,
            currency: row.currency || "EUR",
            status: row.status,
            provider: row.provider || "stripe",
            invoiceUrl: row.invoice_url,
            createdAt: row.created_at,
          })),
          paymentMethods: (methods || []).map((m) => ({
            id: m.id,
            provider: m.provider,
            type: m.method_type,
            label: m.label,
            isDefault: m.is_default,
            status: m.status,
          })),
          referral: {
            code: referralCode?.code,
            totalInvites: Number(referralCode?.total_invites) || 0,
            creditsEarned: Number(referralCode?.credits_earned) || 0,
            successfulInvitations: (referrals || []).filter((r) => r.status === "completed").length,
            invitations: (referrals || []).map((r) => ({
              id: r.id,
              status: r.status,
              rewardCredits: Number(r.reward_credits),
              createdAt: r.created_at,
            })),
          },
        },
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const action = body.action || "upgrade";
      const provider = String(body.provider || "stripe").toLowerCase();
      const paymentProvider = resolvePaymentProvider(provider);

      if (action === "cancel") {
        const { data: sub } = await client
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        await paymentProvider.cancelSubscription({ subscriptionId: sub?.stripe_subscription_id || "" });
        await client.from("subscriptions").update({ status: "canceled" }).eq("user_id", user.id);
        await writeAuditLog({
          userId: user.id,
          eventType: "billing",
          action: "billing_updated",
          target: "subscription",
          detail: "Subscription canceled",
          ip: getClientIp(req),
          notify: true,
          notificationCategory: "billing",
        });
        return json(res, 200, { ok: true, status: "canceled" });
      }

      if (action === "apply_coupon") {
        const code = String(body.code || "").trim().toUpperCase();
        const { data: coupon } = await client.from("coupons").select("*").eq("code", code).eq("status", "active").maybeSingle();
        if (!coupon) return json(res, 404, { error: "Invalid coupon code." });
        const { data: redemptions } = await client.from("coupon_redemptions").select("id").eq("coupon_id", coupon.id).eq("user_id", user.id);
        if ((redemptions || []).length >= (coupon.per_user_limit || 1)) {
          return json(res, 400, { error: "Coupon already used." });
        }
        return json(res, 200, {
          ok: true,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue: Number(coupon.discount_value),
          },
        });
      }

      if (action === "purchase_package") {
        assertPaymentOperational(provider);
        const packageId = body.packageId;
        const { data: pkg } = await client.from("credit_packages").select("*").eq("id", packageId).eq("status", "active").maybeSingle();
        if (!pkg) return json(res, 404, { error: "Credit package not found." });

        let subtotal = Number(pkg.price);
        let couponId = null;
        if (body.couponCode) {
          const { data: coupon } = await client.from("coupons").select("*").eq("code", String(body.couponCode).toUpperCase()).maybeSingle();
          const applied = commerce.applyCoupon(subtotal, coupon);
          if (applied.error) return json(res, 400, { error: applied.error });
          subtotal = applied.subtotal;
          couponId = coupon?.id;
        }
        const { subtotal: s, tax, total } = commerce.calcTotal(subtotal, Number(pkg.tax_rate));

        const orderNumber = commerce.generateOrderNumber();
        const { data: order } = await client
          .from("orders")
          .insert({
            user_id: user.id,
            order_number: orderNumber,
            order_type: "credit_package",
            package_id: pkg.id,
            subtotal: s,
            tax,
            total,
            currency: pkg.currency,
            status: "pending",
            provider,
            coupon_id: couponId,
            metadata: { credits: Number(pkg.credits) },
          })
          .select()
          .single();

        const checkout = await paymentProvider.createCheckout({
          userId: user.id,
          plan: pkg.slug,
          amountEur: total,
          orderId: order.id,
          email: user.email,
          credits: Number(pkg.credits),
        });

        const result = await completeCheckout(client, { user, order, checkout });

        if (couponId) {
          const { data: coupon } = await client.from("coupons").select("usage_count").eq("id", couponId).maybeSingle();
          await client.from("coupon_redemptions").insert({ coupon_id: couponId, user_id: user.id, order_id: order.id });
          const admin = getAdminClient();
          await admin.from("coupons").update({ usage_count: (Number(coupon?.usage_count) || 0) + 1 }).eq("id", couponId);
        }

        return json(res, 200, {
          ok: true,
          orderNumber,
          pending: Boolean(result.pending),
          checkoutUrl: result.checkoutUrl || null,
          creditsAdded: 0,
          packageCredits: Number(pkg.credits),
        });
      }

      if (action === "refer") {
        const code = String(body.referralCode || "").trim().toUpperCase();
        const { data: referrer } = await client.from("referral_codes").select("*").eq("code", code).maybeSingle();
        if (!referrer || referrer.user_id === user.id) {
          return json(res, 400, { error: "Invalid referral code." });
        }
        await client.from("referrals").insert({
          referrer_user_id: referrer.user_id,
          referred_user_id: user.id,
          referral_code: code,
          reward_credits: 0,
          status: "pending",
        });
        return json(res, 200, { ok: true, message: "Referral recorded. Rewards apply after first paid purchase." });
      }

      // upgrade / downgrade subscription
      assertPaymentOperational(provider);
      const plan = currentPlan(body.plan);
      const billingCycle = String(body.billingCycle || "monthly").toLowerCase();
      const { data: planRow } = await client.from("subscription_plans").select("*").eq("id", plan).maybeSingle();
      if (!planRow) return json(res, 404, { error: "Plan not found." });

      const { data: currentSubRow } = await client
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const fromPlan = currentPlan(currentSubRow?.plan);
      const isDowngrade = commerce.comparePlans(plan, fromPlan) < 0;
      if (action === "downgrade" || isDowngrade) {
        await client.from("subscriptions").update({ status: "active", plan }).eq("user_id", user.id);
        return json(res, 200, { ok: true, plan, action: "downgrade" });
      }

      let subtotal = billingCycle === "annual" ? Number(planRow.annual_price) : Number(planRow.monthly_price);
      let couponId = null;
      if (body.couponCode) {
        const { data: coupon } = await client.from("coupons").select("*").eq("code", String(body.couponCode).toUpperCase()).maybeSingle();
        const applied = commerce.applyCoupon(subtotal, coupon);
        if (applied.error) return json(res, 400, { error: applied.error });
        subtotal = applied.subtotal;
        couponId = coupon?.id;
      }
      const { subtotal: s, tax, total } = commerce.calcTotal(subtotal);
      const credits = Number(planRow.monthly_credits);

      const orderNumber = commerce.generateOrderNumber();
      const { data: order } = await client
        .from("orders")
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          order_type: "subscription",
          plan_id: plan,
          subtotal: s,
          tax,
          total,
          currency: "EUR",
          status: "pending",
          provider,
          coupon_id: couponId,
          metadata: { credits },
        })
        .select()
        .single();

      const checkout = await paymentProvider.createCheckout({
        userId: user.id,
        plan,
        amountEur: total,
        orderId: order.id,
        email: user.email,
        credits,
      });

      const result = await completeCheckout(client, { user, order, checkout });

      if (couponId) {
        await client.from("coupon_redemptions").insert({ coupon_id: couponId, user_id: user.id, order_id: order.id });
      }

      await writeAuditLog({
        userId: user.id,
        eventType: "billing",
        action: "billing_updated",
        target: plan,
        detail: `Plan ${action} via ${checkout.provider}`,
        ip: getClientIp(req),
        notify: true,
        notificationCategory: "billing",
      });

      return json(res, 200, {
        ok: true,
        plan,
        provider: checkout.provider,
        pending: true,
        checkoutUrl: result.checkoutUrl || null,
        creditsAdded: 0,
        planCredits: credits,
        orderNumber,
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("[billing]", err);
    return json(res, err.status || 500, { error: err.message || "Billing request failed" });
  }
};
