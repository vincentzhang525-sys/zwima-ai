(function (root) {
  root.ZwimaMockAuth = {
    get DEMO_USER() {
      return root.ZwimaLocalStorageAuthAdapter?.DEMO_ACCOUNT || null;
    },
    isAuthenticated() {
      return root.ZwimaAuthService?.isAuthenticated() || false;
    },
    getSession() {
      return root.ZwimaAuthService?.getCurrentUser() || null;
    },
    getPendingRegistration() {
      return root.ZwimaAuthService?.getPendingRegistration() || null;
    },
    signIn(email, password) {
      return root.ZwimaAuthService.login({ email, password });
    },
    signUp(payload) {
      return root.ZwimaAuthService.register(payload);
    },
    signOut() {
      return root.ZwimaAuthService.logout();
    },
    forgotPassword(email) {
      return root.ZwimaAuthService.forgotPassword({ email });
    },
    verifyEmail(code) {
      return root.ZwimaAuthService.verifyEmail(code);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
