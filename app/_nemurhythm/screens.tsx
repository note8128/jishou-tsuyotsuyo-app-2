import type { MouseEvent, ReactNode, RefObject } from 'react';
import { DurationChart, RhythmChart } from './charts';
import {
  type Alarm,
  type AppState,
  type ScheduleEvent,
  CATEGORIES,
  DAY_NAMES,
  DIFF_LABEL,
  HOUR_PX,
  QUIZ_LABEL,
  adviceFor,
  analyze,
  clamp,
  conflictsFor,
  dateKey,
  daysText,
  durShort,
  durText,
  eventRange,
  eventsForDate,
  fmtHM,
  logDuration,
  minToHM,
  monDay,
  nextAlarm,
  pad,
  sleepNeedMin,
  sleepSegmentsForDay,
  wakeMinForDay,
  weekDates,
} from './lib';

const RING_LEN = 326.7;

// ================= ホーム画面 =================
export function HomeScreen(props: {
  active: boolean;
  state: AppState;
  now: Date;
  range: number;
  setRange: (n: number) => void;
  onSleep: () => void;
  onAddLog: () => void;
  onSettings: () => void;
  onGotoSchedule: () => void;
}) {
  const { state, now, range } = props;
  const h = now.getHours();
  const greeting = h < 4 ? 'まだ起きていますか？' : h < 11 ? 'おはようございます' : h < 17 ? 'こんにちは' : 'こんばんは';

  // 次のアラーム・おすすめ就寝
  const na = nextAlarm(state);
  let bedAt: Date | null = null;
  if (na) bedAt = new Date(na.at.getTime() - sleepNeedMin(state) * 60000);
  const toBed = bedAt ? (bedAt.getTime() - now.getTime()) / 60000 : 0;

  const a = analyze(state, range);
  const ringStyle = a.empty
    ? { strokeDashoffset: RING_LEN }
    : {
        strokeDashoffset: RING_LEN * (1 - a.score / 100),
        stroke: a.score >= 80 ? 'var(--ok)' : a.score >= 60 ? 'var(--accent)' : 'var(--warn)',
      };

  return (
    <section className={`screen${props.active ? ' active' : ''}`} id="screen-home">
      <header className="screen-header">
        <div>
          <p className="greeting">{greeting}</p>
          <h1 className="clock">{fmtHM(now)}</h1>
          <p className="date">{`${now.getMonth() + 1}月${now.getDate()}日（${DAY_NAMES[monDay(now)]}）`}</p>
        </div>
        <button className="icon-btn" title="目標設定" onClick={props.onSettings}>
          ⚙️
        </button>
      </header>

      {/* 次のアラーム・就寝ボタン */}
      <div className="card next-alarm">
        <div className="next-alarm-info">
          <span className="label">次のアラーム</span>
          <strong>{na ? na.alarm.time : '--:--'}</strong>
          <span className="sub">
            {na ? `あと${durText((na.at.getTime() - now.getTime()) / 60000)}・${na.alarm.label || 'アラーム'}` : 'アラームなし'}
          </span>
        </div>
        <div className="bedtime-box">
          <span className="label">おすすめ就寝</span>
          <strong>{bedAt ? fmtHM(bedAt) : '--:--'}</strong>
          <span className="sub">{bedAt ? (toBed > 0 ? `あと${durText(toBed)}` : '⚠ 今すぐ寝ましょう') : ''}</span>
        </div>
      </div>
      <button className="btn-sleep" onClick={props.onSleep}>
        🌙 おやすみモードを開始
      </button>

      {/* 睡眠スコア */}
      <div className="card">
        <div className="card-title">
          <h2>睡眠分析</h2>
          <div className="seg">
            {[7, 14].map((n) => (
              <button key={n} className={range === n ? 'active' : ''} onClick={() => props.setRange(n)}>
                {n}日
              </button>
            ))}
          </div>
        </div>
        <div className="score-row">
          <div className="score-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" className="ring-bg" />
              <circle cx="60" cy="60" r="52" className="ring-fg" style={ringStyle} />
            </svg>
            <div className="score-text">
              <strong>{a.empty ? '--' : a.score}</strong>
              <span>睡眠スコア</span>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <span>平均睡眠</span>
              <strong>{a.empty ? '--' : durShort(a.avg)}</strong>
            </div>
            <div className="stat">
              <span>睡眠負債</span>
              <strong>{a.empty ? '--' : a.debt ? `${(a.debt / 60).toFixed(1)}h` : 'なし'}</strong>
            </div>
            <div className="stat">
              <span>就寝の規則性</span>
              <strong>{a.empty ? '--' : `±${Math.round(a.sd)}分`}</strong>
            </div>
            <div className="stat">
              <span>平均目覚め度</span>
              <strong>{a.empty || a.wakeAvg == null ? '--' : `${Math.round(a.wakeAvg)}点`}</strong>
            </div>
          </div>
        </div>
        <div className="chart">
          <DurationChart state={state} a={a} range={range} />
        </div>
        <div className="chart-legend">
          <span>
            <i className="lg lg-ok"></i>目標達成
          </span>
          <span>
            <i className="lg lg-short"></i>不足
          </span>
          <span>
            <i className="lg lg-goal"></i>目標 <b>{`${state.settings.goal}h`}</b>
          </span>
        </div>
        <h3 className="sub-title">就寝・起床リズム</h3>
        <div className="chart">
          <RhythmChart state={state} range={range} />
        </div>
        <div className="advice" dangerouslySetInnerHTML={{ __html: adviceFor(state, a) }} />
        <button className="btn-text" id="btn-add-log" onClick={props.onAddLog}>
          ＋ 睡眠記録を手動で追加
        </button>
      </div>

      {/* 今日の予定 */}
      <div className="card">
        <div className="card-title">
          <h2>今日の予定</h2>
          <button className="btn-text" onClick={props.onGotoSchedule}>
            すべて見る ›
          </button>
        </div>
        <TodayList state={state} now={now} />
      </div>
    </section>
  );
}

