// 程序入口：装配模块 + requestAnimationFrame 主循环。
import { createScene } from './scene.js';
import { createEffects } from './effects.js';
import { createParticleSystem } from './particleSystem.js';
import { createTrail } from './trail.js';
import { createGestureController } from './gestureController.js';
import { createInteraction } from './interaction.js';
import { createAudio } from './audio.js';
import { initUI } from './ui.js';
import { state } from './state.js';
import { CONFIG } from './config.js';

const root = document.getElementById('scene-root');
const sceneApi = createScene();
root.appendChild(sceneApi.renderer.domElement);

const effects = createEffects(sceneApi.scene);

function detectParticleCount() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (coarse) return Math.max(CONFIG.minParticleCount, Math.floor(CONFIG.particleCount * 0.4));
  if (cores <= 4) return Math.floor(CONFIG.particleCount * 0.75);
  return Math.min(CONFIG.particleCount, CONFIG.maxParticleCount);
}

const particles = createParticleSystem(sceneApi.scene, detectParticleCount());
const trail = createTrail(sceneApi.scene);

const videoEl = document.getElementById('camera-video');
const gesture = createGestureController(videoEl);
const interaction = createInteraction(sceneApi.renderer.domElement);
const audio = createAudio();

let ui;
let specialHold = 0;

function cameraErrorText(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return '摄像头权限被拒绝，请在浏览器地址栏允许摄像头访问后重试';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return '未检测到摄像头设备';
  if (n === 'NotReadableError' || n === 'TrackStartError') return '摄像头被其他程序占用';
  return (e && e.message) || '未知错误';
}

async function enableCamera() {
  ui.setStatus('请求摄像头权限…');
  try {
    await gesture.startCamera();
    state.set({ cameraOn: true });
    ui.showCamera(true);
    ui.setStatus('摄像头已开启 · 正在加载识别模型…');
    return true;
  } catch (e) {
    console.error(e);
    const msg = cameraErrorText(e);
    ui.toast('无法开启摄像头：' + msg);
    state.set({ cameraOn: false, mouseMode: true });
    ui.els.btnMouse.classList.add('active');
    ui.setStatus('⚠️ 摄像头：' + msg + '（已切换鼠标模式）');
    return false;
  }
}

async function ensureRecognition() {
  state.set({ recogStatus: 'loading', recogError: '' });
  if (ui.els.btnRetry) ui.els.btnRetry.classList.add('hidden');
  try {
    await gesture.init();
    state.set({ recogStatus: 'ready' });
    ui.setStatus('就绪 · 手掌张开 = 绽放');
    return true;
  } catch (e) {
    state.set({ recogStatus: 'error', recogError: e.message || String(e) });
    console.error(e);
    if (ui.els.btnRetry) ui.els.btnRetry.classList.remove('hidden');
    ui.toast('手部识别加载失败：' + e.message);
    ui.setStatus('⚠️ 识别：' + e.message);
    return false;
  }
}

function onRetryRecog() {
  ui.setStatus('正在重新加载识别模型…');
  ensureRecognition();
}

async function startExperience() {
  ui.showView('experience');
  ui.setStatus('正在请求摄像头并加载识别模型…');
  // 摄像头权限与模型加载并行，缩短总等待时间
  const [camOk, recogOk] = await Promise.all([enableCamera(), ensureRecognition()]);
  if (camOk && recogOk) ui.setStatus('就绪 · 手掌张开 = 绽放');
  else if (camOk) ui.setStatus('⚠️ 识别加载失败 · 点「重试识别」');
}

async function toggleCamera() {
  if (state.cameraOn) {
    gesture.stopCamera();
    state.set({ cameraOn: false });
    ui.showCamera(false);
    ui.setStatus(state.mouseMode ? '鼠标模式' : '摄像头已关闭');
    return;
  }
  const camOk = await enableCamera();
  if (camOk) {
    if (!gesture.ready) await ensureRecognition();
    else ui.setStatus('就绪 · 手掌张开 = 绽放');
  }
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else throw new Error('当前浏览器不支持全屏');
    }
  } catch (e) {
    ui.toast('全屏操作失败：' + e.message);
  }
}

function syncFullscreenButton() {
  const on = isFullscreen();
  ui.els.btnFullscreen.classList.toggle('active', on);
  ui.els.btnFullscreen.textContent = on ? '⛶ 退出全屏' : '⛶ 全屏';
}

function onReset() {
  state.set({ bloom: 0, targetBloom: 0, specialBloom: 0 });
  ui.toast('已重置');
}

function toggleMouse() {
  const on = !state.mouseMode;
  state.set({ mouseMode: on });
  ui.els.btnMouse.classList.toggle('active', on);
  ui.toast(on ? '已启用鼠标模式（上下移动控制绽放）' : '已退出鼠标模式');
}

