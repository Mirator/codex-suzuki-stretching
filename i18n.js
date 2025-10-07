const LANG_KEY = 'ssc-lang';
const supported = ['cs', 'en'];
const listeners = new Set();

const translations = {
  cs: {
    nav: {
      home: 'Domů',
      session: 'Session',
      exercises: 'Cviky',
      settings: 'Nastavení',
      progress: 'Pokrok'
    },
    home: {
      title: 'Denní rutina Suzukiho strečinku',
      start: 'Start dnešní strečink',
      streak: 'Posledních 7 dní',
      rules: 'Pravidla / Rules',
      openPdf: 'Otevřít PDF',
      reminder: 'Připomínka',
      noReminder: 'Připomínka není nastavena',
      todayReminder: 'Dnes v {time}'
    },
    session: {
      heading: 'Session',
      transition: 'Připravit se',
      sideSwitch: 'Vyměň stranu',
      phaseA: 'Fáze A',
      phaseB: 'Fáze B',
      phaseShortA: 'A',
      phaseShortB: 'B',
      sideLeft: 'Levý bok',
      sideRight: 'Pravý bok',
      breathIn: 'Nádech',
      breathOut: 'Výdech',
      start: 'Start',
      pause: 'Pauza',
      reset: 'Reset',
      back: 'Zpět',
      next: 'Další',
      backOff: 'Back off',
      guardPhaseA: 'Dokončete nejprve fázi A.',
      guardPhaseB: 'Nechte tělo alespoň 5 sekund ve fázi B.',
      holdLabel: 'Držet',
      completed: 'Hotovo!',
      saveNotes: 'Uložit poznámky',
      notesPlaceholder: 'Co bylo dnes ztuhlé?'
    },
    exercises: {
      title: 'Seznam cviků',
      asym: 'Asymetrické',
      sym: 'Symetrické',
      cues: 'Tipy'
    },
    settings: {
      title: 'Nastavení',
      goalLabel: 'Cíl',
      goalMobility: 'Obecná mobilita',
      goalBridge: 'Most',
      goalSplit: 'Provaz',
      minutes: 'Minuty denně',
      language: 'Jazyk',
      sound: 'Zvukové upozornění',
      partner: 'Partner režim (cviky 25–35)',
      reminder: 'Čas připomínky',
      reset: 'Resetovat všechna data',
      confirmReset: 'Opravdu vymazat všechna data?',
      startSide: 'Začínat stranou',
      startLeft: 'Levou',
      startRight: 'Pravou',
      saved: 'Nastavení uloženo'
    },
    progress: {
      title: 'Pokrok',
      month: 'Měsíční kalendář',
      totalSessions: 'Počet session',
      avgPerWeek: 'Průměr týdně',
      export: 'Exportovat JSON',
      empty: 'Žádné záznamy zatím'
    },
    general: {
      close: 'Zavřít',
      cancel: 'Zrušit',
      confirm: 'Potvrdit',
      pdfAlt: 'Odkaz na PDF',
      download: 'Stáhnout',
      today: 'Dnes',
      upcoming: 'Další',
      discomfortWarning: 'Zastavte cvičení, uvolněte se, a pokud bolest přetrvává, vynechte dnešní cvičení.'
    }
  },
  en: {
    nav: {
      home: 'Home',
      session: 'Session',
      exercises: 'Exercises',
      settings: 'Settings',
      progress: 'Progress'
    },
    home: {
      title: 'Daily Suzuki Stretching Routine',
      start: 'Start today\'s stretch',
      streak: 'Last 7 days',
      rules: 'Rules',
      openPdf: 'Open PDF',
      reminder: 'Reminder',
      noReminder: 'Reminder not set',
      todayReminder: 'Today at {time}'
    },
    session: {
      heading: 'Session',
      transition: 'Get Ready',
      sideSwitch: 'Switch side',
      phaseA: 'Phase A',
      phaseB: 'Phase B',
      phaseShortA: 'A',
      phaseShortB: 'B',
      sideLeft: 'Left side',
      sideRight: 'Right side',
      breathIn: 'Inhale',
      breathOut: 'Exhale',
      start: 'Start',
      pause: 'Pause',
      reset: 'Reset',
      back: 'Back',
      next: 'Next',
      backOff: 'Back off',
      guardPhaseA: 'Complete phase A first.',
      guardPhaseB: 'Stay at least 5 seconds in phase B.',
      holdLabel: 'Hold',
      completed: 'Session complete!',
      saveNotes: 'Save notes',
      notesPlaceholder: 'What felt stiff today?'
    },
    exercises: {
      title: 'Exercise list',
      asym: 'Asymmetrical',
      sym: 'Symmetrical',
      cues: 'Cues'
    },
    settings: {
      title: 'Settings',
      goalLabel: 'Goal',
      goalMobility: 'General mobility',
      goalBridge: 'Bridge',
      goalSplit: 'Front split',
      minutes: 'Minutes per day',
      language: 'Language',
      sound: 'Sound cue',
      partner: 'Partner mode (exercises 25–35)',
      reminder: 'Reminder time',
      reset: 'Reset all data',
      confirmReset: 'Reset everything?',
      startSide: 'Start on side',
      startLeft: 'Left',
      startRight: 'Right',
      saved: 'Settings saved'
    },
    progress: {
      title: 'Progress',
      month: 'Monthly calendar',
      totalSessions: 'Sessions',
      avgPerWeek: 'Average per week',
      export: 'Export JSON',
      empty: 'No records yet'
    },
    general: {
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      pdfAlt: 'PDF link',
      download: 'Download',
      today: 'Today',
      upcoming: 'Next',
      discomfortWarning: 'Stop exercising, relax, and if the pain persists skip today\'s practice.'
    }
  }
};

let currentLang = (() => {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && supported.includes(stored)) return stored;
  return 'cs';
})();

document.documentElement.lang = currentLang;

toggleHtmlLang(currentLang);

function toggleHtmlLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);
}

export function initI18n() {
  toggleHtmlLang(currentLang);
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!supported.includes(lang)) lang = 'cs';
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  toggleHtmlLang(lang);
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(path, vars = {}) {
  const langDict = translations[currentLang] || translations.cs;
  const segments = path.split('.');
  let node = langDict;
  for (const segment of segments) {
    if (node && Object.prototype.hasOwnProperty.call(node, segment)) {
      node = node[segment];
    } else {
      node = null;
      break;
    }
  }
  if (typeof node === 'string') {
    return formatString(node, vars);
  }
  if (node == null) {
    const fallback = getFallback(path);
    return formatString(fallback, vars);
  }
  return node;
}

function getFallback(path) {
  const segments = path.split('.');
  let node = translations.en;
  for (const segment of segments) {
    if (node && Object.prototype.hasOwnProperty.call(node, segment)) {
      node = node[segment];
    } else {
      return path;
    }
  }
  return typeof node === 'string' ? node : path;
}

function formatString(str, vars) {
  return str.replace(/\{(.*?)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key];
    }
    return `{${key}}`;
  });
}

export function getTranslations() {
  return translations[currentLang] || translations.cs;
}
