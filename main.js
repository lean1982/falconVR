import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ------------------ Escena / Renderer ------------------
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

// ------------------ Cámara con pivotes ------------------
// Estructura: rig (posición) -> yawPivot (rot Y) -> pitchPivot (rot X) -> camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 4000);
camera.rotation.order = 'YXZ'; // asegura control de ejes estable

const rig = new THREE.Group();
rig.position.set(0, 0, 0);

const yawPivot = new THREE.Object3D();      // gira IZQ/DER (yaw)
const pitchPivot = new THREE.Object3D();    // mira ARR/ABA (pitch)

rig.add(yawPivot);
yawPivot.add(pitchPivot);
pitchPivot.add(camera);

scene.add(rig);

// Bloqueo absoluto de roll (inclinación) desde el inicio
yawPivot.rotation.set(0, 0, 0);
pitchPivot.rotation.set(0, 0, 0);
camera.rotation.set(0, 0, 0);

// ------------------ Estrellas (para referencia visual) ------------------
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

// ------------------ Luces mínimas ------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0); scene.add(hemi);

// Linterna (ayuda interior)
const headlamp = new THREE.SpotLight(0xffffff, 2.0, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0,0,0);
camera.add(headlamp); camera.add(headlamp.target);
headlamp.target.position.set(0,0,-1);

// ------------------ Cargar tu GLB ------------------
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf) => {
  const root = gltf.scene;
  // Aseguramos que EL MODELO no esté rotado raro
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, -5);
  scene.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

// ------------------ Mouse look: Yaw en yawPivot, Pitch en pitchPivot ------------------
let pitch = 0;
const SENS_YAW = 0.002, SENS_PITCH = 0.002;

document.addEventListener('mousemove', (e)=>{
  if (document.pointerLockElement === renderer.domElement) {
    // yaw: izquierda/derecha
    yawPivot.rotation.y -= e.movementX * SENS_YAW;

    // pitch: arriba/abajo
    pitch -= e.movementY * SENS_PITCH;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    pitchPivot.rotation.x = pitch;

    // NUNCA roll:
    yawPivot.rotation.z = 0;
    pitchPivot.rotation.z = 0;
    camera.rotation.z = 0;
  }
});
renderer.domElement.addEventListener('click', ()=>renderer.domElement.requestPointerLock());

// ------------------ WASD: mover con base en yaw (no usa pitch) ------------------
let keys = {};
document.addEventListener('keydown', e=> keys[e.code]=true);
document.addEventListener('keyup',   e=> keys[e.code]=false);

const tmpV = new THREE.Vector3();
function forwardVectorFromYaw(){
  // vector (0,0,-1) rotado solo por yawPivot
  const fwd = tmpV.set(0,0,-1).applyQuaternion(yawPivot.quaternion);
  fwd.y = 0; fwd.normalize();
  return fwd;
}
function rightVectorFromYaw(){
  const right = tmpV.set(1,0,0).applyQuaternion(yawPivot.quaternion);
  right.y = 0; right.normalize();
  return right;
}

function updateKeyboard(dt){
  const speed = 3.0;
  if (keys['KeyW']) rig.position.addScaledVector(forwardVectorFromYaw(),  speed*dt);
  if (keys['KeyS']) rig.position.addScaledVector(forwardVectorFromYaw(), -speed*dt);
  if (keys['KeyA']) rig.position.addScaledVector(rightVectorFromYaw(),   -speed*dt);
  if (keys['KeyD']) rig.position.addScaledVector(rightVectorFromYaw(),    speed*dt);
}

// ------------------ Mantener horizonte plano SIEMPRE ------------------
function lockRollEveryFrame(){
  yawPivot.rotation.x = 0;           // yawPivot solo rota en Y
  yawPivot.rotation.z = 0;

  pitchPivot.rotation.y = 0;         // pitchPivot solo rota en X
  pitchPivot.rotation.z = 0;

  camera.rotation.y = 0;             // la cámara no introduce yaw extra
  camera.rotation.z = 0;             // sin roll
}

// ------------------ Resize ------------------
function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ------------------ Loop ------------------
renderer.setAnimationLoop(()=>{
  const dt = 1/72;
  updateKeyboard(dt);
  lockRollEveryFrame();
  renderer.render(scene, camera);
});
