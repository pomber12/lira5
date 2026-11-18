// =========================================================
// ЛИРА – 3D холограмата
// ---------------------------------------------------------
// 1. Сцена, камера и светлини
// 2. Проекторът под нея (кръгове, лъч, искрици)
// 3. Камера „отдалеч / отблизо“
// 4. Мишка/пръст: въртене и докосване
// 5. Визиите (3D модели .vrm) и бутонът за смяна
// 6. Анимация всеки кадър: дишане, мигане, изражения, уста
// =========================================================

(() => {
  if (!window.LIRA3D) {
    showError("3D двигателят не се зареди. Провери дали lira-engine.js е в същата папка.");
    return;
  }
  const { THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils } = window.LIRA3D;

  const canvas = document.getElementById("holo");
  const loadBox = document.getElementById("load");
  const loadText = document.getElementById("loadTxt");
  const loadBar = document.getElementById("loadBar");

  function showError(message) {
    const t = document.getElementById("loadTxt");
    t.className = "err";
    t.textContent = message;
    document.getElementById("loadBar").parentElement.hidden = true;
    document.getElementById("load").hidden = false;
  }

  // ---------- 1. Сцена, камера и светлини ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    showError("Това устройство не може да показва 3D (няма WebGL).");
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // прозрачен фон – отзад се вижда градът

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(0.6, 1.6, 1.4);
  scene.add(keyLight);

  // ---------- 2. Проекторът ----------
  // Материал, който „свети“ (цветовете се събират като светлина)
  const glowMaterial = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });

  const projector = new THREE.Group();
  scene.add(projector);

  // Три светещи кръга на пода
  const ringMaterial = glowMaterial(0x6fe8ff, 0.85);
  const rings = [[0.36, 0.38], [0.26, 0.272], [0.15, 0.158]].map(([inner, outer]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    projector.add(ring);
    return ring;
  });

  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.38, 64), glowMaterial(0x6fe8ff, 0.08));
  disk.rotation.x = -Math.PI / 2;
  projector.add(disk);

  // Светлинен лъч нагоре – силен долу, избледнява нагоре
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(0x6fe8ff) } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float a = pow(1.0 - vUv.y, 2.2) * 0.14;
        gl_FragColor = vec4(color * a, a);
      }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.36, 1.9, 64, 1, true), beamMaterial);
  beam.position.y = 0.95;
  projector.add(beam);

  // Искрици, които се издигат в лъча
  const SPARKS = 220;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkSpeeds = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 0.42;
    sparkPositions[i * 3] = Math.cos(angle) * radius;
    sparkPositions[i * 3 + 1] = Math.random() * 1.9;
    sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;
    sparkSpeeds[i] = 0.15 + Math.random() * 0.35;
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  projector.add(new THREE.Points(sparkGeometry, new THREE.PointsMaterial({
    color: 0xaef3ff, size: 0.012, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));

  // ---------- 3. Камера ----------
  let closeUp = false;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();

  function aimCamera(instant) {
    const phone = innerWidth / innerHeight < 0.8;
    const balcony = Balcony && Balcony.on;
    const room = Room && Room.on;
    if (room && closeUp) {       // стая, по-близо – лицето ѝ
      wantPos.set(0.15, 1.42, phone ? 1.7 : 1.35);
      wantLook.set(0, 1.33, 0);
    } else if (room) {           // стая – виждаш я и стаята около нея
      wantPos.set(0.5, 1.45, phone ? 6.2 : 5.0);
      wantLook.set(-0.15, 0.95, -0.6);
    } else if (balcony && closeUp) {    // балкон, по-близо – лицето ѝ отстрани
      wantPos.set(phone ? 1.7 : 1.35, 1.3, 0.75);
      wantLook.set(0, 1.4, 0.15);
    } else if (balcony) {        // балкон – гледаш я отстрани: огромна, навела се над града
      wantPos.set(phone ? 3.4 : 2.7, 0.85, phone ? 2.2 : 1.7);
      wantLook.set(phone ? 0.2 : -0.15, 1.15, 0.15);
    } else if (closeUp) {        // лицето
      wantPos.set(0, 1.4, phone ? 1.7 : 1.35);
      wantLook.set(0, 1.3, 0);
    } else {                     // цялата фигура
      wantPos.set(0, 1.0, phone ? 4.4 : 3.4);
      wantLook.set(0, phone ? 0.85 : 0.8, 0);
    }
    if (instant) { camPos.copy(wantPos); camLook.copy(wantLook); }
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    aimCamera(false);
  }
  addEventListener("resize", resize);
  resize();
  aimCamera(true);

  // Бутони „Стая“ и „Балкон“ – само единият може да е включен; изборът се запомня
  const roomBtn = document.getElementById("roomBtn");
  const balconyBtn = document.getElementById("balconyBtn");
  if (!Room) roomBtn.hidden = true;
  if (!Balcony) balconyBtn.hidden = true;
  function setView(view) {           // "" (обикновен), "room" или "balcony"
    if (view === "room" && !Room) view = "";
    if (view === "balcony" && !Balcony) view = "";
    if (Room) Room.set(view === "room");
    if (Balcony) Balcony.set(view === "balcony");
    roomBtn.setAttribute("aria-pressed", view === "room");
    balconyBtn.setAttribute("aria-pressed", view === "balcony");
    try { localStorage.setItem("lira:view", view); } catch {}
    aimCamera(false);
  }
  roomBtn.onclick = () => setView(Room && Room.on ? "" : "room");
  balconyBtn.onclick = () => setView(Balcony && Balcony.on ? "" : "balcony");
  let startView = "";
  try {
    startView = localStorage.getItem("lira:view")
      ?? (localStorage.getItem("lira:balcony") === "1" ? "balcony" : "");
  } catch {}
  setView(startView);
  aimCamera(true);

  // Перилата в перспектива: близкият край е долу вдясно, далечният – навътре вляво.
  // Точките са в координати 0–1000 (ширина) и 0–600 (височина) на екрана.
  (function drawRail() {
    const near = { x: 1000, top: 330, bottom: 600 };   // най-близо до теб
    const far = { x: 520, top: 455, bottom: 505 };     // най-далеч
    const at = (t) => ({                               // t: 0 = близо, 1 = далеч
      x: near.x + (far.x - near.x) * t,
      top: near.top + (far.top - near.top) * t,
      bottom: near.bottom + (far.bottom - near.bottom) * t,
    });
    const set = (id, d) => { const el = document.getElementById(id); if (el) el.setAttribute("d", d); };
    // Пода на мостчето – под перилата
    set("railDeck", `M ${near.x} ${near.bottom} L ${far.x} ${far.bottom} L ${far.x} 600 L 1000 600 Z`);
    // Горната тръба (по-дебела близо до теб)
    set("railTopBar", `M ${near.x} ${near.top - 14} L ${far.x} ${far.top - 3} L ${far.x} ${far.top + 1} L ${near.x} ${near.top + 12} Z`);
    set("railGlint", `M ${near.x} ${near.top - 14} L ${far.x} ${far.top - 3} L ${far.x} ${far.top - 2} L ${near.x} ${near.top - 10} Z`);
    // Вертикалните пръчки – все по-гъсти и по-ниски навътре
    const bars = document.getElementById("bars");
    if (!bars) return;
    for (let i = 0; i <= 40; i++) {
      const t = Math.pow(i / 40, 0.7);
      const p = at(t);
      const w = 9 * (1 - t) + 1.5;
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", p.x - w); r.setAttribute("y", p.top);
      r.setAttribute("width", w); r.setAttribute("height", p.bottom - p.top);
      bars.appendChild(r);
    }
  })();

  document.getElementById("closeBtn").onclick = (e) => {
    closeUp = !closeUp;
    e.currentTarget.setAttribute("aria-pressed", closeUp);
    aimCamera(false);
  };

  // ---------- 4. Въртене и докосване ----------
  let drag = null, spinTarget = 0, spin = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (window.liraHandGrab && window.liraHandGrab(e.clientX, e.clientY)) {   // хвана ръката ѝ
      canvas.setPointerCapture(e.pointerId);
      drag = null;
      grabbingHand = true;
      return;
    }
    drag = { x: e.clientX, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    // ако е с разтворени ръце и задържиш на място 0.25 с – прегръдка; плъзнеш ли – въртене
    clearTimeout(hugTimer);
    hugTimer = setTimeout(() => {
      if (drag && drag.moved < 6 && window.liraHugGrab && window.liraHugGrab()) huggingNow = true;
    }, 250);
  });
  let hugTimer = null;
  let grabbingHand = false;
  let huggingNow = false;
  canvas.addEventListener("pointermove", (e) => {
    if (grabbingHand) { window.liraHandMove(e.clientX, e.clientY); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.x = e.clientX;
    drag.moved += Math.abs(dx);
    if (huggingNow && drag.moved > 12) { huggingNow = false; window.liraHugRelease(); }   // плъзнеш ли – въртене
    if (huggingNow) return;                    // докато я прегръщаш – не се върти
    spinTarget += dx * 0.01;
  });
  canvas.addEventListener("pointerup", (e) => {
    clearTimeout(hugTimer);
    if (huggingNow) { huggingNow = false; window.liraHugRelease(); drag = null; canvas.style.cursor = ""; return; }
    if (grabbingHand) { grabbingHand = false; window.liraHandRelease(); return; }
    if (drag && drag.moved < 6) onTouch(e.clientX); // кратко натискане = докосване
    drag = null;
    canvas.style.cursor = "";
  });

  // ---------- 4б. Режим „Поза“: мести ръцете, краката, главата и косата с мишката ----------
  // Натискаш „Поза“ и върху нея се появяват точки. Хващаш точка и я дърпаш:
  // ръката/кракът я следва (сгъва се в лакътя/коляното), а косата се отмества
  // и после се люлее обратно. „Нулирай позата“ връща всичко както беше.
  const Pose = (() => {
    const layer = document.getElementById("poseDots");
    const btn = document.getElementById("poseBtn");
    const resetBtn = document.getElementById("poseResetBtn");
    const posed = new Set();        // имената на наместените кости
    let on = false;
    let handles = [];               // { el, kind, ... }
    let grab = null;                // точката, която държиш в момента

    // Кои точки има и какво движат: chain – костите, които се въртят; end – кое следва мишката
    const LIMBS = [
      { end: "leftHand", chain: ["leftUpperArm", "leftLowerArm"] },
      { end: "rightHand", chain: ["rightUpperArm", "rightLowerArm"] },
      { end: "leftLowerArm", chain: ["leftUpperArm"] },          // лакът
      { end: "rightLowerArm", chain: ["rightUpperArm"] },
      { end: "leftFoot", chain: ["leftUpperLeg", "leftLowerLeg"] },
      { end: "rightFoot", chain: ["rightUpperLeg", "rightLowerLeg"] },
      { end: "leftLowerLeg", chain: ["leftUpperLeg"] },          // коляно
      { end: "rightLowerLeg", chain: ["rightUpperLeg"] },
      { end: "head", chain: ["chest", "neck"] },                 // глава – навежда се
    ];

    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), jp = new THREE.Vector3(), ep = new THREE.Vector3();
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), jq = new THREE.Quaternion();

    // Върти костите от chain, докато end стигне до target (метод CCD)
    function reach(chain, end, target) {
      for (let pass = 0; pass < 10; pass++) {
        for (let i = chain.length - 1; i >= 0; i--) {
          const joint = chain[i];
          joint.getWorldPosition(jp);
          end.getWorldPosition(ep);
          v1.subVectors(ep, jp);
          v2.subVectors(target, jp);
          if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) continue;
          q.setFromUnitVectors(v1.normalize(), v2.normalize());
          joint.getWorldQuaternion(jq).premultiply(q);
          joint.parent.getWorldQuaternion(pq);
          joint.quaternion.copy(pq.invert().multiply(jq));
          joint.updateMatrixWorld(true);
        }
      }
    }

    // Пружините на косата (от физиката на модела)
    function hairChains() {
      if (!vrm || !vrm.springBoneManager) return [];
      const look = LOOKS[lookIndex];
      if (look && look.mix && look.mix.hair) return [];   // пренесената коса няма физика
      const joints = [...vrm.springBoneManager.joints];
      const byBone = new Map(joints.map((j) => [j.bone, j]));
      // краищата на кичурите: стави без продължение
      const ends = joints.filter((j) => !j.bone.children.some((c) => byBone.has(c)) && /hair/i.test(j.bone.name));
      const chains = ends.map((end) => {
        const chain = [];
        for (let b = end.bone; b && byBone.has(b); b = b.parent) chain.unshift(byBone.get(b));
        return chain;
      }).filter((c) => c.length >= 2);
      return chains;                     // всички кичури – движат се заедно от една точка
    }

    function makeDot(kind) {
      const el = document.createElement("div");
      el.className = "pose-dot " + kind;
      layer.appendChild(el);
      return el;
    }

    function build() {
      layer.innerHTML = "";
      handles = [];
      if (!on || !vrm) return;
      for (const limb of LIMBS) {
        if (!bones[limb.end] || limb.chain.some((n) => !bones[limb.chain[0]] || !bones[n])) continue;
        const h = { kind: "limb", limb, el: makeDot(limb.chain.length === 1 && limb.end !== "head" ? "joint" : "limb") };
        handles.push(h);
      }
      const chains = hairChains();
      if (chains.length) handles.push({ kind: "hair", chains, el: makeDot("hair") });   // една точка за цялата коса
      for (const h of handles) {
        h.el.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          h.el.setPointerCapture(e.pointerId);
          const p = handlePosition(h, new THREE.Vector3());
          grab = { h, depth: p.project(camera).z, target: null, start: null };
          if (h.kind === "hair") {
            grab.start = h.chains.map((c) => c.map((j) => j._currentTail.clone()));
            grab.center = handlePosition(h, new THREE.Vector3());
          }
          h.el.classList.add("held");
        });
        h.el.addEventListener("pointermove", (e) => {
          if (!grab || grab.h !== h) return;
          const target = new THREE.Vector3(
            (e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, grab.depth
          ).unproject(camera);
          grab.target = target;
          if (h.kind === "limb") {
            const chain = h.limb.chain.map((n) => bones[n]);
            h.limb.chain.forEach((n) => posed.add(n));
            vrm.scene.updateMatrixWorld(true);
            reach(chain, bones[h.limb.end], target);
          }
        });
        const release = () => {
          if (grab && grab.h === h) { h.el.classList.remove("held"); grab = null; }
        };
        h.el.addEventListener("pointerup", release);
        h.el.addEventListener("pointercancel", release);
      }
    }

    function handlePosition(h, out) {
      if (h.kind === "limb") return bones[h.limb.end].getWorldPosition(out);
      // точката за косата е над главата
      bones.head.getWorldPosition(out);
      out.y += 0.2;
      return out;
    }

    // Докато държиш кичур – местим целия кичур към мишката (повече към края)
    function beforeUpdate() {
      if (!grab || grab.h.kind !== "hair" || !grab.target) return;
      // местим всички кичури еднакво – повече към краищата
      const shift = grab.target.clone().sub(grab.center);
      grab.h.chains.forEach((chain, ci) => {
        chain.forEach((joint, i) => {
          const w = (i + 1) / chain.length;
          joint._currentTail.copy(grab.start[ci][i]).addScaledVector(shift, w);
          joint._prevTail.copy(joint._currentTail);   // без засилване
        });
      });
    }

    const tmp = new THREE.Vector3();
    function drawHandles() {
      if (!on) return;
      for (const h of handles) {
        handlePosition(h, tmp).project(camera);
        const hidden = tmp.z > 1;
        h.el.style.display = hidden ? "none" : "";
        h.el.style.transform = `translate(${(tmp.x + 1) / 2 * innerWidth}px, ${(1 - tmp.y) / 2 * innerHeight}px)`;
      }
    }

    function set(value) {
      on = value;
      if (btn) btn.setAttribute("aria-pressed", on);
      if (resetBtn) resetBtn.hidden = !on;
      document.body.classList.toggle("posing", on);
      build();
    }
    if (btn) btn.onclick = () => set(!on);
    if (resetBtn) resetBtn.onclick = () => { reset(); say(["Добре, връщам се както си бях.", "calm"]); };

    function reset() {
      for (const name of posed) {
        if (bones[name]) bones[name].quaternion.identity();
      }
      posed.clear();
      if (on) build();
    }

    return { posed, reset, beforeUpdate, drawHandles, reach, get on() { return on; } };
  })();

  // ---------- 5. Модели (визии) ----------
  // Всяка визия е отделен 3D модел (.vrm) със свои истински дрехи.
  // Бутонът горе сменя между тях. Твоите модели („Друг модел“) се добавят
  // в края на списъка и се запомнят в браузъра.
  //   id    – името на файла в папка models/
  //   parts – на колко части е разделен файлът онлайн (заради лимит на размера)
  const LOOKS = [
    { id: "lira",   name: "Лира",    parts: 2, line: ["Това съм аз. Най-обикновената версия.", "calm"] },
    // mix: коса и очи от „Злато“; plain: махаме светещите сини детайли; boots: цвят на ботушите
    { id: "neon",   name: "Русокоска", parts: 2, mix: { hair: "gold", eyes: "gold" },
      plain: true, boots: [122, 74, 46],
      line: ["Дълга руса коса и без светлинки. Харесвам се така.", "shy"] },
    { id: "gold",   name: "Злато",   parts: 2, line: ["Руса за днес. Да видим дали ще ме познаеш.", "play"] },
    { id: "coffee", name: "Кафе",    parts: 3, line: ["Къса коса, топли цветове. Като сутрешно кафе.", "love"] },
    // Лира 2 – твоят модел от VRoid (възрастна). Само тя подава ръка, когато я докоснеш.
    { id: "lira2",  name: "Лира 2",  parts: 2, adult: true, neck: 0.55, line: ["Здравей. Порастнах малко, харесва ли ти?", "shy"] },
  ];

  let vrm = null;          // моделът, който се вижда сега
  let bones = {};          // костите, които движим
  let materials = [];      // за светещия ръб
  let armSign = 1;         // старите модели (VRM 0) са огледални
  let baseYaw = 0;         // и гледат назад, затова ги обръщаме
  let lookIndex = 0;
  let busy = false;
  const cache = {};        // вече заредените модели – смяната е мигновена

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const lookBtn = document.getElementById("outfitBtn");

  // Прави от байтовете готов 3D модел
  function parseModel(buffer) {
    return new Promise((ok, fail) => loader.parse(buffer, "", (gltf) => {
      const model = gltf.userData.vrm;
      if (!model) return fail(new Error("Този файл не е VRM модел."));
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      if (model.meta && model.meta.metaVersion === "0") VRMUtils.rotateVRM0(model); // старите модели гледат назад
      model.scene.traverse((obj) => { obj.frustumCulled = false; });
      ok(model);
    }, fail));
  }

  // Превръща текст (base64) в байтове
  function base64ToBuffer(text) {
    const raw = atob(text.trim());
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }

  // Взима байтовете на вградена визия:
  //  - отворена от компютъра: зарежда models/<id>.js
  //  - онлайн: тегли models/<id>.vrm, а ако го няма – models/<id>-0.txt, -1.txt ... и ги слепва
  async function fetchLook(look) {
    if (location.protocol === "file:") {
      window.LIRA_MODELS = window.LIRA_MODELS || {};
      if (!window.LIRA_MODELS[look.id]) {
        await new Promise((ok, fail) => {
          const s = document.createElement("script");
          s.src = `models/${look.id}.js`;
          s.onload = ok;
          s.onerror = () => fail(new Error(`Липсва файлът models/${look.id}.js`));
          document.body.appendChild(s);
        });
      }
      loadBar.style.width = "70%";
      const buffer = base64ToBuffer(window.LIRA_MODELS[look.id]);
      delete window.LIRA_MODELS[look.id]; // освобождаваме памет
      return buffer;
    }
    // Онлайн (например GitHub Pages): първо опитваме нормалния файл models/<id>.vrm
    try {
      const res = await fetch(`models/${look.id}.vrm`);
      if (res.ok) {
        loadBar.style.width = "60%";
        return await res.arrayBuffer();
      }
    } catch {}
    // ...после парчета models/<id>.vrm.0, .1, .2 ... (GitHub не приема много големи файлове)
    try {
      const pieces = [];
      for (let i = 0; i < 20; i++) {
        const res = await fetch(`models/${look.id}.vrm.${i}`);
        if (!res.ok) break;
        pieces.push(await res.arrayBuffer());
        loadBar.style.width = Math.min(80, 10 + i * 15) + "%";
      }
      if (pieces.length) {
        const total = pieces.reduce((n, p) => n + p.byteLength, 0);
        const all = new Uint8Array(total);
        let at = 0;
        for (const p of pieces) { all.set(new Uint8Array(p), at); at += p.byteLength; }
        return all.buffer;
      }
    } catch {}
    // Иначе (в Claude): моделът е разделен на текстови части
    let text = "";
    for (let i = 0; i < look.parts; i++) {
      const res = await fetch(`models/${look.id}-${i}.txt`);
      if (!res.ok) throw new Error("файлът с модела липсва");
      text += await res.text();
      loadBar.style.width = Math.round(((i + 1) / look.parts) * 80) + "%";
    }
    return base64ToBuffer(text);
  }

  // Показва даден модел
  function showModel(model) {
    if (vrm) scene.remove(vrm.scene);
    vrm = model;
    const old = vrm.meta && vrm.meta.metaVersion === "0";
    armSign = old ? -1 : 1;
    baseYaw = old ? Math.PI : 0;

    materials = [];
    vrm.scene.traverse((obj) => { if (obj.material) materials.push(...[].concat(obj.material)); });
    scene.add(vrm.scene);

    const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
    bones = {
      leftUpperArm: bone("leftUpperArm"), rightUpperArm: bone("rightUpperArm"),
      leftLowerArm: bone("leftLowerArm"), rightLowerArm: bone("rightLowerArm"),
      spine: bone("spine"), chest: bone("chest"), head: bone("head"), hips: bone("hips"),
      neck: bone("neck"), leftHand: bone("leftHand"), rightHand: bone("rightHand"),
      leftUpperLeg: bone("leftUpperLeg"), rightUpperLeg: bone("rightUpperLeg"),
      leftLowerLeg: bone("leftLowerLeg"), rightLowerLeg: bone("rightLowerLeg"),
      leftFoot: bone("leftFoot"), rightFoot: bone("rightFoot"),
    };
    Pose.reset();          // новата визия започва в обикновена поза
    hipsBaseY = bones.hips ? bones.hips.position.y : 0;   // височината на ханша, когато стои

    // Очите ѝ следят камерата (тоест теб)
    if (vrm.lookAt) { vrm.lookAt.target = camera; vrm.lookAt.autoUpdate = true; }

    // Кратко „прекъсване“ на холограмата при смяната
    canvas.classList.add("glitch");
    setTimeout(() => canvas.classList.remove("glitch"), 160);
  }

  // Сменя на визия номер index
  async function switchLook(index, speak) {
    if (busy) return;
    busy = true;
    lookIndex = index;
    const look = LOOKS[index];
    lookBtn.textContent = "Визия: " + look.name;
    const ob = document.getElementById("offerBtn");
    if (ob) ob.hidden = !look.adult;
    if (!look.adult && typeof setHug === "function") { try { setHug(false); } catch {} }
    try { localStorage.setItem("lira:look", look.id); } catch {}

    try {
      if (!cache[look.id]) {
        loadBox.hidden = false;
        loadText.className = "";
        loadText.textContent = `Проекцията се зарежда… (${look.name})`;
        loadBar.parentElement.hidden = false;
        loadBar.style.width = "5%";
        const buffer = look.buffer || await fetchLook(look);
        const model = await parseModel(buffer);
        delete look.buffer;
        if (look.mix) {
          loadText.textContent = `Сглобявам визията… (${look.name})`;
          const donors = {};
          for (const id of new Set(Object.values(look.mix))) {
            donors[id] = await parseModel(await fetchLook(LOOKS.find((l) => l.id === id)));
          }
          if (look.mix.body) transplantBody(model, donors[look.mix.body]);
          if (look.mix.eyes) swapEyes(model, donors[look.mix.eyes]);  // еднакви очи, лице без линии
          if (look.mix.hair) {
            transplantHair(model, donors[look.mix.hair]);
            swapMaterial(model, donors[look.mix.hair], /HairBack/);
          }
        }
        if (look.plain || look.boots) {
          // Частите на тялото на VRoid модел са в този ред:
          // кожа ×4, дрехи (Tops), обувки (Shoes), основа на косата.
          // (Ръкавиците и чорапите са нарисувани върху кожата – тях оставяме тюркоазени.)
          const body = groupMeshes(model, "Body").filter((m) => m.visible);
          body.forEach((mesh, i) => {
            if (i === 4) plainMaterial(mesh, look.plain, null);        // дрехите
            if (i === 5) plainMaterial(mesh, true, look.boots || null); // ботушите
          });
        }
        // neck: колко дълга да е шията (1 = както е, 0.5 = наполовина)
        if (look.neck) {
          for (const node of [model.humanoid.getRawBoneNode("head"), model.humanoid.getNormalizedBoneNode("head")]) {
            if (node) node.position.multiplyScalar(look.neck);
          }
        }
        cache[look.id] = model;
      }
      showModel(cache[look.id]);
      loadBox.hidden = true;
      if (speak) { say(look.line); scheduleNext(); }
    } catch (err) {
      console.error(err);
      showError(`„${look.name}“ не се зареди. ${err.message || ""}`);
    }
    busy = false;
  }

  lookBtn.onclick = () => switchLook((lookIndex + 1) % LOOKS.length, true);

  const materialName = (o) => (o.material && o.material.name) || "";
  function findMeshes(model, pattern) {
    const found = [];
    model.scene.traverse((o) => { if (o.isMesh && pattern.test(materialName(o))) found.push(o); });
    return found;
  }

  // Частите от една група („Body“ – тяло и дрехи, „Face“ – лице и очи), в реда им в модела.
  // (Някои части нямат име на материала, затова ги търсим по групата.)
  function groupMeshes(model, group) {
    const found = [];
    model.scene.traverse((o) => {
      if (o.isMesh && new RegExp(group).test((o.parent && o.parent.name) + " " + o.name)) found.push(o);
    });
    return found;
  }

  // Еднакви очи и изчистено лице: взимаме ирисите, кожата, очната линия, миглите и веждите от donor
  function swapEyes(model, donor) {
    const mine = groupMeshes(model, "Face");
    const theirs = groupMeshes(donor, "Face");
    mine.forEach((mesh, i) => {
      const src = theirs[i];
      if (!src) return;
      const name = materialName(src);
      // ириси, кожа на лицето, очна линия, мигли и вежди – всичко обикновено, без цветни линии
      if (name === "" || /EyeIris|EyeExtra|Eyeline|Eyelash|FaceBrow/.test(name)) mesh.material = src.material;
    });
  }

  // Слага тялото и дрехите на donor върху скелета на model (главата остава на model).
  // Двата модела са от VRoid и костите им се казват еднакво, затова може.
  function transplantBody(model, donor) {
    for (const mesh of groupMeshes(model, "Body")) mesh.visible = false;

    const bonesByName = {};
    model.scene.traverse((o) => { if (o.isBone) bonesByName[o.name] = o; });
    donor.scene.updateMatrixWorld(true);
    model.scene.updateMatrixWorld(true);
    const toDonorScene = new THREE.Matrix4().copy(donor.scene.matrixWorld).invert();

    for (const src of groupMeshes(donor, "Body")) {
      if (!src.isSkinnedMesh) continue;
      // Всяка кост на donor -> костта със същото име при model (или най-близкия ѝ родител)
      const bones = src.skeleton.bones.map((bone) => {
        let b = bone;
        while (b && !bonesByName[b.name]) b = b.parent;
        return b ? bonesByName[b.name] : bonesByName["J_Bip_C_Hips"];
      });
      const mesh = new THREE.SkinnedMesh(src.geometry, src.material);
      mesh.frustumCulled = false;
      mesh.renderOrder = src.renderOrder;
      new THREE.Matrix4().multiplyMatrices(toDonorScene, src.matrixWorld)
        .decompose(mesh.position, mesh.quaternion, mesh.scale);
      model.scene.add(mesh);
      mesh.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses.map((m) => m.clone())), src.bindMatrix.clone());
    }
  }

  // Махаме „футуристичното“ от една част: без светене, а ярките сини/циан
  // места в текстурата стават тъмен плат. color: ако е дадено, цялата част
  // се оцветява в този цвят (запазва се сянката).
  function plainMaterial(mesh, removeGlow, color) {
    // Някои части имат два материала (основен и контур) – обработваме всеки
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((mat) => plainOne(mat, removeGlow, color));
    } else {
      mesh.material = plainOne(mesh.material, removeGlow, color);
    }
  }

  function plainOne(original, removeGlow, color) {
    const m = original.clone ? original.clone() : original;
    if (removeGlow) {
      if (m.emissive) m.emissive.setRGB(0, 0, 0);
      if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
      m.emissiveMap = null;
    }
    for (const key of ["map", "shadeMultiplyTexture"]) {
      const tex = m[key];
      if (!tex || !tex.image) continue;
      const img = tex.image;
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx2 = canvas.getContext("2d");
      ctx2.drawImage(img, 0, 0);
      const data = ctx2.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const light = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        if (color) {
          const k = 0.35 + light * 1.1;
          px[i] = Math.min(255, color[0] * k); px[i + 1] = Math.min(255, color[1] * k); px[i + 2] = Math.min(255, color[2] * k);
        } else if (removeGlow && max > 90 && (max - min) / max > 0.35 && b >= r && g > r) {
          // ярко синьо/циан -> тъмен син плат
          px[i] = 34 + light * 30; px[i + 1] = 36 + light * 30; px[i + 2] = 52 + light * 40;
        }
      }
      ctx2.putImageData(data, 0, 0);
      const out = tex.clone();
      out.image = canvas;
      out.needsUpdate = true;
      m[key] = out;
    }
    m.needsUpdate = true;
    return m;
  }

  // Слага материала (цвят/текстура) на donor върху съответната част на model
  function swapMaterial(model, donor, pattern) {
    const source = findMeshes(donor, pattern);
    for (const mesh of findMeshes(model, pattern)) {
      const same = source.find((s) => materialName(s) === materialName(mesh)) || source[0];
      if (same) mesh.material = same.material;
    }
  }

  // Слага косата на donor върху model.
  // Косата на donor се „замразява“ в покой и се закача за главата на model,
  // а собствената коса на model се скрива. (Косата така не се люлее.)
  function transplantHair(model, donor) {
    const isHair = (o) => o.isMesh && /Hair_00_HAIR/.test(o.material && o.material.name);
    const isHairBack = (o) => o.isMesh && /HairBack/.test(o.material && o.material.name);
    model.scene.updateMatrixWorld(true);
    donor.scene.updateMatrixWorld(true);

    // Скриваме старата коса; основата под косата взима цвета на новата
    let donorBack = null;
    donor.scene.traverse((o) => { if (isHairBack(o)) donorBack = o.material; });
    model.scene.traverse((o) => {
      if (isHair(o)) o.visible = false;
      if (isHairBack(o) && donorBack) o.material = donorBack;
    });

    // Колко да преместим косата, за да легне на новата глава
    const head = model.humanoid.getRawBoneNode("head");
    const shift = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld)
      .sub(new THREE.Vector3().setFromMatrixPosition(donor.humanoid.getRawBoneNode("head").matrixWorld));

    const parts = [];
    donor.scene.traverse((o) => { if (isHair(o)) parts.push(o); });
    const v = new THREE.Vector3();
    for (const src of parts) {
      const geo = src.geometry;
      const count = geo.attributes.position.count;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        src.getVertexPosition(i, v);              // точката в покой
        v.applyMatrix4(src.matrixWorld).add(shift);
        positions.set([v.x, v.y, v.z], i * 3);
      }
      const hair = new THREE.BufferGeometry();
      hair.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      if (geo.attributes.uv) hair.setAttribute("uv", geo.attributes.uv);
      if (geo.index) hair.setIndex(geo.index);
      if (geo.attributes.normal) {
        const normals = geo.attributes.normal.clone();
        normals.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(src.matrixWorld));
        hair.setAttribute("normal", normals);
      } else {
        hair.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(hair, src.material);
      mesh.frustumCulled = false;
      mesh.renderOrder = src.renderOrder;
      mesh.updateMatrixWorld();
      head.attach(mesh);                          // движи се заедно с главата
    }
  }

  // ---------- 5б. Твоите модели ----------
  // Пазим ги в браузъра (IndexedDB), за да са там и следващия път.
  const store = {
    open() {
      return new Promise((ok, fail) => {
        const req = indexedDB.open("lira", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("models", { keyPath: "id" });
        req.onsuccess = () => ok(req.result);
        req.onerror = () => fail(req.error);
      });
    },
    async all() {
      const db = await this.open();
      return new Promise((ok) => {
        const req = db.transaction("models").objectStore("models").getAll();
        req.onsuccess = () => ok(req.result || []);
        req.onerror = () => ok([]);
      });
    },
    async save(item) {
      const db = await this.open();
      db.transaction("models", "readwrite").objectStore("models").put(item);
    },
  };

  function addUserLook(item) {
    LOOKS.push({
      id: item.id, name: item.name, buffer: item.data,
      line: ["Харесва ли ти новият ми вид?", "shy"],
    });
  }

  document.getElementById("fileIn").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const item = {
      id: "user-" + Date.now(),
      name: file.name.replace(/\.(vrm|glb)$/i, "").slice(0, 16),
      data: await file.arrayBuffer(),
    };
    try { await store.save({ ...item, data: item.data.slice(0) }); } catch {} // ако не стане – само за тази сесия
    addUserLook(item);
    switchLook(LOOKS.length - 1, true);
  };

  // ---------- Старт ----------
  (async () => {
    try { (await store.all()).forEach(addUserLook); } catch {}
    let start = 0;
    try {
      const saved = localStorage.getItem("lira:look");
      const i = LOOKS.findIndex((l) => l.id === saved);
      if (i >= 0) start = i;
    } catch {}
    await switchLook(start, false);
    setTimeout(() => { say(helloForNow()); scheduleNext(); }, 900);
  })();

  // ---------- 5в. Подава ти ръка (само за визии с adult: true) ----------
  // Докосваш я -> протяга дясната ръка към теб, свива пръсти и се усмихва.
  // Докосваш я пак -> прибира ръката.
  let offerOn = false, offerW = 0, offerSince = 0, bodyYaw = 0;
  // ---------- Прегръдка (само за визии с adult: true) ----------
  // Бутон „Прегръдка“ -> разтваря ръце към теб. Натиснеш и задържиш върху нея ->
  // затваря очи и леко притиска ръце. Пак „Прегръдка“ -> отпуска ръцете.
  let hugOn = false, hugW = 0, hugHold = false, hugHoldW = 0;
  const hugBtn = document.getElementById("hugBtn");
  function setHug(on) {
    hugOn = on;
    if (hugBtn) hugBtn.setAttribute("aria-pressed", on);
    if (on) {
      offerOn = false; holding = false;
      if (typeof setSit === "function" && sitOn) setSit(false);
      if (danceOn) { danceOn = false; document.getElementById("danceBtn")?.setAttribute("aria-pressed", false); }
      say(pick(typeof HUG_LINES !== "undefined" ? HUG_LINES : [["Ела тук.", "love"]]));
      scheduleNext();
    }
  }
  if (hugBtn) hugBtn.onclick = () => {
    const look = LOOKS[lookIndex];
    if (look && look.adult) setHug(!hugOn);
  };
  window.liraHugGrab = () => {          // натискане върху нея, докато е с разтворени ръце
    if (!hugOn || hugW < 0.6) return false;
    hugHold = true;
    say(pick(typeof HUG_HOLD_LINES !== "undefined" ? HUG_HOLD_LINES : [["Хубаво е така.", "love"]]));
    scheduleNext();
    return true;
  };
  window.liraHugRelease = () => { hugHold = false; };
  const hugT = new THREE.Vector3(), hugS = new THREE.Vector3(), hugF = new THREE.Vector3(), hugL = new THREE.Vector3(), hugH = new THREE.Vector3();

  let offerSide = "right";   // коя ръка подава
  // Щракване върху нея (за визии с adult: true):
  //  - ако подава ръка -> прибира я
  //  - иначе -> разтваря ръце за прегръдка / отпуска ги
  window.liraOffer = (clickX) => {
    const look = LOOKS[lookIndex];
    if (!look || !look.adult || !vrm) return false;     // другите визии просто казват нещо
    if (offerOn) { setOffer(null); return true; }
    setHug(!hugOn);
    return true;
  };

  // Подаване на ръка – от менюто: бутонът минава през „дясна“ -> „лява“ -> изключено
  const offerBtn = document.getElementById("offerBtn");
  function setOffer(side) {
    const was = offerOn;
    offerOn = !!side;
    if (side) offerSide = side;
    offerSince = performance.now();
    if (offerBtn) {
      offerBtn.setAttribute("aria-pressed", offerOn);
      offerBtn.textContent = offerOn ? (offerSide === "right" ? "Подай ръка: дясна" : "Подай ръка: лява") : "Подай ръка";
    }
    if (offerOn) {
      if (hugOn) setHug(false);
      if (!was) say(pick(typeof OFFER_LINES !== "undefined" ? OFFER_LINES : [["Дай ми ръка.", "love"]]));
    } else if (was) {
      say(["Добре, пускам те. Но само за малко.", "shy"]);
    }
    scheduleNext();
  }
  if (offerBtn) offerBtn.onclick = () => {
    const look = LOOKS[lookIndex];
    if (!look || !look.adult) return;
    if (!offerOn) setOffer("right");
    else if (offerSide === "right") setOffer("left");
    else setOffer(null);
  };
  const offerTarget = new THREE.Vector3(), handNow = new THREE.Vector3(), chestPos = new THREE.Vector3(), toCam = new THREE.Vector3();
  // Хващане: натискаш върху ръката ѝ, докато ти я подава
  let holding = false, holdOffset = null;
  const handScreen = { x: -999, y: -999, z: 0 }, handWorld = new THREE.Vector3();
  window.liraHandGrab = (x, y) => {           // вика се при натискане; true = хвана ръката
    if (!offerOn || offerW < 0.6) return false;
    if (Math.hypot(x - handScreen.x, y - handScreen.y) > 55) return false;
    holding = true;
    holdOffset = new THREE.Vector3();
    say(pick(typeof HOLD_LINES !== "undefined" ? HOLD_LINES : [["Хубаво е така.", "love"]]));
    scheduleNext();
    return true;
  };
  window.liraHandMove = (x, y) => {
    if (!holding) return;
    const p = new THREE.Vector3((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, handScreen.z).unproject(camera);
    holdOffset = p.sub(handWorld).add(holdOffset || new THREE.Vector3());
    if (holdOffset.length() > 0.15) holdOffset.setLength(0.15);
  };
  window.liraHandRelease = () => { holding = false; holdOffset = null; };
  window.liraHandPos = () => ({ x: handScreen.x, y: handScreen.y });   // къде е ръката ѝ на екрана

    // ---------- 6. Анимация ----------
  const clock = new THREE.Clock();
  const glow = new THREE.Color(...COLORS.calm);
  const glowTarget = new THREE.Color();
  const lerp = (a, b, k) => a + (b - a) * k;

  // Изражения на лицето за всяко настроение (от 0 до 1)
  const FACE = {
    calm:  { relaxed: 0.35 },
    love:  { happy: 0.55 },
    shy:   { relaxed: 0.5 },
    play:  { happy: 0.85 },
    dream: { relaxed: 0.75 },
    sad:   { sad: 0.65 },
  };
  // Наклон на главата при всяко настроение
  const HEAD_TILT = { shy: 0.14, sad: 0.08, dream: -0.1, love: 0.07 };

  const face = { happy: 0, relaxed: 0, sad: 0, surprised: 0, angry: 0 };
  let nextBlink = 2, blinkStart = -1, nextGlitch = 5;
  let lean = 0;          // колко се е навела (0–1)
  let crossW = 0;        // колко са скръстени ръцете (0–1)
  const crossHands = {};
  const HAND_WRAP = 0;   // колко се сгъват китките при скръстени ръце
  const crossC = new THREE.Vector3(), crossF = new THREE.Vector3(), crossL = new THREE.Vector3(), crossH = new THREE.Vector3(), crossT = new THREE.Vector3();
  let sit = 0;           // колко е седнала (0 = стои, 1 = седи)
  let hipsBaseY = 0;

  // Бутон „Разходка“ – тя върви на балкона, градът минава покрай вас
  let walkOn = false, walkW = 0, walkPhase = 0;
  const walkBtn = document.getElementById("walkBtn");
  if (walkBtn) walkBtn.onclick = () => {
    walkOn = !walkOn;
    walkBtn.setAttribute("aria-pressed", walkOn);
    if (walkOn) {
      if (sitOn) setSit(false);
      if (danceOn) { danceOn = false; document.getElementById("danceBtn")?.setAttribute("aria-pressed", false); }
      if (typeof setHug === "function" && hugOn) setHug(false);
      if (typeof setView === "function" && !(Balcony && Balcony.on)) setView("balcony");
      say(pick(typeof WALK_LINES !== "undefined" ? WALK_LINES : [["Хайде да се поразходим.", "dream"]]));
      scheduleNext();
    }
  };

  // Бутон „Танц“ – весел танц: ръце горе, стъпки встрани, завъртане и пляскане
  let danceOn = false, danceW = 0, danceTime = 0;
  const danceBtn = document.getElementById("danceBtn");
  if (danceBtn) danceBtn.onclick = () => {
    danceOn = !danceOn;
    danceBtn.setAttribute("aria-pressed", danceOn);
    if (danceOn) {
      setSit(false);                       // за танц трябва да стане
      danceTime = 0;
      say(["Пусни си музика наум. Аз танцувам!", "play"]);
      scheduleNext();
    }
  };

  // Бутон „Седни“ – тя сяда на стол (столът се вижда в изглед „Стая“); запомня се
  let sitOn = false;
  try { sitOn = localStorage.getItem("lira:sit") === "1"; } catch {}
  const sitBtn = document.getElementById("sitBtn");
  function setSit(on) {
    sitOn = on;
    if (on && typeof danceOn !== "undefined" && danceOn) {   // ако седне – танцът спира
      danceOn = false;
      document.getElementById("danceBtn")?.setAttribute("aria-pressed", false);
    }
    if (sitBtn) sitBtn.setAttribute("aria-pressed", on);
    if (Room && Room.setChair) Room.setChair(on);
    try { localStorage.setItem("lira:sit", on ? "1" : "0"); } catch {}
  }
  if (sitBtn) sitBtn.onclick = () => setSit(!sitOn);
  setSit(sitOn);

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime * (reduceMotion ? 0.4 : 1);

    drawCity(t);

    // Плавно движение на камерата
    camPos.lerp(wantPos, 0.06);
    camLook.lerp(wantLook, 0.06);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // Цветът на сиянието плавно отива към цвета на настроението
    glowTarget.setRGB(...lira.glowColor);
    glow.lerp(glowTarget, 0.03);
    ringMaterial.color.copy(glow);
    beamMaterial.uniforms.color.value.copy(glow);

    // Проекторът се върти, искриците се издигат
    rings[0].rotation.z = t * 0.3;
    rings[1].rotation.z = -t * 0.5;
    const p = sparkGeometry.attributes.position.array;
    for (let i = 0; i < SPARKS; i++) {
      p[i * 3 + 1] += sparkSpeeds[i] * dt * 0.35;
      if (p[i * 3 + 1] > 1.9) p[i * 3 + 1] = 0;
    }
    sparkGeometry.attributes.position.needsUpdate = true;

    // От време на време холограмата „прекъсва“
    if (!reduceMotion && t > nextGlitch) {
      canvas.classList.add("glitch");
      setTimeout(() => canvas.classList.remove("glitch"), 90);
      nextGlitch = t + 6 + Math.random() * 8;
    }

    if (vrm) {
      // Въртене – само когато потребителят я върти; остава така, както я оставиш
      spin += (spinTarget - spin) * 0.08;
      // Танц: колко е включен (плавно) и къде сме в танца
      danceW = lerp(danceW, danceOn ? 1 : 0, 0.05);
      if (danceOn) danceTime += dt;
      const beats = danceTime * 2;                    // 120 удара в минута
      const move = Math.floor(beats / 8) % 4;          // всяко движение трае 8 удара
      const inMove = (beats % 8) / 8;                  // 0–1 в текущото движение
      const pulse = Math.sin(beats * Math.PI);         // люлеене в ритъм
      const spinTurn = move === 2 ? (1 - Math.cos(inMove * Math.PI)) * Math.PI : 0;  // плавно пълно завъртане

      // Когато ти подава ръка, се обръща с лице към теб (после се връща, накъдето си я завъртял)
      const faceYou = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;   // най-близкото „с лице към теб“
      const offerEase = offerW * offerW * (3 - 2 * offerW);
      bodyYaw = spin + (faceYou - spin) * offerEase;
      vrm.scene.rotation.y = baseYaw + bodyYaw + spinTurn * danceW;
      if (Room && Room.chairYaw) Room.chairYaw(bodyYaw);
      // ако не я хванеш до 20 секунди – сама си прибира ръката
      if (holding) offerSince = performance.now();       // докато я държиш – не прибира ръката
      if (offerOn && performance.now() - offerSince > 20000) setOffer(null);   // сама я прибира след 20 с

      const B = bones;
      // Ръцете надолу (моделът по начало е с разперени ръце)
      // (костите, които си наместил с мишката в режим „Поза“, не се пипат)
      const free = (name) => B[name] && !Pose.posed.has(name);
      const breathe = Math.sin(t * 1.2) * 0.02;
      // Спокойна поза: ръцете надолу, леко напред (пред полата), лактите меко сгънати напред.
      // (при „напред“ знакът зависи от типа модел – armSign; при лакътя е еднакъв за всички)
      const armFwd = -armSign * 0.08;
      if (free("leftUpperArm")) B.leftUpperArm.rotation.set(armFwd, 0, armSign * (-1.27 + breathe));
      if (free("rightUpperArm")) B.rightUpperArm.rotation.set(armFwd, 0, armSign * (1.27 - breathe));
      if (free("leftLowerArm")) B.leftLowerArm.rotation.set(0, -armSign * 0.3, 0);
      if (free("rightLowerArm")) B.rightLowerArm.rotation.set(0, armSign * 0.3, 0);
      // Скръстени ръце пред гърдите (в покой). Ръката, която ти подава, се изключва.
      crossW = lerp(crossW, danceOn || sitOn || offerOn || hugOn || walkOn ? 0 : 1, 0.08);   // докато подава ръка – другата се отпуска надолу
      if (crossW > 0.01 && B.chest && B.leftHand && B.rightHand) {
        const crossEase = crossW * crossW * (3 - 2 * crossW);
        vrm.scene.updateMatrixWorld(true);
        B.chest.getWorldPosition(crossC);
        crossF.set(Math.sin(bodyYaw), 0, Math.cos(bodyYaw));        // напред
        crossL.set(Math.cos(bodyYaw), 0, -Math.sin(bodyYaw));       // нейното ляво
        // Като човек със скръстени ръце: лакътят виси до тялото, предмишницата
        // минава хоризонтално пред корема към другата ръка. Лявата е отгоре.
        const arms = [
          { side: "left", upper: B.leftUpperArm, lower: B.leftLowerArm, hand: B.leftHand, s: 1, fwd: 0.12, up: 0.04, wrap: 1 },
          { side: "right", upper: B.rightUpperArm, lower: B.rightLowerArm, hand: B.rightHand, s: -1, fwd: 0.05, up: -0.05, wrap: -1 },
        ];
        for (const a of arms) {
          if (a.side === offerSide && offerW > 0.01) continue;
          if (Pose.posed.has(a.side + "UpperArm") || Pose.posed.has(a.side + "LowerArm")) continue;
          a.upper.getWorldPosition(crossC);                       // рамото
          a.lower.getWorldPosition(crossH);
          const upperLen = crossC.distanceTo(crossH);
          // 1) лакътят: надолу, малко напред и леко навън
          crossT.copy(crossC).addScaledVector(crossL, a.s * 0.02).addScaledVector(crossF, a.side === "left" ? 0.2 : 0.17);
          crossT.y -= upperLen;
          a.lower.getWorldPosition(crossH);
          crossT.lerpVectors(crossH, crossT, crossEase);
          Pose.reach([a.upper], a.lower, crossT);
          // 2) предмишницата: хоризонтално към другата страна и напред
          a.lower.getWorldPosition(crossC);                       // лакътят
          a.hand.getWorldPosition(crossH);
          const foreLen = crossC.distanceTo(crossH);
          crossT.set(0, 0, 0).addScaledVector(crossL, -a.s).addScaledVector(crossF, a.fwd);
          crossT.y = a.up;
          crossT.normalize().multiplyScalar(foreLen).add(crossC);
          crossT.lerpVectors(crossH, crossT, crossEase);
          Pose.reach([a.lower], a.hand, crossT);
          // китката се сгъва към тялото – дланта обхваща другата ръка
          a.hand.rotation.set(0, a.wrap * HAND_WRAP * crossEase, 0);
          crossHands[a.side] = true;
        }
      }

      // отпуснати, леко свити пръсти (освен на ръката, която ти подава);
      // при скръстени ръце – свити повече, хващат другата ръка
      for (const side of ["left", "right"]) {
        if (side === offerSide && offerW > 0.01) continue;
        const curl = (side === "left" ? -armSign : armSign) * (0.22 + 0.5 * crossW) * (1 - 0.85 * hugW);   // при прегръдка – отворени длани
        for (const f of ["Index", "Middle", "Ring", "Little"]) {
          for (const part of ["Proximal", "Intermediate", "Distal"]) {
            const bone = vrm.humanoid.getNormalizedBoneNode(side + f + part);
            if (bone && !Pose.posed.has(side + f + part)) bone.rotation.z = curl;
          }
        }
      }
      // Сядане: бедрата напред, подбедриците надолу (плавно)
      sit = lerp(sit, sitOn ? 1 : 0, 0.06);
      const thigh = -armSign * 1.45 * sit, knee = armSign * 1.45 * sit;
      if (free("leftUpperLeg")) B.leftUpperLeg.rotation.set(thigh, 0, armSign * 0.06 * sit);
      if (free("rightUpperLeg")) B.rightUpperLeg.rotation.set(thigh, 0, -armSign * 0.06 * sit);
      if (free("leftLowerLeg")) B.leftLowerLeg.rotation.set(knee, 0, 0);
      if (free("rightLowerLeg")) B.rightLowerLeg.rotation.set(knee, 0, 0);

      // Танцът се смесва върху обикновената поза (w = колко е включен)
      if (danceW > 0.01) {
        const w = danceW;
        const mix = (name, x, y, z) => {
          if (!free(name)) return;
          const r = B[name].rotation;
          r.set(r.x + (x - r.x) * w, r.y + (y - r.y) * w, r.z + (z - r.z) * w);
        };
        const fwd = -armSign;                          // „напред“ за ръцете (старите модели са огледални)
        if (move === 0) {                              // 1) ръце горе, махат наляво-надясно
          mix("leftUpperArm", 0, 0, armSign * (1.05 + pulse * 0.25));
          mix("rightUpperArm", 0, 0, armSign * (-1.05 + pulse * 0.25));
          mix("leftLowerArm", 0, 0, armSign * 0.35);
          mix("rightLowerArm", 0, 0, armSign * -0.35);
        } else if (move === 1) {                       // 2) стъпки встрани, ръцете се люлеят напред-назад
          mix("leftUpperArm", fwd * pulse * 0.5, 0, armSign * -1.2);
          mix("rightUpperArm", -fwd * pulse * 0.5, 0, armSign * 1.2);
          mix("leftUpperLeg", 0, 0, armSign * Math.max(0, pulse) * 0.18);
          mix("rightUpperLeg", 0, 0, armSign * Math.min(0, pulse) * 0.18);
        } else if (move === 2) {                       // 3) завъртане с разперени ръце
          mix("leftUpperArm", 0, 0, armSign * -0.35);
          mix("rightUpperArm", 0, 0, armSign * 0.35);
          mix("leftLowerArm", 0, 0, 0);
          mix("rightLowerArm", 0, 0, 0);
        } else {                                       // 4) пляскане пред себе си
          const clap = 0.5 + 0.5 * Math.sin(beats * Math.PI * 2);
          mix("leftUpperArm", fwd * 1.1, 0, armSign * (-0.75 - clap * 0.15));
          mix("rightUpperArm", fwd * 1.1, 0, armSign * (0.75 + clap * 0.15));
          mix("leftLowerArm", 0, armSign * (-0.6 - clap * 0.4), 0);
          mix("rightLowerArm", 0, armSign * (0.6 + clap * 0.4), 0);
        }
        // главата кима в ритъм
        if (free("head")) B.head.rotation.z += Math.sin(beats * Math.PI + 0.5) * 0.07 * w;
      }

      // Ходене: краката крачат, ръцете се люлеят обратно на краката, леко подскачане
      walkW = lerp(walkW, walkOn ? 1 : 0, 1 - Math.pow(0.05, dt));
      if (walkW > 0.01) {
        walkPhase += dt * 5.2;                              // около 1.6 крачки в секунда
        const w = walkW, sw = Math.sin(walkPhase);
        const legF = -armSign;                              // „напред“ за краката (зависи от типа модел)
        const setLeg = (side, ph) => {
          const up = B[side + "UpperLeg"], lo = B[side + "LowerLeg"];
          if (!up || !lo || !free(side + "UpperLeg") || !free(side + "LowerLeg")) return;
          up.rotation.x = legF * Math.sin(ph) * 0.42 * w;   // бедрото напред-назад
          lo.rotation.x = Math.max(0, -Math.cos(ph)) * 0.75 * w;  // коляното се сгъва назад, когато кракът е отзад (еднакво за всички модели)
        };
        setLeg("left", walkPhase);
        setLeg("right", walkPhase + Math.PI);
        // ръцете – обратно на краката
        const armSwing = (side, ph) => {
          const up = B[side + "UpperArm"];
          if (!up || !free(side + "UpperArm") || (side === offerSide && offerW > 0.01)) return;
          up.rotation.x += -legF * Math.sin(ph) * 0.3 * w;
        };
        armSwing("left", walkPhase + Math.PI);
        armSwing("right", walkPhase);
        if (Balcony && Balcony.on) Balcony.walk(1.1 * w, dt);   // градът минава покрай нея
      }

      // Подава ръка: дясната ръка отива към теб, пръстите се свиват
      const look = LOOKS[lookIndex];
      if (!look || !look.adult) offerOn = false;
      offerW = lerp(offerW, offerOn ? 1 : 0, 1 - Math.pow(0.03, dt));   // около секунда до края, независимо от кадрите
      const OS = offerSide, m = OS === "right" ? 1 : -1;      // m: огледално за лявата ръка
      const oUpper = B[OS + "UpperArm"], oLower = B[OS + "LowerArm"], oHand = B[OS + "Hand"];
      if (offerW > 0.01 && oHand && free(OS + "UpperArm") && free(OS + "LowerArm")) {
        const ease = offerW * offerW * (3 - 2 * offerW);
        // 1) лакътят леко сгънат напред (фиксирано), за да не се извива назад/навътре
        oLower.rotation.set(0, m * 0.45 * ease, 0);
        vrm.scene.updateMatrixWorld(true);
        // 2) точка пред нея (накъдето гледа тялото ѝ): от рамото – напред и надолу
        oUpper.getWorldPosition(chestPos);
        toCam.set(Math.sin(bodyYaw), 0, Math.cos(bodyYaw));
        offerTarget.copy(chestPos).addScaledVector(toCam, 0.4);
        offerTarget.y -= 0.25;
        // ако я държиш – ръката ѝ леко следва твоята (най-много 15 см)
        if (holding && holdOffset) offerTarget.add(holdOffset);
        oHand.getWorldPosition(handNow);
        offerTarget.lerpVectors(handNow, offerTarget, ease);
        // 3) въртим само рамото, така че ръката да сочи към точката
        Pose.reach([oUpper], oHand, offerTarget);
        // къде е ръката ѝ на екрана (за да можеш да я хванеш)
        oHand.getWorldPosition(handNow);
        handWorld.copy(handNow);
        const sp = handNow.clone().project(camera);
        handScreen.x = (sp.x + 1) / 2 * innerWidth;
        handScreen.y = (1 - sp.y) / 2 * innerHeight;
        handScreen.z = sp.z;
        // китката – дланта настрани, като за хващане
        oHand.rotation.set(armSign * -1.2 * ease, 0, 0);
        // пръстите леко свити
        for (const f of ["Index", "Middle", "Ring", "Little"]) {
          for (const part of ["Proximal", "Intermediate", "Distal"]) {
            const bone = vrm.humanoid.getNormalizedBoneNode(OS + f + part);
            if (bone) bone.rotation.z = m * armSign * (holding ? 0.95 : 0.45) * ease;   // стиска, когато я държиш
          }
        }
        const thumb = vrm.humanoid.getNormalizedBoneNode(OS + "ThumbDistal");
        if (thumb) thumb.rotation.y = m * armSign * -0.4 * ease;
      }
      // Прегръдка: двете ръце напред и встрани; при задържане – притискат се към средата
      if (!look || !look.adult) { hugOn = false; hugHold = false; }
      hugW = lerp(hugW, hugOn ? 1 : 0, 1 - Math.pow(0.03, dt));
      hugHoldW = lerp(hugHoldW, hugHold ? 1 : 0, 1 - Math.pow(0.05, dt));
      if (hugW > 0.01) {
        const e = hugW * hugW * (3 - 2 * hugW);
        hugF.set(Math.sin(bodyYaw), 0, Math.cos(bodyYaw));
        hugL.set(Math.cos(bodyYaw), 0, -Math.sin(bodyYaw));
        for (const [side, sgn, mm] of [["left", 1, -1], ["right", -1, 1]]) {
          const up = B[side + "UpperArm"], lo = B[side + "LowerArm"], hd = B[side + "Hand"];
          if (!up || !lo || !hd || !free(side + "UpperArm") || !free(side + "LowerArm")) continue;
          lo.rotation.set(0, mm * (0.5 + 0.6 * hugHoldW) * e, 0);        // лактите сгънати напред
          vrm.scene.updateMatrixWorld(true);
          up.getWorldPosition(hugS);
          hugT.copy(hugS)
            .addScaledVector(hugF, 0.32 + 0.04 * hugHoldW)
            .addScaledVector(hugL, sgn * (0.22 - 0.24 * hugHoldW));    // разтворени -> към средата
          hugT.y -= 0.08 + 0.04 * hugHoldW;
          hd.getWorldPosition(hugH);
          hugT.lerpVectors(hugH, hugT, e);
          Pose.reach([up], hd, hugT);
          hd.rotation.set(armSign * -0.3 * e, 0, 0);                     // дланите леко навътре
        }
      }

      // Дишане (+ на балкона се навежда към теб)
      lean = lerp(lean, Balcony && Balcony.on ? 1 : 0, 0.03);
      if (free("spine")) B.spine.rotation.x = Math.sin(t * 1.5) * 0.012 + armSign * lean * 0.12;
      if (free("chest")) B.chest.rotation.x = Math.sin(t * 1.5 + 0.6) * 0.015 + armSign * lean * 0.1;
      // Полюшване в ханша
      if (B.hips) {
        B.hips.rotation.z = Math.sin(t * 0.45) * 0.025;
        B.hips.position.x = Math.sin(t * 0.45) * 0.01;
        B.hips.position.y = hipsBaseY - 0.43 * sit;      // при сядане ханшът слиза до седалката
        if (walkW > 0.01) B.hips.position.y += Math.abs(Math.cos(walkPhase)) * 0.018 * walkW;   // подскача при всяка крачка
        if (danceW > 0.01) {                              // подскачане и стъпки при танц
          B.hips.position.y += Math.abs(Math.sin(beats * Math.PI)) * 0.025 * danceW;
          if (move === 1) B.hips.position.x += pulse * 0.06 * danceW;
        }
      }
      // Глава – наклон според настроението
      if (free("head")) {
        const tilt = HEAD_TILT[lira.mood] || 0;
        const down = (lira.mood === "shy" || lira.mood === "sad") ? 0.12 : 0;
        B.head.rotation.z = lerp(B.head.rotation.z, tilt + Math.sin(t * 0.6) * 0.04, 0.08);
        B.head.rotation.x = lerp(B.head.rotation.x, down + Math.sin(t * 0.8) * 0.02, 0.04);
      }

      const expr = vrm.expressionManager;
      if (expr) {
        // Изражение според настроението
        const want = FACE[lira.mood] || {};
        for (const name in face) {
          face[name] = lerp(face[name], want[name] || 0, 0.05);
          expr.setValue(name, face[name]);
        }
        if (offerW > 0.01) expr.setValue("happy", Math.max(face.happy, (holding ? 1 : 0.75) * offerW));   // усмихва се
        if (hugW > 0.01) expr.setValue("happy", Math.max(face.happy, 0.8 * hugW));
        // Мигане на всеки 2.5–6 секунди
        if (t > nextBlink) { blinkStart = t; nextBlink = t + 2.5 + Math.random() * 3.5; }
        const b = (t - blinkStart) / 0.16;
        expr.setValue("blink", Math.max(b >= 0 && b <= 1 ? Math.sin(b * Math.PI) : 0, 0.85 * hugHoldW));   // затваря очи при прегръдка
        // Уста докато говори
        const mouth = lira.talking && !reduceMotion
          ? Math.max(0, Math.sin(t * 14) * Math.sin(t * 5.1)) : 0;
        expr.setValue("aa", mouth * 0.55);
        expr.setValue("oh", mouth * 0.2 * Math.max(0, Math.sin(t * 3)));
      }

      // Светещ ръб на модела в цвета на настроението
      for (const m of materials) {
        if (m.parametricRimColorFactor) {
          m.parametricRimColorFactor.copy(glow);
          m.parametricRimFresnelPowerFactor = 2.2;
          m.parametricRimLiftFactor = 0.05;
        }
      }

      Pose.beforeUpdate();   // ако дърпаш косата – държим я там
      vrm.update(dt); // физика на косата и очите
      Pose.drawHandles();
    }

    if (Room) Room.render(camera, t, glow);
    if (Balcony) Balcony.render(camera, t, glow);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();
