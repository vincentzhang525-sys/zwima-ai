const { json, handleOptions, withCors } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const keys = Object.keys(process.env).filter((k) =>
    /SUPABASE|POSTGRES|DATABASE|DB_/i.test(k)
  );

  return json(
    res,
    200,
    keys.reduce((acc, key) => {
      acc[key] = process.env[key] ? `set(${String(process.env[key]).length})` : "empty";
      return acc;
    }, {})
  );
};
