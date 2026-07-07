#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, BOTtoken, CHAT_ID — secrets.h git'ga tushmaydi, secrets.example.h'dan nusxa oling

// DIQQAT: bu tarmoq nomi esp2_kirish_signallari.ino dagi SSID bilan BIR XIL
// bo'lishi kerak (ikkalasi ham server bilan bir xil Wi-Fi/LAN'da bo'lishi shart,
// aks holda bu ESP serverga signal yubora olmaydi).
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// Server manzili — Vercel'ga deploy qilingan bulutli backend (HTTPS, port kerak emas)
const char* SERVER_HOST = "qorlitog-server-v4.vercel.app";
const char* DEVICE_ID = "esp32-1";

WiFiClientSecure client;
UniversalTelegramBot bot(BOTtoken, client);

const char* ntpServer = "pool.ntp.org";


// ================== 1-GURUH ==================

int group1Pins[9] = {
  32, 33, 17, 5, 15,
  4, 13, 14, 16
};

String group1Names[9] = {
  "3-5СП",
  "2СП",
  "1НП",
  "1СП",
  "4-6СП",
  "1ЧП",
  "IП",
  "IIП",
  "IVП"
};


// ================== 2-GURUH ==================

int group2Pins[8] = {
  25, 26, 27, 18,
  19, 21, 22, 23
};

String group2Names[8] = {
  "Н1",
  "Н2",
  "Н4",
  "Ч1",
  "Ч2",
  "Ч4",
  "Н",
  "Ч"
};


bool oldState1[9];
bool oldState2[8];

unsigned long offStart1[9];
unsigned long onStart2[8];

unsigned long lastHeartbeat = 0;

// Debounce: rele/kontakt o'chganda bir necha marta "titrab" (bounce) tez-tez
// HIGH/LOW almashishi mumkin — har bir titrash bloklovchi tarmoq so'rovi
// yuborardi, natijada haqiqiy holat serverga yetguncha soniyalab kechikardi.
bool rawState1[9];
bool rawState2[8];
unsigned long bounceStart1[9] = { 0, 0, 0, 0, 0, 0, 0, 0, 0 };
unsigned long bounceStart2[8] = { 0, 0, 0, 0, 0, 0, 0, 0 };
const unsigned long DEBOUNCE_MS = 50;

// Ikkala guruhda ham LOW = yashil (bo'sh/signal ochiq), HIGH = qizil (band/yopiq)
const char* toServerState(bool state) {
  return state == LOW ? "green" : "red";
}

void sendUpdate(const String& name, const char* state) {
  HTTPClient http;
  char url[96];
  snprintf(url, sizeof(url), "https://%s/api/update", SERVER_HOST);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["name"] = name;
  doc["state"] = state;
  doc["device"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code <= 0) {
    Serial.printf("  /api/update xatolik: %d\n", code);
  }
  http.end();
}

void sendHeartbeat() {
  HTTPClient http;
  char url[96];
  snprintf(url, sizeof(url), "https://%s/api/update", SERVER_HOST);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<1024> doc;
  doc["device"] = DEVICE_ID;
  JsonObject signals = doc.createNestedObject("signals");
  for (int i = 0; i < 9; i++) {
    signals[group1Names[i]] = toServerState(digitalRead(group1Pins[i]));
  }
  for (int i = 0; i < 8; i++) {
    signals[group2Names[i]] = toServerState(digitalRead(group2Pins[i]));
  }

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("Heartbeat: %d\n", code);
  http.end();
}

