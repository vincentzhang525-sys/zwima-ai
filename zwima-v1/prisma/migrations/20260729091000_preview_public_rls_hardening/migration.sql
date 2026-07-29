-- Preview security hardening (additive only).
-- Goal: close public-schema exposure by enabling fail-closed RLS on business tables.
-- Notes:
-- 1) No table drops, no data deletes, no schema rewrites.
-- 2) service_role keeps backend access; anon/authenticated stay deny-by-default unless app adds explicit policies later.
-- 3) This migration is safe to run repeatedly.

DO $$
DECLARE
  tbl text;
  policy_name text;
  target_tables text[] := ARRAY[
    'User',
    'Organization',
    'OrganizationMember',
    'ApiKey',
    'CreditBalance',
    'Transaction',
    'Payment',
    'UsageLog',
    'Agent',
    'AgentDefinition',
    'AgentMemory',
    'WorkspaceMemory',
    'LegalConsentAcceptance',
    'AccountDeletionRequest'
  ];
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

    policy_name := format('%s_service_role_all', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      policy_name,
      tbl
    );
  END LOOP;
END
$$;
