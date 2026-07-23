/**
 * ESP32-3 — Rels zanjiri kuchlanishi (1-guruh: 1ЧП, 2СП, 1НП)
 * Qorli Tog' stansiyasi uchun
 *
 * Har bir seksiya uchun 2 ta ZMPT101B: quvvat tomoni + rele tomoni.
 * Faqat kuchlanish o'lchaydi — signal holati (ochiq/band)ga tegishli emas,
 * shuning uchun Telegram yo'q, faqat HTTP POST /api/rail-voltage.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD — secrets.h git'ga tushmaydi, secrets.example.h'dan nusxa oling

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// Server manzili — Vercel'ga deploy qilingan bulutli backend (HTTPS, port kerak emas)
const char* SERVER_HOST = "qorlitog-server-v4.vercel.app";
const char* DEVICE_ID = "esp32-3";

WiFiClientSecure client;

// ===== Seksiyalar va ularning ADC pinlari =====
// GPIO 32,33,34,35,36,39 — ESP32'da Wi-Fi bilan bir vaqtda ishonchli
// ishlaydigan yagona analog (ADC1) pinlar. Boshqa pinlar (ADC2 guruhi)
// Wi-Fi yoqilganda barqaror ishlamaydi, shuning uchun ishlatilmaydi.
const int SECTION_COUNT = 3;
const char* sectionNames[SECTION_COUNT] = { "1ЧП", "2СП", "1НП" };
const int powerPins[SECTION_COUNT]      = { 32, 34, 36 };
const int relayPins[SECTION_COUNT]      = { 33, 35, 39 };

// Kalibrlash koeffitsientlari — hali sozlanmagan (1.0 — placeholder).
// Kalibrlash: Serial Monitor'da "RAW RMS" qiymatini ko'ring, multimetr bilan
// haqiqiy kuchlanishni o'lchang, keyin: koeffitsient = haqiqiyKuchlanish / RAW_RMS
float powerCal[SECTION_COUNT] = { 1.0f, 1.0f, 1.0f };
float relayCal[SECTION_COUNT] = { 1.0f, 1.0f, 1.0f };

unsigned long lastSend = 0;

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

// ZMPT101B'dan RMS (effektiv) qiymatni hisoblash: bir necha o'nlab
// millisekund davomida (~50Hz'ning bir necha davri) o'qib, o'rtacha (bias)
// atrofidagi tebranishning kvadrat o'rtachasi ildizini topadi.
float readRawRmsOnce(int pin) {
  const int samples = 400;
  long sum = 0;
  static int readings[samples];
  for (int i = 0; i < samples; i++) {
    readings[i] = analogRead(pin);
    sum += readings[i];
    delayMicroseconds(100);
  }
  float mean = (float)sum / samples;
  double sumSq = 0;
  for (int i = 0; i < samples; i++) {
    double diff = readings[i] - mean;
    sumSq += diff * diff;
  }
  return sqrt(sumSq / samples);
}

// Bitta o'lchov WiFi radiosi tufayli tasodifan buzilib qolishi mumkin
// (ADC o'qishlari orasidagi vaqt bir zumga notekis bo'lib qolsa), shuning
// uchun 5 marta o'lchab, medianasini (o'rtadagi qiymatini) olamiz — eng
// yuqori yoki eng past (shovqinli) natija shu bilan e'tiborga olinmaydi,
// yakuniy qiymat multimetrga yaqinroq va barqaror bo'ladi.
float readRawRms(int pin) {
  const int N = 5;
  float vals[N];
  for (int i = 0; i < N; i++) {
    vals[i] = readRawRmsOnce(pin);
  }
  for (int i = 0; i < N - 1; i++) {
    for (int j = 0; j < N - 1 - i; j++) {
      if (vals[j] > vals[j + 1]) {
        float tmp = vals[j]; vals[j] = vals[j + 1]; vals[j + 1] = tmp;
      }
    }
  }
  return vals[N / 2];
}

void sendVoltages() {
  StaticJsonDocument<512> doc;
  doc["device"] = DEVICE_ID;
  JsonObject voltages = doc.createNestedObject("voltages");

  for (int i = 0; i < SECTION_COUNT; i++) {
    float rawPower = readRawRms(powerPins[i]);
    float rawRelay = readRawRms(relayPins[i]);
    float vPower = rawPower * powerCal[i];
    float vRelay = rawRelay * relayCal[i];

    Serial.printf("%s: quvvat RAW=%.1f -> %.1fV | rele RAW=%.1f -> %.1fV\n",
                  sectionNames[i], rawPower, vPower, rawRelay, vRelay);

    JsonObject sec = voltages.createNestedObject(sectionNames[i]);
    sec["power"] = vPower;
    sec["relay"] = vRelay;
  }

  HTTPClient http;
  char url[96];
  snprintf(url, sizeof(url), "https://%s/api/rail-voltage", SERVER_HOST);
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("rail-voltage update: %d\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  client.setInsecure();

  for (int i = 0; i < SECTION_COUNT; i++) {
    analogSetPinAttenuation(powerPins[i], ADC_11db);
    analogSetPinAttenuation(relayPins[i], ADC_11db);
  }

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();
  if (now - lastSend > 3000) {
    lastSend = now;
    sendVoltages();
  }

  delay(50);
}
