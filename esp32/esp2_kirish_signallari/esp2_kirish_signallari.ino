/**
 * ESP32 — Kirish signallari (Entry Signals + Strelkalar)
 * Qorli Tog' stansiyasi uchun
 *
 * PС/ПП, КП, ДСО/ПП signallari + strelka indikatorlari
 * Telegram bot + HTTP POST /api/update
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, BOTtoken, CHAT_ID — secrets.h git'ga tushmaydi, secrets.example.h'dan nusxa oling

// WiFi (1-ESP bilan bir xi l)
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// Server manzili
// DIQQAT: bu router DHCP bergan IP, qayta yoqilsa o'zgarishi mumkin — server
// terminalidagi "Tarmoqda: http://<IP>:3000" qatoridan tekshirib turing.
const char* SERVER_HOST = "10.146.85.59";
const int   SERVER_PORT = 3000;

// Bu qurilmani serverda ajratish uchun nom (HeroBar'dagi onlayn/oflayn indikatori shu bo'yicha ishlaydi)
const char* DEVICE_ID = "esp32-2";

WiFiClientSecure client;
UniversalTelegramBot bot(BOTtoken, client);

const char* ntpServer = "pool.ntp.org";

// Signal pinlari (GPIO)
// JUFT/TOQ: GPIO 34,35,36,39 INPUT-ONLY (PULLUP ishlamaydi) → ishlatilmaydi
// Juft tomon (Ч) — chap kirish
const int PIN_PS_PP_CH = 32;
const int PIN_KP_CH    = 33;
const int PIN_DSO_PP_CH = 2;

// Toq tomon (Н) — o'ng kirish
const int PIN_PS_PP_N = 5;      // ПС/ПП_N
const int PIN_KP_N    = 16;     // КП_N
const int PIN_DSO_PP_N = 17;    // ДСО/ПП_N

// Strelka indikatorlari
const int PIN_2PK    = 25;    // 2ПК
const int PIN_2MK    = 26;    // 2МК
const int PIN_46PK   = 27;    // 4-6ПК
const int PIN_46MK   = 14;    // 4-6МК
const int PIN_1PK    = 12;    // 1ПК
const int PIN_1MK    = 13;    // 1МК
const int PIN_35PK   = 15;    // 3-5ПК
const int PIN_35MK   = 4;     // 3-5МК

// Signal nomlari (serverga yuborish uchun)
const char* names[14] = {
  "ПС/ПП_Ч", "КП_Ч", "ДСО/ПП_Ч", "ПС/ПП_N", "КП_N", "ДСО/ПП_N",
  "2ПК", "2МК", "4-6ПК", "4-6МК", "1ПК", "1МК", "3-5ПК", "3-5МК"
};

// Pin raqamlari
int pins[14] = {
  PIN_PS_PP_CH, PIN_KP_CH, PIN_DSO_PP_CH, PIN_PS_PP_N, PIN_KP_N, PIN_DSO_PP_N,
  PIN_2PK, PIN_2MK, PIN_46PK, PIN_46MK, PIN_1PK, PIN_1MK, PIN_35PK, PIN_35MK
};

// Oxirgi holatlar
bool lastState[14] = { LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW, LOW };

// Vaqt hisoblagichlari (necha sekund band/ochiq bo'lganini bilish uchun)
unsigned long changeStart[14] = { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 };

unsigned long lastHeartbeat = 0;

String getTimeStr() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "00/00/0000 00:00:00";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%d/%m/%Y %H:%M:%S", &timeinfo);
  return String(buf);
}

void connectWiFi() {
  Serial.print("WiFi ga ulanmoqda...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi ulandi!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void sendUpdate(const char* name, const char* state) {
  HTTPClient http;
  char url[64];
  snprintf(url, sizeof(url), "http://%s:%d/api/update", SERVER_HOST, SERVER_PORT);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["name"] = name;
  doc["state"] = state;
  doc["time"] = getTimeStr();
  doc["device"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("  [%s] -> %s (%d)\n", name, state, code);
  } else {
    Serial.printf("  Xatolik: %d\n", code);
  }
  http.end();
}

void sendTelegram(const String& text) {
  if (bot.sendMessage(CHAT_ID, text, "")) {
    Serial.println("  Telegram yuborildi");
  } else {
    Serial.println("  Telegram xatolik");
  }
}

void checkSignals() {
  for (int i = 0; i < 14; i++) {
    bool val = digitalRead(pins[i]);
    if (val != lastState[i]) {
      String vaqt = getTimeStr();
      String message = "";
      lastState[i] = val;

      const char* state;
      if (i < 6) {
        state = (val == HIGH) ? "green" : "red";
      } else {
        state = (val == HIGH) ? "red" : "green";
      }
      Serial.printf("O'zgarish: %s -> %s\n", names[i], state);
      sendUpdate(names[i], state);

      // Telegram xabar
      if (i < 6) {
        // Kirish signallari (ПС/ПП, КП, ДСО/ПП)
        if (val == HIGH) {
          changeStart[i] = millis();
          message += "🟢 " + String(names[i]) + " OCHIQ\n🕒 " + vaqt;
        } else {
          unsigned long dur = (millis() - changeStart[i]) / 1000;
          message += "🔴 " + String(names[i]) + " YOPILDI\n🕒 " + vaqt;
          if (dur > 0) message += "\n⏱️ Ochiq edi: " + String(dur) + " sekund";
        }
      } else {
        // Strelka indikatorlari (ПК/МК)
        if (val == HIGH) {
          changeStart[i] = millis();
          message += "🟢 " + String(names[i]) + " FAOL\n🕒 " + vaqt;
        } else {
          unsigned long dur = (millis() - changeStart[i]) / 1000;
          message += "🔴 " + String(names[i]) + " NOFAOL\n🕒 " + vaqt;
          if (dur > 0) message += "\n⏱️ Faol edi: " + String(dur) + " sekund";
        }
      }

      sendTelegram(message);
    }
  }
}

void sendHeartbeat() {
  HTTPClient http;
  char url[64];
  snprintf(url, sizeof(url), "http://%s:%d/api/update", SERVER_HOST, SERVER_PORT);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<1024> doc;
  doc["device"] = DEVICE_ID;
  JsonObject signals = doc.createNestedObject("signals");
  for (int i = 0; i < 14; i++) {
    bool v = digitalRead(pins[i]);
    if (i < 6) {
      signals[names[i]] = (v == HIGH) ? "green" : "red";
    } else {
      signals[names[i]] = (v == HIGH) ? "red" : "green";
    }
  }

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("Heartbeat: %d\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  client.setInsecure();

  for (int i = 0; i < 14; i++) {
    pinMode(pins[i], INPUT_PULLUP);
    lastState[i] = digitalRead(pins[i]);
    changeStart[i] = millis();
  }

  connectWiFi();

  configTime(18000, 0, ntpServer);
  setenv("TZ", "UZT-5", 1);
  tzset();

  sendHeartbeat();

  // Telegram start message
  String startMessage = "✅ ESP2 (Kirish signallari) ishga tushdi\n\n";
  startMessage += "===== Entry Signals =====\n";
  for (int i = 0; i < 6; i++) {
    startMessage += String(names[i]);
    startMessage += (lastState[i] == HIGH) ? " 🟢 OCHIQ\n" : " 🔴 YOPILDI\n";
  }
  startMessage += "\n===== Strelkalar =====\n";
  for (int i = 6; i < 14; i++) {
    startMessage += String(names[i]);
    startMessage += (lastState[i] == HIGH) ? " 🟢 FAOL\n" : " 🔴 NOFAOL\n";
  }

  sendTelegram(startMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  checkSignals();

  unsigned long now = millis();
  if (now - lastHeartbeat > 500) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  delay(50);
}
