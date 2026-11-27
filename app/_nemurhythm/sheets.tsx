import { type FormEvent, type ReactNode, useState } from 'react';
import { type Alarm, type AppState, type CategoryKey, type Difficulty, type QuizType, type ScheduleEvent, CATEGORIES, DAY_NAMES, dateKey } from './lib';

// ボトムシート共通（背景クリックで閉じる）
function Sheet({ onClose, onSubmit, title, children }: { onClose: () => void; onSubmit: () => void; title: string; children: ReactNode }) {
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="sheet"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="sheet-head">
          <button type="button" className="btn-text" onClick={onClose}>
            キャンセル
          </button>
          <h2>{title}</h2>
          <button type="submit" className="btn-text strong">
            保存
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg wide">
      {options.map(([v, label]) => (
        <button type="button" key={v} className={v === value ? 'active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ===== アラーム編集 =====
export type AlarmFormData = Omit<Alarm, 'id'>;

export function AlarmSheet({ alarm, onClose, onSave, onDelete }: { alarm: Alarm | null; onClose: () => void; onSave: (d: AlarmFormData) => void; onDelete: () => void }) {
  const init = alarm || { time: '07:00', days: [0, 1, 2, 3, 4], label: '', quizType: 'math' as QuizType, difficulty: 'normal' as Difficulty, count: 3, snooze: 1 };
  const [time, setTime] = useState(init.time);
  const [label, setLabel] = useState(init.label);
  const [days, setDays] = useState<number[]>([...init.days]);
  const [quizType, setQuizType] = useState<QuizType>(init.quizType);
  const [difficulty, setDifficulty] = useState<Difficulty>(init.difficulty);
  const [count, setCount] = useState(init.count);
  const [snooze, setSnooze] = useState(init.snooze);

  return (
    <Sheet
      title={alarm ? 'アラームを編集' : 'アラームを追加'}
      onClose={onClose}
      onSubmit={() =>
        onSave({ time, label: label.trim(), days: [...days].sort((a, b) => a - b), quizType, difficulty, count, snooze, enabled: true })
      }
    >
      <input type="time" className="time-input" required value={time} onChange={(e) => setTime(e.target.value)} />
      <label className="field">
        ラベル
        <input type="text" placeholder="例：平日の起床" maxLength={20} value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="field">
        繰り返し
        <div className="day-picker">
          {DAY_NAMES.map((n, i) => (
            <button
              type="button"
              key={i}
              className={days.includes(i) ? 'active' : ''}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        クイズの種類
        <Seg
          value={quizType}
          onChange={setQuizType}
          options={[
            ['math', '🧮 計算'],
            ['memory', '🔢 数字記憶'],
            ['mix', '🎲 ミックス'],
          ]}
        />
      </div>
      <div className="field">
        難易度
        <Seg
          value={difficulty}
          onChange={setDifficulty}
          options={[
            ['easy', 'かんたん'],
            ['normal', 'ふつう'],
            ['hard', 'むずかしい'],
          ]}
        />
      </div>
      <label className="field row">
        問題数
        <span>
          <input type="range" min={1} max={5} value={count} onChange={(e) => setCount(Number(e.target.value))} /> <b>{count}</b>問
        </span>
      </label>
      <label className="field row">
        スヌーズ回数上限
        <span>
          <input type="range" min={0} max={3} value={snooze} onChange={(e) => setSnooze(Number(e.target.value))} /> <b>{snooze}</b>回
        </span>
      </label>
      {alarm && (
        <button type="button" className="btn-danger" onClick={onDelete}>
          このアラームを削除
        </button>
      )}
    </Sheet>
  );
}

// ===== 予定編集 =====
export type EventFormData = { title: string; day: number; start: string; end: string; cat: CategoryKey; weekly: boolean };

export function EventSheet({
  ev,
  preset,
  onClose,
  onSave,
  onDelete,
}: {
  ev: ScheduleEvent | null;
  preset: Partial<ScheduleEvent>;
  onClose: () => void;
  onSave: (d: EventFormData) => void;
  onDelete: () => void;
}) {
  const init = ev || { title: '', day: 0, start: '09:00', end: '10:30', cat: 'class' as CategoryKey, ...preset };
  const [title, setTitle] = useState(init.title);
  const [day, setDay] = useState(init.day);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [cat, setCat] = useState<CategoryKey>(init.cat);
  const [weekly, setWeekly] = useState(!init.date);

  return (
    <Sheet title={ev ? '予定を編集' : '予定を追加'} onClose={onClose} onSubmit={() => onSave({ title: title.trim(), day, start, end, cat, weekly })}>
      <label className="field">
        タイトル
        <input type="text" required placeholder="例：1限 英語" maxLength={20} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        曜日
        <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {DAY_NAMES.map((n, i) => (
            <option key={i} value={i}>
              {n}曜日
            </option>
          ))}
        </select>
      </label>
      <div className="field two">
        <label>
          開始
          <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          終了
          <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label className="field">
        カテゴリ
        <select value={cat} onChange={(e) => setCat(e.target.value as CategoryKey)}>
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <option key={k} value={k}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field check">
        <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> 毎週繰り返す
      </label>
      {ev && (
        <button type="button" className="btn-danger" onClick={onDelete}>
          この予定を削除
        </button>
      )}
    </Sheet>
  );
}

// ===== 睡眠記録追加 =====
export function LogSheet({ onClose, onSave }: { onClose: () => void; onSave: (date: string, bed: string, wake: string) => void }) {
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [bed, setBed] = useState('23:30');
  const [wake, setWake] = useState('07:00');
  return (
    <Sheet title="睡眠記録を追加" onClose={onClose} onSubmit={() => onSave(date, bed, wake)}>
      <label className="field">
        起床日
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="field two">
        <label>
          就寝（前日）
          <input type="time" required value={bed} onChange={(e) => setBed(e.target.value)} />
        </label>
        <label>
          起床
          <input type="time" required value={wake} onChange={(e) => setWake(e.target.value)} />
        </label>
      </div>
    </Sheet>
  );
}

// ===== 目標設定 =====
export function SettingsSheet({
  settings,
  onClose,
  onSave,
  onReset,
}: {
  settings: AppState['settings'];
  onClose: () => void;
  onSave: (s: AppState['settings']) => void;
  onReset: () => void;
}) {
  const [goal, setGoal] = useState(String(settings.goal));
  const [latency, setLatency] = useState(String(settings.latency));
  const [armed, setArmed] = useState(false);
  return (
    <Sheet title="睡眠目標" onClose={onClose} onSubmit={() => onSave({ goal: Number(goal), latency: Number(latency) })}>
      <label className="field row">
        目標睡眠時間
        <span>
          <input type="range" min={5} max={10} step={0.5} value={goal} onChange={(e) => setGoal(e.target.value)} /> <b>{goal}</b>時間
        </span>
      </label>
      <label className="field row">
        寝付くまでの時間
        <span>
          <input type="range" min={0} max={60} step={5} value={latency} onChange={(e) => setLatency(e.target.value)} /> <b>{latency}</b>分
        </span>
      </label>
      <button
        type="button"
        className="btn-danger"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          onReset();
        }}
      >
        {armed ? 'もう一度押すとリセットします' : 'デモデータに戻す'}
      </button>
    </Sheet>
  );
}
