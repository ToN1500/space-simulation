import * as THREE from 'three';

// 3. Binary Star Initial Parameters
export const binaryParameters = {
  m1: 1.5, // Mass of Star 1 (solar masses)
  m2: 1.5, // Mass of Star 2 (solar masses)
  distance: 10.0, // Initial distance
  decay: 0.30, // Orbital decay rate
  speed: 1.00 // Simulation speed factor
};

// Module Internal State variables
let binaryGroup = null;
let star1 = null;
let star2 = null;
let star1Glow = null;
let star2Glow = null;

let gwGeometry = null;
let gwMaterial = null;
let gwPoints = null;
let gwParticles = [];
const maxGwParticles = 1000;

// Kilonova and Realistic Collision Meshes
let kilonovaShell = null; // Expanding isotropic shell mesh (semi-translucent)
let shockwaveRing = null; // Flattened orbital plane shockwave (XZ Plane)
let relativisticJets = null; // Double-sided cone jets (Y Polar Axis)

// Ejecta particle system (Realistic r-process debris)
let ejectaGeometry = null;
let ejectaMaterial = null;
let ejectaPoints = null;
let ejectaParticles = [];
const ejectaCount = 4000; // Increased count for thicker, more realistic debris cloud

// Remnant Black Hole meshes
let eventHorizon = null;
let einsteinRing = null;
let remnantDisk = null; // Small accretion disk leftover

// Spacetime Grid & Explosion Flash States
let spacetimeGrid = null;
let gridGeometry = null;
let mergerFlash = null;

// State logic
export let binaryState = 'orbiting'; // 'orbiting' | 'collision' | 'remnant'
export let currentBinDist = 10.0;
export let binaryAngle = 0;
export let collisionTime = 0;
export let remnantMass = 0; // Final mass of the merged black hole (reduced by E=mc^2 and ejecta)

// Cleanup function to avoid memory leaks when swapping simulation modes
export function cleanupBinary(scene) {
  if (binaryGroup) {
    scene.remove(binaryGroup);
    
    // Dispose Orbiting elements
    if (star1) {
      star1.geometry.dispose();
      star1.material.dispose();
      star1 = null;
    }
    if (star2) {
      star2.geometry.dispose();
      star2.material.dispose();
      star2 = null;
    }
    if (star1Glow) {
      star1Glow.geometry.dispose();
      star1Glow.material.dispose();
      star1Glow = null;
    }
    if (star2Glow) {
      star2Glow.geometry.dispose();
      star2Glow.material.dispose();
      star2Glow = null;
    }

    // Dispose Collision elements
    if (kilonovaShell) {
      kilonovaShell.geometry.dispose();
      kilonovaShell.material.dispose();
      kilonovaShell = null;
    }
    if (shockwaveRing) {
      shockwaveRing.geometry.dispose();
      shockwaveRing.material.dispose();
      shockwaveRing = null;
    }
    if (relativisticJets) {
      relativisticJets.geometry.dispose();
      relativisticJets.material.dispose();
      relativisticJets = null;
    }
    if (mergerFlash) {
      mergerFlash.geometry.dispose();
      mergerFlash.material.dispose();
      mergerFlash = null;
    }

    // Dispose Spacetime Grid
    if (spacetimeGrid) {
      binaryGroup.remove(spacetimeGrid);
      gridGeometry.dispose();
      spacetimeGrid.material.dispose();
      spacetimeGrid = null;
      gridGeometry = null;
    }

    // Dispose Ejecta points
    if (ejectaPoints) {
      binaryGroup.remove(ejectaPoints);
      ejectaGeometry.dispose();
      ejectaMaterial.dispose();
      ejectaPoints = null;
      ejectaGeometry = null;
      ejectaMaterial = null;
    }

    // Dispose Remnant Black Hole
    if (eventHorizon) {
      eventHorizon.geometry.dispose();
      eventHorizon.material.dispose();
      eventHorizon = null;
    }
    if (einsteinRing) {
      einsteinRing.geometry.dispose();
      einsteinRing.material.dispose();
      einsteinRing = null;
    }
    if (remnantDisk) {
      remnantDisk.geometry.dispose();
      remnantDisk.material.dispose();
      remnantDisk = null;
    }
    
    binaryGroup = null;
  }

  // Dispose GW points
  if (gwPoints) {
    scene.remove(gwPoints);
    gwGeometry.dispose();
    gwMaterial.dispose();
    gwPoints = null;
    gwGeometry = null;
    gwMaterial = null;
  }
  
  gwParticles = [];
  ejectaParticles = [];
  binaryState = 'orbiting';
  binaryAngle = 0;
  collisionTime = 0;
}

