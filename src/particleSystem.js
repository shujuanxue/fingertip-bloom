// GPU 粒子系统：BufferGeometry + ShaderMaterial，一次分配、永不重建。
import * as THREE from 'three';
import { FLOWER_VERT, FLOWER_FRAG } from './shaders.js';
import { buildFlowerData } from './flowerGeometry.js';
import { CONFIG } from './config.js';

export function createParticleSystem(scene, count) {
  const data = buildFlowerData(count);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.aEnd, 3));
  geo.setAttribute('aStart', new THREE.BufferAttribute(data.aStart, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(data.aEnd, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(data.aPhase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(data.aSize, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(data.aColor, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(data.aSeed, 1));
  geo.setAttribute('aLayer', new THREE.BufferAttribute(data.aLayer, 1));

  const uniforms = {
    uBloom: { value: 0 },
    uTime: { value: 0 },
    uPointScale: { value: 300 },
    uHandPos: { value: new THREE.Vector3(0, 0, 0) },
    uHandForce: { value: 0 },
    uHue: { value: 0 },
    uColorMix: { value: 0 },
    uColorMode: { value: 0 },
    uShapeSX: { value: 1 },
    uShapeSY: { value: 1 },
    uShapeDY: { value: 0 },
    uShapeTwist: { value: 0 },
    uShapeLayer: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FLOWER_VERT,
    fragmentShader: FLOWER_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  return {
    points,
    uniforms,
    count: data.count,
    update({ bloom, time, handX = 0, handY = 0, handForce = 0, intensity = 1, pointScale = 300, hue = 0, colorMix = 0, colorMode = 0, shape = null }) {
      uniforms.uBloom.value = bloom;
      uniforms.uTime.value = time;
      uniforms.uHandPos.value.set(handX, handY, 0);
      uniforms.uHandForce.value = handForce;
      uniforms.uPointScale.value = pointScale * intensity;
      uniforms.uHue.value = hue;
      uniforms.uColorMix.value = colorMix;
      uniforms.uColorMode.value = colorMode;
      if (shape) {
        uniforms.uShapeSX.value = shape.sx;
        uniforms.uShapeSY.value = shape.sy;
        uniforms.uShapeDY.value = shape.dy;
        uniforms.uShapeTwist.value = shape.twist;
        uniforms.uShapeLayer.value = shape.layer;
      }
    },
  };
}
