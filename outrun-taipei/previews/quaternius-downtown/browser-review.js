// P12: browser-only independent Quaternius streetblock visual acceptance station.
// All work stays in same-origin preview canvases and in user-triggered downloads.
import {makeBrowserReviewPlan,sheetDimensions,QA_SHEET,inspectCapturedPixels} from './browser-review-matrix.mjs';
import {makeEvidenceZip} from './evidence-zip.mjs';

const $=id=>document.getElementById(id);
const frame=$('preview-frame');
const stage=$('preview-stage');
const sheet=$('contact-sheet');
const progress=$('progress');
const runButton=$('start-review');
const saveImage=$('save-image');
const saveReport=$('save-report');
const saveBundle=$('save-bundle');
const reviewPlan=makeBrowserReviewPlan();
let report=null,working=false,evidenceFiles=[];
const status=value=>{progress.textContent=String(value)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function awaitFrame(){
 if(!frame.src||frame.src==='about:blank'){
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('預覽框架載入逾時')),25000);
   frame.onload=()=>{clearTimeout(timer);resolve();};
   frame.onerror=()=>{clearTimeout(timer);reject(new Error('無法載入街廓 iframe'))};
   frame.src='./streetblock.html';
  });
 }
 for(let n=0;n<300;n++){
  const win=frame.contentWindow;
  const bridge=win?.__quaterniusArtQA;
  if(bridge?.ready?.())return bridge;
  const failure=frame.contentDocument?.getElementById('street-status')?.textContent||'';
  if(failure.startsWith('預覽載入失敗'))throw new Error(failure);
  await pause(150);
 }
 throw new Error('Quaternius 3D 素材未完成載入，請檢查開發者主控台和 HTTP 伺服器');
}
function resizePreview(caseInfo){
 const width=caseInfo.width,height=caseInfo.height;
 // Independent viewport sizing: document inside iframe sees the requested dimensions.
 frame.style.width=width+'px';
 frame.style.height=height+'px';
 frame.width=width;
 frame.height=height;
 const scale=Math.min(348/width,246/height);
 frame.style.transform='scale('+scale+')';
 stage.dataset.viewport=caseInfo.viewport;
}
async function settle(win){
 // Fonts and layout are allowed to finish before the *synchronous* canvas readback.
 await win.document.fonts?.ready;
 await new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));
}
async function pacing(win){
 const times=[];
 await new Promise(resolve=>{
  const advance=t=>{
   times.push(t);
   if(times.length===13)resolve();
   else win.requestAnimationFrame(advance);
  };
  win.requestAnimationFrame(advance);
 });
 const diffs=times.slice(1).map((t,i)=>t-times[i]).filter(x=>x>0&&x<1000);
 return diffs.length>0?
  {samples:diffs.length,meanRafMs:+(diffs.reduce((a,b)=>a+b,0)/diffs.length).toFixed(2)}:
  {samples:0,meanRafMs:null};
}
async function decodePNG(dataURL){
 const image=new Image();
 image.src=dataURL;
 await image.decode();
 return image;
}
function paintCell(ctx,image,i,c,pixels,metrics){
 const {columns,tileWidth,tileHeight,headerHeight,margin}=QA_SHEET;
 const left=(i%columns)*tileWidth,top=Math.floor(i/columns)*tileHeight;
 ctx.fillStyle='#152333';ctx.fillRect(left,top,tileWidth,tileHeight);
 ctx.fillStyle='#eff5fa';ctx.font='bold 15px system-ui';
 ctx.textBaseline='middle';
 ctx.fillText(c.count+' 棟 / '+c.viewport+' / '+c.lod+' / '+(c.night?'夜':'日'),
  left+margin,top+headerHeight/2,tileWidth-2*margin);
 const availableW=tileWidth-2*margin,availableH=tileHeight-headerHeight-2*margin;
 const factor=Math.min(availableW/image.width,availableH/image.height);
 const w=Math.floor(image.width*factor),h=Math.floor(image.height*factor);
 const x=left+Math.floor((tileWidth-w)/2),y=top+headerHeight+Math.floor((availableH-h)/2);
 ctx.drawImage(image,x,y,w,h);
 ctx.strokeStyle='#42627a';ctx.strokeRect(x+.5,y+.5,w-1,h-1);
 if(!pixels.nonBlankHeuristic){
  ctx.fillStyle='rgba(140,38,29,.87)';ctx.fillRect(x,y,w,32);
  ctx.fillStyle='#ffffff';ctx.font='bold 12px system-ui';
  ctx.fillText('⚠ 畫面可能空白',x+8,y+16,w-16);
 }
}
function downloadBlob(blob,name){
 const u=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=u;a.download=name;a.hidden=true;document.body.appendChild(a);
 a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),30000);
}
const encode=new TextEncoder();
function parsePNG(dataURL){
 const prefix='data:image/png;base64,';
 if(!dataURL.startsWith(prefix))throw new Error('Invalid WebGL PNG data URL');
 const raw=atob(dataURL.slice(prefix.length));
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 if(bytes.length<24||Array.from(bytes.slice(0,8)).join(',')!=='137,80,78,71,13,10,26,10')
  throw new Error('Captured file is not a valid PNG header');
 return bytes;
}
async function sha256(bytes){
 if(!crypto?.subtle)throw new Error('SHA-256 is unavailable; use http://localhost (secure browser origin)');
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function meanPixelDifference(a,b){
 if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.length!==b.length)
  throw new Error('Comparison buffers must have equal dimensions');
 let sum=0;for(let i=0;i<a.length;i+=4){
  sum+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
 }
 return +(sum/(a.length/4)/3).toFixed(3);
}
function compareScenarios(samples){
 const warnings=[],comparisons=[];
 for(const count of [3,5,7])for(const viewport of ['desktop','mobile']){
  for(const light of ['day','night']){
   const left=samples.get('p12-'+count+'-'+viewport+'-near-'+light);
   const right=samples.get('p12-'+count+'-'+viewport+'-far-'+light);
   if(!left||!right)continue;
   const diff=meanPixelDifference(left,right);
   comparisons.push({count,viewport,compare:'near/far',light,meanAbsoluteRGBDifference:diff});
   if(diff<.7)warnings.push(count+' '+viewport+' '+light+': near/far images nearly identical; inspect LOD switching');
  }
  for(const lod of ['near','far']){
   const day=samples.get('p12-'+count+'-'+viewport+'-'+lod+'-day');
   const night=samples.get('p12-'+count+'-'+viewport+'-'+lod+'-night');
   if(!day||!night)continue;
   const diff=meanPixelDifference(day,night);
   comparisons.push({count,viewport,compare:'day/night',lod,meanAbsoluteRGBDifference:diff});
   if(diff<.7)warnings.push(count+' '+viewport+' '+lod+': day/night images nearly identical; inspect lighting');
  }
 }
 return {warnings,comparisons};
}
const toBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>
 blob?resolve(blob):reject(new Error('PNG contact sheet encoder failed')),'image/png'));