// Generate the binary system assets
export function generateBinary(scene, camera, controls, currentParams, starTexture) {
  cleanupBinary(scene);
  
  binaryGroup = new THREE.Group();
  scene.add(binaryGroup);
  
  // 1. Create Neutron Stars (very dense, cyan and purple glowing cores)
  const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
  
  // Star 1 (Pulsating Cyan core)
  const star1Mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  star1 = new THREE.Mesh(sphereGeo, star1Mat);
  binaryGroup.add(star1);
  
  const glowGeo1 = new THREE.SphereGeometry(1.3, 32, 32);
  const glow1Mat = new THREE.MeshBasicMaterial({
    color: '#00ccff',
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });
  star1Glow = new THREE.Mesh(glowGeo1, glow1Mat);
  star1.add(star1Glow);
  
  // Star 2 (Pulsating Magenta core)
  const star2Mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  star2 = new THREE.Mesh(sphereGeo, star2Mat);
  binaryGroup.add(star2);
  
  const glowGeo2 = new THREE.SphereGeometry(1.3, 32, 32);
  const glow2Mat = new THREE.MeshBasicMaterial({
    color: '#aa3bff',
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });
  star2Glow = new THREE.Mesh(glowGeo2, glow2Mat);
  star2.add(star2Glow);
  
  // 2. Gravitational Wave (GW) Particles
  gwGeometry = new THREE.BufferGeometry();
  const gwPosArray = new Float32Array(maxGwParticles * 3);
  const gwColArray = new Float32Array(maxGwParticles * 3);
  
  gwGeometry.setAttribute('position', new THREE.BufferAttribute(gwPosArray, 3));
  gwGeometry.setAttribute('color', new THREE.BufferAttribute(gwColArray, 3));
  
  gwMaterial = new THREE.PointsMaterial({
    size: 0.16,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    map: starTexture,
    opacity: 0.85
  });
  
  gwPoints = new THREE.Points(gwGeometry, gwMaterial);
  scene.add(gwPoints);
  
  // Reset simulation runtime states
  binaryState = 'orbiting';
  binaryAngle = 0;
  currentBinDist = currentParams.distance;
  gwParticles = [];
  ejectaParticles = [];
  collisionTime = 0;
  remnantMass = currentParams.m1 + currentParams.m2; // Initial sum of masses
  
  kilonovaShell = null;
  shockwaveRing = null;
  relativisticJets = null;
  eventHorizon = null;
  einsteinRing = null;
  remnantDisk = null;
  mergerFlash = null;

  // 4. Create Spacetime Grid
  const gridSide = 48;
  const gridSegments = 64;
  gridGeometry = new THREE.PlaneGeometry(gridSide, gridSide, gridSegments, gridSegments);
  
  // Material for the grid - glowing space-time web in neon blue/cyan
  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x0055ff,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  spacetimeGrid = new THREE.Mesh(gridGeometry, gridMat);
  spacetimeGrid.rotation.x = -Math.PI / 2; // Lie flat on XZ plane
  spacetimeGrid.position.y = -0.15; // Set slightly below the orbital plane to prevent z-fighting
  binaryGroup.add(spacetimeGrid);
  
  // Camera placement
  camera.position.set(0, 10, 16);
  controls.target.set(0, 0, 0);
}

