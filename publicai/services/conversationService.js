(function () {
  let conversationsCache = [];

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/conversations");
    conversationsCache = data.conversations || [];
    return conversationsCache;
  }

  function upsertCache(conversation) {
    const index = conversationsCache.findIndex((row) => String(row.id) === String(conversation.id));
    if (index >= 0) {
      conversationsCache[index] = conversation;
    } else {
      conversationsCache.unshift(conversation);
    }
    conversationsCache = conversationsCache.slice(0, 5);
  }

  window.ZwimaConversationService = {
    isSupabase() {
      return window.ZwimaDbMode?.isSupabaseMode?.();
    },

    refreshFromDb,
    getCached() {
      return conversationsCache;
    },

    async saveConversation({ id, title, provider, model, messages }) {
      if (!this.isSupabase()) {
        let history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
        if (id) {
          const index = history.findIndex((row) => String(row.id) === String(id));
          const existing = index >= 0 ? history[index] : null;
          const updated = {
            id: existing?.id || id,
            title,
            provider,
            model,
            messages,
            timestamp: new Date().toISOString(),
          };
          if (index >= 0) history[index] = updated;
          else history.unshift(updated);
          window.ZwimaStorage.set("PLAYGROUND_HISTORY", history.slice(0, 5));
          return updated;
        }

        const created = {
          id: Date.now(),
          title,
          provider,
          model,
          messages,
          timestamp: new Date().toISOString(),
        };
        history.unshift(created);
        window.ZwimaStorage.set("PLAYGROUND_HISTORY", history.slice(0, 5));
        return created;
      }

      const payload = { title, provider, model, messages };
      const method = id ? "PATCH" : "POST";
      if (id) payload.id = id;

      const data = await window.ZwimaSupabaseApi.apiFetch("/api/conversations", {
        method,
        body: JSON.stringify(payload),
      });
      upsertCache(data.conversation);
      return data.conversation;
    },

    async getHistory() {
      if (!this.isSupabase()) {
        return window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
      }
      if (!conversationsCache.length) {
        await refreshFromDb();
      }
      return conversationsCache;
    },

    async findById(id) {
      const history = await this.getHistory();
      return history.find((row) => String(row.id) === String(id)) || null;
    },
    async deleteConversation(id) {
      if (!id) return false;
      if (!this.isSupabase()) {
        const history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []).filter((row) => String(row.id) !== String(id));
        window.ZwimaStorage.set("PLAYGROUND_HISTORY", history);
        return true;
      }
      await window.ZwimaSupabaseApi.apiFetch("/api/conversations", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      conversationsCache = conversationsCache.filter((row) => String(row.id) !== String(id));
      return true;
    },
  };
})();
