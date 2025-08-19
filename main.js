console.log("Three.js cargado");
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ---------- Helpers: Mobile detection & Virtual Joystick ----------
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const joyL = document.getElementById('joyL');
const joyR = document.getElementById('joyR');
const dbg = document.getElementById('dbg');
if (isTouch) {
  joyL.style.display = 'block';
  joyR.style.display = 'block';
  dbg.style.display = 'block';
}

function rect(el){ return el.getBoundingClientRect(); }

function makeJoystick(rootEl) {
  const knob = rootEl.querySelector('.knob');
  const state = { id: null, x:0, y:0 }; // -1..1
  const radius = 70;
  function setKnob(px, py) { knob.style.left = px+'px'; knob.style.top = py+'px'; }
  function toLocal(t) {
    const r = rect(rootEl);
    return { x: t.clientX - r.left, y: t.clientY - r.top, r };
  }
  function handleStart(e) {
    for (const t of e.changedTouches) {
      if (state.id === null) {
        state.id = t.identifier;
        const p = toLocal(t); const dx = p.x - p.r.width/2, dy = p.y - p.r.height/2;
        const nx = Math.max(-1, Math.min(1, dx / radius));
        const ny = Math.max(-1, Math.min(1, dy / radius));
        state.x = nx; state.y = ny;
        setKnob(p.x, p.y);
      }
    }
    e.preventDefault();
  }
  function handleMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === state.id) {
        const p = toLocal(t);
        const dx = p.x - p.r.width/2, dy = p.y - p.r.height/2;
        const len = Math.hypot(dx,dy) || 1;
        const clamped = Math.min(len, radius);
        const nx = dx / (radius||1), ny = dy / (radius||1);
        state.x = Math.max(-1, Math.min(1, nx));
        state.y = Math.max(-1, Math.min(1, ny));
        const kx = p.r.width/2 + (dx===0?0:dx * (clamped/len));
        const ky = p.r.height/2 + (dy===0?0:dy * (clamped/len));
        setKnob(kx, ky);
      }
    }
    e.preventDefault();
  }
  function handleEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === state.id) {
        state.id = null; state.x = 0; state.y = 0; setKnob('50%', '50%');
      }
    }
    e.preventDefault();
  }
  rootEl.addEventListener('touchstart', handleStart, {passive:false});
  rootEl.addEventListener('touchmove', handleMove, {passive:false});
  rootEl.addEventListener('touchend', handleEnd, {passive:false});
  rootEl.addEventListener('touchcancel', handleEnd, {passive:false});
  return state;
}
const joyStateL = isTouch ? makeJoystick(joyL) : {x:0,y:0};
const joyStateR = isTouch ? makeJoystick(joyR) : {x:0,y:0};

// Area de canvas para detectar "swipe mirada" cuando no se toca un joystick
const appEl = document.getElementById('app');
let lookTouchId = null, lastLookX = 0, lastLookY = 0;
function touchOnJoysticks(t){
  return (t.clientX >= rect(joyL).left && t.clientX <= rect(joyL).right && t.clientY >= rect(joyL).top && t.clientY <= rect(joyL).bottom) ||
         (t.clientX >= rect(joyR).left && t.clientX <= rect(joyR).right && t.clientY >= rect(joyR).top && t.clientY <= rect(joyR).bottom);
}
appEl.addEventListener('touchstart', (e)=>{
  if (!isTouch) return;
  for (const t of e.changedTouches){
    if (!touchOnJoysticks(t) && lookTouchId === null){
      lookTouchId = t.identifier; lastLookX = t.clientX; lastLookY = t.clientY;
    }
  }
}, {passive:false});
appEl.addEventListener('touchmove', (e)=>{
  if (!isTouch || lookTouchId === null) return;
  for (const t of e.changedTouches){
    if (t.identifier === lookTouchId){
      const dx = t.clientX - lastLookX;
      const dy = t.clientY - lastLookY;
      lastLookX = t.clientX; lastLookY = t.clientY;
      yaw -= dx * 0.0025; // sensibilidad swipe
      pitch -= dy * 0.0020;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      e.preventDefault();
    }
  }
}, {passive:false});
appEl.addEventListener('touchend', (e)=>{
  for (const t of e.changedTouches){
    if (t.identifier === lookTouchId) lookTouchId = null;
  }
}, {passive:false});

