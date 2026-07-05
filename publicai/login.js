const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "dashboard.html";
  });
}
