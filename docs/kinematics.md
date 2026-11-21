# Kinematics & Serpentine Locomotion Guide

This document describes the mathematical formulation of the **Hirose Serpenoid curve** and how the Central Pattern Generator (CPG) controls the 13 articulated joints on the snake robot.

---

## 1. The Hirose Serpenoid Curve

Biological snakes propel themselves over terrain primarily via **lateral undulation**. Shigeo Hirose discovered that the curvature along a biological snake’s spine varies continuously as a sinusoidal function of body length.

For a discrete multi-joint modular snake robot, the relative angle $\theta_i$ of joint $i$ at time $t$ is expressed as:

$$\theta_i(t) = A \cdot \sin(2\pi f t + (i - 1)\Delta\phi) + \gamma$$

### Variable Descriptions:
- **$i \in \{1, 2, \dots, N\}$**: The joint index ($N = 13$ in this robot).
- **$A$ (Amplitude)**: The maximum angular displacement of each joint (in degrees or radians). Controls the width of the slithering wave.
- **$f$ (Temporal Frequency)**: The wave oscillation speed in Hertz ($\text{Hz} = \text{cycles/sec}$). Controls how fast the wave travels from head to tail.
- **$\Delta\phi$ (Spatial Phase Shift)**: The phase difference between two consecutive joints. Controls how many S-curves exist along the body.
- **$\gamma$ (Steering Bias)**: A constant directional offset applied to all joints. Tilts the body axis left or right for smooth steering.

---

## 2. Encoder Mapping (12-bit Resolution)

The Waveshare ST3020 / ST3215 uses a high-precision 12-bit magnetic encoder with $4096$ steps per $360^\circ$:

$$\text{Steps per Degree} = \frac{4096}{360} \approx 11.378 \text{ ticks/deg}$$

$$\text{Target Position Steps} = 2048 + (\theta_i(t) \times 11.378)$$

- $\theta_i = 0^\circ \implies 2048$ (Straight / Neutral)
- $\theta_i = +35^\circ \implies 2048 + (35 \times 11.378) = 2446$
- $\theta_i = -35^\circ \implies 2048 - (35 \times 11.378) = 1650$

---

## 3. Recommended Gait Parameter Values

| Terrain Condition | Amplitude ($A$) | Frequency ($f$) | Phase Lag ($\Delta\phi$) | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Flat Floor / Laboratory** | $32^\circ - 36^\circ$ | $0.45\text{ Hz} - 0.60\text{ Hz}$ | $40^\circ$ | High efficiency, maximum forward speed |
| **Tight Caves / Holes** | $22^\circ - 26^\circ$ | $0.35\text{ Hz} - 0.45\text{ Hz}$ | $35^\circ$ | Low-profile lateral sweep avoids tunnel walls |
| **Rough Rocky Ground** | $38^\circ - 42^\circ$ | $0.30\text{ Hz} - 0.40\text{ Hz}$ | $45^\circ$ | High torque, deep undulations push against rocks |

---

## 4. Steering Dynamics

Steering the snake robot does not require complex differential kinematics. By adding a constant offset $\gamma$ to the Serpenoid wave:

$$\theta_i(t) = A \cdot \sin(\dots) + \gamma$$

- **Straight Motion:** $\gamma = 0^\circ$
- **Left Turn:** $\gamma = -12^\circ \text{ to } -18^\circ$
- **Right Turn:** $\gamma = +12^\circ \text{ to } +18^\circ$

The body will bend into an arc while continuing its undulating wave, producing a smooth turning radius.
