console.log("Three.js cargado");

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- Render y escena ----------
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
app.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// ---------- Cámara con pivotes ----------
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 4000);

const rig = new THREE.Group();
rig.position.set(0, 0, -4);

const yawPivot = new THREE.Object3D();     // yaw (Y)
const pitchPivot = new THREE.Object3D();   // pitch (X)

rig.add(yawPivot);
yawPivot.add(pitchPivot);
pitchPivot.add(camera);
scene.add(rig);

// ---------- Estrellas ----------
function addStarfield(count=3000, radius=1500){
  const pos = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const u=Math.random(), v=Math.random();
    const th=2*Math.PI*u, ph=Math.acos(2*v-1), r=radius*(0.7+0.3*Math.random());
    pos[i*3+0]=r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);
    pos[i*3+2]=r*Math.cos(ph);
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({ size:1.2, sizeAttenuation:true, color:0xffffff });
  const stars=new THREE.Points(geo,mat); stars.frustumCulled=false; scene.add(stars);
}
addStarfield();

// ---------- Luces ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

// ---------- GLB ----------
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root=gltf.scene;
  root.position.set(0,0,-5);
  scene.add(root);
});

// ---------- Mouse look ----------
let pitch = 0;
document.addEventListener('mousemove', (e)=>{
  if (document.pointerLockElement === renderer.domElement) {
    yawPivot.rotation.y -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    pitchPivot.rotation.x = pitch;
  }
});
renderer.domElement.addEventListener('click', ()=>renderer.domElement.requestPointerLock());

// ---------- WASD ----------
let keys = {};
document.addEventListener('keydown', e=> keys[e.code]=true);
document.addEventListener('keyup',   e=> keys[e.code]=false);

function moveForward(dist){
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(yawPivot.quaternion);
  rig.position.addScaledVector(fwd, dist);
}
function strafeRight(dist){
  const right = new THREE.Vector3(1,0,0).applyQuaternion(yawPivot.quaternion);
  rig.position.addScaledVector(right, dist);
}
function updateKeyboard(dt){
  const speed = 3.0;
  if (keys['KeyW']) moveForward( speed*dt);
  if (keys['KeyS']) moveForward(-speed*dt);
  if (keys['KeyA']) strafeRight(-speed*dt);
  if (keys['KeyD']) strafeRight( speed*dt);
}

// ---------- Loop ----------
renderer.setAnimationLoop(()=>{
  const dt = 1/72;
  updateKeyboard(dt);

  // Horizon fijo: sin roll
  yawPivot.rotation.z = 0;
  pitchPivot.rotation.z = 0;
  camera.rotation.z = 0;

  renderer.render(scene, camera);
});