// Trigger merger/collision and spawn realistic Kilonova artifacts
export function triggerCollision(currentParams, starTexture) {
  binaryState = 'collision';
  collisionTime = 0;

  // 1. Merger Flash (Instant brilliant white explosion core to wow the user)
  const flashGeo = new THREE.SphereGeometry(1.5, 32, 32);
  const flashMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
  });
  mergerFlash = new THREE.Mesh(flashGeo, flashMat);
  binaryGroup.add(mergerFlash);
  
  // 2. Isotropic expanding gas cloud (Kilonova Shell)
  // Use additive blending and layered transparency to make it look like a volumetric plasma fireball
  const shellGeo = new THREE.SphereGeometry(0.6, 32, 32);
  const shellMat = new THREE.MeshBasicMaterial({
    color: '#ff3a00',
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  kilonovaShell = new THREE.Mesh(shellGeo, shellMat);
  binaryGroup.add(kilonovaShell);

  // 3. Orbital Plane Shockwave Ring (XZ Plane) - squashed disc expansion
  // Large flat glowing ring representing expanding gas from tidally stripped tails
  const ringGeo = new THREE.RingGeometry(0.1, 0.8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ff8c00',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
  shockwaveRing.rotation.x = Math.PI / 2; // Lie flat along XZ plane
  binaryGroup.add(shockwaveRing);
  
  // 4. Double Cone Relativistic Jets (Polar Y Axis)
  // Nested cylinder cones with spinning animation and additive coloring (simulating collimated magnetic fireballs)
  const jetGroup = new THREE.Group();
  
  // Inner hot core jet
  const innerJetGeo = new THREE.CylinderGeometry(0.01, 0.8, 1, 16, 1, true);
  const innerJetMat = new THREE.MeshBasicMaterial({
    color: '#00ffff',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const innerTop = new THREE.Mesh(innerJetGeo, innerJetMat);
  innerTop.position.y = 0.5;
  const innerBottom = innerTop.clone();
  innerBottom.rotation.z = Math.PI;
  innerBottom.position.y = -0.5;
  jetGroup.add(innerTop);
  jetGroup.add(innerBottom);

  // Outer sheath jet (purple-magenta energy boundary)
  const outerJetGeo = new THREE.CylinderGeometry(0.02, 1.3, 0.95, 16, 1, true);
  const outerJetMat = new THREE.MeshBasicMaterial({
    color: '#a200ff',
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const outerTop = new THREE.Mesh(outerJetGeo, outerJetMat);
  outerTop.position.y = 0.475;
  const outerBottom = outerTop.clone();
  outerBottom.rotation.z = Math.PI;
  outerBottom.position.y = -0.475;
  jetGroup.add(outerTop);
  jetGroup.add(outerBottom);
  
  relativisticJets = jetGroup;
  binaryGroup.add(relativisticJets);

  // 5. Create Realistic Ejecta Particle System (Neutron-rich debris cloud)
  ejectaGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ejectaCount * 3);
  const colors = new Float32Array(ejectaCount * 3);
  ejectaParticles = [];

  for (let i = 0; i < ejectaCount; i++) {
    // Spherical coordinate distribution biased towards orbital plane XZ
    const u = Math.random();
    const theta = Math.random() * Math.PI * 2; // Horizontal angle
    
    // Bias phi closer to PI / 2 (orbital plane)
    const poleBias = Math.pow(Math.random() - 0.5, 3) * 2; // range [-0.25, 0.25]
    const phi = Math.PI / 2 + poleBias * Math.PI * 0.85; 
    
    // Tangential velocity component from high orbital speed (spiral ejecta force)
    const spinStrength = 0.48;
    const orbitalVel = new THREE.Vector3(-Math.sin(theta) * spinStrength, 0, Math.cos(theta) * spinStrength);
    
    // Radial direction vector
    const radialDir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );

    // Merge radial velocity and tangential orbital momentum to make it spin outward!
    const dir = new THREE.Vector3().addVectors(radialDir, orbitalVel).normalize();
    
    // Debris velocity ranges from 0.1c to 0.35c (scaled for visual aesthetics)
    const speed = 5.0 + Math.random() * 19.0; 
    
    // Initial position slightly offset to prevent single-point look
    positions[i * 3 + 0] = radialDir.x * 0.1;
    positions[i * 3 + 1] = radialDir.y * 0.1;
    positions[i * 3 + 2] = radialDir.z * 0.1;

    // High initial heat color (brilliant blue-white)
    colors[i * 3 + 0] = 0.95;
    colors[i * 3 + 1] = 0.98;
    colors[i * 3 + 2] = 1.0;

    ejectaParticles.push({
      pos: new THREE.Vector3(positions[i*3], positions[i*3+1], positions[i*3+2]),
      dir: dir,
      speed: speed,
      age: 0.0,
      maxAge: 1.6 + Math.random() * 1.8 // lifespan 1.6 to 3.4s
    });
  }

  ejectaGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  ejectaGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  ejectaMaterial = new THREE.PointsMaterial({
    size: 0.24, // Increased size for volumetric dust cloud appearance instead of tiny dots
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    map: starTexture,
    opacity: 0.92
  });

  ejectaPoints = new THREE.Points(ejectaGeometry, ejectaMaterial);
  binaryGroup.add(ejectaPoints);
}

// Spawn final Remnant Black Hole
export function setupRemnantBH(currentParams) {
  binaryState = 'remnant';
  if (star1) star1.visible = false;
  if (star2) star2.visible = false;
  
  // Calculate remnant black hole mass using mass conservation (E = mc^2 and ejecta loss)
  // Loss is ~6% of total binary neutron star mass: 3% GW emission, 3% ejecta cloud
  const totalNSMass = currentParams.m1 + currentParams.m2;
  remnantMass = totalNSMass * 0.94; // Reduced mass
  
  // Event Horizon scale calculation based on mass
  const bhRadius = 0.35 * Math.pow(remnantMass, 0.7);
  
  // Event Horizon (absorbing void)
  const horizonGeo = new THREE.SphereGeometry(bhRadius, 32, 32);
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  eventHorizon = new THREE.Mesh(horizonGeo, horizonMat);
  eventHorizon.scale.set(0, 0, 0); // Start at scale 0 for smooth growth transition
  binaryGroup.add(eventHorizon);
  
  // Einstein Ring (Purple-magenta gravitationally lensed light boundary)
  const ringRadius = bhRadius * 1.5;
  const ringGeo = new THREE.TorusGeometry(ringRadius, 0.05, 12, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xaa3bff,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.0 // Start transparent
  });
  einsteinRing = new THREE.Mesh(ringGeo, ringMat);
  einsteinRing.rotation.x = Math.PI / 2;
  einsteinRing.scale.set(0, 0, 0); // Start at scale 0
  binaryGroup.add(einsteinRing);

  // Leftover Accretion Disk (hot remnant debris orbiting close)
  const diskGeo = new THREE.RingGeometry(ringRadius * 1.05, ringRadius * 1.8, 32);
  const diskMat = new THREE.MeshBasicMaterial({
    color: 0xff3b00,
    transparent: true,
    opacity: 0.0, // Start transparent
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  remnantDisk = new THREE.Mesh(diskGeo, diskMat);
  remnantDisk.rotation.x = Math.PI / 2;
  binaryGroup.add(remnantDisk);
}

// Update orbital decay, grav waves, Kilonova explosion, and camera shake
export function updateBinary(dt, elapsedTime, camera, controls, currentParams, starTexture) {
  // Scale time steps based on simulation speed controls
  const actualDt = Math.min(dt, 0.1) * currentParams.speed;
  
  let baseOrbitalSpeed = 0;
  
  if (binaryState === 'orbiting') {
    const m1 = currentParams.m1;
    const m2 = currentParams.m2;
    const mSum = m1 + m2;
    const mProd = m1 * m2;
    
    // 1. Orbital velocity scaling (Kepler's 3rd Law scale)
    baseOrbitalSpeed = Math.sqrt(mSum / Math.pow(currentBinDist, 3.0)) * 12.0;
    binaryAngle += baseOrbitalSpeed * actualDt;

    // Star pulsar envelopes rapid flashing simulation
    if (star1Glow && star1Glow.material) {
      star1Glow.material.opacity = 0.45 + Math.sin(elapsedTime * 50.0) * 0.15;
    }
    if (star2Glow && star2Glow.material) {
      star2Glow.material.opacity = 0.45 + Math.cos(elapsedTime * 42.0) * 0.15;
    }
    
    // 2. Gravitational Radiation Orbit Decay simulation
    // Physically, decay rate accelerates exponentially as distance approaches zero
    const baseDecay = (currentParams.decay * 0.30 * mProd * mSum) / Math.pow(currentBinDist, 2.5);
    currentBinDist = Math.max(0.8, currentBinDist - baseDecay * actualDt);
    
    // Scale size of stars relative to mass (mass^(1/3) density scale)
    const star1Scale = 0.35 * Math.pow(m1, 1/3);
    const star2Scale = 0.35 * Math.pow(m2, 1/3);
    star1.scale.set(star1Scale, star1Scale, star1Scale);
    star2.scale.set(star2Scale, star2Scale, star2Scale);
    
    // Barycenter positioning (m1*r1 = m2*r2)
    const r1 = (m2 / mSum) * currentBinDist;
    const r2 = (m1 / mSum) * currentBinDist;
    
    star1.position.set(Math.cos(binaryAngle) * r1, 0, Math.sin(binaryAngle) * r1);
    star2.position.set(-Math.cos(binaryAngle) * r2, 0, -Math.sin(binaryAngle) * r2);
    
    // 3. Emit Gravitational Wave (GW) particles (Frequency rises as distance decreases - chirp)
    const emitChance = 0.15 + (1.0 / currentBinDist) * 0.45;
    if (Math.random() < emitChance && gwParticles.length < maxGwParticles - 2) {
      const col1 = new THREE.Color('#00ccff');
      const col2 = new THREE.Color('#aa3bff');
      
      gwParticles.push({
        pos: star1.position.clone(),
        vel: star1.position.clone().normalize().multiplyScalar(4.0),
        angle: binaryAngle,
        radius: r1,
        color: col1,
        age: 0,
        maxAge: 3.5
      });
      gwParticles.push({
        pos: star2.position.clone(),
        vel: star2.position.clone().normalize().multiplyScalar(4.0),
        angle: binaryAngle + Math.PI,
        radius: r2,
        color: col2,
        age: 0,
        maxAge: 3.5
      });
    }
    
    // Collision condition (Touch radius threshold)
    const starRadiusSum = star1Scale + star2Scale;
    if (currentBinDist <= starRadiusSum + 0.15) {
      triggerCollision(currentParams, starTexture);
    }
    
  } else if (binaryState === 'collision') {
    collisionTime += actualDt;
    
    // 1. Shrink/collapse neutron stars
    const shrink = Math.max(0, 1.0 - collisionTime * 3.5);
    star1.scale.set(shrink, shrink, shrink);
    star2.scale.set(shrink, shrink, shrink);
    
    // 2. Kilonova Shell expansion (isotropic expanding gas)
    if (kilonovaShell) {
      kilonovaShell.scale.addScalar(actualDt * 10.0 * (1.0 / (kilonovaShell.scale.x * 0.35 + 1.0)));
      kilonovaShell.material.opacity = Math.max(0, 0.92 - collisionTime / 2.0);
    }

    // 3. Shockwave flat ring expansion
    if (shockwaveRing) {
      shockwaveRing.scale.addScalar(actualDt * 22.0 * (1.0 / (shockwaveRing.scale.x * 0.18 + 1.0)));
      shockwaveRing.material.opacity = Math.max(0, 0.85 - collisionTime / 1.5);
    }
    
    // 4. Bipolar Relativistic jets
    if (relativisticJets) {
      // Scale vertically (y) rapidly
      relativisticJets.scale.y += actualDt * 48.0;
      // Shrink horizontally (x, z) to look collimated
      const jetWidth = Math.max(0, 2.0 - collisionTime * 0.85);
      relativisticJets.scale.x = jetWidth;
      relativisticJets.scale.z = jetWidth;
      
      // Spinning dynamic effect on the jets to simulate high magnetar energy
      relativisticJets.rotation.y += actualDt * 20.0;
      
      // Fade out child jet meshes
      relativisticJets.children.forEach(child => {
        if (child.material) {
          child.material.opacity = Math.max(0, child.material.opacity - actualDt * 0.45);
        }
      });
    }

    // 5. Merger Flash core fade out
    if (mergerFlash) {
      mergerFlash.scale.addScalar(actualDt * 30.0);
      mergerFlash.material.opacity = Math.max(0, 1.0 - collisionTime * 4.5);
      if (mergerFlash.material.opacity <= 0) {
        binaryGroup.remove(mergerFlash);
        mergerFlash.geometry.dispose();
        mergerFlash.material.dispose();
        mergerFlash = null;
      }
    }

    // 6. Update Ejecta Particle movements and heat coloration
    if (ejectaPoints && ejectaGeometry) {
      const positions = ejectaGeometry.attributes.position.array;
      const colors = ejectaGeometry.attributes.color.array;

      for (let i = 0; i < ejectaCount; i++) {
        const p = ejectaParticles[i];
        if (p) {
          p.age += actualDt;
          
          // Move particle along trajectory, adding slight deceleration from gravity
          const decel = 1.0 / (1.0 + p.age * 0.8);
          p.pos.addScaledVector(p.dir, p.speed * actualDt * decel);
          
          positions[i * 3 + 0] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          // Realistic Color evolution according to cooling
          const tRatio = p.age / p.maxAge;
          
          if (tRatio < 0.18) {
            // Hot white blue (first stage)
            colors[i * 3 + 0] = 0.9;
            colors[i * 3 + 1] = 0.98;
            colors[i * 3 + 2] = 1.0;
          } else if (tRatio < 0.55) {
            // Cools down to orange-yellow (nucleosynthesis stage)
            const lerpVal = (tRatio - 0.18) / 0.37;
            colors[i * 3 + 0] = 1.0;
            colors[i * 3 + 1] = 0.85 - lerpVal * 0.45; // decays to 0.4
            colors[i * 3 + 2] = 0.8 - lerpVal * 0.75;  // decays to 0.05
          } else {
            // Cold deep red/brown (final dust stage)
            const lerpVal = (tRatio - 0.55) / 0.45;
            const opac = Math.max(0, 1.0 - lerpVal);
            colors[i * 3 + 0] = (0.8 - lerpVal * 0.55) * opac;
            colors[i * 3 + 1] = (0.4 - lerpVal * 0.35) * opac;
            colors[i * 3 + 2] = 0.05 * opac;
          }
        }
      }
      ejectaGeometry.attributes.position.needsUpdate = true;
      ejectaGeometry.attributes.color.needsUpdate = true;
    }
    
    // Expire orbital GW waves immediately during explosion
    gwParticles.forEach(p => p.age += actualDt * 5.0);
    
    // 7. Camera shake effect (Exponential decay shaking target)
    const shakeIntensity = Math.max(0, 0.85 * Math.exp(-collisionTime * 1.5));
    controls.target.set(
      (Math.random() - 0.5) * shakeIntensity,
      (Math.random() - 0.5) * shakeIntensity,
      (Math.random() - 0.5) * shakeIntensity
    );
    
    if (collisionTime >= 0.70) {
      setupRemnantBH(currentParams);
    }
    
  } else if (binaryState === 'remnant') {
    collisionTime += actualDt;
    
    // Smooth transition of high-energy assets (no abrupt cutting!)
    if (relativisticJets) {
      relativisticJets.scale.y += actualDt * 24.0;
      let allFaded = true;
      relativisticJets.children.forEach(child => {
        if (child.material) {
          child.material.opacity = Math.max(0, child.material.opacity - actualDt * 0.75);
          if (child.material.opacity > 0) allFaded = false;
        }
      });
      if (allFaded) {
        binaryGroup.remove(relativisticJets);
        relativisticJets = null;
      }
    }

    if (shockwaveRing) {
      shockwaveRing.scale.addScalar(actualDt * 12.0);
      shockwaveRing.material.opacity = Math.max(0, shockwaveRing.material.opacity - actualDt * 0.75);
      if (shockwaveRing.material.opacity <= 0) {
        binaryGroup.remove(shockwaveRing);
        shockwaveRing.geometry.dispose();
        shockwaveRing.material.dispose();
        shockwaveRing = null;
      }
    }
    
    // Kilonova shell slowly expands and dissolves completely
    if (kilonovaShell) {
      kilonovaShell.scale.addScalar(actualDt * 1.5);
      kilonovaShell.material.opacity = Math.max(0, kilonovaShell.material.opacity - actualDt * 0.35);
      if (kilonovaShell.material.opacity <= 0) {
        binaryGroup.remove(kilonovaShell);
        kilonovaShell.geometry.dispose();
        kilonovaShell.material.dispose();
        kilonovaShell = null;
      }
    }

    // Remnant Black Hole formation and growth transition
    const transitionTime = collisionTime - 0.70;
    const transitionScale = Math.min(1.0, transitionTime / 1.5); // 1.5s smooth transition
    
    if (eventHorizon) {
      const ringdownIntensity = Math.max(0, 0.02 * Math.exp(-transitionTime * 1.0));
      const pulse = 1.0 + Math.sin(elapsedTime * 28.0) * ringdownIntensity;
      eventHorizon.scale.set(transitionScale * pulse, transitionScale * pulse, transitionScale * pulse);
    }
    
    if (einsteinRing) {
      einsteinRing.scale.set(transitionScale, transitionScale, transitionScale);
      einsteinRing.material.opacity = transitionScale * 0.85;
      einsteinRing.rotation.z += actualDt * 0.18;
    }

    if (remnantDisk) {
      remnantDisk.rotation.z -= actualDt * 0.4;
      remnantDisk.material.opacity = transitionScale * (0.65 - transitionTime * 0.08); // Grow then dissolve slowly
      if (remnantDisk.material.opacity <= 0) {
        binaryGroup.remove(remnantDisk);
        remnantDisk.geometry.dispose();
        remnantDisk.material.dispose();
        remnantDisk = null;
      }
    }

    // Update leftovers of Ejecta
    if (ejectaPoints && ejectaGeometry) {
      const positions = ejectaGeometry.attributes.position.array;
      const colors = ejectaGeometry.attributes.color.array;

      for (let i = 0; i < ejectaCount; i++) {
        const p = ejectaParticles[i];
        if (p) {
          p.age += actualDt;
          
          const decel = 1.0 / (1.0 + p.age * 0.8);
          p.pos.addScaledVector(p.dir, p.speed * actualDt * decel);
          
          positions[i * 3 + 0] = p.pos.x;
          positions[i * 3 + 1] = p.pos.y;
          positions[i * 3 + 2] = p.pos.z;

          const tRatio = Math.min(1.0, p.age / p.maxAge);
          const lerpVal = Math.max(0, (tRatio - 0.55) / 0.45);
          const opac = Math.max(0, 1.0 - (p.age / p.maxAge) * 1.2);
          
          colors[i * 3 + 0] = (0.25 - lerpVal * 0.25) * opac;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
      }
      ejectaGeometry.attributes.position.needsUpdate = true;
      ejectaGeometry.attributes.color.needsUpdate = true;
    }
    
    gwParticles.forEach(p => p.age += actualDt * 1.8);
  }
  
  // Update Spacetime Grid Vertices
  if (spacetimeGrid && gridGeometry) {
    const gridPositions = gridGeometry.attributes.position.array;
    const vertexCount = gridPositions.length / 3;
    
    const m1 = currentParams.m1;
    const m2 = currentParams.m2;
    const mSum = m1 + m2;
    
    // Star coordinates in World Space
    let s1x = 0, s1z = 0, s2x = 0, s2z = 0;
    if (binaryState === 'orbiting') {
      s1x = star1.position.x;
      s1z = star1.position.z;
      s2x = star2.position.x;
      s2z = star2.position.z;
    }
    
    for (let i = 0; i < vertexCount; i++) {
      // Local plane coordinates (local X and local Y correspond to world X and world -Z)
      const lx = gridPositions[i * 3 + 0];
      const ly = gridPositions[i * 3 + 1];
      
      const wx = lx;
      const wz = -ly;
      const dc = Math.sqrt(wx * wx + wz * wz);
      
      let zGravity = 0;
      let zWave = 0;
      
      if (binaryState === 'orbiting') {
        // 1. Static gravity well deformations for Star 1 and Star 2
        const d1 = Math.sqrt((wx - s1x) * (wx - s1x) + (wz - s1z) * (wz - s1z));
        const d2 = Math.sqrt((wx - s2x) * (wx - s2x) + (wz - s2z) * (wz - s2z));
        
        // Gravity wells dousing the grid downwards
        zGravity = -(0.55 * m1 / (d1 + 0.85)) - (0.55 * m2 / (d2 + 0.85));
        
        // 2. Quadrupole Gravitational Waves (spiral ripples rotating with the binary angle)
        const gwAmp = 0.52 * (m1 * m2) / Math.max(1.5, currentBinDist);
        const theta = Math.atan2(wz, wx);
        
        // Quadrupole angular phase: 2 * (theta - binaryAngle)
        // Spatial ripple progression: dc * 0.95 (wave number)
        const wavePhase = 2.0 * (theta - binaryAngle) + dc * 0.95;
        
        // Exponential radial decay + amplitude scaling
        zWave = (gwAmp / (dc * 0.16 + 1.0)) * Math.sin(wavePhase);
        
        // Soften wave peaks very close to the stars to prevent chaotic clipping
        const starDistMin = Math.min(d1, d2);
        if (starDistMin < 2.0) {
          zWave *= Math.pow(starDistMin / 2.0, 2);
        }
      } else if (binaryState === 'collision') {
        // High-energy merger event: Massive expanding wave-front ripple (chirp peak bursting out)
        // Dynamically collapse spacetime as stars merge
        const collapseScale = Math.min(1.0, collisionTime / 0.70);
        const depthCoeff = 0.55 + (2.0 - 0.55) * collapseScale;
        const soften = 0.85 - (0.85 - 0.50) * collapseScale;
        zGravity = -(depthCoeff * mSum / (dc + soften));
        
        const collisionPhase = collisionTime;
        const waveFrontRadius = collisionPhase * 16.0; // Rapidly expanding wave front
        const distToFront = Math.abs(dc - waveFrontRadius);
        
        // Dampening wave amplitude over time
        const peakAmp = 2.5 * Math.exp(-collisionPhase * 1.4);
        
        // Wave ripple traveling outwards
        const wavePhase = dc * 2.0 - collisionPhase * 26.0;
        
        // Envelope centered on the expanding wavefront
        const wavefrontEnvelope = Math.exp(-distToFront * distToFront * 0.12);
        
        zWave = (peakAmp / (dc * 0.1 + 1.0)) * Math.sin(wavePhase) * wavefrontEnvelope;
      } else {
        // remnant phase (Static Black Hole): Deep deformed gravitational funnel
        // As the black hole forms and grows, the spacetime funnel deepens dynamically!
        const transitionTime = collisionTime - 0.70;
        const transitionScale = Math.min(1.0, transitionTime / 1.5);
        
        // Final depth coefficient is scaled up significantly to showcase singular funnel depth!
        const targetDepthCoeff = 4.8;
        const depthCoeff = 2.0 + (targetDepthCoeff - 2.0) * transitionScale;
        const soften = 0.50 - (0.50 - 0.32) * transitionScale;
        
        // The funnel tightens and sinks deep at dc -> 0, down to -24.0 (previously -10.5)
        zGravity = Math.max(-24.0, -(depthCoeff * remnantMass / (dc + soften)));
        
        // Lingering waves dispersing into outer boundaries
        if (collisionTime < 4.0) {
          const lingerTime = collisionTime - 0.70;
          const waveFrontRadius = 0.70 * 16.0 + lingerTime * 10.0;
          const distToFront = Math.abs(dc - waveFrontRadius);
          const peakAmp = 0.8 * Math.exp(-lingerTime * 2.0);
          const wavefrontEnvelope = Math.exp(-distToFront * distToFront * 0.08);
          zWave = (peakAmp / (dc * 0.1 + 1.0)) * Math.sin(dc * 1.5 - collisionTime * 15.0) * wavefrontEnvelope;
        }
      }
      
      // Update local Z coord (which corresponds to vertical world Y after rotation)
      gridPositions[i * 3 + 2] = zGravity + zWave;
    }
    
    gridGeometry.attributes.position.needsUpdate = true;
  }
  
  updateGwParticles(actualDt, elapsedTime, currentParams);
}

// Update Gravitational Wave particles propagation in a spiral pattern
function updateGwParticles(dt, time, currentParams) {
  if (!gwGeometry || !gwPoints) return;
  
  const positions = gwGeometry.attributes.position.array;
  const colors = gwGeometry.attributes.color.array;
  
  gwParticles = gwParticles.filter(p => {
    p.age += dt;
    return p.age < p.maxAge;
  });
  
  for (let i = 0; i < maxGwParticles; i++) {
    const p = gwParticles[i];
    if (p) {
      const expandSpeed = 4.0 + p.age * 1.0;
      const currentDist = p.radius + p.age * expandSpeed;
      const waveAngle = p.angle + p.age * 3.5;
      
      const baseAmp = 0.75 * (currentParams.m1 * currentParams.m2) / Math.max(1.0, currentBinDist);
      const rippleY = Math.sin(currentDist * 2.2 - time * 16.0) * (baseAmp / (1.0 + p.age * 1.5));
      
      positions[i * 3 + 0] = Math.cos(waveAngle) * currentDist;
      positions[i * 3 + 1] = rippleY;
      positions[i * 3 + 2] = Math.sin(waveAngle) * currentDist;
      
      const opacity = 1.0 - (p.age / p.maxAge);
      colors[i * 3 + 0] = p.color.r * opacity;
      colors[i * 3 + 1] = p.color.g * opacity;
      colors[i * 3 + 2] = p.color.b * opacity;
    } else {
      positions[i * 3 + 0] = 9999;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      colors[i * 3 + 0] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
    }
  }
  
  gwGeometry.attributes.position.needsUpdate = true;
  gwGeometry.attributes.color.needsUpdate = true;
}

// Getter functions to expose current states to main.js
export function getBinaryState() { return binaryState; }
export function getBinDist() { return currentBinDist; }
export function getCollisionTime() { return collisionTime; }
export function getRemnantMass() { return remnantMass; }

