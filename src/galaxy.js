import * as THREE from 'three';

// 1. Galaxy Parameters
export const galaxyParameters = {
  count: 50000,
  arms: 2,
  spin: 1.2,
  radius: 15,
  randomness: 0.3,
  speed: 0.5,
  coreDensity: 1.8,
  coreColor: '#ffe6aa',
  outerColor: '#0088ff'
};

// Module Internal State
let activeGeometry = null;
let activeMaterial = null;
let activePoints = null;
let starsData = [];

// Cleanup function to avoid leaks when switching modes
export function cleanupGalaxy(scene) {
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

// Generate the Galaxy points representation
export function generateGalaxy(scene, currentParams, starTexture) {
  cleanupGalaxy(scene);

  activeGeometry = new THREE.BufferGeometry();
  
  const count = currentParams.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  const colorCore = new THREE.Color(currentParams.coreColor);
  const colorOuter = new THREE.Color(currentParams.outerColor);
  
  starsData = [];

  for (let i = 0; i < count; i++) {
    const distance = Math.pow(Math.random(), currentParams.coreDensity) * currentParams.radius;
    
    const armIndex = i % currentParams.arms;
    const armAngle = (armIndex / currentParams.arms) * Math.PI * 2;
    
    const normalizedDistance = distance / currentParams.radius;
    const spreadMultiplier = currentParams.randomness * (1 - normalizedDistance * 0.4);
    
    const randomX = Math.pow(Math.random(), 3.5) * (Math.random() < 0.5 ? 1 : -1) * spreadMultiplier * distance;
    const randomY = Math.pow(Math.random(), 3.0) * (Math.random() < 0.5 ? 1 : -1) * spreadMultiplier * distance * 0.55;
    const randomZ = Math.pow(Math.random(), 3.5) * (Math.random() < 0.5 ? 1 : -1) * spreadMultiplier * distance;
    
    const speedFactor = 1.0 + (Math.random() - 0.5) * 0.15;
    
    starsData.push({
      radius: distance,
      angleOffset: armAngle,
      randomX,
      randomY,
      randomZ,
      speedFactor
    });

    const initialAngle = armAngle + (distance * currentParams.spin);
    
    positions[i * 3 + 0] = Math.cos(initialAngle) * distance + randomX;
    positions[i * 3 + 1] = randomY;
    positions[i * 3 + 2] = Math.sin(initialAngle) * distance + randomZ;

    const mixedColor = colorCore.clone();
    mixedColor.lerp(colorOuter, normalizedDistance);
    
    const brightnessRandom = 0.8 + Math.random() * 0.4;
    colors[i * 3 + 0] = Math.min(1.0, mixedColor.r * brightnessRandom);
    colors[i * 3 + 1] = Math.min(1.0, mixedColor.g * brightnessRandom);
    colors[i * 3 + 2] = Math.min(1.0, mixedColor.b * brightnessRandom);
  }

  activeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  activeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  activeMaterial = new THREE.PointsMaterial({
    size: 0.12,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    map: starTexture,
    transparent: true
  });

  activePoints = new THREE.Points(activeGeometry, activeMaterial);
  scene.add(activePoints);
}

// Update Galaxy orbit positions over time
export function updateGalaxy(elapsedTime, currentParams) {
  if (!activeGeometry || !activePoints) return;

  const positions = activeGeometry.attributes.position.array;
  const count = currentParams.count;

  for (let i = 0; i < count; i++) {
    const star = starsData[i];
    if (!star) continue;

    // Flat rotation curve representing Dark Matter influence: v ≈ const, angular speed ω ∝ 1 / (r + r_core)
    const orbitSpeed = elapsedTime * currentParams.speed * star.speedFactor * (3.2 / (star.radius + 1.8));
    const currentAngle = star.angleOffset + orbitSpeed;
    const armAngle = currentAngle + (star.radius * currentParams.spin);

    positions[i * 3 + 0] = Math.cos(armAngle) * star.radius + star.randomX;
    positions[i * 3 + 1] = star.randomY;
    positions[i * 3 + 2] = Math.sin(armAngle) * star.radius + star.randomZ;
  }

  activeGeometry.attributes.position.needsUpdate = true;
}
