// =========================================================
// ЛИРА – изглед „Стая“
// ---------------------------------------------------------
// Уютен тъмен апартамент: голям прозорец към нощния град,
// диван, масичка, лампа, рафт с книги, растение, килим и
// неонови ленти. Тя стои на проектора в средата.
// Рисува се на отделен canvas (#room) зад холограмата.
// Мерките са в метри (тя е висока около 1.6 м).
// =========================================================

const Room = (() => {
  if (!window.LIRA3D) return null;
  const { THREE } = window.LIRA3D;

  const canvas = document.getElementById("room");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0812);
  scene.fog = new THREE.Fog(0x0a0812, 8, 16);

  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Помощни функции
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color });
  function box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------- Светлини ----------
  scene.add(new THREE.AmbientLight(0x7a6a9a, 0.95));
  const lampLight = new THREE.PointLight(0xffb36b, 6, 6, 1.6);      // топла лампа
  lampLight.position.set(2.45, 1.55, -1.4);
  scene.add(lampLight);
  const windowLight = new THREE.PointLight(0x5fa8ff, 4, 7, 1.4);    // студена светлина от града
  windowLight.position.set(0, 1.8, -2.2);
  scene.add(windowLight);
  const neonLight = new THREE.PointLight(0xff4fb8, 3, 6, 1.5);      // розов неон
  neonLight.position.set(-2.9, 2.5, 0.5);
  scene.add(neonLight);
  const holoLight = new THREE.PointLight(0x6fe8ff, 2.5, 3, 1.5);    // сиянието от нея
  holoLight.position.set(0, 0.9, 0.3);
  scene.add(holoLight);

  // ---------- Под, стени, таван ----------
  const floorTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#241a22"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {                  // дъски
      const shift = (y / 32) % 2 ? 0 : 128;
      for (let x = -shift; x < w; x += 256) {
        const v = 30 + rand() * 18;
        g.fillStyle = `rgb(${v + 8},${v - 4},${v})`;
        g.fillRect(x + 1, y + 1, 254, 30);
      }
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), mat(0xffffff, { map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.6;
  scene.add(floor);

  const wallMat = mat(0x2a2338);
  const W = 7, H = 3, back = -2.6;
  // задна стена с голям прозорец (x от -2 до 2, y от 0.7 до 2.5)
  box(1.5, H, 0.1, wallMat, -2.75, H / 2, back);
  box(1.5, H, 0.1, wallMat, 2.75, H / 2, back);
  box(4, 0.7, 0.1, wallMat, 0, 0.35, back);
  box(4, 0.5, 0.1, wallMat, 0, 2.75, back);
  // странични стени и таван
  box(0.1, H, 7, wallMat, -3.5, H / 2, 0.9);
  box(0.1, H, 7, wallMat, 3.5, H / 2, 0.9);
  box(W, 0.1, 7, mat(0x17121f), 0, H, 0.9);

  // ---------- Прозорецът: нощният град навън ----------
  const cityTex = canvasTexture(1024, 460, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#120a2a"); sky.addColorStop(1, "#3a1640");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {                     // размазани неонови светлини
      const x = rand() * w, y = rand() * h * 0.7, r = 20 + rand() * 60;
      const c = ["255,80,190", "80,200,255", "255,170,80"][i % 3];
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${c},.35)`); grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let layer = 0; layer < 2; layer++) {          // два реда блокове
      for (let x = -20; x < w; ) {
        const bw = 40 + rand() * 90, bh = (layer ? 140 : 220) + rand() * (layer ? 180 : 200);
        g.fillStyle = layer ? "#0d0a18" : "#16102a";
        g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 8; wy < h - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
            if (rand() < 0.3) {
              g.fillStyle = rand() < 0.8 ? `rgba(255,${190 + rand() * 50},${120 + rand() * 60},${0.4 + rand() * 0.6})` : "rgba(120,230,255,.8)";
              g.fillRect(wx, wy, 3, 4);
            }
          }
        }
        x += bw + 4 + rand() * 10;
      }
    }
  });
  const windowView = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.8), new THREE.MeshBasicMaterial({ map: cityTex }));
  windowView.position.set(0, 1.6, back - 0.04);
  scene.add(windowView);
  // рамка и кръстачка на прозореца
  const frameMat = mat(0x0c0a12, { roughness: 0.4 });
  box(4.05, 0.05, 0.08, frameMat, 0, 0.72, back + 0.02);
  box(4.05, 0.05, 0.08, frameMat, 0, 2.48, back + 0.02);
  box(0.05, 1.8, 0.08, frameMat, 0, 1.6, back + 0.02);
  box(0.05, 1.8, 0.08, frameMat, -2, 1.6, back + 0.02);
  box(0.05, 1.8, 0.08, frameMat, 2, 1.6, back + 0.02);
  // перваз
  box(4.2, 0.05, 0.3, mat(0x1c1626), 0, 0.7, back + 0.15);

  // ---------- Неонови ленти ----------
  box(6.9, 0.03, 0.03, glowMat(0xff4fb8), 0, 2.93, back + 0.08);        // по тавана отзад
  box(0.03, 0.03, 6.9, glowMat(0xff4fb8), -3.43, 2.93, 0.9);           // по тавана вляво
  box(4, 0.02, 0.02, glowMat(0x4fe6ff), 0, 0.69, back + 0.31);          // под перваза

  // ---------- Диван (вляво) ----------
  const sofaMat = mat(0x3b2a52, { roughness: 0.95 });
  box(0.9, 0.42, 2.2, sofaMat, -2.6, 0.21, -0.4);          // седалка
  box(0.25, 0.85, 2.2, sofaMat, -3.0, 0.43, -0.4);         // облегалка
  box(0.9, 0.6, 0.22, sofaMat, -2.6, 0.3, -1.5);           // подлакътници
  box(0.9, 0.6, 0.22, sofaMat, -2.6, 0.3, 0.7);
  box(0.5, 0.3, 0.12, mat(0xff7ad6), -2.45, 0.55, -0.9).rotation.z = 0.2;  // възглавници
  box(0.5, 0.3, 0.12, mat(0x6fe8ff), -2.45, 0.55, 0.1).rotation.z = -0.15;

  // ---------- Масичка с чаша ----------
  const woodMat = mat(0x3a2a24, { roughness: 0.5 });
  box(0.8, 0.04, 0.5, woodMat, -1.6, 0.38, -0.3);
  for (const [dx, dz] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) {
    box(0.04, 0.38, 0.04, woodMat, -1.6 + dx, 0.19, -0.3 + dz);
  }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16), mat(0xf2e6ff));
  mug.position.set(-1.45, 0.445, -0.25);
  scene.add(mug);

  // ---------- Лампа (вдясно отзад) ----------
  box(0.3, 0.03, 0.3, mat(0x111111), 2.45, 0.015, -1.4);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), mat(0x222222, { metalness: 0.6 }));
  pole.position.set(2.45, 0.77, -1.4);
  scene.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffa060, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  shade.position.set(2.45, 1.6, -1.4);
  scene.add(shade);

  // ---------- Рафт с книги (дясната стена) ----------
  const shelfMat = mat(0x2a1f1a, { roughness: 0.6 });
  for (const y of [0.9, 1.35, 1.8]) {
    box(0.3, 0.03, 1.6, shelfMat, 3.3, y, 0.6);
    let z = -0.15;
    while (z < 1.3) {
      const t = 0.03 + rand() * 0.05, hgt = 0.2 + rand() * 0.12;
      const colors = [0x6b3a5a, 0x2f4a6b, 0x8a6a3a, 0x3a6b5a, 0x5a3a7a, 0xa04a5a];
      box(0.2, hgt, t, mat(colors[Math.floor(rand() * colors.length)]), 3.3, y + 0.015 + hgt / 2, z);
      z += t + 0.005;
      if (rand() < 0.12) z += 0.15;
    }
  }

  // ---------- Растение в саксия (вдясно напред) ----------
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.35, 20), mat(0xd8cfe8));
  pot.position.set(2.6, 0.175, 1.2);
  scene.add(pot);
  const leafMat = mat(0x2f6b4a, { roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6 + rand() * 0.35, 6), leafMat);
    const a = rand() * Math.PI * 2, tilt = 0.2 + rand() * 0.5;
    leaf.position.set(2.6 + Math.cos(a) * 0.05, 0.62, 1.2 + Math.sin(a) * 0.05);
    leaf.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    scene.add(leaf);
  }

  // ---------- Кръгъл килим под нея ----------
  const rugTex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = "#3a2448"; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill();
    g.strokeStyle = "#5a3a6a"; g.lineWidth = 6;
    for (const r of [110, 80, 50]) { g.beginPath(); g.arc(w / 2, w / 2, r, 0, 7); g.stroke(); }
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), mat(0xffffff, { map: rugTex, transparent: true }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.004;
  scene.add(rug);

  // ---------- Стол в средата (показва се, когато тя седне) ----------
  const chair = new THREE.Group();
  const chairMat = mat(0x2b2236, { roughness: 0.7 });
  const cushion = mat(0x5a3a7a, { roughness: 0.95 });
  const addPart = (w, h, d, m, x, y, z) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    part.position.set(x, y, z);
    chair.add(part);
  };
  addPart(0.5, 0.06, 0.48, cushion, 0, 0.42, 0.05);        // седалка
  addPart(0.5, 0.55, 0.06, cushion, 0, 0.72, -0.2);        // облегалка
  for (const [x, z] of [[-0.22, -0.16], [0.22, -0.16], [-0.22, 0.26], [0.22, 0.26]]) {
    addPart(0.04, 0.4, 0.04, chairMat, x, 0.2, z);         // крака
  }
  chair.visible = false;
  scene.add(chair);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
  }
  addEventListener("resize", resize);
  resize();

  let on = false;
  return {
    get on() { return on; },
    setChair(value) { chair.visible = value; },
    chairYaw(angle) { chair.rotation.y = angle; },   // столът се върти заедно с нея
    set(value) {
      on = value;
      canvas.hidden = !on;
      document.body.classList.toggle("room", on);
    },
    // glow: цветът на настроението ѝ – с него свети стаята около нея
    render(camera, time, glow) {
      if (!on) return;
      holoLight.color.copy(glow);
      lampLight.intensity = 6 + Math.sin(time * 7) * 0.08;   // съвсем леко трепкане
      renderer.render(scene, camera);
    },
  };
})();
