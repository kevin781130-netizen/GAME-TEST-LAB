// P14 — Original Quaternius modular frontage slots.
// All local preview coordinates; no Taipei map, road, physics or landmark data.
// Dimensions are measured from the staged CC0 glTF position accessors.
export const MODULE_BOUNDS=Object.freeze({
 brickWindow:Object.freeze({asset:'Brick_RedWhite_DoubleWindow',width:4,height:3,depthMin:-0.241691,depthMax:0.035650}),
 metalWindow:Object.freeze({asset:'Metal_Window',width:4,height:3,depthMin:-0.223903,depthMax:0.000001}),
 door:Object.freeze({asset:'DoorFrame_Trim',width:2,height:3,depthMin:-0.225581,depthMax:0.000001}),
 brick:Object.freeze({asset:'Brick_Plain_1',width:2,height:1,depthMin:-0.200001,depthMax:0.000001})
});
export const FACADE_MEASUREMENTS=Object.freeze({
 width:10,height:6,storeyHeight:3,snapTolerance:0.001
});
export function makeSnappedQuaterniusFacade(style){
 if(!['mixed','metal','brick'].includes(style))throw new RangeError('Unrecognized facade style');
 const left=style==='metal'?'metalWindow':'brickWindow';
 const right=style==='brick'?'brickWindow':'metalWindow';
 const slots=[
  {kind:left,x:-3,y:0,z:0},
  {kind:'door',x:0,y:0,z:0},
  {kind:right,x:3,y:0,z:0},
  {kind:left,x:-3,y:3,z:0},
  {kind:'brick',x:0,y:3,z:0},
  {kind:'brick',x:0,y:4,z:0},
  {kind:'brick',x:0,y:5,z:0},
  {kind:right,x:3,y:3,z:0}
 ];
 const frozen=slots.map(slot=>{
  const b=MODULE_BOUNDS[slot.kind];
  return Object.freeze({...slot,asset:b.asset,
   width:b.width,height:b.height,
   left:slot.x-b.width/2,right:slot.x+b.width/2,
   bottom:slot.y,top:slot.y+b.height
  });
 });
 return Object.freeze({style,modules:Object.freeze(frozen),
  width:FACADE_MEASUREMENTS.width,height:FACADE_MEASUREMENTS.height,
  coordinateSpace:'quaternius-art-preview-local'});
}
export function verifySeamlessFacade(layout,tolerance=FACADE_MEASUREMENTS.snapTolerance){
 if(!layout||!Array.isArray(layout.modules)||layout.modules.length!==8)
  throw new TypeError('Expected an eight-module Quaternius facade');
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>=.1)
  throw new RangeError('Invalid facade seam tolerance');
 const rows=layout.modules.map(module=>[module.left,module.right,module.bottom,module.top]);
 const xcuts=[-5,-1,1,5],ycuts=[0,3,4,5,6];
 const intersections=[],issues=[];
 // Each elementary X/Y grid segment must be covered by exactly ONE original
 // Quaternius module (a door/window tile or central infill strip).
 for(let xi=0;xi<xcuts.length-1;xi++)for(let yi=0;yi<ycuts.length-1;yi++){
  const x=(xcuts[xi]+xcuts[xi+1])/2,y=(ycuts[yi]+ycuts[yi+1])/2;
  const covering=rows.filter(r=>x>r[0]+tolerance&&x<r[1]-tolerance&&
    y>r[2]+tolerance&&y<r[3]-tolerance);
  intersections.push({x,y,coverage:covering.length});
  if(covering.length!==1)issues.push('Coverage gap/overlap at '+x+', '+y+': '+covering.length);
 }
 for(const slot of layout.modules){
  if(slot.left<-5-tolerance||slot.right>5+tolerance||
    slot.bottom<-tolerance||slot.top>6+tolerance)
   issues.push('Module outside original 10×6 facade: '+slot.asset);
  // Sample-point occupancy alone can overlook a 10cm hairline seam. Validate
  // all source tile boundaries are snapped onto the actual 4/2/4m X grid
  // and 3+1+1+1m Y grid of the imported CC0 modular facade.
  for(const edge of [slot.left,slot.right])
   if(!xcuts.some(x=>Math.abs(edge-x)<=tolerance))
    issues.push('Unsnapped horizontal seam at '+edge+': '+slot.asset);
  for(const edge of [slot.bottom,slot.top])
   if(!ycuts.some(y=>Math.abs(edge-y)<=tolerance))
    issues.push('Unsnapped vertical seam at '+edge+': '+slot.asset);
 }
 return Object.freeze({passed:issues.length===0,issues:Object.freeze(issues),
  checkedCells:intersections.length,
  moduleCount:layout.modules.length});
}
