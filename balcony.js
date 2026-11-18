// =========================================================
// ЛИРА – изглед „Балкон“
// ---------------------------------------------------------
// Нощен град от сгради със светещи прозорци, мъгла и неон.
// Градът е умален около нея, затова тя изглежда като
// огромна холограма между блоковете. Рисува се на отделен
// canvas (#skyline) зад холограмата.
// =========================================================

const Balcony = (() => {
  if (!window.LIRA3D) return null;
  const { THREE } = window.LIRA3D;

  const canvas = document.getElementById("skyline");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0418);
  scene.fog = new THREE.FogExp2(0x1c0828, 0.12);   // розово-лилава мъгла

  // Случайни числа, които са еднакви при всяко отваряне
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---------- Текстура с прозорци ----------
  function windowsTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#07060f";
    g.fillRect(0, 0, c.width, c.height);
    const warm = ["#ffcf8a", "#ffb36b", "#fff1c9"];
    const cold = ["#7fe9ff", "#9fb8ff", "#ff8ad8"];
    for (let y = 4; y < c.height - 4; y += 8) {
      for (let x = 4; x < c.width - 4; x += 8) {
        if (rand() < 0.38) {
          const pool = rand() < 0.75 ? warm : cold;
          g.globalAlpha = 0.35 + rand() * 0.65;
          g.fillStyle = pool[Math.floor(rand() * pool.length)];
          g.fillRect(x, y, 4, 5);
        }
      }
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  const windowTextures = [windowsTexture(), windowsTexture(), windowsTexture()];

  // ---------- Сгради ----------
  // Улицата върви напред към теб (по оста z); около нея (|x| < 1) няма сгради.
  const buildings = new THREE.Group();
  scene.add(buildings);
  function addBuilding(x, z, w, d, h) {
    const tex = windowTextures[Math.floor(rand() * windowTextures.length)].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, w * 7), Math.max(1, h * 4));
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff })
    );
    box.position.set(x, h / 2, z);
    buildings.add(box);
    // Покрив – тъмен, за да не се вижда текстурата отгоре
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x05040b }));
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(x, h + 0.001, z);
    buildings.add(roof);
    // Понякога – неонова табела отстрани
    if (rand() < 0.35 && h > 0.6) {
      const colors = [0xff4fb8, 0x4fe6ff, 0xffa64f, 0x9d7bff];
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06 + rand() * 0.06, 0.2 + rand() * 0.35),
        new THREE.MeshBasicMaterial({ color: colors[Math.floor(rand() * colors.length)], fog: false, transparent: true, opacity: 0.9 })
      );
      const side = x > 0 ? -1 : 1;
      sign.position.set(x + side * (w / 2 + 0.002), h * (0.4 + rand() * 0.45), z + (rand() - 0.5) * d * 0.6);
      sign.rotation.y = side * Math.PI / 2;
      buildings.add(sign);
    }
  }
  // Двете страни на улицата
  for (let z = 6; z > -14; z -= 0.55 + rand() * 0.5) {
    for (const side of [-1, 1]) {
      const w = 0.4 + rand() * 0.6;
      const d = 0.4 + rand() * 0.4;
      // Сградите около нея са ниски (до коленете ѝ) – така тя изглежда огромна
      const h = z > -3 ? 0.18 + rand() * 0.45 : 0.4 + rand() * 1.4;
      addBuilding(side * (1.05 + w / 2 + rand() * 0.15), z, w, d, h);
    }
  }
  // По-далечни редове – висок град отзад
  for (let i = 0; i < 160; i++) {
    const x = (rand() - 0.5) * 30;
    const z = -3 - rand() * 22;
    if (Math.abs(x) < 1.4 && z > -6) continue;
    const far = Math.min(1, (-z - 3) / 15);   // колкото по-далеч, толкова по-високи
    addBuilding(x, z, 0.5 + rand() * 1.2, 0.5 + rand() * 1.2, 0.4 + rand() * (0.8 + far * 4));
  }

  // ---------- Улица и сияние ----------
  const street = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x0b0918 }));
  street.rotation.x = -Math.PI / 2;
  scene.add(street);
  // Мокър асфалт: светли ивици, които „отразяват“ неона
  const strips = [];
  for (let i = 0; i < 40; i++) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02 + rand() * 0.05, 0.6 + rand() * 1.5),
      new THREE.MeshBasicMaterial({ color: rand() < 0.5 ? 0xff4fb8 : 0x4fe6ff, transparent: true, opacity: 0.12 + rand() * 0.15 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((rand() - 0.5) * 1.8, 0.002, 4 - rand() * 12);
    scene.add(strip);
    strips.push(strip);
  }
  // Голямо мъгливо сияние зад нея
  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x6fe8ff, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  halo.scale.set(4.5, 5, 1);
  halo.position.set(0, 1.1, -0.6);
  scene.add(halo);

  // Летящи светлини (коли във въздуха) далеч отзад
  const flyers = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshBasicMaterial({ color: rand() < 0.5 ? 0xffe2a8 : 0xff5f6d, fog: false }));
    m.userData = { y: 1.5 + rand() * 3, z: -4 - rand() * 12, speed: (0.3 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1), x: (rand() - 0.5) * 20 };
    scene.add(m);
    flyers.push(m);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
  }
  addEventListener("resize", resize);
  resize();

  let on = false;
  return {
    get on() { return on; },
    set(value) {
      on = value;
      canvas.hidden = !on;
      document.body.classList.toggle("balcony", on);
    },
    // glow: цветът на настроението ѝ (THREE.Color)
    // Разходка: сградите се плъзгат покрай нея (speed в м/с; 0 = стои)
    walk(speed, dt) {
      if (!speed) return;
      // тя гледа към +z, затова градът тече към -z (минава покрай нея назад)
      for (const b of buildings.children) {
        b.position.z -= speed * dt;
        if (b.position.z < -25) b.position.z += 33;  // излязлата отзад сграда се появява пак отпред
      }
      for (const s of strips) {
        s.position.z -= speed * dt;
        if (s.position.z < -8) s.position.z += 12;
      }
    },
    render(camera, time, glow) {
      if (!on) return;
      halo.material.color.copy(glow).lerp(new THREE.Color(0xff4fd0), 0.5);
      halo.material.opacity = 0.16 + Math.sin(time * 0.8) * 0.03;
      for (const f of flyers) {
        const d = f.userData;
        d.x += d.speed * 0.016;
        if (d.x > 12) d.x = -12;
        if (d.x < -12) d.x = 12;
        f.position.set(d.x, d.y, d.z);
      }
      renderer.render(scene, camera);
    },
  };
})();
