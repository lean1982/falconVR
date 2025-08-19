console.log("Three.js cargado");

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ----- Render y escena -----
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
renderer.physicallyCorrectLights = true;
app.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Rig + cámara
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 4000);
const rig = new THREE.Group();
rig.position.set(0, 0, -4);
rig.add(camera);
scene.add(rig);

// ---- Estrellas ----
function addStarfield(count=3000, radius=1500) {
  const positions = new Float32Array(count * 3);
  for (let i=0; i<count; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2*v-1);
    const r = radius * (0.7 + Math.random()*0.3);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: true, color: 0xffffff });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  scene.add(stars);
}
addStarfield();

// Luces globales
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0);
scene.add(hemi);

// Linterna en cámara
const headlamp = new THREE.SpotLight(0xffffff, 2.2, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0,0,0);
camera.add(headlamp);
camera.add(headlamp.target);
headlamp.target.position.set(0,0,-1);

// ---- Cargar GLB ----
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb',
  (gltf) => {
    const root = gltf.scene;
    root.traverse(o=>{
      if (o.isMesh) {
        if (o.material && o.material.emissive) {
          o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity || 0, 0.2);
        }
      }
    });
    root.position.set(0, 0, -5);
    scene.add(root);

    // Luces interiores
    const l1 = new THREE.PointLight(0xfff4e6, 1.5, 12, 2.0); l1.position.set(0, 2, -3);
    const l2 = new THREE.PointLight(0x88bbff, 1.2, 10, 2.0); l2.position.set(2, 1.5, -6);
    scene.add(l1, l2);
  },
  undefined,
  (err) => { console.warn('No se pudo cargar falcon.glb', err); }
);

// Controladores XR
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
rig.add(controller1); rig.add(controller2);
const controllerModelFactory = new XRControllerModelFactory();
const controllerGrip1 = renderer.xr.getControllerGrip(0);
controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
rig.add(controllerGrip1);
const controllerGrip2 = renderer.xr.getControllerGrip(1);
controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
rig.add(controllerGrip2);

// Sable rojo
const saber = new THREE.Group();
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.2,16),
  new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 }));
hilt.position.y = 0.1; saber.add(hilt);
const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,1.0,16),
  new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x770000, emissiveIntensity: 10.0 }));
blade.position.y = 0.6; saber.add(blade);
const bladeLight = new THREE.PointLight(0xff3333, 2.8, 7.0, 2.0);
bladeLight.position.set(0,0.6,0); saber.add(bladeLight);
saber.rotation.x = -Math.PI / 2;
controllerGrip2.add(saber);

// --- Locomoción VR ---
let leftGamepad = null, rightGamepad = null;
const tmpVec3 = new THREE.Vector3();
const up = new THREE.Vector3(0,1,0);
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  session.addEventListener('inputsourceschange', () => {
    leftGamepad = null; rightGamepad = null;
    for (const s of session.inputSources) {
      if (s && s.gamepad) {
        if (s.handedness === 'left') leftGamepad = s.gamepad;
        if (s.handedness === 'right') rightGamepad = s.gamepad;
      }
    }
  });
});
const moveSpeed = 2.0;
const turnSpeed = 1.5;

// Resize
function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// --- Auto-Level ---
function autoLevel(resetPitch=false){
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion,"YXZ");
  e.z = 0;
  if(resetPitch) e.x = 0;
  camera.quaternion.setFromEuler(e);
}
document.getElementById("horizonBtn").addEventListener("click",()=>autoLevel(true));
document.addEventListener("keydown",e=>{ if(e.code==="KeyR") autoLevel(true); });

// --- Teclado PC ---
let keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);
let yaw=0,pitch=0;
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement) {
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
});
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
function updateKeyboard(dt){
  const speed = 3.0;
  const dir = new THREE.Vector3();
  if (keys['KeyW']) dir.z -= 1;
  if (keys['KeyS']) dir.z += 1;
  if (keys['KeyA']) dir.x -= 1;
  if (keys['KeyD']) dir.x += 1;
  if (dir.lengthSq()>0){
    dir.normalize(); dir.applyQuaternion(camera.quaternion);
    rig.position.addScaledVector(dir, speed*dt);
  }
}

// --- Joysticks Mobile ---
function makeJoystick(el){
  const stick = {x:0,y:0};
  let active=false;
  function setPos(clientX,clientY){
    const rect=el.getBoundingClientRect();
    const dx=(clientX-rect.left-rect.width/2)/(rect.width/2);
    const dy=(clientY-rect.top-rect.height/2)/(rect.height/2);
    stick.x=Math.max(-1,Math.min(1,dx));
    stick.y=Math.max(-1,Math.min(1,dy));
  }
  el.addEventListener("touchstart",e=>{active=true;setPos(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
  el.addEventListener("touchmove",e=>{if(active)setPos(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
  el.addEventListener("touchend",()=>{active=false;stick.x=0;stick.y=0;});
  return stick;
}
const leftStick = makeJoystick(document.getElementById("leftJoystick"));
const rightStick = makeJoystick(document.getElementById("rightJoystick"));

let lastTouches=0;
window.addEventListener("touchstart",e=>{
  if(e.touches.length===2){autoLevel(true);}
},{passive:false});

function updateMobile(dt){
  const DEAD=0.12;
  const lx=Math.abs(leftStick.x)>DEAD?leftStick.x:0;
  const ly=Math.abs(leftStick.y)>DEAD?leftStick.y:0;
  const rx=Math.abs(rightStick.x)>DEAD?rightStick.x:0;
  const ry=Math.abs(rightStick.y)>DEAD?rightStick.y:0;

  if(lx||ly){
    const forward=tmpVec3.set(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
    const right=tmpVec3.set(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
    rig.position.addScaledVector(forward, -ly*moveSpeed*dt);
    rig.position.addScaledVector(right, lx*moveSpeed*dt);
  }

  if(rx||ry){
    yaw -= rx * turnSpeed * dt * 2.5;
    pitch -= ry * turnSpeed * dt * 2.5;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
}

// Loop
renderer.setAnimationLoop(()=>{
  const dt=1/72;

  // VR sticks
  if (leftGamepad && leftGamepad.axes.length>=2){
    const lx=leftGamepad.axes[0], ly=leftGamepad.axes[1];
    const forward=tmpVec3.set(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
    const right=tmpVec3.set(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
    rig.position.addScaledVector(forward, -ly*moveSpeed*dt);
    rig.position.addScaledVector(right, lx*moveSpeed*dt);
  }
  if (rightGamepad && rightGamepad.axes.length>=2){
    const rx = rightGamepad.axes[2]!==undefined?rightGamepad.axes[2]:rightGamepad.axes[0];
    rig.rotateOnAxis(up, rx*turnSpeed*dt);
  }

  updateKeyboard(dt);
  updateMobile(dt);

  // Forzar horizonte recto
  autoLevel(false);

  renderer.render(scene, camera);
});
