console.log("Three.js cargado");

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ----- Escena/renderer -----
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
renderer.physicallyCorrectLights = true;
app.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// ----- Rig y cámara -----
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 4000);
const rig = new THREE.Group();
rig.position.set(0, 0, -4);
rig.add(camera);
scene.add(rig);

// ----- Estrellas -----
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

// ----- Luces -----
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0); scene.add(hemi);

// Linterna en cámara
const headlamp = new THREE.SpotLight(0xffffff, 2.2, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0,0,0);
camera.add(headlamp);
camera.add(headlamp.target);
headlamp.target.position.set(0,0,-1);
window.addEventListener('keydown', (e)=>{ if(e.code==='KeyL') headlamp.visible=!headlamp.visible; });

// ----- Modelo GLB -----
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root=gltf.scene;
  root.traverse(o=>{
    if(o.isMesh && o.material && o.material.emissive){
      o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity||0, 0.25);
    }
  });
  root.position.set(0,0,-5);
  scene.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

// ----- Controladores XR -----
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
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.2,16), new THREE.MeshStandardMaterial({ color: 0x333333, metalness:0.8, roughness:0.2 }));
hilt.position.y=0.1; saber.add(hilt);
const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,1.0,16), new THREE.MeshStandardMaterial({ color:0xff0000, emissive:0x770000, emissiveIntensity:10.0 }));
blade.position.y=0.6; saber.add(blade);
const bladeLight = new THREE.PointLight(0xff3333, 2.8, 7.0, 2.0); bladeLight.position.set(0,0.6,0); saber.add(bladeLight);
saber.rotation.x = -Math.PI/2; controllerGrip2.add(saber);

// ======== Utilidades de movimiento ========
// Base de yaw (adelante/derecha en XZ)
const basis = { fwd:new THREE.Vector3(), right:new THREE.Vector3() };
function updateYawBasis(){
  const yaw = rig.rotation.y;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  basis.fwd.set(-sy, 0, -cy).normalize();
  basis.right.set( cy, 0, -sy).normalize();
}
// Nivelar horizonte (quita roll)
function levelHorizon(){
  rig.rotation.z = 0;
}

// ======== PC: teclado/mouse ========
let keys = {};
document.addEventListener('keydown', e=> keys[e.code]=true);
document.addEventListener('keyup',   e=> keys[e.code]=false);
let yaw=0, pitch=0;
document.addEventListener('mousemove', e=>{
  if(document.pointerLockElement === renderer.domElement){
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
});
renderer.domElement.addEventListener('click', ()=> renderer.domElement.requestPointerLock());

function updateKeyboard(dt){
  const speed = 3.0;
  const dir = new THREE.Vector3();
  if(keys['KeyW']) dir.z -= 1;
  if(keys['KeyS']) dir.z += 1;
  if(keys['KeyA']) dir.x -= 1;
  if(keys['KeyD']) dir.x += 1;
  if(dir.lengthSq()>0){
    dir.normalize();
    updateYawBasis();
    rig.position.addScaledVector(basis.fwd,  -dir.z * speed * dt);
    rig.position.addScaledVector(basis.right, dir.x * speed * dt);
  }
}

// ======== Joysticks táctiles ========
const joyL = document.getElementById('joyL');
const joyR = document.getElementById('joyR');
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
if(!isTouch){ joyL.style.display='none'; joyR.style.display='none'; }

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
      if(state.id==null){
        state.id=t.identifier; const s=toState(t.clientX,t.clientY);
        state.x=s.x; state.y=s.y; setKnob(s.knobX,s.knobY);
      }
    }
    e.preventDefault();
  }
  function move(e){
    for(const t of e.changedTouches){
      if(t.identifier===state.id){
        const s=toState(t.clientX,t.clientY);
        state.x=s.x; state.y=s.y; setKnob(s.knobX,s.knobY);
      }
    }
    e.preventDefault();
  }
  function end(e){
    for(const t of e.changedTouches){
      if(t.identifier===state.id){
        state.id=null; state.x=0; state.y=0; setKnob('50%','50%');
      }
    }
    e.preventDefault();
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
  if(!isTouch) return;
  updateYawBasis();
  const SPEED = 2.6;

  // izquierda = mover (y: adelante/atrás, x: strafe)
  if(joyStateL.x || joyStateL.y){
    rig.position.addScaledVector(basis.fwd,  -joyStateL.y * SPEED * dt);
    rig.position.addScaledVector(basis.right, joyStateL.x * SPEED * dt);
  }

  // derecha = mirar (yaw/pitch)
  if(joyStateR.x || joyStateR.y){
    yaw   -= joyStateR.x * 1.8 * dt;
    pitch -= joyStateR.y * 1.4 * dt;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
}

// Dos dedos = nivelar
document.body.addEventListener('touchstart', (e)=>{
  if(e.touches.length===2) levelHorizon();
}, {passive:false});

// Botón nivelar y tecla R
document.getElementById('levelBtn').addEventListener('click', ()=> levelHorizon());
window.addEventListener('keydown', (e)=>{ if(e.code==='KeyR') levelHorizon(); });

// ======== VR gamepads ========
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
const VR_TURN_FACTOR = 1.2;
const VR_TURN_INVERT_X = -1; // poné 1 si preferís lo opuesto

// ======== Loop ========
function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

renderer.setAnimationLoop(()=>{
  const dt = 1/72;

  // VR movimiento
  updateYawBasis();
  if(leftGamepad && leftGamepad.axes.length>=2){
    const lx = leftGamepad.axes[0], ly = leftGamepad.axes[1];
    rig.position.addScaledVector(basis.fwd,  -ly * moveSpeed * dt);
    rig.position.addScaledVector(basis.right, lx * moveSpeed * dt);
  }
  // VR giro con stick derecho (eje X)
  if(rightGamepad && rightGamepad.axes.length>=1){
    const rx = (rightGamepad.axes[0] ?? 0) * VR_TURN_INVERT_X;
    rig.rotateOnAxis(new THREE.Vector3(0,1,0), rx * VR_TURN_FACTOR * turnSpeed * dt);
  }

  updateKeyboard(dt);
  updateMobile(dt);

  // Mantener horizonte recto
  levelHorizon();

  renderer.render(scene, camera);
});
