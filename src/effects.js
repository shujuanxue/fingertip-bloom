// 光效与背景：渐变背景、星尘、中心光核。
import * as THREE from 'three';
import { BG_VERT, BG_FRAG, STAR_VERT, STAR_FRAG } from './shaders.js';
import { CONFIG } from './config.js';

const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uRadius;
  uniform float uAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float band = smoothstep(0.05, 0.0, abs(r - uRadius));
    float glow = band * uAlpha;
    if (glow < 0.001) discard;
    gl_FragColor = vec4(uColor * glow, glow);
  }
`;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.25, 'rgba(255,196,150,0.85)');
  g.addColorStop(0.6, 'rgba(255,120,150,0.35)');
  g.addColorStop(1, 'rgba(255,80,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createEffects(scene) {
  // ---- 背景渐变 ----
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.ShaderMaterial({
      depthWrite: false,
      fog: false,
      uniforms: {
        uCenter: { value: new THREE.Color(0x0d0410) },
        uEdge: { value: new THREE.Color(0x150508) },
      },
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
    })
  );
  bg.position.z = -9;
  scene.add(bg);

  // ---- 星尘 ----
  const starCount = CONFIG.starCount;
  const starPos = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);
  const starSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 20;
    starPos[i * 3] = Math.cos(ang) * r;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    starPos[i * 3 + 2] = -8 + Math.random() * 14;
    starSize[i] = 0.04 + Math.random() * 0.1;
    starSeed[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointScale: { value: 300 },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // ---- 中心光核 ----
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    })
  );
  glow.scale.set(1.7, 1.7, 1);
  scene.add(glow);

  // ---- 绽放能量环波 ----
  const ring = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.ShaderMaterial({
      uniforms: {
        uRadius: { value: 0.3 },
        uAlpha: { value: 0 },
        uColor: { value: new THREE.Color(0xffd9a0) },
      },
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ring.scale.setScalar(CONFIG.flowerRadius * 2.5);
  ring.position.z = 0.02;
  scene.add(ring);

  let prevBloom = 0;
  let ringPulse = 0;
  let lastTime = 0;

  return {
    update({ time, bloom, pointScale = 300 }) {
      const dt = Math.min(Math.max(time - lastTime, 0), 0.05);
      lastTime = time;

      starMat.uniforms.uTime.value = time;
      starMat.uniforms.uPointScale.value = pointScale;
      const s = 1.5 + bloom * 0.9;
      glow.scale.set(s, s, 1);
      glow.material.opacity = 0.2 + bloom * 0.3;

      // 环波：进入盛放的上升沿触发
      if (bloom > 0.72 && prevBloom <= 0.72) ringPulse = 1;
      prevBloom = bloom;
      ringPulse = Math.max(0, ringPulse - dt * 1.6);
      ring.material.uniforms.uAlpha.value = ringPulse * 0.55;
      ring.material.uniforms.uRadius.value = 0.2 + (1 - ringPulse) * 0.85;
    },
  };
}
