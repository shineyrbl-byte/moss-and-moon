// ---------- Menu data (edit these to change the menu) ----------
const MENU = [
  { id: 1, cat: "coffee", name: "Honey Oat Latte", desc: "Double espresso, oat milk, wildflower honey.", price: 220, icon: "☕", color: "#f2d79b", tag: "bestseller" },
  { id: 2, cat: "coffee", name: "V60 Pour-Over", desc: "Single-origin, hand-poured. Ask about today's bean.", price: 240, icon: "🫖", color: "#e8d8c3" },
  { id: 3, cat: "coffee", name: "Cardamom Cortado", desc: "Short, strong and a little spiced.", price: 190, icon: "☕", color: "#f4c9a8" },
  { id: 4, cat: "coffee", name: "Iced Brown Sugar Shaken", desc: "Espresso shaken with brown sugar and cinnamon.", price: 230, icon: "🧊", color: "#e8d8c3", tag: "new" },
  { id: 5, cat: "tea", name: "Ceremonial Matcha", desc: "Whisked to order, served with oat or whole milk.", price: 260, icon: "🍵", color: "#c9d6b0", tag: "bestseller" },
  { id: 6, cat: "tea", name: "Rose Chai", desc: "House masala chai with dried rose petals.", price: 160, icon: "🌹", color: "#f3c6c0" },
  { id: 7, cat: "tea", name: "Lavender Earl Grey", desc: "Loose-leaf, floral and calm.", price: 170, icon: "🪻", color: "#d9cfe8" },
  { id: 8, cat: "bakes", name: "Butter Croissant", desc: "Flaky, golden, 72-hour laminated dough.", price: 150, icon: "🥐", color: "#f2d79b" },
  { id: 9, cat: "bakes", name: "Cardamom Bun", desc: "Swedish-style twist, pearl sugar on top.", price: 140, icon: "🥯", color: "#f4c9a8" },
  { id: 10, cat: "bakes", name: "Burnt Basque Cheesecake", desc: "Caramelised outside, creamy inside.", price: 280, icon: "🍰", color: "#f6e3c5", tag: "new" },
  { id: 11, cat: "bakes", name: "Brown Butter Cookie", desc: "Sea salt, dark chocolate chunks.", price: 110, icon: "🍪", color: "#e8d8c3" },
];

const $ = (sel) => document.querySelector(sel);
const rupees = (n) => "₹" + n;

// ---------- Render menu ----------
function renderMenu(cat = "all") {
  const items = cat === "all" ? MENU : MENU.filter((m) => m.cat === cat);
  $("#menuGrid").innerHTML = items
    .map(
      (m, i) => `
      <article class="item" style="animation-delay:${i * 60}ms">
        <div class="item-icon" style="background:${m.color}">${m.icon}</div>
        ${m.tag ? `<span class="tag">${m.tag}</span>` : ""}
        <h3>${m.name}</h3>
        <p>${m.desc}</p>
        <div class="item-foot">
          <span class="price">${rupees(m.price)}</span>
          <button class="add" data-id="${m.id}" aria-label="Add ${m.name}">+</button>
        </div>
      </article>`
    )
    .join("");
}

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelector(".tab.active").classList.remove("active");
    tab.classList.add("active");
    renderMenu(tab.dataset.cat);
  })
);

// ---------- Order tray (saved in the browser) ----------
let cart = {};
try { cart = JSON.parse(localStorage.getItem("mm-cart")) || {}; } catch { cart = {}; }

function saveCart() {
  try { localStorage.setItem("mm-cart", JSON.stringify(cart)); } catch {}
}

function renderCart() {
  const entries = Object.entries(cart);
  const count = entries.reduce((s, [, q]) => s + q, 0);
  const total = entries.reduce((s, [id, q]) => s + MENU.find((m) => m.id == id).price * q, 0);

  $("#badge").textContent = count;
  $("#total").textContent = rupees(total);
  $("#trayItems").innerHTML = entries.length
    ? entries
        .map(([id, q]) => {
          const m = MENU.find((x) => x.id == id);
          return `<li>
            <span>${m.icon}</span>
            <span class="name">${m.name}<br><small>${rupees(m.price * q)}</small></span>
            <span class="qty">
              <button data-dec="${id}" aria-label="Remove one">−</button>${q}
              <button data-inc="${id}" aria-label="Add one">+</button>
            </span>
          </li>`;
        })
        .join("")
    : `<li class="empty">Your tray is empty — pick something cosy ☕</li>`;
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart();
}

$("#menuGrid").addEventListener("click", (e) => {
  const btn = e.target.closest(".add");
  if (!btn) return;
  changeQty(btn.dataset.id, 1);
  const badge = $("#badge");
  badge.classList.remove("bump");
  void badge.offsetWidth; // restart animation
  badge.classList.add("bump");
  toast(`${MENU.find((m) => m.id == btn.dataset.id).name} added ✿`);
});

$("#trayItems").addEventListener("click", (e) => {
  if (e.target.dataset.inc) changeQty(e.target.dataset.inc, 1);
  if (e.target.dataset.dec) changeQty(e.target.dataset.dec, -1);
});

function setTray(open) {
  $("#tray").classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
  $("#tray").setAttribute("aria-hidden", !open);
}
$("#openTray").addEventListener("click", () => setTray(true));
$("#closeTray").addEventListener("click", () => setTray(false));
$("#overlay").addEventListener("click", () => setTray(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && setTray(false));

$("#checkout").addEventListener("click", () => {
  if (!Object.keys(cart).length) return toast("Add something first ☕");
  cart = {};
  saveCart();
  renderCart();
  setTray(false);
  toast("Order placed! We'll call your name soon ☾");
});

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- Open now? ----------
function updateOpenNow() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours() + now.getMinutes() / 60;
  const [open, close] = day === 0 ? [9, 18] : day === 6 ? [8, 22] : [7, 20];
  const isOpen = hour >= open && hour < close;
  const el = $("#openNow");
  el.textContent = isOpen ? "We're open right now — come in!" : "Closed right now — see you soon";
  el.style.setProperty("--dot", isOpen ? "#5f6f4e" : "#c9795a");
}

// ---------- Booking form ----------
const dateInput = document.querySelector('input[name="date"]');
dateInput.min = new Date().toISOString().split("T")[0];

$("#booking").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const date = new Date(data.get("date")).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  $("#formMsg").textContent = `Thank you, ${data.get("name")}! Table for ${data.get("guests")} on ${date} at ${data.get("time")} ✿`;
  e.target.reset();
});

// ---------- Nav: shadow on scroll + mobile menu ----------
window.addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 20));
$("#burger").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
document.querySelectorAll(".nav-links a").forEach((a) =>
  a.addEventListener("click", () => $("#navLinks").classList.remove("open"))
);

// ---------- Fade sections in as you scroll ----------
const observer = new IntersectionObserver(
  (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("visible")),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// ---------- Start ----------
$("#year").textContent = new Date().getFullYear();
renderMenu();
renderCart();
updateOpenNow();
