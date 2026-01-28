#include <Preferences.h>
Preferences prefs;
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>

/* ========= WiFi ========= */
const char* ssid1 = "Netzach";
const char* pass1 = "12345678";

const char* ssid2 = "Cudy-35F8";
const char* pass2 = "51265151";

/* ========= MQTT ========= */
const char* mqttServer = "broker.hivemq.com";
const int   mqttPort   = 1883;
const char* TOPIC_CMD  = "netzach/safe/cmd";

/* ========= NTP ========= */
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7200;   // ישראל
const int   daylightOffset_sec = 0;
bool pulseActive = false;
unsigned long pulseStart = 0;
const unsigned long PULSE_TIME = 2000; // 2 שניות
unsigned long lastLedUpdate = 0;
int ledBrightness = 0;
int ledDir = 1; // 1 = עולה, -1 = יורד

/* ========= PINS ========= */
#define PIN15 15
#define LED_PIN 18


WiFiClient espClient;
PubSubClient mqtt(espClient);

/* ========= STATE ========= */
time_t unlockEpoch = 0;
bool hasLockTime = false;


/* ========= WIFI CONNECT ========= */
void connectWiFi() {

  WiFi.begin(ssid1, pass1);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n🔁 Trying second WiFi...");
    WiFi.begin(ssid2, pass2);
    tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 20) {
      delay(500);
      Serial.print(".");
      tries++;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
  Serial.println("\n📶 WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
} else {
  Serial.println("\n❌ WiFi failed (will retry in loop)");
}
}

/* ========= TIME ========= */
bool isTimeLocked(){
  long left = secondsUntilUnlock();
  if(left < 0) return false;
  return left > 0;
}


void updateBreathingLED(unsigned long interval){

  if(millis() - lastLedUpdate < interval) return;
  lastLedUpdate = millis();

ledBrightness += ledDir * 2;

  if(ledBrightness >= 255){
    ledBrightness = 255;
    ledDir = -1;
  }
  if(ledBrightness <= 0){
    ledBrightness = 0;
    ledDir = 1;
  }

ledcWrite(LED_PIN, ledBrightness);
}

long secondsUntilUnlock(){

  if(!hasLockTime) return -1;

  time_t now = time(nullptr);
  long diff = unlockEpoch - now;

  if(diff <= 0){
    hasLockTime = false;

    prefs.begin("safe", false);
    prefs.putBool("has", false);
    prefs.end();

    return 0;
  }

  return diff;
}

/* ========= MQTT CALLBACK ========= */
void mqttCallback(char* topic, byte* payload, unsigned int length) {

  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("📩 MQTT => ");
  Serial.println(msg);

  // ----- LOCK UNTIL TIME -----
  if (msg.startsWith("LOCK:")) {

    String t = msg.substring(5);   // HH:MM:SS
    int h, m, s;

    if (sscanf(t.c_str(), "%d:%d:%d", &h, &m, &s) == 3 &&
        h >= 0 && h < 24 &&
        m >= 0 && m < 60 &&
        s >= 0 && s < 60) {

      struct tm now;
      if (!getLocalTime(&now)) {
        Serial.println("❌ No NTP time, cannot lock");
        return;
      }

      struct tm unlock = now;
      unlock.tm_hour = h;
      unlock.tm_min  = m;
      unlock.tm_sec  = s;

      time_t unlockT = mktime(&unlock);

      time_t nowT = time(nullptr);

      // אם הזמן כבר עבר — לא לנעול ל־מחר
      if (unlockT <= nowT) {
        Serial.println("⚠️ LOCK time already passed, ignoring");
        return;
      }

      unlockEpoch = unlockT;
      hasLockTime = true;

      prefs.begin("safe", false);
      prefs.putULong("unlock", (uint32_t)unlockEpoch);
      prefs.putBool("has", true);
      prefs.end();

      Serial.printf("🔒 Locked until %02d:%02d:%02d\n", h, m, s);
    }
    else {
      Serial.println("❌ Invalid LOCK format (need HH:MM:SS)");
    }

    return;
  }

  // ----- OPEN -----
  if (msg == "OPEN") {

    if (isTimeLocked()) {
      Serial.println("⛔ OPEN BLOCKED (time lock active)");
      return;
    }

    Serial.println("🔓 SAFE OPEN");
    triggerPulse();
    return;
  }

  // ----- CLOSE -----
  if (msg == "CLOSE") {
    Serial.println("🔒 SAFE CLOSED");
    digitalWrite(PIN15, LOW);
    return;
  }
}



