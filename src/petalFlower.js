// 真实花瓣网格花朵：多层花瓣曲面（有厚度感/自然弧度），bloom 连续控制旋转展开。
import * as THREE from 'three';

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const AXIS_X = new THREE.Vector3(1, 0, 0);

// 生成一片花瓣曲面（局部坐标：长度沿 +Y，宽度沿 X，杯状沿 +Z）
function buildPetalGeometry(length, width, cup, segU = 16, segV = 9) {
  const positions = [];
  const colors = [];
  const indices = [];
  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    // 叶形宽度：基部窄、中上部饱满、尖端收
    const wProf = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.62);
    const halfW = width * wProf;
    for (let iv = 0; iv <= segV; iv++) {
      const v = (iv / segV) * 2 - 1;
      const x = v * halfW;
      const y = u * length;
      // 杯状曲面 + 边缘微卷，形成自然弧度
      const z = cup * Math.sin(Math.PI * u) * (1 - v * v * 0.35)
        + 0.18 * cup * v * v * Math.sin(Math.PI * u);
      positions.push(x, y, z);
      // 颜色：基部深玫瑰 → 尖端浅樱粉，边缘略亮
      const t = u;
      const edge = 1 - Math.abs(v);
      const r = (0.86 + 0.12 * t) + 0.06 * edge;
      const g = (0.28 + 0.34 * t) + 0.04 * edge;
      const b = (0.44 + 0.30 * t) + 0.04 * edge;
      colors.push(Math.min(1, r), Math.min(1, g), Math.min(1, b));
    }
  }
  for (let iu = 0; iu < segU; iu++) {
    for (let iv = 0; iv < segV; iv++) {
      const a = iu * (segV + 1) + iv;
      const b = a + 1;
      const c = a + (segV + 1);
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createPetalFlower(scene) {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.52,
    metalness: 0.06,
    emissive: new THREE.Color(0x2a0c18),
    emissiveIntensity: 0.35,
  });

  // 三层花瓣（外层先开、内层后开）
  const layers = [
    { count: 10, length: 4.4, width: 1.55, cup: 0.9, openPhase: 0.00, budTilt: 1.02, zOff: 0.0 },
    { count: 9,  length: 3.4, width: 1.25, cup: 0.78, openPhase: 0.28, budTilt: 1.18, zOff: 0.18 },
    { count: 7,  length: 2.5, width: 1.0, cup: 0.62, openPhase: 0.52, budTilt: 1.32, zOff: 0.34 },
  ];

  const petals = [];
  layers.forEach((L, li) => {
    const geo = buildPetalGeometry(L.length, L.width, L.cup);
    for (let k = 0; k < L.count; k++) {
      const mesh = new THREE.Mesh(geo, material);
      const phi = (k / L.count) * Math.PI * 2 + li * 0.42;   // 层间错位
      mesh.userData = {
        phi,
        budTilt: L.budTilt,
        openTilt: 0.12 + li * 0.02,
        openPhase: L.openPhase + (k / L.count) * 0.08,
        zOff: L.zOff,
      };
      group.add(mesh);
      petals.push(mesh);
    }
  });

  // 花心：金色球（随绽放变亮）
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffd08a,
    emissive: 0xff9a40,
    emissiveIntensity: 0.8,
    roughness: 0.42,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), coreMat);
  group.add(core);

  scene.add(group);

  // 灯光：花瓣网格需要光照才有立体感（粒子着色器不受影响）
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const key = new THREE.DirectionalLight(0xffe8f0, 1.1);
  key.position.set(3, 5, 6);
  const fill = new THREE.DirectionalLight(0xb08cff, 0.6);
  fill.position.set(-4, -2, 4);
  scene.add(ambient, key, fill);

  const qZ = new THREE.Quaternion();
  const qX = new THREE.Quaternion();

  return {
    group,
    update({ bloom, time }) {
      const b = Math.max(0, Math.min(1, bloom));
      for (const mesh of petals) {
        const d = mesh.userData;
        // 逐层绽放：外层先开、内层后开
        const raw = (b - d.openPhase * 0.35) / 0.65;
        const eff = Math.max(0, Math.min(1, raw));
        const e = 1 - Math.pow(1 - eff, 3);   // easeOutCubic
        const tilt = d.budTilt + (d.openTilt - d.budTilt) * e;
        // 组合旋转：先绕 X 折叠（向相机收拢），再绕 Z 旋转到方位
        qX.setFromAxisAngle(AXIS_X, tilt);
        qZ.setFromAxisAngle(AXIS_Z, -d.phi);
        qZ.multiply(qX);
        mesh.quaternion.copy(qZ);
        // 轻微呼吸 + 基部沿 Z 偏移（层次感）
        const breathe = 1 + Math.sin(time * 0.9 + d.phi) * 0.006;
        mesh.scale.setScalar(breathe);
        mesh.position.set(0, 0, d.zOff * (1 - e * 0.5));
      }
      // 花心：绽放时变亮、略增大
      coreMat.emissiveIntensity = 0.5 + b * 1.2;
      core.scale.setScalar(0.65 + b * 0.45);
    },
  };
}
