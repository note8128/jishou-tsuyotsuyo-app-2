/* ネムリズム - 睡眠・起床管理アプリ（モックアップ）
 * ビルド不要。状態は localStorage に保存する。
 * 曜日は 0=月 ... 6=日 で扱う（JS の getDay とは異なる）。
 */
(() => {
  'use strict';

  // ============ 定数 ============
  const STORAGE_KEY = 'nemurhythm-state-v1';
  const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];
  const CATEGORIES = {
    class:   { name: '授業',       color: '#8fd3ff' },
    work:    { name: 'バイト',     color: '#ffc46b' },
    study:   { name: '自習',       color: '#a6e3a1' },
    exercise:{ name: '運動',       color: '#c5b3ff' },
    private: { name: 'プライベート', color: '#ffa6c9' },
  };
  const QUIZ_LABEL = { math: '計算', memory: '数字記憶', mix: 'ミックス' };
  const DIFF_LABEL = { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい' };
  const HOUR_PX = 32;
  const SNOOZE_DEMO_SEC = 15; // モックなので実際の5分ではなく短縮

  // ============ ユーティリティ ============
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmtHM = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hmToMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const minToHM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monDay = d => (d.getDay() + 6) % 7;
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const startOfDay = d => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const durText = min => {
    if (min == null || isNaN(min)) return '--';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h}時間${m ? m + '分' : ''}` : `${m}分`;
  };
  const durShort = min => `${Math.floor(min / 60)}h${pad(Math.round(min % 60))}`;
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // 再現性のある乱数（デモデータ用）
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ============ 状態 ============
  function createDemoState() {
    const r = mulberry32(42);
    const today = startOfDay(new Date());
    const logs = [];
    for (let i = 13; i >= 0; i--) {
      const wakeDay = addDays(today, -i);
      if (i === 0 && new Date().getHours() < 8) continue; // 今朝の分はまだ無い
      const weekend = monDay(wakeDay) >= 5;
      const bedMin = weekend ? 60 + r() * 120 : -70 + r() * 150;   // 0:00 基準（負なら前日）
      const wakeMin = weekend ? 510 + r() * 90 : 390 + r() * 50;
      const bed = new Date(wakeDay.getTime() + bedMin * 60000);
      const wake = new Date(wakeDay.getTime() + wakeMin * 60000);
      const snoozes = r() < 0.3 ? 1 : 0;
      logs.push({
        date: dateKey(wakeDay), bed: bed.toISOString(), wake: wake.toISOString(),
        wakeScore: Math.round(clamp(60 + r() * 40 - snoozes * 15, 20, 100)),
        quizSec: Math.round(15 + r() * 40), snoozes,
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
        ...[0, 1, 2, 3, 4].map(d => ({ id: uid(), day: d, start: '09:00', end: '10:30', title: '1限', cat: 'class' })),
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

  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { state = null; }
  if (!state || !state.alarms) state = createDemoState();
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 保存不可でも動作は継続 */ } };
  save();

  // ============ 画面遷移 ============
  function goto(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === name));
    if (name === 'home') renderHome();
    if (name === 'alarm') renderAlarms();
    if (name === 'schedule') { renderSchedule(); scrollTimetable(); }
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) goto(g.dataset.goto);
  });

  function toast(msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), ms);
  }

  // シート（モーダル）共通
  function openSheet(id) { $(id).hidden = false; }
  function closeSheet(el) { el.closest('.sheet-backdrop').hidden = true; }
  $$('.sheet-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) bd.hidden = true; });
  });

  // セグメントコントロール
  function bindSeg(seg, onChange) {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', seg).forEach(x => x.classList.toggle('active', x === b));
      onChange && onChange(b.dataset.v ?? b.dataset.range);
    });
  }
  const segValue = name => $(`.seg[data-name="${name}"] button.active`).dataset.v;
  const setSeg = (name, v) => $$(`.seg[data-name="${name}"] button`).forEach(b => b.classList.toggle('active', b.dataset.v === v));

  // ============ アラーム計算 ============
  function nextOccurrence(alarm, from = new Date()) {
    const mins = hmToMin(alarm.time);
    for (let off = 0; off <= 7; off++) {
      const d = addDays(startOfDay(from), off);
      d.setMinutes(mins);
      if (d <= from) continue;
      if (!alarm.days.length || alarm.days.includes(monDay(d))) return d;
    }
    return null;
  }
  function nextAlarm() {
    let best = null;
    state.alarms.filter(a => a.enabled).forEach(a => {
      const t = nextOccurrence(a);
      if (t && (!best || t < best.at)) best = { alarm: a, at: t };
    });
    return best;
  }
  // 指定曜日の起床予定（その日最も早い有効アラーム）
  function wakeMinForDay(day) {
    const list = state.alarms.filter(a => a.enabled && (a.days.length === 0 || a.days.includes(day)));
    if (!list.length) return null;
    return Math.min(...list.map(a => hmToMin(a.time)));
  }
  const sleepNeedMin = () => state.settings.goal * 60 + state.settings.latency;

  function daysText(days) {
    if (!days.length) return '1回のみ';
    if (days.length === 7) return '毎日';
    const s = [...days].sort().join();
    if (s === '0,1,2,3,4') return '平日';
    if (s === '5,6') return '週末';
    return [...days].sort().map(d => DAY_NAMES[d]).join(' ');
  }

  // ============ 睡眠分析 ============
  const logDuration = l => (new Date(l.wake) - new Date(l.bed)) / 60000;
  // 18:00 を 0 とした相対分（就寝時刻のばらつき計算用）
  const relFrom18 = d => ((d.getHours() * 60 + d.getMinutes()) - 1080 + 1440) % 1440;

  function analyze(rangeDays) {
    const today = startOfDay(new Date());
    const from = dateKey(addDays(today, -(rangeDays - 1)));
    const logs = state.logs.filter(l => l.date >= from).sort((a, b) => a.date.localeCompare(b.date));
    const goalMin = state.settings.goal * 60;
    if (!logs.length) return { logs, empty: true, goalMin };

    const durs = logs.map(logDuration);
    const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
    const debt = durs.reduce((a, d) => a + Math.max(0, goalMin - d), 0);
    const beds = logs.map(l => relFrom18(new Date(l.bed)));
    const bedAvg = beds.reduce((a, b) => a + b, 0) / beds.length;
    const sd = Math.sqrt(beds.reduce((a, b) => a + (b - bedAvg) ** 2, 0) / beds.length);
    const wakes = logs.filter(l => l.wakeScore != null).map(l => l.wakeScore);
    const wakeAvg = wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null;

    // 平日と週末の起床時刻差（社会的時差ボケ）
    const wakeRel = l => { const d = new Date(l.wake); return d.getHours() * 60 + d.getMinutes(); };
    const wd = logs.filter(l => monDay(new Date(l.date + 'T12:00')) < 5).map(wakeRel);
    const we = logs.filter(l => monDay(new Date(l.date + 'T12:00')) >= 5).map(wakeRel);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const jetlag = wd.length && we.length ? mean(we) - mean(wd) : 0;

    let durScore = clamp(avg / goalMin, 0, 1) * 100;
    if (avg > goalMin + 90) durScore -= (avg - goalMin - 90) / 3; // 寝すぎも減点
    const regScore = clamp(100 - (sd - 15) * 1.1, 0, 100);
    const score = Math.round(durScore * 0.5 + regScore * 0.3 + (wakeAvg ?? 70) * 0.2);

    return { logs, durs, avg, debt, sd, bedAvg, wakeAvg, jetlag, score, goalMin };
  }

  function adviceFor(a) {
    if (a.empty) return '睡眠記録がまだありません。「おやすみモード」を使うか、手動で記録を追加しましょう。';
    const tips = [];
    const na = nextAlarm();
    const recBed = na ? minToHM(hmToMin(na.alarm.time) - sleepNeedMin()) : null;
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

  // ============ ホーム画面 ============
  let homeRange = 7;
  bindSeg($('#range-seg'), v => { homeRange = Number(v); renderHome(); });

  function renderClock() {
    const now = new Date();
    $('#sb-time').textContent = fmtHM(now);
    $('#home-clock').textContent = fmtHM(now);
    $('#home-date').textContent = `${now.getMonth() + 1}月${now.getDate()}日（${DAY_NAMES[monDay(now)]}）`;
    const h = now.getHours();
    $('#greeting').textContent = h < 4 ? 'まだ起きていますか？' : h < 11 ? 'おはようございます' : h < 17 ? 'こんにちは' : 'こんばんは';
  }

  function renderNextAlarm() {
    const na = nextAlarm();
    if (!na) {
      $('#next-alarm-time').textContent = '--:--';
      $('#next-alarm-sub').textContent = 'アラームなし';
      $('#rec-bedtime').textContent = '--:--';
      $('#rec-bedtime-sub').textContent = '';
      return;
    }
    const until = (na.at - new Date()) / 60000;
    $('#next-alarm-time').textContent = na.alarm.time;
    $('#next-alarm-sub').textContent = `あと${durText(until)}・${na.alarm.label || 'アラーム'}`;
    const bedAt = new Date(na.at - sleepNeedMin() * 60000);
    $('#rec-bedtime').textContent = fmtHM(bedAt);
    const toBed = (bedAt - new Date()) / 60000;
    $('#rec-bedtime-sub').textContent = toBed > 0 ? `あと${durText(toBed)}` : '⚠ 今すぐ寝ましょう';
  }

  function renderHome() {
    renderClock();
    renderNextAlarm();
    const a = analyze(homeRange);
    const ring = $('#score-ring-fg');
    if (a.empty) {
      $('#score-value').textContent = '--';
      ring.style.strokeDashoffset = 326.7;
      ['#stat-avg', '#stat-debt', '#stat-regular', '#stat-wake'].forEach(s => ($(s).textContent = '--'));
    } else {
      $('#score-value').textContent = a.score;
      ring.style.strokeDashoffset = 326.7 * (1 - a.score / 100);
      ring.style.stroke = a.score >= 80 ? 'var(--ok)' : a.score >= 60 ? 'var(--accent)' : 'var(--warn)';
      $('#stat-avg').textContent = durShort(a.avg);
      $('#stat-debt').textContent = a.debt ? `${(a.debt / 60).toFixed(1)}h` : 'なし';
      $('#stat-regular').textContent = `±${Math.round(a.sd)}分`;
      $('#stat-wake').textContent = a.wakeAvg != null ? `${Math.round(a.wakeAvg)}点` : '--';
    }
    $('#goal-label').textContent = `${state.settings.goal}h`;
    $('#sleep-chart').innerHTML = durationChart(a);
    $('#rhythm-chart').innerHTML = rhythmChart(a);
    $('#advice').innerHTML = adviceFor(a);
    renderTodayList();
  }

  function rangeSlots() {
    const today = startOfDay(new Date());
    return Array.from({ length: homeRange }, (_, i) => addDays(today, i - homeRange + 1));
  }

  // 睡眠時間の棒グラフ
  function durationChart(a) {
    const W = 320, H = 130, top = 14, bottom = 20, left = 22;
    const slots = rangeSlots();
    const maxH = 10;
    const y = h => top + (H - top - bottom) * (1 - h / maxH);
    const bw = (W - left) / slots.length;
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    [0, 4, 8].forEach(h => {
      s += `<line x1="${left}" x2="${W}" y1="${y(h)}" y2="${y(h)}" stroke="var(--line)" />`;
      s += `<text x="${left - 4}" y="${y(h) + 3}" text-anchor="end">${h}h</text>`;
    });
    slots.forEach((d, i) => {
      const log = state.logs.find(l => l.date === dateKey(d));
      const x = left + i * bw + bw * 0.18, w = bw * 0.64;
      if (log) {
        const hrs = Math.min(maxH, logDuration(log) / 60);
        const ok = hrs * 60 >= a.goalMin - 15;
        s += `<rect x="${x}" y="${y(hrs)}" width="${w}" height="${y(0) - y(hrs)}" rx="3" fill="${ok ? 'var(--accent)' : 'var(--warn)'}"><title>${dateKey(d)} ${durText(hrs * 60)}</title></rect>`;
        if (homeRange <= 7) s += `<text x="${x + w / 2}" y="${y(hrs) - 3}" text-anchor="middle" style="fill:var(--text)">${hrs.toFixed(1)}</text>`;
      } else {
        s += `<text x="${x + w / 2}" y="${y(0) - 4}" text-anchor="middle">-</text>`;
      }
      if (homeRange <= 7 || i % 2 === 1) {
        s += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${homeRange <= 7 ? DAY_NAMES[monDay(d)] : d.getDate()}</text>`;
      }
    });
    const gy = y(state.settings.goal);
    s += `<line x1="${left}" x2="${W}" y1="${gy}" y2="${gy}" stroke="var(--sun)" stroke-dasharray="4 3" stroke-width="1.5"/>`;
    return s + '</svg>';
  }

  // 就寝〜起床の帯グラフ（21:00〜11:00）
  function rhythmChart(a) {
    const W = 320, H = 120, top = 6, bottom = 18, left = 34;
    const slots = rangeSlots();
    const startRel = 180, span = 840; // 18:00 起点で 21:00 から 14 時間
    const y = rel => top + (H - top - bottom) * clamp((rel - startRel) / span, 0, 1);
    const bw = (W - left) / slots.length;
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    [['21:00', 180], ['0:00', 360], ['3:00', 540], ['6:00', 720], ['9:00', 900]].forEach(([lb, rel]) => {
      s += `<line x1="${left}" x2="${W}" y1="${y(rel)}" y2="${y(rel)}" stroke="var(--line)" />`;
      s += `<text x="${left - 4}" y="${y(rel) + 3}" text-anchor="end">${lb}</text>`;
    });
    // 推奨就寝ライン
    const na = nextAlarm();
    if (na) {
      const rb = relFrom18(new Date(na.at - sleepNeedMin() * 60000));
      s += `<line x1="${left}" x2="${W}" y1="${y(rb)}" y2="${y(rb)}" stroke="var(--sun)" stroke-dasharray="4 3" stroke-width="1.5"/>`;
    }
    slots.forEach((d, i) => {
      const log = state.logs.find(l => l.date === dateKey(d));
      const cx = left + i * bw + bw / 2, w = Math.min(14, bw * 0.5);
      if (log) {
        const b = relFrom18(new Date(log.bed)), wk = relFrom18(new Date(log.wake));
        s += `<rect x="${cx - w / 2}" y="${y(b)}" width="${w}" height="${Math.max(2, y(wk) - y(b))}" rx="${w / 2}" fill="url(#rg)"><title>${fmtHM(new Date(log.bed))} → ${fmtHM(new Date(log.wake))}</title></rect>`;
      }
      if (homeRange <= 7 || i % 2 === 1) s += `<text x="${cx}" y="${H - 4}" text-anchor="middle">${homeRange <= 7 ? DAY_NAMES[monDay(d)] : d.getDate()}</text>`;
    });
    s += `<defs><linearGradient id="rg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6b5bff"/><stop offset="1" stop-color="#ffc46b"/></linearGradient></defs>`;
    return s + '</svg>';
  }

  // ============ 予定ヘルパ ============
  // 表示週（月曜始まり）の日付配列
  let weekOffset = 0;
  let selectedDay = monDay(new Date());
  function weekDates() {
    const today = startOfDay(new Date());
    const mon = addDays(today, -monDay(today) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }
  function eventsForDate(d) {
    const day = monDay(d), key = dateKey(d);
    return state.events
      .filter(e => e.day === day && (!e.date || e.date === key))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  // 日の中の [開始分, 終了分]（終了が開始以前なら日付をまたぐ → その日は24:00まで）
  function eventRange(e) {
    const s = hmToMin(e.start); let en = hmToMin(e.end);
    if (en <= s) en = 1440;
    return [s, en];
  }
  // その曜日の列に描く推奨睡眠帯（複数区間）
  function sleepSegmentsForDay(day) {
    const segs = [];
    const need = sleepNeedMin();
    // その日の朝に起きる分
    const w = wakeMinForDay(day);
    if (w != null) {
      const bed = w - need;
      segs.push({ from: Math.max(0, bed), to: w, wake: w, bed: (bed + 1440) % 1440 });
    }
    // 翌朝の起床のための前夜分
    const nw = wakeMinForDay((day + 1) % 7);
    if (nw != null && nw - need < 0) {
      segs.push({ from: 1440 + (nw - need), to: 1440, wake: nw, bed: 1440 + (nw - need) });
    }
    return segs;
  }
  const overlaps = (a, b) => a[0] < b.to && b.from < a[1];

  function conflictsFor(day, events) {
    const segs = sleepSegmentsForDay(day);
    return events.filter(e => segs.some(sg => overlaps(eventRange(e), sg)));
  }

  function renderTodayList() {
    const now = new Date();
    const day = monDay(now);
    const evs = eventsForDate(now);
    const conflicts = conflictsFor(day, evs);
    const items = evs.map(e => {
      const c = CATEGORIES[e.cat] || CATEGORIES.private;
      const warn = conflicts.includes(e) ? ' <span title="睡眠時間と重複">⚠️</span>' : '';
      return { sort: e.start, html: `<li><span class="t">${e.start}〜${e.end}</span><span class="dot" style="background:${c.color}"></span>${esc(e.title)}${warn}</li>` };
    });
    // 翌朝のアラームから逆算した今夜の推奨就寝
    const nw = wakeMinForDay((day + 1) % 7);
    if (nw != null) {
      const bed = minToHM(nw - sleepNeedMin());
      items.push({ sort: bed < '12:00' ? '24:' + bed : bed, html: `<li><span class="t">${bed}</span><span class="dot" style="background:var(--accent)"></span>🌙 推奨就寝時刻</li>` });
    }
    items.sort((a, b) => a.sort.localeCompare(b.sort));
    $('#today-list').innerHTML = items.length ? items.map(i => i.html).join('') : '<li class="empty">今日の予定はありません</li>';
  }

  // ============ アラーム画面 ============
  function renderAlarms() {
    const list = [...state.alarms].sort((a, b) => a.time.localeCompare(b.time));
    $('#alarm-list').innerHTML = list.length ? list.map(a => `
      <li class="alarm-item ${a.enabled ? '' : 'off'}" data-id="${a.id}">
        <div class="alarm-main" data-edit>
          <div class="alarm-time">${a.time}</div>
          <div class="alarm-meta">${esc(a.label || 'アラーム')}・${daysText(a.days)}</div>
          <div class="alarm-tags">
            <span class="tag">🧩 ${QUIZ_LABEL[a.quizType]}</span>
            <span class="tag">${DIFF_LABEL[a.difficulty]}×${a.count}問</span>
            <span class="tag">💤 スヌーズ${a.snooze ? a.snooze + '回' : 'なし'}</span>
          </div>
        </div>
        <div class="alarm-side">
          <label class="switch"><input type="checkbox" data-toggle ${a.enabled ? 'checked' : ''}><span></span></label>
          <button class="btn-test" data-test>▶ テスト</button>
        </div>
      </li>`).join('') : '<li class="card" style="text-align:center;color:var(--muted)">アラームがありません。「＋」から追加しましょう。</li>';

    const logs = [...state.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    $('#wake-history').innerHTML = logs.length ? logs.map(l => {
      const d = new Date(l.date + 'T12:00');
      return `<li><span>${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES[monDay(d)]}） <b>${fmtHM(new Date(l.wake))}</b> 起床</span>
        <span class="muted">${durShort(logDuration(l))}・${l.wakeScore != null ? '目覚め度' + l.wakeScore : '手動'}${l.snoozes ? '・💤' + l.snoozes : ''}</span></li>`;
    }).join('') : '<li class="muted">まだ記録がありません</li>';
  }

  $('#alarm-list').addEventListener('click', e => {
    const item = e.target.closest('.alarm-item'); if (!item) return;
    const alarm = state.alarms.find(a => a.id === item.dataset.id);
    if (e.target.closest('[data-toggle]')) {
      alarm.enabled = e.target.checked; save(); renderAlarms(); renderNextAlarm();
      if (alarm.enabled) { const t = nextOccurrence(alarm); t && toast(`${durText((t - new Date()) / 60000)}後に鳴ります`); }
    } else if (e.target.closest('[data-test]')) {
      startRing(alarm, true);
    } else if (e.target.closest('[data-edit]')) {
      openAlarmForm(alarm);
    }
  });

  // --- アラーム編集フォーム ---
  const alarmForm = $('#alarm-form');
  let editingAlarm = null;
  let pickedDays = [];
  $('#day-picker').innerHTML = DAY_NAMES.map((n, i) => `<button type="button" data-d="${i}">${n}</button>`).join('');
  $('#day-picker').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = Number(b.dataset.d);
    pickedDays = pickedDays.includes(d) ? pickedDays.filter(x => x !== d) : [...pickedDays, d];
    b.classList.toggle('active');
  });
  $$('.seg[data-name]').forEach(s => bindSeg(s));
  alarmForm.count.addEventListener('input', () => ($('#count-val').textContent = alarmForm.count.value));
  alarmForm.snooze.addEventListener('input', () => ($('#snooze-val').textContent = alarmForm.snooze.value));

  function openAlarmForm(alarm) {
    editingAlarm = alarm;
    const a = alarm || { time: '07:00', days: [0, 1, 2, 3, 4], label: '', quizType: 'math', difficulty: 'normal', count: 3, snooze: 1 };
    $('#alarm-sheet-title').textContent = alarm ? 'アラームを編集' : 'アラームを追加';
    alarmForm.time.value = a.time;
    alarmForm.label.value = a.label;
    pickedDays = [...a.days];
    $$('#day-picker button').forEach(b => b.classList.toggle('active', pickedDays.includes(Number(b.dataset.d))));
    setSeg('quizType', a.quizType);
    setSeg('difficulty', a.difficulty);
    alarmForm.count.value = a.count; $('#count-val').textContent = a.count;
    alarmForm.snooze.value = a.snooze; $('#snooze-val').textContent = a.snooze;
    $('#btn-delete-alarm').hidden = !alarm;
    openSheet('#alarm-sheet');
  }
  $('#btn-add-alarm').addEventListener('click', () => openAlarmForm(null));
  alarmForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      time: alarmForm.time.value, label: alarmForm.label.value.trim(), days: [...pickedDays].sort(),
      quizType: segValue('quizType'), difficulty: segValue('difficulty'),
      count: Number(alarmForm.count.value), snooze: Number(alarmForm.snooze.value), enabled: true,
    };
    if (editingAlarm) Object.assign(editingAlarm, data);
    else state.alarms.push({ id: uid(), ...data });
    save(); closeSheet(alarmForm); renderAlarms(); renderNextAlarm();
    const t = nextOccurrence(data);
    toast(t ? `保存しました（${durText((t - new Date()) / 60000)}後）` : '保存しました');
  });
  $('#btn-delete-alarm').addEventListener('click', () => {
    state.alarms = state.alarms.filter(a => a !== editingAlarm);
    save(); closeSheet(alarmForm); renderAlarms(); toast('削除しました');
  });

  // ============ 鳴動 & クイズ ============
  let ring = null;       // 鳴動中の状態
  let audio = null;      // { ctx, timer }

  function startSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        [0, 0.18, 0.36].forEach(t => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'square'; o.frequency.value = 880;
          g.gain.setValueAtTime(0.08, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.16);
        });
        navigator.vibrate && navigator.vibrate([200, 100, 200]);
      };
      beep();
      audio = { ctx, timer: setInterval(beep, 1200) };
    } catch { audio = null; }
  }
  function stopSound() {
    if (!audio) return;
    clearInterval(audio.timer); audio.ctx.close(); audio = null;
  }

  function makeQuestion(type, diff) {
    if (type === 'mix') type = Math.random() < 0.5 ? 'math' : 'memory';
    if (type === 'memory') {
      const len = { easy: 4, normal: 6, hard: 8 }[diff];
      let n = String(rand(1, 9));
      while (n.length < len) n += rand(0, 9);
      return { type, answer: n, show: n };
    }
    let text, answer;
    if (diff === 'easy') {
      const a = rand(3, 30), b = rand(3, 30);
      text = `${a} + ${b}`; answer = a + b;
    } else if (diff === 'normal') {
      const a = rand(3, 9), b = rand(3, 9), c = rand(10, 60);
      if (Math.random() < 0.5) { text = `${a} × ${b} + ${c}`; answer = a * b + c; }
      else { const x = rand(40, 99), y = rand(11, x - 1); text = `${x} − ${y}`; answer = x - y; }
    } else {
      const a = rand(12, 39), b = rand(3, 9), c = rand(11, 99);
      text = `${a} × ${b} − ${c}`; answer = a * b - c;
    }
    return { type: 'math', text, answer: String(answer) };
  }

  function startRing(alarm, isTest = false) {
    if (ring) return;
    ring = {
      alarm, isTest, idx: 0, input: '', mistakes: 0, snoozes: 0,
      startTs: Date.now(), memorizing: false,
      questions: Array.from({ length: alarm.count }, () => makeQuestion(alarm.quizType, alarm.difficulty)),
    };
    $('#sleep-overlay').hidden = true;
    showRing();
  }

  function showRing() {
    $('#ring-overlay').hidden = false;
    $('#ring-label').textContent = (ring.isTest ? '【テスト】' : '') + (ring.alarm.label || 'アラーム');
    $('#ring-clock').textContent = fmtHM(new Date());
    updateSnoozeBtn();
    startSound();
    showQuestion();
  }

  function updateSnoozeBtn() {
    const left = ring.alarm.snooze - ring.snoozes;
    const b = $('#btn-snooze');
    b.disabled = left <= 0;
    b.textContent = left > 0 ? `スヌーズ（残り${left}回）` : 'スヌーズ上限に達しました';
    b.style.opacity = left > 0 ? 1 : 0.5;
  }

  function showQuestion() {
    const q = ring.questions[ring.idx];
    ring.input = '';
    $('#quiz-progress').innerHTML = ring.questions.map((_, i) => `<i class="${i < ring.idx ? 'done' : i === ring.idx ? 'now' : ''}"></i>`).join('');
    $('#quiz-answer').className = 'quiz-answer';
    $('#quiz-answer').innerHTML = '&nbsp;';
    const qEl = $('#quiz-q');
    if (q.type === 'memory') {
      $('#quiz-type').textContent = `第${ring.idx + 1}問・数字を覚えてください`;
      qEl.className = 'quiz-q memorize';
      qEl.innerHTML = `${q.show}<small>3秒後に消えます</small>`;
      ring.memorizing = true; renderNumpad();
      clearTimeout(ring.memTimer);
      ring.memTimer = setTimeout(() => {
        if (!ring) return;
        ring.memorizing = false;
        $('#quiz-type').textContent = `第${ring.idx + 1}問・数字記憶`;
        qEl.className = 'quiz-q';
        qEl.innerHTML = `${'＊'.repeat(q.show.length)}<small>覚えた数字を入力</small>`;
        renderNumpad();
      }, 3000);
    } else {
      $('#quiz-type').textContent = `第${ring.idx + 1}問・計算`;
      qEl.className = 'quiz-q';
      qEl.textContent = `${q.text} = ?`;
      ring.memorizing = false; renderNumpad();
    }
  }

  function renderNumpad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
    $('#numpad').innerHTML = keys.map(k => `<button data-k="${k}" class="${k === 'OK' ? 'ok' : ''}" ${ring.memorizing ? 'disabled' : ''}>${k}</button>`).join('');
  }

  $('#numpad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ring || ring.memorizing) return;
    const k = b.dataset.k, ans = $('#quiz-answer');
    if (k === '⌫') ring.input = ring.input.slice(0, -1);
    else if (k === 'OK') return checkAnswer();
    else if (ring.input.length < 10) ring.input += k;
    ans.className = 'quiz-answer';
    ans.innerHTML = ring.input || '&nbsp;';
  });

  function checkAnswer() {
    const q = ring.questions[ring.idx];
    const ans = $('#quiz-answer');
    if (ring.input === q.answer) {
      ans.className = 'quiz-answer right';
      ring.idx++;
      if (ring.idx >= ring.questions.length) return setTimeout(finishRing, 350);
      setTimeout(showQuestion, 350);
    } else {
      ring.mistakes++;
      ans.className = 'quiz-answer wrong';
      ans.textContent = '不正解…もう一度！';
      // 記憶問題は覚え直し（別の数字）
      if (q.type === 'memory') ring.questions[ring.idx] = makeQuestion('memory', ring.alarm.difficulty);
      setTimeout(() => ring && showQuestion(), 900);
    }
  }

  $('#btn-snooze').addEventListener('click', () => {
    if (!ring || ring.snoozes >= ring.alarm.snooze) return;
    ring.snoozes++;
    stopSound(); clearTimeout(ring.memTimer);
    $('#ring-overlay').hidden = true;
    toast(`💤 スヌーズ中（デモのため${SNOOZE_DEMO_SEC}秒後に再鳴動）`, 3000);
    const r = ring;
    setTimeout(() => { if (ring === r) showRing(); }, SNOOZE_DEMO_SEC * 1000);
  });

  function finishRing() {
    stopSound(); clearTimeout(ring.memTimer);
    $('#ring-overlay').hidden = true;
    const sec = Math.round((Date.now() - ring.startTs) / 1000 - ring.snoozes * SNOOZE_DEMO_SEC);
    const wakeScore = Math.round(clamp(100 - ring.mistakes * 8 - ring.snoozes * 15 - Math.max(0, sec - ring.questions.length * 10) * 0.6, 20, 100));
    const r = ring; ring = null;
    if (!r.alarm.days.length && !r.isTest) { r.alarm.enabled = false; save(); }
    showResult({ wakeScore, sec, snoozes: r.snoozes, isTest: r.isTest });
  }

  // 起床確定 → 睡眠記録を作成して結果表示
  function showResult({ wakeScore = null, sec = null, snoozes = 0, isTest = false }) {
    const now = new Date();
    let log = null;
    if (state.sleeping) {
      log = { date: dateKey(now), bed: state.sleeping, wake: now.toISOString(), wakeScore, quizSec: sec, snoozes };
      state.logs = state.logs.filter(l => l.date !== log.date).concat(log);
      state.sleeping = null;
      save();
    }
    $('#sleep-overlay').hidden = true;
    if (log) {
      const dur = logDuration(log);
      $('#result-duration').textContent = durText(dur);
      $('#result-detail').textContent = `${fmtHM(new Date(log.bed))} 就寝 → ${fmtHM(now)} 起床`;
      const diff = dur - state.settings.goal * 60;
      $('#result-msg').textContent = diff >= -15 ? '目標の睡眠時間を達成しました！🎉' : `目標まであと${durText(-diff)}。今夜は少し早めに寝ましょう。`;
    } else {
      $('#result-duration').textContent = 'クリア！';
      $('#result-detail').textContent = isTest ? 'テスト鳴動のため睡眠記録は保存されません' : 'おやすみモードが未開始のため睡眠時間は記録されません';
      $('#result-msg').textContent = '';
    }
    $('#result-wake').textContent = wakeScore != null ? `${wakeScore}点` : '--';
    $('#result-time').textContent = sec != null ? `${sec}秒` : '--';
    $('#result-snooze').textContent = `${snoozes}回`;
    $('#result-overlay').hidden = false;
  }
  $('#btn-result-close').addEventListener('click', () => {
    $('#result-overlay').hidden = true;
    goto('home');
  });

  // ============ おやすみモード ============
  function showSleepOverlay() {
    $('#sleep-overlay').hidden = false;
    updateSleepOverlay();
  }
  function updateSleepOverlay() {
    if (!state.sleeping) return;
    const now = new Date();
    $('#sleep-clock').textContent = fmtHM(now);
    $('#sleep-elapsed').textContent = `就寝から ${durText((now - new Date(state.sleeping)) / 60000)}`;
    const na = nextAlarm();
    $('#sleep-next').textContent = na ? `⏰ ${na.alarm.time} にクイズ付きアラームが鳴ります` : '⚠ 有効なアラームがありません';
  }
  $('#btn-sleep').addEventListener('click', () => {
    state.sleeping = new Date().toISOString(); save();
    showSleepOverlay();
  });
  $('#btn-cancel-sleep').addEventListener('click', () => {
    state.sleeping = null; save();
    $('#sleep-overlay').hidden = true;
  });
  $('#btn-wake-manual').addEventListener('click', () => showResult({}));

  // ============ スケジュール表 ============
  const timetable = $('#timetable');
  $('#cat-legend').innerHTML = Object.values(CATEGORIES).map(c => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join('')
    + '<span><i style="background:#4a3fb0"></i>推奨睡眠</span>';
  $('#cat-select').innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('');

  function renderSchedule() {
    const dates = weekDates();
    const todayKey = dateKey(new Date());
    $('#week-label').textContent = `${dates[0].getMonth() + 1}/${dates[0].getDate()} 〜 ${dates[6].getMonth() + 1}/${dates[6].getDate()}`
      + (weekOffset === 0 ? '（今週）' : '');

    let html = '<div class="tt-corner"></div>';
    dates.forEach((d, i) => {
      const cls = ['tt-head', dateKey(d) === todayKey ? 'today' : '', i === selectedDay ? 'selected' : '', i === 5 ? 'sat' : i === 6 ? 'sun' : ''].join(' ');
      html += `<div class="${cls}" data-day="${i}">${DAY_NAMES[i]}<b>${d.getDate()}</b></div>`;
    });
    html += '<div class="tt-hours">' + Array.from({ length: 24 }, (_, h) => `<div class="tt-hour">${h ? h : ''}</div>`).join('') + '</div>';

    const warnings = [];
    dates.forEach((d, i) => {
      const evs = eventsForDate(d);
      const conflicts = conflictsFor(i, evs);
      let col = `<div class="tt-col ${dateKey(d) === todayKey ? 'today' : ''}" data-day="${i}" style="height:${24 * HOUR_PX}px">`;
      sleepSegmentsForDay(i).forEach(sg => {
        col += `<div class="tt-ev sleep" data-sleep style="top:${sg.from / 60 * HOUR_PX}px;height:${(sg.to - sg.from) / 60 * HOUR_PX}px">🌙${sg.to === 1440 ? minToHM(sg.bed) + '〜' : sg.from > 0 ? minToHM(sg.from) + '〜' : ''}${sg.to < 1440 ? '<br>⏰' + minToHM(sg.to) : ''}</div>`;
      });
      evs.forEach(e => {
        const [s, en] = eventRange(e);
        const c = CATEGORIES[e.cat] || CATEGORIES.private;
        const conflict = conflicts.includes(e);
        if (conflict) warnings.push(`${DAY_NAMES[i]}曜「${esc(e.title)}」（${e.start}〜${e.end}）`);
        col += `<div class="tt-ev ${conflict ? 'conflict' : ''}" data-ev="${e.id}" style="top:${s / 60 * HOUR_PX}px;height:${Math.max(14, (en - s) / 60 * HOUR_PX - 1)}px;background:${c.color}">${esc(e.title)}<br>${e.start}</div>`;
      });
      if (dateKey(d) === todayKey) {
        const now = new Date();
        col += `<div class="tt-now" style="top:${(now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_PX}px"></div>`;
      }
      html += col + '</div>';
    });
    timetable.innerHTML = html;

    const warn = $('#sleep-warn');
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `⚠️ 推奨睡眠時間と重なっている予定があります：<br>${[...new Set(warnings)].join('<br>')}<br>予定を調整するか、アラーム時刻を見直しましょう。` : '';

    renderDayDetail(dates[selectedDay]);
  }

  function renderDayDetail(d) {
    const day = monDay(d);
    $('#day-detail-title').textContent = `${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES[day]}）の予定`;
    const evs = eventsForDate(d);
    const conflicts = conflictsFor(day, evs);
    const w = wakeMinForDay(day);
    let html = w != null ? `<li><span class="t">${minToHM(w)}</span><span class="dot" style="background:var(--sun)"></span>⏰ 起床</li>` : '';
    html += evs.map(e => `<li class="clickable" data-ev="${e.id}"><span class="t">${e.start}〜${e.end}</span><span class="dot" style="background:${(CATEGORIES[e.cat] || CATEGORIES.private).color}"></span>${esc(e.title)}${e.date ? '' : ' <small style="color:var(--muted)">毎週</small>'}${conflicts.includes(e) ? ' ⚠️' : ''}</li>`).join('');
    const nw = wakeMinForDay((day + 1) % 7);
    if (nw != null) html += `<li><span class="t">${minToHM(nw - sleepNeedMin())}</span><span class="dot" style="background:var(--accent)"></span>🌙 推奨就寝（翌朝 ${minToHM(nw)} 起床）</li>`;
    $('#day-detail').innerHTML = html || '<li class="empty">予定はありません</li>';
  }

  function scrollTimetable() {
    const wrap = $('.timetable-wrap');
    wrap.scrollTop = 7 * HOUR_PX; // 7時付近から表示
  }

  timetable.addEventListener('click', e => {
    const head = e.target.closest('.tt-head');
    if (head) { selectedDay = Number(head.dataset.day); renderSchedule(); return; }
    const ev = e.target.closest('[data-ev]');
    if (ev) { openEventForm(state.events.find(x => x.id === ev.dataset.ev)); return; }
    if (e.target.closest('[data-sleep]')) { toast('推奨睡眠はアラーム時刻と目標睡眠時間から自動計算されます', 3000); return; }
    const col = e.target.closest('.tt-col');
    if (col) {
      const rect = col.getBoundingClientRect();
      const hour = clamp(Math.floor((e.clientY - rect.top) / HOUR_PX), 0, 22);
      openEventForm(null, { day: Number(col.dataset.day), start: `${pad(hour)}:00`, end: `${pad(hour + 1)}:00` });
    }
  });
  $('#day-detail').addEventListener('click', e => {
    const li = e.target.closest('[data-ev]');
    if (li) openEventForm(state.events.find(x => x.id === li.dataset.ev));
  });
  $('#week-prev').addEventListener('click', () => { weekOffset--; renderSchedule(); });
  $('#week-next').addEventListener('click', () => { weekOffset++; renderSchedule(); });

  // --- 予定編集フォーム ---
  const eventForm = $('#event-form');
  let editingEvent = null;
  function openEventForm(ev, preset = {}) {
    editingEvent = ev;
    const e = ev || { title: '', day: selectedDay, start: '09:00', end: '10:30', cat: 'class', ...preset };
    $('#event-sheet-title').textContent = ev ? '予定を編集' : '予定を追加';
    eventForm.elements.title.value = e.title;
    eventForm.day.value = e.day;
    eventForm.start.value = e.start;
    eventForm.end.value = e.end;
    eventForm.cat.value = e.cat;
    eventForm.weekly.checked = !e.date;
    $('#btn-delete-event').hidden = !ev;
    openSheet('#event-sheet');
  }
  $('#btn-add-event').addEventListener('click', () => openEventForm(null));
  eventForm.addEventListener('submit', e => {
    e.preventDefault();
    const day = Number(eventForm.day.value);
    const data = {
      title: eventForm.elements.title.value.trim(), day,
      start: eventForm.start.value, end: eventForm.end.value, cat: eventForm.cat.value,
      date: eventForm.weekly.checked ? undefined : dateKey(weekDates()[day]),
    };
    if (editingEvent) Object.assign(editingEvent, data);
    else state.events.push({ id: uid(), ...data });
    save(); closeSheet(eventForm);
    selectedDay = day; renderSchedule();
    const conflict = conflictsFor(day, [data]).length;
    toast(conflict ? '⚠️ 推奨睡眠時間と重なっています' : '保存しました', conflict ? 3000 : 2000);
  });
  $('#btn-delete-event').addEventListener('click', () => {
    state.events = state.events.filter(x => x !== editingEvent);
    save(); closeSheet(eventForm); renderSchedule(); toast('削除しました');
  });

  // ============ 睡眠記録の手動追加 ============
  const logForm = $('#log-form');
  $('#btn-add-log').addEventListener('click', () => {
    logForm.date.value = dateKey(new Date());
    openSheet('#log-sheet');
  });
  logForm.addEventListener('submit', e => {
    e.preventDefault();
    const wakeDay = new Date(logForm.date.value + 'T00:00');
    const bm = hmToMin(logForm.bed.value), wm = hmToMin(logForm.wake.value);
    // 12時以降の就寝は前日扱い
    const bed = new Date(wakeDay.getTime() + (bm >= 720 ? bm - 1440 : bm) * 60000);
    const wake = new Date(wakeDay.getTime() + wm * 60000);
    if (wake <= bed) { toast('起床時刻は就寝時刻より後にしてください'); return; }
    state.logs = state.logs.filter(l => l.date !== logForm.date.value)
      .concat({ date: logForm.date.value, bed: bed.toISOString(), wake: wake.toISOString(), wakeScore: null, quizSec: null, snoozes: 0 });
    save(); closeSheet(logForm); renderHome(); toast(`${durText((wake - bed) / 60000)}の睡眠を記録しました`);
  });

  // ============ 目標設定 ============
  const settingsForm = $('#settings-form');
  settingsForm.goal.addEventListener('input', () => ($('#goal-val').textContent = settingsForm.goal.value));
  settingsForm.latency.addEventListener('input', () => ($('#latency-val').textContent = settingsForm.latency.value));
  $('#btn-settings').addEventListener('click', () => {
    settingsForm.goal.value = state.settings.goal; $('#goal-val').textContent = state.settings.goal;
    settingsForm.latency.value = state.settings.latency; $('#latency-val').textContent = state.settings.latency;
    $('#btn-reset').textContent = 'デモデータに戻す';
    openSheet('#settings-sheet');
  });
  settingsForm.addEventListener('submit', e => {
    e.preventDefault();
    state.settings.goal = Number(settingsForm.goal.value);
    state.settings.latency = Number(settingsForm.latency.value);
    save(); closeSheet(settingsForm); renderHome(); toast('目標を更新しました');
  });
  $('#btn-reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'もう一度押すとリセットします'; return; }
    b.dataset.armed = '';
    state = createDemoState(); save();
    closeSheet(settingsForm); goto('home'); toast('デモデータに戻しました');
  });

  // ============ 毎秒の更新 & アラーム監視 ============
  let lastMinute = `${dateKey(new Date())} ${fmtHM(new Date())}`; // 読み込み直後の再鳴動を防ぐ
  setInterval(() => {
    const now = new Date();
    renderClock();
    if (!$('#sleep-overlay').hidden) updateSleepOverlay();
    if (ring) $('#ring-clock').textContent = fmtHM(now);

    const minuteKey = `${dateKey(now)} ${fmtHM(now)}`;
    if (minuteKey === lastMinute) return;
    lastMinute = minuteKey;
    renderNextAlarm();
    const hm = fmtHM(now), day = monDay(now);
    const hit = state.alarms.find(a => a.enabled && a.time === hm && (!a.days.length || a.days.includes(day)));
    if (hit) startRing(hit);
  }, 1000);

  // ============ 初期表示 ============
  goto('home');
  if (state.sleeping) showSleepOverlay();
})();
