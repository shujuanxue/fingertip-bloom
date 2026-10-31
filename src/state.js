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

  // 幻彩绽放模式
  colorMode: false,       // 是否开启幻彩模式
  hueTarget: 0,           // 目标色相 0..1（红=0 / 金=0.12 / 绿=0.33 / 蓝=0.58）
  hueCurrent: 0,          // 当前平滑色相
  colorMix: 0,            // 0=原版配色, 1=幻彩配色（平滑过渡）
  colorTarget: 'red',     // 按钮选中的颜色名
  colorMixed: false,      // 是否幻彩混合模式
  gestureColor: 'none',   // 手势识别出的颜色名

  // 手势花形
  shapeTarget: 'none',    // none | butterfly | pointed | layered | spiral

  // 识别调试（真实反馈，不模拟）
  recogStatus: 'idle',    // idle | loading | ready | error
  recogError: '',
  recogTime: 0,           // 模型初始化耗时（秒）
  landmarkCount: 0,       // 每帧返回的关键点数量（21=有效）
  gestureRaw: 'none',     // 原始手势分类
  shapeRaw: 'none',       // 原始花形分类
  fingerStates: null,     // { thumb, index, middle, ring, pinky }
  handConfidence: 0,      // MediaPipe 手部置信度

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
