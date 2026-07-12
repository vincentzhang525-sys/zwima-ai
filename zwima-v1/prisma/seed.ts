import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  { slug: "openai", name: "OpenAI" },
  { slug: "gemini", name: "Gemini" },
  { slug: "deepseek", name: "DeepSeek" },
  { slug: "qwen", name: "Qwen" },
  { slug: "claude", name: "Claude" },
];

async function main() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, enabled: true },
      update: { name: p.name, enabled: true },
    });
  }
  console.log("Seeded providers:", PROVIDERS.map((p) => p.name).join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
