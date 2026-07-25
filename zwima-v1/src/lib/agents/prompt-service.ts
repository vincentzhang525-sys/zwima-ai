import { assertAgentPermission, type AgentContext } from "./auth";
import { AgentServiceError } from "./errors";
import { getAgentDb, newPromptTemplateId, newPromptVersionId, type PromptTemplateRecord, type PromptVersionRecord } from "./types";

export type CreatePromptTemplateInput = {
  key: string;
  name: string;
  description?: string | null;
};

export type CreatePromptVersionInput = {
  content: string;
  variables?: string[];
};

async function loadOwnedTemplate(ctx: AgentContext, templateId: string): Promise<PromptTemplateRecord> {
  const db = getAgentDb();
  const template = await db.promptTemplate.findUnique({ where: { templateId } });
  if (!template || template.organizationId !== ctx.organizationId) {
    throw new AgentServiceError("NOT_FOUND", "Prompt template not found", 404);
  }
  return template;
}

async function loadOwnedVersion(
  ctx: AgentContext,
  versionId: string,
): Promise<{ template: PromptTemplateRecord; version: PromptVersionRecord }> {
  const db = getAgentDb();
  const version = await db.promptVersion.findUnique({ where: { versionId } });
  if (!version) throw new AgentServiceError("NOT_FOUND", "Prompt version not found", 404);
  const template = await loadOwnedTemplate(ctx, version.templateId);
  return { template, version };
}

export async function createPromptTemplate(
  ctx: AgentContext,
  input: CreatePromptTemplateInput,
): Promise<PromptTemplateRecord> {
  assertAgentPermission(ctx, "edit");
  const key = String(input.key || "").trim();
  const name = String(input.name || "").trim();
  if (!key || !name) throw new AgentServiceError("VALIDATION_ERROR", "key and name are required", 400);

  const db = getAgentDb();
  const existing = await db.promptTemplate.findFirst({ where: { organizationId: ctx.organizationId, key } });
  if (existing) throw new AgentServiceError("CONFLICT", `Prompt template key '${key}' already exists`, 409);

  return db.promptTemplate.create({
    data: {
      templateId: newPromptTemplateId(),
      organizationId: ctx.organizationId,
      key,
      name,
      description: input.description ?? null,
      status: "DRAFT",
      currentVersionId: null,
      createdBy: ctx.user.id,
    },
  });
}

export async function listPromptTemplates(ctx: AgentContext): Promise<PromptTemplateRecord[]> {
  assertAgentPermission(ctx, "read");
  const db = getAgentDb();
  return db.promptTemplate.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" } });
}

export async function getPromptTemplate(ctx: AgentContext, templateId: string): Promise<PromptTemplateRecord> {
  assertAgentPermission(ctx, "read");
  return loadOwnedTemplate(ctx, templateId);
}

export async function listPromptVersions(ctx: AgentContext, templateId: string): Promise<PromptVersionRecord[]> {
  assertAgentPermission(ctx, "read");
  await loadOwnedTemplate(ctx, templateId);
  const db = getAgentDb();
  return db.promptVersion.findMany({ where: { templateId }, orderBy: { versionNumber: "desc" } });
}

export async function createPromptVersion(
  ctx: AgentContext,
  templateId: string,
  input: CreatePromptVersionInput,
): Promise<PromptVersionRecord> {
  assertAgentPermission(ctx, "edit");
  const template = await loadOwnedTemplate(ctx, templateId);
  const content = String(input.content || "").trim();
  if (!content) throw new AgentServiceError("VALIDATION_ERROR", "content is required", 400);

  const db = getAgentDb();
  const latest = await db.promptVersion.findFirst({ where: { templateId }, orderBy: { versionNumber: "desc" } });

  return db.promptVersion.create({
    data: {
      versionId: newPromptVersionId(),
      templateId: template.templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      content,
      variables: Array.isArray(input.variables) ? input.variables : [],
      status: "DRAFT",
      createdBy: ctx.user.id,
    },
  });
}

/** Publishes a DRAFT prompt version, archiving whichever version was previously PUBLISHED. */
export async function publishPromptVersion(ctx: AgentContext, versionId: string): Promise<PromptVersionRecord> {
  assertAgentPermission(ctx, "admin");
  const { template, version } = await loadOwnedVersion(ctx, versionId);
  if (version.status !== "DRAFT") {
    throw new AgentServiceError("CONFLICT", `Only a DRAFT prompt version can be published (current: ${version.status})`, 409);
  }

  const db = getAgentDb();
  const previouslyPublished = await db.promptVersion.findFirst({
    where: { templateId: template.templateId, status: "PUBLISHED" },
  });

  if (previouslyPublished) {
    await db.promptVersion.update({ where: { id: previouslyPublished.id }, data: { status: "ARCHIVED" } });
  }

  const published = await db.promptVersion.update({
    where: { id: version.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await db.promptTemplate.update({
    where: { id: template.id },
    data: { status: "PUBLISHED", currentVersionId: published.versionId },
  });

  return published;
}

/** Rolls back a template to a previously-published (now ARCHIVED) version, republishing it and archiving the current one. */
export async function rollbackPromptVersion(
  ctx: AgentContext,
  templateId: string,
  toVersionId: string,
): Promise<PromptVersionRecord> {
  assertAgentPermission(ctx, "admin");
  const template = await loadOwnedTemplate(ctx, templateId);

  const db = getAgentDb();
  const target = await db.promptVersion.findUnique({ where: { versionId: toVersionId } });
  if (!target || target.templateId !== template.templateId) {
    throw new AgentServiceError("NOT_FOUND", "Target prompt version not found for this template", 404);
  }
  if (target.status !== "ARCHIVED" && target.status !== "PUBLISHED") {
    throw new AgentServiceError("CONFLICT", "Can only roll back to a previously published version", 409);
  }

  const currentlyPublished = await db.promptVersion.findFirst({
    where: { templateId: template.templateId, status: "PUBLISHED" },
  });
  if (currentlyPublished && currentlyPublished.id !== target.id) {
    await db.promptVersion.update({ where: { id: currentlyPublished.id }, data: { status: "ARCHIVED" } });
  }

  const restored = await db.promptVersion.update({
    where: { id: target.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await db.promptTemplate.update({
    where: { id: template.id },
    data: { status: "PUBLISHED", currentVersionId: restored.versionId },
  });

  return restored;
}
