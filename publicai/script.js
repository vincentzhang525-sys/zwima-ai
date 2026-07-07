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

async function submitContactForm(event) {
  if (!contactForm) return;
  event.preventDefault();

  const formData = new FormData(contactForm);
  const payload = {
    name: formData.get("name") || formData.get("Name"),
    company: formData.get("company") || formData.get("Company"),
    email: formData.get("email") || formData.get("Email"),
    usecase: formData.get("usecase") || formData.get("Use case"),
    message: formData.get("message") || formData.get("Message"),
    website: formData.get("website") || "",
  };

  const statusEl = document.getElementById("contactFormStatus");
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (statusEl) {
        statusEl.textContent = data.message || "Message sent. Thank you!";
        statusEl.className = "notice-inline";
      }
      contactForm.reset();
      return;
    }
    throw new Error(data.error || "Submission failed");
  } catch (err) {
    const subject = encodeURIComponent("ZWIMA AI access request");
    const body = encodeURIComponent(
      `Name: ${payload.name || ""}\n` +
        `Company: ${payload.company || ""}\n` +
        `Email: ${payload.email || ""}\n` +
        `Use case: ${payload.usecase || ""}\n\n` +
        `Message:\n${payload.message || ""}`
    );
    if (statusEl) {
      statusEl.textContent = "API unavailable — opening your email client as fallback.";
      statusEl.className = "muted";
    }
    window.location.href = `mailto:hello@zwima-group.info?subject=${subject}&body=${body}`;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

if (contactForm) {
  contactForm.addEventListener("submit", submitContactForm);
}
