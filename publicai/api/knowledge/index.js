const { json, handleOptions, withCors } = require("../lib/supabase");
const support = require("../lib/support");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  withCors(res);
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const { getAdminClient } = require("../lib/supabase");
    const admin = getAdminClient();
    const category = req.query?.category;
    let query = admin.from("knowledge_base_articles").select("*").eq("status", "published").order("sort_order");
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw error;

    const slug = req.query?.slug;
    if (slug) {
      const article = (data || []).find((a) => a.slug === slug);
      if (!article) return json(res, 404, { error: "Article not found" });
      return json(res, 200, { article: support.mapArticle(article) });
    }

    const grouped = {};
    for (const cat of support.KB_CATEGORIES) grouped[cat] = [];
    for (const row of data || []) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(support.mapArticle(row));
    }

    return json(res, 200, { categories: support.KB_CATEGORIES, articles: (data || []).map(support.mapArticle), grouped });
  } catch (err) {
    console.error("[knowledge]", err);
    return json(res, 500, { error: err.message || "Knowledge base request failed" });
  }
};
