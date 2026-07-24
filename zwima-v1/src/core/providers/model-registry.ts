import type {
  LifecycleStatus,
  ModelRegistryEntry,
  ProviderId,
} from "./types";

const models = new Map<string, ModelRegistryEntry>();

export function registerModel(entry: ModelRegistryEntry): void {
  models.set(entry.modelId, entry);
}

export function registerModels(entries: ModelRegistryEntry[]): void {
  for (const entry of entries) models.set(entry.modelId, entry);
}

export function getModel(modelId: string): ModelRegistryEntry | undefined {
  return models.get(modelId);
}

export function listAllModels(): ModelRegistryEntry[] {
  return [...models.values()].sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export function listModelsByProvider(provider: ProviderId): ModelRegistryEntry[] {
  return listAllModels().filter((m) => m.provider === provider);
}

export function listModelsByLifecycle(lifecycle: LifecycleStatus): ModelRegistryEntry[] {
  return listAllModels().filter((m) => m.lifecycle === lifecycle);
}

export function listEuCompliantModels(): ModelRegistryEntry[] {
  return listAllModels().filter((m) => m.euCompliance);
}

export function clearModelRegistry(): void {
  models.clear();
}

export function modelRegistrySize(): number {
  return models.size;
}