runButton.addEventListener('click',async()=>{
 if(working)return;
 working=true;runButton.disabled=true;saveImage.disabled=true;saveReport.disabled=true;saveBundle.disabled=true;
 evidenceFiles=[];report=null;
 status('初始化獨立 Quaternius 預覽…');
 const start=new Date();
 const dim=sheetDimensions();
 sheet.width=dim.width;sheet.height=dim.height;
 const ctx=sheet.getContext('2d',{alpha:false});
 ctx.fillStyle='#11202d';ctx.fillRect(0,0,sheet.width,sheet.height);
 const results=[],issues=[],storedPNG=[],hashes=[];
 const samples=new Map();
 try{
  const bridge=await awaitFrame();
  for(let i=0;i<reviewPlan.length;i++){
   const current=reviewPlan[i];
   status('實際瀏覽器擷取 '+(i+1)+' / '+reviewPlan.length+
    '：'+current.count+' 棟 / '+current.viewport+' / '+current.lod+' / '+current.light);
   resizePreview(current);
   await settle(frame.contentWindow);
   bridge.configure({count:current.count,lod:current.lod,night:current.night});
   await settle(frame.contentWindow);
   const pacingSample=await pacing(frame.contentWindow);
   const capture=bridge.capture();
   const image=await decodePNG(capture.png);
   const probe=document.createElement('canvas');
   probe.width=48;probe.height=32;
   probe.getContext('2d').drawImage(image,0,0,probe.width,probe.height);
   const pixels=inspectCapturedPixels(probe);
   const probeRGBA=probe.getContext('2d').getImageData(0,0,48,32).data;
   samples.set(current.id,new Uint8Array(probeRGBA));
   const binary=parsePNG(capture.png);
   const filename='images/'+current.id+'.png';
   const digest=await sha256(binary);
   storedPNG.push({name:filename,data:binary});
   hashes.push({file:filename,sha256:digest,bytes:binary.length});
   if(!pixels.nonBlankHeuristic)issues.push(current.id+': pixels appear blank');
   if(capture.count!==current.count||capture.near+capture.far!==current.count||
      !capture.previewOnly)issues.push(current.id+': preview state mismatch');
   if(current.lod==='near'&&capture.near!==current.count)
    issues.push(current.id+': near LOD count mismatch');
   if(current.lod==='far'&&capture.far!==current.count)
    issues.push(current.id+': far LOD count mismatch');
   paintCell(ctx,image,i,current,pixels,capture);
   const {png,...info}=capture;
   results.push({id:current.id,scenario:current,pixels,pacing:pacingSample,
    stats:info,pngLength:png.length,pngFile:filename,pngSHA256:digest});
   await pause(0);
  }
  if(storedPNG.length!==reviewPlan.length)throw new Error('Did not capture all 24 full-resolution PNGs');
  const diffReport=compareScenarios(samples);
  issues.push(...diffReport.warnings);
  const provenance=$('commit-sha').value.trim();
  report={
   type:'Quaternius-P13-browser-evidence-bundle',
   createdAt:start.toISOString(),finishedAt:new Date().toISOString(),
   sourceCommit:provenance||null,
   provenanceStatus:provenance?'user-entered SHA (NOT cryptographically verified)':'unknown: user did not enter Git commit',
   location:location.href,browser:navigator.userAgent,
   pixelsAreBrowserCaptured:true,readOnlyToGame:true,
   hardwareGPUAcceptance:false,deployedGameAcceptance:false,humanVisualApproval:false,
   screenshotCount:results.length,contactSheetDimensions:dim,
   automaticResult:issues.length?'CAPTURED WITH WARNINGS — HUMAN REVIEW REQUIRED':
    'CAPTURED — HUMAN VISUAL REVIEW REQUIRED',
   issues,results,sha256Manifest:hashes,automaticPairComparisons:diffReport.comparisons,
   caveat:'Pixels are actual same-origin preview canvas captures in this browser. RAF timing is approximate; user must visually inspect contact sheet. Browser GPU/performance is not the production game.'
  };
  const sheetBlob=await toBlob(sheet);
  const sheetBytes=new Uint8Array(await sheetBlob.arrayBuffer());
  const sheetDigest=await sha256(sheetBytes);
  const checksums=hashes.concat([{file:'contact-sheet.png',sha256:sheetDigest,bytes:sheetBytes.length}]);
  report.sha256Manifest=checksums;
  const checksumsText=checksums.map(row=>row.sha256+'  '+row.file).join('\n')+'\n';
  evidenceFiles=[
   ...storedPNG,
   {name:'contact-sheet.png',data:sheetBytes},
   {name:'SHA256SUMS.txt',data:encode.encode(checksumsText)},
   {name:'report.json',data:encode.encode(JSON.stringify(report,null,2)+'\n')},
   {name:'README.txt',data:encode.encode(
    'P13 original same-origin browser captures. 24 full-size images in images/.\n'+
    'Verify SHA256SUMS before reviewing. Code provenance is operator-entered.\n'+
    'No production game rendering or human visual acceptance has been claimed.\n')}
  ];
  saveImage.disabled=false;saveReport.disabled=false;saveBundle.disabled=false;
  status('已擷取 '+results.length+' 張完整 PNG，'+issues.length+
   ' 個警訊。可一鍵下載 ZIP，內含逐張圖片、校驗碼與 JSON。請人工看圖。');
 }catch(error){
  report={
   type:'Quaternius-P13-browser-evidence-bundle',
   createdAt:start.toISOString(),finishedAt:new Date().toISOString(),
   sourceCommit:$('commit-sha').value.trim()||null,
   automaticResult:'INCOMPLETE — NO VISUAL APPROVAL',
   error:String(error?.stack||error),completed:results.length,
   expected:reviewPlan.length,issues,results,humanVisualApproval:false};
  saveReport.disabled=false;
  status('未完成：'+(error.message||error)+'。可儲存 JSON 錯誤報告。');
  console.error('P12 browser visual capture failed',error);
 }finally{runButton.disabled=false;working=false;}
});
saveImage.addEventListener('click',()=>{
 if(!report||report.screenshotCount!==reviewPlan.length)return;
 sheet.toBlob(blob=>{if(blob)downloadBlob(blob,'quaternius-p12-24-view-contact-sheet.png')},'image/png');
});
saveReport.addEventListener('click',()=>{
 if(!report)return;
 downloadBlob(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
  'quaternius-p13-browser-evidence.json');
});
saveBundle.addEventListener('click',()=>{
 if(working||!report||evidenceFiles.length!==28)return;
 try{
  const zip=makeEvidenceZip(evidenceFiles);
  downloadBlob(new Blob([zip],{type:'application/zip'}),
   'quaternius-p13-24-original-pngs-evidence.zip');
 }catch(error){status('ZIP 匯出失敗：'+(error?.message||error));console.error(error)}
});
status('請先啟動本機 HTTP 伺服器，再點選開始擷取。');