// ----- Render y escena -----
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
document.getElementById('app').appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// UI: exposición y linterna
const expo = document.getElementById('expo');
const expoVal = document.getElementById('expoVal');
const lampState = document.getElementById('lampState');
expo.addEventListener('input', ()=>{ renderer.toneMappingExposure = parseFloat(expo.value); expoVal.textContent = expo.value; });

// Rig + cámara
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 4000);
const rig = new THREE.Group();
rig.position.set(0, 0, -4);
rig.add(camera);
scene.add(rig);

// Estrellas
function addStarfield(count=5000, radius=1800) {
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

// Luces
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(20,30,-10); scene.add(dir);

// Linterna
const headlamp = new THREE.SpotLight(0xffffff, 2.2, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0, 0, 0); camera.add(headlamp); camera.add(headlamp.target);
headlamp.target.position.set(0, 0, -1); headlamp.visible = true; lampState.textContent = headlamp.visible ? 'ON' : 'OFF';
window.addEventListener('keydown', (e)=>{ if (e.code === 'KeyL') { headlamp.visible = !headlamp.visible; lampState.textContent = headlamp.visible ? 'ON' : 'OFF'; } });

// Modelo
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root = gltf.scene;
  root.traverse(o=>{ if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.emissive) { o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity || 0, 0.25); } } });
  root.position.set(0,0,-5); root.scale.set(1,1,1);
  scene.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

// Controladores XR
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
rig.add(controller1); rig.add(controller2);
const controllerModelFactory = new XRControllerModelFactory();
const controllerGrip1 = renderer.xr.getControllerGrip(0); controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1)); rig.add(controllerGrip1);
const controllerGrip2 = renderer.xr.getControllerGrip(1); controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2)); rig.add(controllerGrip2);

// Sable
const saber = new THREE.Group();
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.2,16), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 }));
hilt.position.y = 0.1; saber.add(hilt);
const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,1.0,16), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x770000, emissiveIntensity: 10.0 }));
blade.position.y = 0.6; saber.add(blade);
const bladeLight = new THREE.PointLight(0xff3333, 2.8, 7.0, 2.0); bladeLight.position.set(0,0.6,0); saber.add(bladeLight);
saber.rotation.x = -Math.PI / 2; controllerGrip2.add(saber);

// Teleport (igual que antes)
const teleportRay = new THREE.Raycaster();
const lineMat = new THREE.LineBasicMaterial({ color: 0x66ccff });
const lineGeo = new THREE.BufferGeometry().setFromPoints([ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1) ]);
const rayLine = new THREE.Line(lineGeo, lineMat); rayLine.frustumCulled = false; controller2.add(rayLine);
const targetMarker = new THREE.Mesh(new THREE.RingGeometry(0.25,0.3,32), new THREE.MeshBasicMaterial({ color: 0x66ccff, side: THREE.DoubleSide }));
targetMarker.rotation.x = -Math.PI/2; targetMarker.visible = false; scene.add(targetMarker);
let teleportHit = null;
function updateTeleportRay(){
  const origin = new THREE.Vector3(); const direction = new THREE.Vector3(0,0,-1);
  controller2.getWorldPosition(origin); direction.applyQuaternion(controller2.quaternion).normalize();
  teleportRay.set(origin, direction);
  const hits = teleportRay.intersectObjects(scene.children, true).filter(i=>i.object.visible && i.distance<15);
  if (hits.length){ const h = hits[0]; teleportHit = h.point; targetMarker.position.copy(teleportHit); targetMarker.visible = true; const localEnd = controller2.worldToLocal(h.point.clone()); rayLine.geometry.setFromPoints([ new THREE.Vector3(0,0,0), localEnd ]); }
  else { teleportHit = null; targetMarker.visible = false; rayLine.geometry.setFromPoints([ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1) ]); }
}
controller2.addEventListener('selectstart', ()=>{ if (teleportHit) rig.position.set(teleportHit.x, rig.position.y, teleportHit.z); });

