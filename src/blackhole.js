import * as THREE from 'three';

// 2. Black Hole Parameters
export const bhParameters = {
  mass: 4.0, // Event Horizon scale multiplier
  count: 40000, // Accretion disk gas count
  radius: 9.0, // Accretion disk radius
  warp: 1.35, // Gravitational lensing warp intensity
  speed: 1.20, // Rotation velocity
  color: '#ff6600', // Hot inner disk gas color
  outerColor: '#330088' // Cooler outer disk gas color
};

// Module Internal State
let activeGeometry = null;
let activeMaterial = null;
let activePoints = null;
let eventHorizon = null;
let einsteinRing = null;
let blackHoleGroup = null;
let starsData = [];

// Cleanup function to avoid leaks when switching modes
export function cleanupBlackHole(scene) {
  if (blackHoleGroup) {
    scene.remove(blackHoleGroup);
    
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
    blackHoleGroup = null;
  }

  if (activePoints) {
    scene.remove(activePoints);
    activePoints = null;
  }
  if (activeGeometry) {
    activeGeometry.dispose();
    activeGeometry = null;
  }
  if (activeMaterial) {
    activeMaterial.dispose();
    activeMaterial = null;
  }
  starsData = [];
}

// Generate the Black Hole core and warped accretion disk
export function generateBlackHole(scene, currentParams, starTexture) {
  cleanupBlackHole(scene);
  
  blackHoleGroup = new THREE.Group();
  scene.add(blackHoleGroup);
  
  // 1. Event Horizon (The dark void)
  const ehRadius = currentParams.mass * 0.4;
  const horizonGeo = new THREE.SphereGeometry(ehRadius, 32, 32);
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  eventHorizon = new THREE.Mesh(horizonGeo, horizonMat);
  blackHoleGroup.add(eventHorizon);

  // 2. Einstein Ring (Lensed light boundary of innermost orbit - ISCO)
  const ringRadius = ehRadius * 1.45;
  const ringGeo = new THREE.TorusGeometry(ringRadius, 0.08, 12, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(currentParams.color),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95
  });
  einsteinRing = new THREE.Mesh(ringGeo, ringMat);
  einsteinRing.rotation.x = Math.PI / 2; // Flat horizontal layout
  blackHoleGroup.add(einsteinRing);

  // 3. Accretion Disk (Gas particles moving relative to Event Horizon)
  activeGeometry = new THREE.BufferGeometry();
  const count = currentParams.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  // Innermost stable circular orbit (ISCO) bound
  const minRadius = ehRadius * 1.5;
  const maxRadius = currentParams.radius;
  
  const colorInner = new THREE.Color(currentParams.color);
  const colorOuter = new THREE.Color(currentParams.outerColor);
  
  starsData = [];

  for (let i = 0; i < count; i++) {
    // Distance distribution - densest near horizon, expanding out
    const distance = minRadius + Math.pow(Math.random(), 2.2) * (maxRadius - minRadius);
    const angleOffset = Math.random() * Math.PI * 2;
    
    // Disk thickness parameter - slightly thicker vertically near the inner parts to simulate torus
    const thickness = 0.07 * Math.pow(distance / minRadius, 0.7);
    const randomY = (Math.random() - 0.5) * thickness;
    
    // Speed factor: Keplerian speed curve (orbital speed inversely proportional to distance)
    const keplerSpeed = Math.sqrt(currentParams.mass / Math.pow(distance, 3.0));
    
    // Assign lensing sign (1.0 or -1.0 to decide top/bottom optical routing)
    const lenseSign = Math.random() < 0.5 ? 1.0 : -1.0;
    
    // Color gradient based on heat (inner disk hot orange/red, outer cool indigo)
    const normalizedDistance = (distance - minRadius) / (maxRadius - minRadius);
    const mixedColor = colorInner.clone();
    mixedColor.lerp(colorOuter, normalizedDistance);
    
    // Individual particle brightness variability
    const brightRandom = 0.6 + Math.random() * 0.6;
    const rCol = Math.min(1.0, mixedColor.r * brightRandom);
    const gCol = Math.min(1.0, mixedColor.g * brightRandom);
    const bCol = Math.min(1.0, mixedColor.b * brightRandom);

    starsData.push({
      radius: distance,
      angleOffset,
      randomY,
      speedFactor: keplerSpeed * 8, // Scale to look natural in animation
      lenseSign,
      baseColor: { r: rCol, g: gCol, b: bCol }
    });

    positions[i * 3 + 0] = Math.cos(angleOffset) * distance;
    positions[i * 3 + 1] = randomY;
    positions[i * 3 + 2] = Math.sin(angleOffset) * distance;

    colors[i * 3 + 0] = rCol;
    colors[i * 3 + 1] = gCol;
    colors[i * 3 + 2] = bCol;
  }

  activeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  activeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  activeMaterial = new THREE.PointsMaterial({
    size: 0.06, // Smaller size for softer, more cloud-like accretion disk gas
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    map: starTexture,
    transparent: true,
    opacity: 0.85
  });

  activePoints = new THREE.Points(activeGeometry, activeMaterial);
  scene.add(activePoints);
}

