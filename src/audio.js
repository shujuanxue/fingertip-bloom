// 程序化环境音：WebAudio 合成，随绽放值变化音高/滤波，无版权素材。
import { state } from './state.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let filter = null;
  let osc1 = null;
  let osc2 = null;
  let started = false;

  function start() {
    if (started) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(master);

    osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 110;
    const g1 = ctx.createGain();
    g1.gain.value = 0.34;
    osc1.connect(g1);
    g1.connect(filter);

    osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 164.8;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    osc2.connect(g2);
    g2.connect(filter);

    osc1.start();
    osc2.start();
    started = true;
    master.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 1.5);
  }

  function stop() {
    if (!ctx || !started) return;
    try {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => {
        osc1 && osc1.stop();
        osc2 && osc2.stop();
        ctx && ctx.close();
      }, 600);
    } catch { /* noop */ }
    started = false;
    ctx = null;
  }

  function update() {
    if (!ctx || !started) return;
    const b = state.bloom;
    const now = ctx.currentTime;
    osc1.frequency.setTargetAtTime(110 + b * 110, now, 0.2);
    osc2.frequency.setTargetAtTime(164.8 + b * 98, now, 0.2);
    filter.frequency.setTargetAtTime(600 + b * 2400, now, 0.2);
  }

  return { start, stop, update, get on() { return started; } };
}
