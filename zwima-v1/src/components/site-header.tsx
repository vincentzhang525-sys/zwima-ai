import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#providers">Providers</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm">Start Building</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4 sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-slate-500">AI API Platform for Europe</p>
        </div>
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#providers">Providers</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link href="/signup">Sign up</Link></li>
            <li><Link href="/login">Log in</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Privacy Policy</li>
            <li>Terms of Service</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} ZWIMA AI. All rights reserved.
      </div>
    </footer>
  );
}
