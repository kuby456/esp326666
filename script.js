/* ================= ELEMENTS ================= */
const remainingEl = document.getElementById("remaining");
const barWrap = document.getElementById("barWrap");
const barFill = document.getElementById("barFill");
const barText = document.getElementById("barText");

const hSel = document.getElementById("hours");
const mSel = document.getElementById("minutes");
const sSel = document.getElementById("seconds");
const nextDurEl = document.getElementById("nextDur");
const endTimeEl = document.getElementById("endTime");


/* ================= STATE ================= */
let selectedDurationMs = 0;
let totalMs = 0;
let endTime = 0;
let tickTimer = null;
let showBar = false;
let confirmInterval = null;
let confirmOpen = false;


function lockTimeSelect(lock){
  hSel.disabled = lock;
  mSel.disabled = lock;
  sSel.disabled = lock;
}

/* ================= TIME SELECT ================= */
function updateSelectedDuration(){
  const h = parseInt(hSel.value);
  const m = parseInt(mSel.value);
  const s = parseInt(sSel.value);
  selectedDurationMs = (h*3600 + m*60 + s) * 1000;
}
hSel.onchange = mSel.onchange = sSel.onchange = updateSelectedDuration;
updateSelectedDuration();

/* ================= TOGGLE VIEW ================= */
function toggleTimerView(){
  showBar = !showBar;
  barWrap.classList.toggle("hidden", !showBar);
  remainingEl.classList.toggle("hidden", showBar);
}

/* ================= FORMAT ================= */
function fmt(ms){
  if(ms < 0) ms = 0;
  let s = Math.floor(ms/1000);
  let h = Math.floor(s/3600);
  s %= 3600;
  let m = Math.floor(s/60);
  s %= 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function durationToWords(ms){
  let s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  s %= 3600;
  const m = Math.floor(s/60);
  s %= 60;

  let parts = [];
  if(h) parts.push(h + " שעה" + (h>1 ? "ות" : ""));
  if(m) parts.push(m + " דקה" + (m>1 ? "ות" : ""));
if(s){
  parts.push(
    s === 1
      ? "שנייה"
      : s + " שניות"
  );
}

  if(parts.length === 0) return "פחות משניה";

  if(parts.length === 1) return parts[0];
  if(parts.length === 2) return parts[0] + " ו־" + parts[1];

  return parts[0] + ", " + parts[1] + " ו־" + parts[2];
}

function updateLastDuration(ms){
  if(!ms || ms <= 0){
    nextDurEl.textContent = "--:--:--";
    return;
  }

  nextDurEl.textContent = fmt(ms);
}


/* ================= START FLOW ================= */

function startWithConfirm(){
  if(confirmOpen) return;

  if(selectedDurationMs <= 0){
    alert("לא נבחר זמן");
    return;
  }

  confirmOpen = true;
  showConfirmModal();
}

function updateEndClock(end){
  if(!end || end <= Date.now()){
    endTimeEl.textContent = "--:--";
    return;
  }

  const d = new Date(end);
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');

  endTimeEl.textContent = `${h}:${m}`;
}

/* ================= CONFIRM MODAL ================= */
function showConfirmModal(){
  const bg = document.createElement("div");
  bg.className = "confirmBg";

  bg.innerHTML = `
    <div class="confirmCard">
      <div id="confirmCountdown">15</div>
<div id="confirmText">
  הטיימר ל־${durationToWords(selectedDurationMs)} יתחיל בעוד
</div>
      <div class="confirmHint">ניתן לבטל לפני ההפעלה</div>
      <div class="confirmBtns">
        <button class="stop" id="cancelBtn">ביטול</button>
        <button class="start" id="okBtn">אישור</button>
      </div>
    </div>
  `;

  document.body.appendChild(bg);

const cancelBtn = bg.querySelector("#cancelBtn");

cancelBtn.onclick = () => {

  if (confirmInterval) {
    clearInterval(confirmInterval);
    confirmInterval = null;
  }

  bg.remove();
  lockTimeSelect(false);
  confirmOpen = false;   // מאפשר פתיחה מחדש של המודאל
};



const okBtn = bg.querySelector("#okBtn");

okBtn.onclick = ()=>{
  okBtn.disabled = true;          // 🚫 חוסם לחיצות כפולות
  okBtn.classList.add("disabled");
  startBannerCountdown(bg);
};
}

const dot = document.getElementById("dot");
setDotState(false); // ברירת מחדל: ירוק (לא רץ)

function setDotState(isRunning){
  if(isRunning){
    dot.classList.add("on");
    dot.classList.remove("off");
  } else {
    dot.classList.add("off");
    dot.classList.remove("on");
  }
}

function startBannerCountdown(bg){
  if(confirmInterval) clearInterval(confirmInterval); // 🧹 ביטחון

  let t = 15;
  const el = bg.querySelector("#confirmCountdown");

  confirmInterval = setInterval(async ()=>{
    t--;
    el.textContent = t;

    if(t <= 0){
  clearInterval(confirmInterval);
  confirmInterval = null;
  bg.remove();

  confirmOpen = false; // ✅ חשוב

  startMainTimer(selectedDurationMs);
sendLockFromTimer();   // במקום sendCommandIfAllowed()
}

  },1000);
}


/* ================= MAIN TIMER ================= */
function startMainTimer(ms){
  clearInterval(tickTimer);

  lockTimeSelect(true);

  totalMs = ms;
  endTime = Date.now() + ms;

  saveTimer();

  // 🔹 עדכון תצוגות
  updateLastDuration(totalMs);
  updateEndClock(endTime);

  updateUI();
  setDotState(true); // אדום - טיימר רץ

  tickTimer = setInterval(updateUI, 500);
}



function updateUI(){
  const left = endTime - Date.now();

  if(left <= 0){
    finishTimer();
    return;
  }

  remainingEl.textContent = fmt(left);

  const p = Math.round((1 - left/totalMs) * 100);
  barFill.style.width = p + "%";
  barText.textContent = p + "%";
}

function finishTimer(){
  clearInterval(tickTimer);
  tickTimer = null;

  remainingEl.textContent = "00:00:00";
  barFill.style.width = "100%";
  barText.textContent = "100%";

  localStorage.removeItem("safeTimer");

  // 🔹 איפוס תצוגות
  updateLastDuration(0);
  updateEndClock(0);
  setDotState(false); // ירוק - לא רץ


  lockTimeSelect(false);
}



/* ================= LOCAL STORAGE ================= */
function saveTimer(){
  localStorage.setItem("safeTimer", JSON.stringify({ endTime, totalMs }));
}

function loadTimer(){
  const s = localStorage.getItem("safeTimer");
  if(!s) return;

  try{
    const o = JSON.parse(s);
    if(o.endTime > Date.now()){
      totalMs = o.totalMs;
      endTime = o.endTime;

      lockTimeSelect(true);

  updateLastDuration(totalMs);
  updateEndClock(endTime);

  setDotState(true);

      updateUI();
      tickTimer = setInterval(updateUI, 500);
    }else{
      localStorage.removeItem("safeTimer");
    }
  }catch{
    localStorage.removeItem("safeTimer");
  }
}




loadTimer();

