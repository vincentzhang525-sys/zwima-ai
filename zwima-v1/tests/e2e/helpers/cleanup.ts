import type { APIRequestContext } from "@playwright/test";
import { TEST_PREFIX } from "./constants";

export type CleanupState = {
  projectIds: string[];
  apiKeyIds: string[];
  projectNames: string[];
  apiKeyNames: string[];
};

export const cleanupState: CleanupState = {
  projectIds: [],
  apiKeyIds: [],
  projectNames: [],
  apiKeyNames: [],
};

export function isTestArtifact(name: string): boolean {
  return name.startsWith(TEST_PREFIX);
}

export async function cleanupArtifacts(request: APIRequestContext): Promise<void> {
  for (const keyId of cleanupState.apiKeyIds) {
    await request.post(`/api/workspace/api-keys/${keyId}/revoke`, {
      data: { confirm: true, reason: "Playwright teardown" },
    }).catch(() => undefined);
  }

  for (const projectId of cleanupState.projectIds) {
    await request.patch(`/api/workspace/projects/${projectId}`, {
      data: { status: "ARCHIVED" },
    }).catch(() => undefined);
  }

  const keysRes = await request.get("/api/workspace/api-keys");
  if (keysRes.ok()) {
    const data = await keysRes.json();
    for (const key of data.keys ?? []) {
      if (isTestArtifact(key.name) && key.status === "ACTIVE") {
        await request.post(`/api/workspace/api-keys/${key.id}/revoke`, {
          data: { confirm: true, reason: "Playwright sweep" },
        }).catch(() => undefined);
      }
    }
  }

  const projectsRes = await request.get("/api/workspace/projects");
  if (projectsRes.ok()) {
    const data = await projectsRes.json();
    for (const project of data.projects ?? []) {
      if (isTestArtifact(project.name) && project.status === "ACTIVE") {
        await request.patch(`/api/workspace/projects/${project.id}`, {
          data: { status: "ARCHIVED" },
        }).catch(() => undefined);
      }
    }
  }
}
