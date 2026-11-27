/* ネムリズム - 睡眠・起床管理アプリ：ロジック（mockup/js/app.js からの移植）
 * 曜日は 0=月 ... 6=日 で扱う（JS の getDay とは異なる）。
 */

// ============ 型 ============
export type QuizType = 'math' | 'memory' | 'mix';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type CategoryKey = 'class' | 'work' | 'study' | 'exercise' | 'private';

export type Alarm = {
  id: string;
  time: string;
  days: number[];
  label: string;
  enabled: boolean;
  quizType: QuizType;
  difficulty: Difficulty;
  count: number;
  snooze: number;
};

export type ScheduleEvent = {
  id: string;
  day: number;
  start: string;
  end: string;
  title: string;
  cat: CategoryKey;
  date?: string; // 指定時はその日だけ（毎週繰り返さない）
};

export type SleepLog = {
  date: string; // 起床日
  bed: string; // ISO
  wake: string; // ISO
  wakeScore: number | null;
  quizSec: number | null;
  snoozes: number;
};

export type AppState = {
  settings: { goal: number; latency: number };
  alarms: Alarm[];
  events: ScheduleEvent[];
  logs: SleepLog[];
  sleeping: string | null; // 就寝開始時刻 ISO
};

// ============ 定数 ============
export const STORAGE_KEY = 'nemurhythm-state-v1';
export const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];
export const CATEGORIES: Record<CategoryKey, { name: string; color: string }> = {
  class: { name: '授業', color: '#8fd3ff' },
  work: { name: 'バイト', color: '#ffc46b' },
  study: { name: '自習', color: '#a6e3a1' },
  exercise: { name: '運動', color: '#c5b3ff' },
  private: { name: 'プライベート', color: '#ffa6c9' },
};
export const QUIZ_LABEL: Record<QuizType, string> = { math: '計算', memory: '数字記憶', mix: 'ミックス' };
export const DIFF_LABEL: Record<Difficulty, string> = { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい' };
export const HOUR_PX = 32;
export const SNOOZE_DEMO_SEC = 15; // モックなので実際の5分ではなく短縮

// ============ ユーティリティ ============
export const pad = (n: number) => String(n).padStart(2, '0');
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const fmtHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const hmToMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const minToHM = (m: number) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monDay = (d: Date) => (d.getDay() + 6) % 7;
export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const startOfDay = (d: Date) => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};
export const durText = (min: number | null | undefined) => {
  if (min == null || isNaN(min)) return '--';
  const h = Math.floor(min / 60),
    m = Math.round(min % 60);
  return h ? `${h}時間${m ? m + '分' : ''}` : `${m}分`;
};
export const durShort = (min: number) => `${Math.floor(min / 60)}h${pad(Math.round(min % 60))}`;
export const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