function TodayList({ state, now }: { state: AppState; now: Date }) {
  const day = monDay(now);
  const evs = eventsForDate(state, now);
  const conflicts = conflictsFor(state, day, evs);
  const items: { sort: string; node: ReactNode }[] = evs.map((e) => {
    const c = CATEGORIES[e.cat] || CATEGORIES.private;
    return {
      sort: e.start,
      node: (
        <li key={e.id}>
          <span className="t">
            {e.start}〜{e.end}
          </span>
          <span className="dot" style={{ background: c.color }}></span>
          {e.title}
          {conflicts.includes(e) && (
            <>
              {' '}
              <span title="睡眠時間と重複">⚠️</span>
            </>
          )}
        </li>
      ),
    };
  });
  // 翌朝のアラームから逆算した今夜の推奨就寝
  const nw = wakeMinForDay(state, (day + 1) % 7);
  if (nw != null) {
    const bed = minToHM(nw - sleepNeedMin(state));
    items.push({
      sort: bed < '12:00' ? '24:' + bed : bed,
      node: (
        <li key="__bed">
          <span className="t">{bed}</span>
          <span className="dot" style={{ background: 'var(--accent)' }}></span>🌙 推奨就寝時刻
        </li>
      ),
    });
  }
  items.sort((x, y) => x.sort.localeCompare(y.sort));
  return (
    <ul className="today-list">
      {items.length ? items.map((i) => i.node) : <li className="empty">今日の予定はありません</li>}
    </ul>
  );
}

