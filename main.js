console.log("Three.js cargado");

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

/* =====================
   Renderer / Scene
===================== */
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor'); // XR neutral upright
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
renderer.physicallyCorrectLights = true;
app.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

/* =====================
   Camera / Rig
===================== */
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 4000);
camera.up.set(0,1,0);
const rig = new THREE.Group();
rig.position.set(0, 0, -4);
rig.rotation.set(0,0,0);
rig.add(camera);
scene.add(rig);

/* =====================
   Stars
===================== */
function addStarfield(count=4000, radius=1500){
  const pos = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const u=Math.random(), v=Math.random();
    const th=2*Math.PI*u, ph=Math.acos(2*v-1), r=radius*(0.7+0.3*Math.random());
    pos[i*3+0]=r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1]=r*Math.sin(ph)*Math.sin(th);
    pos[i*3+2]=r*Math.cos(ph);
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({size:1.2, sizeAttenuation:true, color:0xffffff});
  const stars=new THREE.Points(geo,mat); stars.frustumCulled=false; scene.add(stars);
}
addStarfield();

/* =====================
   Lights
===================== */
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0); scene.add(hemi);
const headlamp = new THREE.SpotLight(0xffffff, 2.2, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0,0,0);
camera.add(headlamp);
camera.add(headlamp.target);
headlamp.target.position.set(0,0,-1);
window.addEventListener('keydown', (e)=>{ if(e.code==='KeyL') headlamp.visible=!headlamp.visible; });

/* =====================
   Model
===================== */
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root=gltf.scene;
  root.rotation.set(0,0,0);
  root.traverse(o=>{
    if(o.isMesh && o.material && o.material.emissive){
      o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity||0, 0.25);
    }
  });
  root.position.set(0,0,-5);
  scene.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

/* =====================
   XR Controllers
===================== */
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

// Saber prop
const saber = new THREE.Group();
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.2,16), new THREE.MeshStandardMaterial({ color: 0x333333, metalness:0.8, roughness:0.2 }));
hilt.position.y=0.1; saber.add(hilt);
const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,1.0,16), new THREE.MeshStandardMaterial({ color:0xff0000, emissive:0x770000, emissiveIntensity:10.0 }));
blade.position.y=0.6; saber.add(blade);
const bladeLight = new THREE.PointLight(0xff3333, 2.8, 7.0, 2.0); bladeLight.position.set(0,0.6,0); saber.add(bladeLight);
saber.rotation.x = -Math.PI/2; controllerGrip2.add(saber);

/* =====================
   Movement Helpers
===================== */
const basis = { fwd:new THREE.Vector3(), right:new THREE.Vector3() };
function updateYawBasis(){
  // Use rig yaw ONLY (no pitch/roll from camera)
  const yaw = rig.rotation.y;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  basis.fwd.set(-sy, 0, -cy).normalize();  // forward
  basis.right.set( cy, 0, -sy).normalize(); // right
}
function levelHorizonNonXR(){
  // Desktop/Mobile only: zero roll in camera orientation
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  e.z = 0;
  camera.quaternion.setFromEuler(e);
}
function levelWorldXR(){
  // In XR we don't touch the HMD camera; keep world upright
  rig.rotation.z = 0;
  scene.rotation.set(0,0,0);
}

/* =====================
   Desktop Input (WASD + mouse)
===================== */
let keys = {};
document.addEventListener('keydown', e=> keys[e.code]=true);
document.addEventListener('keyup',   e=> keys[e.code]=false);