// 再現性のある乱数（デモデータ用）
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============ 状態 ============
export function createDemoState(): AppState {
  const r = mulberry32(42);
  const today = startOfDay(new Date());
  const logs: SleepLog[] = [];
  for (let i = 13; i >= 0; i--) {
    const wakeDay = addDays(today, -i);
    if (i === 0 && new Date().getHours() < 8) continue; // 今朝の分はまだ無い
    const weekend = monDay(wakeDay) >= 5;
    const bedMin = weekend ? 60 + r() * 120 : -70 + r() * 150; // 0:00 基準（負なら前日）
    const wakeMin = weekend ? 510 + r() * 90 : 390 + r() * 50;
    const bed = new Date(wakeDay.getTime() + bedMin * 60000);
    const wake = new Date(wakeDay.getTime() + wakeMin * 60000);
    const snoozes = r() < 0.3 ? 1 : 0;
    logs.push({
      date: dateKey(wakeDay),
      bed: bed.toISOString(),
      wake: wake.toISOString(),
      wakeScore: Math.round(clamp(60 + r() * 40 - snoozes * 15, 20, 100)),
      quizSec: Math.round(15 + r() * 40),
      snoozes,
    });
  }
  return {
    settings: { goal: 7.5, latency: 15 },
    alarms: [
      { id: uid(), time: '06:30', days: [0, 1, 2, 3, 4], label: '平日の起床', enabled: true, quizType: 'math', difficulty: 'normal', count: 3, snooze: 1 },
      { id: uid(), time: '08:30', days: [5, 6], label: '休日', enabled: true, quizType: 'memory', difficulty: 'easy', count: 2, snooze: 2 },
      { id: uid(), time: '05:45', days: [2], label: '朝練', enabled: false, quizType: 'mix', difficulty: 'hard', count: 4, snooze: 0 },
    ],
    events: [
      ...[0, 1, 2, 3, 4].map((d): ScheduleEvent => ({ id: uid(), day: d, start: '09:00', end: '10:30', title: '1限', cat: 'class' })),
      { id: uid(), day: 0, start: '10:40', end: '12:10', title: '英語', cat: 'class' },
      { id: uid(), day: 1, start: '13:00', end: '14:30', title: 'プログラミング', cat: 'class' },
      { id: uid(), day: 2, start: '10:40', end: '12:10', title: '統計学', cat: 'class' },
      { id: uid(), day: 2, start: '17:00', end: '18:30', title: 'ジム', cat: 'exercise' },
      { id: uid(), day: 3, start: '13:00', end: '16:10', title: '実験', cat: 'class' },
      { id: uid(), day: 3, start: '19:00', end: '00:00', title: 'バイト', cat: 'work' },
      { id: uid(), day: 4, start: '14:40', end: '16:10', title: 'ゼミ', cat: 'class' },
      { id: uid(), day: 0, start: '20:00', end: '22:00', title: 'レポート', cat: 'study' },
      { id: uid(), day: 5, start: '11:00', end: '17:00', title: 'バイト', cat: 'work' },
      { id: uid(), day: 6, start: '13:00', end: '16:00', title: '友人と映画', cat: 'private' },
    ],
    logs,
    sleeping: null,
  };
}

export function loadState(): AppState {
  let s: AppState | null = null;
  try {
    s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    s = null;
  }
  if (!s || !s.alarms) s = createDemoState();
  return s;
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* 保存不可でも動作は継続 */
  }
}

// ============ アラーム計算 ============
export function nextOccurrence(alarm: Pick<Alarm, 'time' | 'days'>, from = new Date()) {
  const mins = hmToMin(alarm.time);
  for (let off = 0; off <= 7; off++) {
    const d = addDays(startOfDay(from), off);
    d.setMinutes(mins);
    if (d <= from) continue;
    if (!alarm.days.length || alarm.days.includes(monDay(d))) return d;
  }
  return null;
}

export function nextAlarm(state: AppState) {
  let best: { alarm: Alarm; at: Date } | null = null;
  state.alarms
    .filter((a) => a.enabled)
    .forEach((a) => {
      const t = nextOccurrence(a);
      if (t && (!best || t < best.at)) best = { alarm: a, at: t };
    });
  return best as { alarm: Alarm; at: Date } | null;
}

// 指定曜日の起床予定（その日最も早い有効アラーム）
export function wakeMinForDay(state: AppState, day: number) {
  const list = state.alarms.filter((a) => a.enabled && (a.days.length === 0 || a.days.includes(day)));
  if (!list.length) return null;
  return Math.min(...list.map((a) => hmToMin(a.time)));
}

export const sleepNeedMin = (state: AppState) => state.settings.goal * 60 + state.settings.latency;

export function daysText(days: number[]) {
  if (!days.length) return '1回のみ';
  if (days.length === 7) return '毎日';
  const sorted = [...days].sort((a, b) => a - b);
  const s = sorted.join();
  if (s === '0,1,2,3,4') return '平日';
  if (s === '5,6') return '週末';
  return sorted.map((d) => DAY_NAMES[d]).join(' ');
}

