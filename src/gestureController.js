// MediaPipe HandLandmarker 封装 + 摄像头采集。
import { state } from './state.js';
import { computeOpenness, computePinch, palmCenter, smoothLandmarks, labelFor, SignalSmoother } from './gestureMath.js';

// 全部走本地资源：避免 storage.googleapis.com（国内网络常被墙）与 CDN 不稳定的问题
const WASM_BASE = '/assets/wasm';
const MODEL_URL = '/assets/models/hand_landmarker.task';

export function createGestureController(videoEl) {
  let landmarker = null;
  let stream = null;
  let initPromise = null;
  let ready = false;
  let lastVideoTime = -1;
  let lastDetect = 0;
  let smoothed = null;
  const smoother = new SignalSmoother();

  async function doInit() {
    const { FilesetResolver, HandLandmarker } = await import('/assets/vision_bundle.mjs');
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
    if (!ready || !landmarker) return;
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
      state.set({
        handActive: true,
        handOpenness: open,
        handX: 1 - palm.x * 2,        // 镜像 x，与摄像头预览一致
        handY: 1 - palm.y * 2,
        gestureLabel: labelFor(open),
      });
    } else {
      state.set({ handActive: false, gestureLabel: '未检测到手' });
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
