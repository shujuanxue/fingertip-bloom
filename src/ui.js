// UI：三态页面切换、控制栏、摄像头关键点叠加绘制、Toast。
import { state } from './state.js';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export function initUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const els = {
    home: $('view-home'),
    exp: $('view-experience'),
    end: $('view-end'),
    status: $('status-text'),
    cameraWrap: $('camera-wrap'),
    video: $('camera-video'),
    overlay: $('camera-overlay'),
    gestureLabel: $('gesture-label'),
    bloomValue: $('bloom-value'),
    toast: $('toast'),
    btnStart: $('btn-start'),
    btnCamera: $('btn-camera'),
    btnFullscreen: $('btn-fullscreen'),
    rangeIntensity: $('range-intensity'),
    btnReset: $('btn-reset'),
    btnMouse: $('btn-mouse'),
    btnAudio: $('btn-audio'),
    btnEnd: $('btn-end'),
    btnScreenshot: $('btn-screenshot'),
    btnRestart: $('btn-restart'),
  };

  let toastTimer = null;
  const toast = (msg, ms = 2600) => {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
  };

  const showView = (name) => {
    state.set({ view: name });
    els.home.classList.toggle('hidden', name !== 'home');
    els.exp.classList.toggle('hidden', name !== 'experience');
    els.end.classList.toggle('hidden', name !== 'end');
  };

  const setStatus = (t) => { els.status.textContent = t; };
  const setGesture = (t) => { els.gestureLabel.textContent = t; };
  const setBloom = (t) => { els.bloomValue.textContent = t; };
  const showCamera = (on) => { els.cameraWrap.classList.toggle('hidden', !on); };

  const drawCameraOverlay = (hands) => {
    const c = els.overlay;
    const v = els.video;
    const ctx = c.getContext('2d');
    if (!hands || hands.length === 0 || v.videoWidth === 0) {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    const w = c.width, h = c.height;

    ctx.strokeStyle = 'rgba(255, 179, 198, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 220, 150, 0.95)';
    for (const landmarks of hands) {
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
        ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      }
      ctx.stroke();
      for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  els.btnStart.addEventListener('click', () => handlers.onStart());
  els.btnCamera.addEventListener('click', () => handlers.onToggleCamera());
  els.btnFullscreen.addEventListener('click', () => handlers.onFullscreen());
  els.rangeIntensity.addEventListener('input', (e) => handlers.onIntensity(parseFloat(e.target.value)));
  els.btnReset.addEventListener('click', () => handlers.onReset());
  els.btnMouse.addEventListener('click', () => handlers.onToggleMouse());
  els.btnAudio.addEventListener('click', () => handlers.onToggleAudio());
  els.btnEnd.addEventListener('click', () => handlers.onEnd());
  els.btnScreenshot.addEventListener('click', () => handlers.onScreenshot());
  els.btnRestart.addEventListener('click', () => handlers.onRestart());

  return { els, toast, showView, setStatus, setGesture, setBloom, showCamera, drawCameraOverlay };
}
