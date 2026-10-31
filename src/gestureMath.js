// 手势参数计算：MediaPipe 关键点 → 连续开合参数 0..1（按手掌尺度归一化）。
import { CONFIG } from './config.js';

const WRIST = 0;
const FINGER_TIPS = [8, 12, 16, 20];   // 食/中/无名/小指 指尖
const FINGER_MCPS = [5, 9, 13, 17];    // 对应掌指关节
const THUMB_TIP = 4;
const THUMB_IP = 3;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// 计算单帧开合度（0 握拳 ~ 1 完全张开），已归一化消除手型差异
export function computeOpenness(landmarks) {
  const wrist = landmarks[WRIST];
  const palmScale = dist(wrist, landmarks[9]) || 1e-4;

  let sum = 0, n = 0;
  for (let f = 0; f < 4; f++) {
    const tip = landmarks[FINGER_TIPS[f]];
    const mcp = landmarks[FINGER_MCPS[f]];
    const dTip = dist(tip, wrist) / palmScale;
    const dMcp = dist(mcp, wrist) / palmScale;
    sum += clamp01((dTip - dMcp) / 1.6);
    n++;
  }
  // 拇指贡献（权重小，因其运动模式不同）
  const thumb = clamp01(
    (dist(landmarks[THUMB_TIP], wrist) / palmScale -
     dist(landmarks[THUMB_IP], wrist) / palmScale) / 1.1
  );
  sum += thumb * 0.6;
  n += 0.6;
  return sum / n;
}

// 拇指与食指距离（捏合 0 ~ 张开 1），连续控制绽放
export function computePinch(landmarks) {
  const palmScale = dist(landmarks[WRIST], landmarks[9]) || 1e-4;
  const d = dist(landmarks[THUMB_TIP], landmarks[8]) / palmScale;
  return clamp01(d / 2.2);
}

// 单指是否伸展：指尖相对掌指关节向外伸展的程度（阈值经实际手型校准）
function fingerExtended(lm, tipIdx, mcpIdx, palmScale) {
  const dTip = dist(lm[tipIdx], lm[WRIST]) / palmScale;
  const dMcp = dist(lm[mcpIdx], lm[WRIST]) / palmScale;
  return dTip - dMcp > 0.4;
}

/**
 * 手势 → 颜色映射（用于幻彩模式）：
 * 五指张开=绿 / 食指+中指=蓝 / 拇指食指捏合=金 / 握拳=红
 * 返回 'green' | 'blue' | 'gold' | 'red' | 'none'
 */
export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'none';
  const palmScale = dist(lm[WRIST], lm[9]) || 1e-4;
  const idxExt = fingerExtended(lm, 8, 5, palmScale);
  const midExt = fingerExtended(lm, 12, 9, palmScale);
  const ringExt = fingerExtended(lm, 16, 13, palmScale);
  const pinkyExt = fingerExtended(lm, 20, 17, palmScale);
  const count = (idxExt ? 1 : 0) + (midExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);
  const pinchD = dist(lm[THUMB_TIP], lm[8]) / palmScale;

  if (count >= 4) return 'green';                                // 五指张开
  if (idxExt && midExt && !ringExt && !pinkyExt) return 'blue';  // 食指+中指
  if (pinchD < 0.6 && idxExt && count <= 2) return 'gold';       // 拇指食指捏合
  if (count <= 0) return 'red';                                  // 握拳
  return 'none';
}

/**
 * 花形手势 → 形状（用于花朵开放时的形态变化，不改原开合/颜色）：
 * V字(食+中分开)=蝶翼 / 仅食指=尖瓣上聚 / 三指=多层 / OK(拇指食指圈+三指伸)=螺旋
 */
export function classifyShape(lm) {
  if (!lm || lm.length < 21) return 'none';
  const scale = dist(lm[WRIST], lm[9]) || 1e-4;
  const idx = fingerExtended(lm, 8, 5, scale);
  const mid = fingerExtended(lm, 12, 9, scale);
  const ring = fingerExtended(lm, 16, 13, scale);
  const pinky = fingerExtended(lm, 20, 17, scale);
  const pinchD = dist(lm[THUMB_TIP], lm[8]) / scale;   // 拇指-食指指尖距离
  const pinchClose = pinchD < 0.55;                     // 拇指食指接触

  // OK：拇指食指指尖接触(捏圈) + 中/无名/小指伸出 —— 用“指尖接触”作为独立几何条件
  if (pinchClose && mid && ring && pinky) return 'spiral';
  // 三指：食指+中指+无名指伸出，小指收拢，且拇指食指不接触
  if (idx && mid && ring && !pinky && !pinchClose) return 'layered';
  // 仅食指 → 尖瓣百合
  if (idx && !mid && !ring && !pinky) return 'pointed';
  // 仅中指 → 蝶翼花
  if (!idx && mid && !ring && !pinky) return 'butterfly';
  return 'none';
}

// 掌心中心（腕部 + 四个掌指关节的均值）
export function palmCenter(landmarks) {
  const idx = [0, 5, 9, 13, 17];
  let x = 0, y = 0, z = 0;
  for (const k of idx) { x += landmarks[k].x; y += landmarks[k].y; z += landmarks[k].z; }
  return { x: x / idx.length, y: y / idx.length, z: z / idx.length };
}

// 关键点平滑（逐点 EMA）
export function smoothLandmarks(prev, raw) {
  if (!prev) return raw.map((l) => ({ x: l.x, y: l.y, z: l.z }));
  const a = CONFIG.landmarkSmoothing;
  return raw.map((l, i) => ({
    x: prev[i].x + (l.x - prev[i].x) * a,
    y: prev[i].y + (l.y - prev[i].y) * a,
    z: prev[i].z + (l.z - prev[i].z) * a,
  }));
}

export function labelFor(open) {
  if (open < 0.18) return '握拳 · 收拢';
  if (open < 0.5) return '半张开';
  if (open < 0.82) return '张开';
  return '完全绽放';
}

// 速度自适应平滑（一欧元滤波思路）：快速移动→响应快，静止→强平滑抗抖，且与帧率无关
export class SignalSmoother {
  constructor() {
    this.value = 0;
    this.prevTarget = 0;
    this.velFiltered = 0;
    this.lastTime = -1;
  }
  update(target, nowMs) {
    const dt = this.lastTime < 0 ? 0.033 : Math.min(Math.max((nowMs - this.lastTime) / 1000, 0.001), 0.1);
    this.lastTime = nowMs;
    const instVel = (target - this.prevTarget) / dt;
    this.velFiltered += (instVel - this.velFiltered) * 0.3;   // 低通速度，抑制噪声
    this.prevTarget = target;
    const alpha = Math.min(1, 0.3 + Math.abs(this.velFiltered) * 1.0);
    this.value += (target - this.value) * alpha;
    return this.value;
  }
  set(v) { this.value = v; this.prevTarget = v; this.velFiltered = 0; }
}
