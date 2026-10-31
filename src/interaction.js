// 交互：鼠标备用模式 + 手部/鼠标 → 局部力场。
import { state } from './state.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createInteraction(domElement) {
  let mx = 0, my = 0;          // 归一化 -1..1（y 上=1）
  let mouseSeen = false;

  const onPointer = (e) => {
    const r = domElement.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    my = -(((e.clientY - r.top) / r.height) * 2 - 1);
    mouseSeen = true;
  };

  domElement.addEventListener('pointermove', onPointer);
  domElement.addEventListener('pointerdown', onPointer);

  return {
    // 返回力场中心（归一化坐标）、是否激活、以及鼠标模式的绽放提示
    update() {
      if (state.mouseMode && mouseSeen) {
        return { x: mx, y: my, active: true, bloomHint: clamp01((my + 1) / 2) };
      }
      if (state.handActive) {
        return { x: state.handX, y: state.handY, active: true, bloomHint: null };
      }
      return { x: 0, y: 0, active: false, bloomHint: null };
    },
  };
}
