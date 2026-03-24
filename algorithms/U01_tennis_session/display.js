// display.js for U01: Tennis Session Analytics
// Dashboard visualization module — 2×2 panel
// Court-style heatmap + session summary + stroke breakdown + speed timeline

export default {
  // ── Metadata ───────────────────────────────────────────────
  id: 'U01',
  name: 'Tennis Session',
  version: 1,

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
    { name: 'Cooldown', min: 200, max: 800, default: 400, step: 50, unit: 'ms' },
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
    [data-algo-id="U01"] .u01-sqi-mini {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
    }
    [data-algo-id="U01"] .u01-sqi-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      transition: background 0.3s ease;
    }
    [data-algo-id="U01"] .u01-sqi-text {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--text-3);
    }
    [data-algo-id="U01"] .u01-empty-state {
      grid-column: 1 / -1;
      grid-row: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--text-3);
    }
    [data-algo-id="U01"] .u01-empty-icon {
      font-size: 32px;
      opacity: 0.4;
    }
    [data-algo-id="U01"] .u01-empty-text {
      font-family: var(--font-sans);
      font-size: 13px;
    }
  `,

  // ── Internal state ─────────────────────────────────────────
  _strokes: [],       // Array of { type, speed, elapsed_ms }
  _typeCounts: [0, 0, 0, 0, 0],
  _sessionStart: 0,

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
          <div class="u01-sqi-mini">
            <div class="u01-sqi-dot" data-el="sqidot"></div>
            <span class="u01-sqi-text" data-el="sqitxt">SQI --</span>
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

    // Init internal tracking
    this._strokes = [];
    this._typeCounts = [0, 0, 0, 0, 0];
    this._sessionStart = Date.now();
    this._lastStrokeCount = 0;

    // Draw empty court
    this._drawCourt(container.querySelector('.u01-court-canvas'));
  },

  // ── Update ─────────────────────────────────────────────────
  update(container, state) {
    const total = Math.round(state.output) || 0;
    const sqi = state.sqi || 0;
    const valid = total > 0;

    // Detect new stroke from count increase
    if (total > this._lastStrokeCount && state.sensorData) {
      const newCount = total - this._lastStrokeCount;
      for (let i = 0; i < newCount; i++) {
        // Infer stroke from latest sensor data
        const stroke = this._inferStroke(state);
        this._strokes.push(stroke);
        this._typeCounts[stroke.type]++;
      }
      this._lastStrokeCount = total;
    }

    // ── Total strokes ──
    container.querySelector('[data-el="total"]').textContent = valid ? total : '--';

    // ── Session time ──
    const elapsed = state.elapsed || 0;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    container.querySelector('[data-el="session"]').textContent =
      `${mins}:${secs.toString().padStart(2, '0')}`;

    // ── Active ratio ──
    // Estimate from history variance
    const activeRatio = this._estimateActiveRatio(state);
    container.querySelector('[data-el="active"]').textContent =
      `${Math.round(activeRatio * 100)}%`;

    // ── Speed stats ──
    if (this._strokes.length > 0) {
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

    // ── Court heatmap ──
    this._drawCourt(container.querySelector('.u01-court-canvas'));

    // ── Speed timeline ──
    this._drawTimeline(container.querySelector('.u01-timeline-canvas'));

    // ── SQI ──
    const dot = container.querySelector('[data-el="sqidot"]');
    const sqiColor = sqi > 0.7 ? '#22c55e' : sqi > 0.4 ? '#f59e0b' : '#ef4444';
    dot.style.background = sqiColor;
    container.querySelector('[data-el="sqitxt"]').textContent =
      `SQI ${Math.round(sqi * 100)}`;
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
    // Top service boxes
    ctx.strokeRect(pad, netY - boxH, boxW, boxH);
    ctx.strokeRect(pad + boxW, netY - boxH, boxW, boxH);
    // Bottom service boxes
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
      // Map stroke type to preferred court zone
      // This is metaphorical — based on typical play patterns
      const zone = this._strokeToZone(s.type, s.speed);
      if (zone >= 0 && zone < zones.length) zones[zone]++;
    }

    const maxZone = Math.max(...zones, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const intensity = zones[idx] / maxZone;
        if (intensity > 0.01) {
          const colors = Object.values(this._colors);
          // Map to a warm heatmap
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

          // Count label
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
    // Zones: rows 0-1 = far side, rows 2-3 = near side (player)
    // Cols 0-1 = deuce side, cols 2-3 = ad side
    // Baseline strokes → rows 3 (near baseline)
    // Volleys → rows 1-2 (near net)
    // Serves → rows 0 (far baseline)
    const hash = (type * 7 + Math.floor(speed)) % 16;
    switch (type) {
      case 0: // Forehand — near baseline, deuce or cross
        return speed > 100 ? 14 : speed > 60 ? 13 : 12;
      case 1: // Backhand — near baseline, ad side
        return speed > 100 ? 15 : speed > 60 ? 12 : 11;
      case 2: // Serve — far baseline
        return speed > 150 ? 2 : speed > 100 ? 1 : 3;
      case 3: // Volley — near net
        return speed > 80 ? 5 : 6;
      default:
        return hash;
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
    ctx.fillStyle = 'var(--bg-1, #12121a)';
    ctx.fillRect(0, 0, W, H);

    if (this._strokes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = `${11 * dpr}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Swing speeds will appear here...', W / 2, H / 2);
      return;
    }

    const pad = { left: 32 * dpr, right: 8 * dpr, top: 8 * dpr, bottom: 16 * dpr };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Speed axis: 0–250 km/h
    const maxSpeed = 250;
    const speeds = this._strokes.map(s => s.speed);
    const sessionMax = Math.min(Math.max(...speeds) * 1.2, maxSpeed);

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${9 * dpr}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let spd = 0; spd <= sessionMax; spd += 50) {
      const y = pad.top + plotH - (spd / sessionMax) * plotH;
      ctx.fillText(`${spd}`, pad.left - 4 * dpr, y);
      // Grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Plot each stroke as a dot
    const colorArr = Object.values(this._colors);
    const totalTime = this._strokes.length > 1
      ? this._strokes[this._strokes.length - 1].elapsed - this._strokes[0].elapsed
      : 1;

    for (let i = 0; i < this._strokes.length; i++) {
      const s = this._strokes[i];
      const xPct = this._strokes.length > 1
        ? (s.elapsed - this._strokes[0].elapsed) / totalTime
        : 0.5;
      const x = pad.left + xPct * plotW;
      const y = pad.top + plotH - (s.speed / sessionMax) * plotH;

      // Dot
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

  // ── Helpers ────────────────────────────────────────────────
  _inferStroke(state) {
    // Infer stroke from latest sensor data snapshot
    const accel = state.sensorData?.accel;
    const gyro = state.sensorData?.gyro;
    const speed = (gyro?.latest || 300) * 0.42;
    const elapsed = state.elapsed || 0;

    // Simple type inference from gyro sign
    let type = 4; // unclassified
    if (gyro && accel) {
      const gz = gyro.latest || 0;
      const ay = accel.latest || 0;
      if (Math.abs(ay) > 2.5 && Math.abs(gz) > 400) type = 2; // serve
      else if (gz > 50) type = 0; // forehand
      else if (gz < -50) type = 1; // backhand
      else type = 3; // volley
    }

    return { type, speed: Math.min(Math.max(speed, 0), 250), elapsed };
  },

  _estimateActiveRatio(state) {
    if (!state.history || state.history.length < 10) return 0;
    // Rough estimate: ratio of non-zero output periods
    const recent = state.history.slice(-60);
    const active = recent.filter(v => v > 0).length;
    return active / recent.length;
  },

  // ── Destroy ────────────────────────────────────────────────
  destroy(container) {
    this._strokes = [];
    this._typeCounts = [0, 0, 0, 0, 0];
  },
};
