// Quaternius road-racing art LAB (isolated V56.1A copy only).
// Full THREE scene, true CC0 glTF modules, derived road edge. Never touches driving state.
import {SHOP_SAMPLES} from './previews/quaternius-downtown/streetblock-plan.mjs';
import {buildTaipeiStreetfrontPlan} from './previews/quaternius-downtown/taipei-streetfront.mjs';
import {makeSnappedQuaterniusFacade,verifySeamlessFacade} from './previews/quaternius-downtown/quaternius-facade-fit.mjs';
import {createStreetblockSigns} from './previews/quaternius-downtown/streetblock-signs.mjs';
import {RACE_ART_SLOTS,MAX_QUATERNIUS_BUILDINGS,MAX_NEAR_BUILDINGS,deriveVisualRoadside,facadeYaw,visualLod} from './quaternius-roadside-plan.mjs';

const ROOT='./assets/third_party/quaternius-downtown/';
const SLOTS=RACE_ART_SLOTS;
const controls={
 button:document.getElementById('quaternius-art-toggle'),
 text:document.getElementById('quaternius-art-status'),
 back:document.getElementById('quaternius-back')
};
const write=message=>{if(controls.text&&controls.text.textContent!==message)controls.text.textContent=message;};
let desired=false,loading=null,addon=null,lastFrame=0;
function ui(){
 if(controls.button){
  controls.button.setAttribute('aria-pressed',String(desired));
  controls.button.textContent=desired?'新街屋：開啟（點擊關閉）':'新街屋：關閉（點擊開啟）';
 }
}
function artRandom(callback){
 // Three's visual UUIDs must not consume the gameplay RNG during geometry setup.
 const saved=Math.random;let state=0x14aaf1c0;
 Math.random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
 try{return callback();}finally{Math.random=saved;}
}
async function waitBridge(){
 if(window.__quaterniusRaceBridge?.install)return window.__quaterniusRaceBridge;
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{window.removeEventListener('quaternius-race-ready',onReady);
   reject(new Error('3D 賽車場景未就緒'));},25000);
  function onReady(){if(window.__quaterniusRaceBridge?.install){clearTimeout(timeout);
   window.removeEventListener('quaternius-race-ready',onReady);resolve();}}
  window.addEventListener('quaternius-race-ready',onReady);
  onReady();
 });
 return window.__quaterniusRaceBridge;
}
function makeShopArt(THREE,gltf,signs,shop){
 const facade=buildTaipeiStreetfrontPlan(shop.style);
 const fit=makeSnappedQuaterniusFacade(shop.style);
 if(!verifySeamlessFacade(fit).passed)throw new Error('GLTF seam fit failed '+shop.id);
 const parent=new THREE.Group();
 const near=new THREE.Group(),far=new THREE.Group();
 parent.name='Quaternius_VisualOnly_'+shop.id;
 parent.add(near,far);
 const matCache=new Map(),unit=new THREE.BoxGeometry(1,1,1),scratch=new THREE.Object3D();
 const resolveMaterial=key=>{
  if(matCache.has(key))return matCache.get(key);
  const palette=facade.palette;
  const color={
   building:palette.plaster,plaster:palette.plaster,railing:palette.railing,
   signBg:palette.signBg,awning:palette.awning,awningAlt:palette.awningAlt,
   condenser:palette.condenser,accentGlow:palette.accent,
   roof:'#676c71',glass:'#2b4355',door:'#353942'
  }[key]||'#7d8588';
  const material=new THREE.MeshStandardMaterial({color,roughness:key==='glass'?.24:.8,
   metalness:key==='railing'?.35:0,
   emissive:key==='accentGlow'?new THREE.Color(palette.accent):new THREE.Color(0),
   emissiveIntensity:key==='accentGlow'?.28:0});
  matCache.set(key,material);
  return material;
 };
 function batches(group,records){
  const map=new Map();
  for(const record of records){
   const key=record.material;
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(record);
  }
  for(const [key,items] of map){
   const mesh=new THREE.InstancedMesh(unit,resolveMaterial(key),items.length);
   mesh.frustumCulled=false;mesh.name='Quaternius_VisualBatch_'+key;
   items.forEach((entry,i)=>{
    scratch.position.set(...entry.position);scratch.rotation.set(0,0,0);
    scratch.scale.set(...entry.scale);scratch.updateMatrix();
    mesh.setMatrixAt(i,scratch.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
  }
 }
 const box=(scale,position,material)=>({scale,position,material});
 batches(near,[box([10.35,6.2,2.1],[0,3.1,-1.46],'building'),
  box([10.6,.28,2.6],[0,6.32,-1.33],'roof'),...facade.nearBoxes]);
 // Real CC0 glTF meshes with their original triangle geometry and PBR maps.
 const mapping={brickWindow:'Brick_RedWhite_DoubleWindow',brick:'Brick_Plain_1',
  metalWindow:'Metal_Window',door:'DoorFrame_Trim'};
 for(const entry of fit.modules){
  const source=gltf[mapping[entry.kind]];
  const instance=source.clone(true);instance.position.set(entry.x,entry.y,entry.z);
  instance.name='Quaternius_CC0_'+entry.kind;
  near.add(instance);
 }
 batches(far,[
  box([10.35,6.2,2.1],[0,3.1,-1.46],'building'),
  box([10.6,.28,2.6],[0,6.32,-1.33],'roof'),
  box([1.5,2.45,.09],[0,1.25,-.3],'door'),
  box([3.1,1.8,.09],[-3,1.55,-.3],'glass'),
  box([3.1,1.8,.09],[3,1.55,-.3],'glass'),
  box([3.1,1.8,.09],[-3,4.5,-.3],'glass'),
  box([3.1,1.8,.09],[3,4.5,-.3],'glass'),
  ...facade.farBoxes,
  box([5,.045,1.04],[-2.52,2.69,1.05],'awning'),
  box([5,.045,1.04],[2.52,2.69,1.05],'awningAlt')
 ]);
 near.add(signs.makeShopSign(shop,facade.signs));
 far.add(signs.makeShopSign(shop,facade.signs));
 return {parent,near,far,unit,mats:[...matCache.values()],shop};
}
function createAddon(THREE,gltf){
 const signFactory=createStreetblockSigns(THREE,SHOP_SAMPLES,buildTaipeiStreetfrontPlan);
 const models=artRandom(()=>SLOTS.map(slot=>({...slot,
  model:makeShopArt(THREE,gltf,signFactory,SHOP_SAMPLES[slot.shop])})));
 let scene=null,disposed=false,active=false,nearCount=0,farCount=0,qualityBlocked=false;
 const api={
  get active(){return active&&!disposed;},
  attach(host){
   if(disposed)throw new Error('Art addon already disposed');
   scene=host.scene;
   for(const entry of models){scene.add(entry.model.parent);entry.model.parent.visible=false;}
   active=desired;
   write(active?'街景模型已載入，等待賽道畫面…':'街景模型已載入（目前關閉）');
  },
  setEnabled(value){
   active=!!value&&!disposed;
   if(!active)for(const entry of models)entry.model.parent.visible=false;
   write(!active?'街屋已關閉，賽車仍使用原本場景':'街屋已啟用：最多 6 棟／近景最多 2 棟');
  },
  hidesPlaceholder(segment,side){
   return active&&!qualityBlocked&&models.some(item=>item.segment===segment&&item.side===side);
  },
  update(frame,points,point,halfWidth,quality){
   if(!active||disposed)return;
   const urban=frame.archetype!=='mountain'&&frame.archetype!=='coastal';
   qualityBlocked=quality==='LOW';
   nearCount=0;farCount=0;
   for(const entry of models){
    const group=entry.model.parent;
    const c=points[entry.segment];
    if(!urban||qualityBlocked||!c){group.visible=false;continue;}
    const roadside=deriveVisualRoadside(frame.corridors?.[entry.segment],entry.side,halfWidth);
    if(!roadside.safeForArcadeAwning){group.visible=false;continue;}
    const world=point(c,roadside.offset,0);
    group.position.set(world.x,world.y,world.z);
    group.rotation.y=facadeYaw(c.heading,entry.side);
    group.visible=true;
    // Original Quaternius CC0 geometry only in the two nearest positions.
    const close=visualLod(entry,quality)==='near';
    entry.model.near.visible=close;
    entry.model.far.visible=!close;
    if(close)nearCount++;else farCount++;
   }
   if(++lastFrame%120===0)
    write(qualityBlocked?'LOW 畫質保護：暫時隱藏新建築':
      (nearCount+farCount)+' 棟新街屋｜'+nearCount+' 近景 GLTF｜'+farCount+' 遠景低模');
  },
  disable(error){
   active=false;for(const entry of models)entry.model.parent.visible=false;
   desired=false;ui();
   write('街屋載入或繪製錯誤，已關閉；原版賽車繼續運作');
   if(error)console.warn('Quaternius optional art disabled',error);
  },
  dispose(){
   disposed=true;active=false;
   for(const entry of models){
    entry.model.parent.parent?.remove(entry.model.parent);
    entry.model.parent.traverse(object=>{
     if(object.isInstancedMesh)object.dispose?.();
     if(object.name==='P9_AtlasMergedChineseSigns')object.geometry.dispose();
    });
    entry.model.unit.dispose();
    for(const material of entry.model.mats)material.dispose();
   }
  },
  status(){return {loaded:!!scene,enabled:api.active,nearCount,farCount,qualityBlocked,
   slots:models.length,maxVisible:MAX_QUATERNIUS_BUILDINGS,maxNear:MAX_NEAR_BUILDINGS,
   impact:'visual-only',source:'Quaternius CC0 glTF'};}
 };
 return api;
}
async function enable(){
 if(!desired)return;
 try{
  if(addon){addon.setEnabled(true);return;}
  if(loading){await loading;return;}
  loading=(async()=>{
   write('讀取 Quaternius CC0 glTF 與 PBR 貼圖中…');
   const bridge=await waitBridge();
   const {GLTFLoader}=await import('./assets/vendor/three-r149/jsm/loaders/GLTFLoader.js');
   const loader=new GLTFLoader();
   const names=['Brick_Plain_1','Brick_RedWhite_DoubleWindow','Metal_Window','DoorFrame_Trim'];
   const gltfs=await Promise.all(names.map(name=>loader.loadAsync(ROOT+name+'.gltf')));
   const sources=Object.fromEntries(names.map((name,i)=>[name,gltfs[i].scene]));
   // Group allocation uses its own visual-only RNG.
   const instance=createAddon(window.THREE,sources);
   bridge.install(instance);
   addon=instance;
   addon.setEnabled(desired);
  })();
  await loading;
 }catch(error){
  console.error('Quaternius lab load failed; driving unaffected',error);
  desired=false;ui();
  write('新街屋載入失敗（原版賽車不受影響）：'+(error.message||error));
 }finally{loading=null;}
}
controls.button?.addEventListener('click',()=>{
 desired=!desired;ui();
 if(desired)void enable();
 else{addon?.setEnabled(false);write('新街屋已關閉；原版 V56.1A 賽車可繼續使用');}
});
ui();write('原版賽車就緒後，按「新街屋」載入選配建築。');
window.quaterniusRaceLabStatus=()=>addon?.status()||{
 enabled:desired,loaded:false,source:'Quaternius CC0 glTF',gameplayModified:false
};
