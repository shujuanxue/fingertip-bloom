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
  try {
    await gesture.init();
    ui.setStatus('就绪 · 手掌张开 = 绽放');
    return true;
  } catch (e) {
    console.error(e);
    ui.toast('手部识别加载失败：' + e.message);
    ui.setStatus('⚠️ 识别：' + e.message);
    return false;
  }
}

async function startExperience() {
  ui.showView('experience');
  const camOk = await enableCamera();
  if (camOk) await ensureRecognition();
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

ui = initUI({
  onStart: startExperience,
  onToggleCamera: toggleCamera,
  onFullscreen: toggleFullscreen,
  onIntensity: (v) => state.set({ intensity: v }),
  onReset,
  onToggleMouse: toggleMouse,
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

  const target = Math.min(1, state.targetBloom + state.specialBloom * 0.35);
  state.bloom += (target - state.bloom) * Math.min(1, dt * 8.5);

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

  // 5. 渲染
  sceneApi.composer.render();
}

requestAnimationFrame(loop);
