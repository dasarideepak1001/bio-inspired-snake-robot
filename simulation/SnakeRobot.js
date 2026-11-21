/**
 * SnakeRobot.js - 3D Digital Twin Simulation for PlayCanvas WebGL
 * 
 * Features:
 * - 1 Head + 13 Waveshare ST3215 / ST3020 Bus Servos
 * - Top-mounted horizontal ESP32 board
 * - Silver aluminum flat connecting clamps & vertical brackets
 * - 3D-printed black rolling circular wheels
 * - Swaying 3D grass meadow with zero background artifacts
 * - Enclosed low-clearance rock cavern with red targeting laser
 */

var SnakeRobot = pc.createScript('snakeRobot');

function rnd(min, max) {
    return min + Math.random() * (max - min);
}

SnakeRobot.prototype.initialize = function() {
    var app = this.app;
    this.time = 0;
    this.snakeSpeed = 1.35; // Deliberate realistic robotics locomotion
    this.servoCount = 13;   // 13 Bus Servos + 1 Head = 14 total
    this.totalSegments = this.servoCount + 1;
    this.spacing = 1.35;

    // --- 1. PHOTOREALISTIC MATERIALS ---
    this.matGround = new pc.StandardMaterial();
    this.matGround.diffuse = new pc.Color(0.20, 0.44, 0.16);
    this.matGround.roughness = 0.9;
    this.matGround.update();

    this.matDarkBrown = new pc.StandardMaterial();
    this.matDarkBrown.diffuse = new pc.Color(0.24, 0.17, 0.12);
    this.matDarkBrown.roughness = 0.95;
    this.matDarkBrown.update();

    this.matGrass1 = new pc.StandardMaterial();
    this.matGrass1.diffuse = new pc.Color(0.25, 0.56, 0.16);
    this.matGrass1.update();

    this.matGrass2 = new pc.StandardMaterial();
    this.matGrass2.diffuse = new pc.Color(0.32, 0.66, 0.20);
    this.matGrass2.update();

    // Waveshare ST3215 Anodized Electric Blue
    this.matServoBlue = new pc.StandardMaterial();
    this.matServoBlue.diffuse = new pc.Color(0.01, 0.52, 1.0);
    this.matServoBlue.emissive = new pc.Color(0.01, 0.15, 0.35);
    this.matServoBlue.metalness = 0.92;
    this.matServoBlue.shininess = 95;
    this.matServoBlue.update();

    this.matBlackWheel = new pc.StandardMaterial();
    this.matBlackWheel.diffuse = new pc.Color(0.12, 0.12, 0.14);
    this.matBlackWheel.roughness = 0.75;
    this.matBlackWheel.update();

    this.matSilver = new pc.StandardMaterial();
    this.matSilver.diffuse = new pc.Color(0.88, 0.90, 0.94);
    this.matSilver.metalness = 0.95;
    this.matSilver.shininess = 95;
    this.matSilver.update();

    this.matScrew = new pc.StandardMaterial();
    this.matScrew.diffuse = new pc.Color(0.95, 0.95, 0.98);
    this.matScrew.metalness = 1.0;
    this.matScrew.update();

    // ESP32 Materials
    this.matGreenPCB = new pc.StandardMaterial();
    this.matGreenPCB.diffuse = new pc.Color(0.06, 0.42, 0.16);
    this.matGreenPCB.update();

    this.matEspBlack = new pc.StandardMaterial();
    this.matEspBlack.diffuse = new pc.Color(0.14, 0.14, 0.15);
    this.matEspBlack.update();

    this.matGoldPins = new pc.StandardMaterial();
    this.matGoldPins.diffuse = new pc.Color(0.88, 0.74, 0.28);
    this.matGoldPins.metalness = 0.9;
    this.matGoldPins.update();

    this.matOrange = new pc.StandardMaterial();
    this.matOrange.diffuse = new pc.Color(1.0, 0.40, 0.05);
    this.matOrange.update();

    this.matGlowBlue = new pc.StandardMaterial();
    this.matGlowBlue.diffuse = new pc.Color(0, 0.85, 1);
    this.matGlowBlue.emissive = new pc.Color(0, 0.8, 1);
    this.matGlowBlue.update();

    this.matRedLaser = new pc.StandardMaterial();
    this.matRedLaser.diffuse = new pc.Color(1, 0, 0);
    this.matRedLaser.emissive = new pc.Color(1, 0, 0);
    this.matRedLaser.update();

    this.matCaveBrown = new pc.StandardMaterial();
    this.matCaveBrown.diffuse = new pc.Color(0.46, 0.30, 0.16);
    this.matCaveBrown.roughness = 0.92;
    this.matCaveBrown.update();

    // --- 2. ENVIRONMENT & 300M SEAMLESS GROUND ---
    var defaultPlane = app.root.findByName('Plane');
    if (defaultPlane) defaultPlane.destroy();

    var groundBox = app.root.findByName('Box');
    if (groundBox) {
        groundBox.setLocalScale(300, 1, 300);
        groundBox.setLocalPosition(0, -0.5, 0);
        if (groundBox.render) groundBox.render.material = this.matGround;
    }

    app.scene.ambientLight = new pc.Color(0.48, 0.50, 0.46);

    var mainSun = new pc.Entity('SunLight');
    mainSun.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1.0, 0.98, 0.92),
        intensity: 2.2,
        castShadows: true
    });
    mainSun.setLocalEulerAngles(45, -35, 0);
    app.root.addChild(mainSun);

    this.buildHeavyGrassMeadow(app);
    this.buildLowEntranceCave(app);

    // --- 3. BUILD 1 HEAD + 13 BUS SERVO SNAKE ---
    this.segments = [];
    this.wheels = [];
    this.pathHistory = [];
    var startZ = -14;

    for (var h = 0; h < 2200; h++) {
        var pz = startZ - (h * 0.05);
        var px = Math.sin((pz + 14) * 0.24) * 0.85;
        this.pathHistory.push({ pos: new pc.Vec3(px, 0.45, pz) });
    }

    for (var i = 0; i < this.totalSegments; i++) {
        var seg = new pc.Entity('Segment_' + i);
        var initData = this.pathHistory[i * 26];
        seg.setPosition(initData.pos);

        if (i === 0) {
            // === HEAD MODULE ===
            var headBox = new pc.Entity('HeadSnout');
            headBox.addComponent('render', { type: 'box' });
            headBox.render.material = this.matBlackWheel;
            headBox.setLocalScale(0.52, 0.28, 1.05);
            headBox.setLocalPosition(0, 0.04, 0.10);
            seg.addChild(headBox);

            var orangeJaw = new pc.Entity('OrangeJaw');
            orangeJaw.addComponent('render', { type: 'box' });
            orangeJaw.render.material = this.matOrange;
            orangeJaw.setLocalScale(0.48, 0.08, 0.95);
            orangeJaw.setLocalPosition(0, -0.14, 0.15);
            seg.addChild(orangeJaw);

            var eyeL = new pc.Entity('EyeL');
            eyeL.addComponent('render', { type: 'sphere' });
            eyeL.render.material = this.matGlowBlue;
            eyeL.setLocalScale(0.12, 0.12, 0.12);
            eyeL.setLocalPosition(-0.23, 0.06, 0.45);
            seg.addChild(eyeL);

            var eyeR = new pc.Entity('EyeR');
            eyeR.addComponent('render', { type: 'sphere' });
            eyeR.render.material = this.matGlowBlue;
            eyeR.setLocalScale(0.12, 0.12, 0.12);
            eyeR.setLocalPosition(0.23, 0.06, 0.45);
            seg.addChild(eyeR);

            // === ESP32 ROTATED 90° HORIZONTALLY ON TOP ===
            var esp32Mount = new pc.Entity('ESP32_Mount');
            esp32Mount.setLocalPosition(0, 0.20, 0.12);
            esp32Mount.setLocalEulerAngles(0, 90, 0);
            seg.addChild(esp32Mount);

            var greenBoard = new pc.Entity('GreenCarrierBoard');
            greenBoard.addComponent('render', { type: 'box' });
            greenBoard.render.material = this.matGreenPCB;
            greenBoard.setLocalScale(0.48, 0.02, 0.52);
            esp32Mount.addChild(greenBoard);

            var espBoard = new pc.Entity('ESP32_PCB');
            espBoard.addComponent('render', { type: 'box' });
            espBoard.render.material = this.matEspBlack;
            espBoard.setLocalScale(0.36, 0.025, 0.48);
            espBoard.setLocalPosition(0, 0.02, 0);
            esp32Mount.addChild(espBoard);

            var rfShield = new pc.Entity('RF_Shield');
            rfShield.addComponent('render', { type: 'box' });
            rfShield.render.material = this.matSilver;
            rfShield.setLocalScale(0.24, 0.02, 0.22);
            rfShield.setLocalPosition(0, 0.04, -0.05);
            esp32Mount.addChild(rfShield);

            var wifiAntenna = new pc.Entity('WifiAntenna');
            wifiAntenna.addComponent('render', { type: 'box' });
            wifiAntenna.render.material = this.matEspBlack;
            wifiAntenna.setLocalScale(0.24, 0.015, 0.08);
            wifiAntenna.setLocalPosition(0, 0.035, -0.19);
            esp32Mount.addChild(wifiAntenna);

            var usbPort = new pc.Entity('USB_Port');
            usbPort.addComponent('render', { type: 'box' });
            usbPort.render.material = this.matSilver;
            usbPort.setLocalScale(0.10, 0.04, 0.08);
            usbPort.setLocalPosition(0, 0.045, 0.22);
            esp32Mount.addChild(usbPort);

            var pinHeaderL = new pc.Entity('Pins_L');
            pinHeaderL.addComponent('render', { type: 'box' });
            pinHeaderL.render.material = this.matGoldPins;
            pinHeaderL.setLocalScale(0.03, 0.035, 0.44);
            pinHeaderL.setLocalPosition(-0.16, 0.035, 0);
            esp32Mount.addChild(pinHeaderL);

            var pinHeaderR = new pc.Entity('Pins_R');
            pinHeaderR.addComponent('render', { type: 'box' });
            pinHeaderR.render.material = this.matGoldPins;
            pinHeaderR.setLocalScale(0.03, 0.035, 0.44);
            pinHeaderR.setLocalPosition(0.16, 0.035, 0);
            esp32Mount.addChild(pinHeaderR);

            var pwrLed = new pc.Entity('PowerLED');
            pwrLed.addComponent('render', { type: 'sphere' });
            pwrLed.render.material = this.matRedLaser;
            pwrLed.setLocalScale(0.025, 0.025, 0.025);
            pwrLed.setLocalPosition(-0.08, 0.045, 0.16);
            esp32Mount.addChild(pwrLed);

            // Red Laser Beam
            var laserBeam = new pc.Entity('LaserBeam');
            laserBeam.addComponent('render', { type: 'cylinder' });
            laserBeam.render.material = this.matRedLaser;
            laserBeam.setLocalScale(0.026, 18.0, 0.026);
            laserBeam.setLocalEulerAngles(90, 0, 0);
            laserBeam.setLocalPosition(0, 0.04, 9.8);
            seg.addChild(laserBeam);

            var redLaserLight = new pc.Entity('RedLaserLight');
            redLaserLight.addComponent('light', {
                type: 'spot',
                color: new pc.Color(1.0, 0.02, 0.02),
                range: 24,
                innerConeAngle: 12,
                outerConeAngle: 25,
                intensity: 7.5
            });
            redLaserLight.setLocalEulerAngles(0, 180, 0);
            redLaserLight.setLocalPosition(0, 0.04, 0.45);
            seg.addChild(redLaserLight);

        } else {
            // === 13 WAVESHARE ST3215 BUS SERVO SEGMENTS ===
            var wheel = new pc.Entity('FullCircularWheel');
            wheel.addComponent('render', { type: 'cylinder' });
            wheel.render.material = this.matBlackWheel;
            wheel.setLocalScale(0.76, 0.15, 0.76);
            wheel.setLocalEulerAngles(90, 0, 0);
            wheel.setLocalPosition(0, 0, 0.38);
            seg.addChild(wheel);
            this.wheels.push(wheel);

            var servoBlue = new pc.Entity('ServoBlue');
            servoBlue.addComponent('render', { type: 'box' });
            servoBlue.render.material = this.matServoBlue;
            servoBlue.setLocalScale(0.38, 0.32, 0.46);
            servoBlue.setLocalPosition(0, 0.04, -0.22);
            seg.addChild(servoBlue);

            var capTop = new pc.Entity('CapTop');
            capTop.addComponent('render', { type: 'box' });
            capTop.render.material = this.matBlackWheel;
            capTop.setLocalScale(0.38, 0.07, 0.46);
            capTop.setLocalPosition(0, 0.23, -0.22);
            seg.addChild(capTop);

            var capBottom = new pc.Entity('CapBottom');
            capBottom.addComponent('render', { type: 'box' });
            capBottom.render.material = this.matBlackWheel;
            capBottom.setLocalScale(0.38, 0.07, 0.46);
            capBottom.setLocalPosition(0, -0.15, -0.22);
            seg.addChild(capBottom);

            // Silver Flat Clamp Bar (Hardware Reference Match)
            var topClampBar = new pc.Entity('TopClampBar');
            topClampBar.addComponent('render', { type: 'box' });
            topClampBar.render.material = this.matSilver;
            topClampBar.setLocalScale(0.28, 0.03, 0.46);
            topClampBar.setLocalPosition(0, 0.27, 0.08);
            seg.addChild(topClampBar);

            var hornDisc = new pc.Entity('HornDisc');
            hornDisc.addComponent('render', { type: 'cylinder' });
            hornDisc.render.material = this.matSilver;
            hornDisc.setLocalScale(0.24, 0.04, 0.24);
            hornDisc.setLocalPosition(0, 0.29, -0.22);
            seg.addChild(hornDisc);

            var screwDot = new pc.Entity('ScrewDot');
            screwDot.addComponent('render', { type: 'cylinder' });
            screwDot.render.material = this.matScrew;
            screwDot.setLocalScale(0.08, 0.05, 0.08);
            screwDot.setLocalPosition(0, 0.31, -0.22);
            seg.addChild(screwDot);

            var vertBracket = new pc.Entity('VertBracket');
            vertBracket.addComponent('render', { type: 'box' });
            vertBracket.render.material = this.matSilver;
            vertBracket.setLocalScale(0.04, 0.36, 0.28);
            vertBracket.setLocalPosition(0.18, 0.04, 0.38);
            seg.addChild(vertBracket);
        }

        app.root.addChild(seg);
        this.segments.push(seg);
    }

    this.camera = app.root.findByName('Camera');
};

