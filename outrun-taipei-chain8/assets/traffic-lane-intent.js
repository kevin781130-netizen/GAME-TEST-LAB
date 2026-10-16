/* V60 Taipei original traffic preview, generated from src/traffic/LaneIntent.cjs. */
(function(root){
'use strict';
const module={exports:{}};
'use strict';
// Taipei-original traffic planning and mid-maneuver safety. No proprietary source,
// gameplay RNG, mutation of the caller, or render-system dependencies.
const RULES=Object.freeze({
  speedToWorld:18,closingKph:14,forwardLook:6500,rearLook:4000,
  decisionHorizon:2.5,frontGap:1300,rearGap:1300,lateralGap:.07,
  roadMargin:.04,forkBuffer:4200,playerBuffer:8000,cooldownSeconds:3.2,settleSeconds:2.0
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const number=(x,fallback)=>finite(x)?x:fallback;
const ownValid=own=>own&&[own.x,own.z,own.speed,own.halfWidth].every(finite)&&own.halfWidth>0&&own.speed>=0;
const sameVehicle=(own,peer)=>peer===own||(own.id!=null&&peer.id!=null&&own.id===peer.id);
const blocked=(target,from,peer,ownHalf,frontGap,rearGap,dz)=>{
  const margin=peer.halfWidth+ownHalf+RULES.lateralGap;
  // Reserve the entire ongoing lateral path, not merely current vehicle x.
  const moving=peer.passActive===true&&finite(peer.laneTarget);
  const peerMin=moving?Math.min(peer.x,peer.laneTarget):peer.x;
  const peerMax=moving?Math.max(peer.x,peer.laneTarget):peer.x;
  const nearTarget=target>=peerMin-margin&&target<=peerMax+margin;
  const nearPath=peerMax+margin>=Math.min(from,target)&&peerMin-margin<=Math.max(from,target);
  if(nearPath&&Math.abs(dz)<950)return true;
  return nearTarget&&(dz>=0?dz<frontGap:-dz<rearGap);
};
function inspectLanePath(input){
  const own=input?.self,target=input?.target;
  const deny=reason=>({safe:false,reason});
  if(!ownValid(own))return deny('invalid-self');
  if(!finite(target))return deny('invalid-target');
  if(input.allow!==true)return deny('disabled');
  if(!Array.isArray(input.corridors)||!input.corridors.length||
    input.corridors.some(segment=>!Array.isArray(segment)||segment.length!==1||
      !finite(segment[0]?.center)||!finite(segment[0]?.half)||segment[0].half<=0))
    return deny('split-or-invalid-road');
  for(const [corridor] of input.corridors){
    for(const x of [own.x,target]){
      if(Math.abs(x-corridor.center)+own.halfWidth+RULES.roadMargin>corridor.half)
        return deny('out-of-corridor');
    }
  }
  if(input.player!=null){
    if(!finite(input.player.z))return deny('invalid-player');
    if(Math.abs(own.z-input.player.z)<RULES.playerBuffer)return deny('player-proximity');
  }
  if(finite(input.forkWarningZ)&&own.z>=input.forkWarningZ-RULES.forkBuffer)return deny('fork-approach');
  if(!Array.isArray(input.others))return deny('invalid-peers');
  for(const peer of input.others){
    if(!peer||![peer.x,peer.z,peer.speed,peer.halfWidth].every(finite)||peer.halfWidth<=0||
      peer.passActive===true&&!finite(peer.laneTarget))return deny('invalid-peers');
    if(sameVehicle(own,peer))continue;
    const dz=peer.z-own.z;
    const front=RULES.frontGap+Math.max(0,own.speed-peer.speed)*RULES.speedToWorld*RULES.decisionHorizon;
    const rear=RULES.rearGap+Math.max(0,peer.speed-own.speed)*RULES.speedToWorld*RULES.decisionHorizon;
    // Far closing vehicles can enter the unsafe gap within the decision horizon.
    if(dz>Math.max(RULES.forwardLook,front)||-dz>Math.max(RULES.rearLook,rear))continue;
    if(blocked(target,own.x,peer,own.halfWidth,front,rear,dz))return deny('traffic-path-blocked');
  }
  return {safe:true,reason:'clear'};
}
function planLaneIntent(input){
  const own=input?.self;
  const origin=number(own?.laneTarget,number(own?.x,0));
  const hold=reason=>({action:'hold',target:origin,reason,cooldown:0});
  if(!ownValid(own))return hold('invalid-self');
  if(input?.allow!==true)return hold('disabled');
  if(number(input.cooldown,0)>0)return hold('cooldown');
  if(!Array.isArray(input.corridors)||!input.corridors.length||
    input.corridors.some(q=>!Array.isArray(q)||q.length!==1||!finite(q[0]?.center)||!finite(q[0]?.half)||q[0].half<=0))
    return hold('split-or-invalid-road');
  if(input.player!=null){
    if(!finite(input.player.z))return hold('invalid-player');
    if(Math.abs(own.z-input.player.z)<RULES.playerBuffer)return hold('player-proximity');
  }
  if(finite(input.forkWarningZ)&&own.z>=input.forkWarningZ-RULES.forkBuffer)return hold('fork-approach');
  if(!Array.isArray(input.others))return hold('invalid-peers');
  for(const peer of input.others){
    if(!peer||![peer.x,peer.z,peer.speed,peer.halfWidth].every(finite)||peer.halfWidth<=0||
      peer.passActive===true&&!finite(peer.laneTarget))return hold('invalid-peers');
  }
  const road=input.corridors[0][0];
  const lanes=[road.center-road.half*.52,road.center,road.center+road.half*.52];
  const legal=lanes.map(lane=>input.corridors.every(segment=>segment.some(q=>
    Math.abs(lane-q.center)+own.halfWidth+RULES.roadMargin<=q.half)));
  if(!legal.some(Boolean))return hold('narrow-road');
  const current=lanes.reduce((best,x,i)=>Math.abs(x-origin)<Math.abs(lanes[best]-origin)?i:best,0);
  if(!legal[current])return hold('out-of-corridor');
  // Single leader scan: no temporary peer map, full sort, or per-peer object spread.
  let leader=null,bestDz=Infinity;
  for(const peer of input.others){
    if(sameVehicle(own,peer))continue;
    const dz=peer.z-own.z;
    if(dz>0&&dz<RULES.forwardLook&&Math.abs(peer.x-lanes[current])<=
      peer.halfWidth+own.halfWidth+RULES.lateralGap){
      if(dz<bestDz||(dz===bestDz&&String(peer.id)<String(leader?.id))){
        leader=peer;bestDz=dz;
      }
    }
  }
  if(!leader||own.speed-leader.speed<RULES.closingKph)return hold('no-slow-leader');
  // V66: alternate only the preference when BOTH adjacent lanes are clear.
  // Safety always wins; one available path must never be rejected for fairness.
  const candidates=[];
  for(const i of [current-1,current+1]){
    if(i<0||i>=lanes.length||!legal[i])continue;
    const target=lanes[i];
    if(inspectLanePath({...input,target}).safe)candidates.push({index:i,target});
  }
  if(candidates.length){
    // Remember a completed departure from the center lane, not a failed
    // attempt or the return from an outside lane. No RNG, no ID bias.
    const prefersRight=current===1&&own.lastCenterSide===-1;
    const chosen=prefersRight&&candidates.length===2?candidates[1]:candidates[0];
    return {action:'change',target:chosen.target,reason:'safe-pass',cooldown:RULES.cooldownSeconds};
  }
  return hold('adjacent-lanes-blocked');
}

// V67: bounded, stable arbitration for simultaneous candidates, independent of
// the array slot a car occupies. Waiting cars receive priority over newcomers;
// position determines first contention, with slot ID only as an exact tie-break.
function orderLaneRequests(requests){
  if(!Array.isArray(requests))return [];
  const queue=requests.filter(r=>r&&Number.isInteger(r.id)&&r.id>=0&&
    [r.x,r.z,r.speed].every(finite)&&r.speed>=0);
  const wait=r=>finite(r.wait)?Math.max(0,Math.min(8,Math.floor(r.wait))):0;
  queue.sort((a,b)=>wait(b)-wait(a)||a.z-b.z||a.x-b.x||b.speed-a.speed||a.id-b.id);
  return queue.map(r=>r.id);
}
module.exports={RULES,planLaneIntent,inspectLanePath,orderLaneRequests};
root.TaipeiTrafficAI=Object.freeze(module.exports);
})(window);
