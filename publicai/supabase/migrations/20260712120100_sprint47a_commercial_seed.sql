-- 20260712120100_sprint47a_commercial_seed.sql
-- Seed provider and model registry (architecture baseline)

insert into public.commercial_providers (
  id, name, provider_type, status, priority, region, base_url, auth_method, api_key_env, adapter_id,
  supports_vision, supports_image, supports_audio, supports_embedding, supports_function_calling,
  supports_json_mode, supports_streaming, supports_reasoning, profit_margin_pct, health_status
) values
  ('openai', 'OpenAI', 'llm', 'active', 1, 'us', 'https://api.openai.com/v1', 'api_key', 'OPENAI_API_KEY', 'openai', true, true, false, true, true, true, true, true, 25, 'unknown'),
  ('google', 'Google Gemini', 'llm', 'active', 2, 'global', 'https://generativelanguage.googleapis.com/v1beta', 'api_key', 'GEMINI_API_KEY', 'google', true, true, true, true, true, true, true, false, 25, 'unknown'),
  ('anthropic', 'Claude', 'llm', 'waiting_api', 3, 'us', 'https://api.anthropic.com/v1', 'api_key', 'ANTHROPIC_API_KEY', 'anthropic', true, false, false, false, true, true, true, true, 30, 'not_configured'),
  ('deepseek', 'DeepSeek', 'llm', 'waiting_api', 4, 'apac', 'https://api.deepseek.com/v1', 'api_key', 'DEEPSEEK_API_KEY', 'deepseek', false, false, false, false, true, true, true, true, 28, 'not_configured'),
  ('qwen', 'Qwen', 'llm', 'waiting_api', 5, 'apac', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'api_key', 'QWEN_API_KEY', 'qwen', true, false, false, false, true, true, true, false, 28, 'not_configured'),
  ('openrouter', 'OpenRouter', 'aggregator', 'coming_soon', 6, 'global', 'https://openrouter.ai/api/v1', 'api_key', 'OPENROUTER_API_KEY', 'openrouter', true, false, false, false, true, true, true, false, 22, 'not_configured'),
  ('groq', 'Groq', 'inference', 'coming_soon', 7, 'us', 'https://api.groq.com/openai/v1', 'api_key', 'GROQ_API_KEY', 'openai_compatible', false, false, false, false, true, true, true, false, 20, 'not_configured'),
  ('together', 'Together AI', 'inference', 'coming_soon', 8, 'us', 'https://api.together.xyz/v1', 'api_key', 'TOGETHER_API_KEY', 'openai_compatible', true, true, false, true, true, true, true, false, 22, 'not_configured'),
  ('fireworks', 'Fireworks', 'inference', 'coming_soon', 9, 'us', 'https://api.fireworks.ai/inference/v1', 'api_key', 'FIREWORKS_API_KEY', 'openai_compatible', true, true, false, false, true, true, true, false, 22, 'not_configured'),
  ('mistral', 'Mistral', 'llm', 'coming_soon', 10, 'eu', 'https://api.mistral.ai/v1', 'api_key', 'MISTRAL_API_KEY', 'mistral', false, false, false, true, true, true, true, false, 25, 'not_configured')
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  priority = excluded.priority,
  updated_at = now();

