// ===== שליחת OPEN =====
function sendCommandIfAllowed(){

  const fireBtn = document.getElementById("fireBtn");
  fireBtn.disabled = true;
  fireBtn.classList.add("disabled");

  if(!client || !client.connected){
    alert("אין חיבור לשרת MQTT");
    fireBtn.disabled = false;
    fireBtn.classList.remove("disabled");
    return;
  }

  client.publish(TOPIC_CMD, "OPEN");
  console.log("📤 MQTT -> OPEN");

  setTimeout(()=>{
    fireBtn.disabled = false;
    fireBtn.classList.remove("disabled");
  }, 500);
}


// ===== שליחת LOCK לפי הטיימר =====
function sendLockFromTimer(){

  if(!client || !client.connected){
    alert("אין חיבור לשרת MQTT");
    return;
  }

  const h = parseInt(document.getElementById("hours").value);
  const m = parseInt(document.getElementById("minutes").value);
  const s = parseInt(document.getElementById("seconds").value);

  const now = new Date();
  const lock = new Date(now.getTime() + (h*3600 + m*60 + s)*1000);

  const hh = String(lock.getHours()).padStart(2,'0');
  const mm = String(lock.getMinutes()).padStart(2,'0');

  const msg = `LOCK:${hh}:${mm}`;

  client.publish(TOPIC_CMD, msg);
  console.log("📤 MQTT ->", msg);
}
