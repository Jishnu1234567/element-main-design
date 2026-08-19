gsap.registerPlugin(ScrollTrigger);

const DEFAULTS = {
  windAngle: 25, // degrees: 0 = right, 90 = up, 180 = left
  windStrength: 400, // px: travel distance in the wind direction
  scatter: 80, // px: random perpendicular deviation
  maxRotation: 360, // degrees: maximum rotation on any axis
  stagger: 0.5, // 0-1: spread of per-letter start times across the timeline
  depth: 120, // px: maximum Z movement
  reverse: false, // scroll reveals text (true) vs scatters it (false)
  order: "random", // 'random' | 'ltr' | 'rtl' | 'outward'
  randomness: 0, // 0 = uniform order, 1 = fully random stagger
  gustiness: 0, // px: lateral drift perpendicular to wind during flight
  gustFrequency: 1, // sine cycles during flight
  gustPhaseSpread: 1, // 0-1: how much the sine phase spreads across chars
  startY: null, // null = use mode default (.85 reverse, .65 forward)
  animationDuration: 1, // fraction of scroll duration the animation occupies
  easing: null,
};

function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
function seededRandom(seed) {
  let s = seed >>> 0;
  const splitmix32 = () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
  const rand = sfc32(splitmix32(), splitmix32(), splitmix32(), splitmix32());
  for (let i = 0; i < 12; i++) rand();
  return rand;
}

const seed = 42;
let r = seededRandom(seed);

const rand = (min, max) => min + r() * (max - min);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

function buildStructure(el, text) {
  if (getComputedStyle(el).position === "static")
    el.style.position = "relative";
  el.textContent = "";

  const srEl = document.createElement("span");
  srEl.className = "visually-hidden";
  srEl.textContent = text;
  el.appendChild(srEl);

  const placeholder = document.createElement("span");
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.cssText =
    "visibility:hidden; pointer-events:none; user-select:none;";
  placeholder.textContent = text;
  el.appendChild(placeholder);

  const overlay = document.createElement("span");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position:absolute; top:0; left:0; width:100%; height:100%; overflow:visible; pointer-events:none;";
  el.appendChild(overlay);

  return { placeholder, overlay };
}

