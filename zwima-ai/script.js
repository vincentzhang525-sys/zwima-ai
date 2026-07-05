document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const contactForm = document.getElementById('contactForm');

  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    navToggle.classList.toggle('active');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.classList.remove('active');
    });
  });

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    const subject = encodeURIComponent('API-Zugang Anfrage – Zwima AI API Credits Platform');
    const body = encodeURIComponent(
      `Name: ${data.name}\n` +
      `Unternehmen: ${data.company}\n` +
      `E-Mail: ${data.email}\n` +
      `Erwartete monatliche Nutzung: ${data.usage}\n` +
      `Bevorzugte Modelle: ${data.models || '–'}\n\n` +
      `Nachricht:\n${data.message || '–'}`
    );

    window.location.href = `mailto:contact@zwima-group.online?subject=${subject}&body=${body}`;
  });

  const sections = document.querySelectorAll('section[id]');
  const navLinks = mainNav.querySelectorAll('a');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.style.color = link.getAttribute('href') === `#${entry.target.id}`
              ? 'var(--blue-dark)'
              : '';
          });
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );

  sections.forEach((section) => observer.observe(section));
});
