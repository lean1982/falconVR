import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- Escena / Renderer ----------
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
renderer.physicallyCorrectLights = true;
app.appendChild(renderer.domElement);

// ---------- Cámara con pivotes (sin roll) ----------
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 4000);
camera.rotation.order = 'YXZ';

const rig = new THREE.Group();            // traslación
const yawPivot = new THREE.Object3D();    // yaw (Y)
const pitchPivot = new THREE.Object3D();  // pitch (X)
rig.add(yawPivot); yawPivot.add(pitchPivot); pitchPivot.add(camera);
scene.add(rig);

rig.position.set(0, 0, 0);
yawPivot.rotation.set(0, 0, 0);
pitchPivot.rotation.set(0, 0, 0);
camera.rotation.set(0, 0, 0);

// ---------- Estrellas ----------
function addStarfield(count=2000, radius=1200){
  const pos = new Float32Array(count*3);
  for (let i=0;i<count;i++){
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

// ---------- Luces mínimas ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
scene.add(new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0));

// ---------- Grupo del modelo con “rotación Z corregible” ----------
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Ángulo Z guardado (nivel del modelo)
const Z_KEY = 'falcon_model_zdeg';
let zDegrees = parseFloat(localStorage.getItem(Z_KEY) || '0');
applyShipZ();

function applyShipZ(){
  const zRad = THREE.MathUtils.degToRad(zDegrees);
  shipGroup.rotation.set(0, 0, zRad);
  const zLabel = document.getElementById('zdeg'); if (zLabel) zLabel.textContent = zDegrees.toFixed(1);
  // aseguramos que nuestra cadena de cámara no tenga roll
  yawPivot.rotation.z = 0; pitchPivot.rotation.z = 0; camera.rotation.z = 0;
}

// Controles para nivelar el modelo
window.addEventListener('keydown', (e)=>{
  if (e.key === '[') { zDegrees -= e.shiftKey ? 5 : 1; applyShipZ(); localStorage.setItem(Z_KEY, String(zDegrees)); }
  if (e.key === ']') { zDegrees += e.shiftKey ? 5 : 1; applyShipZ(); localStorage.setItem(Z_KEY, String(zDegrees)); }
});

// ---------- Cargar GLB dentro de shipGroup ----------
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root = gltf.scene;
  // Quitamos cualquier rotación del import (si la hubiera)
  root.rotation.set(0,0,0);
  root.position.set(0,0,-5);
  shipGroup.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

// ---------- Mouse look: YAW en yawPivot, PITCH en pitchPivot ----------
let pitch = 0;
document.addEventListener('mousemove', (e)=>{
  if (document.pointerLockElement === renderer.domElement) {
    yawPivot.rotation.y -= e.movementX * 0.002;        // yaw sólo en Y
    pitch -= e.movementY * 0.002;                       // pitch sólo en X
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    pitchPivot.rotation.x = pitch;
    // Horiz. firme (nunca roll en la cadena)
    yawPivot.rotation.z = 0; pitchPivot.rotation.z = 0; camera.rotation.z = 0;
  }
});
renderer.domElement.addEventListener('click', ()=>renderer.domElement.requestPointerLock());

// ---------- WASD con base SOLO en yaw ----------
let keys = {};
document.addEventListener('keydown', e=> keys[e.code]=true);
document.addEventListener('keyup',   e=> keys[e.code]=false);

const tmp = new THREE.Vector3();
function forwardFromYaw(){
  const fwd = tmp.set(0,0,-1).applyQuaternion(yawPivot.quaternion);
  fwd.y = 0; fwd.normalize(); return fwd;
}
function rightFromYaw(){
  const r = tmp.set(1,0,0).applyQuaternion(yawPivot.quaternion);
  r.y = 0; r.normalize(); return r;
}
function updateKeyboard(dt){
  const speed = 3.0;
  if (keys['KeyW']) rig.position.addScaledVector(forwardFromYaw(),  speed*dt);
  if (keys['KeyS']) rig.position.addScaledVector(forwardFromYaw(), -speed*dt);
  if (keys['KeyA']) rig.position.addScaledVector(rightFromYaw(),   -speed*dt);
  if (keys['KeyD']) rig.position.addScaledVector(rightFromYaw(),    speed*dt);
}

// ---------- Resize ----------
function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------- Loop ----------
renderer.setAnimationLoop(()=>{
  const dt = 1/72;
  // sin roll en ningún nodo de la cadena de vista
  yawPivot.rotation.z = 0; pitchPivot.rotation.z = 0; camera.rotation.z = 0;
  updateKeyboard(dt);
  renderer.render(scene, camera);
});
