import { prisma } from "../prisma";

export async function readPlatformJson<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function writePlatformJson<T>(key: string, value: T): Promise<void> {
  const payload = JSON.stringify(value);
  await prisma.platformConfig.upsert({
    where: { key },
    create: { key, value: payload },
    update: { value: payload },
  });
}

export function orgProjectsKey(organizationId: string): string {
  return `workspace:projects:${organizationId}`;
}

export function orgSettingsKey(organizationId: string): string {
  return `workspace:settings:${organizationId}`;
}
