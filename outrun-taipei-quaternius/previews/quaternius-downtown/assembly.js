// P4: standalone, opt-in architectural facade assembly. No gameplay imports.
import * as THREE from 'three';
import {GLTFLoader} from '../../assets/vendor/three-r149/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from '../../assets/vendor/three-r149/jsm/controls/OrbitControls.js';
import {decideFacadeLod,FACADE_LOD_THRESHOLDS} from './lod-policy.mjs';
import {createTaipeiStreetfrontArtist} from './taipei-streetfront-renderer.mjs';

const get = id => document.getElementById(id);
const set = (id,value) => {get(id).textContent=String(value);};
const baseURL = '../../assets/third_party/quaternius-downtown/';
const names = Object.freeze({
 brickWindow:'Brick_RedWhite_DoubleWindow',
 brickWall:'Brick_Plain_1',
 metalWindow:'Metal_Window',
 door:'DoorFrame_Trim'
});
const models = Object.create(null);
const geometryTriangles = Object.create(null);
const loader = new GLTFLoader();

function load(name){
 return new Promise((resolve,reject)=>loader.load(baseURL+name+'.gltf',resolve,undefined,reject));
}
function countTriangles(root){
 let n=0;
 root.traverse(node=>{
  if(!node.isMesh)return;
  const g=node.geometry;
  n += Math.floor((g.index?.count ?? g.attributes.position?.count ?? 0)/3);
 });
 return n;
}
const canvas=get('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x263e51);
const camera=new THREE.PerspectiveCamera(52,1,0.1,150);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.maxPolarAngle=Math.PI*.87;
const hemi=new THREE.HemisphereLight(0xe7efff,0x405362,2.1);
scene.add(hemi);
const key=new THREE.DirectionalLight(0xffe3c6,2.0);
key.position.set(-6,9,8);
scene.add(key);
const fill=new THREE.DirectionalLight(0xc6e1ff,0.85);
fill.position.set(7,5,-4);
scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(45,45),
 new THREE.MeshStandardMaterial({color:0x33424b,roughness:1}));
floor.rotation.x=-Math.PI/2;
floor.position.y=-.03;
scene.add(floor);
const grid=new THREE.GridHelper(45,45,0x5f8192,0x3e586b);
scene.add(grid);

