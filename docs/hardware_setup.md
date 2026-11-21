# Hardware Setup & Electrical Wiring

This document details the electrical architecture, wiring pinouts, and power supply guidelines for the Bio-Inspired Modular Snake Robot.

---

## 1. Electrical Schematic & Pinout

```
+---------------------------------------------------------------------------+
|                          ESP32-C3 MASTER MCU                              |
|                                                                           |
|   [GPIO 5] TX1 -------------------> Serial Bus Driver (RX)                |
|   [GPIO 4] RX1 <------------------- Serial Bus Driver (TX)                |
|   [GPIO 8] I2C SDA ---------------> MPU-6050 (SDA)                        |
|   [GPIO 9] I2C SCL ---------------> MPU-6050 (SCL)                        |
|   [GPIO 2] DIGITAL ---------------> DHT11 (DATA)                          |
|   [GPIO 1] DIGITAL <--------------- Flame Sensor (DO - Active LOW)        |
|   [GPIO 0] ADC1_CH0 <-------------- MQ-3 Gas Sensor (AO - Analog)         |
|   [GND] --------------------------> Common System Ground                  |
|   [5V IN] <------------------------ 5V 3A Buck Converter Regulated Rail   |
+---------------------------------------------------------------------------+

+---------------------------------------------------------------------------+
|                      HIGH-TORQUE SERIAL BUS LINE                          |
|                                                                           |
|   7.4V Battery (+) ----------------> Servos 1 to 13 (VIN)                 |
|   Common Ground (-) ---------------> Servos 1 to 13 (GND)                 |
|   Driver TTL Signal ---------------> Daisy-Chain [ID 1 -> 2 ... -> 13]    |
+---------------------------------------------------------------------------+
```

---

## 2. Pin Allocation Summary (ESP32-C3)

| Component | Function | ESP32-C3 Pin | Logic Level | Operating Voltage |
| :--- | :--- | :--- | :--- | :--- |
| **ST3020 / ST3215 Driver** | UART1 TX | **GPIO 5** | 3.3V TTL | 3.3V Logic |
| **ST3020 / ST3215 Driver** | UART1 RX | **GPIO 4** | 3.3V TTL | 3.3V Logic |
| **MPU-6050 IMU** | I2C SDA | **GPIO 8** | 3.3V | 3.3V |
| **MPU-6050 IMU** | I2C SCL | **GPIO 9** | 3.3V | 3.3V |
| **DHT11 Sensor** | 1-Wire Data | **GPIO 2** | 3.3V | 3.3V – 5V |
| **Flame Sensor** | Digital Alert | **GPIO 1** | 3.3V | 3.3V – 5V |
| **MQ-3 Gas Sensor** | Analog Voltage | **GPIO 0 (ADC1)** | 0 – 3.3V | **5V (Heater coil)** |

---

## 3. Power Distribution & Current Requirements

> [!CAUTION]
> **Never power the 13 serial bus servos from the ESP32-C3 3.3V or 5V development pins!** Doing so will immediately burn the board's onboard LDO regulator or cause brownout resets.

- **Servo Power Rail:**
  - 13 $\times$ Waveshare ST3020 servos can draw **up to 1.5A to 2.0A stall current each** during high-torque climbing movements.
  - Recommended Battery: **7.4V 2S LiPo battery (≥3000mAh, 35C continuous discharge)** capable of sustaining **8A to 12A surge current**.
- **Logic Power Rail:**
  - Connect a high-efficiency **5V 3A Step-Down (Buck) Converter** to the 7.4V battery to provide clean 5V power to the ESP32-C3 `5V/VIN` pin and the MQ-3 heater coil.
- **Common Ground:**
  - The battery ground (-), the buck converter ground, the ESP32 ground, and all 13 servo ground pins **must be tied together** to establish a shared reference for the serial UART signals.

---

## 4. Servo ID Configuration

Before assembling the full snake, each ST3020 servo must have its internal EEPROM ID set to a unique address between **1 and 13**:

1. Connect **only one servo** to the Waveshare bus driver board.
2. Run the ID configuration sketch (available in the `SCServo` library examples under `SetID`).
3. Set the first servo to `ID = 1`, test movement, and label it physically.
4. Repeat individually for `ID = 2` through `ID = 13`.
5. Once all 13 servos are individually addressed, they can be daisy-chained together on the single 3-wire bus line.