// Update Accretion Disk orbital movement and apply Gravitational Lensing effect
export function updateBlackHole(elapsedTime, camera, currentParams) {
  if (!activeGeometry || !activePoints) return;

  const positions = activeGeometry.attributes.position.array;
  const colors = activeGeometry.attributes.color.array;
  const count = currentParams.count;

  // 1. Get current normalized direction of the camera from the Black Hole (0,0,0)
  const camDir = new THREE.Vector3().copy(camera.position).normalize();

  // 2. Build the camera viewport orthogonal coordinate system in world space
  // This allows us to map background lensed gas onto a perpendicular ring facing the camera
  const camUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(camDir.y) > 0.95) {
    camUp.set(0, 0, 1); // Avoid gimbal lock near poles
  }

  const vRight = new THREE.Vector3().crossVectors(camUp, camDir).normalize();
  const vUp = new THREE.Vector3().crossVectors(camDir, vRight).normalize();

  const ehRadius = currentParams.mass * 0.4;
  const rEinstein = ehRadius * 1.5; // Einstein Ring radius based on black hole mass

  for (let i = 0; i < count; i++) {
    const star = starsData[i];
    if (!star) continue;

    // A. Actual orbital movement (Keplerian physics rotation)
    const currentAngle = star.angleOffset + elapsedTime * currentParams.speed * star.speedFactor;
    const cosAngle = Math.cos(currentAngle);
    const sinAngle = Math.sin(currentAngle);

    // Realistic flat disk coordinates (XZ plane)
    const px = cosAngle * star.radius;
    const py = star.randomY;
    const pz = sinAngle * star.radius;

    // B. Calculate 3D distance and dot product to identify front/back (relative to camera)
    const r = Math.sqrt(px * px + py * py + pz * pz);
    const cosA3D = (px * camDir.x + py * camDir.y + pz * camDir.z) / (r + 0.0001);

    // C. Project particle coordinates onto the camera viewport plane (Right and Up axes)
    const xPrime = px * vRight.x + py * vRight.y + pz * vRight.z;
    const yPrimeReal = px * vUp.x + py * vUp.y + pz * vUp.z;
    
    // Physical distance from the black hole center on the projection plane
    const dPerp = Math.sqrt(xPrime * xPrime + yPrimeReal * yPrimeReal);

    // D. Apply Schwarzschild Gravitational Lensing Approximation
    // Lensing weight increases for particles behind the black hole (cosA3D < 0)
    let w = 0;
    if (cosA3D < 0) {
      // Warp intensity modifier from parameters
      const warpForce = 2.0 - currentParams.warp * 0.4;
      w = Math.pow(-cosA3D, Math.max(0.2, warpForce));
      w = Math.min(1.0, w);
    }

    // Standard Point-Mass Lens Equation: d' = 0.5 * (d + sqrt(d^2 + 4 * Re^2))
    // We interpolate from the original dPerp to the lensed dPerp based on weight 'w'
    const dLensedIdeal = 0.5 * (dPerp + Math.sqrt(dPerp * dPerp + 4.0 * rEinstein * rEinstein));
    const dLensed = dPerp + (dLensedIdeal - dPerp) * w;

    // Reconstruction of the lensed image position on the viewport plane
    const scale = dPerp > 0.001 ? dLensed / dPerp : 1.0;
    const lx = xPrime * scale * vRight.x + yPrimeReal * scale * vUp.x;
    const ly = xPrime * scale * vRight.y + yPrimeReal * scale * vUp.y;
    const lz = xPrime * scale * vRight.z + yPrimeReal * scale * vUp.z;

    // Interpolate depth component (z' along camDir) to pull lensed imagery slightly forward 
    // so it doesn't clip with the event horizon sphere incorrectly, but maintains 3D depth.
    const zPrime = px * camDir.x + py * camDir.y + pz * camDir.z;
    const lzPrime = zPrime * (1.0 - 0.25 * w); // Pull forward when lensed

    // Reconstruct final position in World Space
    positions[i * 3 + 0] = lx + camDir.x * lzPrime;
    positions[i * 3 + 1] = ly + camDir.y * lzPrime;
    positions[i * 3 + 2] = lz + camDir.z * lzPrime;

    // E. Relativistic Doppler Boosting (Beaming)
    // Gas orbiting towards the camera is brightened, gas moving away is dimmed
    // Gas velocity is higher closer to the black hole
    const vLos = -sinAngle * camDir.x + cosAngle * camDir.z; // Line of sight velocity direction
    const orbitVelocity = star.speedFactor * currentParams.speed * 0.08;
    const dopplerFactor = 1.0 - vLos * orbitVelocity * 2.0; // Boosting factor (amplified to 2.0 for higher contrast)
    
    // Keep color intensity bounded for realism
    const F = Math.max(0.12, Math.min(2.8, dopplerFactor));

    colors[i * 3 + 0] = Math.min(1.0, star.baseColor.r * F);
    colors[i * 3 + 1] = Math.min(1.0, star.baseColor.g * F);
    colors[i * 3 + 2] = Math.min(1.0, star.baseColor.b * F);
  }

  activeGeometry.attributes.position.needsUpdate = true;
  activeGeometry.attributes.color.needsUpdate = true;
  
  // Slow spin animation of Event Horizon & Einstein Ring to keep view dynamic
  if (blackHoleGroup) {
    blackHoleGroup.rotation.y = elapsedTime * 0.05;
  }
}
