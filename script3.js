/* ================= LOGIC FOR RECENT TIMERS ================= */
const logListElTimers = document.getElementById("logList");
const LOG_STORAGE_KEY = "recentTimers";
const MAX_LOG = 20;

// טיימר פעיל
let timerInterval = null;
let timerEnd = null;
let currentDurationMs = 0; // הזמן שנבחר לטיימר

function loadLogs() {
  const s = localStorage.getItem(LOG_STORAGE_KEY);
  let logs = [];
  if (s) {
    try {
      logs = JSON.parse(s);
    } catch {
      logs = [];
      localStorage.removeItem(LOG_STORAGE_KEY);
    }
  }
  return logs;
}

function saveLogs(logs) {
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOG)));
}

function addTimerLog(durationMs) {
  if (!durationMs || durationMs <= 0) return;

  const logs = loadLogs();
  const now = new Date();
  const logEntry = {
    durationMs,
    timestamp: now.getTime(),
    display: `${fmt(durationMs)} - ${formatDate(now)}`
  };

  logs.unshift(logEntry); // חדש למעלה
  saveLogs(logs);
  renderLogs();
}

function renderLogs() {
  const logs = loadLogs();
  if (!logs.length) {
    logListElTimers.innerHTML = "אין נתונים עדיין";
    return;
  }

  logListElTimers.innerHTML = "";
  logs.forEach(log => {
    const div = document.createElement("div");
    div.textContent = log.display;
    logListElTimers.appendChild(div);
  });
}

function fmt(ms){
  if(ms < 0) ms = 0;
  let s = Math.floor(ms/1000);
  let h = Math.floor(s/3600);
  s %= 3600;
  let m = Math.floor(s/60);
  s %= 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDate(d){
  const y = d.getFullYear();
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${day}/${mo}/${y} ${h}:${m}`;
}

renderLogs();

/* ================= טיימר מותאם ================= */
function startTimer(hours, minutes, seconds) {
  // ביטול טיימר קודם אם קיים
  if(timerInterval) clearInterval(timerInterval);

  currentDurationMs = (hours*3600 + minutes*60 + seconds) * 1000;
  let remainingMs = currentDurationMs;
  const remainingEl = document.getElementById("remaining");
  timerEnd = Date.now() + remainingMs;

  remainingEl.textContent = fmt(remainingMs);

  timerInterval = setInterval(() => {
    remainingMs = timerEnd - Date.now();
    if(remainingMs <= 0){
      clearInterval(timerInterval);
      remainingEl.textContent = "00:00:00";
      addTimerLog(currentDurationMs); // שמירת הלוג בסיום הטיימר
      return;
    }
    remainingEl.textContent = fmt(remainingMs);
  }, 200); // עדכון כל רבע שנייה
}
