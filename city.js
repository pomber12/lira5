// =========================================================
// ЛИРА – фонът: нощен град с размазани неонови светлини и дъжд
// Рисува се с обикновен 2D canvas.
// =========================================================

const cityCanvas = document.getElementById("city");
const ctx = cityCanvas.getContext("2d");

// Ако човек е избрал „по-малко движение“ в системата си – забавяме всичко
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Размазани светлини (боке): позиция, размер, цвят
const NEON = ["255,90,190", "80,200,255", "255,170,80", "150,120,255"];
const bokeh = [];
for (let i = 0; i < 22; i++) {
  bokeh.push({
    x: Math.random(),
    y: Math.random() * 0.75,
    r: 20 + Math.random() * 70,
    color: NEON[i % NEON.length],
    phase: Math.random() * 6,
  });
}

// Дъждовни капки
const drops = [];
for (let i = 0; i < 140; i++) {
  drops.push({
    x: Math.random(),
    y: Math.random(),
    speed: 0.4 + Math.random(),
    length: 8 + Math.random() * 18,
  });
}

function resizeCity() {
  cityCanvas.width = innerWidth;
  cityCanvas.height = innerHeight;
}
addEventListener("resize", resizeCity);
resizeCity();

// Вика се всеки кадър от hologram.js
function drawCity(time) {
  const w = cityCanvas.width;
  const h = cityCanvas.height;

  // В изглед „Балкон“ градът е 3D (balcony.js) – тук рисуваме само дъжда
  // В изглед „Стая“ сме вътре – нищо не рисуваме тук (няма дъжд)
  if (document.body.classList.contains("room")) {
    ctx.clearRect(0, 0, w, h);
    return;
  }
  const balconyMode = document.body.classList.contains("balcony");
  if (balconyMode) {
    ctx.clearRect(0, 0, w, h);
    drawRain(w, h, "rgba(170,200,240,.22)");
    return;
  }

  // Небе
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#070612");
  sky.addColorStop(0.6, "#0b0820");
  sky.addColorStop(1, "#04050b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Светлини, които леко пулсират
  for (const b of bokeh) {
    const alpha = 0.06 + 0.04 * Math.sin(time * 0.6 + b.phase);
    const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r);
    g.addColorStop(0, `rgba(${b.color},${alpha * 1.6})`);
    g.addColorStop(0.7, `rgba(${b.color},${alpha})`);
    g.addColorStop(1, `rgba(${b.color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x * w, b.y * h, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRain(w, h, "rgba(150,190,230,.16)");
}

// Дъжд
function drawRain(w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of drops) {
    if (!reduceMotion) {
      d.y += d.speed * 0.012;
      if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
    }
    const x = d.x * w;
    const y = d.y * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y + d.length);
  }
  ctx.stroke();
}