let yaw=0, pitch=0; // for desktop/mobile look
document.addEventListener('mousemove', e=>{
  if (!renderer.xr.isPresenting && document.pointerLockElement === renderer.domElement) {
    yaw   -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
});
renderer.domElement.addEventListener('click', ()=>{
  if (!renderer.xr.isPresenting) renderer.domElement.requestPointerLock();
});

function updateKeyboard(dt){
  if (renderer.xr.isPresenting) return; // keyboard ignored in XR
  const speed = 3.0;
  updateYawBasis();
  if (keys['KeyW']) rig.position.addScaledVector(basis.fwd,  speed*dt);
  if (keys['KeyS']) rig.position.addScaledVector(basis.fwd, -speed*dt);
  if (keys['KeyA']) rig.position.addScaledVector(basis.right, -speed*dt);
  if (keys['KeyD']) rig.position.addScaledVector(basis.right,  speed*dt);
}

/* =====================
   Mobile Joysticks
===================== */
const joyL = document.getElementById('joyL');
const joyR = document.getElementById('joyR');
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
if(isTouch){ joyL.style.display='block'; joyR.style.display='block'; }

function makeJoystick(rootEl){
  const knob = rootEl.querySelector('.knob');
  const state = { id:null, x:0, y:0 };
  const R=70, DEAD=0.12, AXIS_LOCK=0.6;
  const rect = ()=> rootEl.getBoundingClientRect();
  const clamp01=v=> Math.max(-1, Math.min(1, v));
  const withDead=v=> (Math.abs(v)<DEAD?0:v);

  function setKnob(px,py){ knob.style.left=px+'px'; knob.style.top=py+'px'; }
  function toState(cx,cy){
    const r=rect(); const dx=cx-(r.left+r.width/2); const dy=cy-(r.top+r.height/2);
    const len=Math.hypot(dx,dy)||1; const k=Math.min(len,R)/len;
    let x=clamp01((dx*k)/R), y=clamp01((dy*k)/R);
    x=withDead(x); y=withDead(y);
    if(Math.abs(y) > Math.abs(x)*(1/AXIS_LOCK)) x*=0.3;
    if(Math.abs(x) > Math.abs(y)*(1/AXIS_LOCK)) y*=0.3;
    return { x, y, knobX:r.width/2 + dx*k, knobY:r.height/2 + dy*k };
  }
  function start(e){
    for(const t of e.changedTouches){
      if(state.id==null){ state.id=t.identifier; const s=toState(t.clientX,t.clientY); state.x=s.x; state.y=s.y; setKnob(s.knobX,s.knobY); }
    } e.preventDefault();
  }
  function move(e){
    for(const t of e.changedTouches){
      if(t.identifier===state.id){ const s=toState(t.clientX,t.clientY); state.x=s.x; state.y=s.y; setKnob(s.knobX,s.knobY); }
    } e.preventDefault();
  }
  function end(e){
    for(const t of e.changedTouches){
      if(t.identifier===state.id){ state.id=null; state.x=0; state.y=0; setKnob('50%','50%'); }
    } e.preventDefault();
  }
  rootEl.addEventListener('touchstart', start, {passive:false});
  rootEl.addEventListener('touchmove',  move,  {passive:false});
  rootEl.addEventListener('touchend',   end,   {passive:false});
  rootEl.addEventListener('touchcancel',end,   {passive:false});
  return state;
}
const joyStateL = makeJoystick(joyL);
const joyStateR = makeJoystick(joyR);

function updateMobile(dt){
  if(!isTouch || renderer.xr.isPresenting) return;
  updateYawBasis();
  const SPEED = 2.6;

  // Left: move (y = forward/back, x = strafe)
  if(joyStateL.x || joyStateL.y){
    rig.position.addScaledVector(basis.fwd,   -joyStateL.y * SPEED * dt); // up = forward
    rig.position.addScaledVector(basis.right,  joyStateL.x * SPEED * dt);
  }
  // Right: look
  if(joyStateR.x || joyStateR.y){
    yaw   -= joyStateR.x * 1.8 * dt;
    pitch -= joyStateR.y * 1.4 * dt;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
}
// Two-finger tap → level (mobile)
document.body.addEventListener('touchstart', (e)=>{
  if(e.touches.length===2 && !renderer.xr.isPresenting){
    levelHorizonNonXR();
  }
}, {passive:false});
// Button + R key
document.getElementById('levelBtn').addEventListener('click', ()=>{
  if (renderer.xr.isPresenting) levelWorldXR(); else levelHorizonNonXR();
});
window.addEventListener('keydown', (e)=>{
  if(e.code==='KeyR'){ if (renderer.xr.isPresenting) levelWorldXR(); else levelHorizonNonXR(); }
});

/* =====================
   XR Gamepads (Quest)
===================== */
let leftGamepad=null, rightGamepad=null;
renderer.xr.addEventListener('sessionstart', ()=>{
  const session=renderer.xr.getSession();
  session.addEventListener('inputsourceschange', ()=>{
    leftGamepad=rightGamepad=null;
    for(const s of session.inputSources){
      if(s && s.gamepad){
        if(s.handedness==='left')  leftGamepad=s.gamepad;
        if(s.handedness==='right') rightGamepad=s.gamepad;
      }
    }
  });
});

const moveSpeed = 2.0;
const turnSpeed = 1.2;
const VR_TURN_FACTOR = 1.6; // more noticeable
const VR_TURN_INVERT_X = -1; // set 1 if you want opposite direction

/* =====================
   Loop
===================== */
function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

renderer.setAnimationLoop(()=>{
  const dt = 1/72;

  // VR movement
  updateYawBasis();
  if (renderer.xr.isPresenting){
    if(leftGamepad && leftGamepad.axes.length>=2){
      const lx = leftGamepad.axes[0]; // strafe
      const ly = leftGamepad.axes[1]; // forward/back
      rig.position.addScaledVector(basis.fwd,  -ly * moveSpeed * dt);
      rig.position.addScaledVector(basis.right, lx  * moveSpeed * dt);
    }
    if(rightGamepad && rightGamepad.axes.length>=1){
      const rx = (rightGamepad.axes[0] ?? 0) * VR_TURN_INVERT_X;
      rig.rotateOnAxis(new THREE.Vector3(0,1,0), rx * VR_TURN_FACTOR * turnSpeed * dt);
    }
    levelWorldXR();
  } else {
    // Desktop / Mobile
    updateKeyboard(dt);
    updateMobile(dt);
    levelHorizonNonXR();
  }

  renderer.render(scene, camera);
});