SnakeRobot.prototype.buildHeavyGrassMeadow = function(app) {
    this.grassStems = [];
    var grassGroup = new pc.Entity('HeavyGrassMeadow');
    app.root.addChild(grassGroup);

    for (var g = 0; g < 380; g++) {
        var gx = rnd(-18, 18);
        var gz = rnd(-26, -0.5);

        if (Math.abs(gx) < 1.8) continue;

        var stemPivot = new pc.Entity('GrassStem_' + g);
        stemPivot.setPosition(gx, 0.0, gz);

        var stemBlade = new pc.Entity('Blade');
        stemBlade.addComponent('render', { type: 'box' });
        stemBlade.render.material = (g % 2 === 0) ? this.matGrass1 : this.matGrass2;
        var stemHeight = rnd(0.55, 1.15);
        stemBlade.setLocalScale(0.07, stemHeight, 0.07);
        stemBlade.setLocalPosition(0, stemHeight * 0.5, 0);

        stemPivot.addChild(stemBlade);
        grassGroup.addChild(stemPivot);

        this.grassStems.push({
            entity: stemPivot,
            phase: rnd(0, Math.PI * 2),
            speed: rnd(1.6, 2.4),
            swayAngle: rnd(14, 22)
        });
    }
};

SnakeRobot.prototype.buildLowEntranceCave = function(app) {
    var cave = new pc.Entity('LowEntranceCave');
    app.root.addChild(cave);

    var darkBrownFloor = new pc.Entity('DarkBrownFloor');
    darkBrownFloor.addComponent('render', { type: 'box' });
    darkBrownFloor.render.material = this.matDarkBrown;
    darkBrownFloor.setPosition(0, -0.47, 24);
    darkBrownFloor.setLocalScale(18, 0.92, 50);
    cave.addChild(darkBrownFloor);

    var tunnelRadius = 3.6;

    for (var z = 2.0; z < 50; z += 2.0) {
        for (var a = 0; a < 16; a++) {
            var ang = (a / 16) * Math.PI * 2;
            var rx = Math.cos(ang) * tunnelRadius;
            var ry = Math.sin(ang) * tunnelRadius + 2.2;
            if (ry < 0.2) continue;

            var rock = new pc.Entity('CaveRock_' + z + '_' + a);
            rock.addComponent('render', { type: 'box' });
            rock.render.material = this.matCaveBrown;
            rock.setPosition(rx, ry, z);
            rock.setLocalScale(2.6, 2.6, 3.0);
            rock.setLocalEulerAngles(rnd(-10, 10), rnd(-10, 10), rnd(0, 360));
            cave.addChild(rock);
        }
    }

    for (var oz = 2.0; oz < 50; oz += 4.0) {
        for (var oa = 0; oa < 8; oa++) {
            var oang = (oa / 8) * Math.PI * 2;
            var orx = Math.cos(oang) * (tunnelRadius + 1.8);
            var ory = Math.sin(oang) * (tunnelRadius + 1.8) + 2.2;
            if (ory < 0.2) continue;

            var outerShield = new pc.Entity('OuterShield_' + oz + '_' + oa);
            outerShield.addComponent('render', { type: 'box' });
            outerShield.render.material = this.matCaveBrown;
            outerShield.setPosition(orx, ory, oz);
            outerShield.setLocalScale(3.5, 3.5, 4.5);
            cave.addChild(outerShield);
        }
    }

    for (var ex = -10; ex <= 10; ex += 2.0) {
        for (var ey = 0.5; ey <= 8.5; ey += 2.0) {
            if (Math.abs(ex) < 2.3 && ey < 2.4) continue;

            var cliff = new pc.Entity('Cliff_' + ex + '_' + ey);
            cliff.addComponent('render', { type: 'box' });
            cliff.render.material = this.matCaveBrown;
            cliff.setPosition(ex, ey, 2.2);
            cliff.setLocalScale(2.6, 2.6, 2.6);
            cave.addChild(cliff);
        }
    }

    var lintel = new pc.Entity('LowArchLintel');
    lintel.addComponent('render', { type: 'box' });
    lintel.render.material = this.matCaveBrown;
    lintel.setPosition(0, 2.7, 2.1);
    lintel.setLocalScale(5.2, 1.2, 2.8);
    cave.addChild(lintel);

    for (var bx = -9; bx <= 9; bx += 2.2) {
        for (var by = 0.5; by <= 7.5; by += 2.2) {
            var backRock = new pc.Entity('BackWall_' + bx + '_' + by);
            backRock.addComponent('render', { type: 'box' });
            backRock.render.material = this.matCaveBrown;
            backRock.setPosition(bx, by, 49.0);
            backRock.setLocalScale(3.0, 3.0, 2.2);
            cave.addChild(backRock);
        }
    }
};