void triggerPulse(){

  if(pulseActive){
    Serial.println("⚠️ Pulse already active");
    return;
  }

  Serial.println("⚡ RELAY PULSE START");
  digitalWrite(PIN15, HIGH);

  pulseActive = true;
  pulseStart = millis();
}

/* ========= MQTT CONNECT ========= */
void connectMQTT() {

  while (!mqtt.connected()) {

    Serial.print("🔌 Connecting MQTT... ");

    String cid = "ESP32_SAFE_" + String(random(0xffff), HEX);

    if (mqtt.connect(cid.c_str())) {
      Serial.println("connected");
      mqtt.subscribe(TOPIC_CMD);
      Serial.print("📡 Subscribed: ");
      Serial.println(TOPIC_CMD);
    } else {
      Serial.print("failed rc=");
      Serial.print(mqtt.state());
      Serial.println(" retry...");
      delay(2000);
    }
  }
}

/* ========= SETUP ========= */
void setup() {

  Serial.begin(115200);

  pinMode(PIN15, OUTPUT);
  digitalWrite(PIN15, LOW);

  // --- WiFi ---
  WiFi.mode(WIFI_STA);
  connectWiFi();

  // --- NTP ---
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  Serial.print("⏱ Waiting for NTP");
  struct tm t;
  unsigned long start = millis();

  while (!getLocalTime(&t) && millis() - start < 15000) {
    Serial.print(".");
    delay(500);
  }

  if(!getLocalTime(&t)){
    Serial.println("\n⚠️ NTP failed, running without time lock");
  }
  else{
    Serial.println("\n✅ Time synced");
  }

  // ===== LOAD LOCK TIME FROM FLASH =====
  prefs.begin("safe", true);
  hasLockTime = prefs.getBool("has", false);
  if (hasLockTime) {
    unlockEpoch = prefs.getULong("unlock", 0);
  }
  prefs.end();

  // 🔥 אם הייתה נעילה שכבר נגמרה – לנקות
  if (hasLockTime) {
    time_t now = time(nullptr);
    if (unlockEpoch <= now) {
      Serial.println("🧹 Stored lock expired, clearing");

      hasLockTime = false;
      unlockEpoch = 0;

      prefs.begin("safe", false);
      prefs.putBool("has", false);
      prefs.end();
    }
  }

  // --- MQTT ---
  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(mqttCallback);

  // --- LED PWM ---
  ledcAttach(LED_PIN, 5000, 8);   // pin, freq, resolution
}


/* ========= LOOP ========= */
void loop() {

 if (WiFi.status() != WL_CONNECTED) {
  connectWiFi();
  delay(1000);
  return;
}
  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  // ----- pulse auto off -----
  if(pulseActive && millis() - pulseStart >= PULSE_TIME){
    digitalWrite(PIN15, LOW);
    pulseActive = false;
    Serial.println("⚡ RELAY PULSE END");
  }

// ----- LED logic -----
long left = secondsUntilUnlock();

if(pulseActive){
  ledcWrite(LED_PIN, 255);   // דלוק חזק בזמן פתיחה
}
else if(hasLockTime && left > 0){

  if(left > 1800){
    // יותר מ-30 דקות -> כבוי
    ledcWrite(LED_PIN, 0);
  }
  else if(left > 600){
    // 30 דקות אחרונות -> נשימה איטית
    updateBreathingLED(40);
  }
  else{
    // 10 דקות אחרונות -> נשימה מהירה
    updateBreathingLED(10);
  }

}
else{
  // הזמן נגמר או אין נעילה -> דלוק קבוע
  ledcWrite(LED_PIN, 255);
}
}
