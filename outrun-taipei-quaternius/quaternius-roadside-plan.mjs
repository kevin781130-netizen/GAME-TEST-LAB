// Quaternius V56.1A sidecar: mathematical placement only.
// Coordinates derived from V56 corridor edges; never writes road/map/physics.
export const MAX_QUATERNIUS_BUILDINGS=6;
export const MAX_NEAR_BUILDINGS=2;
export const FRONTAGE_BUFFER_METERS=8;
export const RACE_ART_SLOTS=Object.freeze([
 Object.freeze({segment:8,side:-1,shop:0}),
 Object.freeze({segment:14,side:1,shop:1}),
 Object.freeze({segment:29,side:-1,shop:2}),
 Object.freeze({segment:35,side:1,shop:3}),
 Object.freeze({segment:50,side:-1,shop:4}),
 Object.freeze({segment:56,side:1,shop:5})
]);
export function deriveVisualRoadside(lanes,side,halfWidth,buffer=FRONTAGE_BUFFER_METERS){
 if(![-1,1].includes(side)||!Number.isFinite(halfWidth)||halfWidth<=0||
  !Number.isFinite(buffer)||buffer<3)throw new RangeError('Invalid roadside preview geometry');
 if(!Array.isArray(lanes)||lanes.length===0)lanes=[{center:0,half:1}];
 let edge=side<0?Infinity:-Infinity;
 for(const lane of lanes){
  const center=Number(lane.center),half=Number(lane.half);
  if(!Number.isFinite(center)||!Number.isFinite(half)||half<0)continue;
  const boundary=center+side*half;
  edge=side<0?Math.min(edge,boundary):Math.max(edge,boundary);
 }
 if(!Number.isFinite(edge))throw new RangeError('Corridor has no valid edges');
 const offset=edge*halfWidth+side*buffer;
 return Object.freeze({edge,offset,clearanceMeters:Math.abs(offset-edge*halfWidth),
  safeForArcadeAwning:buffer>=5.0});
}
export function facadeYaw(heading,side){
 if(!Number.isFinite(heading)||![-1,1].includes(side))throw new RangeError('Invalid facing');
 // Existing V56 road heading rotates the local frame; shop +Z faces the road.
 return -heading+side*(-Math.PI/2);
}
export function visualLod(slot,quality){
 if(!slot||typeof slot.segment!=='number')throw new TypeError('Missing roadside slot');
 if(quality==='LOW')return 'hidden';
 return slot.segment<=16?'near':'far';
}
