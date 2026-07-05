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
  contactForm.addEventListener("submit", () => {
    const formData = new FormData(contactForm);
    const subject = encodeURIComponent("ZWIMA AI access request");
    const body = encodeURIComponent(
      `Name: ${formData.get("Name") || ""}\n` +
      `Company: ${formData.get("Company") || ""}\n` +
      `Email: ${formData.get("Email") || ""}\n` +
      `Use case: ${formData.get("Use case") || ""}\n\n` +
      `Message:\n${formData.get("Message") || ""}`
    );

    contactForm.setAttribute(
      "action",
      `mailto:hello@zwima-group.info?subject=${subject}&body=${body}`
    );
  });
}
