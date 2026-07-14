const base = process.argv[2] || "https://zwima-8ndiyu8ym-zwima.vercel.app";
const paths = ["/api/v1/health", "/api/v1/packages", "/api/v1/models", "/api/webhooks/stripe"];

for (const p of paths) {
  const url = base + p;
  try {
    const init = {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
      redirect: "manual",
    };
    const res = await fetch(url, p.includes("webhooks") ? { ...init, method: "POST", body: "{}" } : init);
    const text = await res.text();
    console.log(`${p} -> HTTP ${res.status} location=${res.headers.get("location") || "-"}`);
    console.log(text.slice(0, 800));
  } catch (err) {
    console.log(`${p} -> ERROR ${err instanceof Error ? err.message : err}`);
  }
  console.log("---");
}
