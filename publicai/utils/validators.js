(function () {
  window.ZwimaValidators = {
    isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    },
    isRequired(value) {
      return String(value || "").trim().length > 0;
    },
    passwordsMatch(a, b) {
      return String(a) === String(b);
    },
    minLength(value, min) {
      return String(value || "").length >= min;
    },
  };
})();
