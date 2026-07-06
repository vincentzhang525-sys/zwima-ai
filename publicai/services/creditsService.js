(function () {
  const CREDITS_PER_EUR = 1000;
  function walletKey() {
    const email = window.ZwimaAuthService?.getCurrentUser()?.email;
    if (!email) return null;
    return `zwima_credits_wallet_${email}`;
  }

  function defaultWallet() {
    const user = window.ZwimaAuthService?.getCurrentUser?.();
    const initial = Number(user?.credits) || 1000;
    return {
      balance: initial,
      currency: "EUR",
      transactions: [],
    };
  }

  function loadRaw() {
    const key = walletKey();
    if (!key) return defaultWallet();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultWallet();
      const parsed = JSON.parse(raw);
      return {
        balance: Number(parsed.balance) || 0,
        currency: parsed.currency || "EUR",
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      };
    } catch {
      return defaultWallet();
    }
  }

  function saveWallet(wallet) {
    const key = walletKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(wallet));
    syncSessionBalance(wallet.balance);
  }

  function syncSessionBalance(balance) {
    const user = window.ZwimaAuthService?.getCurrentUser?.();
    if (!user || !window.ZwimaStorage) return;
    window.ZwimaStorage.set("SESSION", {
      ...user,
      credits: balance,
      creditsBalance: String(balance),
    });
  }

  function newId() {
    return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthKey(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  window.ZwimaCreditsService = {
    CREDITS_PER_EUR,

    getWallet() {
      return loadRaw();
    },

    getTransactions() {
      return loadRaw().transactions.slice().reverse();
    },

    getMonthlyUsage() {
      const current = monthKey(today());
      return loadRaw().transactions
        .filter((tx) => tx.type === "usage" && monthKey(tx.date) === current)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
    },

    getEstimatedEurValue(balance) {
      const credits = balance ?? loadRaw().balance;
      return credits / CREDITS_PER_EUR;
    },

    topUp(amountEur) {
      const eur = Number(amountEur);
      if (!eur || eur <= 0) {
        throw new Error("Please enter a valid top-up amount.");
      }
      const credits = Math.round(eur * CREDITS_PER_EUR);
      const wallet = loadRaw();
      wallet.balance += credits;
      wallet.transactions.push({
        id: newId(),
        type: "topup",
        amount: credits,
        description: `Top-up €${eur} (${credits.toLocaleString()} credits)`,
        date: today(),
        status: "completed",
      });
      saveWallet(wallet);
      return wallet;
    },

    spend(amount, description) {
      const credits = Math.abs(Number(amount) || 0);
      if (!credits) throw new Error("Invalid usage amount.");
      const wallet = loadRaw();
      if (wallet.balance < credits) {
        throw new Error("Insufficient credits. Please top up your wallet.");
      }
      wallet.balance -= credits;
      wallet.transactions.push({
        id: newId(),
        type: "usage",
        amount: -credits,
        description: description || "API usage",
        date: today(),
        status: "completed",
      });
      saveWallet(wallet);
      return wallet;
    },

    addAdjustment(amount, description) {
      const delta = Number(amount) || 0;
      const wallet = loadRaw();
      wallet.balance += delta;
      wallet.transactions.push({
        id: newId(),
        type: "adjustment",
        amount: delta,
        description: description || "Balance adjustment",
        date: today(),
        status: "completed",
      });
      saveWallet(wallet);
      return wallet;
    },
  };
})();
