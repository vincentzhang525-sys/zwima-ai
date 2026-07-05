const BASE = process.env.API_URL || 'http://localhost:3000';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run() {
  const email = `test${Date.now()}@example.com`;
  const password = 'testpass123';

  console.log('1. Register...');
  const reg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ company_name: 'Test GmbH', email, password }),
  });
  console.log(reg.status, reg.body);

  console.log('2. Login...');
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = login.body.token;
  console.log(login.status, token ? 'OK' : login.body);

  console.log('3. Create API key...');
  const keyRes = await req('/api-keys/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Smoke Test', env: 'live' }),
  });
  const apiKey = keyRes.body.api_key;
  console.log(keyRes.status, apiKey?.slice(0, 20) + '...');

  console.log('4. Chat completion...');
  const chat = await req('/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hi' }],
    }),
  });
  console.log(chat.status, chat.body.choices?.[0]?.message?.content?.slice(0, 50));

  console.log('5. Credits...');
  const credits = await req('/account/credits', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(credits.status, credits.body);

  console.log('6. Admin stats...');
  const admin = await req('/admin/stats', {
    headers: { 'X-Admin-Secret': process.env.ADMIN_SECRET || 'dev-admin-secret' },
  });
  console.log(admin.status, admin.body);

  console.log('Smoke test complete.');
}

run().catch(console.error);
