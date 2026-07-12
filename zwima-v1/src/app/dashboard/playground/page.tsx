import { PlaygroundClient } from "@/components/playground-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlaygroundPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Playground</h1>
        <p className="text-sm text-slate-500">Test models with streaming responses</p>
      </div>
      <PlaygroundClient />
    </div>
  );
}
