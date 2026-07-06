(function () {
  let conversationsCache = [];

  async function refreshFromDb() {
    const data = await window.ZwimaSupabaseApi.apiFetch("/api/conversations");
    conversationsCache = data.conversations || [];
    return conversationsCache;
  }

  window.ZwimaConversationService = {
    isSupabase() {
      return window.ZwimaDbMode?.isSupabaseMode?.();
    },

    async refreshFromDb,
    getCached() {
      return conversationsCache;
    },

    async saveConversation({ title, provider, model, messages }) {
      if (!this.isSupabase()) {
        let history = window.ZwimaStorage.get("PLAYGROUND_HISTORY", []);
        history.unshift({
          id: Date.now(),
          title,
          provider,
          model,
          messages,
          timestamp: new Date().toISOString(),
        });
        window.ZwimaStorage.set("PLAYGROUND_HISTORY", history.slice(0, 5));
        return history[0];
      }

      const data = await window.ZwimaSupabaseApi.apiFetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title, provider, model, messages }),
      });
      conversationsCache.unshift(data.conversation);
      conversationsCache = conversationsCache.slice(0, 5);
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
  };
})();
