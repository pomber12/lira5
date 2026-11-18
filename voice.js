// =========================================================
// ЛИРА – как казва фразите
// Показва текста буква по буква като субтитри, сменя
// настроението ѝ и (само в Claude) може да го каже на глас.
// =========================================================

// Общо състояние, което hologram.js чете всеки кадър
const lira = {
  mood: "calm",        // текущо настроение
  talking: false,      // дали в момента говори (за устата)
  glowColor: COLORS.calm,
};

const lineEl = document.getElementById("line");
const moodEl = document.getElementById("mood");

let typingTimer = null;
let hideTimer = null;
let nextTimer = null;
let recentLines = [];   // за да не повтаря скоро казаното
let tts = null;         // гласът (има го само когато е отворена в Claude)
let voiceOn = false;

try { voiceOn = localStorage.getItem("lira:voice") === "1"; } catch {}

// Казва една фраза: ["текст", "настроение"]
function say([text, mood]) {
  clearInterval(typingTimer);
  clearTimeout(hideTimer);

  // Настроение и цвят
  lira.mood = mood;
  lira.glowColor = COLORS[mood];
  moodEl.textContent = MOODS[mood];
  const [r, g, b] = COLORS[mood].map(v => Math.round(v * 255));
  document.documentElement.style.setProperty("--glow", `rgb(${r} ${g} ${b} / .55)`);

  // Текстът се изписва буква по буква, а устата ѝ мърда
  lineEl.textContent = "";
  lineEl.classList.add("on");
  lira.talking = true;
  let i = 0;
  typingTimer = setInterval(() => {
    i++;
    lineEl.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(typingTimer);
      if (!(voiceOn && tts)) lira.talking = false;
    }
  }, reduceMotion ? 5 : 42);

  // На глас (ако е включен)
  if (voiceOn && tts) {
    tts.speak(text, { voice: "airy", language: "bg" })
      .catch(() => {})
      .finally(() => { lira.talking = false; });
  }

  // Субтитърът изчезва след малко
  hideTimer = setTimeout(() => lineEl.classList.remove("on"), 6500 + text.length * 40);
}

// Избира случайна фраза, която не е казвала скоро
function pick(list) {
  let choice;
  let tries = 0;
  do {
    choice = list[Math.floor(Math.random() * list.length)];
    tries++;
  } while (recentLines.includes(choice[0]) && tries < 20);
  recentLines.push(choice[0]);
  if (recentLines.length > 12) recentLines.shift();
  return choice;
}

// Планира следващата фраза
function scheduleNext() {
  clearTimeout(nextTimer);
  const seconds = SPEAK_EVERY_MIN + Math.random() * (SPEAK_EVERY_MAX - SPEAK_EVERY_MIN);
  nextTimer = setTimeout(() => {
    if (!document.hidden) say(pick(LINES));
    scheduleNext();
  }, seconds * 1000);
}

// Когато я докоснеш
function onTouch(x) {
  if (window.liraOffer && window.liraOffer(x)) return;   // „Лира 2“ подава ръка
  say(pick(TOUCH));
  scheduleNext();
}

// Бутон „Кажи нещо“
document.getElementById("sayBtn").onclick = () => {
  say(pick(LINES));
  scheduleNext();
};

// Гласът – работи само когато страницата е отворена в Claude.
// Отворена от компютъра, бутонът „Глас“ просто не се показва.
(async () => {
  if (!window.claude) return;
  tts = await claude.use("tts");
  if (!tts) return;

  const btn = document.getElementById("voiceBtn");
  btn.hidden = false;
  btn.setAttribute("aria-pressed", voiceOn);
  btn.onclick = () => {
    voiceOn = !voiceOn;
    btn.setAttribute("aria-pressed", voiceOn);
    try { localStorage.setItem("lira:voice", voiceOn ? "1" : "0"); } catch {}
    if (voiceOn) say(["Сега ще ме чуваш. Надявам се гласът ми да ти харесва.", "shy"]);
    else { tts.stop(); lira.talking = false; }
  };
  tts.onState(({ state }) => {
    if (state === "speaking") lira.talking = true;
    else if (state === "idle") lira.talking = false;
  });
})();

// Падащото меню „Опции“ се затваря при клик извън него или с Esc
(() => {
  const menu = document.getElementById("menu");
  if (!menu) return;
  document.addEventListener("pointerdown", (e) => {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menu.open = false;
  });
})();
