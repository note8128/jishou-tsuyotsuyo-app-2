'use client';

/* ネムリズム - 睡眠・起床管理アプリ
 * mockup（index.html / css/style.css / js/app.js）を React に移植したもの。
 * データはブラウザの localStorage に保存する（キー: nemurhythm-state-v1）。
 * localStorage と現在時刻に依存するため、クライアントでのみ描画する（ClientOnly.tsx 参照）。
 */
import { useEffect, useRef, useState } from 'react';
import {
  type Alarm,
  type AppState,
  type Question,
  type ScheduleEvent,
  type SoundHandle,
  HOUR_PX,
  SNOOZE_DEMO_SEC,
  clamp,
  conflictsFor,
  createDemoState,
  dateKey,
  durText,
  fmtHM,
  hmToMin,
  loadState,
  logDuration,
  makeQuestion,
  monDay,
  nextAlarm,
  nextOccurrence,
  saveState,
  startSound,
  stopSound,
  uid,
  weekDates,
} from './lib';
import { AlarmScreen, HomeScreen, ScheduleScreen } from './screens';
import { type AlarmFormData, type EventFormData, AlarmSheet, EventSheet, LogSheet, SettingsSheet } from './sheets';

type ScreenName = 'home' | 'alarm' | 'schedule';

type SheetState =
  | { kind: 'alarm'; alarm: Alarm | null }
  | { kind: 'event'; ev: ScheduleEvent | null; preset: Partial<ScheduleEvent> }
  | { kind: 'log' }
  | { kind: 'settings' }
  | null;

// 鳴動中の状態（タイマーから参照・更新するので ref で持つ）
type Ring = {
  alarm: Alarm;
  isTest: boolean;
  idx: number;
  input: string;
  mistakes: number;
  snoozes: number;
  startTs: number;
  memorizing: boolean;
  questions: Question[];
  visible: boolean;
  answer: { cls: '' | 'right' | 'wrong'; text: string | null };
  locked: boolean; // 正誤表示中は入力を受け付けない
};

type Result = { duration: string; detail: string; msg: string; wake: string; time: string; snooze: string };

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];

