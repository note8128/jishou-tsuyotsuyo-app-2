import {
  type Analysis,
  type AppState,
  DAY_NAMES,
  addDays,
  clamp,
  dateKey,
  durText,
  fmtHM,
  logDuration,
  monDay,
  nextAlarm,
  relFrom18,
  sleepNeedMin,
  startOfDay,
} from './lib';

function rangeSlots(range: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
}

// 睡眠時間の棒グラフ
export function DurationChart({ state, a, range }: { state: AppState; a: Analysis; range: number }) {
  const W = 320,
    H = 130,
    top = 14,
    bottom = 20,
    left = 22;
  const slots = rangeSlots(range);
  const maxH = 10;
  const y = (h: number) => top + (H - top - bottom) * (1 - h / maxH);
  const bw = (W - left) / slots.length;
  const gy = y(state.settings.goal);
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {[0, 4, 8].map((h) => (
        <g key={h}>
          <line x1={left} x2={W} y1={y(h)} y2={y(h)} stroke="var(--line)" />
          <text x={left - 4} y={y(h) + 3} textAnchor="end">
            {h}h
          </text>
        </g>
      ))}
      {slots.map((d, i) => {
        const log = state.logs.find((l) => l.date === dateKey(d));
        const x = left + i * bw + bw * 0.18,
          w = bw * 0.64;
        let body;
        if (log) {
          const hrs = Math.min(maxH, logDuration(log) / 60);
          const ok = hrs * 60 >= a.goalMin - 15;
          body = (
            <>
              <rect x={x} y={y(hrs)} width={w} height={y(0) - y(hrs)} rx={3} fill={ok ? 'var(--accent)' : 'var(--warn)'}>
                <title>{`${dateKey(d)} ${durText(hrs * 60)}`}</title>
              </rect>
              {range <= 7 && (
                <text x={x + w / 2} y={y(hrs) - 3} textAnchor="middle" style={{ fill: 'var(--text)' }}>
                  {hrs.toFixed(1)}
                </text>
              )}
            </>
          );
        } else {
          body = (
            <text x={x + w / 2} y={y(0) - 4} textAnchor="middle">
              -
            </text>
          );
        }
        return (
          <g key={i}>
            {body}
            {(range <= 7 || i % 2 === 1) && (
              <text x={x + w / 2} y={H - 6} textAnchor="middle">
                {range <= 7 ? DAY_NAMES[monDay(d)] : d.getDate()}
              </text>
            )}
          </g>
        );
      })}
      <line x1={left} x2={W} y1={gy} y2={gy} stroke="var(--sun)" strokeDasharray="4 3" strokeWidth={1.5} />
    </svg>
  );
}

// 就寝〜起床の帯グラフ（21:00〜11:00）
export function RhythmChart({ state, range }: { state: AppState; range: number }) {
  const W = 320,
    H = 120,
    top = 6,
    bottom = 18,
    left = 34;
  const slots = rangeSlots(range);
  const startRel = 180,
    span = 840; // 18:00 起点で 21:00 から 14 時間
  const y = (rel: number) => top + (H - top - bottom) * clamp((rel - startRel) / span, 0, 1);
  const bw = (W - left) / slots.length;
  const na = nextAlarm(state);
  const rb = na ? relFrom18(new Date(na.at.getTime() - sleepNeedMin(state) * 60000)) : null;
  const grid: [string, number][] = [
    ['21:00', 180],
    ['0:00', 360],
    ['3:00', 540],
    ['6:00', 720],
    ['9:00', 900],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {grid.map(([lb, rel]) => (
        <g key={lb}>
          <line x1={left} x2={W} y1={y(rel)} y2={y(rel)} stroke="var(--line)" />
          <text x={left - 4} y={y(rel) + 3} textAnchor="end">
            {lb}
          </text>
        </g>
      ))}
      {/* 推奨就寝ライン */}
      {rb != null && <line x1={left} x2={W} y1={y(rb)} y2={y(rb)} stroke="var(--sun)" strokeDasharray="4 3" strokeWidth={1.5} />}
      {slots.map((d, i) => {
        const log = state.logs.find((l) => l.date === dateKey(d));
        const cx = left + i * bw + bw / 2,
          w = Math.min(14, bw * 0.5);
        let bar = null;
        if (log) {
          const b = relFrom18(new Date(log.bed)),
            wk = relFrom18(new Date(log.wake));
          bar = (
            <rect x={cx - w / 2} y={y(b)} width={w} height={Math.max(2, y(wk) - y(b))} rx={w / 2} fill="url(#rg)">
              <title>{`${fmtHM(new Date(log.bed))} → ${fmtHM(new Date(log.wake))}`}</title>
            </rect>
          );
        }
        return (
          <g key={i}>
            {bar}
            {(range <= 7 || i % 2 === 1) && (
              <text x={cx} y={H - 4} textAnchor="middle">
                {range <= 7 ? DAY_NAMES[monDay(d)] : d.getDate()}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="rg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6b5bff" />
          <stop offset="1" stopColor="#ffc46b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