function measureAndCreateChars(el, raw, placeholder, overlay) {
  const containerRect = el.getBoundingClientRect();
  const textNode = placeholder.firstChild;
  const chars = [];

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === " ") continue;

    const range = document.createRange();
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    const rect = range.getBoundingClientRect();

    const span = document.createElement("span");
    span.textContent = raw[i];
    span.classList.add("fly-char");
    span.style.cssText = [
      "position:absolute",
      `left:${rect.left - containerRect.left}px`,
      `top:${rect.top - containerRect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "white-space:nowrap",
    ].join(";");
    span._x = rect.left - containerRect.left;
    overlay.appendChild(span);
    chars.push(span);
  }

  const xs = chars.map((c) => c._x);
  const xMin = Math.min(...xs);
  const xRange = Math.max(...xs) - xMin || 1;
  chars.forEach((c) => {
    c._normX = (c._x - xMin) / xRange;
  });

  return chars;
}

function charStartTime(char, total, order, stagger, randomness = 0) {
  if (total <= 1) return 0;
  const x = char._normX;
  let ordered;
  switch (order) {
    case "ltr":
      ordered = x * stagger;
      break;
    case "rtl":
      ordered = (1 - x) * stagger;
      break;
    case "outward":
      ordered = (1 - Math.abs(x - 0.5) * 2) * stagger;
      break;
    default:
      return rand(0, stagger);
  }
  return ordered * (1 - randomness) + rand(0, stagger) * randomness;
}

function buildTimeline(el, chars, p) {
  const {
    reverse,
    windAngle,
    windStrength,
    scatter,
    maxRotation,
    depth,
    order,
    stagger,
    randomness,
    gustiness,
    gustFrequency,
    gustPhaseSpread,
    easing,
  } = p;

  const tl = gsap.timeline({ paused: true });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const from = reverse ? { opacity: 0 } : { opacity: 1 };
    const to = reverse ? { opacity: 1 } : { opacity: 0 };
    tl.fromTo(el, from, { ...to, duration: 1 });
    return tl;
  }

  const rad = (windAngle * Math.PI) / 180;
  const windX = Math.cos(rad);
  const windY = -Math.sin(rad);

  const perpX = Math.sin(rad);
  const perpY = Math.cos(rad);

  const sharedAmp =
    gustiness > 0 ? rand(0.1, 1.0) * gustiness * (r() > 0.5 ? 1 : -1) : 0;

  chars.forEach((char, i) => {
    const startTime = charStartTime(char, chars.length, order, stagger, randomness);
    const duration = rand(1 - randomness * 0.5, 1 + randomness * 0.5);
    const scatterAngle = rand(0, Math.PI * 2);
    const scatterDist = rand(0, scatter);
    const syncPhase = Math.PI * gustFrequency * startTime;
    const indexPhase = (i / Math.max(1, chars.length - 1)) * Math.PI * 2;
    const phase = lerp(syncPhase, indexPhase, gustPhaseSpread);

    const fx = windX * windStrength + Math.cos(scatterAngle) * scatterDist;
    const fy = windY * windStrength + Math.sin(scatterAngle) * scatterDist;
    const fz = rand(-depth, depth);
    const rx = rand(-maxRotation, maxRotation);
    const ry = rand(-maxRotation * 0.7, maxRotation * 0.7);
    const rz = rand(-maxRotation * 0.3, maxRotation * 0.3);

    const scattered = { x: fx, y: fy, z: fz, rotationX: rx, rotationY: ry, rotationZ: rz, opacity: 0 };
    const natural = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 1 };

    if (gustiness > 0) {
      const individualAmp = rand(0.1, 1.0) * gustiness * (r() > 0.5 ? 1 : -1);
      const amp = lerp(sharedAmp, individualAmp, gustPhaseSpread);

      const s0 = Math.sin(phase);
      const s1 = Math.sin(Math.PI * gustFrequency + phase);
      const gustSine = (t) =>
        amp * (Math.sin(Math.PI * gustFrequency * t + phase) - s0 - t * (s1 - s0));

      const sineAt = (t) => {
        const s = reverse ? 1 - t : t;
        return {
          x: s * fx + perpX * gustSine(t),
          y: s * fy + perpY * gustSine(t),
          z: s * fz,
          rotationX: rx * s,
          rotationY: ry * s,
          rotationZ: rz * s,
          opacity: clamp01((1 - s) / 0.6),
        };
      };

      gsap.set(char, sineAt(0));
      const proxy = { t: 0 };

      tl.to(
        proxy,
        {
          t: 1,
          duration,
          ease: easing ? easing : "power3.in",
          immediateRender: true,
          onUpdate() {
            gsap.set(char, sineAt(proxy.t));
          },
        },
        startTime,
      );
    } else {
      const [from, to] = reverse ? [scattered, natural] : [natural, scattered];
      tl.fromTo(char, from, { ...to, duration, ease: easing ?? (reverse ? "power3.out" : "power3.in") }, startTime);
    }
  });

  const animDuration = parseFloat(p.animationDuration);
  if (animDuration > 0 && animDuration < 1) {
    tl.call(() => {}, [], tl.duration() / animDuration);
  }

  return tl;
}

function initFlyText(el) {
  const d = el.dataset;
  const p = { ...DEFAULTS };
  for (const key in DEFAULTS) {
    if (d[key] === undefined) continue;
    const dv = DEFAULTS[key];
    if (typeof dv === "number") p[key] = parseFloat(d[key]);
    else if (typeof dv === "boolean") p[key] = d[key] === "true";
    else p[key] = d[key];
  }

  const raw = el.textContent.replace(/\s+/g, " ").trim();
  const { placeholder, overlay } = buildStructure(el, raw);

  let st = null;
  let tl = null;

  function setup() {
    if (st) st.kill();
    if (tl) tl.kill();

    overlay.innerHTML = "";
    const chars = measureAndCreateChars(el, raw, placeholder, overlay);
    if (!chars.length) return;

    gsap.set(chars, { transformPerspective: 500 });
    tl = buildTimeline(el, chars, p);

    const { startY, reverse } = p;
    const startPct = Math.round((startY ?? (reverse ? 0.85 : 0.65)) * 100);

    st = ScrollTrigger.create({
      trigger: el,
      start: `top ${startPct}%`,
      end: reverse ? "top 20%" : "bottom top",
      scrub: 1,
      animation: tl,
    });
  }

  setup();

  let resizeTimer;
  let lastW = 0, lastH = 0;
  const ro = new ResizeObserver(([entry]) => {
    r = seededRandom(seed);
    const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0];
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 200);
  });
  ro.observe(el);
}

document.fonts.ready.then(() => {
  document.querySelectorAll(".fly-text").forEach(initFlyText);
});
