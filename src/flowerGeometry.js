// 花朵形态生成：产出每个粒子的「花苞位 aStart」与「盛放位 aEnd」及属性数组。
// 三层结构：光核(8%) + 内层花瓣(40%) + 外层花瓣(40%) + 外围能量(12%)。
import { CONFIG } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x1337);
const range = (min, max) => min + rand() * (max - min);

function setColor(arr, i, r, g, b) {
  arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = b;
}

// 在两色之间插值 + 轻微随机，得到丰富而统一的渐变
function pickColor(a, b, jitter = 0.12) {
  const t = rand();
  let r = a[0] + (b[0] - a[0]) * t + range(-jitter, jitter);
  let g = a[1] + (b[1] - a[1]) * t + range(-jitter, jitter);
  let bl = a[2] + (b[2] - a[2]) * t + range(-jitter, jitter);
  return [Math.max(0, r), Math.max(0, g), Math.max(0, bl)];
}

export function buildFlowerData(count = CONFIG.particleCount) {
  const { petalCount, flowerRadius, coreRadius, budScale, budElongateY, palette } = CONFIG;
  const N = count;

  const aStart = new Float32Array(N * 3);
  const aEnd = new Float32Array(N * 3);
  const aPhase = new Float32Array(N);
  const aSize = new Float32Array(N);
  const aColor = new Float32Array(N * 3);
  const aSeed = new Float32Array(N);
  const aLayer = new Float32Array(N);

  const putStart = (i, x, y, z) => { aStart[i * 3] = x; aStart[i * 3 + 1] = y; aStart[i * 3 + 2] = z; };
  const putEnd = (i, x, y, z) => { aEnd[i * 3] = x; aEnd[i * 3 + 1] = y; aEnd[i * 3 + 2] = z; };

  // 花苞位：花瓣绕竖直轴(Y)向上包裹、尖端朝上，形成真正的立体花苞（而非缩小的开放花）
  const budHeight = flowerRadius * 0.55;
  const putPetal = (i, u, v, baseAng) => {
    // 蛋形花苞：底部饱满、中部最宽、顶部收尖（非缩放）
    const egg = Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * u)), 0.6);
    const budR = coreRadius * 1.2 * egg;
    // 方位与开放态对齐（同一花瓣同方位），仅轻微螺旋 + 花瓣宽度，保证开合连贯不错位
    const budAng = baseAng + v * 0.22 + u * 0.1;
    const budY = (u - 0.55) * budHeight;
    putStart(i, Math.cos(budAng) * budR, budY, Math.sin(budAng) * budR);
  };

  let i = 0;

  // ---- 光核（暖金/淡黄，中心）----
  const coreCount = Math.floor(N * 0.05);
  for (let k = 0; k < coreCount; k++, i++) {
    const r = Math.sqrt(rand()) * coreRadius;
    const ang = rand() * Math.PI * 2;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r * 0.9;
    const z = range(-0.45, 0.45);
    putStart(i, x * 0.4, y * 0.4, z * 0.3);   // 花苞里收在中心
    putEnd(i, x, y, z);
    aPhase[i] = range(0.4, 0.6);               // 花心最后显露、金光渐强
    aSize[i] = range(0.04, 0.08);
    const c = pickColor(palette.core, palette.gold);
    setColor(aColor, i, c[0], c[1], c[2]);
    aSeed[i] = rand();
    aLayer[i] = 0;
  }

  // ---- 内层花瓣（局部二维宽花瓣：基部收、中部展）----
  const innerCount = Math.floor(N * 0.47);
  for (let k = 0; k < innerCount; k++, i++) {
    const pi = Math.floor(rand() * petalCount);
    const baseAng = (pi / petalCount) * Math.PI * 2;
    const u = rand();
    const v = rand() < 0.75 ? (rand() < 0.5 ? -1 : 1) * (0.84 + rand() * 0.16) : (rand() * 2 - 1);
    const len = flowerRadius * 0.42 * range(0.93, 1.07);
    const baseR = coreRadius * 0.45;
    const halfW = flowerRadius * 0.17;
    const wProfile = Math.pow(Math.sin(Math.PI * u), 0.45);
    const lateral = v * halfW * wProfile;
    const r = baseR + u * len;
    const ca = Math.cos(baseAng), sa = Math.sin(baseAng);
    const x = ca * r - sa * lateral;
    const y = (sa * r + ca * lateral) * 0.95;
    const curl = 0.6 * Math.sin(Math.PI * u) * (1 - Math.abs(v) * 0.5);
    const z = curl * range(0.7, 1.2);
    putPetal(i, u, v, baseAng);
    putEnd(i, x, y, z);
    aPhase[i] = range(0.25, 0.45);             // 内层随后展开
    aSize[i] = (0.02 + Math.pow(rand(), 3) * 0.07) * (Math.abs(v) > 0.8 ? 1.6 : 1);
    const c = pickColor(palette.innerPetal, palette.outerPetal);
    setColor(aColor, i, c[0], c[1], c[2]);
    aSeed[i] = rand();
    aLayer[i] = 1;
  }

  // ---- 外层花瓣（局部二维宽花瓣、交错半片）----
  const outerCount = Math.floor(N * 0.47);
  for (let k = 0; k < outerCount; k++, i++) {
    const pi = Math.floor(rand() * petalCount);
    const baseAng = ((pi + 0.5) / petalCount) * Math.PI * 2;
    const u = rand();
    const v = rand() < 0.75 ? (rand() < 0.5 ? -1 : 1) * (0.84 + rand() * 0.16) : (rand() * 2 - 1);
    const len = flowerRadius * range(0.62, 0.85) * range(0.93, 1.07);
    const baseR = coreRadius * 0.4;
    const halfW = flowerRadius * 0.2;
    const wProfile = Math.pow(Math.sin(Math.PI * u), 0.45);
    const lateral = v * halfW * wProfile;
    const r = baseR + u * len;
    const ca = Math.cos(baseAng), sa = Math.sin(baseAng);
    const x = ca * r - sa * lateral;
    const y = (sa * r + ca * lateral) * 0.92;
    const curl = 0.85 * Math.sin(Math.PI * u) * (1 - Math.abs(v) * 0.45);
    const z = curl * range(0.6, 1.5);
    putPetal(i, u, v, baseAng);
    putEnd(i, x, y, z);
    aPhase[i] = range(0.0, 0.2);               // 外层率先展开
    aSize[i] = (0.018 + Math.pow(rand(), 3) * 0.06) * (Math.abs(v) > 0.8 ? 1.6 : 1);
    let c;
    if (Math.abs(v) > 0.78) c = pickColor(palette.edge, palette.outerPetal, 0.05);
    else if (rand() < 0.03) c = palette.gold;
    else c = pickColor(palette.outerPetal, palette.accent);
    setColor(aColor, i, c[0], c[1], c[2]);
    aSeed[i] = rand();
    aLayer[i] = 2;
  }

  // ---- 外围能量粒子（少量，贴近花瓣边缘，营造柔和星尘，而非爆炸）----
  const energyCount = N - i;
  for (let k = 0; k < energyCount; k++, i++) {
    const ang = rand() * Math.PI * 2;
    const r = flowerRadius * range(0.8, 0.95);
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r * 0.85;
    const z = (rand() - 0.5) * 1.6;
    putStart(i, Math.cos(ang) * coreRadius * 0.5, Math.sin(ang) * coreRadius * 0.5, (rand() - 0.5) * 0.4);
    putEnd(i, x, y, z);
    aPhase[i] = range(0.55, 0.9);
    aSize[i] = range(0.015, 0.05);
    const rr = rand();
    const c = rr < 0.35 ? palette.gold : (rr < 0.7 ? palette.accent : palette.edge);
    setColor(aColor, i, c[0], c[1], c[2]);
    aSeed[i] = rand();
    aLayer[i] = 3;
  }

  return { aStart, aEnd, aPhase, aSize, aColor, aSeed, aLayer, count: i };
}
