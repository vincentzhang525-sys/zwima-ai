import { prisma } from "../prisma";
import { readPlatformJson, writePlatformJson, orgSettingsKey } from "./platform-store";

export type WorkspaceSettings = {
  defaultRoutingMode: string;
  defaultRegion: string;
  euDataResidency: boolean;
  aiTransparency: boolean;
  monthlyBudget: number | null;
  budgetAlerts: boolean;
  usageAlerts: boolean;
  emailNotifications: boolean;
  apiSecurityDefaults: {
    routingMode: string;
    ipAllowlist: string;
  };
  billingProfile: {
    companyName: string;
    vatId: string;
    billingAddress: string;
    country: string;
    currency: "EUR";
  };
  organizationProfile: {
    name: string;
  };
};

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultRoutingMode: "BALANCED",
  defaultRegion: "EU",
  euDataResidency: true,
  aiTransparency: true,
  monthlyBudget: null,
  budgetAlerts: true,
  usageAlerts: true,
  emailNotifications: true,
  apiSecurityDefaults: {
    routingMode: "BALANCED",
    ipAllowlist: "",
  },
  billingProfile: {
    companyName: "",
    vatId: "",
    billingAddress: "",
    country: "",
    currency: "EUR",
  },
  organizationProfile: {
    name: "",
  },
};

export class SettingsService {
  async get(organizationId: string, userId: string): Promise<WorkspaceSettings> {
    const stored = await readPlatformJson<Partial<WorkspaceSettings>>(orgSettingsKey(organizationId), {});
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });

    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      billingProfile: {
        ...DEFAULT_SETTINGS.billingProfile,
        ...(stored.billingProfile ?? {}),
        companyName: stored.billingProfile?.companyName || user?.companyName || "",
        vatId: stored.billingProfile?.vatId || user?.vatId || "",
        country: stored.billingProfile?.country || user?.country || "",
      },
      organizationProfile: {
        name: stored.organizationProfile?.name || org?.name || "",
      },
      apiSecurityDefaults: {
        ...DEFAULT_SETTINGS.apiSecurityDefaults,
        ...(stored.apiSecurityDefaults ?? {}),
      },
    };
  }

  async update(organizationId: string, patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    const current = await readPlatformJson<Partial<WorkspaceSettings>>(orgSettingsKey(organizationId), {});
    const merged: Partial<WorkspaceSettings> = {
      ...current,
      ...patch,
      billingProfile: patch.billingProfile
        ? { ...DEFAULT_SETTINGS.billingProfile, ...current.billingProfile, ...patch.billingProfile }
        : current.billingProfile,
      organizationProfile: patch.organizationProfile
        ? { ...DEFAULT_SETTINGS.organizationProfile, ...current.organizationProfile, ...patch.organizationProfile }
        : current.organizationProfile,
      apiSecurityDefaults: patch.apiSecurityDefaults
        ? { ...DEFAULT_SETTINGS.apiSecurityDefaults, ...current.apiSecurityDefaults, ...patch.apiSecurityDefaults }
        : current.apiSecurityDefaults,
    };
    await writePlatformJson(orgSettingsKey(organizationId), merged);

    if (patch.organizationProfile?.name) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { name: patch.organizationProfile.name },
      });
    }

    const userId = (await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } }))?.ownerId;
    if (userId && patch.billingProfile) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          companyName: patch.billingProfile.companyName ?? undefined,
          vatId: patch.billingProfile.vatId ?? undefined,
          country: patch.billingProfile.country ?? undefined,
        },
      });
    }

    return this.get(organizationId, userId ?? "");
  }
}

export const settingsService = new SettingsService();
