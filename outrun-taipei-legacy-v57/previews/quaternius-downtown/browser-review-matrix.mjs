// P12 browser-only, deterministic visual review matrix: preview-local, no game inputs.
export const QA_VIEWPORTS=Object.freeze([
 Object.freeze({name:'desktop',width:1280,height:800}),
 Object.freeze({name:'mobile',width:390,height:844})
]);
export const QA_COUNTS=Object.freeze([3,5,7]);
export const QA_MODES=Object.freeze(['near','far']);
export const QA_LIGHTS=Object.freeze(['day','night']);
export const QA_SHEET=Object.freeze({columns:4,tileWidth:360,tileHeight:256,
 headerHeight:28,margin:8});
export function makeBrowserReviewPlan(){
 const cases=[];
 for(const count of QA_COUNTS)for(const view of QA_VIEWPORTS)
  for(const lod of QA_MODES)for(const light of QA_LIGHTS)
   cases.push(Object.freeze({
    id:`p12-${count}-${view.name}-${lod}-${light}`,
    count,viewport:view.name,width:view.width,height:view.height,
    lod,light,night:light==='night'
   }));
 return Object.freeze(cases);
}
export function sheetDimensions(sampleCount=makeBrowserReviewPlan().length){
 if(!Number.isInteger(sampleCount)||sampleCount<1||sampleCount>24)
  throw new RangeError('Invalid P12 review capture count');
 const {columns,tileWidth,tileHeight}=QA_SHEET;
 return Object.freeze({width:columns*tileWidth,
  height:Math.ceil(sampleCount/columns)*tileHeight,
  columns,rows:Math.ceil(sampleCount/columns)});
}
export function inspectCapturedPixels(canvas){
 if(!canvas||!Number.isFinite(canvas.width)||!Number.isFinite(canvas.height)||
  canvas.width<1||canvas.height<1)throw new RangeError('Invalid image canvas');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw new Error('No 2D canvas to inspect captured pixels');
 const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
 const colors=new Set();
 const skip=Math.max(1,Math.floor(canvas.width*canvas.height/800));
 for(let p=0;p<canvas.width*canvas.height;p+=skip){
  const i=p*4;
  colors.add(((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4));
 }
 return Object.freeze({distinctColorBuckets:colors.size,nonBlankHeuristic:colors.size>=8});
}
