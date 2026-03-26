// display.js for U01: Tennis Session Analytics
// Dashboard visualization module — 2×2 panel
// Live stroke detection from raw IMU (accelX/Y/Z + gyroX/Y/Z)
// Court heatmap + session summary + stroke breakdown + speed timeline

export default {
  // ── Metadata ───────────────────────────────────────────────
  id: 'U01',
  name: 'Tennis Session',
  version: 2,

  // ── Data Contract ──────────────────────────────────────────
  channels: ['accel', 'gyro'],
  tier: 1,
  classification: 'sport-performance',
  unit: 'strokes',
  range: [0, 999],
  size: '2x2',

  // ── Parameters ─────────────────────────────────────────────
  params: [
    { name: 'Stroke Threshold', min: 2.0, max: 6.0, default: 3.0, step: 0.5, unit: 'g' },
    { name: 'Cooldown', min: 200, max: 1200, default: 600, step: 50, unit: 'ms' },
  ],

  // ── Stroke Colors ──────────────────────────────────────────
  _colors: {
    forehand: '#6366f1',
    backhand: '#06b6d4',
    serve: '#f59e0b',
    volley: '#22c55e',
    unclassified: '#6a6a82',
  },
  _typeLabels: ['FH', 'BH', 'SV', 'VO', '??'],
  _typeNames: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Unclassified'],
  _typeKeys: ['forehand', 'backhand', 'serve', 'volley', 'unclassified'],

  // ── Detection constants (match firmware Algo_U01.cpp) ─────
  _STROKE_THRESHOLD: 3.0,    // g — accel magnitude to trigger detection
  _COOLDOWN_MS: 600,         // ms between strokes (covers follow-through)
  _SWING_WINDOW_MS: 400,     // ms to collect peak values after trigger
  _SERVE_VERTICAL_G: 2.5,    // accelY threshold for serve detection
  _VOLLEY_MAX_DUR_MS: 150,   // strokes shorter than this → volley (only if window cut short)
  _SPEED_SCALE: 0.42,        // km/h per °/s peak gyro magnitude

  // ── Scoped CSS ─────────────────────────────────────────────
  css: `
    [data-algo-id="U01"] .u01-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
      height: 100%;
      gap: 8px;
      padding: 8px;
      box-sizing: border-box;
    }
    [data-algo-id="U01"] .u01-court-zone {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    [data-algo-id="U01"] .u01-court-title {
      font-family: var(--font-sans);
      font-size: 10px;
      font-weight: 600;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    [data-algo-id="U01"] .u01-court-canvas {
      flex: 1;
      min-height: 0;
      border-radius: var(--radius);
    }
    [data-algo-id="U01"] .u01-summary {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    [data-algo-id="U01"] .u01-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    [data-algo-id="U01"] .u01-stat-label {
      font-family: var(--font-sans);
      font-size: 11px;
      color: var(--text-3);
    }
    [data-algo-id="U01"] .u01-stat-value {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-1);
    }
    [data-algo-id="U01"] .u01-big-number {
      font-family: var(--font-mono);
      font-size: 36px;
      font-weight: 700;
      color: var(--text-1);
      line-height: 1;
    }
    [data-algo-id="U01"] .u01-big-unit {
      font-family: var(--font-sans);
      font-size: 11px;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    [data-algo-id="U01"] .u01-breakdown {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    [data-algo-id="U01"] .u01-bar-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    [data-algo-id="U01"] .u01-bar-label {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-3);
      width: 20px;
      flex-shrink: 0;
    }
    [data-algo-id="U01"] .u01-bar-track {
      flex: 1;
      height: 10px;
      background: var(--surface-1);
      border-radius: 5px;
      overflow: hidden;
    }
    [data-algo-id="U01"] .u01-bar-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.3s ease;
    }
    [data-algo-id="U01"] .u01-bar-count {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-2);
      width: 28px;
      text-align: right;
      flex-shrink: 0;
    }
    [data-algo-id="U01"] .u01-timeline-zone {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    [data-algo-id="U01"] .u01-timeline-canvas {
      width: 100%;
      height: 80px;
      border-radius: var(--radius);
    }
    [data-algo-id="U01"] .u01-live-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }
    [data-algo-id="U01"] .u01-live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      transition: background 0.3s ease;
    }
    [data-algo-id="U01"] .u01-live-text {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--text-3);
    }
    [data-algo-id="U01"] .u01-accel-bar {
      flex: 1;
      height: 4px;
      background: var(--surface-1);
      border-radius: 2px;
      overflow: hidden;
    }
    [data-algo-id="U01"] .u01-accel-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--accent);
      transition: width 0.1s ease, background 0.15s ease;
      width: 0%;
    }
  `,

  // ── Internal state ─────────────────────────────────────────
  _strokes: [],              // { type, speed, timestamp }
  _typeCounts: [0, 0, 0, 0, 0],
  _sessionStart: 0,
  _totalProcessed: 0,         // total samples processed (tracks sampleCount)
  _inSwing: false,             // state machine: currently in a swing?
  _swingSamples: 0,            // samples elapsed since swing trigger
  _swingPeakAccel: 0,          // peak accel magnitude during swing
  _swingPeakGyro: 0,           // peak gyro magnitude during swing
  _swingPeakGyroZ: 0,          // peak gyroZ (signed) — for FH/BH classification
  _swingPeakAccelY: 0,         // peak accelY — for serve detection
  _cooldownSamples: 0,         // remaining cooldown in samples
  _activeWindows: 0,           // count of windows with motion > 1.5g
  _totalWindows: 0,            // total tick count for active ratio

  // ── Render ─────────────────────────────────────────────────
  render(container, state) {
    container.innerHTML = `
      <div class="u01-wrap">
        <div class="u01-court-zone">
          <span class="u01-court-title">Stroke Map</span>
          <canvas class="u01-court-canvas"></canvas>
        </div>

        <div class="u01-summary">
          <div>
            <div class="u01-big-number" data-el="total">--</div>
            <div class="u01-big-unit">total strokes</div>
          </div>
          <div class="u01-stat-row">
            <span class="u01-stat-label">Session</span>
            <span class="u01-stat-value" data-el="session">0:00</span>
          </div>
          <div class="u01-stat-row">
            <span class="u01-stat-label">Active</span>
            <span class="u01-stat-value" data-el="active">0%</span>
          </div>
          <div class="u01-stat-row">
            <span class="u01-stat-label">Avg Speed</span>
            <span class="u01-stat-value" data-el="avgspd">-- km/h</span>
          </div>
          <div class="u01-stat-row">
            <span class="u01-stat-label">Max Speed</span>
            <span class="u01-stat-value" data-el="maxspd">-- km/h</span>
          </div>
          <div class="u01-breakdown" data-el="breakdown"></div>
          <div class="u01-live-bar">
            <div class="u01-live-dot" data-el="livedot"></div>
            <span class="u01-live-text" data-el="livetxt">LIVE --</span>
            <div class="u01-accel-bar">
              <div class="u01-accel-fill" data-el="accelfill"></div>
            </div>
          </div>
        </div>

        <div class="u01-timeline-zone">
          <span class="u01-court-title">Swing Speed Timeline</span>
          <canvas class="u01-timeline-canvas"></canvas>
        </div>
      </div>
    `;

    // Build breakdown bars
    const bd = container.querySelector('[data-el="breakdown"]');
    const colors = Object.values(this._colors);
    for (let i = 0; i < 4; i++) {
      bd.innerHTML += `
        <div class="u01-bar-row">
          <span class="u01-bar-label">${this._typeLabels[i]}</span>
          <div class="u01-bar-track">
            <div class="u01-bar-fill" data-bar="${i}" style="width:0%;background:${colors[i]}"></div>
          </div>
          <span class="u01-bar-count" data-cnt="${i}">0</span>
        </div>
      `;
    }

    // Size canvases
    state.util.sizeCanvas(container.querySelector('.u01-court-canvas'));
    state.util.sizeCanvas(container.querySelector('.u01-timeline-canvas'));

    // Read user-tunable params
    this._STROKE_THRESHOLD = (state.params && state.params['Stroke Threshold']) || 3.0;
    this._COOLDOWN_MS = (state.params && state.params['Cooldown']) || 600;

    // Init internal tracking
    this._strokes = [];
    this._typeCounts = [0, 0, 0, 0, 0];
    this._sessionStart = Date.now();
    this._totalProcessed = 0;
    this._inSwing = false;
    this._swingSamples = 0;
    this._swingPeakAccel = 0;
    this._swingPeakGyro = 0;
    this._swingPeakGyroZ = 0;
    this._swingPeakAccelY = 0;
    this._cooldownSamples = 0;
    this._activeWindows = 0;
    this._totalWindows = 0;

    // Draw empty court
    this._drawCourt(container.querySelector('.u01-court-canvas'));
  },

  // ── Update — live stroke detection from raw IMU ────────────
  update(container, state) {
    const now = Date.now();
    const elapsed = state.elapsed || 0;

    // Read user params (may change at runtime)
    this._STROKE_THRESHOLD = (state.params && state.params['Stroke Threshold']) || 3.0;
    this._COOLDOWN_MS = (state.params && state.params['Cooldown']) || 600;

    // ── Live stroke detection from per-axis IMU data ─────────
    const ax = state.sensorData?.accelX;
    const ay = state.sensorData?.accelY;
    const az = state.sensorData?.accelZ;
    const gx = state.sensorData?.gyroX;
    const gy = state.sensorData?.gyroY;
    const gz = state.sensorData?.gyroZ;

    const hasAxisData = ax && ay && az && ax.history.length > 0;

    if (hasAxisData) {
      const len = ax.history.length;
      // Use sampleCount to determine new samples (handles rolling buffer)
      let newSamples;
      if (typeof ax.sampleCount === 'number' && ax.sampleCount > 0) {
        newSamples = Math.max(0, ax.sampleCount - this._totalProcessed);
        this._totalProcessed = ax.sampleCount;
      } else {
        // Fallback: process last ~10 samples per update tick
        newSamples = Math.min(10, len);
      }
      const startIdx = Math.max(0, len - newSamples);

      // Sample-based timing (LSM6DS3 @ 50Hz → 20ms per sample)
      const samplePeriodMs = 20;
      const cooldownInSamples = Math.round(this._COOLDOWN_MS / samplePeriodMs);
      const swingWindowInSamples = Math.round(this._SWING_WINDOW_MS / samplePeriodMs);

      for (let i = startIdx; i < len; i++) {
        const axv = ax.history[i];
        const ayv = ay.history[i];
        const azv = az.history[i];
        const gxv = gx ? gx.history[i] || 0 : 0;
        const gyv = gy ? gy.history[i] || 0 : 0;
        const gzv = gz ? gz.history[i] || 0 : 0;

        const accelMag = Math.sqrt(axv * axv + ayv * ayv + azv * azv);
        const gyroMag = Math.sqrt(gxv * gxv + gyv * gyv + gzv * gzv);

        // Active ratio tracking
        this._totalWindows++;
        if (accelMag > 1.5) this._activeWindows++;

        // Sample-based cooldown (avoids wall-clock batch issues)
        if (this._cooldownSamples > 0) {
          this._cooldownSamples--;
          continue;
        }

        if (!this._inSwing) {
          // ── Trigger: accel magnitude exceeds threshold ──
          if (accelMag > this._STROKE_THRESHOLD) {
            this._inSwing = true;
            this._swingSamples = 0;
            this._swingPeakAccel = accelMag;
            this._swingPeakGyro = gyroMag;
            this._swingPeakGyroZ = gzv;
            this._swingPeakAccelY = ayv;
          }
        } else {
          // ── Collect peaks during full swing window ──
          this._swingSamples++;
          if (accelMag > this._swingPeakAccel) this._swingPeakAccel = accelMag;
          if (gyroMag > this._swingPeakGyro) this._swingPeakGyro = gyroMag;
          if (Math.abs(gzv) > Math.abs(this._swingPeakGyroZ)) this._swingPeakGyroZ = gzv;
          if (Math.abs(ayv) > Math.abs(this._swingPeakAccelY)) this._swingPeakAccelY = ayv;

          // ── End swing ONLY when window expires (no early exit) ──
          // Real tennis strokes have oscillating accel — early exit
          // on accel dips splits one swing into multiple false detections
          if (this._swingSamples >= swingWindowInSamples) {
            const swingDurMs = this._swingSamples * samplePeriodMs;
            const type = this._classifyStroke(
              this._swingPeakGyroZ,
              this._swingPeakAccelY,
              this._swingPeakGyro,
              swingDurMs
            );
            const speed = Math.min(Math.max(this._swingPeakGyro * this._SPEED_SCALE, 0), 250);

            this._strokes.push({ type, speed, timestamp: now, elapsed });
            this._typeCounts[type]++;

            this._inSwing = false;
            this._cooldownSamples = cooldownInSamples;
          }
        }
      }
    }

    const total = this._strokes.length;

    // ── Total strokes ──
    container.querySelector('[data-el="total"]').textContent = total > 0 ? total : '--';

    // ── Session time ──
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    container.querySelector('[data-el="session"]').textContent =
      `${mins}:${secs.toString().padStart(2, '0')}`;

    // ── Active ratio ──
    const activeRatio = this._totalWindows > 0 ? this._activeWindows / this._totalWindows : 0;
    container.querySelector('[data-el="active"]').textContent =
      `${Math.round(activeRatio * 100)}%`;

    // ── Speed stats ──
    if (total > 0) {
      const speeds = this._strokes.map(s => s.speed);
      const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const max = Math.max(...speeds);
      container.querySelector('[data-el="avgspd"]').textContent = `${Math.round(avg)} km/h`;
      container.querySelector('[data-el="maxspd"]').textContent = `${Math.round(max)} km/h`;
    }

    // ── Breakdown bars ──
    const maxCount = Math.max(...this._typeCounts.slice(0, 4), 1);
    for (let i = 0; i < 4; i++) {
      const pct = (this._typeCounts[i] / maxCount) * 100;
      const bar = container.querySelector(`[data-bar="${i}"]`);
      const cnt = container.querySelector(`[data-cnt="${i}"]`);
      if (bar) bar.style.width = `${pct}%`;
      if (cnt) cnt.textContent = this._typeCounts[i];
    }

    // ── Live indicator + accel magnitude bar ──
    const liveDot = container.querySelector('[data-el="livedot"]');
    const liveTxt = container.querySelector('[data-el="livetxt"]');
    const accelFill = container.querySelector('[data-el="accelfill"]');
    const accelMagNow = state.sensorData?.accel?.latest || 0;
    const isOnline = state.sensorData?.accel?.online;

    if (isOnline) {
      const pctAccel = Math.min((accelMagNow / 8) * 100, 100); // 8g full-scale
      accelFill.style.width = `${pctAccel}%`;
      if (this._inSwing) {
        liveDot.style.background = '#f59e0b';
        liveTxt.textContent = `SWING ${accelMagNow.toFixed(1)}g`;
        accelFill.style.background = '#f59e0b';
      } else if (accelMagNow > this._STROKE_THRESHOLD * 0.5) {
        liveDot.style.background = '#22c55e';
        liveTxt.textContent = `LIVE ${accelMagNow.toFixed(1)}g`;
        accelFill.style.background = '#22c55e';
      } else {
        liveDot.style.background = '#22c55e';
        liveTxt.textContent = `LIVE ${accelMagNow.toFixed(1)}g`;
        accelFill.style.background = 'var(--accent)';
      }
    } else {
      liveDot.style.background = '#ef4444';
      liveTxt.textContent = 'IMU offline';
      accelFill.style.width = '0%';
    }

    // ── Court heatmap ──
    this._drawCourt(container.querySelector('.u01-court-canvas'));

    // ── Speed timeline ──
    this._drawTimeline(container.querySelector('.u01-timeline-canvas'));
  },

  // ── Stroke classification (mirrors firmware logic) ─────────
  // Srivastava et al. 2015 / Whiteside et al. 2017
  _classifyStroke(peakGyroZ, peakAccelY, peakGyroMag, durationMs) {
    // Serve: high vertical accel + fast rotation
    if (Math.abs(peakAccelY) > this._SERVE_VERTICAL_G && peakGyroMag > 300) return 2;
    // Forehand: positive gyroZ (pronation) — check before volley
    if (peakGyroZ > 50) return 0;
    // Backhand: negative gyroZ (supination)
    if (peakGyroZ < -50) return 1;
    // Volley: low gyro (compact stroke, no full swing rotation)
    if (peakGyroMag < 150) return 3;
    // Unclassified
    return 4;
  },

  // ── Court heatmap drawing ──────────────────────────────────
  _drawCourt(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    // Court background
    ctx.fillStyle = '#1a3a1a';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 6 * dpr);
    ctx.fill();

    // Court lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1 * dpr;

    // Outer boundary
    const pad = 8 * dpr;
    const cw = W - 2 * pad;
    const ch = H - 2 * pad;
    ctx.strokeRect(pad, pad, cw, ch);

    // Net (horizontal center)
    const netY = pad + ch / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(pad, netY);
    ctx.lineTo(pad + cw, netY);
    ctx.stroke();

    // Service boxes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1 * dpr;
    const boxW = cw / 2;
    const boxH = ch * 0.30;
    ctx.strokeRect(pad, netY - boxH, boxW, boxH);
    ctx.strokeRect(pad + boxW, netY - boxH, boxW, boxH);
    ctx.strokeRect(pad, netY, boxW, boxH);
    ctx.strokeRect(pad + boxW, netY, boxW, boxH);

    // Center service line
    ctx.beginPath();
    ctx.moveTo(pad + cw / 2, netY - boxH);
    ctx.lineTo(pad + cw / 2, netY + boxH);
    ctx.stroke();

    // Heatmap overlay — 4×4 grid based on stroke type distribution
    if (this._strokes.length === 0) return;

    const cols = 4;
    const rows = 4;
    const cellW = cw / cols;
    const cellH = ch / rows;

    // Build zone counts from strokes
    const zones = new Array(cols * rows).fill(0);
    for (const s of this._strokes) {
      const zone = this._strokeToZone(s.type, s.speed);
      if (zone >= 0 && zone < zones.length) zones[zone]++;
    }

    const maxZone = Math.max(...zones, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const intensity = zones[idx] / maxZone;
        if (intensity > 0.01) {
          const alpha = 0.15 + intensity * 0.55;
          ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
          ctx.beginPath();
          ctx.roundRect(
            pad + c * cellW + 2 * dpr,
            pad + r * cellH + 2 * dpr,
            cellW - 4 * dpr,
            cellH - 4 * dpr,
            3 * dpr
          );
          ctx.fill();

          if (zones[idx] > 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.4 + intensity * 0.6})`;
            ctx.font = `${10 * dpr}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              zones[idx].toString(),
              pad + c * cellW + cellW / 2,
              pad + r * cellH + cellH / 2
            );
          }
        }
      }
    }
  },

  // Map stroke type to approximate court zone (4×4 grid)
  _strokeToZone(type, speed) {
    switch (type) {
      case 0: return speed > 100 ? 14 : speed > 60 ? 13 : 12; // FH → near baseline deuce
      case 1: return speed > 100 ? 15 : speed > 60 ? 12 : 11; // BH → near baseline ad
      case 2: return speed > 150 ? 2 : speed > 100 ? 1 : 3;   // SV → far baseline
      case 3: return speed > 80 ? 5 : 6;                        // VO → near net
      default: return (type * 7 + Math.floor(speed)) % 16;
    }
  },

  // ── Speed timeline drawing ─────────────────────────────────
  _drawTimeline(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#12121a';
    ctx.fillRect(0, 0, W, H);

    if (this._strokes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = `${11 * dpr}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Swing speeds will appear here...', W / 2, H / 2);
      return;
    }

    const padL = 32 * dpr, padR = 8 * dpr, padT = 8 * dpr, padB = 16 * dpr;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const speeds = this._strokes.map(s => s.speed);
    const sessionMax = Math.min(Math.max(...speeds) * 1.2, 250);

    // Y-axis labels + grid
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${9 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let spd = 0; spd <= sessionMax; spd += 50) {
      const y = padT + plotH - (spd / sessionMax) * plotH;
      ctx.fillText(`${spd}`, padL - 4 * dpr, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
    }

    // Plot each stroke as a dot
    const colorArr = Object.values(this._colors);
    const t0 = this._strokes[0].timestamp;
    const tEnd = this._strokes[this._strokes.length - 1].timestamp;
    const totalTime = Math.max(tEnd - t0, 1);

    for (let i = 0; i < this._strokes.length; i++) {
      const s = this._strokes[i];
      const xPct = this._strokes.length > 1 ? (s.timestamp - t0) / totalTime : 0.5;
      const x = padL + xPct * plotW;
      const y = padT + plotH - (s.speed / sessionMax) * plotH;

      ctx.fillStyle = colorArr[s.type] || colorArr[4];
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Glow for high speed
      if (s.speed > sessionMax * 0.8) {
        ctx.fillStyle = (colorArr[s.type] || colorArr[4]) + '40';
        ctx.beginPath();
        ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // ── Destroy ────────────────────────────────────────────────
  destroy(container) {
    this._strokes = [];
    this._typeCounts = [0, 0, 0, 0, 0];
    this._totalProcessed = 0;
    this._inSwing = false;
    this._swingSamples = 0;
    this._cooldownSamples = 0;
    this._activeWindows = 0;
    this._totalWindows = 0;
  },
};
