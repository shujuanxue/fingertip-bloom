// 手势参数计算：MediaPipe 关键点 → 连续开合参数 0..1（按手掌尺度归一化）。
import { CONFIG } from './config.js';

const WRIST = 0;
const FINGER_TIPS = [8, 12, 16, 20];   // 食/中/无名/小指 指尖
const FINGER_MCPS = [5, 9, 13, 17];    // 对应掌指关节
const THUMB_TIP = 4;
const THUMB_IP = 3;
const THUMB_MCP = 2;

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

// 关节夹角（在 b 点，0..PI）
function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const n1 = Math.hypot(v1x, v1y, v1z) || 1e-6;
  const n2 = Math.hypot(v2x, v2y, v2z) || 1e-6;
  const cos = (v1x * v2x + v1y * v2y + v1z * v2z) / (n1 * n2);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

// 单指伸展：关节伸直度(指尖-指根 / 两段之和) + PIP关节角 + 相对掌宽的指尖外伸量，三者综合。
// 全部用相对几何量，天然兼容左右手、手掌远近与旋转、摄像头镜像。
function fingerExtended(lm, mcpIdx, pipIdx, tipIdx, palmScale, loose = false) {
  const mcp = lm[mcpIdx], pip = lm[pipIdx], tip = lm[tipIdx];
  const straight = dist(tip, mcp) / (dist(mcp, pip) + dist(pip, tip) + 1e-6);
  const angle = jointAngle(mcp, pip, tip);
  const reach = (dist(tip, lm[WRIST]) - dist(mcp, lm[WRIST])) / palmScale;
  const sTh = loose ? 0.6 : 0.8;
  const aTh = loose ? 1.5 : 2.2;
  const rTh = loose ? 0.12 : 0.3;
  return straight > sTh && angle > aTh && reach > rTh;
}

// 五根手指独立伸展状态（拇指使用独立关节链）
export function computeFingerStates(lm) {
  const none = { thumb: false, index: false, middle: false, ring: false, pinky: false };
  if (!lm || lm.length < 21) return none;
  const palmScale = dist(lm[WRIST], lm[9]) || 1e-4;
  return {
    thumb: fingerExtended(lm, THUMB_MCP, THUMB_IP, THUMB_TIP, palmScale, true),
    index: fingerExtended(lm, 5, 6, 8, palmScale),
    middle: fingerExtended(lm, 9, 10, 12, palmScale),
    ring: fingerExtended(lm, 13, 14, 16, palmScale),
    pinky: fingerExtended(lm, 17, 18, 20, palmScale),
  };
}

/**
 * 手势 → 颜色映射：
 * 五指张开=绿 / 食指+中指=蓝 / 拇指食指捏合=金 / 握拳=红
 */
export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'none';
  const fs = computeFingerStates(lm);
  const palmScale = dist(lm[WRIST], lm[9]) || 1e-4;
  const pinchD = dist(lm[THUMB_TIP], lm[8]) / palmScale;
  const count = (fs.index ? 1 : 0) + (fs.middle ? 1 : 0) + (fs.ring ? 1 : 0) + (fs.pinky ? 1 : 0);

  if (count >= 4) return 'green';                                     // 五指张开
  if (fs.index && fs.middle && !fs.ring && !fs.pinky) return 'blue';  // 食指+中指
  if (pinchD < 0.6 && fs.index && count <= 2) return 'gold';          // 拇指食指捏合
  if (count === 0) return 'red';                                      // 握拳
  return 'none';
}

/**
 * 花形手势（六种手势之一，基于五指独立状态 + 指尖距离，严格区分三指/OK、食指/中指）：
 */
export function classifyShape(lm) {
  if (!lm || lm.length < 21) return 'none';
  const fs = computeFingerStates(lm);
  const palmScale = dist(lm[WRIST], lm[9]) || 1e-4;
  const pinchD = dist(lm[THUMB_TIP], lm[8]) / palmScale;   // 拇指-食指指尖距离
  const pinchClose = pinchD < 0.55;                         // 指尖接触

  // OK：拇指食指指尖接触 + 中/无名/小指伸出（小指伸展是区别于三指的关键）
  if (pinchClose && fs.middle && fs.ring && fs.pinky) return 'spiral';
  // 重瓣菊花：食+中+无名伸出、小指收拢、拇指食指不接触
  if (fs.index && fs.middle && fs.ring && !fs.pinky && !pinchClose) return 'layered';
  // 尖瓣百合：仅食指
  if (fs.index && !fs.middle && !fs.ring && !fs.pinky) return 'pointed';
  // 蝶翼花：仅中指
  if (!fs.index && fs.middle && !fs.ring && !fs.pinky) return 'butterfly';
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