function toggleAudio() {
  if (audio.on) {
    audio.stop();
    ui.els.btnAudio.classList.remove('active');
  } else {
    audio.start();
    ui.els.btnAudio.classList.add('active');
  }
}

function onEnd() {
  ui.showView('end');
}

function onScreenshot() {
  sceneApi.composer.render();
  try {
    const url = sceneApi.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fingertip-bloom.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    ui.toast('已保存截图');
  } catch (e) {
    ui.toast('截图失败：' + e.message);
  }
}

function onRestart() {
  state.set({ bloom: 0, targetBloom: 0, specialBloom: 0 });
  ui.showView('experience');
  ui.setStatus('就绪 · 手掌张开 = 绽放');
}

// ---- 幻彩绽放模式 ----
function onColorMode() {
  const on = !state.colorMode;
  let name = state.colorTarget;
  if (!CONFIG.colors[name]) name = 'red';
  const c = CONFIG.colors[name];
  state.set({ colorMode: on, colorTarget: name, hueTarget: c.hue, colorMixed: !!c.mixed });
  ui.syncColorUI();
}

function onColorPick(name) {
  const c = CONFIG.colors[name];
  if (!c) return;
  state.set({ colorTarget: name, hueTarget: c.hue, colorMixed: !!c.mixed });
  ui.syncColorUI();
}

ui = initUI({
  onStart: startExperience,
  onToggleCamera: toggleCamera,
  onFullscreen: toggleFullscreen,
  onIntensity: (v) => state.set({ intensity: v }),
  onReset,
  onToggleMouse: toggleMouse,
  onColorMode,
  onColorPick,
  onRetryRecog,
  onToggleAudio: toggleAudio,
  onEnd,
  onScreenshot,
  onRestart,
});

document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

// 全局错误上屏：任何未捕获异常都显示到左上角状态栏，方便排查
window.addEventListener('error', (e) => {
  console.error('[global-error]', e.error || e.message);
  try { ui.setStatus('⚠️ 出错：' + (e.message || '未知错误')); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled-rejection]', e.reason);
  const m = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
  try { ui.setStatus('⚠️ 出错：' + m); } catch {}
});

