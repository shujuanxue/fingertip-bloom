// 集中参数配置：所有可调项都在这里，便于调参。
export const CONFIG = {
  // ---- 花朵形态 ----
  particleCount: 22000,        // 纯粒子花朵主体（按设备动态缩放）
  minParticleCount: 6000,      // 低端下限
  maxParticleCount: 34000,     // 高端上限
  petalCount: 16,              // 花瓣数量
  petalLayers: 2,              // 花瓣层数（内层 + 外层）
  flowerRadius: 4.5,           // 盛放时的花朵半径（世界单位）
  coreRadius: 0.75,            // 中心光核半径
  budScale: 0.16,              // 花苞时径向收缩比例
  budElongateY: 1.9,           // 花苞时竖向拉长倍数（竖向椭圆）

  // ---- 色彩（玫瑰粉/樱花粉/淡紫/香槟金）----
  palette: {
    core: [1.0, 0.88, 0.62],        // 香槟金光核
    innerPetal: [0.98, 0.42, 0.56], // 玫瑰粉
    outerPetal: [1.0, 0.70, 0.80],  // 樱花粉
    edge: [1.0, 0.84, 0.90],        // 花瓣边缘亮粉
    accent: [0.82, 0.62, 0.98],     // 淡紫
    gold: [1.0, 0.82, 0.55],        // 香槟金
  },

  // ---- 手势 ----
  smoothing: 0.4,              // 开合值平滑（现由速度自适应滤波器接管）
  landmarkSmoothing: 0.6,      // 关键点平滑系数（调高，降低延迟）
  hysteresis: 0.004,           // 迟滞带（调小）
  confirmFrames: 3,            // 手势切换需连续确认帧数
  specialHoldTime: 1.2,        // 触发特殊盛放需持续张开秒数

  // ---- 渲染 ----
  targetFPS: 60,
  maxPixelRatio: 1.5,          // devicePixelRatio 上限（降低填充率，流畅度优先）
  pointScaleFactor: 0.7,       // 粒子尺寸整体缩放（更小更锐利，突出花瓣结构）
  bloomStrength: 0.30,         // UnrealBloom 强度（调低，避免中心泛白成光团）
  bloomRadius: 0.5,
  bloomThreshold: 0.5,         // 更高阈值：只让最亮粒子发光，保留花瓣轮廓

  // ---- 力场 ----
  handForceRadius: 2.6,        // 手部位置作用半径（世界单位）
  handForceStrength: 1.4,      // 局部吸引/排斥强度

  // ---- 星尘背景 ----
  starCount: 260,
};
