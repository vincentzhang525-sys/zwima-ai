import { WorkspaceProjectsClient } from "@/components/workspace-projects-client";
import { getCurrentDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
        <p className="text-sm text-slate-500">Organize API keys and track project-level usage</p>
      </div>
      <WorkspaceProjectsClient />
    </div>
  );
}
