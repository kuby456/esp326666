#include <Preferences.h>
Preferences prefs;
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>

/* ========= WiFi ========= */
const char* ssid1 = "Netzach";
const char* pass1 = "12345678";

const char* ssid2 = "Cudy-35F8-5G";
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
int lockHour = -1;
int lockMin  = -1;
bool hasLockTime = false;

/* ========= WIFI CONNECT ========= */
void connectWiFi() {

  WiFi.mode(WIFI_STA);
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
    Serial.println("\n❌ WiFi failed, retry...");
    delay(3000);
    connectWiFi();
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

  ledBrightness += ledDir * 5;

  if(ledBrightness >= 255){
    ledBrightness = 255;
    ledDir = -1;
  }
  if(ledBrightness <= 0){
    ledBrightness = 0;
    ledDir = 1;
  }

  analogWrite(LED_PIN, ledBrightness);
}

long secondsUntilUnlock(){

  if(!hasLockTime) return -1;

  struct tm t;
  if(!getLocalTime(&t)) return -1;

  long nowSec = t.tm_hour*3600 + t.tm_min*60 + t.tm_sec;
  long lockSec = lockHour*3600 + lockMin*60;

  long diff = lockSec - nowSec;

  // אם יצא שלילי → זה אומר יום הבא
  if(diff < 0){
    diff += 24L * 3600L;
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

  String t = msg.substring(5);   // HH:MM
  int h, m;

  if (sscanf(t.c_str(), "%d:%d", &h, &m) == 2) {
    lockHour = h;
    lockMin  = m;
    hasLockTime = true;

    // ✅ שמירה ל-Flash
    prefs.begin("safe", false);
    prefs.putInt("lockH", lockHour);
    prefs.putInt("lockM", lockMin);
    prefs.putBool("has", true);
    prefs.end();

    Serial.printf("🔒 Locked until %02d:%02d (saved)\n", lockHour, lockMin);
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
digitalWrite(LED_PIN, LOW);
    return;
  }

  // ----- CLOSE -----
  if (msg == "CLOSE") {
    Serial.println("🔒 SAFE CLOSED");
    digitalWrite(PIN15, LOW);
    digitalWrite(LED_PIN, HIGH);
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
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(PIN15, LOW);
  digitalWrite(LED_PIN, HIGH);

  connectWiFi();

  // --- NTP חובה בהתחלה ---
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  Serial.print("⏱ Waiting for NTP");
  struct tm t;
  while (!getLocalTime(&t)) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\n✅ Time synced");
  // ===== LOAD LOCK TIME FROM FLASH =====
  prefs.begin("safe", true);

  hasLockTime = prefs.getBool("has", false);
  if (hasLockTime) {
    lockHour = prefs.getInt("lockH", -1);
    lockMin  = prefs.getInt("lockM", -1);

    Serial.printf("🔁 Restored lock time: %02d:%02d\n", lockHour, lockMin);
  }

  prefs.end();

  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(mqttCallback);
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
    analogWrite(LED_PIN, 255);
  }
  else if(hasLockTime && left > 0){

    if(left > 1800){
      analogWrite(LED_PIN, 0);
    }
    else if(left > 600){
      updateBreathingLED(40);
    }
    else{
      updateBreathingLED(10);
    }

  }
  else if(hasLockTime && left <= 0){
    analogWrite(LED_PIN, 255);
  }
  else{
    analogWrite(LED_PIN, 0);
  }
}
