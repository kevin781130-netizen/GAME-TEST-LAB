'use strict';
// Cloud CI automatic browser QA of Quaternius racing experiment. No user interaction.
// Screenshots + factual pixel metrics, not semantic art review.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results/quaternius-race-visual');
fs.mkdirSync(out,{recursive:true});
const MIME={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8',
 '.gltf':'model/gltf+json','.bin':'application/octet-stream','.png':'image/png',
 '.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function serve(){
 return http.createServer((req,res)=>{
  try{
   const loc=new URL(req.url,'http://127.0.0.1');
   let file=path.resolve(root,'.'+decodeURIComponent(loc.pathname));
   if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end('Forbidden');return;}
   if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');
   res.setHeader('Cache-Control','no-store');
   fs.createReadStream(file).on('error',()=>res.end()).pipe(res);
  }catch(_){res.writeHead(404);res.end('Missing asset');}
 });
}
async function pixelSummary(page,buffer){
 const source=buffer.toString('base64');
 return page.evaluate(async base64=>{
  const image=new Image();
  image.src='data:image/png;base64,'+base64;
  await image.decode();
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=36;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,64,36);
  const rgba=context.getImageData(0,0,64,36).data;
  let unique=new Set(),sums=[0,0,0];
  for(let i=0;i<rgba.length;i+=4){
   unique.add((rgba[i]>>4)<<8|(rgba[i+1]>>4)<<4|(rgba[i+2]>>4));
   sums[0]+=rgba[i];sums[1]+=rgba[i+1];sums[2]+=rgba[i+2];
  }
  return {width:image.width,height:image.height,uniqueBuckets:unique.size,
    meanRgb:sums.map(n=>+(n/(64*36)).toFixed(2))};
 },source);
}
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function collect(page,screenName,condition,record){
 const filename=screenName+'.png';
 const data=await page.screenshot({animations:'disabled'});
 fs.writeFileSync(path.join(out,filename),data);
 const values=await pixelSummary(page,data);
 const test={kind:screenName,png:filename,sha256:sha(data),bytes:data.length,
   image:values,condition,
   artStatus:await page.evaluate(()=>window.quaterniusRaceLabStatus?.()||null)};
 record.screenshots.push(test);
 if(values.uniqueBuckets<12)record.errors.push(screenName+': low-color screenshot (possible blank WebGL)');
 return test;
}
async function run(){
 const server=serve();let browser=null;
 const report={scope:'Quaternius P15 actual cloud Chromium WebGL smoke',
  started:new Date().toISOString(),status:'NOT RUN',screenshots:[],errors:[],warnings:[],
  caveats:['GitHub runner software GPU is not a physical mobile GPU.',
   'Source image comparisons are not a substitute for a human art-quality assessment.']};
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/outrun-taipei-quaternius/';
  browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
  ]});
  report.browser=browser.version();
  for(const viewport of [{name:'desktop',width:1280,height:800},{name:'mobile-emulated',width:390,height:844}]){
   const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
   const page=await context.newPage();
   const errors=[],badRequests=[];
   page.on('pageerror',e=>errors.push('JS '+e.message));
   page.on('console',msg=>{if(msg.type()==='error')errors.push('console '+msg.text().slice(0,400));});
   page.on('requestfailed',r=>badRequests.push(r.url()+': '+r.failure()?.errorText));
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>!!window.quaterniusRaceLabStatus,{timeout:45000});
   await page.waitForFunction(()=>!!document.querySelector('#v56-full-3d-canvas')||!!document.querySelector('#v56-webgl-status')?.textContent.includes('錯誤'),null,{timeout:45000});
   const canvas=page.locator('#v56-full-3d-canvas');
   await canvas.waitFor({state:'attached',timeout:30000});
   await page.waitForFunction(()=>{
    const c=document.querySelector('#v56-full-3d-canvas');
    return !!c&&c.style.visibility!=='hidden';
   },null,{timeout:45000});
   const pre=await page.evaluate(()=>window.quaterniusRaceLabStatus?.());
   if(pre?.enabled||pre?.loaded)report.warnings.push(viewport.name+': defaults not disabled');
   try{
    await page.locator('#start-btn').click({timeout:7000});
    if(await page.locator('#radio-drive').isVisible())await page.locator('#radio-drive').click({timeout:7000});
   }catch(e){report.warnings.push(viewport.name+': race start UI not fully exercised: '+e.message.slice(0,220));}
   await sleep(4300); // allow countdown to finish before compare; avoid unstable READY overlays.
   const off=await collect(page,viewport.name+'-off','default_OFF',report);
   await page.locator('#quaternius-art-toggle').click({timeout:15000});
   await page.waitForFunction(()=>{
    const x=window.quaterniusRaceLabStatus?.();
    return x?.loaded===true||document.querySelector('#quaternius-art-status')?.textContent?.includes('載入失敗');
   },null,{timeout:45000});
   const onState=await page.evaluate(()=>window.quaterniusRaceLabStatus?.());
   if(!onState?.loaded||!onState?.enabled)report.errors.push(viewport.name+': addon failed to load/activate: '+JSON.stringify(onState));
   await sleep(1100);
   const on=await collect(page,viewport.name+'-on','GLTF_ON',report);
   if(on.sha256===off.sha256)report.errors.push(viewport.name+': identical screenshot hashes after enabling buildings');
   await page.locator('#quaternius-art-toggle').click({timeout:15000});
   await sleep(400);
   const rollback=await page.evaluate(()=>window.quaterniusRaceLabStatus?.());
   if(rollback?.enabled)report.errors.push(viewport.name+': OFF toggle failed');
   await collect(page,viewport.name+'-rollback','OFF_after_ON',report);
   report.errors.push(...errors.filter(e=>!e.includes('AudioContext')));
   // Chrome may cancel duplicate glTF/bin requests after a successful load
   // during or after the automatic screenshot/rollback sequence. A completed
   // addon and rendered screenshot are the independent success evidence.
   const benign=badRequests.filter(e=>e.includes('net::ERR_ABORTED'));
   const failures=badRequests.filter(e=>!e.includes('net::ERR_ABORTED'));
   if(benign.length)report.warnings.push(viewport.name+': '+benign.length+
     ' canceled glTF/texture requests; addon loaded and screenshot was captured');
   if(!onState?.loaded)report.errors.push(...benign);
   report.errors.push(...failures);
   await context.close();
  }
  report.status=report.errors.length?'BROWSER ERRORS — VISUAL REVIEW NOT APPROVED':
   'AUTOMATIC BROWSER QA PASS — HUMAN ART REVIEW STILL REQUIRED';
 }catch(e){
  report.errors.push(String(e.stack||e));report.status='BROWSER RUN FAILED/INCOMPLETE';
 }finally{
  report.completed=new Date().toISOString();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
 console.log(JSON.stringify({status:report.status,images:report.screenshots.length,errors:report.errors,warnings:report.warnings},null,2));
 if(report.errors.length||report.screenshots.length!==6)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
