// 场景：渲染器、相机、场景与后期合成（EffectComposer + UnrealBloom）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG } from './config.js';

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0508, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0508);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold
  );
  composer.addPass(bloom);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // 屏幕归一化坐标 → 世界坐标（供手部力场使用）
  const screenToWorld = (nx, ny) => {
    const visibleH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const visibleW = visibleH * camera.aspect;
    return { x: nx * visibleW * 0.5, y: ny * visibleH * 0.5 };
  };

  const getPointScale = () =>
    (renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360))) * CONFIG.pointScaleFactor;

  return { renderer, scene, camera, composer, bloom, resize, screenToWorld, getPointScale };
}