// ============ 睡眠分析 ============
export const logDuration = (l: SleepLog) => (new Date(l.wake).getTime() - new Date(l.bed).getTime()) / 60000;
// 18:00 を 0 とした相対分（就寝時刻のばらつき計算用）
export const relFrom18 = (d: Date) => (d.getHours() * 60 + d.getMinutes() - 1080 + 1440) % 1440;

export type Analysis =
  | { empty: true; logs: SleepLog[]; goalMin: number }
  | {
      empty?: false;
      logs: SleepLog[];
      durs: number[];
      avg: number;
      debt: number;
      sd: number;
      bedAvg: number;
      wakeAvg: number | null;
      jetlag: number;
      score: number;
      goalMin: number;
    };

export function analyze(state: AppState, rangeDays: number): Analysis {
  const today = startOfDay(new Date());
  const from = dateKey(addDays(today, -(rangeDays - 1)));
  const logs = state.logs.filter((l) => l.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const goalMin = state.settings.goal * 60;
  if (!logs.length) return { logs, empty: true, goalMin };

  const durs = logs.map(logDuration);
  const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
  const debt = durs.reduce((a, d) => a + Math.max(0, goalMin - d), 0);
  const beds = logs.map((l) => relFrom18(new Date(l.bed)));
  const bedAvg = beds.reduce((a, b) => a + b, 0) / beds.length;
  const sd = Math.sqrt(beds.reduce((a, b) => a + (b - bedAvg) ** 2, 0) / beds.length);
  const wakes = logs.filter((l) => l.wakeScore != null).map((l) => l.wakeScore as number);
  const wakeAvg = wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null;

  // 平日と週末の起床時刻差（社会的時差ボケ）
  const wakeRel = (l: SleepLog) => {
    const d = new Date(l.wake);
    return d.getHours() * 60 + d.getMinutes();
  };
  const wd = logs.filter((l) => monDay(new Date(l.date + 'T12:00')) < 5).map(wakeRel);
  const we = logs.filter((l) => monDay(new Date(l.date + 'T12:00')) >= 5).map(wakeRel);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const jetlag = wd.length && we.length ? mean(we) - mean(wd) : 0;

  let durScore = clamp(avg / goalMin, 0, 1) * 100;
  if (avg > goalMin + 90) durScore -= (avg - goalMin - 90) / 3; // 寝すぎも減点
  const regScore = clamp(100 - (sd - 15) * 1.1, 0, 100);
  const score = Math.round(durScore * 0.5 + regScore * 0.3 + (wakeAvg ?? 70) * 0.2);

  return { logs, durs, avg, debt, sd, bedAvg, wakeAvg, jetlag, score, goalMin };
}

// アドバイス文（<b> を含む HTML 文字列。ユーザー入力は含まない）
export function adviceFor(state: AppState, a: Analysis) {
  if (a.empty) return '睡眠記録がまだありません。「おやすみモード」を使うか、手動で記録を追加しましょう。';
  const tips: string[] = [];
  const na = nextAlarm(state);
  const recBed = na ? minToHM(hmToMin(na.alarm.time) - sleepNeedMin(state)) : null;
  if (a.avg < a.goalMin - 30) {
    tips.push(`平均睡眠が目標より<b>${durText(a.goalMin - a.avg)}</b>短いです。${recBed ? `今夜は<b>${recBed}</b>までに布団に入りましょう。` : ''}`);
  } else if (a.avg > a.goalMin + 90) {
    tips.push('睡眠時間が長めです。寝すぎは日中のだるさにつながることがあります。');
  } else {
    tips.push('睡眠時間はおおむね目標どおりです。この調子を続けましょう。');
  }
  if (a.sd > 45) tips.push(`就寝時刻のばらつきが<b>±${Math.round(a.sd)}分</b>あります。毎日同じ時刻に寝ると寝付きが良くなります。`);
  if (a.jetlag > 60) tips.push(`週末の起床が平日より<b>${durText(a.jetlag)}</b>遅く、「社会的時差ボケ」の傾向があります。差を1時間以内に抑えましょう。`);
  if (a.wakeAvg != null && a.wakeAvg < 65) tips.push('目覚め度が低めです。アラームのクイズ難易度を上げて、しっかり頭を起こしましょう。');
  return '💡 ' + tips.join('<br>💡 ');
}

// ============ 予定ヘルパ ============
// 表示週（月曜始まり）の日付配列
export function weekDates(weekOffset: number) {
  const today = startOfDay(new Date());
  const mon = addDays(today, -monDay(today) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

export function eventsForDate(state: AppState, d: Date) {
  const day = monDay(d),
    key = dateKey(d);
  return state.events.filter((e) => e.day === day && (!e.date || e.date === key)).sort((a, b) => a.start.localeCompare(b.start));
}

// 日の中の [開始分, 終了分]（終了が開始以前なら日付をまたぐ → その日は24:00まで）
export function eventRange(e: Pick<ScheduleEvent, 'start' | 'end'>): [number, number] {
  const s = hmToMin(e.start);
  let en = hmToMin(e.end);
  if (en <= s) en = 1440;
  return [s, en];
}

export type SleepSegment = { from: number; to: number; wake: number; bed: number };

// その曜日の列に描く推奨睡眠帯（複数区間）
export function sleepSegmentsForDay(state: AppState, day: number) {
  const segs: SleepSegment[] = [];
  const need = sleepNeedMin(state);
  // その日の朝に起きる分
  const w = wakeMinForDay(state, day);
  if (w != null) {
    const bed = w - need;
    segs.push({ from: Math.max(0, bed), to: w, wake: w, bed: (bed + 1440) % 1440 });
  }
  // 翌朝の起床のための前夜分
  const nw = wakeMinForDay(state, (day + 1) % 7);
  if (nw != null && nw - need < 0) {
    segs.push({ from: 1440 + (nw - need), to: 1440, wake: nw, bed: 1440 + (nw - need) });
  }
  return segs;
}

const overlaps = (a: [number, number], b: SleepSegment) => a[0] < b.to && b.from < a[1];

export function conflictsFor<T extends Pick<ScheduleEvent, 'start' | 'end'>>(state: AppState, day: number, events: T[]) {
  const segs = sleepSegmentsForDay(state, day);
  return events.filter((e) => segs.some((sg) => overlaps(eventRange(e), sg)));
}

// ============ クイズ ============
export type Question = { type: 'math' | 'memory'; answer: string; show?: string; text?: string };

export function makeQuestion(type: QuizType, diff: Difficulty): Question {
  if (type === 'mix') type = Math.random() < 0.5 ? 'math' : 'memory';
  if (type === 'memory') {
    const len = { easy: 4, normal: 6, hard: 8 }[diff];
    let n = String(rand(1, 9));
    while (n.length < len) n += rand(0, 9);
    return { type, answer: n, show: n };
  }
  let text: string, answer: number;
  if (diff === 'easy') {
    const a = rand(3, 30),
      b = rand(3, 30);
    text = `${a} + ${b}`;
    answer = a + b;
  } else if (diff === 'normal') {
    const a = rand(3, 9),
      b = rand(3, 9),
      c = rand(10, 60);
    if (Math.random() < 0.5) {
      text = `${a} × ${b} + ${c}`;
      answer = a * b + c;
    } else {
      const x = rand(40, 99),
        y = rand(11, x - 1);
      text = `${x} − ${y}`;
      answer = x - y;
    }
  } else {
    const a = rand(12, 39),
      b = rand(3, 9),
      c = rand(11, 99);
    text = `${a} × ${b} − ${c}`;
    answer = a * b - c;
  }
  return { type: 'math', text, answer: String(answer) };
}

// ============ アラーム音（WebAudio） ============
export type SoundHandle = { ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null;

export function startSound(): SoundHandle {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const beep = () => {
      [0, 0.18, 0.36].forEach((t) => {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.08, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.16);
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    };
    beep();
    return { ctx, timer: setInterval(beep, 1200) };
  } catch {
    return null;
  }
}

export function stopSound(h: SoundHandle) {
  if (!h) return;
  clearInterval(h.timer);
  h.ctx.close();
}
