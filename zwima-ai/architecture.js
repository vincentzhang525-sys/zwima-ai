document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('archSidebar');
  const toggle = document.getElementById('archToggle');
  const tocLinks = document.querySelectorAll('.arch-toc a');

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  tocLinks.forEach((link) => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  });
});
