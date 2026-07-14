import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { AUTH_FILE_B, ORG_A_PROJECT_ID_FILE } from "./helpers/constants";
import { recordStep, addSkipped } from "./helpers/results";

test("Cross-org project access denied", async ({ request }) => {
  if (!fs.existsSync(AUTH_FILE_B)) {
    recordStep("orgIsolation", {
      name: "Org isolation",
      status: "SKIP",
      detail: "playwright/.auth/user-b.json missing",
    });
    addSkipped("Org isolation: second auth file not present");
    test.skip(true, "No org B auth state");
    return;
  }

  if (!fs.existsSync(ORG_A_PROJECT_ID_FILE)) {
    recordStep("orgIsolation", {
      name: "Org isolation",
      status: "SKIP",
      detail: "org A project id artifact missing — run phase4-chromium first",
    });
    addSkipped("Org isolation: org A project id not captured");
    test.skip(true, "No org A project id");
    return;
  }

  const orgAProjectId = fs.readFileSync(ORG_A_PROJECT_ID_FILE, "utf8").trim();
  const cross = await request.get(`/api/workspace/projects/${orgAProjectId}`);
  expect([403, 404]).toContain(cross.status());
  recordStep("orgIsolation", {
    name: "Org isolation",
    status: "PASS",
    detail: `cross-get ${cross.status()}`,
  });
});