export default function NemurhythmApp() {
  const [state, setState] = useState<AppState>(loadState);
  const [now, setNow] = useState(() => new Date());
  const [screen, setScreen] = useState<ScreenName>('home');
  const [gotoSeq, setGotoSeq] = useState(0);
  const [homeRange, setHomeRange] = useState(7);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => monDay(new Date()));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sleepOverlay, setSleepOverlay] = useState(() => !!state.sleeping);
  const [result, setResult] = useState<Result | null>(null);
  const [toastState, setToastState] = useState<{ msg: string; ms: number } | null>(null);
  const [ringView, setRingView] = useState<Ring | null>(null); // 描画用のスナップショット

  const stateRef = useRef(state);
  const ringRef = useRef<Ring | null>(null);
  const soundRef = useRef<SoundHandle>(null);
  const timers = useRef<{ mem?: ReturnType<typeof setTimeout>; fb?: ReturnType<typeof setTimeout> }>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startRingRef = useRef<(a: Alarm, isTest?: boolean) => void>(() => {});

  // 状態の保存
  useEffect(() => {
    stateRef.current = state;
    saveState(state);
  }, [state]);

  // スケジュール表は 7時付近から表示
  useEffect(() => {
    if (screen === 'schedule' && wrapRef.current) wrapRef.current.scrollTop = 7 * HOUR_PX;
  }, [screen, gotoSeq]);

  const goto = (name: ScreenName) => {
    setScreen(name);
    setGotoSeq((n) => n + 1);
  };

  function toast(msg: string, ms = 2200) {
    setToastState({ msg, ms });
  }
  useEffect(() => {
    if (!toastState) return;
    const t = setTimeout(() => setToastState(null), toastState.ms);
    return () => clearTimeout(t);
  }, [toastState]);

  // ============ 鳴動 & クイズ ============
  const rerender = () => setRingView(ringRef.current ? { ...ringRef.current } : null);

  function showQuestion(r: Ring) {
    const q = r.questions[r.idx];
    r.input = '';
    r.answer = { cls: '', text: null };
    r.locked = false;
    clearTimeout(timers.current.mem);
    if (q.type === 'memory') {
      r.memorizing = true;
      timers.current.mem = setTimeout(() => {
        if (ringRef.current !== r) return;
        r.memorizing = false;
        rerender();
      }, 3000);
    } else {
      r.memorizing = false;
    }
    rerender();
  }

  function showRing(r: Ring) {
    r.visible = true;
    soundRef.current = startSound();
    showQuestion(r);
  }

  function startRing(alarm: Alarm, isTest = false) {
    if (ringRef.current) return;
    const r: Ring = {
      alarm,
      isTest,
      idx: 0,
      input: '',
      mistakes: 0,
      snoozes: 0,
      startTs: Date.now(),
      memorizing: false,
      questions: Array.from({ length: alarm.count }, () => makeQuestion(alarm.quizType, alarm.difficulty)),
      visible: false,
      answer: { cls: '', text: null },
      locked: false,
    };
    ringRef.current = r;
    setSleepOverlay(false);
    showRing(r);
  }
  useEffect(() => {
    startRingRef.current = startRing;
  });

  function onNumpad(k: string) {
    const r = ringRef.current;
    if (!r || r.memorizing || r.locked) return;
    if (k === 'OK') return checkAnswer(r);
    if (k === '⌫') r.input = r.input.slice(0, -1);
    else if (r.input.length < 10) r.input += k;
    r.answer = { cls: '', text: null };
    rerender();
  }

  function checkAnswer(r: Ring) {
    const q = r.questions[r.idx];
    r.locked = true;
    if (r.input === q.answer) {
      r.answer = { cls: 'right', text: null };
      timers.current.fb = setTimeout(() => {
        if (ringRef.current !== r) return;
        r.idx++;
        if (r.idx >= r.questions.length) finishRing(r, Date.now());
        else showQuestion(r);
      }, 350);
    } else {
      r.mistakes++;
      r.answer = { cls: 'wrong', text: '不正解…もう一度！' };
      // 記憶問題は覚え直し（別の数字）
      if (q.type === 'memory') r.questions[r.idx] = makeQuestion('memory', r.alarm.difficulty);
      timers.current.fb = setTimeout(() => {
        if (ringRef.current === r) showQuestion(r);
      }, 900);
    }
    rerender();
  }

  function snooze() {
    const r = ringRef.current;
    if (!r || r.snoozes >= r.alarm.snooze) return;
    r.snoozes++;
    stopSound(soundRef.current);
    soundRef.current = null;
    clearTimeout(timers.current.mem);
    clearTimeout(timers.current.fb);
    r.visible = false;
    rerender();
    toast(`💤 スヌーズ中（デモのため${SNOOZE_DEMO_SEC}秒後に再鳴動）`, 3000);
    setTimeout(() => {
      if (ringRef.current === r) showRing(r);
    }, SNOOZE_DEMO_SEC * 1000);
  }

  function finishRing(r: Ring, endTs: number) {
    stopSound(soundRef.current);
    soundRef.current = null;
    clearTimeout(timers.current.mem);
    const sec = Math.round((endTs - r.startTs) / 1000 - r.snoozes * SNOOZE_DEMO_SEC);
    const wakeScore = Math.round(clamp(100 - r.mistakes * 8 - r.snoozes * 15 - Math.max(0, sec - r.questions.length * 10) * 0.6, 20, 100));
    ringRef.current = null;
    rerender();
    // 1回のみのアラームは鳴り終わったらオフにする
    const disableId = !r.alarm.days.length && !r.isTest ? r.alarm.id : null;
    showResult({ wakeScore, sec, snoozes: r.snoozes, isTest: r.isTest, disableId });
  }

  // 起床確定 → 睡眠記録を作成して結果表示
  function showResult({
    wakeScore = null,
    sec = null,
    snoozes = 0,
    isTest = false,
    disableId = null,
  }: {
    wakeScore?: number | null;
    sec?: number | null;
    snoozes?: number;
    isTest?: boolean;
    disableId?: string | null;
  }) {
    const cur = stateRef.current;
    const nowD = new Date();
    let next = cur;
    if (disableId) next = { ...next, alarms: next.alarms.map((a) => (a.id === disableId ? { ...a, enabled: false } : a)) };
    let res: Result;
    const common = { wake: wakeScore != null ? `${wakeScore}点` : '--', time: sec != null ? `${sec}秒` : '--', snooze: `${snoozes}回` };
    if (cur.sleeping) {
      const log = { date: dateKey(nowD), bed: cur.sleeping, wake: nowD.toISOString(), wakeScore, quizSec: sec, snoozes };
      next = { ...next, logs: next.logs.filter((l) => l.date !== log.date).concat(log), sleeping: null };
      const dur = logDuration(log);
      const diff = dur - cur.settings.goal * 60;
      res = {
        ...common,
        duration: durText(dur),
        detail: `${fmtHM(new Date(log.bed))} 就寝 → ${fmtHM(nowD)} 起床`,
        msg: diff >= -15 ? '目標の睡眠時間を達成しました！🎉' : `目標まであと${durText(-diff)}。今夜は少し早めに寝ましょう。`,
      };
    } else {
      res = {
        ...common,
        duration: 'クリア！',
        detail: isTest ? 'テスト鳴動のため睡眠記録は保存されません' : 'おやすみモードが未開始のため睡眠時間は記録されません',
        msg: '',
      };
    }
    if (next !== cur) {
      stateRef.current = next;
      setState(next);
    }
    setSleepOverlay(false);
    setResult(res);
  }

  // ============ 毎秒の更新 & アラーム監視 ============
  useEffect(() => {
    let lastMinute = `${dateKey(new Date())} ${fmtHM(new Date())}`; // 読み込み直後の再鳴動を防ぐ
    const t = setInterval(() => {
      const d = new Date();
      setNow(d);
      const minuteKey = `${dateKey(d)} ${fmtHM(d)}`;
      if (minuteKey === lastMinute) return;
      lastMinute = minuteKey;
      const hm = fmtHM(d),
        day = monDay(d);
      const hit = stateRef.current.alarms.find((a) => a.enabled && a.time === hm && (!a.days.length || a.days.includes(day)));
      if (hit) startRingRef.current(hit);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ============ 各種操作 ============
  const update = (fn: (s: AppState) => AppState) => setState((s) => fn(s));

  function toggleAlarm(alarm: Alarm, enabled: boolean) {
    update((s) => ({ ...s, alarms: s.alarms.map((a) => (a.id === alarm.id ? { ...a, enabled } : a)) }));
    if (enabled) {
      const t = nextOccurrence(alarm);
      if (t) toast(`${durText((t.getTime() - Date.now()) / 60000)}後に鳴ります`);
    }
  }

  function saveAlarm(editing: Alarm | null, data: AlarmFormData) {
    update((s) => ({
      ...s,
      alarms: editing ? s.alarms.map((a) => (a.id === editing.id ? { ...a, ...data } : a)) : [...s.alarms, { id: uid(), ...data }],
    }));
    setSheet(null);
    const t = nextOccurrence(data);
    toast(t ? `保存しました（${durText((t.getTime() - Date.now()) / 60000)}後）` : '保存しました');
  }

  function saveEvent(editing: ScheduleEvent | null, f: EventFormData) {
    const data: Omit<ScheduleEvent, 'id'> = {
      title: f.title,
      day: f.day,
      start: f.start,
      end: f.end,
      cat: f.cat,
      date: f.weekly ? undefined : dateKey(weekDates(weekOffset)[f.day]),
    };
    update((s) => ({
      ...s,
      events: editing ? s.events.map((e) => (e.id === editing.id ? { ...e, ...data } : e)) : [...s.events, { id: uid(), ...data }],
    }));
    setSheet(null);
    setSelectedDay(f.day);
    const conflict = conflictsFor(state, f.day, [data]).length;
    toast(conflict ? '⚠️ 推奨睡眠時間と重なっています' : '保存しました', conflict ? 3000 : 2000);
  }

  function saveLog(date: string, bedHM: string, wakeHM: string) {
    const wakeDay = new Date(date + 'T00:00');
    const bm = hmToMin(bedHM),
      wm = hmToMin(wakeHM);
    // 12時以降の就寝は前日扱い
    const bed = new Date(wakeDay.getTime() + (bm >= 720 ? bm - 1440 : bm) * 60000);
    const wake = new Date(wakeDay.getTime() + wm * 60000);
    if (wake <= bed) {
      toast('起床時刻は就寝時刻より後にしてください');
      return;
    }
    update((s) => ({
      ...s,
      logs: s.logs.filter((l) => l.date !== date).concat({ date, bed: bed.toISOString(), wake: wake.toISOString(), wakeScore: null, quizSec: null, snoozes: 0 }),
    }));
    setSheet(null);
    toast(`${durText((wake.getTime() - bed.getTime()) / 60000)}の睡眠を記録しました`);
  }

  const ring = ringView;
  const q = ring ? ring.questions[ring.idx] : null;
  const na = nextAlarm(state);
  const snoozeLeft = ring ? ring.alarm.snooze - ring.snoozes : 0;

  return (
    <>
      <div className="phone">
        {/* ステータスバー */}
        <div className="statusbar">
          <span>{fmtHM(now)}</span>
          <span className="sb-icons">📶 🔋</span>
        </div>

        <main className="screens">
          <HomeScreen
            active={screen === 'home'}
            state={state}
            now={now}
            range={homeRange}
            setRange={setHomeRange}
            onSleep={() => {
              update((s) => ({ ...s, sleeping: new Date().toISOString() }));
              setSleepOverlay(true);
            }}
            onAddLog={() => setSheet({ kind: 'log' })}
            onSettings={() => setSheet({ kind: 'settings' })}
            onGotoSchedule={() => goto('schedule')}
          />
          <AlarmScreen
            active={screen === 'alarm'}
            state={state}
            onAdd={() => setSheet({ kind: 'alarm', alarm: null })}
            onEdit={(a) => setSheet({ kind: 'alarm', alarm: a })}
            onToggle={toggleAlarm}
            onTest={(a) => startRing(a, true)}
          />
          <ScheduleScreen
            active={screen === 'schedule'}
            state={state}
            now={now}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onAdd={() => setSheet({ kind: 'event', ev: null, preset: { day: selectedDay } })}
            onEditEvent={(ev) => setSheet({ kind: 'event', ev, preset: {} })}
            onNewEvent={(preset) => setSheet({ kind: 'event', ev: null, preset })}
            onSleepInfo={() => toast('推奨睡眠はアラーム時刻と目標睡眠時間から自動計算されます', 3000)}
            wrapRef={wrapRef}
          />
        </main>

        {/* 下部ナビ */}
        <nav className="tabbar">
          {(
            [
              ['home', '🏠', 'ホーム'],
              ['alarm', '⏰', 'アラーム'],
              ['schedule', '📅', 'スケジュール'],
            ] as const
          ).map(([name, icon, label]) => (
            <button key={name} className={`tab${screen === name ? ' active' : ''}`} onClick={() => goto(name)}>
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* ===== モーダル ===== */}
        {sheet?.kind === 'alarm' && (
          <AlarmSheet
            alarm={sheet.alarm}
            onClose={() => setSheet(null)}
            onSave={(d) => saveAlarm(sheet.alarm, d)}
            onDelete={() => {
              update((s) => ({ ...s, alarms: s.alarms.filter((a) => a.id !== sheet.alarm?.id) }));
              setSheet(null);
              toast('削除しました');
            }}
          />
        )}
        {sheet?.kind === 'event' && (
          <EventSheet
            ev={sheet.ev}
            preset={sheet.preset}
            onClose={() => setSheet(null)}
            onSave={(d) => saveEvent(sheet.ev, d)}
            onDelete={() => {
              update((s) => ({ ...s, events: s.events.filter((e) => e.id !== sheet.ev?.id) }));
              setSheet(null);
              toast('削除しました');
            }}
          />
        )}
        {sheet?.kind === 'log' && <LogSheet onClose={() => setSheet(null)} onSave={saveLog} />}
        {sheet?.kind === 'settings' && (
          <SettingsSheet
            settings={state.settings}
            onClose={() => setSheet(null)}
            onSave={(settings) => {
              update((s) => ({ ...s, settings }));
              setSheet(null);
              toast('目標を更新しました');
            }}
            onReset={() => {
              setState(createDemoState());
              setSheet(null);
              goto('home');
              toast('デモデータに戻しました');
            }}
          />
        )}

        {/* ===== おやすみモード ===== */}
        {sleepOverlay && state.sleeping && (
          <div className="overlay night">
            <div className="stars"></div>
            <p className="ov-label">おやすみモード</p>
            <h1 className="ov-clock">{fmtHM(now)}</h1>
            <p>就寝から {durText((now.getTime() - new Date(state.sleeping).getTime()) / 60000)}</p>
            <p className="ov-sub">{na ? `⏰ ${na.alarm.time} にクイズ付きアラームが鳴ります` : '⚠ 有効なアラームがありません'}</p>
            <div className="ov-actions">
              <button className="btn-ghost" onClick={() => showResult({})}>
                起床する（手動）
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  update((s) => ({ ...s, sleeping: null }));
                  setSleepOverlay(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* ===== アラーム鳴動 + クイズ ===== */}
        {ring && ring.visible && q && (
          <div className="overlay ringing">
            <p className="ov-label">{(ring.isTest ? '【テスト】' : '') + (ring.alarm.label || 'アラーム')}</p>
            <h1 className="ov-clock">{fmtHM(now)}</h1>
            <div className="quiz-card">
              <div className="quiz-progress">
                {ring.questions.map((_, i) => (
                  <i key={i} className={i < ring.idx ? 'done' : i === ring.idx ? 'now' : ''}></i>
                ))}
              </div>
              <p className="quiz-type">
                {q.type === 'memory'
                  ? ring.memorizing
                    ? `第${ring.idx + 1}問・数字を覚えてください`
                    : `第${ring.idx + 1}問・数字記憶`
                  : `第${ring.idx + 1}問・計算`}
              </p>
              {q.type === 'memory' ? (
                ring.memorizing ? (
                  <p className="quiz-q memorize">
                    {q.show}
                    <small>3秒後に消えます</small>
                  </p>
                ) : (
                  <p className="quiz-q">
                    {'＊'.repeat(q.answer.length)}
                    <small>覚えた数字を入力</small>
                  </p>
                )
              ) : (
                <p className="quiz-q">{`${q.text} = ?`}</p>
              )}
              <div className={`quiz-answer${ring.answer.cls ? ' ' + ring.answer.cls : ''}`}>{ring.answer.text ?? (ring.input || ' ')}</div>
              <div className="numpad">
                {NUMPAD_KEYS.map((k) => (
                  <button key={k} className={k === 'OK' ? 'ok' : ''} disabled={ring.memorizing} onClick={() => onNumpad(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-ghost" disabled={snoozeLeft <= 0} style={{ opacity: snoozeLeft > 0 ? 1 : 0.5 }} onClick={snooze}>
              {snoozeLeft > 0 ? `スヌーズ（残り${snoozeLeft}回）` : 'スヌーズ上限に達しました'}
            </button>
          </div>
        )}

        {/* ===== おはよう結果 ===== */}
        {result && (
          <div className="overlay morning">
            <p className="ov-label">おはようございます ☀️</p>
            <h1 className="ov-big">{result.duration}</h1>
            <p>{result.detail}</p>
            <div className="result-grid">
              <div>
                <span>目覚め度</span>
                <strong>{result.wake}</strong>
              </div>
              <div>
                <span>クイズ所要</span>
                <strong>{result.time}</strong>
              </div>
              <div>
                <span>スヌーズ</span>
                <strong>{result.snooze}</strong>
              </div>
            </div>
            <p className="ov-sub">{result.msg}</p>
            <button
              className="btn-primary"
              onClick={() => {
                setResult(null);
                goto('home');
              }}
            >
              ホームへ
            </button>
          </div>
        )}

        {toastState && (
          <div className="toast">{toastState.msg}</div>
        )}
      </div>

    </>
  );
}
