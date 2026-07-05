(function () {
  window.ZwimaLayoutFooter = {
    init() {
      const footer = document.querySelector(".sidebar-footer");
      if (!footer) return;
      const back = footer.querySelector(".sidebar-back");
      if (back && !back.getAttribute("href")) {
        back.setAttribute("href", "index.html");
      }
    },
  };
})();
