import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Import Custom Simulation Modules
import {
  galaxyParameters,
  generateGalaxy,
  updateGalaxy,
  cleanupGalaxy
} from './galaxy.js';

import {
  bhParameters,
  generateBlackHole,
  updateBlackHole,
  cleanupBlackHole
} from './blackhole.js';

import {
  binaryParameters,
  generateBinary,
  updateBinary,
  cleanupBinary,
  triggerCollision,
  getBinaryState,
  getBinDist,
  getCollisionTime,
  getRemnantMass
} from './binarystar.js';

// --- RUNTIME PARAMETER STATES ---
let currentMode = 'galaxy'; // 'galaxy' | 'blackhole' | 'binarystar'

const currentGalaxyParams = { ...galaxyParameters };
const currentBhParams = { ...bhParameters };
const currentBinaryParams = { ...binaryParameters };

// Three.js Core States
let scene, camera, renderer, controls;
let starTexture = null;
const clock = new THREE.Clock();
let lastTime = 0;

// --- DOM ELEMENTS ---
const uiElements = {
  loader: document.getElementById('loader'),
  progressBar: document.querySelector('.loader-progress'),
  
  // Navigation Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  galaxyControls: document.getElementById('galaxy-controls'),
  blackholeControls: document.getElementById('blackhole-controls'),
  binaryControls: document.getElementById('binary-controls'),
  galaxyTelemetry: document.getElementById('galaxy-telemetry'),
  blackholeTelemetry: document.getElementById('blackhole-telemetry'),
  binaryTelemetry: document.getElementById('binary-telemetry'),
  
  // Inputs - Galaxy
  paramCount: document.getElementById('param-count'),
  paramArms: document.getElementById('param-arms'),
  paramSpin: document.getElementById('param-spin'),
  paramRadius: document.getElementById('param-radius'),
  paramRandom: document.getElementById('param-random'),
  paramSpeed: document.getElementById('param-speed'),
  paramCore: document.getElementById('param-core'),
  paramCoreColor: document.getElementById('param-core-color'),
  paramOuterColor: document.getElementById('param-outer-color'),
  
  // Inputs - Black Hole
  paramBhMass: document.getElementById('param-bh-mass'),
  paramBhCount: document.getElementById('param-bh-count'),
  paramBhRadius: document.getElementById('param-bh-radius'),
  paramBhWarp: document.getElementById('param-bh-warp'),
  paramBhSpeed: document.getElementById('param-bh-speed'),
  paramBhColor: document.getElementById('param-bh-color'),
  paramBhOuterColor: document.getElementById('param-bh-outer-color'),

  // Inputs - Binary Star
  paramBinM1: document.getElementById('param-bin-m1'),
  paramBinM2: document.getElementById('param-bin-m2'),
  paramBinDist: document.getElementById('param-bin-dist'),
  paramBinDecay: document.getElementById('param-bin-decay'),
  paramBinSpeed: document.getElementById('param-bin-speed'),
  btnBinCollision: document.getElementById('btn-bin-collision'),
  btnBinReset: document.getElementById('btn-bin-reset'),
  
  btnReset: document.getElementById('btn-reset'),
  btnToggleHud: document.getElementById('btn-toggle-hud'),
  textToggleHud: document.getElementById('text-toggle-hud'),
  
  // Values labels - Galaxy
  valCount: document.getElementById('val-count'),
  valArms: document.getElementById('val-arms'),
  valSpin: document.getElementById('val-spin'),
  valRadius: document.getElementById('val-radius'),
  valRandom: document.getElementById('val-random'),
  valSpeed: document.getElementById('val-speed'),
  valCore: document.getElementById('val-core'),

  // Values labels - Black Hole
  valBhMass: document.getElementById('val-bh-mass'),
  valBhCount: document.getElementById('val-bh-count'),
  valBhRadius: document.getElementById('val-bh-radius'),
  valBhWarp: document.getElementById('val-bh-warp'),
  valBhSpeed: document.getElementById('val-bh-speed'),

  // Values labels - Binary Star
  valBinM1: document.getElementById('val-bin-m1'),
  valBinM2: document.getElementById('val-bin-m2'),
  valBinDist: document.getElementById('val-bin-dist'),
  valBinDecay: document.getElementById('val-bin-decay'),
  valBinSpeed: document.getElementById('val-bin-speed'),
  
  // Telemetry labels - Galaxy
  telemetryDiameter: document.getElementById('telemetry-diameter'),
  telemetryVelocity: document.getElementById('telemetry-velocity'),

  // Telemetry labels - Black Hole
  telemetryBhMass: document.getElementById('telemetry-bh-mass'),
  telemetryBhSchRad: document.getElementById('telemetry-bh-sch-rad'),
  telemetryBhIscoVel: document.getElementById('telemetry-bh-isco-vel'),

  // Telemetry labels - Binary Star
  telemetryBinState: document.getElementById('telemetry-bin-state'),
  telemetryBinDistance: document.getElementById('telemetry-bin-distance'),
  telemetryBinPeriod: document.getElementById('telemetry-bin-period'),
  telemetryBinGw: document.getElementById('telemetry-bin-gw')
};

