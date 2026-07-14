import { randomBytes } from "crypto";
import { readPlatformJson, writePlatformJson, orgProjectsKey } from "./platform-store";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type WorkspaceProject = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  monthlyBudget: number | null;
  createdAt: string;
  updatedAt: string;
};

export interface ProjectRepository {
  list(organizationId: string): Promise<WorkspaceProject[]>;
  get(organizationId: string, projectId: string): Promise<WorkspaceProject | null>;
  create(organizationId: string, input: { name: string; description?: string }): Promise<WorkspaceProject>;
  update(
    organizationId: string,
    projectId: string,
    input: Partial<Pick<WorkspaceProject, "name" | "description" | "status" | "monthlyBudget">>
  ): Promise<WorkspaceProject>;
  ensureDefault(organizationId: string): Promise<WorkspaceProject>;
}

function newId(): string {
  return `proj_${randomBytes(8).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

class PlatformConfigProjectRepository implements ProjectRepository {
  private async readAll(organizationId: string): Promise<WorkspaceProject[]> {
    return readPlatformJson<WorkspaceProject[]>(orgProjectsKey(organizationId), []);
  }

  private async writeAll(organizationId: string, projects: WorkspaceProject[]): Promise<void> {
    await writePlatformJson(orgProjectsKey(organizationId), projects);
  }

  async list(organizationId: string): Promise<WorkspaceProject[]> {
    const projects = await this.readAll(organizationId);
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(organizationId: string, projectId: string): Promise<WorkspaceProject | null> {
    const projects = await this.readAll(organizationId);
    return projects.find((p) => p.id === projectId) ?? null;
  }

  async ensureDefault(organizationId: string): Promise<WorkspaceProject> {
    const projects = await this.readAll(organizationId);
    const existing = projects.find((p) => p.name === "General");
    if (existing) return existing;

    const general: WorkspaceProject = {
      id: newId(),
      name: "General",
      description: "Default project",
      status: "ACTIVE",
      monthlyBudget: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.writeAll(organizationId, [...projects, general]);
    return general;
  }

  async create(
    organizationId: string,
    input: { name: string; description?: string }
  ): Promise<WorkspaceProject> {
    await this.ensureDefault(organizationId);
    const projects = await this.readAll(organizationId);
    const project: WorkspaceProject = {
      id: newId(),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      status: "ACTIVE",
      monthlyBudget: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.writeAll(organizationId, [...projects, project]);
    return project;
  }

  async update(
    organizationId: string,
    projectId: string,
    input: Partial<Pick<WorkspaceProject, "name" | "description" | "status" | "monthlyBudget">>
  ): Promise<WorkspaceProject> {
    const projects = await this.readAll(organizationId);
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx < 0) throw new Error("Project not found");

    const current = projects[idx];
    if (input.status === "ARCHIVED" && current.name === "General") {
      throw new Error("Cannot archive the General project");
    }

    const updated: WorkspaceProject = {
      ...current,
      ...input,
      name: input.name?.trim() ?? current.name,
      description: input.description?.trim() ?? current.description,
      updatedAt: nowIso(),
    };
    projects[idx] = updated;
    await this.writeAll(organizationId, projects);
    return updated;
  }
}

export const projectRepository: ProjectRepository = new PlatformConfigProjectRepository();

export function parseApiKeyMetadata(metadata: unknown): {
  projectId?: string;
  routingMode?: string;
} {
  if (!metadata || typeof metadata !== "object") return {};
  const m = metadata as Record<string, unknown>;
  return {
    projectId: typeof m.projectId === "string" ? m.projectId : undefined,
    routingMode: typeof m.routingMode === "string" ? m.routingMode : undefined,
  };
}