void setup() {

  Serial.begin(115200);

  WiFi.begin(ssid, password);

  Serial.print("WiFi ulanmoqda");

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  client.setInsecure();

  configTime(18000, 0, ntpServer);

  setenv("TZ", "UZT-5", 1);
  tzset();


  // ===== 1-GURUH =====
  for(int i = 0; i < 9; i++) {

    pinMode(group1Pins[i], INPUT_PULLUP);

    oldState1[i] = digitalRead(group1Pins[i]);
    rawState1[i] = oldState1[i];
  }


  // ===== 2-GURUH =====
  for(int i = 0; i < 8; i++) {

    pinMode(group2Pins[i], INPUT_PULLUP);

    oldState2[i] = digitalRead(group2Pins[i]);
    rawState2[i] = oldState2[i];
  }

  sendHeartbeat();

  // ===== START MESSAGE =====
  String startMessage =
  "✅ ESP32 monitoring ishga tushdi\n\n";


  startMessage += "===== 1-GURUH =====\n";

  for(int i = 0; i < 9; i++) {

    startMessage += group1Names[i];

    if(oldState1[i] == LOW) {

      startMessage += " 🟢 BO'SH\n";
    }
    else {

      startMessage += " 🔴 BAND\n";
    }
  }


  startMessage += "\n===== 2-GURUH =====\n";

  for(int i = 0; i < 8; i++) {

    startMessage += group2Names[i];

    if(oldState2[i] == LOW) {

      startMessage += " 🟢 SIGNAL OCHIQ\n";
    }
    else {

      startMessage += " 🔴 SIGNAL YOPILDI\n";
    }
  }


  bot.sendMessage(CHAT_ID, startMessage, "");

  Serial.println(startMessage);
}



void loop() {


  // ===== WIFI RECONNECT =====
  if(WiFi.status() != WL_CONNECTED) {

    WiFi.begin(ssid, password);

    while(WiFi.status() != WL_CONNECTED) {

      delay(500);
    }
  }



  // ================== 1-GURUH ==================

  for(int i = 0; i < 9; i++) {

    bool raw = digitalRead(group1Pins[i]);
    if (raw != rawState1[i]) {
      rawState1[i] = raw;
      bounceStart1[i] = millis();
    }
    if ((millis() - bounceStart1[i]) < DEBOUNCE_MS) continue;

    bool state = raw;

    if(state != oldState1[i]) {

      struct tm timeinfo;

      getLocalTime(&timeinfo);

      char vaqt[30];

      strftime(
        vaqt,
        sizeof(vaqt),
        "%d/%m/%Y %H:%M:%S",
        &timeinfo
      );

      String message = "";


      // ===== BAND =====
      if(state == HIGH) {

        offStart1[i] = millis();

        message += "🔴 ";
        message += group1Names[i];
        message += " BAND\n\n";

        message += "🕒 ";
        message += vaqt;
      }


      // ===== BO'SH =====
      else {

        unsigned long offTime =
        (millis() - offStart1[i]) / 1000;

        message += "🟢 ";
        message += group1Names[i];
        message += " BO'SH\n\n";

        message += "🕒 ";
        message += vaqt;
        message += "\n\n";

        message += "⏱️ Band edi: ";
        message += String(offTime);
        message += " sekund";
      }


      sendUpdate(group1Names[i], toServerState(state));
      bot.sendMessage(CHAT_ID, message, "");

      Serial.println(message);

      oldState1[i] = state;
    }
  }



  // ================== 2-GURUH ==================

  for(int i = 0; i < 8; i++) {

    bool raw = digitalRead(group2Pins[i]);
    if (raw != rawState2[i]) {
      rawState2[i] = raw;
      bounceStart2[i] = millis();
    }
    if ((millis() - bounceStart2[i]) < DEBOUNCE_MS) continue;

    bool state = raw;

    if(state != oldState2[i]) {

      struct tm timeinfo;

      getLocalTime(&timeinfo);

      char vaqt[30];

      strftime(
        vaqt,
        sizeof(vaqt),
        "%d/%m/%Y %H:%M:%S",
        &timeinfo
      );

      String message = "";


      // ===== SIGNAL OCHIQ =====
      if(state == LOW) {

        onStart2[i] = millis();
        message += "🟢 ";
        message += group2Names[i];
        message += " SIGNAL OCHIQ\n\n";

        message += "🕒 ";
        message += vaqt;
      }


      // ===== SIGNAL YOPILDI =====
      else {

        unsigned long onTime =
        (millis() - onStart2[i]) / 1000;

        message += "🔴 ";
        message += group2Names[i];
        message += " SIGNAL YOPILDI\n\n";

        message += "🕒 ";
        message += vaqt;
        message += "\n\n";

        message += "⏱️ Signal ochiq edi: ";
        message += String(onTime);
        message += " sekund";
      }


      sendUpdate(group2Names[i], toServerState(state));
      bot.sendMessage(CHAT_ID, message, "");

      Serial.println(message);

      oldState2[i] = state;
    }
  }

  unsigned long now = millis();
  if (now - lastHeartbeat > 10000) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  delay(50);
}