// Movement (VR sticks)
let leftGamepad = null, rightGamepad = null;
const tmpVec3 = new THREE.Vector3();
renderer.xr.addEventListener('sessionstart', ()=>{
  const session = renderer.xr.getSession();
  session.addEventListener('inputsourceschange', ()=>{
    leftGamepad = null; rightGamepad = null;
    for (const s of session.inputSources){ if (s && s.gamepad){ if (s.handedness==='left') leftGamepad=s.gamepad; if (s.handedness==='right') rightGamepad=s.gamepad; } }
  });
});

const moveSpeed = 2.0;
const turnSpeed = 1.0;

// Desktop keyboard/mouse
let keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);
let yaw = 0, pitch = 0;
document.addEventListener('mousemove', e => {
  if (!isTouch && document.pointerLockElement === renderer.domElement) {
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
});
renderer.domElement.addEventListener('click', ()=>{ if (!isTouch) renderer.domElement.requestPointerLock(); });

function updateKeyboard(dt){
  if (isTouch) return;
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

// Mobile: joysticks + swipe look
function updateMobile(dt){
  if (!isTouch) return;
  // izquierda: mover
  const mx = joyStateL.x, my = joyStateL.y;
  if (mx || my){
    const forward = tmpVec3.set(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
    const right = tmpVec3.set(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
    rig.position.addScaledVector(forward, -my * moveSpeed * dt * 1.3);
    rig.position.addScaledVector(right,  mx * moveSpeed * dt * 1.3);
  }
  // derecha: mirar (además del swipe en pantalla)
  if (joyStateR.x || joyStateR.y){
    yaw -= joyStateR.x * 1.8 * dt;
    pitch -= joyStateR.y * 1.4 * dt;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }
}

// Minimap
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
function drawMinimap(){
  const w = mini.width, h = mini.height;
  mctx.clearRect(0,0,w,h);
  mctx.fillStyle = 'rgba(0,0,0,0.35)'; mctx.fillRect(0,0,w,h);
  mctx.strokeStyle = 'rgba(255,255,255,0.15)'; mctx.strokeRect(0.5,0.5,w-1,h-1);
  const cx = w/2, cy = h/2;
  mctx.save(); mctx.translate(cx, cy);
  const heading = -rig.rotation.y;
  mctx.rotate(heading);
  mctx.fillStyle = '#8cf';
  mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(6, 8); mctx.lineTo(-6, 8); mctx.closePath(); mctx.fill();
  mctx.restore();
}

// Loop
let lastTime = performance.now();
renderer.setAnimationLoop(()=>{
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;

  updateTeleportRay();

  if (leftGamepad && leftGamepad.axes.length>=2){
    const lx=leftGamepad.axes[0], ly=leftGamepad.axes[1];
    const forward=tmpVec3.set(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
    const right=tmpVec3.set(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
    rig.position.addScaledVector(forward, -ly*moveSpeed*dt);
    rig.position.addScaledVector(right, lx*moveSpeed*dt);
  }
  if (rightGamepad && rightGamepad.axes.length>=2){
    const rx = rightGamepad.axes[2]!==undefined?rightGamepad.axes[2]:rightGamepad.axes[0];
    rig.rotateOnAxis(new THREE.Vector3(0,1,0), rx*turnSpeed*dt*0.5);
  }

  updateKeyboard(dt);
  updateMobile(dt);

  // debug
  if (isTouch){
    dbg.textContent = `L: (${joyStateL.x.toFixed(2)}, ${joyStateL.y.toFixed(2)})  R: (${joyStateR.x.toFixed(2)}, ${joyStateR.y.toFixed(2)})`;
  }

  renderer.render(scene, camera);
  drawMinimap();
});

// Resize
function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
