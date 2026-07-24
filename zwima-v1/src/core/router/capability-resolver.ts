import type { RoutingCapability } from "./types";

export function resolveCapabilities(input: {
  capability: RoutingCapability;
  streaming?: boolean;
  model?: string;
}): RoutingCapability[] {
  const caps = new Set<RoutingCapability>([input.capability]);
  if (input.streaming || input.capability === "stream") caps.add("stream");
  if (input.model?.includes("embedding")) caps.add("embeddings");
  if (input.model?.includes("vision") || input.model?.includes("flash")) caps.add("vision");
  return [...caps];
}

export function modelSupportsCapability(
  model: {
    streaming: boolean;
    embedding: boolean;
    vision: boolean;
    functionCalling: boolean;
    image: boolean;
    audio: boolean;
    video: boolean;
  },
  capability: RoutingCapability,
): boolean {
  switch (capability) {
    case "stream":
      return model.streaming;
    case "embeddings":
      return model.embedding;
    case "vision":
      return model.vision;
    case "function_calling":
      return model.functionCalling;
    case "image":
      return model.image;
    case "audio":
      return model.audio;
    case "video":
      return model.video;
    default:
      return true;
  }
}
