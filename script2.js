/* ================= CONFIG ================= */
const PRICE_PER_BOX = 38; // ₪
const CIGS_PER_BOX = 20;
const PRICE_PER_CIG = PRICE_PER_BOX / CIGS_PER_BOX; // 1.9 ₪

/* ================= ELEMENTS ================= */
const todayEl = document.getElementById("todayCnt");
const yestEl = document.getElementById("yestCnt");
const weekEl = document.getElementById("weekCnt");
const lastWeekEl = document.getElementById("lastWeekCnt");
const monthCntEl = document.getElementById("monthCnt");
const monthMoneyEl = document.getElementById("moneyMonth");

/* ================= STATE ================= */
let smokeLog = []; // מערך של תאריכים ISO

/* ================= HELPERS ================= */
function getWeekNumber(d) {
  // מחזיר מספר שבוע בשנה
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

function saveLog() {
  localStorage.setItem("smokeLog", JSON.stringify(smokeLog));
}

function loadLog() {
  const s = localStorage.getItem("smokeLog");
  if(s) {
    try{
      smokeLog = JSON.parse(s);
    }catch{
      smokeLog = [];
    }
  }
}

/* ================= CORE ================= */
function addSmoke(count = 1){
  const now = new Date();
  for(let i=0;i<count;i++){
    smokeLog.push(now.toISOString());
  }
  saveLog();
  updateStats();
}

function updateStats(){
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const yesterday = new Date(now); 
  yesterday.setDate(now.getDate()-1);
  const yesterdayStr = yesterday.toISOString().slice(0,10);

  const weekNum = getWeekNumber(now);
  const lastWeekNum = weekNum - 1;

  let todayCnt = 0, yestCnt = 0, weekCnt = 0, lastWeekCnt = 0, monthCnt = 0;

  smokeLog.forEach(dateStr => {
    const d = new Date(dateStr);
    const dStr = d.toISOString().slice(0,10);
    const dWeek = getWeekNumber(d);
    const dMonth = d.getMonth();

    if(dStr === todayStr) todayCnt++;
    if(dStr === yesterdayStr) yestCnt++;
    if(dWeek === weekNum) weekCnt++;
    if(dWeek === lastWeekNum) lastWeekCnt++;
    if(dMonth === now.getMonth()) monthCnt++;
  });

  todayEl.textContent = todayCnt;
  yestEl.textContent = yestCnt;
  weekEl.textContent = weekCnt;
  lastWeekEl.textContent = lastWeekCnt;
  monthCntEl.textContent = monthCnt;
  monthMoneyEl.textContent = "₪" + (monthCnt * PRICE_PER_CIG).toFixed(2);
}

/* ================= INIT ================= */
loadLog();
updateStats();