insert into public.commercial_models (
  id, provider_id, name, alias, version, api_model_id,
  input_price_per_1m, output_price_per_1m, cached_input_price_per_1m,
  context_length, max_output_tokens,
  supports_vision, supports_streaming, supports_json, supports_function_calling, supports_reasoning,
  availability, eu_available, gdpr_compatible, released_at
) values
  ('gpt-4o', 'openai', 'GPT-4o', 'gpt-4o', '2024-08', 'gpt-4o', 2.5, 10, 1.25, 128000, 16384, true, true, true, true, false, 'active', false, false, '2024-05-13'),
  ('gpt-4.1', 'openai', 'GPT-4.1', 'gpt-4.1', '2025-04', 'gpt-4.1', 2, 8, 1, 128000, 32768, true, true, true, true, false, 'active', false, false, '2025-04-14'),
  ('o1-mini', 'openai', 'o1-mini', 'o1-mini', '2025-01', 'o4-mini', 0.55, 2.2, 0.28, 200000, 65536, false, false, false, false, true, 'active', false, false, '2025-01-01'),
  ('gemini-2-flash', 'google', 'Gemini 2.5 Flash', 'gemini-flash', '2.5', 'gemini-2.5-flash', 0.1, 0.4, 0.025, 1000000, 8192, true, true, true, true, false, 'active', true, true, '2025-03-01'),
  ('gemini-2-pro', 'google', 'Gemini 2.5 Pro', 'gemini-pro', '2.5', 'gemini-2.5-pro', 1.25, 5, 0.31, 2000000, 8192, true, true, true, true, false, 'active', true, true, '2025-03-01'),
  ('claude-4-sonnet', 'anthropic', 'Claude 4 Sonnet', 'claude-sonnet', '4', 'claude-sonnet-4-20250514', 3, 15, 0.3, 200000, 64000, true, true, true, true, true, 'inactive', false, false, '2025-05-14'),
  ('deepseek-chat', 'deepseek', 'DeepSeek Chat', 'deepseek-v3', 'v3', 'deepseek-chat', 0.27, 1.1, 0.07, 128000, 8192, false, true, true, true, false, 'inactive', false, false, '2025-01-01'),
  ('deepseek-reasoner', 'deepseek', 'DeepSeek Reasoner', 'deepseek-r1', 'r1', 'deepseek-reasoner', 0.55, 2.19, 0.14, 128000, 8192, false, true, false, false, true, 'inactive', false, false, '2025-01-01'),
  ('qwen-turbo', 'qwen', 'Qwen Turbo', 'qwen-turbo', 'latest', 'qwen-turbo', 0.3, 0.6, 0.08, 128000, 8192, false, true, true, true, false, 'inactive', false, false, null),
  ('mistral-large', 'mistral', 'Mistral Large', 'mistral-large', 'latest', 'mistral-large-latest', 2, 6, 0.5, 128000, 8192, false, true, true, true, false, 'inactive', true, true, null)
on conflict (id) do update set
  input_price_per_1m = excluded.input_price_per_1m,
  output_price_per_1m = excluded.output_price_per_1m,
  availability = excluded.availability,
  updated_at = now();

insert into public.commercial_pricing_rules (name, rule_type, margin_value, margin_unit, tax_rate_pct, applies_to, priority, status)
select 'Default Percentage Margin', 'percentage_margin', 25, 'percent', 19, 'all', 100, 'active'
where not exists (select 1 from public.commercial_pricing_rules where name = 'Default Percentage Margin');

insert into public.commercial_pricing_rules (name, rule_type, margin_value, margin_unit, tax_rate_pct, applies_to, priority, status)
select 'Enterprise Custom Margin', 'enterprise_margin', 15, 'percent', 19, 'organization', 50, 'active'
where not exists (select 1 from public.commercial_pricing_rules where name = 'Enterprise Custom Margin');

insert into public.commercial_routing_policies (name, policy_type, weights, require_eu, require_gdpr, fallback_chain, priority, status)
select 'Default Intelligent Routing', 'default',
  '{"health":0.30,"cost":0.25,"latency":0.20,"region":0.10,"gdpr":0.15}'::jsonb,
  false, false, ARRAY['openai', 'google', 'anthropic', 'deepseek'], 100, 'active'
where not exists (select 1 from public.commercial_routing_policies where name = 'Default Intelligent Routing');

insert into public.commercial_routing_policies (name, policy_type, weights, require_eu, require_gdpr, fallback_chain, priority, status)
select 'EU GDPR Strict', 'enterprise',
  '{"health":0.20,"cost":0.15,"latency":0.15,"region":0.25,"gdpr":0.25}'::jsonb,
  true, true, ARRAY['google', 'mistral'], 50, 'active'
where not exists (select 1 from public.commercial_routing_policies where name = 'EU GDPR Strict');