// --- INITIALIZATION ---
function init() {
  // 1. Scene setup
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#030308', 0.015);

  // 2. Camera setup
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 15, 20);
  scene.add(camera);

  // 3. Renderer setup
  const canvas = document.querySelector('canvas#webgl');
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color('#030308'));

  // 4. Controls setup
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 60;
  controls.minDistance = 2;

  // 5. Cache Star Texture once globally
  starTexture = createStarTexture();

  // 6. Generate Initial simulation (default: galaxy)
  renderSimulationMode();

  // 7. Setup Event Listeners & UI
  setupUI();
  window.addEventListener('resize', onWindowResize);

  // 8. Hide Loader after page renders
  setTimeout(() => {
    if (uiElements.loader) {
      uiElements.progressBar.style.width = '100%';
      setTimeout(() => {
        uiElements.loader.style.opacity = '0';
        setTimeout(() => {
          uiElements.loader.style.display = 'none';
        }, 800);
      }, 300);
    }
  }, 500);

  // 9. Reset lastTime before starting animation loop to avoid huge first-frame delta
  lastTime = clock.getElapsedTime();

  // 10. Start Animation loop
  animate();
}

// --- CREATING STAR TEXTURE ---
function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 16);

  return new THREE.CanvasTexture(canvas);
}

// --- CLEANUP THREE.JS SIMULATION ---
function cleanupSimulation() {
  cleanupGalaxy(scene);
  cleanupBlackHole(scene);
  cleanupBinary(scene);
}

// --- SIMULATION MODE CONTROLLER ---
function renderSimulationMode() {
  cleanupSimulation();
  
  if (currentMode === 'galaxy') {
    generateGalaxy(scene, currentGalaxyParams, starTexture);
  } else if (currentMode === 'blackhole') {
    generateBlackHole(scene, currentBhParams, starTexture);
  } else if (currentMode === 'binarystar') {
    generateBinary(scene, camera, controls, currentBinaryParams, starTexture);
  }
}

