document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('dashboardSidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.dash-section');

  const keyModal = document.getElementById('keyModal');
  const createKeyBtn = document.getElementById('createKeyBtn');
  const createKeyForm = document.getElementById('createKeyForm');
  const keyResult = document.getElementById('keyResult');
  const newKeyValue = document.getElementById('newKeyValue');
  const copyKeyBtn = document.getElementById('copyKeyBtn');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const keyResultClose = document.getElementById('keyResultClose');
  const apiKeysBody = document.getElementById('apiKeysBody');
  const emptyKeysMsg = document.getElementById('emptyKeysMsg');

  let nextKeyId = 4;

  function showSection(sectionId) {
    sections.forEach((s) => s.classList.remove('active'));
    sidebarLinks.forEach((l) => l.classList.remove('active'));

    const target = document.getElementById(sectionId);
    const link = document.querySelector(`[data-section="${sectionId}"]`);

    if (target) target.classList.add('active');
    if (link) link.classList.add('active');
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      showSection(sectionId);
      history.replaceState(null, '', `#${sectionId}`);
      sidebar.classList.remove('open');
    });
  });

  const hash = window.location.hash.slice(1);
  if (hash && document.getElementById(hash)) {
    showSection(hash);
  }

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  function openModal() {
    keyModal.hidden = false;
    createKeyForm.hidden = false;
    keyResult.hidden = true;
    createKeyForm.reset();
    document.getElementById('keyName').focus();
  }

  function closeModal() {
    keyModal.hidden = true;
  }

  createKeyBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  keyResultClose.addEventListener('click', closeModal);

  keyModal.addEventListener('click', (e) => {
    if (e.target === keyModal) closeModal();
  });

  function generateKey(env) {
    const prefix = env === 'test' ? 'zwima_sk_test_' : 'zwima_sk_live_';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 24; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + suffix;
  }

  function formatDate() {
    const d = new Date();
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function maskKey(key) {
    return key.slice(0, 16) + '••••' + key.slice(-4);
  }

  function updateEmptyState() {
    const rows = apiKeysBody.querySelectorAll('tr:not(.revoked-row)');
    const hasActive = Array.from(rows).some((r) => !r.classList.contains('revoked-row'));
    emptyKeysMsg.hidden = hasActive;
    document.getElementById('apiKeysTable').hidden = !hasActive;
  }

  createKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('keyName').value.trim();
    const env = document.getElementById('keyEnv').value;
    const fullKey = generateKey(env);
    const id = nextKeyId++;

    const row = document.createElement('tr');
    row.dataset.keyId = id;
    row.innerHTML = `
      <td>${name}</td>
      <td><code>${maskKey(fullKey)}</code></td>
      <td>${formatDate()}</td>
      <td>–</td>
      <td><span class="status-badge status-active">Aktiv</span></td>
      <td><button type="button" class="btn-text btn-revoke" data-key-id="${id}">Widerrufen</button></td>
    `;
    apiKeysBody.appendChild(row);
    bindRevokeButtons();

    createKeyForm.hidden = true;
    keyResult.hidden = false;
    newKeyValue.textContent = fullKey;
    updateEmptyState();
  });

  copyKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(newKeyValue.textContent).then(() => {
      copyKeyBtn.textContent = 'Kopiert';
      setTimeout(() => { copyKeyBtn.textContent = 'Kopieren'; }, 2000);
    });
  });

  function bindRevokeButtons() {
    document.querySelectorAll('.btn-revoke').forEach((btn) => {
      btn.replaceWith(btn.cloneNode(true));
    });

    document.querySelectorAll('.btn-revoke').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const name = row.querySelector('td').textContent;
        if (!confirm(`API-Schlüssel „${name}" wirklich widerrufen?`)) return;

        row.querySelector('.status-badge').className = 'status-badge status-revoked';
        row.querySelector('.status-badge').textContent = 'Widerrufen';
        btn.remove();
        row.classList.add('revoked-row');
        row.style.opacity = '0.5';
        updateEmptyState();
      });
    });
  }

  bindRevokeButtons();
});
