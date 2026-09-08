const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector("nav");

menuBtn?.addEventListener("click", () => {
  nav.classList.toggle("open");
});

document.querySelectorAll("nav a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

const revealItems = document.querySelectorAll(".project, .skill-card, .timeline-item, .education-item");
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

revealItems.forEach(item => {
  item.style.opacity = "0";
  item.style.transform = "translateY(16px)";
  item.style.transition = "opacity .6s ease, transform .6s ease";
  observer.observe(item);
});
