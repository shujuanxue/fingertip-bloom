// GLSL 着色器源码（字符串导出，零构建直接内联使用）

export const FLOWER_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aLayer;

  uniform float uBloom;
  uniform float uTime;
  uniform float uPointScale;
  uniform vec3 uHandPos;
  uniform float uHandForce;
  uniform float uConverge;
  uniform float uHue;
  uniform float uColorMix;
  uniform float uColorMode;
  uniform float uShapeSX;
  uniform float uShapeSY;
  uniform float uShapeDY;
  uniform float uShapeTwist;
  uniform float uShapeLayer;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vLayer;

  float easeOutCubic(float t) { return 1.0 - pow(1.0 - t, 3.0); }

  // 颜色：RGB<->HSV，用于幻彩模式的整朵花变色
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    // 逐粒子绽放进度：aPhase 越小的粒子越早打开（光核→内层→外层→能量）
    float seq = clamp((uBloom - aPhase * 0.4) / 0.6, 0.0, 1.0);
    float b = easeOutCubic(seq);

    vec3 pos = mix(aStart, aEnd, b);

    // 有机漂移：能量层略明显，但整体收小，让粒子贴着花瓣流动而非四散
    float drift = mix(0.03, 0.16, step(2.5, aLayer));
    float t = uTime;
    pos.x += sin(t * 0.60 + aSeed * 6.2831) * drift;
    pos.y += cos(t * 0.50 + aSeed * 12.9898) * drift;
    pos.z += sin(t * 0.40 + aSeed * 78.233) * drift * 0.4;

    // 手部力场：局部排斥，保持花朵结构
    if (uHandForce > 0.001) {
      vec2 d = pos.xy - uHandPos.xy;
      float dist = length(d);
      float rad = 2.8;
      if (dist < rad && dist > 0.001) {
        float f = pow(1.0 - dist / rad, 2.0) * uHandForce;
        pos.xy += (d / dist) * f * 1.2;
      }
    }

    // 双手靠近 → 粒子向中央汇聚
    if (uConverge > 0.001) {
      pos.xy *= (1.0 - uConverge * 0.35);
      pos.z *= (1.0 - uConverge * 0.2);
    }

    // 手势花形变形：各向异性缩放 + 上移 + 螺旋扭转 + 多层分圈（平滑参数）
    float shapeAmt = abs(uShapeSX - 1.0) + abs(uShapeSY - 1.0) + abs(uShapeDY) + abs(uShapeTwist) + abs(uShapeLayer);
    if (shapeAmt > 0.001) {
      vec2 sp = pos.xy;
      float sr = length(sp) + 1e-5;
      float sa = atan(sp.y, sp.x);
      sa += uShapeTwist * (sr / 5.0);                     // 螺旋：沿半径扭转
      sr += uShapeLayer * floor(aSeed * 3.0) * 1.3;       // 多层：按 seed 分 3 圈
      sp = vec2(cos(sa), sin(sa)) * sr;
      sp.x *= uShapeSX;
      sp.y *= uShapeSY;
      sp.y += uShapeDY;
      pos.xy = mix(pos.xy, sp, b);                        // 只在开放时显现花形（花苞不受影响）
      pos.z += uShapeLayer * (aSeed - 0.5) * 3.0;
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = aSize * uPointScale / max(-mv.z, 0.001);
    gl_PointSize = clamp(size, 0.5, 64.0);

    // 幻彩模式：单色 或 混合多色（按花瓣方位分布不同色相 + 花心暖金 + 花瓣内渐变）
    if (uColorMix > 0.001) {
      vec3 hsv = rgb2hsv(aColor);
      float hue;
      if (uColorMode > 0.5) {
        float ang = atan(aEnd.y, aEnd.x);
        float pt = (ang + 3.14159265) / 6.28318531;      // 0..1 绕花一圈
        float pid = floor(pt * 16.0);
        float k = mod(pid, 4.0);
        hue = k < 0.5 ? 0.0 : (k < 1.5 ? 0.12 : (k < 2.5 ? 0.33 : 0.58));
        if (aLayer < 0.5) hue = 0.10;                     // 花心暖金，形成层次
        hue += (aSeed - 0.5) * 0.05;                      // 同一花瓣内自然渐变
        hsv.y *= 0.82;                                    // 降低饱和，保持梦幻高级
      } else {
        hue = uHue + (aSeed - 0.5) * 0.05;
      }
      vec3 tinted = hsv2rgb(vec3(fract(hue), clamp(hsv.y, 0.0, 1.0), hsv.z));
      vColor = mix(aColor, tinted, uColorMix);
    } else {
      vColor = aColor;
    }
    vLayer = aLayer;

    float alpha = 0.26 + 0.38 * b;
    if (aLayer > 2.5) {
      alpha *= 0.5;                   // 外围能量更淡
    } else if (aLayer < 0.5) {
      alpha = 0.4 + 0.2 * b;          // 光核（降亮度）
    }
    vAlpha = alpha;
  }
`;

export const FLOWER_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vLayer;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    vec3 col = vColor * (0.5 + glow * 0.45 + core * 0.7);
    float a = glow * vAlpha + core * vAlpha * 0.35;
    gl_FragColor = vec4(col, a);
  }
`;

// 背景渐变（深紫黑 → 极暗红）
export const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const BG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uCenter;
  uniform vec3 uEdge;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    vec3 col = mix(uCenter, uEdge, smoothstep(0.25, 1.15, d));
    col += vec3(0.03, 0.0, 0.04) * (1.0 - smoothstep(0.0, 0.55, d));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// 星尘（闪烁 + 漂浮）
export const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPointScale;
  varying float vA;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.08 + aSeed * 6.2831) * 1.5;
    p.y += cos(uTime * 0.06 + aSeed * 12.98) * 1.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.5 + 0.5 * sin(uTime * (0.4 + aSeed * 1.6) + aSeed * 40.0);
    vA = 0.18 + tw * 0.5;
    gl_PointSize = clamp(aSize * uPointScale / max(-mv.z, 0.001), 0.5, 8.0);
  }
`;

export const STAR_FRAG = /* glsl */ `
  precision highp float;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.9, 0.95) * glow, glow * vA);
  }
`;
