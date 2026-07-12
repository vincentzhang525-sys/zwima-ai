import fs from "node:fs";

const lines = fs.readFileSync(".env.from-zwima-ai", "utf8").split(/\r?\n/);

function parse(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const i = t.indexOf("=");
  if (i <= 0) return null;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return { key, len: val.length };
}

for (const l of lines) {
  if (l.startsWith("DATABASE_URL") || l.startsWith("OPENAI_API_KEY")) {
    console.log("line_len", l.length, "starts", l.slice(0, 20));
  }
}
