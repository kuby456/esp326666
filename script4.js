/* ========= MQTT STATE ========= */
let mqttReady = false;

/* ========= STATUS UI ========= */
function setStatus(text, ok){
  console.log("📡 STATUS:", text);
  // אם יש לך באנר / UI – כאן לעדכן
}

/* ========= MQTT EVENTS ========= */
client.on("connect", () => {
  mqttReady = true;
  setStatus("מחובר", true);
  console.log("✅ MQTT CONNECTED");
});

client.on("reconnect", () => {
  mqttReady = false;
  setStatus("מתחבר מחדש…", false);
  console.log("🔄 MQTT RECONNECTING");
});

client.on("offline", () => {
  mqttReady = false;
  setStatus("מנותק", false);
  console.log("📴 MQTT OFFLINE");
});

client.on("close", () => {
  mqttReady = false;
  setStatus("החיבור נסגר", false);
  console.log("❌ MQTT CLOSED");
});

client.on("error", err => {
  console.log("🔥 MQTT ERROR:", err.message);
});


/* ========= HELPER: publish when ready ========= */
function publishWhenReady(topic, payload){
  if (mqttReady) {
    client.publish(topic, payload);
    console.log("📤 MQTT ->", payload);
    return;
  }

  console.warn("⏳ MQTT not ready, waiting to send:", payload);

  client.once("connect", () => {
    client.publish(topic, payload);
    console.log("📤 MQTT ->", payload, "(after connect)");
  });
}

/* ========= OPEN COMMAND ========= */
function sendCommandIfAllowed(){

  const fireBtn = document.getElementById("fireBtn");
  fireBtn.disabled = true;

  publishWhenReady(TOPIC_CMD, "OPEN");

  setTimeout(() => {
    fireBtn.disabled = false;
  }, 500);
}

/* ========= LOCK FROM TIMER ========= */
function sendLockFromTimer(){

  const h = Number(document.getElementById("hours").value)   || 0;
  const m = Number(document.getElementById("minutes").value) || 0;
  const s = Number(document.getElementById("seconds").value) || 0;

  if (h === 0 && m === 0 && s === 0) {
    alert("בחר זמן לנעילה");
    return;
  }

  const now = new Date();
  const unlock = new Date(now.getTime() + (h*3600 + m*60 + s)*1000);

  const hh = String(unlock.getHours()).padStart(2, "0");
  const mm = String(unlock.getMinutes()).padStart(2, "0");
  const ss = String(unlock.getSeconds()).padStart(2, "0");

  const msg = `LOCK:${hh}:${mm}:${ss}`;

  publishWhenReady(TOPIC_CMD, msg);
}

console.log("🚀 MQTT logic loaded");
