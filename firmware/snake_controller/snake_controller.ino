/*
 * ==============================================================================
 * Project: Bio-Inspired Modular Snake Robot Controller
 * Platform: ESP32-C3 (RISC-V)
 * Actuators: 13x Waveshare ST3020 / ST3215 Serial Bus Servos (1 Mbps)
 * Sensors:   MPU-6050 (IMU), MQ-3 (Gas), Flame Detector, DHT11 (Climate)
 * Gait:      Hirose Serpenoid Locomotion (Central Pattern Generator)
 * ==============================================================================
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <SMS_STS.h>

// ==========================================
// 1. PIN CONFIGURATIONS FOR ESP32-C3
// ==========================================
// Serial Bus Servo UART (Serial1)
#define S_RX_PIN        4     // ESP32-C3 RX -> Servo Driver TX
#define S_TX_PIN        5     // ESP32-C3 TX -> Servo Driver RX
#define SERVO_BAUD      1000000

// Sensor Interfaces
#define DHT_PIN         2     // Digital single-bus
#define DHTTYPE         DHT11
#define MQ3_ADC_PIN     0     // ADC1 Channel 0 (Analog input)
#define FLAME_PIN       1     // Digital Input (Active LOW)
#define I2C_SDA_PIN     8     // MPU6050 SDA
#define I2C_SCL_PIN     9     // MPU6050 SCL

// ==========================================
// 2. CONSTANTS & GAIT PARAMETERS
// ==========================================
#define NUM_SERVOS      13    // 13 Bus Servos
#define CENTER_POS      2048  // Neutral straight angle (12-bit: 0 to 4095)
#define TICKS_PER_DEG   11.38f // 4096 / 360 deg

// Kinematic Gait Variables
float gaitFrequency  = 0.45f; // Slow, deliberate, realistic slither speed (Hz)
float amplitudeDeg   = 34.0f; // Joint curvature amplitude (degrees)
float phaseLagDeg    = 40.0f; // Phase delay between consecutive joints
float steeringBias   = 0.0f;  // Negative = Turn Left, Positive = Turn Right

// Hazard Thresholds
const int MQ3_ALERT_LEVEL = 1800; // ADC threshold (0 to 4095)

// ==========================================
// 3. OBJECT INSTANCES & BUFFERS
// ==========================================
SMS_STS st;
DHT dht(DHT_PIN, DHTTYPE);
Adafruit_MPU6050 mpu;

// Synchronous Serial Buffers (Single broadcast packet for all 13 servos)
byte  servoIDs[NUM_SERVOS];
s16   targetPositions[NUM_SERVOS];
u16   servoSpeeds[NUM_SERVOS];
u8    servoAccels[NUM_SERVOS];

// Non-blocking Task Timing
unsigned long lastGaitUpdateMs   = 0;
const unsigned long gaitInterval = 25; // 40 Hz locomotion update

unsigned long lastFastSensorMs   = 0;
const unsigned long fastInterval = 100; // 10 Hz IMU, Gas, Flame polling

unsigned long lastDhtMs          = 0;
const unsigned long dhtInterval  = 2000; // 0.5 Hz DHT11 polling

// Global Sensor Readings
float currentPitch = 0.0f;
float currentRoll  = 0.0f;
bool  isFlameDetected = false;
int   rawGasLevel = 0;
float currentTemp = 0.0f;
float currentHum  = 0.0f;

// ==========================================
// SETUP ROUTINE
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[SYSTEM] Booting Snake Robot Master Controller...");

  // 1. Initialize Hardware UART for Servos
  Serial1.begin(SERVO_BAUD, SERIAL_8N1, S_RX_PIN, S_TX_PIN);
  st.pSerial = &Serial1;

  for (int i = 0; i < NUM_SERVOS; i++) {
    servoIDs[i] = i + 1; // Assign IDs: 1 to 13
    targetPositions[i] = CENTER_POS;
    servoSpeeds[i] = 1200;
    servoAccels[i] = 50;
  }

  // Soft startup: Align all 13 joints into a straight line
  Serial.println("[SERVOS] Calibrating to neutral center...");
  st.SyncWritePosEx(servoIDs, NUM_SERVOS, targetPositions, servoSpeeds, servoAccels);
  delay(1500);

  // 2. Initialize Sensors
  pinMode(FLAME_PIN, INPUT);
  pinMode(MQ3_ADC_PIN, INPUT);
  dht.begin();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (!mpu.begin()) {
    Serial.println("[ERROR] MPU6050 IMU not detected on I2C bus!");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[OK] MPU6050 IMU Online.");
  }

  Serial.println("[SYSTEM] Ready. Autonomous locomotion & telemetry active.\n");
}

// ==========================================
// MAIN EXECUTIVE LOOP (COOPERATIVE MULTITASKING)
// ==========================================
void loop() {
  unsigned long now = millis();

  // TASK 1: Hirose Serpenoid Locomotion (40 Hz)
  if (now - lastGaitUpdateMs >= gaitInterval) {
    lastGaitUpdateMs = now;
    updateSerpenoidLocomotion(now);
  }

  // TASK 2: Fast Sensor Telemetry (IMU, Gas, Flame @ 10 Hz)
  if (now - lastFastSensorMs >= fastInterval) {
    lastFastSensorMs = now;
    readFastSensors();
  }

  // TASK 3: Climate Sensor Polling (DHT11 @ 0.5 Hz)
  if (now - lastDhtMs >= dhtInterval) {
    lastDhtMs = now;
    readClimateSensor();
  }
}

// ==========================================
// KINEMATICS: SERPENOID GAIT GENERATION
// ==========================================
void updateSerpenoidLocomotion(unsigned long currentMs) {
  float t = currentMs / 1000.0f;

  for (int i = 0; i < NUM_SERVOS; i++) {
    // Spatial wave phase shift
    float phaseRad = (i * phaseLagDeg) * (PI / 180.0f);

    // Serpenoid equation with steering offset
    float angleDeg = (amplitudeDeg * sin(2.0f * PI * gaitFrequency * t + phaseRad)) + steeringBias;

    // Convert degrees to encoder steps
    int targetStep = (int)(CENTER_POS + (angleDeg * TICKS_PER_DEG));

    // Clamp within physical joint travel limit (+-60 degrees)
    targetPositions[i] = constrain(targetStep, CENTER_POS - 700, CENTER_POS + 700);
    servoSpeeds[i]     = 1400;
    servoAccels[i]     = 60;
  }

  // Dispatch all 13 servo angles simultaneously
  st.SyncWritePosEx(servoIDs, NUM_SERVOS, targetPositions, servoSpeeds, servoAccels);
}

// ==========================================
// SENSOR POLLING FUNCTIONS
// ==========================================
void readFastSensors() {
  // 1. Read Flame Detector (Active LOW)
  isFlameDetected = (digitalRead(FLAME_PIN) == LOW);

  // 2. Read MQ-3 Gas Sensor
  rawGasLevel = analogRead(MQ3_ADC_PIN);

  // 3. Read MPU6050
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  currentRoll  = atan2(a.acceleration.y, a.acceleration.z) * 180.0f / PI;
  currentPitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180.0f / PI;

  // Print telemetry packet once every second
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();
    Serial.printf("[TELEMETRY] Pitch: %+.1f° | Roll: %+.1f° | Gas: %d | Fire: %s | Temp: %.1f°C | Hum: %.1f%%\n",
                  currentPitch, currentRoll, rawGasLevel,
                  isFlameDetected ? "ACTIVE ALERT" : "None",
                  currentTemp, currentHum);
  }
}

void readClimateSensor() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (!isnan(h) && !isnan(t)) {
    currentHum  = h;
    currentTemp = t;
  }
}
