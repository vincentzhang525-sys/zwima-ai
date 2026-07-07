async function loadNotifications() {
  const data = await window.ZwimaSupabaseApi.apiFetch("/api/notifications");
  const rows = data.notifications || [];
  const body = document.getElementById("notificationsBody");
  const badge = document.getElementById("notifBadge");
  if (badge) badge.textContent = String(data.unread || 0);
  if (!body) return;
  body.innerHTML = rows.length
    ? rows
        .map(
          (row) => `<tr>
      <td class="muted">${new Date(row.createdAt).toLocaleString("en-GB")}</td>
      <td>${row.category}</td>
      <td>${row.title}</td>
      <td>${row.message}</td>
      <td>${row.isRead ? "Read" : "Unread"}</td>
    </tr>`
        )
        .join("")
    : '<tr><td colspan="5" class="muted">No notifications.</td></tr>';
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadNotifications();
  document.getElementById("markAllReadBtn")?.addEventListener("click", async () => {
    await window.ZwimaSupabaseApi.apiFetch("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ action: "markAllRead" }),
    });
    await loadNotifications();
  });
});
