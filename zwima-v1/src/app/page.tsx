import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

const MODELS = ["OpenAI", "Gemini", "DeepSeek", "Qwen", "Claude"];

const FEATURES = [
  { title: "One API", desc: "Single endpoint for every model. No vendor lock-in." },
  { title: "Multiple Models", desc: "Route across OpenAI, Gemini, DeepSeek, Qwen, and Claude." },
  { title: "One Invoice", desc: "Unified billing in EUR with Stripe checkout." },
  { title: "EU Ready", desc: "Built for European teams with enterprise-grade controls." },
];

const PLANS = [
  { name: "Developer", price: "€0", credits: "1,000 credits", cta: "Start free" },
  { name: "Startup", price: "€29", credits: "20,000 credits / mo", cta: "Get started" },
  { name: "Business", price: "€99", credits: "100,000 credits / mo", cta: "Contact sales" },
];

const FAQ = [
  { q: "How does billing work?", a: "Prepaid credits via Stripe. Visa, Mastercard, Apple Pay, and Google Pay supported." },
  { q: "Which models are supported?", a: "OpenAI, Gemini, DeepSeek, Qwen, and Claude through a unified API." },
  { q: "Can I switch providers?", a: "Yes. The provider router lets you change models without changing your integration." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-blue-800 dark:text-blue-400">
              AI API Platform for Europe
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
              One API
              <br />
              Multiple Models
              <br />
              One Invoice
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Distribute AI models through a single enterprise gateway. Built for startups and teams in Europe.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg">Start Building →</Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap gap-3">
            {MODELS.map((model) => (
              <span
                key={model}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {model}
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Features</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <CardTitle>{f.title}</CardTitle>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Pricing</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <Card key={plan.name} className={plan.name === "Startup" ? "ring-2 ring-blue-900 dark:ring-blue-600" : ""}>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{plan.price}</p>
                  <p className="mt-1 text-sm text-slate-500">{plan.credits}</p>
                  <Link href="/signup" className="mt-6 block">
                    <Button variant={plan.name === "Startup" ? "primary" : "secondary"} className="w-full">
                      {plan.cta}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="providers" className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Providers</h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              All providers share a unified interface. Switch models freely without changing your client code.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {MODELS.map((p) => (
                <div
                  key={p}
                  className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{p}</p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">Available</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">FAQ</h2>
            <div className="mt-10 space-y-6">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="font-medium text-slate-900 dark:text-white">{item.q}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