// --- RESIZE HANDLER ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- UI SETUP & EVENT BINDING ---
function setupUI() {
  // Navigation Tabs logic
  uiElements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      uiElements.navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetMode = tab.getAttribute('data-mode');
      if (targetMode === currentMode) return;
      
      currentMode = targetMode;
      
      // Update UI panels visibility
      if (currentMode === 'galaxy') {
        uiElements.galaxyControls.classList.remove('hidden');
        uiElements.blackholeControls.classList.add('hidden');
        uiElements.binaryControls.classList.add('hidden');
        uiElements.galaxyTelemetry.classList.remove('hidden');
        uiElements.blackholeTelemetry.classList.add('hidden');
        uiElements.binaryTelemetry.classList.add('hidden');
        
        // Reset camera look/tilt
        camera.position.set(0, 15, 20);
        controls.target.set(0, 0, 0);
      } else if (currentMode === 'blackhole') {
        uiElements.galaxyControls.classList.add('hidden');
        uiElements.blackholeControls.classList.remove('hidden');
        uiElements.binaryControls.classList.add('hidden');
        uiElements.galaxyTelemetry.classList.add('hidden');
        uiElements.blackholeTelemetry.classList.remove('hidden');
        uiElements.binaryTelemetry.classList.add('hidden');
        
        // Tilt camera slightly to look ACCRETION DISK lensing beauty
        camera.position.set(0, 4, 18);
        controls.target.set(0, 0, 0);
      } else if (currentMode === 'binarystar') {
        uiElements.galaxyControls.classList.add('hidden');
        uiElements.blackholeControls.classList.add('hidden');
        uiElements.binaryControls.classList.remove('hidden');
        uiElements.galaxyTelemetry.classList.add('hidden');
        uiElements.blackholeTelemetry.classList.add('hidden');
        uiElements.binaryTelemetry.classList.remove('hidden');
        
        camera.position.set(0, 10, 16);
        controls.target.set(0, 0, 0);
      }
      
      renderSimulationMode();
    });
  });

  // GALAXY: Helper function to bind values & update models
  const updateGalaxyParam = (key, inputEl, valEl, formatFn = val => val) => {
    inputEl.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      currentGalaxyParams[key] = val;
      if (valEl) valEl.textContent = formatFn(val);
      
      if (key !== 'speed') {
        if (currentMode === 'galaxy') generateGalaxy(scene, currentGalaxyParams, starTexture);
      }
      updateTelemetry();
    });
  };

  // Bind Galaxy controls
  updateGalaxyParam('count', uiElements.paramCount, uiElements.valCount, val => val.toLocaleString());
  updateGalaxyParam('arms', uiElements.paramArms, uiElements.valArms);
  updateGalaxyParam('spin', uiElements.paramSpin, uiElements.valSpin, val => val.toFixed(1));
  updateGalaxyParam('radius', uiElements.paramRadius, uiElements.valRadius, val => `${val}k`);
  updateGalaxyParam('randomness', uiElements.paramRandom, uiElements.valRandom, val => val.toFixed(2));
  updateGalaxyParam('speed', uiElements.paramSpeed, uiElements.valSpeed, val => val.toFixed(2));
  updateGalaxyParam('coreDensity', uiElements.paramCore, uiElements.valCore, val => val.toFixed(1));

  uiElements.paramCoreColor.addEventListener('input', (e) => {
    currentGalaxyParams.coreColor = e.target.value;
    if (currentMode === 'galaxy') generateGalaxy(scene, currentGalaxyParams, starTexture);
  });

  uiElements.paramOuterColor.addEventListener('input', (e) => {
    currentGalaxyParams.outerColor = e.target.value;
    if (currentMode === 'galaxy') generateGalaxy(scene, currentGalaxyParams, starTexture);
  });

  // BLACK HOLE: Helper function to bind values & update models
  const updateBhParam = (key, inputEl, valEl, formatFn = val => val) => {
    inputEl.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      currentBhParams[key] = val;
      if (valEl) valEl.textContent = formatFn(val);
      
      if (key !== 'speed') {
        if (currentMode === 'blackhole') generateBlackHole(scene, currentBhParams, starTexture);
      }
      updateTelemetry();
    });
  };

  // Bind Black Hole controls
  updateBhParam('mass', uiElements.paramBhMass, uiElements.valBhMass, val => `${val.toFixed(1)} M`);
  updateBhParam('count', uiElements.paramBhCount, uiElements.valBhCount, val => val.toLocaleString());
  updateBhParam('radius', uiElements.paramBhRadius, uiElements.valBhRadius, val => val.toFixed(1));
  updateBhParam('warp', uiElements.paramBhWarp, uiElements.valBhWarp, val => val.toFixed(2));
  updateBhParam('speed', uiElements.paramBhSpeed, uiElements.valBhSpeed, val => val.toFixed(2));

  uiElements.paramBhColor.addEventListener('input', (e) => {
    currentBhParams.color = e.target.value;
    if (currentMode === 'blackhole') generateBlackHole(scene, currentBhParams, starTexture);
  });

  uiElements.paramBhOuterColor.addEventListener('input', (e) => {
    currentBhParams.outerColor = e.target.value;
    if (currentMode === 'blackhole') generateBlackHole(scene, currentBhParams, starTexture);
  });

  // BINARY STAR: Helper function to bind values & update models
  const updateBinParam = (key, inputEl, valEl, formatFn = val => val) => {
    inputEl.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      currentBinaryParams[key] = val;
      if (valEl) valEl.textContent = formatFn(val);
      
      if (key === 'distance' && getBinaryState() === 'orbiting') {
        generateBinary(scene, camera, controls, currentBinaryParams, starTexture);
      }
      updateTelemetry();
    });
  };

  // Bind Binary Star controls
  updateBinParam('m1', uiElements.paramBinM1, uiElements.valBinM1, val => `${val.toFixed(1)} M☉`);
  updateBinParam('m2', uiElements.paramBinM2, uiElements.valBinM2, val => `${val.toFixed(1)} M☉`);
  updateBinParam('distance', uiElements.paramBinDist, uiElements.valBinDist, val => val.toFixed(1));
  updateBinParam('decay', uiElements.paramBinDecay, uiElements.valBinDecay, val => val.toFixed(2));
  updateBinParam('speed', uiElements.paramBinSpeed, uiElements.valBinSpeed, val => val.toFixed(2));

  uiElements.btnBinCollision.addEventListener('click', () => {
    if (currentMode === 'binarystar' && getBinaryState() === 'orbiting') {
      triggerCollision(currentBinaryParams, starTexture);
    }
  });

  uiElements.btnBinReset.addEventListener('click', () => {
    if (currentMode === 'binarystar') {
      generateBinary(scene, camera, controls, currentBinaryParams, starTexture);
    }
  });

  // Global Reset Button
  uiElements.btnReset.addEventListener('click', () => {
    if (currentMode === 'galaxy') {
      // Reset galaxy params
      Object.assign(currentGalaxyParams, galaxyParameters);
      uiElements.paramCount.value = galaxyParameters.count;
      uiElements.paramArms.value = galaxyParameters.arms;
      uiElements.paramSpin.value = galaxyParameters.spin;
      uiElements.paramRadius.value = galaxyParameters.radius;
      uiElements.paramRandom.value = galaxyParameters.randomness;
      uiElements.paramSpeed.value = galaxyParameters.speed;
      uiElements.paramCore.value = galaxyParameters.coreDensity;
      uiElements.paramCoreColor.value = galaxyParameters.coreColor;
      uiElements.paramOuterColor.value = galaxyParameters.outerColor;

      uiElements.valCount.textContent = galaxyParameters.count.toLocaleString();
      uiElements.valArms.textContent = galaxyParameters.arms.toString();
      uiElements.valSpin.textContent = galaxyParameters.spin.toFixed(1);
      uiElements.valRadius.textContent = `${galaxyParameters.radius}k`;
      uiElements.valRandom.textContent = galaxyParameters.randomness.toFixed(2);
      uiElements.valSpeed.textContent = galaxyParameters.speed.toFixed(2);
      uiElements.valCore.textContent = galaxyParameters.coreDensity.toFixed(1);

      generateGalaxy(scene, currentGalaxyParams, starTexture);
    } else if (currentMode === 'blackhole') {
      // Reset blackhole params
      Object.assign(currentBhParams, bhParameters);
      uiElements.paramBhMass.value = bhParameters.mass;
      uiElements.paramBhCount.value = bhParameters.count;
      uiElements.paramBhRadius.value = bhParameters.radius;
      uiElements.paramBhWarp.value = bhParameters.warp;
      uiElements.paramBhSpeed.value = bhParameters.speed;
      uiElements.paramBhColor.value = bhParameters.color;
      uiElements.paramBhOuterColor.value = bhParameters.outerColor;

      uiElements.valBhMass.textContent = `${bhParameters.mass.toFixed(1)} M`;
      uiElements.valBhCount.textContent = bhParameters.count.toLocaleString();
      uiElements.valBhRadius.textContent = bhParameters.radius.toFixed(1);
      uiElements.valBhWarp.textContent = bhParameters.warp.toFixed(2);
      uiElements.valBhSpeed.textContent = bhParameters.speed.toFixed(2);

      generateBlackHole(scene, currentBhParams, starTexture);
    } else if (currentMode === 'binarystar') {
      // Reset binary parameters
      Object.assign(currentBinaryParams, binaryParameters);
      uiElements.paramBinM1.value = binaryParameters.m1;
      uiElements.paramBinM2.value = binaryParameters.m2;
      uiElements.paramBinDist.value = binaryParameters.distance;
      uiElements.paramBinDecay.value = binaryParameters.decay;
      uiElements.paramBinSpeed.value = binaryParameters.speed;

      uiElements.valBinM1.textContent = `${binaryParameters.m1.toFixed(1)} M☉`;
      uiElements.valBinM2.textContent = `${binaryParameters.m2.toFixed(1)} M☉`;
      uiElements.valBinDist.textContent = binaryParameters.distance.toFixed(1);
      uiElements.valBinDecay.textContent = binaryParameters.decay.toFixed(2);
      uiElements.valBinSpeed.textContent = binaryParameters.speed.toFixed(2);

      generateBinary(scene, camera, controls, currentBinaryParams, starTexture);
    }
    updateTelemetry();
  });
  // Toggle HUD Event Listener
  if (uiElements.btnToggleHud) {
    uiElements.btnToggleHud.addEventListener('click', () => {
      const hud = document.getElementById('app-hud');
      if (hud) {
        const isCollapsed = hud.classList.toggle('collapsed');
        if (uiElements.textToggleHud) {
          uiElements.textToggleHud.textContent = isCollapsed ? 'แสดงแผงควบคุม' : 'ซ่อนแผงควบคุม';
        }
      }
    });
  }

  // Check screen width on startup to collapse UI on smaller devices automatically
  if (window.innerWidth < 1024) {
    const hud = document.getElementById('app-hud');
    if (hud) {
      hud.classList.add('collapsed');
      if (uiElements.textToggleHud) {
        uiElements.textToggleHud.textContent = 'แสดงแผงควบคุม';
      }
    }
  }

  updateTelemetry();
}

