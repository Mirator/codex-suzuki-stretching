import { initRouter, navigate, getCurrentRoute } from './router.js';
import { initI18n, t, setLang, getLang, onLangChange } from './i18n.js';
import { rules } from './src/rules.js';

const STATE_KEY = 'ssc-state-v1';
const appRoot = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const defaultState = {
  lang: 'cs',
  goal: 'obecna',
  minutesPerDay: 15,
  partnerMode: false,
  sound: false,
  reminderTime: '',
  startSide: 'left',
  logs: {
    sessions: [],
    backOff: []
  }
};

let state = loadState();
let exercises = [];
let dataReady = false;
let sessionCtx = null;
let timerInterval = null;
let breathInterval = null;
let audioContext;

const stateListeners = new Set();

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return cloneState(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      logs: {
        sessions: parsed?.logs?.sessions || [],
        backOff: parsed?.logs?.backOff || []
      }
    };
  } catch (err) {
    console.warn('Failed to load state', err);
    return cloneState(defaultState);
  }
}

function persistState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function subscribeState(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function notifyState() {
  persistState();
  for (const listener of stateListeners) {
    listener(state);
  }
}

function updateState(updater) {
  const draft = JSON.parse(JSON.stringify(state));
  const result = updater ? updater(draft) || draft : draft;
  state = result;
  notifyState();
}

function getState() {
  return state;
}

function cloneState(obj) {
  return JSON.parse(JSON.stringify(obj));
}

initI18n();
if (state.lang && state.lang !== getLang()) {
  setLang(state.lang);
} else {
  updateState((draft) => {
    draft.lang = getLang();
    return draft;
  });
}

onLangChange((lang) => {
  if (getState().lang !== lang) {
    updateState((draft) => {
      draft.lang = lang;
      return draft;
    });
  }
  renderNav();
  renderRoute(getCurrentRoute());
});

fetch('data/exercises.json')
  .then((res) => res.json())
  .then((json) => {
    exercises = json;
    dataReady = true;
    renderNav();
    renderRoute(getCurrentRoute());
  })
  .catch((err) => {
    console.error('Failed to load exercises', err);
  });

initRouter((path) => {
  if (getCurrentRoute() === '/session' && path !== '/session') {
    teardownSession();
  }
  renderRoute(path);
});

subscribeState((next) => {
  if (getCurrentRoute() !== '/session') {
    renderRoute(getCurrentRoute());
  }
  renderNav();
});

function renderNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const links = nav.querySelectorAll('a');
  const labels = ['nav.home', 'nav.session', 'nav.exercises', 'nav.settings', 'nav.progress'];
  links.forEach((link, idx) => {
    if (labels[idx]) {
      link.textContent = t(labels[idx]);
    }
  });
  const brand = document.querySelector('.brand');
  if (brand) brand.textContent = 'Suzuki Stretch Coach';
}

function renderRoute(path) {
  if (!dataReady && path !== '/settings' && path !== '/') {
    appRoot.innerHTML = `<section class="card"><h1>Suzuki Stretch Coach</h1><p>Načítání dat…</p></section>`;
    return;
  }
  switch (path) {
    case '/session':
      renderSession();
      break;
    case '/exercises':
      renderExercises();
      break;
    case '/settings':
      renderSettings();
      break;
    case '/progress':
      renderProgress();
      break;
    case '/':
    default:
      renderHome();
      break;
  }
}

function renderHome() {
  const reminder = state.reminderTime;
  const reminderLabel = reminder
    ? t('home.todayReminder', { time: reminder })
    : t('home.noReminder');
  appRoot.innerHTML = `
    <section class="card">
      <h1>${t('home.title')}</h1>
      <p>${t('home.streak')}</p>
      <div class="mini-heatmap" aria-label="${t('home.streak')}">
        ${buildMiniHeatmap()}
      </div>
      <div class="cta-group" style="display:grid;gap:0.75rem;margin-top:1.25rem;">
        <button class="btn" data-action="start">${t('home.start')}</button>
        <button class="btn btn--secondary" data-action="rules">${t('home.rules')}</button>
        <a class="btn btn--ghost" href="assets/Suzukiho-strecink.pdf" download>
          ${t('home.openPdf')}
        </a>
      </div>
      <div class="reminder-banner" role="status">
        <strong>${t('home.reminder')}:</strong> ${reminderLabel}
      </div>
    </section>
  `;
  const startBtn = appRoot.querySelector('[data-action="start"]');
  startBtn?.addEventListener('click', () => navigate('/session'));
  const rulesBtn = appRoot.querySelector('[data-action="rules"]');
  rulesBtn?.addEventListener('click', () => openRulesModal());
}