SnakeRobot.prototype.update = function(dt) {
    this.time += dt;

    if (this.grassStems) {
        for (var g = 0; g < this.grassStems.length; g++) {
            var stem = this.grassStems[g];
            var sway = Math.sin((this.time * stem.speed) + stem.phase) * stem.swayAngle;
            stem.entity.setLocalEulerAngles(0, 0, sway);
        }
    }

    if (this.wheels) {
        var rollSpeed = this.snakeSpeed * dt * 90;
        for (var w = 0; w < this.wheels.length; w++) {
            this.wheels[w].rotateLocal(0, rollSpeed, 0);
        }
    }

    var head = this.segments[0];
    var pos = head.getPosition();

    var newZ = pos.z + (this.snakeSpeed * dt);
    if (newZ > 45) newZ = -16;

    var waveX = Math.sin(this.time * 1.6) * 0.70;
    var waveY = 0.45 + Math.max(0, Math.sin(this.time * 1.6 + 1.2) * 0.12);

    head.setPosition(waveX, waveY, newZ);

    this.pathHistory.unshift({ pos: new pc.Vec3(waveX, waveY, newZ) });
    if (this.pathHistory.length > 2200) this.pathHistory.pop();

    var stepGap = 26;
    for (var i = 1; i < this.segments.length; i++) {
        var idx = i * stepGap;
        if (idx < this.pathHistory.length) {
            this.segments[i].setPosition(this.pathHistory[idx].pos);
            this.segments[i].lookAt(this.segments[i - 1].getPosition());
        }
    }

    head.setEulerAngles(
        Math.cos(this.time * 1.6) * 8,
        Math.cos(this.time * 1.6) * 35,
        0
    );

    if (this.camera) {
        var headP = head.getPosition();
        var targetCam = new pc.Vec3(headP.x - 2.4, headP.y + 2.2, headP.z - 4.4);
        var camPos = this.camera.getPosition();
        camPos.lerp(camPos, targetCam, 3.5 * dt);
        this.camera.setPosition(camPos);
        this.camera.lookAt(new pc.Vec3(headP.x + 0.3, headP.y + 0.4, headP.z + 3.2));
    }
};