// ---- 主循环 ----
let last = performance.now();
let elapsed = 0;
let quality = 1;
let fpsAccum = 0;
let fpsFrames = 0;
let lastGestureColor = 'none';
let lastShape = 'none';
let debugAccum = 0;
const shapeCur = { sx: 1, sy: 1, dy: 0, twist: 0, layer: 0 };

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;

  // 动态画质：帧率低于阈值自动降级（缩小粒子/减弱辉光），高于则恢复
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 1) {
    const fps = fpsFrames / fpsAccum;
    if (fps < 40) quality = Math.max(0.5, quality - 0.1);
    else if (fps > 55) quality = Math.min(1, quality + 0.05);
    fpsAccum = 0;
    fpsFrames = 0;
  }

  // 1. 手势检测（内部限频）
  gesture.detect(now);

  // 2. 力场与目标绽放值
  const force = interaction.update();
  const world = sceneApi.screenToWorld(force.x, force.y);
  let handForce = 0;
  if (force.active) {
    handForce = state.mouseMode ? 0.5 : 0.5 * (0.3 + state.handOpenness);
  }

  if (state.view === 'home') {
    state.targetBloom = 0.45 + Math.sin(elapsed * 0.4) * 0.35;   // 首页花朵缓慢开合，直接展示花瓣
  } else if (state.view === 'experience') {
    if (force.bloomHint != null) {
      state.targetBloom = force.bloomHint;                       // 鼠标模式
    } else if (state.handActive) {
      state.targetBloom = state.handOpenness;                    // 手势连续控制
    } else {
      state.targetBloom = 0.35 + Math.sin(elapsed * 0.4) * 0.25; // 无手时缓慢开合，始终可见花瓣
    }

    // 特殊盛放：持续张开超阈值
    if (state.handActive && state.handOpenness > 0.88) {
      specialHold += dt;
      if (specialHold > CONFIG.specialHoldTime) {
        state.specialBloom = 1;
        specialHold = 0;
      }
    } else {
      specialHold = 0;
    }
  }

  // 特殊盛放脉冲衰减
  if (state.specialBloom > 0.001) state.specialBloom *= Math.exp(-dt * 1.1);
  else state.specialBloom = 0;

  // 花形手势需要花朵展开才能看到形状 → 强制展开
  if (state.view === 'experience' && state.shapeTarget !== 'none') {
    state.targetBloom = Math.max(state.targetBloom, 0.85);
  }

  const target = Math.min(1, state.targetBloom + state.specialBloom * 0.35);
  state.bloom += (target - state.bloom) * Math.min(1, dt * 8.5);

  // 颜色仅由界面按钮控制，手势不改变颜色（避免与花形手势冲突）
  // （state.gestureColor 保留用于内部状态，不参与颜色决策）
  // 原版↔幻彩 平滑过渡
  const mixTarget = state.colorMode ? 1 : 0;
  state.colorMix += (mixTarget - state.colorMix) * Math.min(1, dt * 4);
  // 色相沿最短路径平滑过渡
  let dh = state.hueTarget - state.hueCurrent;
  if (dh > 0.5) dh -= 1;
  else if (dh < -0.5) dh += 1;
  state.hueCurrent = (state.hueCurrent + dh * Math.min(1, dt * 4) + 1) % 1;

  // 手势花形：平滑过渡到目标形状参数（蝶翼/尖瓣/多层/螺旋）
  const sp = CONFIG.shapes[state.shapeTarget] || CONFIG.shapes.none;
  const sk = Math.min(1, dt * 3);
  shapeCur.sx += (sp.sx - shapeCur.sx) * sk;
  shapeCur.sy += (sp.sy - shapeCur.sy) * sk;
  shapeCur.dy += (sp.dy - shapeCur.dy) * sk;
  shapeCur.twist += (sp.twist - shapeCur.twist) * sk;
  shapeCur.layer += (sp.layer - shapeCur.layer) * sk;

  // 3. 更新各子系统
  const pointScale = sceneApi.getPointScale();
  sceneApi.bloom.strength = CONFIG.bloomStrength * quality;
  particles.update({
    bloom: state.bloom,
    time: elapsed,
    handX: world.x,
    handY: world.y,
    handForce,
    intensity: state.intensity * quality,
    pointScale,
    hue: state.hueCurrent,
    colorMix: state.colorMix,
    colorMode: state.colorMixed ? 1 : 0,
    shape: shapeCur,
  });
  effects.update({ time: elapsed, bloom: state.bloom, pointScale });
  audio.update();

  // 指尖 / 鼠标能量轨迹（粉金光点，随指尖流动）
  let spawnPoint = null;
  if (state.handActive) {
    const tip = gesture.getFingertip();
    if (tip) {
      const w = sceneApi.screenToWorld(tip.x, tip.y);
      spawnPoint = { x: w.x, y: w.y, z: 0.3 };
    }
  } else if (state.mouseMode && force.active) {
    spawnPoint = { x: world.x, y: world.y, z: 0.3 };
  }
  trail.update({ pointScale, spawnPoint });

  // 4. HUD 与摄像头叠加
  ui.drawCameraOverlay(gesture.getLandmarks());
  ui.setGesture(state.gestureLabel || '—');
  ui.setBloom(Math.round(state.bloom * 100) + '%');
  // 手势花形提示高亮（仅在切换时更新 DOM）+ 淡入名称浮层
  if (state.shapeTarget !== lastShape) {
    lastShape = state.shapeTarget;
    ui.syncShapeHint(state.shapeTarget);
    const SHAPE_NAMES = { butterfly: '蝶翼花', pointed: '尖瓣百合', layered: '重瓣菊花', spiral: '螺旋玫瑰' };
    if (SHAPE_NAMES[state.shapeTarget]) ui.flashShapeName(SHAPE_NAMES[state.shapeTarget]);
  }

  // 真实调试反馈（约 5fps 刷新，显示实际识别结果，不模拟）
  debugAccum += dt;
  if (debugAccum > 0.2) {
    debugAccum = 0;
    const recog = state.recogStatus === 'ready' ? ('就绪 ' + (state.recogTime ? state.recogTime.toFixed(1) + 's' : '—'))
      : state.recogStatus === 'error' ? ('错误 ' + state.recogError)
      : state.recogStatus === 'loading' ? '加载中…' : '未启动';
    const hand = state.handActive
      ? ('检测到 ' + state.landmarkCount + '点 ' + Math.round(state.handConfidence * 100) + '%')
      : '未检测到';
    const fs = state.fingerStates;
    const fingers = fs
      ? ('拇' + (fs.thumb ? '伸' : '收') + ' 食' + (fs.index ? '伸' : '收') + ' 中' + (fs.middle ? '伸' : '收') + ' 无' + (fs.ring ? '伸' : '收') + ' 小' + (fs.pinky ? '伸' : '收'))
      : '—';
    ui.setDebug(
      '识别   ' + recog + '\n' +
      '手     ' + hand + '\n' +
      '手指   ' + fingers + '\n' +
      '原始手势 ' + state.gestureRaw + '\n' +
      '原始花形 ' + state.shapeRaw + '\n' +
      '当前花形 ' + state.shapeTarget + '\n' +
      '绽放   ' + Math.round(state.bloom * 100) + '%'
    );
  }

  // 5. 渲染
  sceneApi.composer.render();
}

requestAnimationFrame(loop);
