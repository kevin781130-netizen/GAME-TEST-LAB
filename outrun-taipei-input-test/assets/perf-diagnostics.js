/* V64 performance diagnostic module, generated from src/diagnostics/FrameProbe.cjs. */
(function(root){
'use strict';
const module={exports:{}};
'use strict';
// V64 read-only, bounded frame diagnostics. No rendering, gameplay or IO access.
const SCHEMA='taipei.v64.frame-diagnostics.1';
const cap=(x,min,max)=>Math.max(min,Math.min(max,x));
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const q95=sorted=>sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null;
function createFrameProbe({capacity=360,jankMs=50,maxEvents=24}={}){
 if(!Number.isInteger(capacity)||capacity<30||capacity>1200)throw new RangeError('sample capacity 30..1200');
 if(!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>100)throw new RangeError('event capacity 1..100');
 if(!numeric(jankMs)||jankMs<16||jankMs>1000)throw new RangeError('jank threshold 16..1000');
 const samples=new Array(capacity),anomalies=new Array(maxEvents);
 let index=0,count=0,eventIndex=0,eventCount=0,previous=null,first=null,frames=0,totalSteps=0,hiddenFrames=0,lastRoute=null;
 const round=x=>numeric(x)?Math.round(x*100)/100:null;
 function record({timestampMs,updateMs=0,renderMs=0,steps=0,route=null,hidden=false,paused=false,heapBytes=null}={}){
  if(!numeric(timestampMs))return false;
  if(hidden||paused){previous=null;hiddenFrames++;return false;}
  if(first===null)first=timestampMs;
  if(previous===null){previous=timestampMs;return false;}
  const interval=timestampMs-previous;
  previous=timestampMs;
  if(!(interval>0&&numeric(interval)))return false;
  const update=numeric(updateMs)?cap(updateMs,0,60000):0;
  const render=numeric(renderMs)?cap(renderMs,0,60000):0;
  const stepCount=Number.isInteger(steps)&&steps>=0?Math.min(steps,20):0;
  const cleanRoute=typeof route==='string'&&/^[1-5][A-E]$/.test(route)?route:null;
  lastRoute=cleanRoute;
  const sample={intervalMs:round(interval),updateMs:round(update),renderMs:round(render),steps:stepCount};
  if(numeric(heapBytes)&&heapBytes>=0)sample.jsHeapBytes=Math.round(heapBytes);
  samples[index]=sample;index=(index+1)%capacity;count=Math.min(capacity,count+1);
  frames++;totalSteps+=stepCount;
  if(interval>jankMs||render>jankMs||update>jankMs){
   anomalies[eventIndex]={elapsedSec:round((timestampMs-first)/1000),route:cleanRoute,
    intervalMs:round(interval),updateMs:round(update),renderMs:round(render),
    reason:interval>jankMs?'frame-gap':render>jankMs?'render-cost':'update-cost'};
   eventIndex=(eventIndex+1)%maxEvents;eventCount=Math.min(eventCount+1,maxEvents);
  }
  return true;
 }
 function snapshot(meta={}){
  const ordered=Array.from({length:count},(_,i)=>samples[(index-count+i+capacity)%capacity]);
  const deltas=ordered.map(x=>x.intervalMs).sort((a,b)=>a-b);
  const render=ordered.map(x=>x.renderMs).sort((a,b)=>a-b);
  const update=ordered.map(x=>x.updateMs).sort((a,b)=>a-b);
  const heap=ordered.filter(x=>numeric(x.jsHeapBytes)).map(x=>x.jsHeapBytes);
  const sum=deltas.reduce((s,n)=>s+n,0);
  const events=Array.from({length:eventCount},(_,i)=>anomalies[(eventIndex-eventCount+i+maxEvents)%maxEvents]);
  const result={schema:SCHEMA,scope:'opt-in cruise diagnostics',sampleCount:count,totalFrames:frames,
   totalSteps,hiddenOrPausedFrames:hiddenFrames,
   framesPerSecond:sum?round(count*1000/sum):null,
   frameP95Ms:q95(deltas),frameMaxMs:deltas.length?deltas[deltas.length-1]:null,
   renderP95Ms:q95(render),updateP95Ms:q95(update),
   jankCount:events.length,retainedJankEvents:events,
   jsHeapBytes:heap.length?heap[heap.length-1]:null,
   lastRoute,deviceInfo:'not-collected',gpuTiming:'not-measured',
   notes:'RAF frame intervals are not physical GPU execution times; JS heap may be unsupported.'};
  // Restrict metadata to non-sensitive display facts; no URLs, UA or player inputs.
  if(typeof meta.route==='string'&&/^[1-5][A-E]$/.test(meta.route))result.route=meta.route;
  if(['LOW','STANDARD','HIGH','ULTRA'].includes(meta.quality))result.quality=meta.quality;
  if(Number.isInteger(meta.viewportWidth)&&meta.viewportWidth>0&&meta.viewportWidth<=8192)
   result.viewportWidth=meta.viewportWidth;
  if(Number.isInteger(meta.viewportHeight)&&meta.viewportHeight>0&&meta.viewportHeight<=8192)
   result.viewportHeight=meta.viewportHeight;
  return result;
 }
 function reset(){index=0;count=0;eventIndex=0;eventCount=0;previous=null;first=null;frames=0;totalSteps=0;hiddenFrames=0;lastRoute=null;samples.fill(undefined);anomalies.fill(undefined);}
 return Object.freeze({record,snapshot,reset});
}
module.exports={SCHEMA,createFrameProbe};
root.TaipeiPerf64=Object.freeze(module.exports);
})(window);
