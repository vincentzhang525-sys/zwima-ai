const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navMenu.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    const formData = new FormData(contactForm);
    const subject = encodeURIComponent("Zwima AI free demo request");
    const body = encodeURIComponent(
      `Name: ${formData.get("Name") || ""}\n` +
      `Company: ${formData.get("Company") || ""}\n` +
      `Email: ${formData.get("Email") || ""}\n\n` +
      `Message:\n${formData.get("Message") || ""}`
    );

    contactForm.setAttribute(
      "action",
      `mailto:info@zwima-group.com?subject=${subject}&body=${body}`
    );
  });
}