// --- UPDATE TELEMETRY INFO ---
function updateTelemetry(timeParam) {
  const time = timeParam !== undefined ? timeParam : clock.getElapsedTime();
  
  if (currentMode === 'galaxy') {
    const diameter = Math.round(currentGalaxyParams.radius * 2 * 6666);
    uiElements.telemetryDiameter.textContent = `${diameter.toLocaleString()} ly`;
    const velocity = Math.round(220 * Math.abs(currentGalaxyParams.speed));
    uiElements.telemetryVelocity.textContent = `${velocity} km/s`;
  } else if (currentMode === 'blackhole') {
    // Black Hole calculations
    const bhMassValue = currentBhParams.mass * 1.025; // Scale relative to Sagittarius A* (4.1 million solar masses)
    uiElements.telemetryBhMass.textContent = `${bhMassValue.toFixed(1)} Million`;
    
    // Schwarzschild radius calculation (R_s = 2GM/c^2)
    const schRad = bhMassValue * 2.95;
    uiElements.telemetryBhSchRad.textContent = `${schRad.toFixed(1)} Million km`;
    
    // Calculate ISCO orbital velocity based on rotation speed parameter
    const iscoVelocity = Math.round(148000 * Math.abs(currentBhParams.speed));
    uiElements.telemetryBhIscoVel.textContent = `~${iscoVelocity.toLocaleString()} km/s`;
  } else if (currentMode === 'binarystar') {
    const binState = getBinaryState();
    const binDist = getBinDist();
    const collisionTime = getCollisionTime();
    const remnantMassValue = getRemnantMass();
    
    // Update State label text and color dynamically
    uiElements.telemetryBinState.textContent = binState.toUpperCase();
    if (binState === 'orbiting') {
      uiElements.telemetryBinState.style.color = '#00ffaa';
      uiElements.telemetryBinDistance.textContent = `${(binDist * 100).toFixed(0)} km`;
    } else if (binState === 'collision') {
      uiElements.telemetryBinState.style.color = '#ffaa00';
      uiElements.telemetryBinDistance.textContent = '0 km (Colliding)';
    } else {
      uiElements.telemetryBinState.style.color = '#aa3bff';
      uiElements.telemetryBinDistance.textContent = '0.00 km (Merged)';
    }
    
    const mSum = currentBinaryParams.m1 + currentBinaryParams.m2;
    const periodVal = binState === 'remnant' ? 0.0 : Math.sqrt(Math.pow(binDist, 3) / mSum) * 1.5;
    uiElements.telemetryBinPeriod.textContent = binState === 'remnant' ? 'N/A' : `${(periodVal * 4.5).toFixed(1)} ms`;
    
    const gwPower = binState === 'remnant' ? 0.0 : (currentBinaryParams.m1 * currentBinaryParams.m2) / (binDist * 0.85);
    uiElements.telemetryBinGw.textContent = binState === 'remnant' ? '0.00' : `${(gwPower * 1.12).toFixed(2)} × 10⁻²¹`;
    
    // If remnant, show merged black hole mass conservation info in BH telemetry format
    if (binState === 'remnant') {
      uiElements.telemetryBinDistance.innerHTML = `0.00 km <span style="font-size:0.75rem; color:#ff3b00; display:block; margin-top:3px;">BH Mass: ${remnantMassValue.toFixed(2)} M☉ (-6% Loss)</span>`;
    }

    // Update HTML layout Chirp Signal bars height
    const bars = document.querySelectorAll('.gw-bar');
    const gwFreq = binState === 'orbiting' ? (15.0 / binDist) : 0.0;
    const waveAmp = binState === 'orbiting' ? Math.min(1.0, gwPower * 0.15) : 0.0;
    
    bars.forEach((bar, idx) => {
      if (binState === 'orbiting') {
        const offset = idx * 0.35;
        const heightVal = Math.sin(time * gwFreq - offset) * waveAmp * 95;
        bar.style.height = `${Math.max(5, Math.abs(heightVal))}%`;
      } else if (binState === 'collision') {
        const explPulse = Math.max(5, (1.0 - (collisionTime / 2.2)) * 95 * (0.8 + Math.random() * 0.2));
        bar.style.height = `${explPulse}%`;
      } else {
        bar.style.height = '5%';
      }
    });
  }
}

// --- ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  controls.update();

  const time = clock.getElapsedTime();
  const dt = time - lastTime;
  lastTime = time;

  if (currentMode === 'galaxy') {
    updateGalaxy(time, currentGalaxyParams);
  } else if (currentMode === 'blackhole') {
    updateBlackHole(time, camera, currentBhParams);
  } else if (currentMode === 'binarystar') {
    updateBinary(dt, time, camera, controls, currentBinaryParams, starTexture);
    // Update telemetry frequently for waves animation
    updateTelemetry(time);
  }

  renderer.render(scene, camera);
}

// Start simulation on load
window.onload = init;
