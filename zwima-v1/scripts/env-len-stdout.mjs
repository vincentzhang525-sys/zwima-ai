console.log(
  JSON.stringify({
    DATABASE_URL: (process.env.DATABASE_URL || "").length,
    DIRECT_URL: (process.env.DIRECT_URL || "").length,
    SUPABASE_URL: (process.env.SUPABASE_URL || "").length,
    SUPABASE_DB_PASSWORD: (process.env.SUPABASE_DB_PASSWORD || "").length,
  })
);
