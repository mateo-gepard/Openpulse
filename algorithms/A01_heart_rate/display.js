// display.js for A01: Heart Rate
// Dashboard visualization module — full AI-authored rendering
// Big BPM number + color-coded HR zone arc + real-time sparkline + SQI bar

export default {
  // ── Metadata ───────────────────────────────────────────────
  id: 'A01',
  name: 'Heart Rate',
  version: 1,

  // ── Data Contract ──────────────────────────────────────────
  channels: ['ppg', 'accel'],
  tier: 0,
  classification: 'health-screening',
  unit: 'BPM',
  range: [30, 220],
  size: '1x1',

  // ── Parameters ─────────────────────────────────────────────
  params: [
    { name: 'Bandpass Low', min: 0.3, max: 1.0, default: 0.5, step: 0.1, unit: 'Hz' },
    { name: 'Bandpass High', min: 2.0, max: 5.0, default: 4.0, step: 0.5, unit: 'Hz' },
    { name: 'Peak Threshold K', min: 0.2, max: 1.5, default: 0.6, step: 0.1, unit: '×σ' },
  ],

  // ── HR Zones ───────────────────────────────────────────────
  _zones: [
    { min: 30,  max: 60,  color: '#06b6d4', label: 'Rest' },
    { min: 60,  max: 120, color: '#22c55e', label: 'Fat Burn' },
    { min: 120, max: 160, color: '#f59e0b', label: 'Cardio' },
    { min: 160, max: 220, color: '#ef4444', label: 'Peak' },
  ],

  // ── Scoped CSS ─────────────────────────────────────────────
  css: `
    [data-algo-id="A01"] .a01-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 6px;
      padding: 8px 0 4px;
      box-sizing: border-box;
    }
    [data-algo-id="A01"] .a01-gauge {
      position: relative;
      width: 180px;
      height: 110px;
      flex-shrink: 0;
    }
    [data-algo-id="A01"] .a01-gauge canvas {
      position: absolute;
      top: 0; left: 0;
    }
    [data-algo-id="A01"] .a01-bpm-group {
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      pointer-events: none;
    }
    [data-algo-id="A01"] .a01-bpm {
      font-family: var(--font-mono);
      font-size: 42px;
      font-weight: 700;
      line-height: 1;
      color: var(--text-1);
      transition: color 0.4s ease;
    }
    [data-algo-id="A01"] .a01-unit {
      font-family: var(--font-sans);
      font-size: 11px;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    [data-algo-id="A01"] .a01-zone-label {
      font-family: var(--font-sans);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 1px;
      transition: color 0.4s ease;
    }
    [data-algo-id="A01"] .a01-sparkline {
      width: 100%;
      height: 48px;
      flex-shrink: 0;
    }
    [data-algo-id="A01"] .a01-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0 12px;
      box-sizing: border-box;
    }
    [data-algo-id="A01"] .a01-sqi-wrap {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    [data-algo-id="A01"] .a01-sqi-bar-bg {
      width: 40px;
      height: 4px;
      background: var(--surface-1);
      border-radius: 2px;
      overflow: hidden;
    }
    [data-algo-id="A01"] .a01-sqi-bar {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease, background 0.3s ease;
    }
    [data-algo-id="A01"] .a01-sqi-text {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-3);
    }
    [data-algo-id="A01"] .a01-beat {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--red);
      opacity: 0.3;
      transition: opacity 0.1s ease;
    }
    [data-algo-id="A01"] .a01-beat.pulse {
      opacity: 1;
    }
  `,

  // ── Render ─────────────────────────────────────────────────
  render(container, state) {
    container.innerHTML = `
      <div class="a01-wrap">
        <div class="a01-gauge">
          <canvas class="a01-arc" width="180" height="110"></canvas>
          <div class="a01-bpm-group">
            <div class="a01-bpm">--</div>
            <div class="a01-unit">BPM</div>
            <div class="a01-zone-label" style="color: var(--text-3)">—</div>
          </div>
        </div>
        <canvas class="a01-sparkline"></canvas>
        <div class="a01-footer">
          <div class="a01-sqi-wrap">
            <div class="a01-sqi-bar-bg"><div class="a01-sqi-bar" style="width:0%;background:var(--text-3)"></div></div>
            <span class="a01-sqi-text">SQI --</span>
          </div>
          <div class="a01-beat"></div>
        </div>
      </div>
    `;

    // Size canvases for retina
    state.util.sizeCanvas(container.querySelector('.a01-arc'));
    state.util.sizeCanvas(container.querySelector('.a01-sparkline'));

    // Draw initial empty arc
    this._drawArc(container.querySelector('.a01-arc'), 0, null);

    // Beat pulse state
    this._lastBpm = 0;
    this._lastBeatTime = 0;
  },

  // ── Update ─────────────────────────────────────────────────
  update(container, state) {
    const bpm = state.output;
    const sqi = state.sqi;
    const valid = bpm > 0 && sqi >= 0.4;

    // ── BPM number ──
    const bpmEl = container.querySelector('.a01-bpm');
    bpmEl.textContent = valid ? Math.round(bpm) : '--';

    // ── Zone detection ──
    const zone = valid ? this._getZone(bpm) : null;
    bpmEl.style.color = zone ? zone.color : 'var(--text-1)';

    const zoneLabel = container.querySelector('.a01-zone-label');
    zoneLabel.textContent = zone ? zone.label : '—';
    zoneLabel.style.color = zone ? zone.color : 'var(--text-3)';

    // ── Arc gauge ──
    this._drawArc(container.querySelector('.a01-arc'), valid ? bpm : 0, zone);

    // ── Sparkline ──
    if (state.history && state.history.length > 0) {
      state.util.drawSparkline(
        container.querySelector('.a01-sparkline'),
        state.history,
        zone ? zone.color : '#6366f1'
      );
    }

    // ── SQI bar ──
    const sqiPct = Math.round(sqi * 100);
    const sqiColor = sqi >= 0.7 ? 'var(--green)' : sqi >= 0.4 ? 'var(--orange)' : 'var(--red)';
    container.querySelector('.a01-sqi-bar').style.width = sqiPct + '%';
    container.querySelector('.a01-sqi-bar').style.background = sqiColor;
    container.querySelector('.a01-sqi-text').textContent = 'SQI ' + sqiPct;

    // ── Beat pulse indicator ──
    const beatEl = container.querySelector('.a01-beat');
    const now = state.elapsed || Date.now();
    if (valid && Math.round(bpm) !== this._lastBpm) {
      beatEl.classList.add('pulse');
      this._lastBeatTime = now;
      this._lastBpm = Math.round(bpm);
    }
    if (now - this._lastBeatTime > 150) {
      beatEl.classList.remove('pulse');
    }
    beatEl.style.background = zone ? zone.color : 'var(--red)';
  },

  // ── Destroy ────────────────────────────────────────────────
  destroy(container) {
    this._lastBpm = 0;
    this._lastBeatTime = 0;
  },

  // ── Internal: get zone for BPM ─────────────────────────────
  _getZone(bpm) {
    for (const z of this._zones) {
      if (bpm >= z.min && bpm < z.max) return z;
    }
    // Above max zone boundary
    return this._zones[this._zones.length - 1];
  },

  // ── Internal: draw arc gauge ───────────────────────────────
  _drawArc(canvas, bpm, zone) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h - 6;
    const r = Math.min(cx - 8, cy - 4);
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const lineWidth = 8;

    // Background arc (full semicircle with zone segments)
    const zones = this._zones;
    const rangeMin = zones[0].min;
    const rangeMax = zones[zones.length - 1].max;
    const totalRange = rangeMax - rangeMin;

    for (const z of zones) {
      const a0 = startAngle + ((z.min - rangeMin) / totalRange) * Math.PI;
      const a1 = startAngle + ((z.max - rangeMin) / totalRange) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.strokeStyle = z.color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Active arc (filled to current BPM)
    if (bpm > 0 && zone) {
      const clampedBpm = Math.max(rangeMin, Math.min(bpm, rangeMax));
      const activeEnd = startAngle + ((clampedBpm - rangeMin) / totalRange) * Math.PI;
      ctx.globalAlpha = 1.0;

      // Gradient from start zone to current zone
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      const prevZones = zones.filter(z => z.min < clampedBpm);
      for (let i = 0; i < prevZones.length; i++) {
        const stop = (prevZones[i].min - rangeMin) / totalRange;
        grad.addColorStop(Math.max(stop, 0), prevZones[i].color);
      }
      grad.addColorStop(Math.min((clampedBpm - rangeMin) / totalRange, 1), zone.color);

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, activeEnd);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Needle dot at current position
      const nx = cx + r * Math.cos(activeEnd);
      const ny = cy + r * Math.sin(activeEnd);
      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, 2 * Math.PI);
      ctx.fillStyle = zone.color;
      ctx.shadowColor = zone.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  },
};