// ================= アラーム画面 =================
export function AlarmScreen(props: {
  active: boolean;
  state: AppState;
  onAdd: () => void;
  onEdit: (a: Alarm) => void;
  onToggle: (a: Alarm, enabled: boolean) => void;
  onTest: (a: Alarm) => void;
}) {
  const { state } = props;
  const list = [...state.alarms].sort((a, b) => a.time.localeCompare(b.time));
  const logs = [...state.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <section className={`screen${props.active ? ' active' : ''}`} id="screen-alarm">
      <header className="screen-header">
        <h1>アラーム</h1>
        <button className="icon-btn primary" title="追加" onClick={props.onAdd}>
          ＋
        </button>
      </header>
      <p className="hint">クイズに正解しないと止まらないアラームで、二度寝を防ぎます。</p>
      <p className="tab-note">ⓘ ブラウザの制約により、アラームはこのページを開いているときだけ鳴ります。</p>
      <ul className="alarm-list">
        {list.length ? (
          list.map((a) => (
            <li key={a.id} className={`alarm-item ${a.enabled ? '' : 'off'}`}>
              <div className="alarm-main" onClick={() => props.onEdit(a)}>
                <div className="alarm-time">{a.time}</div>
                <div className="alarm-meta">
                  {a.label || 'アラーム'}・{daysText(a.days)}
                </div>
                <div className="alarm-tags">
                  <span className="tag">🧩 {QUIZ_LABEL[a.quizType]}</span>
                  <span className="tag">
                    {DIFF_LABEL[a.difficulty]}×{a.count}問
                  </span>
                  <span className="tag">💤 スヌーズ{a.snooze ? a.snooze + '回' : 'なし'}</span>
                </div>
              </div>
              <div className="alarm-side">
                <label className="switch">
                  <input type="checkbox" checked={a.enabled} onChange={(e) => props.onToggle(a, e.target.checked)} />
                  <span></span>
                </label>
                <button className="btn-test" onClick={() => props.onTest(a)}>
                  ▶ テスト
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            アラームがありません。「＋」から追加しましょう。
          </li>
        )}
      </ul>

      <div className="card">
        <div className="card-title">
          <h2>最近の起床記録</h2>
        </div>
        <ul className="wake-history">
          {logs.length ? (
            logs.map((l) => {
              const d = new Date(l.date + 'T12:00');
              return (
                <li key={l.date}>
                  <span>
                    {`${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES[monDay(d)]}） `}
                    <b>{fmtHM(new Date(l.wake))}</b> 起床
                  </span>
                  <span className="muted">
                    {durShort(logDuration(l))}・{l.wakeScore != null ? '目覚め度' + l.wakeScore : '手動'}
                    {l.snoozes ? '・💤' + l.snoozes : ''}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="muted">まだ記録がありません</li>
          )}
        </ul>
      </div>
    </section>
  );
}

// ================= スケジュール表 =================
export function ScheduleScreen(props: {
  active: boolean;
  state: AppState;
  now: Date;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  selectedDay: number;
  setSelectedDay: (n: number) => void;
  onAdd: () => void;
  onEditEvent: (e: ScheduleEvent) => void;
  onNewEvent: (preset: Partial<ScheduleEvent>) => void;
  onSleepInfo: () => void;
  wrapRef: RefObject<HTMLDivElement | null>;
}) {
  const { state, now, weekOffset, selectedDay, wrapRef, onEditEvent } = props;
  const dates = weekDates(weekOffset);
  const todayKey = dateKey(now);
  const weekLabel = `${dates[0].getMonth() + 1}/${dates[0].getDate()} 〜 ${dates[6].getMonth() + 1}/${dates[6].getDate()}` + (weekOffset === 0 ? '（今週）' : '');

  const warnings: string[] = [];
  const columns = dates.map((d, i) => {
    const evs = eventsForDate(state, d);
    const conflicts = conflictsFor(state, i, evs);
    const isToday = dateKey(d) === todayKey;
    const onColClick = (e: MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const hour = clamp(Math.floor((e.clientY - rect.top) / HOUR_PX), 0, 22);
      props.onNewEvent({ day: i, start: `${pad(hour)}:00`, end: `${pad(hour + 1)}:00` });
    };
    return (
      <div key={`col${i}`} className={`tt-col ${isToday ? 'today' : ''}`} style={{ height: 24 * HOUR_PX }} onClick={onColClick}>
        {sleepSegmentsForDay(state, i).map((sg, k) => (
          <div
            key={`s${k}`}
            className="tt-ev sleep"
            style={{ top: (sg.from / 60) * HOUR_PX, height: ((sg.to - sg.from) / 60) * HOUR_PX }}
            onClick={(e) => {
              e.stopPropagation();
              props.onSleepInfo();
            }}
          >
            🌙{sg.to === 1440 ? minToHM(sg.bed) + '〜' : sg.from > 0 ? minToHM(sg.from) + '〜' : ''}
            {sg.to < 1440 && (
              <>
                <br />⏰{minToHM(sg.to)}
              </>
            )}
          </div>
        ))}
        {evs.map((e) => {
          const [s, en] = eventRange(e);
          const c = CATEGORIES[e.cat] || CATEGORIES.private;
          const conflict = conflicts.includes(e);
          if (conflict) warnings.push(`${DAY_NAMES[i]}曜「${e.title}」（${e.start}〜${e.end}）`);
          return (
            <div
              key={e.id}
              className={`tt-ev ${conflict ? 'conflict' : ''}`}
              style={{ top: (s / 60) * HOUR_PX, height: Math.max(14, ((en - s) / 60) * HOUR_PX - 1), background: c.color }}
              onClick={(ev) => {
                ev.stopPropagation();
                onEditEvent(e);
              }}
            >
              {e.title}
              <br />
              {e.start}
            </div>
          );
        })}
        {isToday && <div className="tt-now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }}></div>}
      </div>
    );
  });
  const uniqWarnings = [...new Set(warnings)];

  return (
    <section className={`screen${props.active ? ' active' : ''}`} id="screen-schedule">
      <header className="screen-header">
        <h1>スケジュール</h1>
        <button className="icon-btn primary" title="予定を追加" onClick={props.onAdd}>
          ＋
        </button>
      </header>
      <div className="week-nav">
        <button className="icon-btn small" onClick={() => props.setWeekOffset(weekOffset - 1)}>
          ‹
        </button>
        <span>{weekLabel}</span>
        <button className="icon-btn small" onClick={() => props.setWeekOffset(weekOffset + 1)}>
          ›
        </button>
      </div>
      {uniqWarnings.length > 0 && (
        <div className="sleep-warn">
          ⚠️ 推奨睡眠時間と重なっている予定があります：
          {uniqWarnings.map((w) => (
            <span key={w}>
              <br />
              {w}
            </span>
          ))}
          <br />
          予定を調整するか、アラーム時刻を見直しましょう。
        </div>
      )}
      <div className="timetable-wrap" ref={wrapRef}>
        <div className="timetable">
          <div className="tt-corner"></div>
          {dates.map((d, i) => {
            const cls = ['tt-head', dateKey(d) === todayKey ? 'today' : '', i === selectedDay ? 'selected' : '', i === 5 ? 'sat' : i === 6 ? 'sun' : ''].join(' ');
            return (
              <div key={`h${i}`} className={cls} onClick={() => props.setSelectedDay(i)}>
                {DAY_NAMES[i]}
                <b>{d.getDate()}</b>
              </div>
            );
          })}
          <div className="tt-hours">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tt-hour">
                {h ? h : ''}
              </div>
            ))}
          </div>
          {columns}
        </div>
      </div>
      <div className="cat-legend">
        {Object.values(CATEGORIES).map((c) => (
          <span key={c.name}>
            <i style={{ background: c.color }}></i>
            {c.name}
          </span>
        ))}
        <span>
          <i style={{ background: '#4a3fb0' }}></i>推奨睡眠
        </span>
      </div>
      <DayDetail state={state} d={dates[selectedDay]} onEditEvent={onEditEvent} />
    </section>
  );
}

function DayDetail({ state, d, onEditEvent }: { state: AppState; d: Date; onEditEvent: (e: ScheduleEvent) => void }) {
  const day = monDay(d);
  const evs = eventsForDate(state, d);
  const conflicts = conflictsFor(state, day, evs);
  const w = wakeMinForDay(state, day);
  const nw = wakeMinForDay(state, (day + 1) % 7);
  const empty = w == null && !evs.length && nw == null;
  return (
    <div className="card">
      <div className="card-title">
        <h2>{`${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES[day]}）の予定`}</h2>
      </div>
      <ul className="today-list">
        {empty && <li className="empty">予定はありません</li>}
        {w != null && (
          <li>
            <span className="t">{minToHM(w)}</span>
            <span className="dot" style={{ background: 'var(--sun)' }}></span>⏰ 起床
          </li>
        )}
        {evs.map((e) => (
          <li key={e.id} className="clickable" onClick={() => onEditEvent(e)}>
            <span className="t">
              {e.start}〜{e.end}
            </span>
            <span className="dot" style={{ background: (CATEGORIES[e.cat] || CATEGORIES.private).color }}></span>
            {e.title}
            {!e.date && (
              <>
                {' '}
                <small style={{ color: 'var(--muted)' }}>毎週</small>
              </>
            )}
            {conflicts.includes(e) ? ' ⚠️' : ''}
          </li>
        ))}
        {nw != null && (
          <li>
            <span className="t">{minToHM(nw - sleepNeedMin(state))}</span>
            <span className="dot" style={{ background: 'var(--accent)' }}></span>🌙 推奨就寝（翌朝 {minToHM(nw)} 起床）
          </li>
        )}
      </ul>
    </div>
  );
}