let facade=null;
let nearFacade=null;
let farFacade=null;
let currentLod='near';
let instances=0;
let triangles=0;
let farTriangles=0;
let night=false;
function resetCamera(){
 camera.position.set(12.6,8.4,15.4);
 controls.target.set(0,3.2,-.3);
 controls.update();
}
resetCamera();
function cloneMod(id,x,y,z=0){
 const name=names[id];
 const template=models[name];
 if(!template)throw Error('Missing module '+name);
 const piece=template.clone(true);
 piece.position.set(x,y,z);
 nearFacade.add(piece);
 instances++;
 triangles+=geometryTriangles[name];
}
const mat={
 brick:new THREE.MeshStandardMaterial({color:0x8e8274,metalness:.04,roughness:.91}),
 metal:new THREE.MeshStandardMaterial({color:0x788a96,metalness:.21,roughness:.73}),
 trim:new THREE.MeshStandardMaterial({color:0x5c676c,roughness:.78}),
 windows:new THREE.MeshStandardMaterial({color:0x263e50,metalness:.25,roughness:.24}),
 entry:new THREE.MeshStandardMaterial({color:0x303740,roughness:.64})
};
// One shared box geometry across both LODs and style switches.
const unitBox=new THREE.BoxGeometry(1,1,1);
function box(parent,scale,position,material){
 const mesh=new THREE.Mesh(unitBox,material);
 mesh.scale.set(...scale);mesh.position.set(...position);
 parent.add(mesh);return mesh;
}
const taipeiArtist=createTaipeiStreetfrontArtist(THREE,box);
function updateLod(){
 if(!nearFacade||!farFacade)return;
 const distance=camera.position.distanceTo(controls.target);
 currentLod=decideFacadeLod({
  mode:get('lod-mode').value,distance,previous:currentLod,
  enterFar:FACADE_LOD_THRESHOLDS.enterFar,exitFar:FACADE_LOD_THRESHOLDS.exitFar
 });
 nearFacade.visible=currentLod==='near';
 farFacade.visible=currentLod==='far';
 set('lod-state',currentLod==='near'?'完整模組':'低面數代理');
 set('distance',distance.toFixed(1)+' m');
 set('visible-tris',(currentLod==='near'?triangles:farTriangles).toLocaleString());
}
function rebuild(style){
 if(facade)scene.remove(facade);
 facade=new THREE.Group();
 facade.name='P4_VisualOnlyFacade';
 nearFacade=new THREE.Group();
 farFacade=new THREE.Group();
 facade.add(nearFacade,farFacade);
 scene.add(facade);
 instances=0;triangles=0;farTriangles=0;
 const isMetal=style==='metal',isBrick=style==='brick';
 const left=isMetal?'metalWindow':'brickWindow';
 const right=isBrick?'brickWindow':'metalWindow';
 const wallMaterial=isMetal?mat.metal:mat.brick;
 // Full Quaternius detail: the existing facade layout remains unchanged.
 box(nearFacade,[10.35,6.2,2.1],[0,3.1,-1.46],wallMaterial);
 box(nearFacade,[10.65,.28,2.5],[0,6.32,-1.33],mat.trim);
 box(nearFacade,[2,.12,.6],[0,.06,.32],mat.trim);
 triangles+=36;
 cloneMod(left,-3,0);
 cloneMod('door',0,0);
 cloneMod(right,3,0);
 cloneMod(left,-3,3);
 for(let y=3;y<6;y++)cloneMod('brickWall',0,y);
 cloneMod(right,3,3);
 // Cheap visual-only proxy: same volume and windows but no GLTF draw calls.
 box(farFacade,[10.35,6.2,2.1],[0,3.1,-1.46],wallMaterial);
 box(farFacade,[10.65,.28,2.5],[0,6.32,-1.33],mat.trim);
 box(farFacade,[1.45,2.45,.07],[0,1.25,-.35],mat.entry);
 for(const y of [1.55,4.5])for(const x of [-3,3])
  box(farFacade,[2.9,1.7,.07],[x,y,-.35],mat.windows);
 farTriangles=farFacade.children.length*12; // Seven low-detail cuboids (P6 baseline).
 // P7 original Taipei-inspired frontage is applied only to the isolated preview.
 const extra=taipeiArtist.attach(style,nearFacade,farFacade);
 triangles+=extra.nearTriangles;
 farTriangles+=extra.farTriangles;
 set('taipei-preset',extra.profileLabel);
 set('taipei-shop',extra.shopLabel);
 set('taipei-objects',extra.nearObjects);
 currentLod='near';
 set('instances',instances);
 set('triangles',triangles.toLocaleString());
 set('far-tris',farTriangles.toLocaleString());
 set('status','LOD 樣板已組合 · 完整模組／低面數代理皆為獨立預覽');
 updateLod();
}
function toggleLighting(){
 night=!night;
 scene.background.setHex(night?0x08182b:0x263e51);
 hemi.intensity=night?0.65:2.1;
 key.intensity=night?.4:2.0;
 fill.intensity=night?1.15:.85;
 taipeiArtist.setNight(night);
 get('lighting').setAttribute('aria-pressed',String(night));
 get('lighting').textContent=night?'切換日間照明':'切換夜間照明';
}
get('style').addEventListener('change',e=>{if(facade)rebuild(e.target.value);});
get('reset').addEventListener('click',resetCamera);
get('lod-mode').addEventListener('change',updateLod);
get('lighting').addEventListener('click',toggleLighting);

const frames=[];
function tick(t){
 requestAnimationFrame(tick);
 const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
 const size=renderer.getSize(new THREE.Vector2());
 if(size.x!==w||size.y!==h){
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  set('resolution',w+'×'+h);
 }
 controls.update();
 updateLod();
 renderer.render(scene,camera);
 set('calls',renderer.info.render.calls);
 if(frames.length){
  const d=t-frames[frames.length-1];
  if(d>0&&d<1000){frames.push(t);if(frames.length>91)frames.shift();}
  else {frames.length=0;frames.push(t);}
 }else frames.push(t);
 if(frames.length>10){
  const delta=frames[frames.length-1]-frames[0];
  if(delta>0)set('fps',(1000*(frames.length-1)/delta).toFixed(1));
 }
}
requestAnimationFrame(tick);
try{
 const keys=Object.values(names);
 const files=await Promise.all(keys.map(load));
 for(let i=0;i<keys.length;i++){
  models[keys[i]]=files[i].scene;
  geometryTriangles[keys[i]]=countTriangles(files[i].scene);
  if(!geometryTriangles[keys[i]])throw new Error('Zero triangles '+keys[i]);
 }
 rebuild(get('style').value);
}catch(e){
 console.error('Quaternius facade staging failed',e);
 set('status','素材載入失敗：'+(e?.message||e)+'。請透過 HTTP 伺服器開啟，並檢查資產檔案。');
}
