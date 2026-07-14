const url = process.argv[2] || "https://zwima-5gm0re5gi-zwima.vercel.app/api/v1/preview-diag/env-db";
const res = await fetch(url, {
  headers: { Accept: "application/json" },
  redirect: "manual",
  signal: AbortSignal.timeout(60000),
});
console.log("HTTP", res.status);
console.log(await res.text());
