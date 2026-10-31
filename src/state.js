// 应用状态：单一事实源。渲染层与交互层都从这里读写，避免耦合。
const listeners = {};

function emit(event, payload) {
  (listeners[event] || []).forEach((fn) => {
    try { fn(payload); } catch (e) { console.error('[state]', e); }
  });
}

export const state = {
  view: 'home',           // home | experience | end
  cameraOn: false,
  mouseMode: false,
  audioOn: false,

  bloom: 0,               // 当前平滑后的绽放值 0..1（渲染层读取）
  targetBloom: 0,         // 目标绽放值（手势/鼠标写入）
  intensity: 1,           // 粒子强度（影响数量与亮度）

  handActive: false,      // 是否检测到手
  handCount: 0,           // 检测到的手数量（0/1/2）
  handOpenness: 0,        // 开合度 0..1（多手取平均）
  handX: 0,               // 掌心归一化坐标 -1..1
  handY: 0,               // 掌心归一化坐标 -1..1（-1=底部）
  handDistance: 1,        // 双手掌心归一化距离（单手/无手=1）
  gestureLabel: '—',

  specialBloom: 0,        // 特殊盛放脉冲 0..1（指数衰减）

  on(event, fn) {
    (listeners[event] ||= []).push(fn);
    return () => {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
    };
  },

  set(patch) {
    Object.assign(this, patch);
    emit('change', patch);
  },

  emit,
};
