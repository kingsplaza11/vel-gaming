export function burst(el, count = 12) {
  if (!el) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "coin-burst";
    s.style.left = "50%";
    s.style.top = "50%";
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
    s.style.setProperty("--dy", `${-80 - Math.random() * 220}px`);
    s.style.setProperty("--r", `${(Math.random() - 0.5) * 360}deg`);
    el.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

export function shake(el) {
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 300);
}
