console.log("Three.js cargado");

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ----------------- escena / renderer -----------------
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

// ----------------- cámara / rig con pivotes -----------------
// rig (posición), yawPivot (giro Y), pitchPivot (giro X), cámara (sin roll)
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 4000);
camera.up.set(0, 1, 0);
camera.rotation.order = 'YXZ';

const rig = new THREE.Group();            // traslación
rig.position.set(0, 0, -4);

const yawPivot = new THREE.Object3D();    // yaw (Y)
const pitchPivot = new THREE.Object3D();  // pitch (X)

rig.add(yawPivot);
yawPivot.add(pitchPivot);
pitchPivot.add(camera);

scene.add(rig);

// ----------------- estrellas y luces -----------------
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
  const mat=new THREE.PointsMaterial({ size:1.2, sizeAttenuation:true, color:0xffffff });
  const stars=new THREE.Points(geo,mat); stars.frustumCulled=false; scene.add(stars);
}
addStarfield();

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const hemi = new THREE.HemisphereLight(0xbbccee, 0x101018, 1.0); scene.add(hemi);

// linterna
const headlamp = new THREE.SpotLight(0xffffff, 2.2, 25, Math.PI/6, 0.25, 2.0);
headlamp.position.set(0,0,0);
camera.add(headlamp); camera.add(headlamp.target);
headlamp.target.position.set(0,0,-1);

// ----------------- modelo -----------------
const loader = new GLTFLoader();
loader.load('./assets/falcon.glb', (gltf)=>{
  const root = gltf.scene;
  root.traverse(o=>{
    if (o.isMesh && o.material && o.material.emissive) {
      o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity||0, 0.25);
    }
  });
  root.position.set(0,0,-5);
  scene.add(root);
}, undefined, (err)=>console.warn('No se pudo cargar falcon.glb', err));

// ----------------- XR controllers (sin cambios) -----------------
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
rig.add(controller1); rig.add(controller2);

const controllerModelFactory = new XRControllerModelFactory();
const controllerGrip1 = renderer.xr.getControllerGrip(0);
controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1)); rig.add(controllerGrip1);
const controllerGrip2 = renderer.xr.getControllerGrip(1);
controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2)); rig.add(controllerGrip2);

// sable
const saber = new THREE.Group();
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.2,16), new THREE.MeshStandardMaterial({ color: 0x333, metalness:0.8, roughness:0.2 }));
hilt.position.y=0.1; saber.add(hilt);
const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,1.0,16), new THREE.MeshStandardMaterial({ color:0xff0000, emissive:0x770000, emissiveIntensity:10.0 }));
blade.position.y=0.6; saber.add(blade);
const bladeLight = new THREE.PointLight(0xff3333, 2.8, 7.0, 2.0); bladeLight.position.set(0,0.6,0); saber.add(bladeLight);
saber.rotation.x = -Math.PI/2; controllerGrip2.add(saber);

// ----------------- mouse look: yaw en yawPivot, pitch en pitchPivot -----------------
let pitch = 0;
const SENS_YAW = 0.002;
const SENS_PITCH = 0.002;

document.addEventListener('mousemove', (e)=>{
  if (!renderer.xr.isPresenting && document.pointerLockElement === renderer.domElement) {
    // yaw → giro del mundo
    yawPivot.rotation.y -= e.movementX * SENS_YAW;

    // pitch → solo cámara (a través del pivot X)
    pitch -= e.movementY * SENS_PITCH;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    pitchPivot.rotation.x = pitch;

    // aseguramos horizonte: NUNCA modificar .z
    yawPivot.rotation.z = 0;
    pitchPivot.rotation.z = 0;
    camera.rotation.z = 0;
  }
});
renderer.domElement.addEventListener('click', ()=>{
  if (!renderer.xr.isPresenting) renderer.domElement.requestPointerLock();
});

// ----------------- teclado (W/S adelante/atrás, A/D strafe) -----------------
let keys = {};
document.addEventListener('keydown', e=> keys[e.code] = true);
document.addEventListener('keyup',   e=> keys[e.code] = false);

function moveForward(dist){
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(yawPivot.quaternion);
  fwd.y = 0; fwd.normalize();
  rig.position.addScaledVector(fwd, dist);
}
function strafeRight(dist){
  const right = new THREE.Vector3(1,0,0).applyQuaternion(yawPivot.quaternion);
  right.y = 0; right.normalize();
  rig.position.addScaledVector(right, dist);
}
function updateKeyboard(dt){
  const speed = 3.0;
  if (keys['KeyW']) moveForward( speed*dt);
  if (keys['KeyS']) moveForward(-speed*dt);
  if (keys['KeyA']) strafeRight(-speed*dt);
  if (keys['KeyD']) strafeRight( speed*dt);
}

// ----------------- resize -----------------
function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ----------------- loop -----------------
renderer.setAnimationLoop(()=>{
  const dt = 1/72;

  // horizonte fijo: ningún roll en la cadena
  yawPivot.rotation.z = 0;
  pitchPivot.rotation.z = 0;
  camera.rotation.z = 0;

  updateKeyboard(dt);
  renderer.render(scene, camera);
});
