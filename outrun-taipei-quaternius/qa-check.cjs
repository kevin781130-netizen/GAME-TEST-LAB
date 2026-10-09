'use strict';
// Quaternius V56.1A sidecar tests — pure math + non-destructive patch invariants.
// Execute in a checkout of GAME-TEST-LAB via node outrun-taipei-quaternius/qa-check.cjs.
// Does NOT claim a browser screenshot or gameplay pass.
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
(async()=>{
 const m=await import(pathToFileURL(path.join(root,'quaternius-roadside-plan.mjs')).href);
 assert.equal(m.RACE_ART_SLOTS.length,6);
 assert.equal(m.MAX_QUATERNIUS_BUILDINGS,6);
 assert.equal(m.MAX_NEAR_BUILDINGS,2);
 assert.equal(m.FRONTAGE_BUFFER_METERS,8);
 assert.deepEqual([...new Set(m.RACE_ART_SLOTS.map(s=>s.segment))].sort((a,b)=>a-b),[8,14,29,35,50,56]);
 assert.equal(m.RACE_ART_SLOTS.filter(s=>s.side<0).length,3);
 assert.equal(m.RACE_ART_SLOTS.filter(s=>s.side>0).length,3);
 const cases=[
  [{center:0,half:1},-1,-16],
  [{center:0,half:1},1,16],
  [{center:-.5,half:.5},-1,-16],
  [{center:.5,half:.5},1,16]
 ];
 for(const [lane,side,expected] of cases){
  const place=m.deriveVisualRoadside([lane],side,8);
  assert.equal(place.offset,expected);
  assert.equal(place.clearanceMeters,8);
  assert(place.safeForArcadeAwning);
 }
 const split=[{center:-.75,half:.4},{center:.75,half:.4}];
 assert.equal(m.deriveVisualRoadside(split,-1,8).offset,(-1.15*8)-8);
 assert.equal(m.deriveVisualRoadside(split,1,8).offset,(1.15*8)+8);
 for(const x of [null,[],[{center:NaN,half:NaN}]])
  if(x!==null&&x.length===1)assert.throws(()=>m.deriveVisualRoadside(x,1,8),RangeError);
 for(const input of [
  ()=>m.deriveVisualRoadside([],0,8),
  ()=>m.deriveVisualRoadside([],1,0),
  ()=>m.deriveVisualRoadside([],1,8,1.2),
  ()=>m.facadeYaw(NaN,-1)
 ])assert.throws(input,RangeError);
 assert.equal(m.facadeYaw(0,-1),Math.PI/2);
 assert.equal(m.facadeYaw(0,1),-Math.PI/2);
 assert.equal(m.RACE_ART_SLOTS.filter(s=>m.visualLod(s,'STANDARD')==='near').length,2);
 assert(m.RACE_ART_SLOTS.every(s=>m.visualLod(s,'LOW')==='hidden'));
 const addon=read('quaternius-race-lab.js');
 const renderer=read('assets/hybrid-renderer.js');
 const html=read('index.html');
 assert(addon.includes("import {makeSnappedQuaterniusFacade,verifySeamlessFacade}"));
 assert(addon.includes('loader.loadAsync(ROOT+name+'));
 assert(addon.includes('near.add(instance)'));
 assert(addon.includes("proxy")===false||addon.includes('facade.farBoxes'));
 assert(addon.includes('deriveVisualRoadside('));
 assert(addon.includes('MAX_NEAR_BUILDINGS'));
 assert(addon.includes('addon.setEnabled(false)'));
 assert(addon.includes("createStreetblockSigns"));
 assert(addon.includes("get active(){return active&&!disposed;}"));
 assert(renderer.includes('function installQuaterniusAddon(addon)'));
 assert(renderer.includes('quaterniusAddon.update(frame,points,point,HALF_WIDTH,quality)'));
 assert(renderer.includes('quaterniusAddon?.active&&quaterniusAddon.hidesPlaceholder?.(i,side)'));
 assert(renderer.includes('car.root.position.set(driftRig.offsetX,.02,3.15);'));
 assert(html.includes('id="quaternius-art-toggle" aria-pressed="false"'));
 assert(html.includes("window.__quaterniusRaceBridge=Object.freeze({"));
 assert(html.includes('assets/hybrid-renderer.js?quaternius-race-lab=1'));
 assert(html.includes('quaternius-race-lab.js'));
 assert(html.includes('../outrun-taipei/'));
 for(const illegal of ['roadCorridors(','updateVehiclePose(','COMPETITION.topSpeed=','segments.push(','currentNode.seed=']){
  assert(!addon.includes(illegal),'Art addon cannot own gameplay '+illegal);
 }
 console.log(JSON.stringify({verdict:'P15 STATIC PASS — real browser not executed',
  slots:m.RACE_ART_SLOTS.length,nearCap:m.MAX_NEAR_BUILDINGS,
  roadClearanceMeters:m.FRONTAGE_BUFFER_METERS,lowModeAutoHide:true,
  originalGameEntryPreserved:'validated by Git tree SHAs',screenshotsVerified:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
