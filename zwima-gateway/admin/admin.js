const API = window.location.origin;
let authHeaders = {};

function setSecretAuth(secret) {
  authHeaders = { 'X-Admin-Secret': secret };
  sessionStorage.setItem('admin_secret', secret);
}

function setJwtAuth(token) {
  authHeaders = { Authorization: `Bearer ${token}` };
  sessionStorage.setItem('admin_jwt', token);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...options.headers },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function logout() {
  sessionStorage.clear();
  authHeaders = {};
  document.getElementById('app').hidden = true;
  document.getElementById('loginScreen').hidden = false;
}

async function loadAll() {
  const [stats, users, keys, usage, billing] = await Promise.all([
    api('/admin/stats'),
    api('/admin/users'),
    api('/admin/api-keys'),
    api('/admin/usage'),
    api('/admin/billing'),
  ]);

  document.getElementById('statsBar').innerHTML = `
    <span>Users: ${stats.total_users}</span>
    <span>Keys: ${stats.active_api_keys}</span>
    <span>Credits used: ${stats.total_credits_used}</span>
    <span>24h requests: ${stats.requests_24h}</span>
  `;

  document.querySelector('#usersTable tbody').innerHTML = users.users.map((u) => `
    <tr>
      <td>${esc(u.company_name)}</td>
      <td>${esc(u.email)}${u.is_admin ? ' (admin)' : ''}</td>
      <td class="status-active">${esc(u.status)}</td>
      <td>${u.credit_balance}</td>
      <td>${u.monthly_quota}</td>
      <td>${u.active_keys}</td>
      <td><button class="btn-topup" data-id="${u.id}">+1000 credits</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.btn-topup').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api('/admin/credits/topup', {
        method: 'POST',
        body: JSON.stringify({ user_id: btn.dataset.id, amount: 1000 }),
      });
      await loadAll();
    });
  });

  document.querySelector('#keysTable tbody').innerHTML = keys.keys.map((k) => `
    <tr>
      <td>${esc(k.company_name)}</td>
      <td>${esc(k.name)}</td>
      <td><code>${esc(k.key_prefix)}</code></td>
      <td>${esc(k.env)}</td>
      <td>${esc(k.status)}</td>
      <td>${k.last_used_at ? new Date(k.last_used_at).toLocaleString('de-DE') : '–'}</td>
    </tr>
  `).join('');

  document.querySelector('#usageTable tbody').innerHTML = usage.records.map((r) => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString('de-DE')}</td>
      <td>${esc(r.company_name)}</td>
      <td>${esc(r.model)}</td>
      <td>${r.input_tokens}</td>
      <td>${r.output_tokens}</td>
      <td>${r.credits_used}</td>
      <td>${esc(r.status)}</td>
    </tr>
  `).join('');

  document.querySelector('#billingTable tbody').innerHTML = billing.records.length
    ? billing.records.map((b) => `
      <tr>
        <td>${esc(b.invoice_number || '–')}</td>
        <td>${esc(b.company_name)}</td>
        <td>${esc(b.type)}</td>
        <td>${b.amount_eur} EUR</td>
        <td>${b.period_start || '–'} – ${b.period_end || '–'}</td>
        <td>${esc(b.status)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">No billing records yet</td></tr>';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const secret = document.getElementById('adminSecret').value;
  if (!secret) return alert('Enter admin secret');
  setSecretAuth(secret);
  try {
    await api('/admin/stats');
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('app').hidden = false;
    await loadAll();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById('jwtLoginBtn').addEventListener('click', async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('adminEmail').value,
      password: document.getElementById('adminPassword').value,
    }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Login failed');
  setJwtAuth(data.token);
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('app').hidden = false;
  await loadAll();
});

document.getElementById('logoutBtn').addEventListener('click', logout);

const saved = sessionStorage.getItem('admin_secret') || sessionStorage.getItem('admin_jwt');
if (saved) {
  if (sessionStorage.getItem('admin_secret')) setSecretAuth(saved);
  else setJwtAuth(saved);
  api('/admin/stats').then(() => {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('app').hidden = false;
    loadAll();
  }).catch(logout);
}
