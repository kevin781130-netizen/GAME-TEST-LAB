// P8: deterministic, engine-agnostic FIVE-building Taipei streetfront arrangement.
// All positions are local art-preview coordinates, NOT Taipei routes or landmarks.
export const BLOCK_COUNTS=Object.freeze([3,5,7]);
export const FACADE_WIDTH=10.35;
export const BLOCK_PITCH=10.85; // 0.50 m nominal gap, before small facade setbacks.
export const SHOP_SAMPLES=Object.freeze([
 Object.freeze({id:'lane-diner',name:'北街食堂',style:'mixed',rooftop:'tank'}),
 Object.freeze({id:'tea-window',name:'拾光茶屋',style:'metal',rooftop:'none'}),
 Object.freeze({id:'book-room',name:'拾頁書屋',style:'brick',rooftop:'tank'}),
 Object.freeze({id:'daily-goods',name:'巷弄雜貨',style:'mixed',rooftop:'none'}),
 Object.freeze({id:'green-flowers',name:'禾日花房',style:'metal',rooftop:'tank'}),
 Object.freeze({id:'little-noodles',name:'小町麵館',style:'brick',rooftop:'none'}),
 Object.freeze({id:'paper-house',name:'紙間文具',style:'mixed',rooftop:'tank'})
]);
const INDEX_PRESETS=Object.freeze({
 3:Object.freeze([0,1,2]),
 5:Object.freeze([0,1,2,3,4]),
 7:Object.freeze([0,1,2,3,4,5,6])
});
const SETBACKS=Object.freeze([0,.09,-.06,.14,-.12,.03,-.02]);
export function makeStreetblockPlan(count=5){
 if(!BLOCK_COUNTS.includes(count))throw new RangeError('Preview building count must be 3, 5 or 7');
 const positions=INDEX_PRESETS[count].map((sampleIndex,i)=>{
  const shop=SHOP_SAMPLES[sampleIndex];
  const x=(i-(count-1)/2)*BLOCK_PITCH;
  return Object.freeze({
   index:i,id:shop.id,shop:shop.name,style:shop.style,
   rooftop:shop.rooftop,position:Object.freeze([x,0,SETBACKS[sampleIndex]]),
   facadeWidth:FACADE_WIDTH,buildingHeight:6.48,
   staticOnly:true
  });
 });
 const width=(count-1)*BLOCK_PITCH+FACADE_WIDTH;
 return Object.freeze({
  count,buildingWidth:FACADE_WIDTH,pitch:BLOCK_PITCH,totalWidth:width,
  buildings:Object.freeze(positions),
  coordinateSpace:'independent-asset-preview-local',
  routeCoordinates:null,collisionEnabled:false
 });
}
