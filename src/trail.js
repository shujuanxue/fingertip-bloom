// 指尖能量轨迹：速度驱动的 CPU 环形缓冲粒子池，在指尖/鼠标处生成粉金光点并漂移淡出。
import * as THREE from 'three';

const MAX = 512;

export function createTrail(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  let head = 0;
  let prevX = null, prevY = null, prevZ = null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uPointScale: { value: 300 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aLife;
      uniform float uPointScale;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPointScale / max(-mv.z, 0.001), 0.5, 48.0);
        vColor = aColor;
        vAlpha = smoothstep(0.0, 1.0, aLife);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * glow, glow * vAlpha * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  function spawn(x, y, z, speed) {
    const i = head;
    head = (head + 1) % MAX;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    life[i] = 1.0;
    // 速度越快，粒子越大越亮
    sizes[i] = (0.06 + Math.random() * 0.1) * (1 + Math.min(1.2, speed * 8));
    if (Math.random() < 0.5) {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.66; colors[i * 3 + 2] = 0.78; // 樱花粉
    } else if (Math.random() < 0.6) {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.82; colors[i * 3 + 2] = 0.5;  // 香槟金
    } else {
      colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.98; // 淡紫
    }
  }

  return {
    points,
    update({ pointScale = 300, spawnPoint = null }) {
      mat.uniforms.uPointScale.value = pointScale;
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) continue;
        life[i] -= 0.022;
        if (life[i] < 0) life[i] = 0;
        positions[i * 3] += (Math.random() - 0.5) * 0.022;
        positions[i * 3 + 1] += 0.006 + (Math.random() - 0.5) * 0.012;
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.012;
        sizes[i] *= 0.986;
      }
      if (spawnPoint) {
        let speed = 0;
        if (prevX !== null) speed = Math.hypot(spawnPoint.x - prevX, spawnPoint.y - prevY);
        prevX = spawnPoint.x; prevY = spawnPoint.y; prevZ = spawnPoint.z;
        // 速度驱动：手指越快，粒子越多、越扩散
        const count = 2 + Math.min(14, Math.round(speed * 55));
        const spread = 0.05 + Math.min(0.24, speed * 0.65);
        for (let k = 0; k < count; k++) {
          spawn(
            spawnPoint.x + (Math.random() - 0.5) * spread,
            spawnPoint.y + (Math.random() - 0.5) * spread,
            spawnPoint.z + (Math.random() - 0.5) * 0.12,
            speed
          );
        }
      } else {
        prevX = null; prevY = null; prevZ = null;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
    },
  };
}
