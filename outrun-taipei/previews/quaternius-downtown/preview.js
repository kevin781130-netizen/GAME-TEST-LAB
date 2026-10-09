// Quaternius P2 asset preview: isolated from route and gameplay engine.
import { GLTFLoader } from '../../assets/vendor/three-r149/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '../../assets/vendor/three-r149/jsm/controls/OrbitControls.js';
import * as THREE from 'three';

const rootPath = '../../assets/third_party/quaternius-downtown/';
const modelNames = new Set(['Brick_RedWhite_DoubleWindow','Brick_Plain_1','Metal_Window','DoorFrame_Trim']);
const $ = id => document.getElementById(id);
const status = msg => { $('status').textContent = msg; };
const canvas = $('view');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a293c);
const camera = new THREE.PerspectiveCamera(48, 1, 0.02, 300);
camera.position.set(5, 4, 7);
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const controls = new OrbitControls(camera,canvas);
controls.enableDamping = true;
controls.enablePan = true;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.2;
controls.maxPolarAngle = Math.PI * 0.94;
const ambient = new THREE.HemisphereLight(0xe6f1ff,0x435368,2.4);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xffe2bf,2.8);
key.position.set(-4,9,5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xb9d9ff,1.2);
fill.position.set(7,4,-6);
scene.add(fill);
const grid = new THREE.GridHelper(18, 18, 0x64758b,0x45566b);
grid.position.y = -0.008;
scene.add(grid);
let current = null;
let loadGeneration = 0;
let frameDistance = 7;
let frameTarget = new THREE.Vector3(0, 1.5, 0);
let night = false;
// Read-only diagnostics for the isolated Chromium acceptance harness.
Object.defineProperty(window,'__quaterniusPreviewProbe',{configurable:false,value:()=>{
  if(!current)return {loaded:false,textures:[],meshCount:0};
  const seen=new Set(),textures=[];
  let meshCount=0;
  current.traverse(node=>{
    if(!node.isMesh)return;
    meshCount++;
    for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
      if(!mat)continue;
      for(const prop of ['map','metalnessMap','roughnessMap','normalMap']){
        const texture=mat[prop];
        if(!texture || seen.has(texture.uuid))continue;
        seen.add(texture.uuid);
        const img=texture.image||texture.source?.data;
        textures.push({width:img?.width||0,height:img?.height||0,ready:!!(img?.width&&img?.height),kind:prop});
      }
    }
  });
  return {loaded:true,meshCount,textures,model:$('asset').value};
}});
function frameModel() {
  camera.position.set(frameTarget.x + frameDistance*.9,frameTarget.y+frameDistance*.58,frameTarget.z+frameDistance*.94);
  controls.target.copy(frameTarget);
  camera.lookAt(controls.target);
  controls.update();
}
function metrics(model, originalSize) {
  let meshCount = 0, triangles = 0;
  const materials = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    meshCount++;
    const g = node.geometry;
    const drawN = g.index ? g.index.count : (g.attributes.position?.count || 0);
    triangles += Math.floor(drawN / 3);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => { if (m) materials.add(m.uuid); });
  });
  $('meshes').textContent = meshCount.toLocaleString();
  $('tris').textContent = triangles.toLocaleString();
  $('materials').textContent = materials.size.toLocaleString();
  $('bounds').textContent = [originalSize.x,originalSize.y,originalSize.z].map(n=>n.toFixed(2)).join(' × ');
}
function disposePreview(model) {
  // Meshes are owned by this standalone loaded scene; never touch game meshes.
  if (!model) return;
  scene.remove(model);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(node=>{
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const m of (Array.isArray(node.material)?node.material:[node.material])){
      if (!m) continue;
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g=>g.dispose());
  textures.forEach(t=>t.dispose());
  materials.forEach(m=>m.dispose());
}
const loader = new GLTFLoader();
function loadModel(name) {
  if (!modelNames.has(name)) { status('不支援的素材名稱'); return; }
  const generation = ++loadGeneration;
  status('讀取中：'+name+' …');
  loader.load(rootPath + name + '.gltf', gltf => {
    if (generation!==loadGeneration) {disposePreview(gltf.scene);return;}
    const model=gltf.scene;
    model.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(model);
    if (bbox.isEmpty()) {disposePreview(model);status('模型不包含可顯示的幾何');return;}
    const size = bbox.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length()<=0) {
      disposePreview(model);status('模型尺寸無效');return;
    }
    const scale = 6 / Math.max(size.x,size.y,size.z);
    const center = bbox.getCenter(new THREE.Vector3());
    model.scale.multiplyScalar(scale);
    model.position.set(-center.x*scale,-bbox.min.y*scale,-center.z*scale);
    model.updateMatrixWorld(true);
    disposePreview(current);
    current=model;scene.add(model);
    frameTarget = new THREE.Vector3(0, size.y*scale*.43, 0);
    frameDistance = 10;
    frameModel();
    metrics(model,size);
    status('已載入：'+name+' · 可旋轉與縮放（僅預覽，不改遊戲）');
  }, undefined, error => {
    if (generation!==loadGeneration) return;
    status('載入失敗：'+(error?.message || error) +'。請使用本機 HTTP 伺服器，不要用 file:// 開啟。');
  });
}
$('asset').addEventListener('change', e => loadModel(e.target.value));
$('reset').addEventListener('click', frameModel);
$('rotate').addEventListener('click',()=>{
  controls.autoRotate = !controls.autoRotate;
  $('rotate').setAttribute('aria-pressed',String(controls.autoRotate));
  $('rotate').textContent = '自動旋轉：'+(controls.autoRotate?'開啟':'關閉');
});
$('light').addEventListener('click',()=>{
  night=!night;
  ambient.intensity=night?0.75:2.4;
  key.intensity=night?0.55:2.8;
  fill.intensity=night?1.0:1.2;
  scene.background.setHex(night?0x071223:0x1a293c);
  $('light').setAttribute('aria-pressed',String(night));
  $('light').textContent='燈光：'+(night?'夜間':'日間');
});
function loop() {
  requestAnimationFrame(loop);
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const buffer=renderer.getSize(new THREE.Vector2());
  if (buffer.x!==w||buffer.y!==h) {
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  controls.update();
  renderer.render(scene,camera);
  $('drawcalls').textContent = renderer.info.render.calls.toLocaleString();
}
loadModel($('asset').value);
loop();