function buildMiniHeatmap() {
  const days = 7;
  const today = new Date();
  const sessions = state.logs.sessions || [];
  const completions = new Set(sessions.map((s) => s.date));
  const weekdays = getLang() === 'cs' ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = '';
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    const active = completions.has(key);
    const label = `${weekdays[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${key}`;
    html += `<div class="mini-heatmap__day${active ? ' active' : ''}" aria-label="${label}">${d.getDate()}</div>`;
  }
  return html;
}

function renderExercises() {
  if (!dataReady) {
    appRoot.innerHTML = `<section class="card"><p>Načítání…</p></section>`;
    return;
  }
  const lang = getLang();
  const partnerEnabled = state.partnerMode;
  const list = exercises
    .map((exercise, idx) => {
      const name = exercise.name[lang];
      const cues = exercise.cues[lang];
      const tag = exercise.asym ? t('exercises.asym') : t('exercises.sym');
      return `
        <article class="exercise-item" data-id="${exercise.id}">
          <img src="${exercise.image}" alt="${name}" loading="lazy" />
          <div class="exercise-item__body">
            <div class="exercise-item__header">
              <h2>${idx + 1}. ${name}</h2>
              <span class="badge">${tag}</span>
            </div>
            <div>
              <strong>${t('exercises.cues')}:</strong>
              <ul class="cue-list">
                ${cues.map((cue) => `<li>${cue}</li>`).join('')}
              </ul>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
  appRoot.innerHTML = `
    <section class="card">
      <h1>${t('exercises.title')}</h1>
      <div class="exercises-list">${list}</div>
    </section>
  `;
}

function renderSettings() {
  appRoot.innerHTML = `
    <section class="card">
      <h1>${t('settings.title')}</h1>
      <form class="settings-form">
        <div class="settings-group">
          <label for="goal-select">${t('settings.goalLabel')}</label>
          <select id="goal-select" name="goal">
            <option value="obecna">${t('settings.goalMobility')}</option>
            <option value="most">${t('settings.goalBridge')}</option>
            <option value="provaz">${t('settings.goalSplit')}</option>
          </select>
        </div>
        <div class="settings-group">
          <label for="minutes-select">${t('settings.minutes')}</label>
          <select id="minutes-select" name="minutes">
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="25">25</option>
          </select>
        </div>
        <div class="settings-group">
          <label>${t('settings.language')}</label>
          <div class="switch">
            <span>CS</span>
            <input type="checkbox" id="lang-toggle" ${getLang() === 'en' ? 'checked' : ''} aria-label="${t('settings.language')}" />
            <span>EN</span>
          </div>
        </div>
        <div class="settings-group">
          <label>${t('settings.sound')}</label>
          <div class="switch">
            <input type="checkbox" id="sound-toggle" ${state.sound ? 'checked' : ''} aria-label="${t('settings.sound')}" />
          </div>
        </div>
        <div class="settings-group">
          <label>${t('settings.partner')}</label>
          <div class="switch">
            <input type="checkbox" id="partner-toggle" ${state.partnerMode ? 'checked' : ''} aria-label="${t('settings.partner')}" />
          </div>
        </div>
        <div class="settings-group">
          <label for="reminder">${t('settings.reminder')}</label>
          <input type="time" id="reminder" value="${state.reminderTime || ''}" />
        </div>
        <div class="settings-group">
          <label for="start-side">${t('settings.startSide')}</label>
          <select id="start-side">
            <option value="left">${t('settings.startLeft')}</option>
            <option value="right">${t('settings.startRight')}</option>
          </select>
        </div>
        <div class="settings-group">
          <button type="button" class="btn btn--danger" id="reset-data">${t('settings.reset')}</button>
        </div>
      </form>
    </section>
  `;
  const goal = document.getElementById('goal-select');
  const minutes = document.getElementById('minutes-select');
  const langToggle = document.getElementById('lang-toggle');
  const soundToggle = document.getElementById('sound-toggle');
  const partnerToggle = document.getElementById('partner-toggle');
  const reminder = document.getElementById('reminder');
  const startSide = document.getElementById('start-side');
  goal.value = state.goal;
  minutes.value = String(state.minutesPerDay);
  startSide.value = state.startSide;

  goal.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.goal = e.target.value;
      return draft;
    });
  });
  minutes.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.minutesPerDay = Number(e.target.value);
      return draft;
    });
  });
  langToggle.addEventListener('change', (e) => {
    setLang(e.target.checked ? 'en' : 'cs');
  });
  soundToggle.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.sound = e.target.checked;
      return draft;
    });
  });
  partnerToggle.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.partnerMode = e.target.checked;
      return draft;
    });
  });
  reminder.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.reminderTime = e.target.value;
      return draft;
    });
  });
  startSide.addEventListener('change', (e) => {
    updateState((draft) => {
      draft.startSide = e.target.value;
      return draft;
    });
  });
  const resetBtn = document.getElementById('reset-data');
  resetBtn.addEventListener('click', () => {
    const confirmed = window.confirm(t('settings.confirmReset'));
    if (confirmed) {
      state = cloneState(defaultState);
      state.lang = getLang();
      notifyState();
      renderSettings();
    }
  });
}

function renderProgress() {
  const sessions = state.logs.sessions || [];
  if (!sessions.length) {
    appRoot.innerHTML = `<section class="card"><h1>${t('progress.title')}</h1><p>${t('progress.empty')}</p></section>`;
    return;
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const counts = new Map();
  for (const log of sessions) {
    counts.set(log.date, (counts.get(log.date) || 0) + 1);
  }
  let calendarHtml = '';
  for (let i = 0; i < startOffset; i += 1) {
    calendarHtml += '<div class="calendar-cell" aria-hidden="true"></div>';
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const dateObj = new Date(year, month, day);
    const key = formatDateKey(dateObj);
    const count = counts.get(key) || 0;
    calendarHtml += `<div class="calendar-cell" data-count="${Math.min(count, 10)}" aria-label="${key}: ${count} ${t('progress.totalSessions').toLowerCase()}">${day}</div>`;
  }
  const totalSessions = sessions.length;
  const earliestDate = sessions.reduce((min, log) => (log.date < min ? log.date : min), sessions[0].date);
  const daysActive = Math.max(1, (now - new Date(earliestDate)) / 86400000 + 1);
  const avgPerWeek = (totalSessions / (daysActive / 7)).toFixed(1);

  appRoot.innerHTML = `
    <section class="card">
      <h1>${t('progress.title')}</h1>
      <h2>${t('progress.month')}</h2>
      <div class="calendar-grid" role="grid">${calendarHtml}</div>
      <div class="summary-grid">
        <div class="summary-card">
          <span>${t('progress.totalSessions')}</span>
          <strong>${totalSessions}</strong>
        </div>
        <div class="summary-card">
          <span>${t('progress.avgPerWeek')}</span>
          <strong>${avgPerWeek}</strong>
        </div>
      </div>
      <button class="btn btn--secondary" id="export-json">${t('progress.export')}</button>
    </section>
  `;
  const exportBtn = document.getElementById('export-json');
  exportBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suzuki-stretch-logs-${formatDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function renderSession() {
  if (!dataReady) {
    appRoot.innerHTML = `<section class="card"><p>Načítání…</p></section>`;
    return;
  }
  if (!sessionCtx) {
    sessionCtx = createSessionContext();
  }
  const segment = sessionCtx.segments[sessionCtx.index] || null;
  if (sessionCtx.completed) {
    renderSessionComplete();
    return;
  }
  const lang = getLang();
  const exercise = segment?.exercise || sessionCtx.segments.find((seg) => seg.exercise)?.exercise || exercises[0];
  const name = exercise?.name?.[lang] || '';
  const cues = exercise?.cues?.[lang] || [];
  const phaseLabel = segment?.kind === 'phase'
    ? segment.phase === 'A'
      ? t('session.phaseA')
      : t('session.phaseB')
    : segment?.kind === 'transition'
    ? t('session.transition')
    : segment?.kind === 'sideSwitch'
    ? t('session.sideSwitch')
    : '';
  const sideLabel = segment?.side
    ? segment.side === 'left'
      ? t('session.sideLeft')
      : t('session.sideRight')
    : '';
  const timerValue = formatTime(Math.max(0, Math.ceil((segment?.duration || 0) - sessionCtx.elapsed)));
  const progress = computeProgress();
  const nextDisabled = !segment || (segment.kind === 'phase' && segment.phase === 'A' && sessionCtx.elapsed < segment.duration);

  appRoot.innerHTML = `
    <section class="session-layout">
      <header class="session-header">
        <h1>${name}</h1>
        <div class="session-progress" aria-label="progress">
          <div class="session-progress__bar" style="width:${progress}%"></div>
        </div>
        <div class="timer-phase">${phaseLabel}</div>
        ${sideLabel ? `<div class="side-indicator">${renderSideIcon(segment.side)} ${sideLabel}</div>` : ''}
        <div class="timer-display" id="timer-display" aria-live="assertive">${timerValue}</div>
        <div class="breath-ticker" id="breath-ticker">${t('session.breathIn')}</div>
        ${sessionCtx.guardMessage ? `<div class="guard-message" role="alert">${sessionCtx.guardMessage}</div>` : ''}
      </header>
      <div class="session-card card">
        <div class="session-card__image">
          <img src="${exercise.image}" alt="${name}" />
        </div>
        <div class="session-info">
          <span class="session-info__tag">${exercise.asym ? t('exercises.asym') : t('exercises.sym')}</span>
          <strong>${t('session.holdLabel')}</strong>
          <ul class="cue-list">
            ${cues.map((cue) => `<li>${cue}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>
    <div class="control-bar">
      <div class="control-bar__inner">
        <button class="btn btn--secondary" data-action="back" ${sessionCtx.index === 0 && sessionCtx.elapsed < 0.1 ? 'disabled' : ''}>${t('session.back')}</button>
        <button class="btn" data-action="toggle">${sessionCtx.running ? t('session.pause') : t('session.start')}</button>
        <button class="btn btn--secondary" data-action="next" ${nextDisabled ? 'disabled' : ''}>${t('session.next')}</button>
        <button class="btn btn--secondary" data-action="reset">${t('session.reset')}</button>
        <button class="btn btn--secondary" data-action="backoff">${t('session.backOff')}</button>
      </div>
    </div>
  `;

  sessionCtx.dom = {
    timer: document.getElementById('timer-display'),
    progress: appRoot.querySelector('.session-progress__bar'),
    guard: appRoot.querySelector('.guard-message'),
    breath: document.getElementById('breath-ticker')
  };
  bindSessionControls();
  startBreathTicker();
  updateSessionDom();
}

function renderSideIcon(side) {
  if (side === 'left') {
    return `<img src="assets/icons/left.svg" alt="" />`;
  }
  if (side === 'right') {
    return `<img src="assets/icons/right.svg" alt="" />`;
  }
  return '';
}

function createSessionContext() {
  const baseList = state.partnerMode ? exercises : exercises.slice(0, 24);
  const routine = baseList.slice();
  const startSide = state.startSide === 'right' ? 'right' : 'left';
  const segments = [];
  routine.forEach((exercise, idx) => {
    if (idx > 0) {
      segments.push({ kind: 'transition', duration: 3, exercise });
    }
    const sides = exercise.asym ? (startSide === 'left' ? ['left', 'right'] : ['right', 'left']) : [null];
    sides.forEach((side, sideIndex) => {
      segments.push({ kind: 'phase', phase: 'A', duration: 10, exercise, side });
      segments.push({ kind: 'phase', phase: 'B', duration: 10, exercise, side });
      if (exercise.asym && sideIndex === 0) {
        segments.push({ kind: 'sideSwitch', duration: 3, exercise, side: sides[1] });
      }
    });
  });
  const totalDuration = segments.reduce((acc, seg) => acc + seg.duration, 0);
  return {
    routine,
    segments,
    index: 0,
    elapsed: 0,
    running: false,
    guardMessage: '',
    completed: false,
    totalDuration,
    startTimestamp: null,
    notes: '',
    saved: false
  };
}

function bindSessionControls() {
  const backBtn = document.querySelector('[data-action="back"]');
  const toggleBtn = document.querySelector('[data-action="toggle"]');
  const nextBtn = document.querySelector('[data-action="next"]');
  const resetBtn = document.querySelector('[data-action="reset"]');
  const backOffBtn = document.querySelector('[data-action="backoff"]');

  backBtn?.addEventListener('click', handleSessionBack);
  toggleBtn?.addEventListener('click', handleSessionToggle);
  nextBtn?.addEventListener('click', handleSessionNext);
  resetBtn?.addEventListener('click', handleSessionReset);
  backOffBtn?.addEventListener('click', handleBackOff);
}

function handleSessionToggle() {
  if (!sessionCtx) return;
  if (sessionCtx.running) {
    pauseTimer();
  } else {
    startTimer();
  }
  renderSession();
}

function startTimer() {
  if (!sessionCtx) return;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      console.warn('Audio context unavailable', err);
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  if (sessionCtx.running) return;
  sessionCtx.running = true;
  sessionCtx.guardMessage = '';
  if (!sessionCtx.startTimestamp) {
    sessionCtx.startTimestamp = Date.now();
  }
  sessionCtx.segmentStart = performance.now() - sessionCtx.elapsed * 1000;
  timerInterval = window.setInterval(tickSession, 50);
}

function pauseTimer() {
  if (!sessionCtx) return;
  sessionCtx.running = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function tickSession() {
  if (!sessionCtx) return;
  const segment = sessionCtx.segments[sessionCtx.index];
  if (!segment) {
    completeSession();
    return;
  }
  const now = performance.now();
  const elapsed = (now - sessionCtx.segmentStart) / 1000;
  sessionCtx.elapsed = Math.min(segment.duration, elapsed);
  if (sessionCtx.elapsed >= segment.duration - 0.01) {
    sessionCtx.elapsed = segment.duration;
    advanceSegment();
  }
  updateSessionDom();
}

function advanceSegment() {
  if (!sessionCtx) return;
  const segment = sessionCtx.segments[sessionCtx.index];
  if (!segment) return;
  sessionCtx.index += 1;
  sessionCtx.elapsed = 0;
  sessionCtx.segmentStart = performance.now();
  if (sessionCtx.index >= sessionCtx.segments.length) {
    completeSession();
    return;
  }
  playBeep();
  renderSession();
}

function handleSessionNext() {
  if (!sessionCtx) return;
  const segment = sessionCtx.segments[sessionCtx.index];
  if (!segment) return;
  if (segment.kind === 'phase' && segment.phase === 'A' && sessionCtx.elapsed < segment.duration) {
    sessionCtx.guardMessage = t('session.guardPhaseA');
    renderSession();
    return;
  }
  if (segment.kind === 'phase' && segment.phase === 'B' && sessionCtx.elapsed < 5) {
    sessionCtx.guardMessage = t('session.guardPhaseB');
    renderSession();
    return;
  }
  sessionCtx.guardMessage = '';
  sessionCtx.segmentStart = performance.now();
  sessionCtx.elapsed = 0;
  sessionCtx.index = Math.min(sessionCtx.segments.length, sessionCtx.index + 1);
  if (sessionCtx.index >= sessionCtx.segments.length) {
    completeSession();
    return;
  }
  playBeep();
  renderSession();
}

function handleSessionBack() {
  if (!sessionCtx) return;
  if (sessionCtx.index === 0 && sessionCtx.elapsed < 0.1) return;
  sessionCtx.guardMessage = '';
  if (sessionCtx.elapsed > 1) {
    sessionCtx.elapsed = 0;
    sessionCtx.segmentStart = performance.now();
  } else {
    sessionCtx.index = Math.max(0, sessionCtx.index - 1);
    sessionCtx.elapsed = 0;
    sessionCtx.segmentStart = performance.now();
  }
  renderSession();
}

function handleSessionReset() {
  pauseTimer();
  sessionCtx = createSessionContext();
  renderSession();
}

function handleBackOff() {
  if (!sessionCtx) return;
  pauseTimer();
  const segment = sessionCtx.segments[sessionCtx.index];
  if (segment?.exercise) {
    updateState((draft) => {
      draft.logs.backOff.push({ exerciseId: segment.exercise.id, timestamp: new Date().toISOString() });
      return draft;
    });
  }
  openModal({
    title: t('session.backOff'),
    body: `<p>${t('general.discomfortWarning')}</p>`,
    actions: [
      {
        label: t('general.close'),
        handler: closeModal
      }
    ]
  });
}

function updateSessionDom() {
  if (!sessionCtx?.dom) return;
  const segment = sessionCtx.segments[sessionCtx.index];
  if (!segment) return;
  const remaining = Math.max(0, Math.ceil((segment.duration - sessionCtx.elapsed)));
  sessionCtx.dom.timer.textContent = formatTime(remaining);
  const progress = computeProgress();
  sessionCtx.dom.progress.style.width = `${progress}%`;
  if (sessionCtx.guardMessage && sessionCtx.dom.guard) {
    sessionCtx.dom.guard.textContent = sessionCtx.guardMessage;
  }
}

function computeProgress() {
  if (!sessionCtx) return 0;
  const completed = sessionCtx.segments.slice(0, sessionCtx.index).reduce((acc, seg) => acc + seg.duration, 0);
  const current = sessionCtx.segments[sessionCtx.index];
  const elapsed = current ? Math.min(current.duration, sessionCtx.elapsed) : 0;
  const total = sessionCtx.totalDuration || 1;
  return Math.min(100, Math.round(((completed + elapsed) / total) * 100));
}

function startBreathTicker() {
  if (breathInterval) clearInterval(breathInterval);
  if (!sessionCtx?.dom?.breath) return;
  let state = 'in';
  sessionCtx.dom.breath.textContent = t('session.breathIn');
  breathInterval = setInterval(() => {
    state = state === 'in' ? 'out' : 'in';
    if (sessionCtx?.dom?.breath) {
      sessionCtx.dom.breath.textContent = state === 'in' ? t('session.breathIn') : t('session.breathOut');
    }
  }, 4000);
}

function completeSession() {
  pauseTimer();
  if (!sessionCtx) return;
  sessionCtx.completed = true;
  sessionCtx.guardMessage = '';
  if (breathInterval) {
    clearInterval(breathInterval);
    breathInterval = null;
  }
  renderSessionComplete();
}

function renderSessionComplete() {
  const notesValue = sessionCtx.notes || '';
  appRoot.innerHTML = `
    <section class="card session-done">
      <h1>${t('session.completed')}</h1>
      <p>${t('session.notesPlaceholder')}</p>
      <textarea id="session-notes" placeholder="${t('session.notesPlaceholder')}">${notesValue}</textarea>
      <button class="btn" id="save-notes">${sessionCtx.saved ? t('general.close') : t('session.saveNotes')}</button>
      <button class="btn btn--secondary" id="back-home">${t('nav.home')}</button>
    </section>
  `;
  const notes = document.getElementById('session-notes');
  notes?.addEventListener('input', (e) => {
    sessionCtx.notes = e.target.value;
  });
  const save = document.getElementById('save-notes');
  save?.addEventListener('click', () => {
    if (!sessionCtx.saved) {
      addSessionLog(sessionCtx.notes || '');
      sessionCtx.saved = true;
      save.textContent = t('general.close');
    } else {
      navigate('/');
    }
  });
  const backHome = document.getElementById('back-home');
  backHome?.addEventListener('click', () => navigate('/'));
}

function addSessionLog(notes) {
  const now = new Date();
  const dateKey = formatDateKey(now);
  const log = {
    id: `session-${now.getTime()}`,
    date: dateKey,
    timestamp: now.toISOString(),
    duration: sessionCtx.totalDuration,
    notes,
    goal: state.goal,
    partnerMode: state.partnerMode,
    exercises: sessionCtx.routine.map((ex) => ex.id)
  };
  updateState((draft) => {
    draft.logs.sessions.push(log);
    return draft;
  });
}

function teardownSession() {
  pauseTimer();
  if (breathInterval) {
    clearInterval(breathInterval);
    breathInterval = null;
  }
  sessionCtx = null;
}

function openModal({ title, body, actions = [] }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('tabindex', '-1');
  modal.innerHTML = `
    <header>
      <h2>${title}</h2>
      <button class="btn btn--ghost" data-close>${t('general.close')}</button>
    </header>
    <div class="modal__body">${body}</div>
    <footer style="margin-top:1.25rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
      ${actions
        .map(
          (action, index) =>
            `<button class="btn ${action.variant === 'primary' ? '' : 'btn--secondary'}" data-action="modal-${index}">${action.label}</button>`
        )
        .join('')}
    </footer>
  `;
  overlay.appendChild(modal);
  modalRoot.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  modal.querySelector('[data-close]')?.addEventListener('click', closeModal);
  actions.forEach((action, index) => {
    modal
      .querySelector(`[data-action="modal-${index}"]`)
      ?.addEventListener('click', () => {
        if (action.handler) action.handler();
        if (!action.keepOpen) closeModal();
      });
  });
  modal.focus();
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function openRulesModal() {
  const lang = getLang();
  const list = document.createElement('ol');
  rules.forEach((rule) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>${rule.cs}</span><small>${rule.en}</small>`;
    list.appendChild(item);
  });
  openModal({
    title: t('home.rules'),
    body: list.outerHTML,
    actions: []
  });
}

function playBeep() {
  if (!state.sound || !audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.25);
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(Math.max(0, value % 60));
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}
