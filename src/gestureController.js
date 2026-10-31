// MediaPipe HandLandmarker 封装 + 摄像头采集。
import { state } from './state.js';
import { computeOpenness, computePinch, palmCenter, smoothLandmarks, labelFor, classifyGesture, classifyShape, SignalSmoother } from './gestureMath.js';

// 资源基址用 import.meta.url 解析：兼容本地 localhost 与 GitHub Pages 子路径部署
const WASM_BASE = new URL('../assets/wasm/', import.meta.url).href;
const MODEL_URL = new URL('../assets/models/hand_landmarker.task', import.meta.url).href;

export function createGestureController(videoEl) {
  let landmarker = null;
  let stream = null;
  let initPromise = null;
  let ready = false;
  let lastVideoTime = -1;
  let lastDetect = 0;
  let smoothed = null;
  const smoother = new SignalSmoother();
  let gestureCandidate = 'none';
  let gestureCandidateSince = 0;
  let shapeCandidate = 'none';
  let shapeCandidateSince = 0;
  let shapeCooldownUntil = 0;

  async function doInit() {
    const { FilesetResolver, HandLandmarker } = await import(new URL('../assets/vision_bundle.mjs', import.meta.url).href);
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const opts = {
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    // Edge 等浏览器 GPU delegate 可能失败，自动回退 CPU
    try {
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }, ...opts,
      });
    } catch (e) {
      console.warn('[gesture] GPU 委托失败，回退 CPU：', e);
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' }, ...opts,
      });
    }
    ready = true;
  }

  function init() {
    if (!initPromise) initPromise = doInit();
    return initPromise;
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    videoEl.srcObject = null;
    smoothed = null;
    lastVideoTime = -1;
    state.set({ handActive: false, handOpenness: 0, gestureLabel: '—' });
  }

  // 限频检测（约 30fps），与渲染解耦
  function detect(nowMs) {
    if (!ready || !landmarker) { if (state.handActive) state.set({ handActive: false }); return; }
    if (videoEl.readyState < 2) return;
    if (nowMs - lastDetect < 45) return;
    lastDetect = nowMs;

    let res = null;
    try {
      if (videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        res = landmarker.detectForVideo(videoEl, nowMs);
      }
    } catch (e) {
      return;
    }

    if (res && res.landmarks && res.landmarks.length > 0) {
      const raw = res.landmarks[0];
      smoothed = smoothLandmarks(smoothed, raw);
      const openness = computeOpenness(smoothed);
      const pinch = computePinch(smoothed);
      const open = smoother.update(openness * 0.5 + pinch * 0.5, nowMs);   // 五指开合 + 拇指食指捏合 混合
      const palm = palmCenter(smoothed);
      // 稳定手势 → 颜色（连续同一手势 350ms 才切换，避免频繁跳变）
      const g = classifyGesture(smoothed);
      if (g !== gestureCandidate) { gestureCandidate = g; gestureCandidateSince = nowMs; }
      let gestureColor = state.gestureColor;
      if (g !== 'none' && nowMs - gestureCandidateSince > 350) gestureColor = g;
      // 稳定花形 → 形状（连续 350ms 才切换；五指张开/握拳时回到默认花形）
      const sh = classifyShape(smoothed);
      if (sh !== shapeCandidate) { shapeCandidate = sh; shapeCandidateSince = nowMs; }
      let shapeTarget = state.shapeTarget;
      // 稳定 350ms + 切换后 450ms 冷却，避免误识别/频繁跳变
      if (sh !== 'none' && nowMs - shapeCandidateSince > 350 && nowMs > shapeCooldownUntil) {
        if (shapeTarget !== sh) { shapeTarget = sh; shapeCooldownUntil = nowMs + 450; }
        else shapeTarget = sh;
      } else if ((g === 'green' || g === 'red') && nowMs - gestureCandidateSince > 350 && state.shapeTarget !== 'none') {
        shapeTarget = 'none';
        shapeCooldownUntil = nowMs + 450;
      }
      state.set({
        handActive: true,
        handOpenness: open,
        handX: 1 - palm.x * 2,        // 镜像 x，与摄像头预览一致
        handY: 1 - palm.y * 2,
        gestureLabel: labelFor(open),
        gestureColor,
        shapeTarget,
        landmarkCount: smoothed.length,
        gestureRaw: g,
        shapeRaw: sh,
      });
    } else {
      state.set({ handActive: false, gestureLabel: '未检测到手', shapeTarget: 'none', landmarkCount: 0, gestureRaw: 'none', shapeRaw: 'none' });
    }
  }

  return {
    init,
    startCamera,
    stopCamera,
    detect,
    get ready() { return ready; },
    getLandmarks: () => (smoothed ? [smoothed] : []),
    getFingertip: () => {
      if (!smoothed) return null;
      const tip = smoothed[8];         // 食指指尖
      return { x: 1 - tip.x * 2, y: 1 - tip.y * 2 };
    },
  };
}
