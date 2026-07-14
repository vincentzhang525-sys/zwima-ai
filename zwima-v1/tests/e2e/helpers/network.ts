import type { Page } from "@playwright/test";
import { addConsoleError, addNetworkIssue } from "./results";
import { redactText } from "./redact";

export function attachObservers(page: Page): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      addConsoleError(redactText(msg.text()).slice(0, 300));
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("clerk.accounts.dev")) {
      addNetworkIssue(url.replace(/\?.*$/, ""), status);
    }
  });
}

export async function fetchRuntimeMeta(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/v1/preview-diag/env-db");
  if (!res.ok()) return null;
  return res.json() as Promise<{
    deploymentId?: string;
    clerkConfigured?: boolean;
    routingEngine?: string;
    stripePreviewDisabled?: boolean;
  }>;
}
