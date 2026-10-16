'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const URL='https://kevin781130-netizen.github.io/GAME-TEST-LAB/outrun-taipei-v59-handoff-preview/';
const SOURCE='593b22c273050f3bf23cf80ba393b4e5f677b8e3';
const OUT=path.resolve(__dirname,'../../test-results/v59-live-preview');
const scenarios=[
 {name:'desktop-left',viewport:{width:1280,height:800},choice:'↙ 左線快測',to:'2A'},
 {name:'mobile-right',viewport:{width:390,height:844},choice:'右線快測 ↘',to:'2B'}
];
const stats=values=>{
 const arr=values.filter(Number.isFinite).sort((a,b)=>a-b);
 return {n:arr.length,p95Ms:arr.length?arr[Math.ceil(.95*arr.length)-1]:null,maxMs:arr.at(-1)||null};
};
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true,
  args:['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader'],
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const report={schema:'v59.5-live-pages',sourceCommit:SOURCE,url:URL,browser:browser.version(),
  limitations:'Headless Chromium with SwiftShader; not physical-device FPS or GPU completion',scenarios:[]};
 try{
  const c=await browser.newContext();
  const res=await c.request.get(URL+'build-info.json',{timeout:20000});
  assert.equal(res.status(),200,'preview provenance');
  const build=await res.json();
  assert.equal(build.sourceCommit,SOURCE,'preview must match source SHA');
  assert.equal(build.originalProductionPath,'outrun-taipei/');
  await c.close();
  for(const item of scenarios){
   const context=await browser.newContext({viewport:item.viewport});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   try{
    const res=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(res.status(),200,'live preview HTTP 200');
    await page.waitForFunction(()=>Boolean(window.__v59PreviewReport)&&window.v56ThreeStatus?.().ready,
     null,{timeout:60000});
    assert.equal(await page.locator('#v59-handoff-panel').count(),1);
    assert.equal(await page.locator('#v56-full-3d-canvas').count(),1);
    assert.equal(await page.locator('#gameCanvas').evaluate(el=>getComputedStyle(el).visibility),
     'hidden','legacy canvas remains hidden');
    await page.getByRole('button',{name:'展開'}).click();
    await page.screenshot({path:path.join(OUT,item.name+'-before.png')});
    await page.getByRole('button',{name:item.choice}).click();
    await page.keyboard.down('KeyW');
    await page.waitForFunction(to=>window.__v59PreviewReport().switches.some(e=>e.from==='1A'&&e.to===to),
     item.to,{timeout:90000});
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(2100);
    const data=await page.evaluate(()=>window.__v59PreviewReport());
    const event=data.switches.find(e=>e.from==='1A'&&e.to===item.to);
    assert(event,'actual route switch to '+item.to);
    assert(Number.isFinite(event.arrivalRafMs)&&event.arrivalRafMs>=0);
    assert(Number.isFinite(event.arrivalCpuMs)&&event.arrivalCpuMs>=0);
    assert(data.frames.some(f=>Number.isFinite(f.rafMs)&&Number.isFinite(f.cpuMs)));
    assert.deepEqual(errors,[],'no game exceptions');
    await page.screenshot({path:path.join(OUT,item.name+'-after.png')});
    assert(fs.statSync(path.join(OUT,item.name+'-after.png')).size>5000);
    const before=data.frames.filter(f=>f.timeMs>=event.timeMs-2000&&f.timeMs<event.timeMs);
    const after=data.frames.filter(f=>f.timeMs>=event.timeMs&&f.timeMs<=event.timeMs+2000);
    report.scenarios.push({label:item.name,viewport:item.viewport,event,
     beforeRaf:stats(before.map(f=>f.rafMs)),afterRaf:stats(after.map(f=>f.rafMs)),
     beforeCpu:stats(before.map(f=>f.cpuMs)),afterCpu:stats(after.map(f=>f.cpuMs)),
     activeDriftBefore:!!event.before.isDrifting,
     activeDriftContinued:event.before.isDrifting?!!event.after.isDrifting:null,
     frameCount:data.frames.length,errors});
    console.log(item.name+' '+event.from+'→'+event.to+
     ' RAF '+event.arrivalRafMs+'ms CPU '+event.arrivalCpuMs+'ms');
   }finally{await context.close();}
  }
  assert.equal(report.scenarios.length,2);
  report.passed=true;
  fs.writeFileSync(path.join(OUT,'live-pages-qa.json'),JSON.stringify(report,null,2)+'\n');
  console.log('V59 live Pages Chromium WebGL QA passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
