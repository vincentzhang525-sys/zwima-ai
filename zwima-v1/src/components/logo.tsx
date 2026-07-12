import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900 text-sm text-white dark:bg-blue-700">
        Z
      </span>
      <span className="text-slate-900 dark:text-white">ZWIMA AI</span>
    </Link>
  );
}
