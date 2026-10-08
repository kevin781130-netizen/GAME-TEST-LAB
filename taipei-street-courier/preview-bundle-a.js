
/* P2 Preview module: three-compat.js */
/* Three.js r152+ 色彩 / 燈光管線的單一設定點（必須是 game-entry 的第一個 script；r168 起 THREE 為 esbuild 打出的全域物件）。
 *
 * 遊戲的所有顏色、燈光強度與 toneMappingExposure 都是在 r128–r148 的「legacy」管線下調好的：
 *   - hex 顏色不做 sRGB→linear 轉換；
 *   - 貼圖以 sRGB 解碼、輸出為 sRGB；
 *   - 燈光使用 legacy 強度（非物理單位）。
 * r152 起 ColorManagement 預設開啟、r155 起 useLegacyLights 預設關閉，兩者都會讓畫面明顯變暗並偏色。
 * 這裡集中把它們固定回 legacy 行為（r165+ 的燈光以 ×π 轉換重現，見下方），不在各處加 magic number。日後若要採用物理燈光 / 色彩管理，
 * 應整體重新調色（見 docs/THREE-UPGRADE.md），而不是移除單一旗標。 */
(function(){
  if(typeof THREE==='undefined'||!THREE.REVISION)return;
  const rev=parseInt(THREE.REVISION,10);
  if(rev<152)return;
  THREE.ColorManagement.enabled=false;
  // r162 移除 sRGBEncoding / LinearEncoding 常數；遊戲仍以它們指定貼圖與輸出，故補回同值常數（只當舊 API 的鍵）。
  if(THREE.sRGBEncoding===undefined)THREE.sRGBEncoding=3001;
  if(THREE.LinearEncoding===undefined)THREE.LinearEncoding=3000;
  // 舊 API（texture.encoding / renderer.outputEncoding）在 r152+ 只剩會警告的別名；改為靜默映射到 colorSpace。
  const toSpace=v=>v===THREE.sRGBEncoding?THREE.SRGBColorSpace:THREE.LinearSRGBColorSpace;
  const toEnc=s=>s===THREE.SRGBColorSpace?THREE.sRGBEncoding:THREE.LinearEncoding;
  Object.defineProperty(THREE.Texture.prototype,'encoding',{configurable:true,get(){return toEnc(this.colorSpace);},set(v){this.colorSpace=toSpace(v);}});
  Object.defineProperty(THREE.WebGLRenderer.prototype,'outputEncoding',{configurable:true,get(){return toEnc(this.outputColorSpace);},set(v){this.outputColorSpace=toSpace(v);}});
  if(rev>=155&&rev<165){
    // r155–r164：沿用內建 legacy 強度（useLegacyLights 於 r165 移除）。
    const Base=THREE.WebGLRenderer;
    THREE.WebGLRenderer=class extends Base{constructor(...args){super(...args);this.useLegacyLights=true;}};
  }
  if(rev>=165){
    // r165+ 只剩物理燈光。legacy 模式只是把所有燈光顏色×π（WebGLLights: scaleFactor=PI；Lambert BRDF 為 1/π），
    // 因此在每次 render 前把「scene 直接子層」的燈光強度×π、render 後還原，即得到與 legacy 完全相同的光照。
    // 遊戲只有 Hemisphere + 2 Directional（皆為 scene 直接子層，無 Point/Spot/lightMap）；新增其他燈光類型時需重新評估。
    const Base=THREE.WebGLRenderer,PI=Math.PI;
    // 注意：WebGLRenderer.render 是 constructor 內指派的實例屬性，subclass 方法會被蓋掉，必須包裝實例上的函式。
    THREE.WebGLRenderer=class extends Base{
      constructor(...args){
        super(...args);
        const inner=this.render;
        this.render=function(scene,camera){
          const lights=[];
          for(const o of scene.children)if(o.isLight){lights.push([o,o.intensity]);o.intensity*=PI;}
          try{return inner.call(this,scene,camera);}finally{for(const [o,i] of lights)o.intensity=i;}
        };
      }
    };
  }
})();


/* P2 Preview module: city-engine.js */
if(typeof THREE==='undefined'){document.body.innerHTML='<h1 style="color:#fff;padding:50px;">Three.js 載入失敗</h1>';throw new Error("no three");}

const DRIVERS = {
  lin: {name:'米米',letter:'米',title:'虎斑快手',species:'tabby',cab:"橘色城市快送機車",color:0xF2A33B,
    topSpeed:88,accel:90,steerRate:2.5,phrase:"喵！這單我先衝啦！",pitch:1.15,hornFreq:440},
  chen:{name:'梅醬',letter:'梅',title:'布偶探路員',species:'ragdoll',cab:"探險長途快送機車",color:0xC6843D,
    topSpeed:98,accel:80,steerRate:2.2,phrase:"喵嗚，地圖看好了，出發！",pitch:1.05,hornFreq:480},
  mei: {name:'波波',letter:'波',title:'柴犬彎道王',species:'shiba',cab:"藍色靈巧街頭機車",color:0x3188C8,
    topSpeed:86,accel:105,steerRate:2.8,phrase:"汪！這個彎交給我！",pitch:1.25,hornFreq:520},
  zhou:  {name:'哈弟',letter:'哈',title:'哈士奇重載手',species:'husky',cab:"冬季穩健載貨機車",color:0x4C78A8,
    topSpeed:76,accel:75,steerRate:2.0,phrase:"汪嗚！穩穩送到就對了！",pitch:0.88,hornFreq:330}
};

const TAIPEI_ROADS = [
  {name:'忠孝東西路',width:22,pts:[[25.0415,121.5080],[25.0418,121.5150],[25.0420,121.5220],[25.0421,121.5300],[25.0422,121.5380],[25.0423,121.5460],[25.0425,121.5540],[25.0426,121.5620],[25.0428,121.5700],[25.0430,121.5780]]},
  {name:'仁愛路',width:22,pts:[[25.0375,121.5080],[25.0377,121.5150],[25.0379,121.5220],[25.0380,121.5300],[25.0382,121.5380],[25.0383,121.5460],[25.0385,121.5540]]},
  {name:'信義路',width:22,pts:[[25.0330,121.5080],[25.0332,121.5150],[25.0334,121.5220],[25.0335,121.5300],[25.0337,121.5380],[25.0338,121.5460],[25.0340,121.5540],[25.0341,121.5620],[25.0343,121.5700]]},
  {name:'和平東西路',width:18,pts:[[25.0260,121.5150],[25.0262,121.5220],[25.0264,121.5300],[25.0265,121.5380],[25.0267,121.5460]]},
  {name:'基隆路',width:24,pts:[[25.0330,121.5580],[25.0380,121.5580],[25.0430,121.5580],[25.0480,121.5580],[25.0530,121.5580],[25.0580,121.5580],[25.0630,121.5580]]},
  {name:'復興南北路',width:22,pts:[[25.0330,121.5440],[25.0400,121.5440],[25.0470,121.5440],[25.0540,121.5440],[25.0610,121.5440],[25.0680,121.5440]]},
  {name:'敦化南北路',width:22,pts:[[25.0260,121.5490],[25.0330,121.5490],[25.0400,121.5490],[25.0470,121.5490],[25.0540,121.5490]]},
  {name:'松仁路',width:20,pts:[[25.0280,121.5680],[25.0330,121.5680],[25.0380,121.5680],[25.0430,121.5680]]},
  {name:'中山南北路',width:20,pts:[[25.0480,121.5220],[25.0550,121.5220],[25.0620,121.5220],[25.0690,121.5220],[25.0760,121.5220]]},
  {name:'中華路',width:22,pts:[[25.0330,121.5080],[25.0400,121.5080],[25.0470,121.5080],[25.0540,121.5080]]},
  {name:'羅斯福路',width:20,pts:[[25.0140,121.5220],[25.0210,121.5220],[25.0280,121.5220],[25.0350,121.5220]]},
  {name:'建國南北路',width:20,pts:[[25.0330,121.5360],[25.0400,121.5360],[25.0470,121.5360],[25.0540,121.5360],[25.0610,121.5360]]},
  {name:'新生南北路',width:20,pts:[[25.0330,121.5300],[25.0400,121.5300],[25.0470,121.5300],[25.0540,121.5300]]},
  {name:'民權東西路',width:20,pts:[[25.0630,121.5080],[25.0632,121.5160],[25.0634,121.5240],[25.0635,121.5320],[25.0637,121.5400],[25.0638,121.5480],[25.0640,121.5560]]},
  {name:'南京東西路',width:22,pts:[[25.0515,121.5080],[25.0517,121.5160],[25.0519,121.5240],[25.0520,121.5320],[25.0522,121.5400],[25.0524,121.5480],[25.0525,121.5560],[25.0527,121.5640]]},
  {name:'八德路',width:18,pts:[[25.0470,121.5220],[25.0472,121.5300],[25.0474,121.5380],[25.0475,121.5460],[25.0477,121.5540]]},
  {name:'市民大道',width:18,pts:[[25.0480,121.5080],[25.0482,121.5160],[25.0484,121.5240],[25.0485,121.5320],[25.0487,121.5400],[25.0488,121.5480],[25.0490,121.5560]]},
  {name:'光復南路',width:20,pts:[[25.0260,121.5550],[25.0330,121.5550],[25.0400,121.5550],[25.0470,121.5550]]},
  {name:'辛亥路',width:18,pts:[[25.0200,121.5220],[25.0202,121.5300],[25.0204,121.5380],[25.0206,121.5460],[25.0208,121.5540]]}
];

const TextureGenerator = {
  createRoadTexture(){
    const c=document.createElement('canvas');c.width=512;c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#25252A';ctx.fillRect(0,0,512,512);
    for(let i=0;i<5000;i++){ctx.fillStyle=Math.random()>.5?'#303035':'#1A1A1E';ctx.fillRect(Math.random()*512,Math.random()*512,2,2);}
    ctx.fillStyle='#FFAA00';ctx.fillRect(250,0,3,512);ctx.fillRect(259,0,3,512);
    ctx.fillStyle='#FFFFFF';for(let y=0;y<512;y+=64){ctx.fillRect(124,y+12,7,38);ctx.fillRect(381,y+12,7,38);}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;},
  createWetRoadTexture(){
    const c=document.createElement('canvas');c.width=512;c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#15151A';ctx.fillRect(0,0,512,512);
    for(let i=0;i<8000;i++){ctx.fillStyle=Math.random()>.6?'#1E1E24':'#0D0D12';ctx.fillRect(Math.random()*512,Math.random()*512,2,2);}
    ctx.fillStyle='#FFAA00';ctx.fillRect(250,0,3,512);ctx.fillRect(259,0,3,512);
    ctx.fillStyle='#DDDDDD';for(let y=0;y<512;y+=64){ctx.fillRect(124,y+12,7,38);ctx.fillRect(381,y+12,7,38);}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;},
  createGroundTexture(){
    const c=document.createElement('canvas');c.width=512;c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#4A4A3E';ctx.fillRect(0,0,512,512);
    for(let i=0;i<15000;i++){
      const g=Math.random();let col;
      if(g>.7)col='#5A5A48';else if(g>.5)col='#3E3E30';
      else if(g>.3)col='#4A5540';else if(g>.15)col='#353530';else col='#55554A';
      ctx.fillStyle=col;ctx.fillRect(Math.random()*512,Math.random()*512,3,3);}
    for(let i=0;i<300;i++){ctx.fillStyle='rgba(200,200,180,0.35)';
      ctx.beginPath();ctx.arc(Math.random()*512,Math.random()*512,1+Math.random()*2,0,Math.PI*2);ctx.fill();}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(50,50);return t;},
  createSidewalkTexture(){
    const c=document.createElement('canvas');c.width=128;c.height=128;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#9A9A96';ctx.fillRect(0,0,128,128);
    ctx.strokeStyle='#7A7A76';ctx.lineWidth=2;
    for(let i=0;i<=128;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;},
  createBuildingTexture(color){
    const c=document.createElement('canvas');c.width=256;c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillRect(0,0,256,512);
    ctx.fillStyle='#88CCFF';
    for(let y=30;y<490;y+=42){for(let x=20;x<240;x+=40){if(Math.random()>.15)ctx.fillRect(x,y,24,26);}}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;},
  createEmissiveWindowTexture(){
    const c=document.createElement('canvas');c.width=256;c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#000000';ctx.fillRect(0,0,256,512);
    for(let y=30;y<490;y+=42){for(let x=20;x<240;x+=40){
      if(Math.random()<.68){const b=.55+Math.random()*.45;
        ctx.fillStyle=`rgb(${Math.floor(255*b)},${Math.floor(220*b)},${Math.floor(140*b)})`;
        ctx.fillRect(x,y,24,26);}}}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;},
  createBrandedSignTexture(text,bg,fg){
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const ctx=c.getContext('2d');
    ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);
    ctx.strokeStyle='#FFF';ctx.lineWidth=6;ctx.strokeRect(6,6,500,116);
    ctx.fillStyle=fg;ctx.font='bold 48px "Noto Sans TC",Arial,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
    return new THREE.CanvasTexture(c);},
  createCloudTexture(){
    const c=document.createElement('canvas');c.width=256;c.height=128;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,256,128);
    for(let i=0;i<22;i++){
      const x=30+Math.random()*196,y=40+Math.random()*55,r=18+Math.random()*38;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,255,255,0.95)');
      g.addColorStop(0.45,'rgba(245,245,255,0.55)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    return new THREE.CanvasTexture(c);}
};

class CourierAudio {
  constructor(){this.ctx=null;this.currentStation=0;this.radioPlaying=false;this.radioTimer=null;}
  init(){if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{this.ctx=new AC();}catch{return;}}
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    if(!this.engineOsc1){this.setupEngine();this.setupSkid();}}
  setupEngine(){if(!this.ctx)return;
    this.engineOsc1=this.ctx.createOscillator();this.engineOsc2=this.ctx.createOscillator();
    this.engineOsc1.type='sawtooth';this.engineOsc2.type='triangle';
    this.engineGain=this.ctx.createGain();this.engineGain.gain.setValueAtTime(.001,this.ctx.currentTime);
    this.engineFilter=this.ctx.createBiquadFilter();this.engineFilter.type='lowpass';
    this.engineOsc1.connect(this.engineFilter);this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);this.engineGain.connect(this.ctx.destination);
    this.engineOsc1.start();this.engineOsc2.start();}
  updateEngine(r){if(!this.ctx||this.ctx.state!=='running'||!this.engineOsc1)return;
    const n=this.ctx.currentTime;const f=48+r*180;
    this.engineOsc1.frequency.setTargetAtTime(f,n,.05);
    this.engineOsc2.frequency.setTargetAtTime(f*.5,n,.05);
    this.engineFilter.frequency.setTargetAtTime(250+r*1200,n,.05);
    this.engineGain.gain.setTargetAtTime(.12+Math.min(r*.15,.2),n,.05);}
  setupSkid(){if(!this.ctx)return;
    const bs=this.ctx.sampleRate*2;const buf=this.ctx.createBuffer(1,bs,this.ctx.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<bs;i++)d[i]=Math.random()*2-1;
    this.skidNoise=this.ctx.createBufferSource();this.skidNoise.buffer=buf;this.skidNoise.loop=true;
    this.skidFilter=this.ctx.createBiquadFilter();this.skidFilter.type='bandpass';this.skidFilter.frequency.value=1100;
    this.skidGain=this.ctx.createGain();this.skidGain.gain.value=.0001;
    this.skidNoise.connect(this.skidFilter);this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.ctx.destination);this.skidNoise.start();}
  setSkidVolume(v){if(!this.ctx||this.ctx.state!=='running'||!this.skidGain)return;
    this.skidGain.gain.setTargetAtTime(Math.min(v,.35),this.ctx.currentTime,.05);}
  playBoost(){if(!this.ctx||this.ctx.state!=='running')return;const n=this.ctx.currentTime;
    const o=this.ctx.createOscillator();const g=this.ctx.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(120,n);
    o.frequency.exponentialRampToValueAtTime(750,n+.35);
    g.gain.setValueAtTime(.35,n);g.gain.exponentialRampToValueAtTime(.001,n+.45);
    o.connect(g);g.connect(this.ctx.destination);o.start(n);o.stop(n+.45);}
  playHop(){if(!this.ctx||this.ctx.state!=='running')return;const n=this.ctx.currentTime;
    const o=this.ctx.createOscillator();const g=this.ctx.createGain();
    o.type='sine';o.frequency.setValueAtTime(220,n);
    o.frequency.exponentialRampToValueAtTime(880,n+.2);
    g.gain.setValueAtTime(.3,n);g.gain.exponentialRampToValueAtTime(.01,n+.28);
    o.connect(g);g.connect(this.ctx.destination);o.start(n);o.stop(n+.3);}
  playHorn(f=440){if(!this.ctx||this.ctx.state!=='running')return;const n=this.ctx.currentTime;
    const o1=this.ctx.createOscillator();const o2=this.ctx.createOscillator();const g=this.ctx.createGain();
    o1.frequency.value=f;o2.frequency.value=f*1.25;
    g.gain.setValueAtTime(.2,n);g.gain.exponentialRampToValueAtTime(.01,n+.3);
    o1.connect(g);o2.connect(g);g.connect(this.ctx.destination);
    o1.start(n);o2.start(n);o1.stop(n+.32);o2.stop(n+.32);}
  playCrash(){if(!this.ctx||this.ctx.state!=='running')return;const n=this.ctx.currentTime;
    const o=this.ctx.createOscillator();const g=this.ctx.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(150,n);
    o.frequency.exponentialRampToValueAtTime(30,n+.35);
    g.gain.setValueAtTime(.4,n);g.gain.exponentialRampToValueAtTime(.01,n+.4);
    o.connect(g);g.connect(this.ctx.destination);o.start(n);o.stop(n+.42);}
  playCash(){if(!this.ctx||this.ctx.state!=='running')return;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
      const n=this.ctx.currentTime+i*.08;
      const o=this.ctx.createOscillator();const g=this.ctx.createGain();
      o.type='triangle';o.frequency.value=f;
      g.gain.setValueAtTime(.25,n);g.gain.exponentialRampToValueAtTime(.001,n+.25);
      o.connect(g);g.connect(this.ctx.destination);o.start(n);o.stop(n+.26);});}
  playTunerStatic(){if(!this.ctx||this.ctx.state!=='running')return;const n=this.ctx.currentTime;
    const o=this.ctx.createOscillator();const g=this.ctx.createGain();
    o.type='square';o.frequency.setValueAtTime(800+Math.random()*600,n);
    g.gain.setValueAtTime(.15,n);g.gain.linearRampToValueAtTime(.01,n+.15);
    o.connect(g);g.connect(this.ctx.destination);o.start(n);o.stop(n+.16);}
  toggleRadio(){this.currentStation=(this.currentStation+1)%3;this.playTunerStatic();return this.getStationName();}
  getStationName(){return["電台 1：搖滾台北 101","電台 2：西岸硬核","電台 3：復古衝浪"][this.currentStation];}
  startRadio(){if(this.radioPlaying)return;this.radioPlaying=true;this.runRadioStep=0;this.playRadioBeat();}
  playRadioBeat(){if(!this.radioPlaying||!this.ctx)return;if(this.ctx.state!=='running'){this.radioTimer=setTimeout(()=>this.playRadioBeat(),250);return;}
    const step=this.runRadioStep%16;const n=this.ctx.currentTime;
    let bpm=205;if(this.currentStation===1)bpm=195;if(this.currentStation===2)bpm=165;
    const st=60/bpm/4;
    if(step===0||step===6||step===8||step===14){
      const k=this.ctx.createOscillator();const kg=this.ctx.createGain();
      k.frequency.setValueAtTime(140,n);k.frequency.exponentialRampToValueAtTime(35,n+.08);
      kg.gain.setValueAtTime(.3,n);kg.gain.exponentialRampToValueAtTime(.01,n+.09);
      k.connect(kg);kg.connect(this.ctx.destination);k.start(n);k.stop(n+.1);}
    if(step===4||step===12){
      const s=this.ctx.createOscillator();const sg=this.ctx.createGain();
      s.type='triangle';s.frequency.setValueAtTime(220,n);
      sg.gain.setValueAtTime(.2,n);sg.gain.exponentialRampToValueAtTime(.01,n+.1);
      s.connect(sg);sg.connect(this.ctx.destination);s.start(n);s.stop(n+.11);}
    if(step%2===0){
      const g=this.ctx.createOscillator();const gg=this.ctx.createGain();
      g.type='sawtooth';
      const ch=this.currentStation===0?[146.83,146.83,220,196]:
               this.currentStation===1?[164.81,130.81,196,146.83]:[110,110,146.83,146.83];
      const rf=ch[Math.floor(this.runRadioStep/8)%ch.length];
      g.frequency.setValueAtTime(rf*(step%4===0?1:1.5),n);
      gg.gain.setValueAtTime(.12,n);gg.gain.exponentialRampToValueAtTime(.01,n+st*1.5);
      g.connect(gg);gg.connect(this.ctx.destination);g.start(n);g.stop(n+st*1.6);}
    this.runRadioStep++;this.radioTimer=setTimeout(()=>this.playRadioBeat(),st*1000);}
  speak(){}

}

class TaipeiCityGame {
  constructor(){
    this.selectedDriverKey='lin';this.currentDriver=DRIVERS.lin;
    this.selectedMode='ARCADE';this.isManualShift=false;
    this.audio=new CourierAudio();
    this.gameState='LOADING';
    this.gameTime=50;this.totalFare=0;this.currentTip=0;
    this.comboCount=0;this.maxCombo=0;this.deliveredCount=0;this.speedyCount=0;
    this.bowlingPinsStruck=0;this.maxJumpDistance=0;
    this.carPos=new THREE.Vector3(0,.5,0);this.carRotY=0;this.carSpeed=0;this.carVy=0;
    this.isGrounded=true;this.currentGear='D';this.driftFactor=0;
    this.activeCustomerTimer=0;this.activeCustomerInitialTime=1;
    this.keys={};this.cameraMode=0;
    this.isNight=false;this.isRaining=false;this.highQuality=true;
    this.lastTime=performance.now();
  }

  async init(){
    this.initDOM();this.initTouchControls();
    this.updateLoading(10);await this.delay(50);
    await this.initThree();
    this.updateLoading(100);await this.delay(300);
    document.getElementById('loading-screen').style.display='none';
    document.getElementById('overlay-screen').style.display='flex';
    this.gameState='TITLE';
    requestAnimationFrame(t=>this.loop(t));
  }
  delay(ms){return new Promise(r=>setTimeout(r,ms));}
  updateLoading(p){document.getElementById('loading-fill').style.width=p+'%';}

  initDOM(){
    document.querySelectorAll('.driver-card').forEach(card=>{
      card.addEventListener('click',()=>{
        document.querySelectorAll('.driver-card').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedDriverKey=card.dataset.driver;
        this.currentDriver=DRIVERS[this.selectedDriverKey];
        this.audio.init();
        this.audio.speak(this.currentDriver.phrase,this.currentDriver.pitch);
        this.updatePlayerTaxiModel();});});
    document.querySelectorAll('.mode-card').forEach(card=>{
      card.addEventListener('click',()=>{
        document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');this.selectedMode=card.dataset.mode;
        document.getElementById('hud-mode-badge').innerText=card.querySelector('.mode-card-title').innerText;});});
    document.getElementById('btn-toggle-shift-mode').addEventListener('click',()=>{
      this.isManualShift=!this.isManualShift;
      document.getElementById('btn-toggle-shift-mode').innerText=
        `排檔：${this.isManualShift?'手動':'自動'}`;});
    document.getElementById('btn-start').addEventListener('click',()=>this.startGame());
    document.getElementById('btn-restart').addEventListener('click',()=>{
      document.getElementById('license-screen').style.display='none';
      document.getElementById('overlay-screen').style.display='flex';
      this.gameState='TITLE';});
    document.getElementById('btn-open-manual').addEventListener('click',()=>{document.getElementById('manual-modal').style.display='flex';});
    document.getElementById('btn-close-manual').addEventListener('click',()=>{document.getElementById('manual-modal').style.display='none';});
    document.getElementById('btn-weather').addEventListener('click',()=>this.toggleRain());
    document.getElementById('btn-daynight').addEventListener('click',()=>this.toggleNight());
    document.getElementById('btn-quality').addEventListener('click',()=>this.toggleQuality());
    window.addEventListener('keydown',e=>this.handleKeyDown(e));
    window.addEventListener('keyup',e=>this.handleKeyUp(e));
    window.addEventListener('resize',()=>this.onWindowResize());
  }

  handleKeyUp(e){this.keys[e.code]=false;}

  toggleGear(){
    this.currentGear=this.currentGear==='D'?'R':'D';
    const d=document.getElementById('gear-d'),r=document.getElementById('gear-r');
    if(this.currentGear==='D'){d.className='gear-item active-d';r.className='gear-item';}
    else{d.className='gear-item';r.className='gear-item active-r';}
    this.audio.playBoost();
  }

  toggleNight(){
    this.isNight=!this.isNight;
    document.getElementById('btn-daynight').innerText='時間：'+(this.isNight?'夜晚':'白天');
    document.getElementById('btn-daynight').classList.toggle('on',this.isNight);
    this.applyLighting();
  }

  applyLighting(){
    if(this.isNight){
      this.scene.background.setHex(0x070B16);
      this.scene.fog.color.setHex(0x0A0E1A);
      this.scene.fog.density=0.0009;
      if(this.hemiLight){this.hemiLight.intensity=.22;this.hemiLight.color.setHex(0x334466);this.hemiLight.groundColor.setHex(0x111122);}
      if(this.dirLight){this.dirLight.intensity=.15;this.dirLight.color.setHex(0x6677AA);}
      if(this.fillLight){this.fillLight.intensity=.35;this.fillLight.color.setHex(0xFFAA66);}
      this.scene.traverse(o=>{
        if(o.isMesh&&o.material&&o.geometry&&o.geometry.type==='BoxGeometry'
           &&o.geometry.parameters.height>20&&!o.userData.isSign&&o.material.emissiveMap===null){
          o.material.emissiveMap=this.emissiveWindowTex;
          o.material.emissive=new THREE.Color(0xFFDD88);
          o.material.emissiveIntensity=0.9;
          o.material.needsUpdate=true;}});
      if(this.signMeshes){
        this.signMeshes.forEach(m=>{
          const oc=new THREE.Color(m.userData.signColor);
          oc.r=Math.min(oc.r*2.2,1);oc.g=Math.min(oc.g*2.2,1);oc.b=Math.min(oc.b*2.2,1);
          m.material.color.copy(oc);});}
      if(this.clouds){this.clouds.forEach(c=>c.material.color.setHex(0x5566AA));}
      if(this.bloomPass){this.bloomPass.strength=1.1;this.bloomPass.radius=0.7;}
    }else{
      this.scene.background.setHex(0x9BC4E2);
      this.scene.fog.color.setHex(0xB8A98A);
      this.scene.fog.density=0.0004;
      if(this.hemiLight){this.hemiLight.intensity=.85;this.hemiLight.color.setHex(0xFFE4B5);this.hemiLight.groundColor.setHex(0x3A4A3A);}
      if(this.dirLight){this.dirLight.intensity=1.1;this.dirLight.color.setHex(0xFFD890);}
      if(this.fillLight){this.fillLight.intensity=.3;this.fillLight.color.setHex(0xFFAA66);}
      this.scene.traverse(o=>{
        if(o.isMesh&&o.material&&o.material.emissiveMap===this.emissiveWindowTex){
          o.material.emissive=new THREE.Color(0x000000);
          o.material.emissiveIntensity=0;
          o.material.needsUpdate=true;}});
      if(this.signMeshes){this.signMeshes.forEach(m=>m.material.color.setHex(m.userData.signColor));}
      if(this.clouds){this.clouds.forEach(c=>c.material.color.setHex(0xFFFFFF));}
      if(this.bloomPass)this.bloomPass.strength=0.35;
    }
  }

  toggleRain(){
    this.isRaining=!this.isRaining;
    document.getElementById('btn-weather').innerText='天氣：'+(this.isRaining?'雨':'晴');
    document.getElementById('btn-weather').classList.toggle('on',this.isRaining);
    this.scene.traverse(o=>{
      if(o.isMesh&&o.userData&&o.userData.isRoad){
        if(this.isRaining){
          o.material.roughness=0.12;o.material.metalness=0.35;
          if(o.userData.dryTexture)o.material.map=this.wetRoadTexture;
        }else{
          o.material.roughness=0.85;o.material.metalness=0.05;
          if(o.userData.dryTexture)o.material.map=o.userData.dryTexture;}
        o.material.needsUpdate=true;}});
  }

  toggleQuality(){
    this.highQuality=!this.highQuality;
    document.getElementById('btn-quality').innerText='畫質：'+(this.highQuality?'高':'低');
    if(this.renderer)this.renderer.setPixelRatio(this.highQuality?Math.min(window.devicePixelRatio,2):1);
    if(this.bloomPass)this.bloomPass.enabled=this.highQuality;
    if(this.rainMesh)this.rainMesh.visible=this.isRaining&&this.highQuality;
  }

  showStatusToast(msg){
    const t=document.getElementById('hud-status-toast');
    t.innerText=msg;t.style.opacity='1';
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{t.style.opacity='0';},1800);
  }

  async initThree(){
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x9BC4E2);
    this.scene.fog=new THREE.FogExp2(0xB8A98A,0.0004);

    const skyGeo=new THREE.SphereGeometry(4000,32,16);
    const skyMat=new THREE.MeshBasicMaterial({map:this.createSkyTexture(),side:THREE.BackSide,fog:false});
    this.scene.add(new THREE.Mesh(skyGeo,skyMat));

    this.camera=new THREE.PerspectiveCamera(65,window.innerWidth/window.innerHeight,.1,10000);

    this.renderer=new THREE.WebGLRenderer({canvas:document.getElementById('game-canvas'),
      antialias:true,powerPreference:'high-performance'});
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.15;
    if(THREE.sRGBEncoding!==undefined)this.renderer.outputEncoding=THREE.sRGBEncoding;

    this.hemiLight=new THREE.HemisphereLight(0xFFE4B5,0x3A4A3A,.85);
    this.scene.add(this.hemiLight);
    this.dirLight=new THREE.DirectionalLight(0xFFD890,1.1);
    this.dirLight.position.set(300,500,200);
    this.dirLight.castShadow=true;
    this.dirLight.shadow.mapSize.width=2048;this.dirLight.shadow.mapSize.height=2048;
    this.dirLight.shadow.camera.left=-500;this.dirLight.shadow.camera.right=500;
    this.dirLight.shadow.camera.top=500;this.dirLight.shadow.camera.bottom=-500;
    this.dirLight.shadow.bias=-0.0005;
    this.scene.add(this.dirLight);
    this.fillLight=new THREE.DirectionalLight(0xFFAA66,.3);
    this.fillLight.position.set(-200,300,-150);
    this.scene.add(this.fillLight);

    this.roadTexture=TextureGenerator.createRoadTexture();
    this.wetRoadTexture=TextureGenerator.createWetRoadTexture();
    this.roadTexture.repeat.set(1,8);
    this.wetRoadTexture.repeat.set(1,8);
    this.sidewalkTexture=TextureGenerator.createSidewalkTexture();
    this.emissiveWindowTex=TextureGenerator.createEmissiveWindowTexture();

    this.updateLoading(25);
    this.buildTaipeiWorld();
    this.updateLoading(60);

    this.buildPlayerTaxi();
    this.build3DCompass();
    await this.delay(20);
    this.spawnCivilianTraffic();
    this.spawnScooters();
    this.spawnScooterWaves();
    this.spawnWorldCustomers();
    this.spawnBowlingPins();
    this.spawnDestructibleProps();
    this.createClouds();
    this.updateLoading(85);

    this.initPostProcessing();
    this.createRain();
    this.enhanceSigns();
    this.updateLoading(95);
  }

  createSkyTexture(){
    const c=document.createElement('canvas');c.width=16;c.height=512;
    const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,512);
    g.addColorStop(0.0,'#1a3550');g.addColorStop(0.35,'#4a78a8');
    g.addColorStop(0.65,'#a8c4dd');g.addColorStop(0.85,'#e8d5a8');
    g.addColorStop(1.0,'#d4a878');
    ctx.fillStyle=g;ctx.fillRect(0,0,16,512);
    return new THREE.CanvasTexture(c);
  }

  onWindowResize(){
    this.camera.aspect=window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    if(this.composer)this.composer.setSize(window.innerWidth,window.innerHeight);
  }

  latLngToWorld(lat,lng){
    const refLat=25.045,refLng=121.545;
    const scaleLng=20000,scaleLat=22200;
    return {x:(lng-refLng)*scaleLng,z:-(lat-refLat)*scaleLat};
  }

  buildTaipeiWorld(){
    const gGeo=new THREE.PlaneGeometry(8000,8000,128,128);gGeo.rotateX(-Math.PI/2);
    const p=gGeo.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,this.getTerrainHeight(p.getX(i),p.getZ(i)));
    gGeo.computeVertexNormals();
    const gMat=new THREE.MeshLambertMaterial({map:TextureGenerator.createGroundTexture()});
    this.groundMesh=new THREE.Mesh(gGeo,gMat);
    this.groundMesh.receiveShadow=true;this.scene.add(this.groundMesh);

    const waterMat=new THREE.MeshPhongMaterial({color:0x3A7A9A,transparent:true,opacity:.85,shininess:80});
    const river=new THREE.Mesh(new THREE.PlaneGeometry(200,3000).rotateX(-Math.PI/2),waterMat);
    river.position.set(-1400,-1,0);this.scene.add(river);
    const keelung=new THREE.Mesh(new THREE.PlaneGeometry(2400,90).rotateX(-Math.PI/2),waterMat.clone());
    keelung.position.set(0,-.5,-680);this.scene.add(keelung);

    this.roadGraph=[];
    this.buildRoadsFromData(TAIPEI_ROADS);
    this.buildTaipeiLandmarks();
  }

  buildRoadsFromData(roads){
    const roadMat=new THREE.MeshStandardMaterial({map:this.roadTexture,roughness:0.85,metalness:0.05});
    const swMat=new THREE.MeshLambertMaterial({map:this.sidewalkTexture});
    roads.forEach(road=>{
      const w=road.width/1.7;
      const nodes=road.pts.map(p=>this.latLngToWorld(p[0],p[1]));
      for(let i=0;i<nodes.length-1;i++){
        const a=nodes[i],b=nodes[i+1];
        const dx=b.x-a.x,dz=b.z-a.z;
        const len=Math.sqrt(dx*dx+dz*dz);
        if(len<1)continue;
        const angle=Math.atan2(dx,dz);
        const cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
        const cy=this.getTerrainHeight(cx,cz)+0.15;

        const geo=new THREE.PlaneGeometry(w,len,1,12);geo.rotateX(-Math.PI/2);const vertices=geo.attributes.position;for(let vi=0;vi<vertices.count;vi++){const lx=vertices.getX(vi),lz=vertices.getZ(vi);const wx=cx+lx*Math.cos(angle)+lz*Math.sin(angle),wz=cz-lx*Math.sin(angle)+lz*Math.cos(angle);vertices.setY(vi,this.getTerrainHeight(wx,wz)+.15-cy);}geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,roadMat);
        mesh.position.set(cx,cy,cz);mesh.rotation.y=angle;
        mesh.receiveShadow=true;
        mesh.userData.isRoad=true;mesh.userData.dryTexture=this.roadTexture;
        this.scene.add(mesh);

        [1,-1].forEach(side=>{
          const swW=1.5;
          const swGeo=new THREE.PlaneGeometry(swW,len,1,12);swGeo.rotateX(-Math.PI/2);
          const sw=new THREE.Mesh(swGeo,swMat);
          const ox=side*(w/2+swW/2)*Math.cos(angle);
          const oz=-side*(w/2+swW/2)*Math.sin(angle);
          const sy=this.getTerrainHeight(cx+ox,cz+oz)+0.22;
          const sv=swGeo.attributes.position;for(let vi=0;vi<sv.count;vi++){const lx=sv.getX(vi),lz=sv.getZ(vi),wx=cx+ox+lx*Math.cos(angle)+lz*Math.sin(angle),wz=cz+oz-lx*Math.sin(angle)+lz*Math.cos(angle);sv.setY(vi,this.getTerrainHeight(wx,wz)+.22-sy);}swGeo.computeVertexNormals();sw.position.set(cx+ox,sy,cz+oz);sw.rotation.y=angle;
          sw.receiveShadow=true;this.scene.add(sw);});

        if(len>20){
          const lampCount=Math.max(1,Math.floor(len/40));
          for(let k=0;k<lampCount;k++){
            const t=(k+0.5)/lampCount-0.5;
            const lx=t*len;
            const side=k%2===0?1:-1;
            const localX=side*(w/2+0.8);
            const worldX=cx+localX*Math.cos(angle)+lx*Math.sin(angle);
            const worldZ=cz-localX*Math.sin(angle)+lx*Math.cos(angle);
            this.createStreetLamp(worldX,worldZ);}}
      }
      this.roadGraph.push(nodes);
    });
  }

  createStreetLamp(x,z){
    const y=this.getTerrainHeight(x,z);
    const g=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,6,6),
      new THREE.MeshLambertMaterial({color:0x2A2A2A}));
    pole.position.y=3;pole.castShadow=true;g.add(pole);
    const head=new THREE.Mesh(new THREE.BoxGeometry(1,.3,.6),
      new THREE.MeshLambertMaterial({color:0x333333}));
    head.position.y=6;g.add(head);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),
      new THREE.MeshBasicMaterial({color:0xFFEE99}));
    bulb.position.y=5.85;g.add(bulb);
    g.position.set(x,y,z);this.scene.add(g);
  }

  buildTaipeiLandmarks(){
    this.landmarks=[];

    /* 台北 101 */
    const t101=new THREE.Group();
    const base=new THREE.Mesh(new THREE.BoxGeometry(35,25,35),
      new THREE.MeshLambertMaterial({color:0x99AABB}));
    base.position.y=12.5;base.castShadow=true;t101.add(base);
    for(let i=0;i<8;i++){
      const seg=new THREE.Mesh(new THREE.BoxGeometry(22-i*.8,12,22-i*.8),
        new THREE.MeshLambertMaterial({color:i%2===0?0xAADDFF:0x88BBDD}));
      seg.position.y=25+i*13+6;seg.castShadow=true;t101.add(seg);}
    const spire=new THREE.Mesh(new THREE.CylinderGeometry(.3,.8,18,8),
      new THREE.MeshLambertMaterial({color:0xFFDD00}));
    spire.position.y=25+8*13+9;t101.add(spire);
    const t101Pos=this.latLngToWorld(25.0330,121.5654);
    t101.position.set(t101Pos.x,this.getTerrainHeight(t101Pos.x,t101Pos.z),t101Pos.z);
    this.scene.add(t101);
    this.landmarks.push({name:'台北101',pos:new THREE.Vector3(t101Pos.x,this.getTerrainHeight(t101Pos.x,t101Pos.z)+1,t101Pos.z)});

    /* 中正紀念堂 */
    const cks=new THREE.Group();
    const cksBase=new THREE.Mesh(new THREE.CylinderGeometry(30,30,3,8),
      new THREE.MeshLambertMaterial({color:0xDDD8C8}));
    cksBase.position.y=1.5;cks.add(cksBase);
    const cksMain=new THREE.Mesh(new THREE.CylinderGeometry(22,22,20,8),
      new THREE.MeshLambertMaterial({color:0xF0E8D0}));
    cksMain.position.y=13;cksMain.castShadow=true;cks.add(cksMain);
    const cksRoof=new THREE.Mesh(new THREE.ConeGeometry(28,10,8),
      new THREE.MeshLambertMaterial({color:0xCC3333}));
    cksRoof.position.y=28;cks.add(cksRoof);
    const cksPos=this.latLngToWorld(25.0347,121.5210);
    cks.position.set(cksPos.x,this.getTerrainHeight(cksPos.x,cksPos.z),cksPos.z);
    this.scene.add(cks);
    this.landmarks.push({name:'中正紀念堂',pos:new THREE.Vector3(cksPos.x,this.getTerrainHeight(cksPos.x,cksPos.z)+1,cksPos.z)});

    /* 台北大巨蛋 */
    const dome=new THREE.Group();
    const domeBase=new THREE.Mesh(new THREE.CylinderGeometry(25,25,10,16),
      new THREE.MeshLambertMaterial({color:0xCCCCCC}));
    domeBase.position.y=-5;dome.add(domeBase);
    const domeTop=new THREE.Mesh(new THREE.SphereGeometry(25,16,12,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshLambertMaterial({color:0xDDDDDD}));
    domeTop.castShadow=true;dome.add(domeTop);
    const domePos=this.latLngToWorld(25.0407,121.5580);
    dome.position.set(domePos.x,this.getTerrainHeight(domePos.x,domePos.z)+5,domePos.z);
    this.scene.add(dome);
    this.landmarks.push({name:'台北大巨蛋',pos:new THREE.Vector3(domePos.x,this.getTerrainHeight(domePos.x,domePos.z)+1,domePos.z)});

    this.addSimpleLandmark('西門町',25.0421,121.5080,25,0xEE4444,'西門町','#CC0000');
    this.addSimpleLandmark('台北車站',25.0478,121.5170,28,0xCCCCCC,'台北車站','#333333');
    this.addSimpleLandmark('松山機場',25.0630,121.5520,20,0x8899AA,'松山機場','#0055AA');
    this.addSimpleLandmark('龍山寺',25.0372,121.4999,15,0xCC8844,'龍山寺','#AA6600');
    this.addSimpleLandmark('士林夜市',25.0880,121.5250,18,0xFF8844,'士林夜市','#DD5500');
    this.addSimpleLandmark('國父紀念館',25.0400,121.5600,20,0xDDCC88,'國父紀念館','#AA8800');
    this.addSimpleLandmark('大安森林公園',25.0260,121.5350,12,0x88BB66,'大安森林公園','#558833');
    this.addSimpleLandmark('故宮博物院',25.1020,121.5480,18,0xDDAA88,'故宮博物院','#AA6644');

    /* 一般建築 */
    const bldgColors=[0xB8A88A,0x9AA8B8,0xA8A898,0x8A9098,0x7A7A88,0xC0B0A0,0x95A5B0,0xB0A0A0];
    const bldgColorsDark=[0x6A5A48,0x5A6878,0x686858,0x4A5058,0x3A3A48,0x706050,0x556570,0x706060];
    const signColors=[0xFF3344,0xFFAA00,0x00E5FF,0x00FF66,0xFF00AA,0xFFFF00];
    const landmarkZones=this.landmarks.map(lm=>({x:lm.pos.x,z:lm.pos.z,r:60}));
    const isNearLandmark=(x,z)=>{for(const lz of landmarkZones){if(Math.hypot(x-lz.x,z-lz.z)<lz.r)return true;}return false;};

    const positions=[];
    for(let bx=-1000;bx<=1000;bx+=85){
      for(let bz=-1000;bz<=1000;bz+=85){
        if(Math.abs(bx)<50&&Math.abs(bz)<50)continue;
        if(Math.abs(bx)<250&&Math.abs(bz)<250)continue;
        if(isNearLandmark(bx,bz))continue;
        let nearRoad=false;
        for(const road of this.roadGraph){
          for(let j=0;j<road.length-1;j++){const a=road[j],b=road[j+1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((bx-a.x)*dx+(bz-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(bx-a.x-t*dx,bz-a.z-t*dz)<48){nearRoad=true;break;}}
          if(nearRoad)break;}
        if(nearRoad)continue;
        if(Math.random()<0.3)continue;
        positions.push({x:bx,z:bz});}}

    positions.forEach(({x:bx,z:bz})=>{
      const w=28+Math.random()*35;
      const d=28+Math.random()*35;
      const h=30+Math.random()*130;
      const color=bldgColors[Math.floor(Math.random()*bldgColors.length)];
      const darkColor=bldgColorsDark[Math.floor(Math.random()*bldgColorsDark.length)];
      const rotY=(Math.random()-0.5)*0.15;
      const by=this.getTerrainHeight(bx,bz);
      const g=new THREE.Group();

      const base=new THREE.Mesh(new THREE.BoxGeometry(w+3,4,d+3),
        new THREE.MeshStandardMaterial({color:darkColor,roughness:0.9,metalness:0.05}));
      base.position.y=2;base.castShadow=true;base.receiveShadow=true;g.add(base);

      const tex=TextureGenerator.createBuildingTexture(color);
      const segCount=Math.max(1,Math.floor(h/20));
      const segH=h/segCount;
      for(let s=0;s<segCount;s++){
        const shrink=s*1.2;
        const sw=w-shrink,sd=d-shrink;
        const mat=new THREE.MeshStandardMaterial({
          map:tex,roughness:0.75+Math.random()*0.15,metalness:0.1,
          emissive:0x000000,emissiveIntensity:0});
        const seg=new THREE.Mesh(new THREE.BoxGeometry(sw,segH-0.3,sd),mat);
        seg.position.y=4+s*segH+segH/2;
        seg.castShadow=true;seg.receiveShadow=true;
        g.add(seg);}

      const topY=4+h;
      const topRand=Math.random();
      if(topRand<0.4){
        const cone=new THREE.Mesh(new THREE.ConeGeometry(w*0.5,12,4),
          new THREE.MeshStandardMaterial({color:color,roughness:0.6}));
        cone.position.y=topY+6;cone.rotation.y=Math.PI/4;
        cone.castShadow=true;g.add(cone);
      }else if(topRand<0.7){
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,3.5,10),
          new THREE.MeshStandardMaterial({color:0x777766,roughness:0.8}));
        tank.position.y=topY+1.75;tank.castShadow=true;g.add(tank);
        for(let a=0;a<2;a++){
          const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,6+Math.random()*4,4),
            new THREE.MeshStandardMaterial({color:0x333333}));
          ant.position.set((Math.random()-0.5)*w*0.5,topY+5,(Math.random()-0.5)*d*0.5);
          g.add(ant);}
      }else{
        const signColor=signColors[Math.floor(Math.random()*signColors.length)];
        const signMat=new THREE.MeshBasicMaterial({color:signColor});
        const sign=new THREE.Mesh(new THREE.BoxGeometry(w*0.7,6,1),signMat);
        sign.position.set(0,topY+3,d/2+0.5);
        g.add(sign);
        if(Math.random()<0.5){
          const sign2=new THREE.Mesh(new THREE.BoxGeometry(1,6,d*0.7),signMat);
          sign2.position.set(w/2+0.5,topY+3,0);
          g.add(sign2);}}

      if(Math.random()<0.6){
        const shopColor=signColors[Math.floor(Math.random()*signColors.length)];
        const shopSign=new THREE.Mesh(new THREE.BoxGeometry(w*0.9,2,0.5),
          new THREE.MeshBasicMaterial({color:shopColor}));
        shopSign.position.set(0,5,d/2+0.3);
        g.add(shopSign);}

      g.position.set(bx,by,bz);g.rotation.y=rotY;
      this.scene.add(g);
    });
  }

  addSimpleLandmark(name,lat,lng,h,color,sign,bg){
    const g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.BoxGeometry(45,h,45),
      new THREE.MeshStandardMaterial({map:TextureGenerator.createBuildingTexture(color),
        roughness:0.85,metalness:0.05}));
    b.position.y=h/2;b.castShadow=true;b.receiveShadow=true;g.add(b);
    if(sign){
      const s=new THREE.Mesh(new THREE.BoxGeometry(40,9,2),
        new THREE.MeshBasicMaterial({map:TextureGenerator.createBrandedSignTexture(sign,bg,'#FFF')}));
      s.position.set(0,h+5,23);g.add(s);}
    const pos=this.latLngToWorld(lat,lng);
    g.position.set(pos.x,this.getTerrainHeight(pos.x,pos.z),pos.z);
    this.scene.add(g);
    this.landmarks.push({name,pos:new THREE.Vector3(pos.x,
      this.getTerrainHeight(pos.x,pos.z)+1,pos.z)});
  }

  enhanceSigns(){
    this.signMeshes=[];
    this.scene.traverse(o=>{
      if(o.isMesh&&o.geometry&&o.geometry.type==='BoxGeometry'){
        const p=o.geometry.parameters;
        const isFlatX=p.width<6&&p.depth>15&&p.height<18;
        const isFlatZ=p.depth<6&&p.width>15&&p.height<18;
        if((isFlatX||isFlatZ)&&o.material&&o.material.color&&!o.userData.isRoad){
          o.userData.isSign=true;
          o.userData.signColor=o.material.color.getHex();
          this.signMeshes.push(o);}}
    });

  }

  createClouds(){
    this.clouds=[];
    const cloudTex=TextureGenerator.createCloudTexture();
    for(let i=0;i<14;i++){
      const w=400+Math.random()*600,h=120+Math.random()*200;
      const geo=new THREE.PlaneGeometry(w,h);
      const mat=new THREE.MeshBasicMaterial({
        map:cloudTex,transparent:true,opacity:0.55+Math.random()*0.3,
        depthWrite:false,fog:false,side:THREE.DoubleSide});
      const cloud=new THREE.Mesh(geo,mat);
      const angle=Math.random()*Math.PI*2;
      const r=800+Math.random()*1600;
      cloud.position.set(Math.cos(angle)*r,380+Math.random()*500,Math.sin(angle)*r);
      cloud.lookAt(0,cloud.position.y,0);
      cloud.rotation.z=(Math.random()-0.5)*0.4;
      cloud.userData.speed=1.5+Math.random()*3;
      this.scene.add(cloud);
      this.clouds.push(cloud);}
  }

  updatePlayerTaxiModel(){if(this.chassisMat)this.chassisMat.color.setHex(this.currentDriver.color);}
  showExhaustFlames(){
    this.exhaustFlames.forEach(f=>{f.material.opacity=.95;
      f.material.color.setHex(Math.random()>.5?0x00E5FF:0xFF5500);});
    clearTimeout(this.flameTimer);
    this.flameTimer=setTimeout(()=>{this.exhaustFlames.forEach(f=>{f.material.opacity=0;});},320);}

  build3DCompass(){this.buildDestBeam();}

  buildDestBeam(){
    const g=new THREE.Group();
    const beamMat=new THREE.MeshBasicMaterial({color:0xFF2233,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide});
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(3,3,120,12,1,true),beamMat);
    beam.position.y=60;g.add(beam);
    const innerMat=new THREE.MeshBasicMaterial({color:0xFF8899,transparent:true,opacity:0.55,depthWrite:false});
    const inner=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,120,8),innerMat);
    inner.position.y=60;g.add(inner);
    const haloGeo=new THREE.RingGeometry(4,9,32);haloGeo.rotateX(-Math.PI/2);
    const halo=new THREE.Mesh(haloGeo,new THREE.MeshBasicMaterial({
      color:0xFF2233,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthWrite:false}));
    halo.position.y=0.5;g.add(halo);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(2.2,12,8),
      new THREE.MeshBasicMaterial({color:0xFFDDDD}));
    orb.position.y=120;g.add(orb);
    this.destBeam=g;this.destBeam.visible=false;
    this.scene.add(g);
  }

  getPlayerStartPos(){
    const p=this.latLngToWorld(25.0415,121.5080);
    return new THREE.Vector3(p.x,this.getTerrainHeight(p.x,p.z)+.5,p.z);
  }

  spawnCivilianTraffic(){
    this.traffic=[];
    const carColors=[0xEE3333,0x3366EE,0xDDDDDD,0x44AA44,0x8844AA,0xFFAA00];
    const start=this.getPlayerStartPos();
    for(let i=0;i<20;i++){
      const g=new THREE.Group();
      const col=carColors[Math.floor(Math.random()*carColors.length)];
      const b=new THREE.Mesh(new THREE.BoxGeometry(2.2,.9,4.4),
        new THREE.MeshStandardMaterial({color:col,roughness:0.5,metalness:0.4}));
      b.position.y=.5;b.castShadow=true;g.add(b);
      const side=Math.random()>.5?1:-1;
      const laneX=start.x+side*7;
      const pz=start.z-450+Math.random()*900;
      g.position.set(laneX,this.getTerrainHeight(laneX,pz)+.5,pz);
      g.rotation.y=side>0?0:Math.PI;
      this.scene.add(g);
      this.traffic.push({group:g,speed:12+Math.random()*10,dir:side>0?1:-1,isPassed:false});}
  }

  spawnScooters(){
    this.scooters=[];
    if(!this.roadGraph||this.roadGraph.length===0)return;
    const colors=[0xFF3344,0x3366FF,0xFFFFFF,0x00AA44,0xFFAA00,0x222222,0xDDDDDD];
    for(let i=0;i<64;i++){
      const g=new THREE.Group();
      const col=colors[Math.floor(Math.random()*colors.length)];
      const body=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,1.8),
        new THREE.MeshStandardMaterial({color:col,roughness:0.4,metalness:0.5}));
      body.position.y=.45;g.add(body);
      const wheelGeo=new THREE.CylinderGeometry(.25,.25,.12,8);wheelGeo.rotateZ(Math.PI/2);
      const wMat=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.8});
      const w1=new THREE.Mesh(wheelGeo,wMat);w1.position.set(0,.25,.7);g.add(w1);
      const w2=new THREE.Mesh(wheelGeo,wMat);w2.position.set(0,.25,-.7);g.add(w2);
      const rider=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.9,6),
        new THREE.MeshStandardMaterial({color:0x333333}));
      rider.position.y=1.1;g.add(rider);
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(.22,6,4),
        new THREE.MeshStandardMaterial({color:0xFFDD00}));
      helmet.position.y=1.65;g.add(helmet);

      const roadIdx=Math.floor(Math.random()*this.roadGraph.length);
      const road=this.roadGraph[roadIdx];
      const nodeIdx=Math.floor(Math.random()*(road.length-1));
      const lane=Math.random()>0.5?1:-1;
      const a=road[nodeIdx];
      g.position.set(a.x,this.getTerrainHeight(a.x,a.z)+0.3,a.z);
      this.scene.add(g);
      this.scooters.push({
        group:g,roadIdx,nodeIdx,progress:0,lane,
        speed:12+Math.random()*8,state:'cruising',avoidTimer:0,
        laneOffset:lane*2.0,rotSmooth:Math.random()*Math.PI*2});}
  }

  spawnWorldCustomers(){
    this.customers=[];
    const tiers=[
      {color:0x00FF66,bonus:35,fare:120},
      {color:0xFFDD00,bonus:25,fare:80},
      {color:0xFF2233,bonus:15,fare:45}];
    const spots=[];
    if(this.landmarks&&this.landmarks.length>0){
      this.landmarks.forEach(lm=>{
        const oa=Math.random()*Math.PI*2;
        spots.push(new THREE.Vector3(lm.pos.x+Math.cos(oa)*25,0,lm.pos.z+Math.sin(oa)*25));});}
    const extras=[
      this.latLngToWorld(25.0415,121.5150),
      this.latLngToWorld(25.0375,121.5300),
      this.latLngToWorld(25.0515,121.5240),
      this.latLngToWorld(25.0630,121.5400)];
    extras.forEach(p=>spots.push(new THREE.Vector3(p.x,0,p.z)));

    spots.forEach((sp,idx)=>{
      const tier={...tiers[idx%tiers.length]};
      const cGroup=new THREE.Group();
      const pMesh=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.8,8),
        new THREE.MeshStandardMaterial({color:0x2244AA,roughness:0.7}));
      pMesh.position.y=.9;cGroup.add(pMesh);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.35,8,6),
        new THREE.MeshStandardMaterial({color:0xFFDDAA,roughness:0.9}));
      head.position.y=2.05;cGroup.add(head);

      const armGeo=new THREE.BoxGeometry(0.18,1.2,0.18);
      armGeo.translate(0,-0.6,0);
      const armMat=new THREE.MeshStandardMaterial({color:0x2244AA,roughness:0.7});
      const leftArm=new THREE.Mesh(armGeo,armMat);
      leftArm.position.set(-0.55,1.55,0);
      cGroup.add(leftArm);
      const rightArm=new THREE.Mesh(armGeo.clone(),armMat);
      rightArm.position.set(0.55,1.55,0);
      cGroup.add(rightArm);

      const legGeo=new THREE.BoxGeometry(0.22,0.9,0.22);
      const legMat=new THREE.MeshStandardMaterial({color:0x222222,roughness:0.8});
      const legL=new THREE.Mesh(legGeo,legMat);legL.position.set(-0.2,0.45,0);cGroup.add(legL);
      const legR=new THREE.Mesh(legGeo.clone(),legMat);legR.position.set(0.2,0.45,0);cGroup.add(legR);

      const ringGeo=new THREE.RingGeometry(2.5,3.2,16);ringGeo.rotateX(-Math.PI/2);
      const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({
        color:tier.color,side:THREE.DoubleSide,transparent:true,opacity:.85}));
      ring.position.y=.1;cGroup.add(ring);
      const icon=new THREE.Mesh(new THREE.SphereGeometry(.4,8,8),
        new THREE.MeshBasicMaterial({color:tier.color}));
      icon.position.y=2.8;cGroup.add(icon);

      const gy=this.getTerrainHeight(sp.x,sp.z);
      cGroup.position.set(sp.x,gy,sp.z);
      cGroup.rotation.y=Math.random()*Math.PI*2;
      this.scene.add(cGroup);
      const dest=this.landmarks[idx%this.landmarks.length];
      this.customers.push({
        group:cGroup,tier,destination:dest,isBoarded:false,
        leftArm,rightArm,icon,ring,wavePhase:Math.random()*Math.PI*2});});
    this.activeCustomer=null;
  }

  createRain(){
    const rainCount=2500;
    const geo=new THREE.BufferGeometry();
    const positions=new Float32Array(rainCount*3);
    this.rainVelocities=new Float32Array(rainCount);
    for(let i=0;i<rainCount;i++){
      positions[i*3]=(Math.random()-.5)*200;
      positions[i*3+1]=Math.random()*60;
      positions[i*3+2]=(Math.random()-.5)*200;
      this.rainVelocities[i]=40+Math.random()*30;}
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color:0xAABBCC,size:.15,transparent:true,opacity:.5,depthWrite:false});
    this.rainMesh=new THREE.Points(geo,mat);
    this.rainMesh.visible=false;this.scene.add(this.rainMesh);
  }

  startGame(){
    document.getElementById('overlay-screen').style.display='none';
    document.getElementById('hud').style.display='block';
    this.gameState='PLAYING';
    this.audio.init();this.audio.startRadio();
    this.audio.speak(this.currentDriver.phrase,this.currentDriver.pitch);
    if(this.selectedMode==='ARCADE')this.gameTime=50;
    else if(this.selectedMode==='WORK_5MIN')this.gameTime=300;
    else if(this.selectedMode==='COURIER_JUMP')this.gameTime=40;
    else if(this.selectedMode==='COURIER_BOWLING')this.gameTime=40;
    const start=this.getPlayerStartPos();
    this.carPos.copy(start);this.carRotY=0;this.carSpeed=0;
    this.totalFare=0;this.currentTip=0;this.comboCount=0;this.maxCombo=0;
    this.deliveredCount=0;this.speedyCount=0;
    this.bowlingPinsStruck=0;this.maxJumpDistance=0;
    this.activeCustomer=null;this.activeCustomerTimer=0;
  }

  endGame(){
    this.gameState='GAMEOVER';
    document.getElementById('hud').style.display='none';
    let rank='CLASS E';
    if(this.totalFare>=10000)rank='CLASS S';
    else if(this.totalFare>=5000)rank='CLASS A';
    else if(this.totalFare>=3000)rank='CLASS B';
    else if(this.totalFare>=2000)rank='CLASS C';
    else if(this.totalFare>=1000)rank='CLASS D';
    document.getElementById('license-photo-letter').innerText=this.currentDriver.letter;
    document.getElementById('license-photo-driver').innerText=this.currentDriver.name;
    document.getElementById('lic-fare').innerText='$'+Math.round(this.totalFare);
    document.getElementById('lic-customers').innerText=this.deliveredCount;
    document.getElementById('lic-speedy').innerText=this.speedyCount+' Speedy';
    document.getElementById('lic-combo').innerText=this.maxCombo;
    if(this.selectedMode==='COURIER_BOWLING')
      document.getElementById('lic-mode-score').innerText=this.bowlingPinsStruck+' / 10 球瓶';
    else if(this.selectedMode==='COURIER_JUMP')
      document.getElementById('lic-mode-score').innerText=Math.round(this.maxJumpDistance)+'m 跳躍';
    else document.getElementById('lic-mode-score').innerText=this.selectedMode;
    document.getElementById('license-rank-stamp').innerText=rank;
    document.getElementById('license-screen').style.display='flex';
    this.audio.playCash();
    this.audio.speak('遊戲結束！你獲得了 '+rank+'！');
  }

  addTip(amount){
    this.currentTip+=amount;
    this.comboCount++;
    if(this.comboCount>this.maxCombo)this.maxCombo=this.comboCount;
    const pop=document.createElement('div');
    pop.className='tip-floating-popup';
    pop.innerText='+$'+amount;
    pop.style.left='55%';pop.style.top='45%';
    document.getElementById('hud').appendChild(pop);
    setTimeout(()=>pop.remove(),800);
  }

  showComboBanner(text,className){
    const banner=document.getElementById('hud-stunt-banner');
    const stText=document.getElementById('stunt-text');
    const comboUI=document.getElementById('hud-combo-counter');
    stText.innerText=text;stText.className=className;
    comboUI.innerText=this.comboCount+' COMBO!';
    banner.style.transform='translate(-50%,-50%) scale(1.15)';
    clearTimeout(this.bannerTimer);
    this.bannerTimer=setTimeout(()=>{banner.style.transform='translate(-50%,-50%) scale(0)';},1100);
  }

  updateHUD(){
    const tEl=document.getElementById('hud-timer');
    tEl.innerText=Math.ceil(this.gameTime);
    if(this.gameTime<=10)tEl.classList.add('urgent');
    else tEl.classList.remove('urgent');
    document.getElementById('hud-total-fare').innerText='$'+Math.round(this.totalFare);
    document.getElementById('hud-current-fare').innerText='小費: $'+this.currentTip+' ('+this.comboCount+' COMBO)';
    document.getElementById('hud-speed').innerText=Math.abs(Math.round(this.carSpeed));
    if(this.activeCustomer)
      document.getElementById('hud-customer-timer').innerText=Math.ceil(this.activeCustomerTimer);
  }

  updateRain(dt){
    if(this.rainPass){
      this.rainPass.uniforms.time.value+=dt;
      this.rainPass.uniforms.rainAmount.value=this.isRaining?1:0;
      this.rainPass.uniforms.rainIntensity.value=this.isRaining?.3:0;}
    if(this.rainMesh&&this.isRaining){
      this.rainMesh.visible=true;
      const pos=this.rainMesh.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        let y=pos.getY(i)-this.rainVelocities[i]*dt;
        if(y<0){y=50+Math.random()*10;
          pos.setX(i,(Math.random()-.5)*200);
          pos.setZ(i,(Math.random()-.5)*200);}
        pos.setY(i,y);}
      pos.needsUpdate=true;
      this.rainMesh.position.set(this.carPos.x,0,this.carPos.z);
    }else if(this.rainMesh){this.rainMesh.visible=false;}
  }


}


/* P2 Preview module: dialogue.js */
/* Handwritten original comedy. Each customer has two alternatives for nine events.
   Tokens are filled with the real item/district. No generative service is used. */
const COURIER_PERSONAS=[
 {name:'阿凱 · 加班 PM',icon:'📊',color:'#e9b35b',pitch:.94,rate:1.14,reply:'收到，我先把這單設成最高優先。其他單也是最高。',lines:{
  pickup:['送到{dest}。不用敲門，敲鍵盤就知道是哪間。','{item}送{dest}。我說五分鐘後開會，已經說了三小時。'],
  drift:['這個彎轉得不錯。下次可以幫我轉職嗎？','你不用每轉一個彎，就幫我的湯做一次敏捷開發。'],
  crash:['那聲撞擊我熟。跟主管說「只改一點點」一樣大聲。','便當若扁了，請說是扁平化管理。公司喜歡這個。'],
  near:['你從那個縫過去？我們專案也是用這種方式上線的。','別再鑽了。午餐不是 MVP，不能缺東缺西就交付。'],
  half:['老闆問你到哪了。我說正在路上，他說他也是。','目前進度幾成？不要回百分之九十九，我會 PTSD。'],
  urgent:['剩十秒。我的會議可以延，你的麵不行。','現在送到，我把你的準時率寫進績效。我的先不寫。'],
  success:['真的到啦？你是今天唯一有交付的人。','五星。下次你來開會，我騎車。至少會議能有進度。'],
  damaged:['菜跟飯整合得很好。比我們前後端整合得好。','便當已經重構了。看不懂，但應該還能跑。'],
  late:['先取消。我吃白板筆畫的那個餅就好。','你還沒到？正常。我們的專案也還沒到。']
 }},
 {name:'巨巨教練 · 增肌中',icon:'💪',color:'#93cba7',pitch:.88,rate:1.04,reply:'教練，這條路是上坡。現在有在練的是我。',lines:{
  pickup:['{item}送{dest}。不要搖，我已經自己搖一整天了。','到{dest}找最大隻那個。不是石獅子，是我。'],
  drift:['核心要收！我是說我的便當核心，不是你的！','這叫功能性訓練嗎？我的雞胸功能快失去了。'],
  crash:['那一下幾公斤？沒有熱身，不能直接加重啦。','外送箱有練胸嗎？感覺剛剛是它在臥推。'],
  near:['你剛剛縮那麼小？你是做減脂，還是做外送？','那個車距，我連體脂都沒這麼低。'],
  half:['蛋白質快到了嗎？肌肉在門口開晨會了。','我剛剛又做完一組。現在只剩便當還沒做完。'],
  urgent:['最後十秒！十！九！八！不要真的停下來喘啦！','撐住！最後一下！我每次都這樣講，這次是真的。'],
  success:['準時。我送你一句免費的：明天練腿。','五星！這袋有阻力，下次可以拿來熱身。'],
  damaged:['雞胸碎了？太好了，今天不用練咬肌。','飯被壓實了。這算複合式訓練。'],
  late:['先取消。我去吃健身房冰箱那塊三年的雞胸。','這單變成有氧了，只有等待，沒有補給。']
 }},
 {name:'星星老師 · 宇宙客服',icon:'🔮',color:'#bd9ce5',pitch:1.1,rate:1.0,reply:'老師，我剛剛逆的是巷子，不是水星。',lines:{
  pickup:['送到{dest}。門牌我算過了，你還是看一下。','{item}送{dest}。我今天的幸運色是「已送達」。'],
  drift:['這個彎不吉利。你把我的上升星座甩到後座了。','你不是在轉彎，你是在轉我的命盤。'],
  crash:['沒事，水逆。可是你的車有沒有逆，我就不知道了。','剛剛那一聲，是土星進入你的後照鏡嗎？'],
  near:['你躲開了耶。這個不是星座，是你真的有技術。','車縫不在你的命盤裡。別硬把自己塞進去。'],
  half:['塔羅說你在移動。好準喔，你本來就是外送員。','我抽到倒吊人。希望不是在說我的珍奶。'],
  urgent:['宇宙說剩十秒。這次不用抽牌，畫面上就有。','吉時要過了！再晚我得把午餐改算成晚餐。'],
  success:['五星。不是因為宇宙，是因為你真的到了。','準時！今天的運勢改成大吉。你的，不是我的。'],
  damaged:['菜全部混了。看起來像十二宮聯誼。','杯子瘦了一圈。它是不是也在走土星課題？'],
  late:['取消囉。宇宙安排我今天斷食。又是它。','我算錯了。你會到，但不一定是這一世。']
 }},
 {name:'周伯 · 巷口董事長',icon:'👴',color:'#a8c7d4',pitch:.78,rate:.98,reply:'伯，我的導航沒有「你以前那棵樹」這個選項。',lines:{
  pickup:['{dest}那邊。以前有棵樹，現在沒有，你不用找。','{item}拿來{dest}。找穿背心那個，不是你，是我。'],
  drift:['轉這麼大力，我以為你要把台北轉回台南。','少年仔，便當不用翻面。它本來就是熟的。'],
  crash:['這聲音不對喔。我修腳踏車四十年了。','我聽到了。不要說是爆米花，這單沒有爆米花。'],
  near:['有夠會鑽。以前你這種都拿去修水管。','你從那個洞過去？我以前的褲子都沒那麼窄。'],
  half:['沒有催喔。我只是從樓上等到樓下而已。','我在門口。椅子也在門口。我們兩個都在老。'],
  urgent:['快到了齁？我說第三次了，你不要讓我說第四次。','我孫子都從小學長到國中了。好啦，只有十分鐘。'],
  success:['有夠快。你早三十年來，我就不用娶會煮飯的。','五星啦。剩一星留給你下次，做人要有進步空間。'],
  damaged:['菜跟飯都在一起了。省得我再拌，算你貼心。','這袋怎麼變這樣？喔，跟我年輕時的髮型一樣。'],
  late:['先取消啦。我去吃隔壁的。隔壁是公園，我再想想。','還沒到喔？沒關係，你到了我可能也走到了。']
 }},
 {name:'喵總秘書 · 貓奴',icon:'🐈',color:'#f5c68b',pitch:1.12,rate:1.1,reply:'你家貓有沒有接電話？我想直接跟主管確認。',lines:{
  pickup:['送到{dest}。人可以按門鈴，貓已經在盯門了。','{item}拿來{dest}。客人是我，真正的客戶是貓。'],
  drift:['不要再甩！我家貓以為你在玩逗貓棒。','這個彎讓我的罐頭開了三次董事會。'],
  crash:['貓醒了。你現在不是得罪我，是得罪整個集團。','箱子沒事吧？食物其次，紙箱才是牠訂的。'],
  near:['別再鑽了。我家的貓才需要液態化。','那個車縫我家貓會過。你是人，先確認一下。'],
  half:['牠看我的眼神，像我把罐罐拿去買股票了。','貓已經把我叫到客廳約談。你可以快一點嗎？'],
  urgent:['主管在舔嘴了。不是老闆，是比老闆還難搞的。','十秒！牠坐到鍵盤上了，我只剩語音能求救。'],
  success:['食物給我，袋子給貓。這筆訂單兩邊都滿意。','五星。貓給一掌，不知道算不算加分。'],
  damaged:['貓很喜歡。袋子破了，剛好變成兩個玩具。','食物有點亂。幸好貓只審核紙箱。'],
  late:['取消。我現在的職位從飼主變成嫌犯了。','牠把我踢出家庭群組了。雖然那群本來只有我。']
 }},
 {name:'小璇 · 直播還沒關',icon:'📱',color:'#f399be',pitch:1.2,rate:1.2,reply:'可以不要直播我的定位嗎？我現在只是上班。',lines:{
  pickup:['{item}送{dest}。我有開直播，但你不用表演才藝。','送{dest}！先不要拍我，我在等便當把氣色補回來。'],
  drift:['這個甩尾可以。剛剛三百個人一起暈了。','等等，我的飲料要出道，不是要離家出走。'],
  crash:['聊天室剛刷一排 F。不是五星，是出事那個 F。','大家都聽到了。你不要再說「收音測試」了。'],
  near:['這段剪成短片可以。剪掉我的便當就不可以。','車縫很小，流量很大。你有沒有考慮當主角？'],
  half:['觀眾問便當怎麼還沒出場。它今天是特別來賓。','我已經聊完保養、穿搭、人生，開始聊你的車牌了。'],
  urgent:['十秒！大家幫我倒數，不要幫他上香！','你再不來，我要把這場直播分類成靈異探索。'],
  success:['五星！今天沒有業配，但我真的想業配你。','到啦！這集從開箱變成等箱，終於有箱了。'],
  damaged:['這個便當很前衛。濾鏡都不知道要救哪一道菜。','飲料自帶雲朵，還是你剛剛幫它打成奶泡？'],
  late:['取消。這場直播正式改名「消失的午餐」。','沒到喔？觀眾說明天同一時間再播第二集。']
 }},
 {name:'陳主委 · 活動總召',icon:'🧧',color:'#ec9c83',pitch:.84,rate:1.15,reply:'主委，我照導航走。導航今天沒有擲筊功能。',lines:{
  pickup:['{item}送{dest}。不是供品，你可以照正常速度。','來{dest}找主委。大家都說是主委，找最大聲的。'],
  drift:['那個彎有保庇。下個彎就靠你自己了。','你把湯甩成八卦陣了。這個不用排陣啦。'],
  crash:['剛剛是炮嗎？不是炮的話，你先不要笑。','保庇有保庇，方向燈還是要自己打。'],
  near:['有閃過，大家拍手。便當也不要跟著拍手。','鑽這麼窄，要不要順便幫我拉一條燈線？'],
  half:['桌都擺好了。現在全場只有便當還沒報到。','大家問我多久到，我說快了。你讓我很難做人。'],
  urgent:['剩十秒！不是搶孤，你不用衝上電線桿。','麥克風借你。我已經不知道怎麼宣布「再等一下」。'],
  success:['到啦！比今年的贊助款準時。','五星！下次繞境你來排路線，我不要再繞三圈。'],
  damaged:['飯有點亂。不用說了，我會說這是澎湃。','這袋像繞境回來的。東西到就好，東西到就好。'],
  late:['先取消。我去拿供桌那包餅乾，等等再補。','你還沒到？我們下一個活動都開始籌備了。']
 }},
 {name:'小安 · 夜班護理師',icon:'🩺',color:'#91d2dc',pitch:1.02,rate:1.1,reply:'收到。我把這袋當急件，但不開急救警笛。',lines:{
  pickup:['送到{dest}。不用找白袍，找黑眼圈就好。','{item}送{dest}。我剛下班，早餐晚餐我都認得它。'],
  drift:['你在幫便當翻身嗎？那個不用每兩小時翻。','飲料的心電圖如果有，那一彎一定不好看。'],
  crash:['先說人有沒有事。午餐的部分，我可能會有事。','那一下聽起來需要評估。你先評估，我先餓。'],
  near:['技術很好。但是我今天不想看到你來報到。','你可以鑽小巷，但不要鑽進我的上班地點。'],
  half:['我剛剛閉眼五秒，夢到便當到了。醒來沒有。','我的休息時間很短，不要讓我跟午餐交班。'],
  urgent:['最後十秒。我有八秒可以吃，你配合一下。','再晚我只能把午餐寫進交班紀錄了。'],
  success:['謝謝。今天第一個不用我催第二次的人。','五星。你讓我的值班表有一個好看的地方。'],
  damaged:['有點亂，但還有生命跡象。便當的。','這是流質飲食嗎？我記得我點的是乾的。'],
  late:['取消。我的休息結束了，它先休息吧。','沒關係。我改吃護理站那包有年份的餅乾。']
 }},
 {name:'小林 · 北車迷路中',icon:'🧭',color:'#7cbad9',pitch:1.07,rate:1.18,reply:'你先不要移動。你一移動，我這單就變追逐戰。',lines:{
  pickup:['{item}送{dest}。我在出口旁，出口上面寫出口。','到{dest}。我走地下街走太久，手機以為我出國了。'],
  drift:['你也在繞圈嗎？太好了，終於有人理解我。','方向感真好。可以外送完順便外送我到出口嗎？'],
  crash:['我只聽到一聲。你還活著的話，順便問個路。','你撞到牆了？我也是。精神上的。'],
  near:['你從那個縫過去，我從 Z 區走到 Y 區，沒過去。','這種縫我認得。北車裡面有八百個。'],
  half:['我剛剛到了另一個出口。它說我本來的出口在後面。','定位不是我在飄，是地下街真的很有想法。'],
  urgent:['剩十秒！我找到地面了！又是另一個地面！','我不動了。誰再叫我往前走，我就跟他買房子。'],
  success:['五星！你找到我了，Google 沒有。','謝謝。這是我今天第一次走完一段路有結果。'],
  damaged:['袋子扁了？剛好，可以從地下街那個門出去。','看不出原形？沒事，我也看不出我在哪。'],
  late:['取消。我在販賣機旁先活下來。','你找不到我也正常。我自己還在找我自己。']
 }},
 {name:'小哲 · 論文第七年',icon:'💻',color:'#b3b8df',pitch:.98,rate:1.2,reply:'學長，我的路線不會先跑到百分之九十九再卡住。',lines:{
  pickup:['{item}送{dest}。不用問幾樓，我的定位比較可信。','送到{dest}。教授說快畢業了，那個快跟你的快不同。'],
  drift:['我知道怎麼修這個彎。等一下，先讓我重開機。','這個甩尾是 bug，還是你寫在規格裡的 feature？'],
  crash:['有 log 嗎？沒有的話，你說是偶發我也沒辦法。','撞了先不要關。這種錯誤一關就重現不了。'],
  near:['你從那裡過去？這叫邊界條件，不叫道路。','這段有測嗎？沒測也能過，那很像我的程式。'],
  half:['我寫完摘要了。你還沒到？那我重寫摘要。','你的 ETA 怎麼一直變？你也在訓練模型嗎？'],
  urgent:['十秒！不要給我進度條，我要實體便當。','我的 build 跟你的便當，今天至少要成功一個。'],
  success:['五星！驗收通過，沒有下一輪修改。你先別哭。','真的到了。這是我這學期唯一成功的 deployment。'],
  damaged:['格式不對，但內容都有。這就算向下相容。','飯跑到菜裡。不是 bug，是資料遷移。'],
  late:['取消。我把飢餓列成已知問題。','午餐逾時了。教授說可以延，我說他是說論文。']
 }},
 {name:'黃太太 · 備註 28 行',icon:'📝',color:'#e1b1c5',pitch:1.03,rate:1.16,reply:'太太，備註收到。我的手機滑到底了，還有續頁嗎？',lines:{
  pickup:['{item}送{dest}。門口不要按鈴，但要讓我知道你到了。','來{dest}。不要太快不要太慢，理想時間我寫在附件。'],
  drift:['備註第十七條：轉彎要柔和。你是不是沒看到？','我說少冰，不是把冰甩掉。方法也要看一下。'],
  crash:['備註新增第二十九條：盡量不要撞。','我有寫不要撞嗎？沒寫也應該知道吧。'],
  near:['靠左一點，右邊也留一點。你自己拿捏。','那個縫太窄，下次請選比較有質感的車縫。'],
  half:['你看到備註了嗎？不要回「有」，要回哪一條。','我剛補了三行，不影響前面二十八行。'],
  urgent:['剩十秒。請準時，但不要因為準時影響精緻度。','可以快一點嗎？不用太快。你應該懂我的意思。'],
  success:['五星。備註三十一條：下次也請你送。','都有照做耶。我要把你的名字加到備註裡。'],
  damaged:['袋子有皺。我寫了不要皺，可是我好像存草稿。','看起來跟照片不同。好，我知道照片是平面的。'],
  late:['取消。等等，我先把取消方式補到備註。','沒準時喔。你先看一下我對沒準時的定義。']
 }},
 {name:'阿蓉 · 三寶開飯倒數',icon:'🧸',color:'#edc088',pitch:1.08,rate:1.16,reply:'收到。你顧三個，我顧這袋。大家都別掉下來。',lines:{
  pickup:['{item}送{dest}。聽到尖叫先別怕，那是我家。','來{dest}。三個小孩都餓了，你現在是我的第四個希望。'],
  drift:['你那邊在甩尾？我這邊已經在甩拖鞋了。','不要把我的午餐轉成三份。他們真的會搶。'],
  crash:['誰撞誰？等一下，我是在問我家這邊。你也撞？','這聲我很熟。通常接下來有人說不是我。'],
  near:['有鑽過去就好。我剛剛也從三個玩具中間過了。','你那個車距，跟我現在的個人空間差不多。'],
  half:['大的說他餓，中間的說他也是，小的在吃遙控器。','我已經講完三本睡前故事。現在是中午。'],
  urgent:['十秒！我把三個都引到門口了，你不要讓我失守！','再晚我會把門牌掛在小孩身上，讓你比較好找。'],
  success:['五星。你救的不是一袋飯，是一個家庭的音量。','準時到！今天唯一有聽我話的居然是外送員。'],
  damaged:['飯混一起了？沒差，進小孩嘴裡本來就這樣。','三個說看起來很好吃。因為它看起來像打過架。'],
  late:['取消。孩子們決定吃我了，我先處理。','我先煮泡麵。不是妥協，是戰略撤退。']
 }}
];
// 2.6 extra original banter. These extend the existing personas without using
// real brand slogans or licensed character dialogue.
const COURIER_EXTRA_LINES=[
 {pickup:'我剛把需求改完：唯一不能改的是我要吃到。',drift:'你這個彎叫敏捷，我們公司那個叫沒規格。',crash:'剛剛那聲我先記成風險，等等再開會檢討。',success:'準時交付！你可以來帶我們下個 Sprint。'},
 {pickup:'這單碳水不用減，速度可以加。',drift:'側向力很好，便當的核心穩定度不好。',crash:'這一下像深蹲失敗，先不要硬撐第二下。',success:'今天的 PR 是你，蛋白質只是配角。'},
 {pickup:'我看星盤了，今天適合走捷徑，不適合走錯路。',drift:'火星很旺。你的後輪也滿旺的。',crash:'這顆不是流星，是我的午餐在墜落。',success:'宇宙終於有一件事準時，我記一下。'},
 {pickup:'從巷口進來，看到大家都在聊天那邊就是了。',drift:'少年仔，輪胎比我年輕，不用這麼急著退休。',crash:'我以前修車聽聲音，這聲音叫「要付錢」。',success:'有準時啦。你今天可以少聽我講一次以前。'},
 {pickup:'紙箱先顧好，內容物是附贈的。',drift:'你再甩一次，我家貓要申請坐副駕了。',crash:'主管聽到聲音了。牠現在尾巴是問號。',success:'五星。貓給你的評語是「箱子可坐」。'},
 {pickup:'鏡頭開著，你如果迷路我們就直接做實境節目。',drift:'聊天室說再一個！我的飲料說不要！',crash:'這段有爆點，但我希望爆的是流量不是便當。',success:'收工！這集有結局，演算法會喜歡。'},
 {pickup:'主委在線上，便當也要在線，不要掉線。',drift:'這一甩很有陣頭感，但我們今天沒申請路權。',crash:'剛剛那聲比廟口音響還扎實。',success:'準時到！我宣布這攤正式開桌。'},
 {pickup:'我剛交班完，現在只想跟飯交接。',drift:'我今天看過很多曲線，這條甩尾不用再畫。',crash:'先觀察。有冒煙的話不要跟我說是特效。',success:'謝謝，這份餐終於不用掛急件。'},
 {pickup:'我在地下街，旁邊是出口，出口旁邊還有出口。',drift:'你轉得比北車指標快，我開始相信你了。',crash:'如果你撞牆，牆至少知道自己在哪。',success:'你找到我了。這件事比找到出口還值得五星。'},
 {pickup:'我的論文可以延期，午餐不能引用這個先例。',drift:'這個操作有很好的結果，但我不知道方法章怎麼寫。',crash:'請保留現場，我想把它放進失敗案例。',success:'通過口試——我是說通過交付。'},
 {pickup:'我新增一條：地下街可以走，但不要把店家一起帶走。',drift:'轉彎可以俐落，但餐盒邊角請維持九十度。',crash:'我沒有寫「請避免穿牆」，因為我以為不用寫。',success:'全部符合。我要把你加進我的常用備註。'},
 {pickup:'三個小孩現在在門口排隊，比你導航還直。',drift:'你甩尾，我這邊三個也跟著尖叫，很有環繞音效。',crash:'那聲不是我家。太好了——等一下，是你那邊？',success:'到了！家裡音量瞬間下降六十分貝。'}
];
COURIER_PERSONAS.forEach((p,i)=>{const e=COURIER_EXTRA_LINES[i];for(const k of ['pickup','drift','crash','success'])p.lines[k].push(e[k]);});
const COURIER_UNDERGROUND_LINES=[
 '你進地下街了？很好，我的專案也常常一進去就看不到天日。',
 '地下街也能騎？這組算爆發力，出去記得拉伸。',
 '地下氣場很強。也可能只是冷氣很強。',
 '你騎進地下街喔？以前這種叫迷路，現在叫捷徑。',
 '貓如果看到這條地下路，牠會把整條當紙箱。',
 '聊天室瘋了。有人問這是外送還是地下賽車。',
 '地下街這段有氣勢！但不要順便繞境商店。',
 '請小心天花板。我今天不想多收一個頭部外傷。',
 '歡迎來到我每天迷路的主場。現在換我指揮你：不要聽我。',
 '這個地下段落很有研究價值。先不要撞，我還沒寫倫理審查。',
 '地下街可以，但備註新增：不要把招牌當終點線。',
 '小孩聽到你進地下街，現在三個都說要跟車。不要。'
];
const COURIER_FOOD_JOKES={
 drink:['杯子現在的姿態，看起來有學過現代舞。','我點去冰。你是打算連杯子也去掉嗎？','珍珠不用急著到，它有整杯的時間。','封膜是封口，不是賽車安全帶。','少糖可以，少掉半杯不行。'],
 soup:['湯要在碗裡，不是在袋子裡。這句我先講。','湯剛剛問我能不能換一個比較穩的司機。','你現在送的是牛肉麵，還是牛肉瀑布？','我點的是湯麵，不是道路灑水服務。','麵可以甩乾，整碗不用甩。'],
 meal:['飯跟菜先不要結婚，到我這裡再辦婚禮。','你送便當，不用順便幫它做便當界的都更。','這個彎過完，排骨是不是換座位了？','雞腿不用坐窗邊，它沒有買票。','三菜一肉不要送成一道綜合藝術。'],
 flower:['花要挺著來，不是像我週一上班那樣來。','花束看起來很緊張。它今天第一次坐機車。','花瓣要保留，告白的台詞我自己講。'],
 parcel:['包裹不能散裝。這條應該不需要我加到備註。','書不用震到劇透。故事等我自己翻。','你這個煞車，書裡的主角都下車了。']
};
const COURIER_PLACE_JOKES={
 '101':['我在一樓。一百零一是名字，不是你要爬的樓層。','我不是叫你來一百零一次。來一次就好。'],
 '西門町':['找站著的人。我知道全部都站著，我會揮袋子。','不要跟著路邊跳舞的人轉彎，那不是交警。'],
 '台北車站':['我在出口旁。對，我知道這句話在北車等於沒說。','你找到我就送餐，找不到我就當都市傳說。'],
 '中山':['找那間咖啡店。抱歉，這句話好像更難了。','我在咖啡店外面。不是那家，是旁邊那家。也不是。'],
 '雙連':['我在市場旁，香味最濃那邊。導航應該沒有鼻子。','不要跟阿姨喊價，這單已經結帳了。'],
 '圓山':['我在公園。樹旁邊。這個地址真的很完整吧。','看到有人跑步先別跟。我沒有要你送馬拉松。'],
 '士林':['夜市還沒開，我的肚子先開了。','看到吃的不要停，我還在另一邊等吃的。'],
 '松山':['不是機場。我的便當沒有買機票。','到松山就好，不用把雞排送到日本。'],
 '內湖':['我在園區。每棟玻璃都照得出同一張加班臉。','不要問哪間公司。先看哪棟燈還沒關。'],
 '大直':['找河岸旁邊。別太靠河，這單不是海運。','過橋不用收過路費。那是我先跟你講好。'],
 '陽明山':['我上來看風景。現在的風景是我的空胃。','山上很冷。便當請比我的戀愛史溫暖一點。'],
 '文山':['我在學校附近。上課我會遲到，吃飯我不會。','如果你到校門口，先不要問警衛我幾年級。']
};


/* P2 Preview module: evolution.js */
// Approximate Taipei district positions; deliberately compressed arcade roads.
const COURIER_ZONES=[
 {name:'101',lat:25.033,lng:121.5654,tag:'信義快送'},
 {name:'西門町',lat:25.0421,lng:121.508,tag:'商圈小巷'},
 {name:'台北車站',lat:25.0478,lng:121.517,tag:'轉運急件'},
 {name:'中山',lat:25.052,lng:121.52,tag:'咖啡街區'},
 {name:'雙連',lat:25.058,lng:121.52,tag:'市場早餐'},
 {name:'圓山',lat:25.071,lng:121.52,tag:'公園野餐'},
 {name:'士林',lat:25.093,lng:121.526,tag:'夜市宵夜'},
 {name:'松山',lat:25.05,lng:121.578,tag:'東城穿梭'},
 {name:'內湖',lat:25.083,lng:121.59,tag:'科技園區'},
 {name:'大直',lat:25.084,lng:121.546,tag:'河岸捷徑'},
 {name:'陽明山',lat:25.155,lng:121.547,tag:'彎道山線'},
 {name:'文山',lat:24.999,lng:121.573,tag:'校園長單'}
];
TAIPEI_ROADS.push(
 {name:'中山北路／士林線',width:22,pts:[[25.048,121.522],[25.052,121.520],[25.058,121.520],[25.071,121.520],[25.080,121.522],[25.088,121.525],[25.093,121.526],[25.105,121.530],[25.116,121.533]]},
 {name:'陽明山遊戲山線',width:20,pts:[[25.116,121.533],[25.125,121.529],[25.135,121.538],[25.143,121.532],[25.149,121.545],[25.155,121.547]]},
 {name:'圓山／大直河岸線',width:22,pts:[[25.071,121.520],[25.071,121.530],[25.071,121.542],[25.079,121.546],[25.084,121.546],[25.085,121.565],[25.083,121.588],[25.083,121.594]]},
 {name:'松山／內湖快送線',width:22,pts:[[25.048,121.578],[25.050,121.578],[25.057,121.577],[25.066,121.574],[25.073,121.577],[25.083,121.588]]},
 {name:'南京東路／松山線',width:22,pts:[[25.0527,121.564],[25.050,121.570],[25.050,121.578]]},
 {name:'八德東城線',width:20,pts:[[25.0475,121.554],[25.049,121.570],[25.050,121.578]]},
 {name:'文山校園線',width:20,pts:[[25.026,121.555],[25.020,121.560],[25.010,121.564],[24.999,121.573],[24.996,121.581]]},
 {name:'景美／木柵遊戲線',width:20,pts:[[25.0206,121.546],[25.011,121.544],[25.000,121.545],[24.999,121.559],[24.999,121.573]]},
 {name:'北城聯絡線',width:20,pts:[[25.0634,121.524],[25.068,121.530],[25.071,121.530]]},
 {name:'台北車站接駁線',width:20,pts:[[25.048,121.508],[25.0478,121.517],[25.048,121.522]]}
);

/* Super Courier Taipei — original delivery systems, delivery core 0.9, presented by ArcadeCourier 1.1 */
class SuperCourierTaipei extends TaipeiCityGame {
  constructor(){super();this.selectedDistrict='西門町';this.elapsed=0;this.accumulator=0;this.route=[];this.navAge=0;this.integrity=100;this.boost=100;this.dashTime=0;this.driftTime=0;this.comboTTL=0;this.interact=0;this.orderSerial=0;this.failures=0;this.distanceDriven=0;this.collisionCooldown=0;this.routeLines=null;this.muted=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;this.voiceEnabled=true;this.messageUntil=0;this.lastMessageAt=-99;this.messageCounts={};this.best={};try{const s=JSON.parse(localStorage.getItem('supercourier.save.v1')||'{}');if(s&&s.version===1){this.best={};for(const [mode,record] of Object.entries(s.best||{})){if(record&&Number.isFinite(record.fare)&&record.fare>=0&&Number.isFinite(record.deliveries))this.best[mode]=record;}this.muted=!!s.muted;this.reducedMotion=!!s.reducedMotion;this.voiceEnabled=s.voiceEnabled!==false;}}catch{} }
  initPhone(){const button=document.getElementById('voice-button');button.textContent='客人語音：'+(this.voiceEnabled?'開':'字幕');button.addEventListener('click',()=>{this.voiceEnabled=!this.voiceEnabled;button.textContent='客人語音：'+(this.voiceEnabled?'開':'字幕');if(!this.voiceEnabled&&window.speechSynthesis)window.speechSynthesis.cancel();this.save();});this.customers.forEach((c,i)=>{c.persona=i%COURIER_PERSONAS.length;});}
  getTerrainHeight(x,z){const north=Math.max(0,-z-1500);return north*.065;}
  getPlayerStartPos(){const zone=COURIER_ZONES.find(z=>z.name===this.selectedDistrict)||COURIER_ZONES[1],p=this.latLngToWorld(zone.lat,zone.lng);const r=this.segments?this.snapRoad(p):p;return new THREE.Vector3(r.x,this.getTerrainHeight(r.x,r.z)+.16,r.z);}
  initPostProcessing(){}
  spawnBowlingPins(){this.bowlingPins=[];}
  spawnScooterWaves(){}
  spawnDestructibleProps(){this.props=[];}
  async init(){await super.init();this.buildNavigation();this.relocateOrders();this.buildVisuals();this.initExtraUI();this.initPhone();this.initCityMap();document.getElementById('btn-restart').addEventListener('click',()=>this.toMenu());document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>this.refreshRecords()));document.querySelectorAll('.driver-card').forEach(c=>c.addEventListener('click',()=>{if(this.audio.ctx)this.audio.ctx.suspend();}));this.carPos.copy(this.getPlayerStartPos());const facing=this.snapRoad(this.carPos);this.carRotY=Math.atan2(facing.b.x-facing.a.x,facing.b.z-facing.a.z);this.carGroup.position.copy(this.carPos);this.carGroup.rotation.y=this.carRotY;this.refreshRecords();}
  initTouchControls(){/* Pointer Events support mouse, pen and touch; controls shown only during play. */}
  initExtraUI(){
    const click=(id,fn)=>document.getElementById(id).addEventListener('click',fn);
    click('pause-button',()=>this.pause());click('resume-button',()=>this.resume());click('retry-button',()=>{this.closePause();this.startGame();});click('menu-button',()=>this.toMenu());click('finish-button',()=>{this.closePause();this.gameState='PLAYING';this.endGame();});click('mute-button',()=>this.toggleMute());click('motion-button',()=>{this.reducedMotion=!this.reducedMotion;document.getElementById('motion-button').textContent='動態效果：'+(this.reducedMotion?'減少':'完整');this.save();});
    click('fullscreen-button',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{this.showStatusToast('此裝置不支援全螢幕');}});
    document.querySelectorAll('[data-key]').forEach(b=>{const key=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.handleKeyDown({code:key,repeat:false,preventDefault(){}});b.classList.add('held');});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{this.handleKeyUp({code:key});b.classList.remove('held');});});
    window.addEventListener('blur',()=>{this.keys={};if(this.gameState==='PLAYING')this.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.gameState==='PLAYING')this.pause();});
    document.getElementById('mute-button').textContent='音效：'+(this.muted?'關':'開');document.getElementById('motion-button').textContent='動態效果：'+(this.reducedMotion?'減少':'完整');
    document.querySelectorAll('.mode-card,.driver-card').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();el.click();}});});
  }
  toggleMute(){this.muted=!this.muted;if(this.muted&&window.speechSynthesis)window.speechSynthesis.cancel();document.getElementById('mute-button').textContent='音效：'+(this.muted?'關':'開');if(this.audio.ctx){if(this.muted)this.audio.ctx.suspend();else if(this.gameState==='PLAYING')this.audio.ctx.resume();}this.save();}
  save(){try{localStorage.setItem('supercourier.save.v1',JSON.stringify({version:1,best:this.best,muted:this.muted,reducedMotion:this.reducedMotion,voiceEnabled:this.voiceEnabled}));}catch{document.getElementById('record-line').textContent='瀏覽器未允許儲存；本次紀錄僅保留於目前頁面。';}}
  refreshRecords(){const b=this.best[this.selectedMode];document.getElementById('record-line').textContent=b?'本機最高 NT$ '+b.fare.toLocaleString()+' · '+b.deliveries+' 單':'本機紀錄 · 等你完成第一班';}
  handleKeyDown(e){if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'&&document.getElementById('city-map-modal').style.display==='flex'){this.closeCityMap();return;}if(e.code==='Escape'||e.code==='KeyP'){if(this.gameState==='PLAYING')this.pause();else if(this.gameState==='PAUSED')this.resume();return;}if(e.code==='Enter'&&this.gameState==='TITLE'){this.startGame();return;}if(this.gameState!=='PLAYING')return;this.keys[e.code]=true;if(e.code==='KeyE')this.triggerDash();if(e.code==='KeyX')this.rescue();if(e.code==='Tab'){e.preventDefault();this.openCityMap();return;}if(e.code==='KeyC'){this.cameraMode=(this.cameraMode+1)%3;}if(e.code==='KeyH')this.audio.playHorn();if(e.code==='KeyM')this.toggleMute();if(e.code==='KeyN')this.toggleNight();if(e.code==='KeyV')this.toggleRain();}
  pause(){if(this.gameState!=='PLAYING')return;this.gameState='PAUSED';this.keys={};document.getElementById('pause-screen').style.display='flex';if(this.audio.ctx)this.audio.ctx.suspend();if(window.speechSynthesis)window.speechSynthesis.cancel();document.getElementById('resume-button').focus();}
  closePause(){document.getElementById('pause-screen').style.display='none';}
  resume(){if(this.gameState!=='PAUSED')return;this.closePause();this.gameState='PLAYING';this.lastTime=performance.now();this.accumulator=0;if(this.audio.ctx&&!this.muted)this.audio.ctx.resume();}
  toMenu(){this.closePause();this.destBeam.visible=false;if(this.routeLines)this.routeLines.visible=false;this.gameState='TITLE';this.keys={};document.getElementById('hud').style.display='none';document.getElementById('mobile-touch-controls').style.display='none';document.getElementById('overlay-screen').style.display='flex';this.stopAudio();document.getElementById('phone-message').classList.remove('visible');this.refreshRecords();}
  stopAudio(){this.audio.radioPlaying=false;clearTimeout(this.audio.radioTimer);if(this.audio.ctx)this.audio.ctx.suspend();if(window.speechSynthesis)window.speechSynthesis.cancel();}
  startGame(){
    super.startGame();this.gameTime=this.selectedMode==='ARCADE'?105:this.selectedMode==='WORK_5MIN'?300:this.selectedMode==='RUSH'?120:Infinity;
    this.elapsed=0;this.lastMessageAt=-99;this.messageUntil=0;document.getElementById('phone-message').classList.remove('visible');this.boost=100;this.dashTime=0;this.integrity=100;this.comboTTL=0;this.failures=0;this.distanceDriven=0;this.interact=0;this.carVy=0;this.isGrounded=true;this.currentGear='D';const facing=this.snapRoad(this.carPos);this.heading=this.carRotY=Math.atan2(facing.b.x-facing.a.x,facing.b.z-facing.a.z);this.keys={};this.padConnected=false;this.padSteer=0;this.padGas=0;this.padBrake=0;this.accumulator=0;this.collisionCooldown=0;this.driftTime=0;this.navAge=0;
    this.customers.forEach((c,i)=>{c.isBoarded=false;c.group.visible=true;c.cooldown=0;c.destination=this.orderDestination(c,i);});this.route=[];this.hideOrder();this.updateNavigation();
    document.getElementById('hud-mode-badge').textContent={ARCADE:'街機接力',WORK_5MIN:'五分鐘班',RUSH:'120 秒衝刺',PRACTICE:'練習配送'}[this.selectedMode];
    if(matchMedia('(pointer: coarse)').matches)document.getElementById('mobile-touch-controls').style.display='flex';
    if(this.muted&&this.audio.ctx)this.audio.ctx.suspend();this.showStatusToast('前方青色商家：進入取貨圈，煞停 0.7 秒取貨');
  }
  endGame(){if(this.gameState!=='PLAYING')return;super.endGame();this.destBeam.visible=false;document.getElementById('phone-message').classList.remove('visible');this.stopAudio();document.getElementById('mobile-touch-controls').style.display='none';const fare=Math.round(this.totalFare);const prev=this.best[this.selectedMode];if(this.selectedMode!=='PRACTICE'&&(!prev||fare>prev.fare)){this.best[this.selectedMode]={fare,deliveries:this.deliveredCount,combo:this.maxCombo};if(this.selectedMode!=='PRACTICE')this.save();}
    document.getElementById('lic-mode-score').textContent=this.failures+' 單逾時 · '+(this.distanceDriven/1000).toFixed(1)+' km';document.getElementById('license-rank-stamp').textContent=fare>=4500?'S':fare>=2800?'A':fare>=1600?'B':fare>=800?'C':'D';document.getElementById('result-note').textContent=this.selectedMode==='PRACTICE'?'練習結束 · 不列入計分紀錄':(!prev||fare>prev.fare?'新本機紀錄！':'最高紀錄 NT$ '+prev.fare.toLocaleString());}
  loop(timestamp){requestAnimationFrame(t=>this.loop(t));const dt=Math.min(Math.max((timestamp-this.lastTime)/1000,0),.08);this.lastTime=timestamp;
    if(this.gameState==='PLAYING'){this.pollGamepad();this.accumulator+=dt;while(this.accumulator>=1/60&&this.gameState==='PLAYING'){this.step(1/60);this.accumulator-=1/60;}this.updateHUD();document.getElementById('phone-message').classList.toggle('visible',this.elapsed<this.messageUntil);this.updateCompass();this.updateRadar();this.updateCamera(dt);}
    else if(this.gameState==='TITLE'){this.titleOrbit=(this.titleOrbit||0)+dt*.04;const p=this.getPlayerStartPos();this.camera.position.set(p.x+Math.sin(this.titleOrbit)*17,p.y+8,p.z-Math.cos(this.titleOrbit)*17);this.camera.lookAt(p.x,p.y+1,p.z);}
    if(this.renderer)this.renderer.render(this.scene,this.camera);
  }
  step(dt){this.elapsed+=dt;if(this.selectedMode!=='PRACTICE'){this.gameTime-=dt;if(this.gameTime<=0){this.gameTime=0;this.endGame();return;}}this.collisionCooldown=Math.max(0,this.collisionCooldown-dt);this.comboTTL-=dt;if(this.comboTTL<=0)this.comboCount=0;
    this.updateVehiclePhysics(dt);this.updateCivilianTraffic(dt);this.updateScooters(dt);this.updateCustomers(dt);this.updateRain(dt);this.navAge-=dt;if(this.navAge<=0){this.updateNavigation();this.navAge=.6;}}
  pollGamepad(){const pads=navigator.getGamepads?navigator.getGamepads():[];const p=Array.from(pads).find(Boolean);if(!p){if(this.padConnected){this.keys={};this.padConnected=false;}return;}this.padConnected=true;const a=p.axes[0]||0;this.padSteer=Math.abs(a)>.16?a:0;this.padDrift=!!p.buttons[1]?.pressed;this.padGas=p.buttons[7]?.value||0;this.padBrake=p.buttons[6]?.value||0;const dash=!!p.buttons[0]?.pressed;if(dash&&!this.padDash)this.triggerDash();this.padDash=dash;const pause=!!p.buttons[9]?.pressed;if(pause&&!this.padPause)this.pause();this.padPause=pause;}
  triggerDash(){if(this.gameState!=='PLAYING'||this.boost<35||this.dashTime>0)return;this.boost-=35;this.dashTime=.8;this.carSpeed=Math.max(this.carSpeed,20);this.audio.playBoost();this.showExhaustFlames();this.showComboBanner('極速起步','stunt-courier-dash');}
  updateVehiclePhysics(dt){const steer=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+(this.padConnected?this.padSteer:0);const gas=!!(this.keys.KeyW||this.keys.ArrowUp)||(this.padConnected&&this.padGas>.15);const brake=!!(this.keys.KeyS||this.keys.ArrowDown)||(this.padConnected&&this.padBrake>.15);const drifting=!!(this.keys.Space||this.padConnected&&this.padDrift)&&Math.abs(steer)>.1&&this.carSpeed>10;this.boost=Math.min(100,this.boost+dt*12);this.dashTime=Math.max(0,this.dashTime-dt);const max=this.currentDriver.topSpeed/3.6;const acceleration=this.currentDriver.accel/90*13;
    if(gas){const dir=this.isManualShift&&this.currentGear==='R'?-1:1;this.carSpeed+=dir*acceleration*dt;if(!this.isManualShift)this.currentGear='D';}else if(brake){if(this.carSpeed>0)this.carSpeed=Math.max(0,this.carSpeed-30*dt);else if(!this.isManualShift){this.carSpeed=Math.max(-8,this.carSpeed-8*dt);this.currentGear='R';}}else this.carSpeed*=Math.exp(-1.2*dt);
    if(this.dashTime>0)this.carSpeed+=25*dt;this.carSpeed=Math.max(-8,Math.min(max*(this.dashTime>0?1.5:1),this.carSpeed));
    const speedRatio=Math.min(Math.abs(this.carSpeed)/6,1);this.carRotY-=Math.max(-1,Math.min(1,steer))*this.currentDriver.steerRate*.63*speedRatio*dt*(this.carSpeed>=0?1:-1)*(drifting?1.45:1);
    let diff=this.carRotY-(this.heading??this.carRotY);diff=Math.atan2(Math.sin(diff),Math.cos(diff));this.heading+=diff*Math.min(dt*(drifting?3:13),1);this.driftFactor=drifting?Math.min(1,this.driftFactor+dt*4):Math.max(0,this.driftFactor-dt*4);
    if(drifting){this.driftTime+=dt;if(this.driftTime>=.85){this.addTip(18);this.showComboBanner('滑行轉彎','stunt-courier-drift');this.customerMessage('drift');this.driftTime=0;}}else this.driftTime=0;
    const old=this.carPos.clone();this.carPos.x+=Math.sin(this.heading)*this.carSpeed*dt;this.carPos.z+=Math.cos(this.heading)*this.carSpeed*dt;this.carPos.y=this.getTerrainHeight(this.carPos.x,this.carPos.z)+.16;
    const road=this.snapRoad(this.carPos);if(road.distance>12){this.carSpeed*=Math.exp(-2*dt);if(road.distance>20){this.carPos.copy(old);this.hit('偏離道路');}}
    if(this.colliders){const c=this.colliders.find(b=>Math.abs(this.carPos.x-b.x)<b.w/2+.5&&Math.abs(this.carPos.z-b.z)<b.d/2+1.0);if(c){this.carPos.copy(old);this.hit('碰撞建築');}}
    this.distanceDriven+=old.distanceTo(this.carPos);this.carGroup.position.copy(this.carPos);this.carGroup.rotation.y=this.carRotY;this.chassisMesh.rotation.z=this.reducedMotion?0:steer*(.10+this.driftFactor*.15)*Math.min(Math.abs(this.carSpeed)/10,1);this.wheels.forEach(w=>w.rotation.x+=this.carSpeed*dt/.48);this.audio.updateEngine(Math.abs(this.carSpeed)/max);this.audio.setSkidVolume(drifting?.14:0);
  }
  hit(label){if(this.collisionCooldown>0)return;this.collisionCooldown=.9;this.carSpeed*=-.2;this.comboCount=0;this.comboTTL=0;const damage=12*(this.currentDriver.perk?.cargo||1);if(this.activeCustomer){this.integrity=Math.max(0,this.integrity-damage);this.customerMessage('crash');}this.audio.playCrash();this.showStatusToast(label+(this.activeCustomer?' · 貨物完整度 −'+damage+'%':''));}
  rescue(){const r=this.snapRoad(this.carPos);this.carPos.set(r.x,this.getTerrainHeight(r.x,r.z)+.16,r.z);this.carRotY=this.heading=Math.atan2(r.b.x-r.a.x,r.b.z-r.a.z);this.carSpeed=0;this.keys={};if(this.selectedMode!=='PRACTICE')this.gameTime=Math.max(.1,this.gameTime-5);if(this.activeCustomer)this.integrity=Math.max(0,this.integrity-8);this.showStatusToast(this.selectedMode==='PRACTICE'?'已扶正機車，回到道路':'已扶正機車 · −5 秒');}
  updateCivilianTraffic(dt){this.traffic.forEach(t=>{t.progress+=dt*t.speed/t.length;if(t.progress>=1)t.progress=0;const p=t.progress;const dx=t.b.x-t.a.x,dz=t.b.z-t.a.z;t.group.position.set(t.a.x+dx*p-dz/t.length*2,0,t.a.z+dz*p+dx/t.length*2);t.group.position.y=this.getTerrainHeight(t.group.position.x,t.group.position.z)+.5;const d=this.carPos.distanceTo(t.group.position);if(d<2.0){this.hit('碰撞車流');t.wasClose=true;}else if(d<5&&Math.abs(this.carSpeed)>12&&!t.wasClose){this.addTip(22);this.showComboBanner('擦身快送','stunt-courier-through');this.customerMessage('near');t.wasClose=true;}if(d>12)t.wasClose=false;});}
  updateScooters(dt){this.scooters.forEach(s=>{s.progress+=dt*s.speed/s.length;if(s.progress>=1)s.progress=0;s.group.position.set(s.a.x+(s.b.x-s.a.x)*s.progress,0.3,s.a.z+(s.b.z-s.a.z)*s.progress);s.group.position.y=this.getTerrainHeight(s.group.position.x,s.group.position.z)+.3;if(this.carPos.distanceTo(s.group.position)<1.2)this.hit('擦撞機車');});}
  addTip(amount){if(!this.activeCustomer)return;const multiplier=1+Math.min(this.comboCount,10)*.1;super.addTip(Math.round(amount*multiplier));this.comboTTL=4;}
  spawnWorldCustomers(){super.spawnWorldCustomers();}
  updateCustomers(dt){const target=this.activeCustomer||this.nearestMerchant();this.customers.forEach(c=>{c.cooldown=Math.max(0,(c.cooldown||0)-dt);if(c.icon)c.icon.position.y=3+Math.sin(this.elapsed*2+c.wavePhase)*.18;c.group.visible=!c.isBoarded&&c.cooldown<=0;});
    if(!target)return;const pos=this.activeCustomer?target.destination.pos:target.group.position;const dist=Math.hypot(pos.x-this.carPos.x,pos.z-this.carPos.z);const near=dist<(this.activeCustomer?10:7)&&Math.abs(this.carSpeed)<1.5;
    this.interact=near?this.interact+dt:0;if(near){document.getElementById('objective-line').textContent=(this.activeCustomer?'交付中':'取貨中')+' '+Math.min(100,Math.round(this.interact/.7*100))+'%';}
    if(this.activeCustomer){this.activeCustomerTimer-=dt;if(!this.activeCustomer.warnedHalf&&this.activeCustomerTimer<this.activeCustomerInitialTime*.5){this.activeCustomer.warnedHalf=true;this.customerMessage('half');}if(!this.activeCustomer.warnedUrgent&&this.activeCustomerTimer<10){this.activeCustomer.warnedUrgent=true;this.customerMessage('urgent',true);}if(this.activeCustomerTimer<=0){this.customerMessage('late',true);this.failures++;this.showStatusToast('訂單逾時 · 運費 $0');this.finishOrder(false);}else if(this.interact>=.7)this.deliverCustomer();}
    else if(this.interact>=.7)this.boardCustomer(target);
  }
  nearestMerchant(){let result=null,dist=Infinity;this.customers.forEach(c=>{if(!c.isBoarded&&!(c.cooldown>0)){const d=this.carPos.distanceTo(c.group.position);if(d<dist){dist=d;result=c;}}});return result;}
  boardCustomer(c){if(this.activeCustomer)return;this.activeCustomer=c;c.isBoarded=true;this.currentTip=0;this.comboCount=0;this.integrity=100;this.interact=0;c.warnedHalf=false;c.warnedUrgent=false;this.messageCounts={};const route=this.findRoute(this.carPos,c.destination.pos);const distance=this.routeDistance(route);c.baseFare=Math.round(110+distance*.72);this.activeCustomerTimer=Math.max(40,Math.ceil(distance/8.6+26));if(this.selectedMode==='ARCADE')this.activeCustomerTimer*=1.08;if(this.selectedMode==='RUSH')this.activeCustomerTimer*=.88;this.activeCustomerInitialTime=this.activeCustomerTimer;
    this.audio.playCash();this.showStatusToast('已取貨：'+c.item+' → '+c.destination.name);document.getElementById('hud-destination').style.display='block';document.getElementById('hud-customer-timer').style.display='block';document.getElementById('hud-distance').style.display='block';document.getElementById('hud-destination').textContent=c.destination.name;this.updateNavigation();this.customerMessage('pickup',true);}
  deliverCustomer(){if(!this.activeCustomer)return;const c=this.activeCustomer;this.customerMessage(this.integrity>=88?'success':'damaged',true);const ratio=this.activeCustomerTimer/this.activeCustomerInitialTime;const bonus=Math.round(Math.max(0,this.activeCustomerTimer)*2);const fare=Math.round((c.baseFare+this.currentTip+bonus)*(.4+.6*this.integrity/100));this.totalFare+=fare;this.deliveredCount++;if(ratio>=.45)this.speedyCount++;const time=this.selectedMode==='ARCADE'?Math.min(18,Math.round(6+this.activeCustomerTimer*.18)):0;this.gameTime+=time;this.audio.playCash();this.showComboBanner('送達！ NT$ '+fare+(time?' · +'+time+'s':''),'stunt-courier-dash');this.finishOrder(true);}
  finishOrder(success){const c=this.activeCustomer;if(!c)return;c.cooldown=success?9:14;c.isBoarded=false;c.destination=this.orderDestination(c,++this.orderSerial);this.activeCustomer=null;this.currentTip=0;this.comboCount=0;this.comboTTL=0;this.interact=0;this.hideOrder();this.updateNavigation();}
  hideOrder(){['hud-destination','hud-customer-timer','hud-distance'].forEach(id=>document.getElementById(id).style.display='none');}
  buildNavigation(){this.segments=[];this.roadGraph.forEach((r,ri)=>{for(let i=0;i<r.length-1;i++)this.segments.push({a:r[i],b:r[i+1],ri,points:[{...r[i],t:0},{...r[i+1],t:1}]});});const seg=this.segments;
    for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++){const a=seg[i],b=seg[j];const rx=a.b.x-a.a.x,rz=a.b.z-a.a.z,sx=b.b.x-b.a.x,sz=b.b.z-b.a.z,den=rx*sz-rz*sx;if(Math.abs(den)<.00001)continue;const qx=b.a.x-a.a.x,qz=b.a.z-a.a.z,t=(qx*sz-qz*sx)/den,u=(qx*rz-qz*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1){const p={x:a.a.x+t*rx,z:a.a.z+t*rz};a.points.push({...p,t});b.points.push({...p,t:u});}}
    this.nodes=[];const map=new Map();const node=p=>{const k=p.x.toFixed(2)+','+p.z.toFixed(2);if(!map.has(k)){map.set(k,this.nodes.length);this.nodes.push({x:p.x,z:p.z,edges:[]});}return map.get(k);};seg.forEach(s=>{s.points.sort((a,b)=>a.t-b.t);for(let i=0;i<s.points.length-1;i++){const a=node(s.points[i]),b=node(s.points[i+1]);if(a===b)continue;const d=Math.hypot(this.nodes[a].x-this.nodes[b].x,this.nodes[a].z-this.nodes[b].z);this.nodes[a].edges.push({to:b,d});this.nodes[b].edges.push({to:a,d});}s.ids=s.points.map(node);});
    this.components=new Array(this.nodes.length).fill(-1);let component=0;for(let i=0;i<this.nodes.length;i++){if(this.components[i]>=0)continue;const stack=[i];this.components[i]=component;while(stack.length){const n=stack.pop();this.nodes[n].edges.forEach(e=>{if(this.components[e.to]<0){this.components[e.to]=component;stack.push(e.to);}});}component++;}const counts={};this.components.forEach(c=>counts[c]=(counts[c]||0)+1);this.mainComponent=Number(Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]);
  }
  snapRoad(p){let best={distance:Infinity};for(const s of this.segments||[]){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=dx*dx+dz*dz;const t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/l));const x=s.a.x+t*dx,z=s.a.z+t*dz,distance=Math.hypot(x-p.x,z-p.z);if(distance<best.distance)best={x,z,distance,a:s.a,b:s.b,ri:s.ri,segment:s,t};}return best;}
  nearestNode(p){let index=0,best=Infinity;this.nodes.forEach((n,i)=>{if(this.components[i]!==this.mainComponent)return;const d=Math.hypot(n.x-p.x,n.z-p.z);if(d<best){index=i;best=d;}});return index;}
  findRoute(from,to){const a=this.snapRoad(from),b=this.snapRoad(to);const candidates=r=>{let lo=0;for(let i=0;i<r.segment.points.length;i++){if(r.segment.points[i].t<=r.t)lo=i;}const hi=Math.min(lo+1,r.segment.points.length-1);return [...new Set([r.segment.ids[lo],r.segment.ids[hi]])].map(id=>({id,d:Math.hypot(this.nodes[id].x-r.x,this.nodes[id].z-r.z)}));};const starts=candidates(a),ends=candidates(b),dist=this.nodes.map(()=>Infinity),prev=this.nodes.map(()=>-1),done=new Set();starts.forEach(p=>dist[p.id]=p.d);for(let k=0;k<this.nodes.length;k++){let u=-1,min=Infinity;for(let i=0;i<dist.length;i++)if(!done.has(i)&&dist[i]<min){min=dist[i];u=i;}if(u<0)break;done.add(u);this.nodes[u].edges.forEach(e=>{if(dist[u]+e.d<dist[e.to]){dist[e.to]=dist[u]+e.d;prev[e.to]=u;}});}const end=ends.sort((x,y)=>dist[x.id]+x.d-dist[y.id]-y.d)[0];let path=[];if(a.segment===b.segment&&Math.hypot(a.x-b.x,a.z-b.z)<=dist[end.id]+end.d){path=[from,a,b,to];}else{if(!isFinite(dist[end.id]))throw new Error('訂單道路不連通');for(let u=end.id;u>=0;u=prev[u])path.unshift(this.nodes[u]);path=[from,a,...path,b,to];}return path.filter((p,i,list)=>!i||Math.hypot(p.x-list[i-1].x,p.z-list[i-1].z)>.1);}
  routeDistance(path){return path.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z):0),0);}
  relocateOrders(){this.dropoffs=COURIER_ZONES.map(zone=>{const p=this.snapRoad(this.latLngToWorld(zone.lat,zone.lng));return {name:zone.name,pos:new THREE.Vector3(p.x,this.getTerrainHeight(p.x,p.z),p.z)};});const names=['晨光飯糰','巷口茶作','阿嬤便當','街角咖啡','日常花室','好味麵屋','暖心烘焙','夜市鹽酥雞','鮮果小舖','城市書房'];const items=['早餐餐盒','手搖飲','熱便當','冰咖啡','花束','牛肉麵','麵包','炸物餐盒','水果盒','書籍包裹'];
    const valid=this.nodes.filter((n,i)=>this.components[i]===this.mainComponent&&n.x>-700&&n.x<620&&n.z>-450&&n.z<550);
    this.customers.forEach((c,i)=>{const zone=COURIER_ZONES[i%COURIER_ZONES.length],n=this.latLngToWorld(zone.lat,zone.lng),p=this.snapRoad(n),len=Math.hypot(p.b.x-p.a.x,p.b.z-p.a.z),px=p.x+(p.b.x-p.a.x)/len*14,pz=p.z+(p.b.z-p.a.z)/len*14,sp=this.snapRoad({x:px,z:pz});c.group.position.set(sp.x,this.getTerrainHeight(sp.x,sp.z),sp.z);c.shop=names[i%names.length];c.item=items[i%items.length];c.tier.color=0x00e5cf;c.ring.material.color.setHex(0x00e5cf);c.icon.material.color.setHex(0x00e5cf);c.cooldown=0;c.destination=this.orderDestination(c,i);const label=this.makeLabel(c.shop+'\n'+c.item,'#09e2c6');label.position.set(0,5,0);c.group.add(label);});
    this.traffic.forEach((t,i)=>{const s=this.segments[(i*9+12)%this.segments.length];Object.assign(t,{a:s.a,b:s.b,length:Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),progress:(i*.13)%1,speed:5+i%4});t.group.rotation.y=Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z);});this.scooters.forEach((s,i)=>{const r=this.segments[(i*11+24)%this.segments.length];Object.assign(s,{a:r.a,b:r.b,length:Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),progress:(i*.09)%1,speed:3+i%3});s.group.rotation.y=Math.atan2(r.b.x-r.a.x,r.b.z-r.a.z);});
    this.colliders=[];this.scene.children.forEach(g=>{if(g.type!=='Group'||g===this.carGroup||g.position.x===0&&g.position.z===0)return;const base=g.children.find(c=>c.isMesh&&c.geometry?.type==='BoxGeometry'&&c.geometry.parameters.height===4&&c.geometry.parameters.width>25);if(base)this.colliders.push({x:g.position.x,z:g.position.z,w:base.geometry.parameters.width,d:base.geometry.parameters.depth});});
  }
  orderDestination(c,seed){const choices=this.dropoffs.map(l=>({l,d:this.routeDistance(this.findRoute(c.group.position,l.pos))})).filter(v=>v.d>120);const cap=this.selectedMode==='PRACTICE'?Infinity:this.selectedMode==='WORK_5MIN'?1700:950;const suitable=choices.filter(v=>v.d<=cap);const list=suitable.length?suitable:choices.sort((a,b)=>a.d-b.d).slice(0,2);return list[(seed+1)%list.length]?.l||this.dropoffs[0];}
  makeLabel(text,color){const cv=document.createElement('canvas');cv.width=512;cv.height=160;const ctx=cv.getContext('2d');ctx.fillStyle='#09232ee8';ctx.fillRect(0,0,512,160);ctx.fillStyle=color;ctx.fillRect(0,0,8,160);ctx.textAlign='center';text.split('\n').forEach((line,i)=>{ctx.font=i?'24px "Noto Sans TC"':'bold 38px "Noto Sans TC"';ctx.fillStyle=i?'#ffffff':color;ctx.fillText(line,256,65+i*48);});const tex=new THREE.CanvasTexture(cv);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));s.scale.set(12,3.75,1);return s;}
  applyLighting(){super.applyLighting();this.scene.children.forEach(o=>{if(o.isMesh&&o.geometry?.type==='SphereGeometry'&&o.geometry.parameters.radius===4000)o.visible=!this.isNight;});this.scene.fog.density=this.isNight?.0016:.0012;}
  buildTaipeiLandmarks(){super.buildTaipeiLandmarks();for(const z of COURIER_ZONES){if(this.landmarks.some(l=>l.name===z.name||z.name==='101'&&l.name==='台北101'))continue;this.addSimpleLandmark(z.name,z.lat,z.lng,12,z.name==='陽明山'?0x49835f:0x6a9198,z.name,'#103a43');}for(let i=0;i<32;i++){const n=this.latLngToWorld(25.117+i*.0012,121.534),side=i%2?1:-1,x=n.x+side*(45+i%5*8),z=n.z;const tree=new THREE.Mesh(new THREE.ConeGeometry(7,22,7),new THREE.MeshLambertMaterial({color:0x305d48}));tree.position.set(x,this.getTerrainHeight(x,z)+11,z);this.scene.add(tree);}}
  initCityMap(){const select=document.getElementById('start-district');select.innerHTML=COURIER_ZONES.map(z=>'<option value="'+z.name+'"'+(z.name===this.selectedDistrict?' selected':'')+'>'+z.name+' · '+z.tag+'</option>').join('');select.addEventListener('change',()=>{this.selectedDistrict=select.value;this.carPos.copy(this.getPlayerStartPos());const p=this.snapRoad(this.carPos);this.carRotY=Math.atan2(p.b.x-p.a.x,p.b.z-p.a.z);this.carGroup.position.copy(this.carPos);this.carGroup.rotation.y=this.carRotY;this.titleOrbit=0;});for(const id of ['city-map-button','hud-map-button'])document.getElementById(id).addEventListener('click',()=>this.openCityMap());document.getElementById('close-map-button').addEventListener('click',()=>this.closeCityMap());}
  openCityMap(){this.mapPaused=this.gameState==='PLAYING';if(this.mapPaused)this.pause();document.getElementById('city-map-modal').style.display='flex';this.drawCityMap();document.getElementById('close-map-button').focus();}
  closeCityMap(){document.getElementById('city-map-modal').style.display='none';if(this.mapPaused){this.mapPaused=false;this.resume();}}
  drawCityMap(){const cv=document.getElementById('city-map-canvas');cv.width=900;cv.height=780;const ctx=cv.getContext('2d');ctx.fillStyle='#0b222d';ctx.fillRect(0,0,900,780);const xy=p=>this.mapXY?this.mapXY(p):[90+(p.x+900)*.4,55+(p.z+2500)*.19];ctx.strokeStyle='#456c78';ctx.lineWidth=3;this.segments.forEach(s=>{const a=xy(s.a),b=xy(s.b);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();});if(this.activeCustomer){ctx.strokeStyle='#ffc857';ctx.lineWidth=4;ctx.beginPath();this.route.forEach((p,i)=>i?ctx.lineTo(...xy(p)):ctx.moveTo(...xy(p)));ctx.stroke();}this.dropoffs.forEach(l=>{const p=xy(l.pos);ctx.fillStyle=l.name==='陽明山'?'#8dd69a':'#00e5cf';ctx.beginPath();ctx.arc(...p,5,0,Math.PI*2);ctx.fill();ctx.font='bold 14px "Noto Sans TC"';ctx.textAlign='left';ctx.fillText(l.name,p[0]+10,p[1]-7);});const p=xy(this.carPos);ctx.fillStyle='#ffc857';ctx.beginPath();ctx.arc(...p,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8caeb9';ctx.font='14px "Noto Sans TC"';ctx.fillText('北 ↑　遊戲縮尺路網 / 非真實導航',35,748);}
  buildPlayerTaxi(){
    this.carGroup=new THREE.Group();this.chassisMesh=new THREE.Group();this.carGroup.add(this.chassisMesh);this.chassisMat=new THREE.MeshStandardMaterial({color:this.currentDriver.color,roughness:.48,metalness:.25});const dark=new THREE.MeshStandardMaterial({color:0x142b35,roughness:.65});const rubber=new THREE.MeshStandardMaterial({color:0x10151b,roughness:.92});const metal=new THREE.MeshStandardMaterial({color:0xa7c1c9,roughness:.3,metalness:.65});
    const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);this.chassisMesh.add(m);return m;};
    box(.5,.35,1.5,this.chassisMat,0,.6,0);box(.54,.12,.8,dark,0,1,-.18);box(.52,.6,.35,this.chassisMat,0,.85,.65);box(.44,.12,.42,metal,0,.35,-.3);
    this.wheels=[];for(const z of [-.82,.87]){const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.19,20),rubber);tyre.geometry.rotateZ(Math.PI/2);tyre.position.set(0,.37,z);this.carGroup.add(tyre);this.wheels.push(tyre);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.2,16),metal);hub.geometry.rotateZ(Math.PI/2);tyre.add(hub);}
    const rod=(a,b,r,mat)=>{const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),delta=w.clone().sub(v),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mat);m.position.copy(v.add(w).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());this.chassisMesh.add(m);return m;};
    rod([0,.45,.87],[0,1.13,.62],.035,metal);rod([-.34,1.17,.6],[.34,1.17,.6],.025,dark);rod([0,.4,-.82],[0,.8,-.3],.04,metal);
    const jacket=new THREE.MeshStandardMaterial({color:0xf2e8c5,roughness:.85}),pants=new THREE.MeshStandardMaterial({color:0x224252,roughness:.9}),skin=new THREE.MeshStandardMaterial({color:0xe9b58d,roughness:.85});
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.23,.2,.55,10),jacket);torso.position.set(0,1.35,-.06);torso.rotation.x=.15;this.chassisMesh.add(torso);
    for(const x of [-.2,.2]){rod([x,1.06,-.13],[x*.9,.72,.15],.09,pants);rod([x*.9,.72,.15],[x*.9,.46,.25],.07,pants);rod([x,1.55,0],[x*1.3,1.24,.32],.065,jacket);rod([x*1.3,1.24,.32],[x*1.4,1.17,.6],.055,skin);box(.14,.12,.3,dark,x,.43,.26);}
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.28,16,12),this.chassisMat);helmet.position.set(0,1.88,.06);this.chassisMesh.add(helmet);const visor=new THREE.Mesh(new THREE.SphereGeometry(.285,16,10,0,Math.PI),new THREE.MeshStandardMaterial({color:0x0c202c,metalness:.45,roughness:.15}));visor.position.copy(helmet.position);this.chassisMesh.add(visor);
    const cargo=box(.75,.66,.7,new THREE.MeshStandardMaterial({color:0x00c9b0,roughness:.6}),0,1.34,-.86);box(.8,.08,.75,dark,0,1.71,-.86);const badge=this.makeLabel('快送 EXPRESS','#ffd260');badge.scale.set(.65,.2,1);badge.position.set(0,1.38,-1.22);this.chassisMesh.add(badge);
    box(.33,.18,.05,new THREE.MeshBasicMaterial({color:0xfff2c9}),0,1.03,.87);box(.25,.12,.05,new THREE.MeshBasicMaterial({color:0xff4c5c}),0,.64,-1.02);this.taxiSign=new THREE.Object3D();this.exhaustFlames=[];const trail=new THREE.Mesh(new THREE.ConeGeometry(.12,.8,8).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x00e5cf,transparent:true,opacity:0}));trail.position.set(0,.4,-1.25);this.chassisMesh.add(trail);this.exhaustFlames.push(trail);this.scene.add(this.carGroup);
  }
  buildVisuals(){this.destBeam.children.forEach(c=>{if(c.material?.color)c.material.color.setHex(0xffc857);});
    this.customers.forEach(c=>{const booth=new THREE.Group();const wall=new THREE.Mesh(new THREE.BoxGeometry(4.2,3.3,2),new THREE.MeshStandardMaterial({color:0x163e48,roughness:.8}));wall.position.set(0,1.65,0);booth.add(wall);const awning=new THREE.Mesh(new THREE.BoxGeometry(4.7,.25,2.6),new THREE.MeshStandardMaterial({color:0x00c9b0}));awning.position.set(0,3.5,.3);booth.add(awning);const p=this.snapRoad(c.group.position);const dx=p.b.x-p.a.x,dz=p.b.z-p.a.z,l=Math.hypot(dx,dz);const bx=c.group.position.x+dz/l*9,bz=c.group.position.z-dx/l*9;booth.position.set(bx,this.getTerrainHeight(bx,bz),bz);booth.rotation.y=Math.atan2(dx,dz);this.scene.add(booth);});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=false;this.scene.fog.density=.0012;
  }
  updateNavigation(){const c=this.activeCustomer||this.nearestMerchant();if(!c)return;const target=this.activeCustomer?c.destination.pos:c.group.position;this.route=this.findRoute(this.carPos,target);if(this.routeLines){this.scene.remove(this.routeLines);this.routeLines.geometry.dispose();this.routeLines.material.dispose();}const pts=this.route.map(p=>new THREE.Vector3(p.x,this.getTerrainHeight(p.x,p.z)+.22,p.z));const geo=new THREE.BufferGeometry().setFromPoints(pts);this.routeLines=new THREE.Line(geo,new THREE.LineBasicMaterial({color:this.activeCustomer?0xffc857:0x00e5cf}));this.scene.add(this.routeLines);this.navTarget=this.route.find(p=>Math.hypot(p.x-this.carPos.x,p.z-this.carPos.z)>18)||target;this.navDistance=this.routeDistance(this.route);this.destBeam.visible=!!this.activeCustomer;if(this.activeCustomer)this.destBeam.position.copy(target);document.getElementById('route-name').textContent=TAIPEI_ROADS[this.snapRoad(this.carPos).ri]?.name||'台北街頭';}
  updateCompass(){const cv=document.getElementById('hud-compass-canvas'),ctx=cv.getContext('2d');ctx.clearRect(0,0,120,120);if(!this.navTarget)return;const angle=Math.atan2(this.navTarget.x-this.carPos.x,this.navTarget.z-this.carPos.z)-this.carRotY;ctx.save();ctx.translate(60,60);ctx.rotate(-angle);ctx.fillStyle=this.activeCustomer?'#ffc857':'#00e5cf';ctx.beginPath();ctx.moveTo(0,-45);ctx.lineTo(27,-8);ctx.lineTo(9,-8);ctx.lineTo(9,35);ctx.lineTo(-9,35);ctx.lineTo(-9,-8);ctx.lineTo(-27,-8);ctx.closePath();ctx.fill();ctx.restore();}
  updateRadar(){const ctx=document.getElementById('radar-canvas').getContext('2d');ctx.clearRect(0,0,140,140);ctx.fillStyle='#0b1e29';ctx.fillRect(0,0,140,140);const scale=.14;const xy=p=>[70+(p.x-this.carPos.x)*scale,70+(p.z-this.carPos.z)*scale];ctx.strokeStyle='#426270';ctx.lineWidth=3;this.segments.forEach(s=>{const a=xy(s.a),b=xy(s.b);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();});ctx.strokeStyle=this.activeCustomer?'#ffc857':'#00e5cf';ctx.lineWidth=2;ctx.beginPath();this.route.forEach((p,i)=>{const q=xy(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.stroke();this.customers.forEach(c=>{if(c.cooldown>0||c.isBoarded)return;ctx.fillStyle='#00e5cf';const p=xy(c.group.position);ctx.fillRect(p[0]-2,p[1]-2,4,4);});if(this.activeCustomer){ctx.fillStyle='#ffc857';const p=xy(this.activeCustomer.destination.pos);ctx.fillRect(p[0]-4,p[1]-4,8,8);}ctx.save();ctx.translate(70,70);ctx.rotate(-this.carRotY);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-4,-5);ctx.lineTo(4,-5);ctx.fill();ctx.restore();}
  updateHUD(){super.updateHUD();document.getElementById('hud-timer').textContent=isFinite(this.gameTime)?Math.ceil(this.gameTime):'∞';document.getElementById('hud-speed').textContent=Math.round(Math.abs(this.carSpeed)*3.6);document.getElementById('hud-current-fare').textContent=this.activeCustomer?'本單 NT$ '+this.activeCustomer.baseFare+' · 技巧 +'+this.currentTip:'完成 '+this.deliveredCount+' 單';document.getElementById('boost-fill').style.width=this.boost+'%';document.getElementById('cargo-value').textContent=this.activeCustomer?Math.round(this.integrity)+'%':'—';document.getElementById('cargo-fill').style.width=(this.activeCustomer?this.integrity:100)+'%';document.getElementById('boost-label').textContent=this.boost>=35?'E 極速起步':'能量恢復中';document.getElementById('hud-distance').textContent=Math.round(this.navDistance||0)+' m · 依道路導航';const c=this.activeCustomer||this.nearestMerchant();if(this.interact===0)document.getElementById('objective-line').textContent=this.activeCustomer?'送往 '+c.destination.name+' · 停穩交付':c?'前往 '+c.shop+' · 停穩取貨':'等待新訂單';document.getElementById('order-item').textContent=this.activeCustomer?c.shop+' / '+c.item:'青色取貨 · 金色送達';document.getElementById('gear-d').className='gear-item'+(this.currentGear==='D'?' active-d':'');document.getElementById('gear-r').className='gear-item'+(this.currentGear==='R'?' active-r':'');}
  updateCamera(dt=.016){if(!this.carGroup)return;const rot=this.carRotY;const dist=this.cameraMode===1?4.2:this.cameraMode===2?-.5:6.5+(this.reducedMotion?0:Math.abs(this.carSpeed)*.07),height=this.cameraMode===2?1.8:3.4;const desired=new THREE.Vector3(this.carPos.x-Math.sin(rot)*dist,this.carPos.y+height,this.carPos.z-Math.cos(rot)*dist);this.camera.position.lerp(desired,1-Math.exp(-dt*9));this.camera.lookAt(this.carPos.x+Math.sin(rot)*8,this.carPos.y+1,this.carPos.z+Math.cos(rot)*8);const fov=this.reducedMotion?65:65+Math.min(Math.abs(this.carSpeed)*.25,10);this.camera.fov=fov;this.camera.updateProjectionMatrix();}
}
window.addEventListener('load',()=>{if(window.__game)return;const game=new TaipeiStreetCourier();window.__game=game;game.init().catch(e=>{const message=String(e?.message||e||'未知錯誤'),chunkFailure=/world-chunks|manifest|公開地圖資料|chunk/i.test(message);document.getElementById('loading-screen').style.display='flex';document.getElementById('overlay-screen').style.display='none';document.getElementById('loading-text').textContent=chunkFailure?'台北街道資料載入失敗，請重新整理；若仍失敗請稍後再試。':'無法啟動 3D 遊戲：請開啟瀏覽器硬體加速，或更換支援 WebGL 的瀏覽器。';document.getElementById('loading-error').textContent=message;console.error(e);});});


/* P2 Preview module: taipei-data.js */
/* 2.2 city content. WGS84 anchors, projected by the existing 1:5 arcade scale.
   Centerlines are hand-sampled approximations, not survey/navigation data.
   Sources and research date are recorded in GEOGRAPHY.md. */
const TAIPEI_RIVERS = [
 {name:'基隆河',width:72,pts:[[25.111,121.482],[25.095,121.491],[25.081,121.505],[25.074,121.523],[25.073,121.541],[25.069,121.555],[25.064,121.570],[25.059,121.579],[25.063,121.591],[25.069,121.606],[25.075,121.622]]},
 {name:'淡水河',width:95,pts:[[25.111,121.482],[25.096,121.484],[25.082,121.490],[25.069,121.499],[25.056,121.504],[25.040,121.499],[25.030,121.493]]},
 {name:'新店溪',width:65,pts:[[25.030,121.493],[25.019,121.502],[25.012,121.515],[25.008,121.529],[24.997,121.536],[24.982,121.533]]},
 {name:'景美溪',width:27,pts:[[24.997,121.536],[24.989,121.545],[24.987,121.557],[24.987,121.570],[24.992,121.580],[24.997,121.589],[24.997,121.603]]}
];
const TAIPEI_ROAD_UPDATES = {
 '忠孝東西路':[[25.046,121.508],[25.046,121.517],[25.0448,121.524],[25.0422,121.533],[25.0418,121.544],[25.0415,121.551],[25.0412,121.558],[25.041,121.565],[25.0406,121.576],[25.044,121.587]],
 '基隆路':[[25.022,121.552],[25.028,121.556],[25.033,121.560],[25.041,121.565],[25.047,121.568],[25.051,121.574]],
 '中山南北路':[[25.033,121.519],[25.042,121.519],[25.048,121.520],[25.055,121.522],[25.063,121.522],[25.071,121.524],[25.080,121.525]],
 '羅斯福路':[[25.035,121.519],[25.028,121.521],[25.022,121.525],[25.016,121.533],[25.013,121.541],[25.000,121.541],[24.991,121.541]],
 '復興南北路':[[25.0260,121.5437],[25.0330,121.5438],[25.0400,121.5439],[25.0470,121.5440],[25.0540,121.5440],[25.0610,121.5440],[25.0680,121.5441],[25.0750,121.5446]],
 '敦化南北路':[[25.0240,121.5487],[25.0330,121.5488],[25.0400,121.5488],[25.0470,121.5489],[25.0540,121.5490],[25.0610,121.5491],[25.0660,121.5492]],
 '建國南北路':[[25.026,121.5375],[25.033,121.5375],[25.040,121.5375],[25.047,121.5375],[25.054,121.5375],[25.061,121.5375],[25.068,121.5375]],
 '新生南北路':[[25.026,121.5325],[25.034,121.5324],[25.041,121.5322],[25.045,121.5292],[25.053,121.5273],[25.063,121.5276],[25.068,121.5277]],
 '中山北路／士林線':[[25.048,121.520],[25.055,121.522],[25.063,121.522],[25.071,121.524],[25.080,121.525],[25.093,121.527],[25.105,121.530],[25.116,121.533]],
 '陽明山遊戲山線':[[25.116,121.533],[25.125,121.529],[25.135,121.538],[25.143,121.532],[25.149,121.540],[25.155,121.547]],
 '圓山／大直河岸線':[[25.071,121.524],[25.071,121.530],[25.071,121.540],[25.073,121.545],[25.081,121.549],[25.085,121.549],[25.085,121.557],[25.083,121.572],[25.079,121.580],[25.083,121.588],[25.083,121.594]],
 '松山／內湖快送線':[[25.050,121.578],[25.055,121.578],[25.062,121.575],[25.069,121.575],[25.079,121.580],[25.083,121.588]],
 '文山校園線':[[25.026,121.555],[25.020,121.560],[25.010,121.564],[24.999,121.573],[24.998,121.579]],
 '景美／木柵遊戲線':[[25.0206,121.546],[25.011,121.544],[25.000,121.541],[24.991,121.541],[24.990,121.556],[24.992,121.570],[24.999,121.573]]
};
for(const road of TAIPEI_ROADS)if(TAIPEI_ROAD_UPDATES[road.name])road.pts=TAIPEI_ROAD_UPDATES[road.name];
TAIPEI_ROADS.push(
 {name:'北安路／敬業三路',width:22,pts:[[25.080,121.525],[25.084,121.540],[25.085,121.549],[25.085,121.557],[25.083,121.557]]},
 {name:'承德路／大稻埕',width:20,pts:[[25.046,121.517],[25.055,121.517],[25.063,121.517],[25.073,121.517],[25.080,121.525]]},
 {name:'民生東西路',width:22,pts:[[25.057,121.507],[25.057,121.522],[25.058,121.533],[25.058,121.544],[25.058,121.556],[25.058,121.568]]},
 {name:'和平東路／公館',width:18,pts:[[25.0267,121.546],[25.026,121.555],[25.024,121.563]]},
 {name:'動物園／貓空山線',width:16,pts:[[24.998,121.579],[24.988,121.581],[24.981,121.589],[24.975,121.582],[24.968,121.588]]}
);

// 2.2: secondary urban axes. These denser hand-sampled streets are deliberately
// simplified for arcade navigation, but they preserve Taipei's characteristic
// north/south + east/west block rhythm across the central basin.
TAIPEI_ROADS.push(
 {name:'重慶南北路',width:18,pts:[[25.031,121.5135],[25.039,121.5135],[25.047,121.5134],[25.055,121.5134],[25.063,121.5133],[25.071,121.5132]]},
 {name:'延平南北路',width:14,pts:[[25.035,121.5102],[25.043,121.5104],[25.051,121.5107],[25.059,121.5110],[25.067,121.5113],[25.074,121.5116]]},
 {name:'長安東西路',width:16,pts:[[25.0490,121.507],[25.0492,121.517],[25.0494,121.526],[25.0496,121.535],[25.0497,121.544],[25.0499,121.553],[25.0502,121.561]]},
 {name:'民族東西路',width:18,pts:[[25.0680,121.508],[25.0680,121.517],[25.0681,121.526],[25.0682,121.536],[25.0683,121.546],[25.0684,121.556]]},
 {name:'長春路',width:14,pts:[[25.0548,121.518],[25.0549,121.527],[25.0550,121.536],[25.0551,121.545],[25.0552,121.554],[25.0553,121.563]]},
 {name:'松江路',width:18,pts:[[25.044,121.5330],[25.052,121.5330],[25.060,121.53305],[25.066,121.5331]]},
 {name:'光復南北路',width:16,pts:[[25.026,121.555],[25.034,121.555],[25.042,121.555],[25.050,121.555],[25.058,121.555],[25.064,121.555]]},
 {name:'市府路／逸仙路',width:14,pts:[[25.033,121.5615],[25.040,121.5615],[25.047,121.5613],[25.052,121.5612]]},
 {name:'松山路',width:16,pts:[[25.034,121.5770],[25.041,121.5771],[25.048,121.5772],[25.055,121.5774],[25.061,121.5775]]},
 {name:'成都路／桂林路',width:13,pts:[[25.036,121.495],[25.037,121.502],[25.038,121.509],[25.039,121.515]]},
 {name:'艋舺大道／西園路',width:16,pts:[[25.031,121.495],[25.032,121.502],[25.033,121.509],[25.034,121.516]]},
 {name:'汀州路',width:14,pts:[[25.018,121.513],[25.019,121.521],[25.0195,121.529],[25.020,121.537],[25.0205,121.545]]},
 {name:'興隆路',width:14,pts:[[25.006,121.543],[25.010,121.550],[25.015,121.556],[25.020,121.562],[25.024,121.566]]},
 {name:'文林路',width:15,pts:[[25.072,121.522],[25.080,121.523],[25.088,121.524],[25.096,121.524],[25.104,121.525]]},
 {name:'士林中正路',width:16,pts:[[25.095,121.516],[25.095,121.524],[25.095,121.532],[25.095,121.540]]},
 {name:'明水路',width:14,pts:[[25.080,121.548],[25.0805,121.556],[25.080,121.565],[25.0795,121.574]]},
 {name:'瑞光路／內湖路',width:17,pts:[[25.077,121.565],[25.078,121.575],[25.079,121.585],[25.080,121.595],[25.081,121.604]]}
);
Object.assign(COURIER_ZONES.find(z=>z.name==='大直'),{lat:25.0838,lng:121.5575});
Object.assign(COURIER_ZONES.find(z=>z.name==='圓山'),{lat:25.0713,lng:121.5201});
Object.assign(COURIER_ZONES.find(z=>z.name==='士林'),{lat:25.0882,lng:121.5244});
Object.assign(COURIER_ZONES.find(z=>z.name==='松山'),{lat:25.0497,lng:121.5781});
const COURIER_PERKS = {
 lin:{label:'虎斑彈跳',description:'跳躍高度 +25% · 空中轉向 +35%',jump:1.12,air:1.35,charge:1,drift:1,terrain:1,cargo:1},
 chen:{label:'布偶探路',description:'氮氣消耗 −20% · 回充 +30%',jump:1,air:1,charge:1.3,boostCost:28,drift:1,terrain:1,cargo:1},
 mei:{label:'柴犬甩尾',description:'甩尾轉向 +25% · 出彎抓地更快',jump:1,air:1,charge:1,drift:1.25,grip:1.35,terrain:1,cargo:1},
 zhou:{label:'哈士奇重載',description:'草地減速 −65% · 碰撞貨損 −50%',jump:1,air:1,charge:1,drift:1,terrain:.35,cargo:.5}
};
for(const [key,perk] of Object.entries(COURIER_PERKS))Object.assign(DRIVERS[key],{perk});


/* P2 Preview module: polish.js */
/* v1.1 navigation and comedy presentation, extending the existing delivery core. */
class ArcadeCourier extends SuperCourierTaipei {
  constructor(){super();this.dialogueCursor={};this.phoneQueue=[];this.pendingBanter=null;this.replyCooldown=0;this.orderGeneration=0;this.lastPhoneEvent='';this.displayNavAngle=0;this.maneuver={type:'straight',distance:0,road:''};}
  createSkyTexture(){const c=document.createElement('canvas');c.width=16;c.height=512;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,'#243f60');g.addColorStop(.4,'#739dbe');g.addColorStop(.75,'#cfddd8');g.addColorStop(1,'#f9ddae');ctx.fillStyle=g;ctx.fillRect(0,0,16,512);return new THREE.CanvasTexture(c);}
  async init(){if(document.fonts)await document.fonts.ready;await super.init();this.setupRoadPresentation();document.getElementById('phone-reply-button').addEventListener('click',()=>this.replyToCustomer());document.getElementById('reply-key-hint').textContent='Q 回一句';this.presentationReady=true;}
  initPhone(){super.initPhone();this.customers.forEach((c,i)=>c.persona=i%COURIER_PERSONAS.length);}
  startGame(){this.phoneQueue=[];this.pendingBanter=null;this.orderGeneration++;this.replyCooldown=0;document.getElementById('rider-reply').style.display='none';super.startGame();this.displayNavAngle=0;this.updateCompass();}
  toMenu(){this.phoneQueue=[];this.pendingBanter=null;if(this.roadRibbon)this.roadRibbon.visible=false;if(this.routeChevrons)this.routeChevrons.visible=false;super.toMenu();}
  endGame(){this.phoneQueue=[];this.pendingBanter=null;if(this.roadRibbon)this.roadRibbon.visible=false;if(this.routeChevrons)this.routeChevrons.visible=false;super.endGame();}
  boardCustomer(c){this.orderGeneration++;this.phoneQueue=[];c.persona=(c.persona+this.orderSerial)%COURIER_PERSONAS.length;c.jokeCounts={};this.pendingBanter=null;super.boardCustomer(c);this.replyCooldown=0;document.getElementById('rider-reply').style.display='none';}
  handleKeyDown(e){if(e.code==='KeyQ'&&!e.repeat&&this.gameState==='PLAYING'){e.preventDefault();this.replyToCustomer();return;}super.handleKeyDown(e);}
  step(dt){super.step(dt);if(this.gameState!=='PLAYING')return;this.replyCooldown=Math.max(0,this.replyCooldown-dt);this.advancePhone();if(this.routeChevrons){const color=this.activeCustomer?0xffd260:0x00f0d3;this.routeChevrons.material.color.setHex(color);}if(this.bikeShadow){this.bikeShadow.position.set(this.carPos.x,this.getTerrainHeight(this.carPos.x,this.carPos.z)+.19,this.carPos.z);}}
  chooseLine(persona,event,lines){const key=persona+':'+event,idx=this.dialogueCursor[key]??(persona%lines.length);this.dialogueCursor[key]=(idx+1)%lines.length;return lines[idx];}
  customerMessage(event,priority=false){const c=this.activeCustomer;if(!c)return;const actor=COURIER_PERSONAS[c.persona%COURIER_PERSONAS.length];if(!actor?.lines[event])return;c.jokeCounts=c.jokeCounts||{};if(!priority&&(c.jokeCounts[event]||0)>=2)return;
    if(!priority&&this.elapsed-this.lastMessageAt<7){if(!this.phoneQueue.some(q=>q.event===event)&&this.phoneQueue.length<2)this.phoneQueue.push({event,generation:this.orderGeneration});return;}
    const repeatCount=c.jokeCounts[event]||0,food=COURIER_FOOD_JOKES[this.foodCategory(c.item)],source=(event==='crash'||event==='drift')&&repeatCount%2===1?food:actor.lines[event];const line=this.chooseLine(c.persona,event,source).replaceAll('{dest}',c.destination.name).replaceAll('{item}',c.item);c.jokeCounts[event]=(c.jokeCounts[event]||0)+1;this.lastMessageAt=this.elapsed;this.messageUntil=this.elapsed+8;this.lastPhoneEvent=event;this.currentActor=actor;this.phoneItem=c.item;this.showPhoneLine(actor,line,event,c.destination.name);
    if(event==='pickup'){const places=COURIER_PLACE_JOKES[c.destination.name];if(places)this.pendingBanter={due:this.elapsed+8,generation:this.orderGeneration,actor,line:this.chooseLine(c.persona,'place:'+c.destination.name,places),dest:c.destination.name};}
    else if(event==='crash'||event==='urgent'||event==='success'||event==='damaged'||event==='late')this.pendingBanter=null;
  }
  showPhoneLine(actor,line,event,dest){const labels={pickup:'新訂單語音',drift:'騎法評論',crash:'客人聽到了一切',near:'現場連線',half:'客人開始催了',urgent:'最後十秒連環催',success:'五星現場',damaged:'開箱事故',late:'取消前最後一句',banter:'客人又想到一件事'};document.getElementById('phone-message').classList.add('visible');document.getElementById('phone-avatar').innerHTML=this.portraitSVG(COURIER_PERSONAS.indexOf(actor));document.getElementById('phone-avatar').style.background=actor.color;document.getElementById('phone-sender').textContent=actor.name;document.getElementById('phone-text').textContent=line;document.getElementById('phone-meta').textContent=(labels[event]||'語音訊息')+' · '+dest;document.getElementById('phone-event-tag').textContent=this.voiceEnabled&&!this.muted?'VOICE':'TEXT';document.getElementById('rider-reply').style.display='none';document.getElementById('phone-reply-button').disabled=!this.activeCustomer;this.speakDialogue(line,actor);}
  portraitSVG(index){const skin=['#e7b17e','#bb805c','#efc4a4','#d5ae8c','#efc59d','#ebba95','#c69774','#e4b799','#e2be98','#dfb696','#f0c6a7','#e4b28d'][index],hair=['#20303b','#32313b','#765877','#aeb4aa','#846746','#422f45','#364044','#29414c','#465667','#293b50','#675249','#744c3e'][index];const glasses=[0,8,9,10].includes(index)?'<g stroke="#173644" stroke-width="2" fill="none"><rect x="10" y="21" width="11" height="8" rx="3"/><rect x="27" y="21" width="11" height="8" rx="3"/><path d="M21 25h6"/></g>':'';const extra=index===3?'<path d="M15 36q9 8 18 0" stroke="#dad7c9" stroke-width="4" fill="none"/>':index===4?'<path d="M8 13L13 2l8 8M27 10l9-8 4 11" fill="'+hair+'"/>':index===7?'<path d="M10 13V4h28v9" fill="#e9f7f6"/><path d="M24 5v8M20 9h8" stroke="#5d989d" stroke-width="2"/>':'';return '<svg viewBox="0 0 48 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 54q2-14 20-14t20 14" fill="#153c4b"/><path d="M19 35h10v11H19" fill="'+skin+'"/><ellipse cx="24" cy="25" rx="15" ry="18" fill="'+skin+'"/><path d="M8 24V13q1-13 18-10 16 0 14 22l-5-13q-12 8-21 0z" fill="'+hair+'"/>'+extra+'<path d="M14 21h6M28 21h6" stroke="'+hair+'" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="25" r="1.5" fill="#193746"/><circle cx="31" cy="25" r="1.5" fill="#193746"/>'+glasses+'<path d="M20 33q4 4 8 0" fill="none" stroke="#9f604b" stroke-width="1.5" stroke-linecap="round"/></svg>';}
  speakDialogue(line,actor){if(this.voiceEnabled&&!this.muted&&'speechSynthesis' in window){try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(line);u.lang='zh-TW';u.rate=actor.rate||1.1;u.pitch=actor.pitch||1;u.volume=.78;window.speechSynthesis.speak(u);}catch{}}}
  advancePhone(){if(this.pendingBanter&&this.elapsed>=this.pendingBanter.due){const b=this.pendingBanter;this.pendingBanter=null;if(this.activeCustomer&&b.generation===this.orderGeneration&&this.activeCustomerTimer>15&&this.elapsed-this.lastMessageAt>=7){this.lastMessageAt=this.elapsed;this.messageUntil=this.elapsed+7;this.showPhoneLine(b.actor,b.line,'banter',b.dest);}}
    if(this.phoneQueue.length&&this.elapsed-this.lastMessageAt>=7&&this.activeCustomer){const q=this.phoneQueue.shift();if(q.generation===this.orderGeneration)this.customerMessage(q.event);}}
  replyToCustomer(){if(!this.activeCustomer||this.replyCooldown>0)return;const actor=COURIER_PERSONAS[this.activeCustomer.persona%COURIER_PERSONAS.length];document.getElementById('rider-reply').style.display='block';document.getElementById('rider-reply-text').textContent=actor.reply;this.messageUntil=Math.max(this.messageUntil,this.elapsed+7);this.replyCooldown=12;document.getElementById('phone-message').classList.add('visible');this.audio.playHorn(320);}
  foodCategory(item){return /飲|咖啡|茶/.test(item)?'drink':/麵|湯/.test(item)?'soup':/花/.test(item)?'flower':/書|包裹/.test(item)?'parcel':'meal';}
  hit(label){const before=this.integrity;super.hit(label);if(this.integrity<before&&this.activeCustomer&&this.elapsed-this.lastMessageAt>=7){const actor=COURIER_PERSONAS[this.activeCustomer.persona%COURIER_PERSONAS.length],kind=this.foodCategory(this.activeCustomer.item),lines=COURIER_FOOD_JOKES[kind];this.pendingBanter={due:this.elapsed+8,generation:this.orderGeneration,actor,line:this.chooseLine(this.activeCustomer.persona,'food:'+kind,lines),dest:this.activeCustomer.destination.name};}}
  analyzeManeuver(route){const target=this.activeCustomer?this.activeCustomer.destination.pos:this.nearestMerchant()?.group.position;if(!route.length)return {type:'straight',distance:0,road:'等待派單'};const direct=target?Math.hypot(target.x-this.carPos.x,target.z-this.carPos.z):Infinity;
    if(direct<15)return {type:'stop',distance:Math.round(direct),road:this.activeCustomer?'停穩 0.7 秒交付':'停穩 0.7 秒取貨'};
    const ahead=route.find(p=>Math.hypot(p.x-this.carPos.x,p.z-this.carPos.z)>8)||route.at(-1),angle=Math.atan2(ahead.x-this.carPos.x,ahead.z-this.carPos.z)-this.carRotY,normalized=Math.atan2(Math.sin(angle),Math.cos(angle));if(Math.abs(normalized)>2.35)return {type:'uturn',distance:0,road:'轉回路線方向'};
    let distance=0;for(let i=1;i<route.length-1;i++){distance+=Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z);const a=route[i-1],b=route[i],c=route[i+1],ux=b.x-a.x,uz=b.z-a.z,vx=c.x-b.x,vz=c.z-b.z,l=Math.hypot(ux,uz)*Math.hypot(vx,vz);if(l<1)continue;const turn=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uz*vz)/l)));if(turn>.42){const cross=ux*vz-uz*vx,type=turn>2.3?'uturn':cross<0?'left':'right';return {type,distance:Math.round(distance),road:TAIPEI_ROADS[this.snapRoad({x:(b.x+c.x)/2,z:(b.z+c.z)/2}).ri]?.name||'前方路口'};}}
    return {type:'straight',distance:Math.round(this.routeDistance(route)),road:'沿路線前進'};
  }
  updateNavigation(){super.updateNavigation();if(this.routeLines)this.routeLines.visible=false;this.maneuver=this.analyzeManeuver(this.route);this.paintRoadRoute();const phase=this.activeCustomer?'送達':'取貨';document.getElementById('nav-phase').textContent=phase;document.getElementById('nav-phase').classList.toggle('delivery',!!this.activeCustomer);document.getElementById('nav-instruction').textContent={left:'左轉',right:'右轉',uturn:'迴轉',straight:'直走',stop:this.activeCustomer?'交付貨物':'商家取貨'}[this.maneuver.type];document.getElementById('nav-turn-distance').textContent=this.maneuver.type==='stop'?'請煞停':this.maneuver.type==='uturn'?'方向相反':this.maneuver.distance+' m';document.getElementById('nav-next-road').textContent=this.maneuver.road;document.getElementById('nav-route-total').textContent=Math.round(this.navDistance)+' m 到'+(this.activeCustomer?this.activeCustomer.destination.name:this.nearestMerchant()?.shop||'商家');}
  paintRoadRoute(){if(!this.routeRoot){this.routeRoot=new THREE.Group();this.scene.add(this.routeRoot);const shape=new THREE.Shape();shape.moveTo(-.8,-1.6);shape.lineTo(0,-.4);shape.lineTo(.8,-1.6);shape.lineTo(1.5,-1.1);shape.lineTo(0,1.2);shape.lineTo(-1.5,-1.1);shape.closePath();const geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);this.routeChevrons=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:0x00f0d3,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}),100);this.routeChevrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.routeChevrons.frustumCulled=false;this.routeRoot.add(this.routeChevrons);this.routeDummy=new THREE.Object3D();}
    const vertices=[];let count=0,travel=0;for(let i=1;i<this.route.length;i++){const a=this.route[i-1],b=this.route[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.1)continue;const rx=-dz/len*.48,rz=dx/len*.48;const point=(p,side)=>[p.x+rx*side,this.getTerrainHeight(p.x,p.z)+.27,p.z+rz*side];for(let d=0;d<len;d+=12){const t0=d/len,t1=Math.min(d+12,len)/len,p0={x:a.x+dx*t0,z:a.z+dz*t0},p1={x:a.x+dx*t1,z:a.z+dz*t1};const al=point(p0,-1),ar=point(p0,1),bl=point(p1,-1),br=point(p1,1);vertices.push(...al,...ar,...bl,...ar,...br,...bl);}
      for(let d=8;d<len&&count<100&&travel+d<650;d+=12){const t=d/len,x=a.x+dx*t,z=a.z+dz*t;this.routeDummy.position.set(x,this.getTerrainHeight(x,z)+.31,z);this.routeDummy.rotation.set(0,Math.atan2(dx,dz),0);this.routeDummy.scale.set(1,1,1);this.routeDummy.updateMatrix();this.routeChevrons.setMatrixAt(count++,this.routeDummy.matrix);}travel+=len;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(!this.roadRibbon){this.roadRibbon=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x00e5cf,side:THREE.DoubleSide,transparent:true,opacity:.24,depthWrite:false}));this.roadRibbon.frustumCulled=false;this.routeRoot.add(this.roadRibbon);}else{this.roadRibbon.geometry.dispose();this.roadRibbon.geometry=geometry;}
    const color=this.activeCustomer?0xffd260:0x00f0d3;this.roadRibbon.material.color.setHex(color);this.routeChevrons.material.color.setHex(color);this.routeChevrons.count=count;this.routeChevrons.instanceMatrix.needsUpdate=true;this.roadRibbon.visible=this.routeChevrons.visible=true;
  }
  updateCompass(){const cv=document.getElementById('hud-compass-canvas');if(cv.width!==240){cv.width=cv.height=240;}const ctx=cv.getContext('2d');ctx.clearRect(0,0,240,240);const m=this.maneuver||{type:'straight'},color=this.activeCustomer?'#ffd260':'#00edd0';ctx.fillStyle='#082433';ctx.beginPath();ctx.arc(120,120,104,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#456777';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(120,120,105,-Math.PI/2,Math.PI*1.15);ctx.stroke();
    ctx.save();ctx.translate(120,123);let type=m.type;if(m.distance>120&&type!=='stop'&&type!=='uturn')type='straight';const points=type==='left'?[[-55,-7],[-18,-43],[-18,-23],[25,-23],[25,54],[1,54],[1,1],[-18,1],[-18,20]]:type==='right'?[[55,-7],[18,-43],[18,-23],[-25,-23],[-25,54],[-1,54],[-1,1],[18,1],[18,20]]:type==='uturn'?[[-52,15],[-28,-10],[-28,4],[-16,4],[-16,-31],[16,-31],[16,54],[40,54],[40,-38],[28,-55],[-25,-55],[-40,-38],[-40,4],[-55,4]]:type==='stop'?[[-35,-35],[35,-35],[50,0],[35,35],[-35,35],[-50,0]]:[[0,-60],[48,-9],[19,-9],[19,55],[-19,55],[-19,-9],[-48,-9]];
    const path=()=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};ctx.save();ctx.translate(0,6);path();ctx.fillStyle='#010c15';ctx.fill();ctx.restore();path();const grad=ctx.createLinearGradient(0,-65,0,60);grad.addColorStop(0,'#ffffff');grad.addColorStop(.3,color);grad.addColorStop(1,this.activeCustomer?'#d08b20':'#009b93');ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#e7fffb';ctx.lineWidth=2;ctx.stroke();if(type==='stop'){ctx.strokeStyle='#052530';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-17,0);ctx.lineTo(-3,13);ctx.lineTo(22,-15);ctx.stroke();}ctx.restore();}
  updateRadar(){const cv=document.getElementById('radar-canvas');if(cv.width!==280)cv.width=cv.height=280;const ctx=cv.getContext('2d');ctx.clearRect(0,0,280,280);ctx.fillStyle='#092330';ctx.fillRect(0,0,280,280);const scale=.38,cos=Math.cos(this.carRotY),sin=Math.sin(this.carRotY),xy=p=>{const dx=p.x-this.carPos.x,dz=p.z-this.carPos.z;return [140+(-dx*cos+dz*sin)*scale,172-(dx*sin+dz*cos)*scale];};ctx.strokeStyle='#284f60';ctx.lineWidth=7;this.segments.forEach(s=>{ctx.beginPath();ctx.moveTo(...xy(s.a));ctx.lineTo(...xy(s.b));ctx.stroke();});ctx.strokeStyle=this.activeCustomer?'#ffd260':'#00edd0';ctx.lineWidth=5;ctx.beginPath();this.route.forEach((p,i)=>i?ctx.lineTo(...xy(p)):ctx.moveTo(...xy(p)));ctx.stroke();this.customers.forEach(c=>{if(c.cooldown>0||c.isBoarded)return;const p=xy(c.group.position);ctx.fillStyle='#00edd0';ctx.fillRect(p[0]-4,p[1]-4,8,8);});const target=this.activeCustomer?this.activeCustomer.destination.pos:this.nearestMerchant()?.group.position;if(target){const p=xy(target);ctx.fillStyle=this.activeCustomer?'#ffd260':'#00edd0';ctx.beginPath();ctx.arc(p[0],p[1],8,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#ffffff';ctx.strokeStyle='#061522';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(140,157);ctx.lineTo(130,183);ctx.lineTo(140,179);ctx.lineTo(150,183);ctx.closePath();ctx.fill();ctx.stroke();ctx.font='bold 11px "Noto Sans TC"';ctx.fillStyle='#9ab5c1';ctx.fillText('朝向上方 / 200 m',12,260);}
  updateHUD(){super.updateHUD();document.getElementById('hud').classList.toggle('phone-active',this.elapsed<this.messageUntil);const c=this.activeCustomer;document.getElementById('order-state').textContent=c?'配送中':'等待取貨';document.getElementById('order-customer').textContent=c?COURIER_PERSONAS[c.persona%COURIER_PERSONAS.length].name:'下一站商家';document.getElementById('delivery-progress').style.width=c?Math.max(0,Math.min(100,this.activeCustomerTimer/this.activeCustomerInitialTime*100))+'%':'100%';document.getElementById('stop-progress').style.width=Math.min(100,this.interact/.7*100)+'%';document.getElementById('phone-reply-button').textContent=this.replyCooldown>0?'回覆冷卻 '+Math.ceil(this.replyCooldown)+'s':'Q　回一句';document.getElementById('phone-reply-button').disabled=!c||this.replyCooldown>0;document.getElementById('hud-customer-box').classList.toggle('order-urgent',!!c&&this.activeCustomerTimer<10);document.getElementById('combo-chip').textContent=this.comboCount?'技巧 '+this.comboCount+' 連段 · ×'+(1+Math.min(this.comboCount,10)*.1).toFixed(1):'滑行 ＋ 擦身超車 = 技巧獎勵';}
  makeLabel(text,color){const sprite=super.makeLabel(text,color);sprite.scale.set(7,2.2,1);sprite.material.depthTest=true;return sprite;}
  setupRoadPresentation(){this.scene.fog.density=.00075;this.hemiLight.intensity=1.05;this.dirLight.intensity=1.25;this.renderer.toneMappingExposure=1.12;
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.05,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x051621,transparent:true,opacity:.28,depthWrite:false}));shadow.scale.set(.7,1,1.6);this.scene.add(shadow);this.bikeShadow=shadow;
    const marks=[];for(const s of this.segments){const len=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);for(let d=8;d<len;d+=16){const t=d/len;marks.push({x:s.a.x+(s.b.x-s.a.x)*t,z:s.a.z+(s.b.z-s.a.z)*t,angle:Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z)});}}
    const lane=new THREE.InstancedMesh(new THREE.PlaneGeometry(.14,3).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe7dcaa,side:THREE.DoubleSide}),marks.length),dummy=new THREE.Object3D();marks.forEach((p,i)=>{dummy.position.set(p.x,this.getTerrainHeight(p.x,p.z)+.18,p.z);dummy.rotation.y=p.angle;dummy.updateMatrix();lane.setMatrixAt(i,dummy.matrix);});lane.frustumCulled=false;this.scene.add(lane);
    this.destBeam.children.forEach(m=>m.visible=false);const ring=new THREE.Mesh(new THREE.RingGeometry(7.5,9,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffd260,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));ring.position.y=.29;this.destBeam.add(ring);const marker=this.makeLabel('DELIVERY / 交付區','#ffd260');marker.position.set(0,7.5,0);this.destBeam.add(marker);
  }
}


/* P2 Preview module: frenzy.js */
/* 2.6: realistic arcade Taipei, swept collisions, signalized traffic and denser stunt routes.
   Geographic relationships are compressed. No map tiles or third-party art. */
const COURIER_STUNT_LINES = [
 ['便當飛起來了。這是我們專案第一次真的起飛。','排氣管在噴火？我只說午餐要熱，不是要融資。'],
 ['你只用一個輪子？單腳訓練很好，但我的餐不用。','你的排氣管有在做 HIIT。我的雞胸先不用。'],
 ['你飛得比我的水星還高。先回來，我的湯也在逆。','你的幸運色變橘色了。等一下，那是排氣管的火！'],
 ['少年仔！你這台是機車還是乩童的坐騎？','我只點小辣，你整台車都在大火快炒！'],
 ['我家貓看到你飛過去。牠現在相信自己也可以。','排氣管噴火不要讓我家貓看到，牠會以為罐罐開了。'],
 ['各位觀眾！我的午餐現在有空拍！','這段可以剪成短片。我是說你，不是我的麵。'],
 ['你跳過去的那一下，可以報名我們廟口陣頭。','師傅！香油錢在這裡，你不用自帶火焰！'],
 ['飛得很好。降落記得把關節留給我，不要送來。','你後面那團火，消防是隔壁科，先不要掛我的號。'],
 ['你飛上去了？順便幫我看北車出口在哪。','你那個火焰比北車指標清楚。我跟著火走可以嗎？'],
 ['我的論文終於有升空的可能。不要把資料摔散！','這是推進器嗎？教授說我的研究要有突破，不是爆破。'],
 ['備註第三十條：餐點不需要航空里程。','備註第三十一條：加熱不用連機車一起加熱。'],
 ['你飛過公車？小孩看到了，現在全家都想叫外送。','那個火，小孩說生日蠟燭太多。你今年幾歲啦？']
];

class FrenzyCourier extends ArcadeCourier {
  constructor() {
    super(); this.manualGear=1; this.shiftWindow=-99; this.shiftDip=0;
    this.jumpCooldown=0; this.boostCooldown=0; this.airTime=0; this.airDistance=0;
    this.wheelieAngle=0; this.wheelieTime=0; this.stuntStats={jumps:0,clearances:0,wheelies:0,boosts:0};
    this.citySeed=20261001; this.streetSolids=[]; this.cityObstacles=[]; this.ramps=[];this.roadWaves=[];this.rideSlabs=[];
    this.ceilingSlabs=[];this.undergroundZones=[];
    this.parkedVehicles=[];this.pedestrians=[];this.trafficSignals=[];this.signalNodeIds=new Set();
    this.spatialSolids=new Map(); this.instanceBatches=new Map(); this.landmarkGroups=[];
    this.airCleared=new Set(); this.stuntSpeechAt=-99; this.presentationReady=false;
    this.wallContactTime=0;this.wallContactNormal=new THREE.Vector2();this.cameraKick=0;
    this.inUnderground=false;this.arcadeMood='city';
  }
  rand(){ this.citySeed=(Math.imul(1664525,this.citySeed)+1013904223)>>>0; return this.citySeed/4294967296; }
  worldRivers(){
    if(!this.riverLines)this.riverLines=TAIPEI_RIVERS.map(r=>({...r,nodes:r.pts.map(p=>this.latLngToWorld(...p))}));
    return this.riverLines;
  }
  riverCenter(x){const r=this.worldRivers()[0];for(let i=1;i<r.nodes.length;i++){const a=r.nodes[i-1],b=r.nodes[i];if(x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x))return a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x);}return r.nodes[0].z;}
  riverSample(x,z){
    let best={distance:Infinity,width:0};for(const r of this.worldRivers())for(let i=1;i<r.nodes.length;i++){const a=r.nodes[i-1],b=r.nodes[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);if(distance<best.distance)best={distance,width:r.width,name:r.name};}return best;
  }
  riverDistance(x,z){const r=this.riverSample(x,z);return r.distance-r.width/2+42;}
  bridgeHeight(x,z){
    if(!this.bridgeAnchors){this.bridgeAnchors=[];for(const road of TAIPEI_ROADS)for(let j=1;j<road.pts.length;j++){const a=this.latLngToWorld(...road.pts[j-1]),b=this.latLngToWorld(...road.pts[j]),rx=b.x-a.x,rz=b.z-a.z;for(const r of this.worldRivers())for(let i=1;i<r.nodes.length;i++){const c=r.nodes[i-1],d=r.nodes[i],sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;if(Math.abs(den)<.001)continue;const qx=c.x-a.x,qz=c.z-a.z,t=(qx*sz-qz*sx)/den,u=(qx*rz-qz*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1)this.bridgeAnchors.push({x:a.x+t*rx,z:a.z+t*rz,radius:r.width/2+52});}}}
    let h=0;for(const p of this.bridgeAnchors){const d=Math.hypot(x-p.x,z-p.z);if(d<p.radius)h=Math.max(h,7.5*Math.pow(Math.cos(d/p.radius*Math.PI/2),2));}return h;
  }
  getTerrainHeight(x,z) {
    // One continuous ride height: north mountains, southern foothills, river bridge approaches.
    const n=Math.max(0,-z-1390),s=Math.max(0,z-580);
    const north=n*.092 + Math.max(0,n-100)*.012*Math.sin(x/180-z/230);
    const south=s*.031 + s*.016*Math.sin(x/160+z/250);
    const bridge=this.bridgeHeight(x,z);
    return north+Math.max(0,south)+bridge;
  }
  baseTerrainHeight(x,z) {
    if(this.riverDistance(x,z)<42) return -3;
    return this.getTerrainHeight(x,z);
  }
  async init() {
    await super.init(); this.presentationReady=false;
    this.buildStreetLife(); this.buildBlockInteriors(); this.buildElevatedMRT(); this.buildUndergroundStreet();
    // The underground mall is created after the base order system; rebuild cached
    // curbside choices so it can actually appear as a delivery destination.
    this.arcadeDeliverySpots=null;this.customers.forEach((c,i)=>{c.arcadeChoices=null;c.destination=this.orderDestination(c,i);});
    this.buildObstacles(); this.buildRideParks(); this.prepareTrafficRoutes(); this.buildStuntRig(); this.flushInstances();
    this.camera.near=.2; this.camera.far=5200; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.toneMappingExposure=1.14; this.scene.fog.color.setHex(0x99c0cb); this.scene.fog.density=.00055;
    this.hemiLight.color.setHex(0xd9f0ff); this.hemiLight.groundColor.setHex(0x52604d);
    this.dirLight.color.setHex(0xffdfac); this.dirLight.intensity=1.45;
    const driverKeys=['lin','chen','mei','zhou'];document.querySelectorAll('.driver-avatar').forEach((el,i)=>{el.innerHTML=this.driverPortrait(i,DRIVERS[driverKeys[i]].color);el.style.background='#173641';});
    document.querySelectorAll('.driver-card').forEach(el=>{const p=DRIVERS[el.dataset.driver].perk;el.querySelector('.driver-title').textContent=p.label;el.querySelector('.driver-cab-name').textContent=p.description;});
    this.installContextRecovery(); this.refreshGearUI(); this.presentationReady=true;
  }
  installContextRecovery() {
    const canvas=document.getElementById('game-canvas');
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(this.gameState==='PLAYING')this.pause();this.showStatusToast('圖形連線中斷，遊戲已暫停。');});
    canvas.addEventListener('webglcontextrestored',()=>this.showStatusToast('圖形已恢復，可繼續配送。'));
  }
  driverPortrait(i,color) {
    const hex='#'+color.toString(16).padStart(6,'0'),skin=['#e9b58e','#d8a277','#f0c6a1','#d4aa86'][i],beard=i===3?'<path d="M19 33q11 13 22 0" fill="#a9b5b4"/>':'';
    return `<svg viewBox="0 0 60 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7 64q2-21 23-21t23 21" fill="${hex}"/><path d="M13 54h34v4H13" fill="#f7edc8"/><rect x="26" y="35" width="8" height="13" rx="3" fill="${skin}"/><ellipse cx="30" cy="26" rx="16" ry="18" fill="${skin}"/><path d="M11 29V20Q11 1 30 2q19 0 19 19v10l-5-5v-9H16v9z" fill="${hex}"/><path d="M20 7h20" stroke="#fff1be" stroke-width="3"/><path d="M15 19h30v10H15z" fill="#254f68"/><path d="M18 21h18" stroke="#9bd3dc" stroke-width="2"/>${beard}<path d="M25 35q5 4 10 0" stroke="#ad6d58" stroke-width="2" fill="none"/><path d="M11 31h5M44 31h5" stroke="#102a39" stroke-width="4"/></svg>`;
  }
  makeTexture(kind,variant=0) {
    this.cityTextures=this.cityTextures||new Map();const key=kind+variant;if(this.cityTextures.has(key))return this.cityTextures.get(key);
    const c=document.createElement('canvas');c.width=c.height=(kind==='facade'||kind==='glass')?1024:512;const ctx=c.getContext('2d');if(c.width===1024)ctx.scale(2,2);
    if(kind==='asphalt') {
      const ag=ctx.createLinearGradient(0,0,512,512);ag.addColorStop(0,'#424b4e');ag.addColorStop(.5,'#353f43');ag.addColorStop(1,'#4b5354');ctx.fillStyle=ag;ctx.fillRect(0,0,512,512);
      for(let i=0;i<17000;i++){const v=48+Math.floor(this.rand()*42),a=.16+this.rand()*.22;ctx.fillStyle=`rgba(${v},${v+5},${v+7},${a})`;ctx.fillRect(this.rand()*512,this.rand()*512,.7+this.rand()*2.2,.7+this.rand()*2.2);}
      ctx.strokeStyle='#27323899';ctx.lineWidth=1.05;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(this.rand()*512,0);for(let y=0;y<512;y+=32)ctx.lineTo(70+i*58+Math.sin(y*.06+i)*18+this.rand()*12,y);ctx.stroke();}
      for(let i=0;i<9;i++){const x=this.rand()*470,y=this.rand()*470,w=18+this.rand()*65,h=10+this.rand()*32;ctx.fillStyle='#2d373a33';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#77818424';ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
      for(let i=0;i<3;i++){const x=70+this.rand()*370,y=70+this.rand()*370;ctx.strokeStyle='#1f2a2d88';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;for(let a=0;a<Math.PI*2;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(x+Math.cos(a)*4,y+Math.sin(a)*4);ctx.lineTo(x+Math.cos(a)*14,y+Math.sin(a)*14);ctx.stroke();}}
    } else if(kind==='tile'||kind==='ground') {
      ctx.fillStyle=kind==='tile'?'#b8b0a5':'#aaa99c';ctx.fillRect(0,0,512,512);
      if(kind==='tile'){for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=32){ctx.fillStyle=((x+y)/32)%4===0?'#a76e5c':((x/32+y/32)%2?'#c4bbb0':'#aea89f');ctx.fillRect(x+1,y+1,30,30);}ctx.strokeStyle='#7f817d66';ctx.lineWidth=1;for(let i=0;i<=512;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}}else{ctx.strokeStyle='#8e9188';ctx.lineWidth=1.5;for(let i=0;i<=512;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}}
      for(let i=0;i<1600;i++){ctx.fillStyle=this.rand()>.5?'#ffffff10':'#00000010';ctx.fillRect(this.rand()*512,this.rand()*512,2+this.rand()*5,1+this.rand()*3);}
    } else if(kind==='facade'||kind==='glass') {
      const colors=['#c1b9a6','#bdc5c2','#c5aea0','#91a8af','#b4b49d','#798f9a'];ctx.fillStyle=colors[variant%6];ctx.fillRect(0,0,512,512);
      ctx.strokeStyle='#6c797577';ctx.lineWidth=2;
      for(let y=0;y<512;y+=16){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
      for(let y=14;y<512;y+=64)for(let x=12;x<512;x+=64){ctx.fillStyle='#45545b';ctx.fillRect(x-2,y-2,45,42);const g=ctx.createLinearGradient(x,y,x+40,y+38);g.addColorStop(0,kind==='glass'?'#bad7dd':'#94b1b8');g.addColorStop(.45,'#506e7d');g.addColorStop(1,this.rand()>.68?'#ebc984':'#203f51');ctx.fillStyle=g;ctx.fillRect(x,y,40,36);ctx.fillStyle='#c4cfcc';ctx.fillRect(x+19,y,2,36);ctx.fillRect(x,y+19,40,1);ctx.fillStyle='#2c3e4144';ctx.fillRect(x-2,y+40,46,3);if(kind==='facade'&&this.rand()>.55){ctx.fillStyle='#e0dacf';ctx.fillRect(x+24,y+39,18,11);ctx.fillStyle='#87928d';ctx.fillRect(x+27,y+42,12,4);}}
      if(kind==='facade'){
        for(let i=0;i<24;i++){ctx.fillStyle='#37473f18';ctx.fillRect(this.rand()*512,this.rand()*512,2,40+this.rand()*80);}
        for(let y=14;y<512;y+=64)for(let x=12;x<512;x+=64){
          if(this.rand()>.6){ctx.fillStyle='#e6c49677';ctx.fillRect(x+3,y+2,9,32);ctx.fillRect(x+27,y+2,9,32);}
          if(this.rand()>.4){ctx.fillStyle='#d9dbd0';ctx.fillRect(x+20,y+37,23,12);ctx.strokeStyle='#6b7474';ctx.lineWidth=.6;for(let k=0;k<5;k++){ctx.beginPath();ctx.moveTo(x+23,y+40+k*1.3);ctx.lineTo(x+34,y+40+k*1.3);ctx.stroke();}ctx.beginPath();ctx.arc(x+38,y+43,3,0,Math.PI*2);ctx.stroke();}
          ctx.fillStyle='#2c3638';ctx.fillRect(x-3,y+34,48,1);ctx.strokeStyle='#54605d';ctx.lineWidth=.7;for(let k=0;k<7;k++){ctx.beginPath();ctx.moveTo(x+k*7,y+28);ctx.lineTo(x+k*7,y+34);ctx.stroke();}
        }
        const grime=ctx.createLinearGradient(0,350,0,512);grime.addColorStop(0,'#26333200');grime.addColorStop(1,'#26333238');ctx.fillStyle=grime;ctx.fillRect(0,340,512,172);for(let x=0;x<512;x+=64){ctx.fillStyle='#39494b';ctx.fillRect(x+7,456,50,46);ctx.fillStyle=['#9b463f','#317c78','#cda944','#60758b'][((x/64)+variant)%4];ctx.fillRect(x+7,448,50,8);ctx.strokeStyle='#9ca7a1';for(let k=0;k<5;k++){ctx.beginPath();ctx.moveTo(x+10,463+k*7);ctx.lineTo(x+54,463+k*7);ctx.stroke();}}ctx.strokeStyle='#d6cabc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(5,512);ctx.stroke();
      }
    } else if(kind==='brick') {
      ctx.fillStyle='#965846';ctx.fillRect(0,0,512,512);ctx.strokeStyle='#d0b699';ctx.lineWidth=2;
      for(let y=0;y<512;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/24)%2?0:24;x<512;x+=48){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+24);ctx.stroke();}}
    } else if(kind==='ramp') {
      ctx.fillStyle='#303d42';ctx.fillRect(0,0,512,512);for(let i=0;i<4000;i++){const v=48+Math.floor(this.rand()*35);ctx.fillStyle=`rgba(${v},${v+6},${v+7},.28)`;ctx.fillRect(this.rand()*512,this.rand()*512,2,2);}ctx.fillStyle='#d7ad3c';for(let y=-80;y<600;y+=132){ctx.beginPath();ctx.moveTo(96,y+96);ctx.lineTo(256,y+34);ctx.lineTo(416,y+96);ctx.lineTo(416,y+119);ctx.lineTo(256,y+58);ctx.lineTo(96,y+119);ctx.closePath();ctx.fill();}ctx.fillStyle='#e6dfc9';ctx.fillRect(0,0,13,512);ctx.fillRect(499,0,13,512);
    }
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=this.renderer?.capabilities?.getMaxAnisotropy?Math.min(4,this.renderer.capabilities.getMaxAnisotropy()):1;
    this.cityTextures.set(key,t);return t;
  }
  mat(key,color=0xffffff,kind=null,variant=0) {
    this.cityMats=this.cityMats||new Map();if(this.cityMats.has(key))return this.cityMats.get(key);
    const map=kind?this.makeTexture(kind,variant):null;
    const m=new THREE.MeshStandardMaterial({color,roughness:kind==='glass'?.22:kind==='asphalt'?.78:.86,metalness:kind==='glass'?.32:kind==='asphalt'?.06:.02,map,bumpMap:map&&kind!=='glass'?map:null,bumpScale:kind==='facade'?.12:kind==='asphalt'?.06:.045});this.cityMats.set(key,m);return m;
  }
  mesh(parent,geometry,material,x=0,y=0,z=0) {const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
  box(parent,w,h,d,material,x=0,y=0,z=0){return this.mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);}
  instance(key,material,x,y,z,sx,sy,sz,angle=0,geometry=null) {
    if(!this.instanceBatches.has(key))this.instanceBatches.set(key,{material,geometry:geometry||new THREE.BoxGeometry(1,1,1),items:[]});
    const item={x,y,z,sx,sy,sz,angle};this.instanceBatches.get(key).items.push(item);return item;
  }
  flushInstances() {
    const dummy=new THREE.Object3D();this.instanceMeshes=[];
    for(const [key,b] of this.instanceBatches){const m=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);b.items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);p.renderMesh=m;p.renderIndex=i;});m.frustumCulled=false;m.receiveShadow=true;m.name=key;this.scene.add(m);this.instanceMeshes.push(m);}
    this.instanceBatches.clear();
  }
  buildTaipeiWorld() {
    this.roadGraph=TAIPEI_ROADS.map(r=>r.pts.map(p=>this.latLngToWorld(...p)));
    const g=new THREE.PlaneGeometry(8000,8000,400,400);g.rotateX(-Math.PI/2);const pos=g.attributes.position;
    // Small separation plus a 20 m terrain grid prevents curved ground poking through road triangles.
    for(let i=0;i<pos.count;i++)pos.setY(i,this.baseTerrainHeight(pos.getX(i),pos.getZ(i))-.3);g.computeVertexNormals();
    const colors=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),rural=z<-1460||z>720||Math.abs(x)>1400;const color=new THREE.Color(rural?0x6eab82:0xe3ddc8);colors.push(color.r,color.g,color.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const groundTexture=this.makeTexture('ground');groundTexture.repeat.set(120,120);const groundMat=this.mat('ground',0xffffff,'ground');groundMat.vertexColors=true;this.groundMesh=this.mesh(this.scene,g,groundMat);
    const water=new THREE.MeshStandardMaterial({color:0x2c929d,roughness:.26,metalness:.32,side:THREE.DoubleSide});
    const v=[];for(const r of this.worldRivers())for(let i=1;i<r.nodes.length;i++){const a=r.nodes[i-1],b=r.nodes[i],len=Math.hypot(b.x-a.x,b.z-a.z),rx=(b.z-a.z)/len*r.width/2,rz=-(b.x-a.x)/len*r.width/2;v.push(a.x-rx,-.9,a.z-rz,b.x-rx,-.9,b.z-rz,a.x+rx,-.9,a.z+rz,a.x+rx,-.9,a.z+rz,b.x-rx,-.9,b.z-rz,b.x+rx,-.9,b.z+rz);}
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(v,3));rg.computeVertexNormals();this.riverMesh=this.mesh(this.scene,rg,water);this.riverMesh.name='Keelung river surface';
    this.buildUnifiedRoadSurface();this.buildTaipeiLandmarks();this.buildHorizon();
  }
  buildUnifiedRoadSurface() {
    // Raster union: each road cell exists once, including intersecting roads. World UVs avoid seams.
    const cell=2.8,cells=new Map();this.rawCitySegments=[];
    this.roadGraph.forEach((nodes,ri)=>{for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),w=TAIPEI_ROADS[ri].width/1.7;this.rawCitySegments.push({a,b,ri,w,len});
      // GIS streets use exact ribbons in v6-geo-runtime. Raster cells can be
      // wider than an entire alley and protrude through the adjacent buildings.
      if(TAIPEI_ROADS[ri].openData||TAIPEI_ROADS[ri].streamedRoad)continue;
      for(let ix=Math.floor((Math.min(a.x,b.x)-w/2)/cell);ix<=Math.ceil((Math.max(a.x,b.x)+w/2)/cell);ix++)for(let iz=Math.floor((Math.min(a.z,b.z)-w/2)/cell);iz<=Math.ceil((Math.max(a.z,b.z)+w/2)/cell);iz++){const x=(ix+.5)*cell,z=(iz+.5)*cell,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(len*len)));if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<w/2+.4)cells.set(ix+','+iz,[ix,iz]);}}
    });
    const v=[],uv=[];const add=(x,z)=>{v.push(x,this.getTerrainHeight(x,z)+.14,z);uv.push(x/14,z/14);};
    for(const [ix,iz] of cells.values()){const x=ix*cell,z=iz*cell;add(x,z);add(x,z+cell);add(x+cell,z);add(x+cell,z);add(x,z+cell);add(x+cell,z+cell);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    const m=this.mat('road',0xffffff,'asphalt');this.roadTexture=m.map;this.wetRoadTexture=m.map;this.roadMesh=this.mesh(this.scene,geo,m);this.roadMesh.userData.isRoad=true;this.roadMesh.userData.dryTexture=m.map;this.roadMesh.name='Unified non-overlapping streets';this.roadCellCount=cells.size;
  }
  buildHorizon() {
    const green=this.mat('mountain',0x4e796c),rock=this.mat('mountain-rock',0x67887a);
    for(let i=0;i<18;i++){const x=-2600+i*310,z=i%2?-3250:2300,y=this.baseTerrainHeight(x,z),height=(z<0?240:125)+this.rand()*150;const m=this.mesh(this.scene,new THREE.ConeGeometry(240+this.rand()*120,height,7),i%2?green:rock,x,y+height/2,z);m.rotation.y=this.rand()*6;}
  }
  landmarkPosition(lat,lng,offset=42) {
    const p=this.latLngToWorld(lat,lng),r=this.closestRawRoad(p),dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,l=Math.hypot(dx,dz);
    return {x:r.x+dz/l*offset,z:r.z-dx/l*offset,angle:Math.atan2(dx,dz)};
  }
  closestRawRoad(p) {let out={distance:Infinity};for(const s of this.rawCitySegments){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(s.len*s.len))),x=s.a.x+t*dx,z=s.a.z+t*dz,distance=Math.hypot(x-p.x,z-p.z);if(distance<out.distance)out={...s,x,z,t,distance};}return out;}
  addLandmark(name,lat,lng,build,w,d,offset=42) {
    let p=this.landmarkPosition(lat,lng,offset);const origin=this.latLngToWorld(lat,lng),angle=p.angle;
    const fits=q=>{const c=Math.cos(angle),s=Math.sin(angle);for(const a of [-.5,0,.5])for(const b of [-.5,0,.5]){const x=q.x+a*w*c+b*d*s,z=q.z-a*w*s+b*d*c;if(this.closestRawRoad({x,z}).distance<9||this.riverDistance(x,z)<46)return false;}return !this.streetSolids.some(o=>Math.hypot(o.x-q.x,o.z-q.z)<Math.hypot(o.w,o.d)/2+Math.hypot(w,d)/2+2);};
    if(!fits(p)){let found=false;for(let radius=offset;radius<=220&&!found;radius+=15)for(let a=0;a<16;a++){const q={x:origin.x+Math.sin(a*Math.PI/8)*radius,z:origin.z+Math.cos(a*Math.PI/8)*radius,angle};if(fits(q)){p=q;found=true;break;}}}
    const g=new THREE.Group();build(g);this.box(g,w+.5,.6,d+.5,this.mat('foundation',0xadb1a8),0,-.1,0);g.name=name;g.position.set(p.x,this.getTerrainHeight(p.x,p.z),p.z);g.rotation.y=p.angle;this.scene.add(g);this.landmarkGroups.push(g);
    this.landmarks.push({name,lat,lng,anchor:origin,pos:new THREE.Vector3(p.x,g.position.y+1,p.z)});this.streetSolids.push({x:p.x,z:p.z,w,d,angle:p.angle,height:200,y:g.position.y,kind:'building'});
    const label=this.makeLabel(name,'#fff2bf');label.scale.set(Math.min(w*.7,20),3,1);label.position.set(0,6,-d/2-1);g.add(label);return g;
  }
  buildTaipeiLandmarks() {
    this.landmarks=[];this.landmarkGroups=[];const glass=this.mat('tower-glass',0xffffff,'glass',3),stone=this.mat('stone',0xdbd8c7),red=this.mat('temple-red',0xa94b39),roof=this.mat('roof',0x35556e),brick=this.mat('brick',0xffffff,'brick');
    this.addLandmark('台北101',25.033,121.5654,g=>{this.box(g,28,20,28,glass,0,10,0);for(let i=0;i<8;i++){const y=20+i*15,w=19-i*.42;const m=this.mesh(g,new THREE.CylinderGeometry(w*.75,w*.61,13,4),glass,0,y+6.5,0);m.rotation.y=Math.PI/4;this.box(g,w*1.12,1.2,w*1.12,stone,0,y+13,0);}this.mesh(g,new THREE.CylinderGeometry(.25,.6,23,8),stone,0,151,0);},30,30,48);
    this.addLandmark('西門紅樓',25.0421,121.508,g=>{this.mesh(g,new THREE.CylinderGeometry(11,11,11,8),brick,0,5.5,0);this.mesh(g,new THREE.ConeGeometry(14,5,8),red,0,13.5,0);this.box(g,20,6,16,brick,0,3,12);for(let x=-8;x<=8;x+=8)this.box(g,2.8,4,.3,this.mat('door',0x314a50),x,2,-10.5);},28,36,32);
    this.addLandmark('台北車站',25.0478,121.517,g=>{this.box(g,46,14,26,stone,0,7,0);this.box(g,51,3,30,red,0,15.5,0);const top=this.mesh(g,new THREE.CylinderGeometry(16,16,46,4),roof,0,20,0);top.rotation.z=Math.PI/2;top.scale.set(.35,1,1);for(let x=-18;x<=18;x+=9)this.box(g,4,9,.4,this.mat('station-window',0x435e66),x,5,-13.3);},54,32,48);
    this.addLandmark('中山線形公園',25.052,121.52,g=>{this.box(g,30,.3,14,this.mat('park',0x688d69),0,.15,0);for(let x=-12;x<=12;x+=8){this.mesh(g,new THREE.CylinderGeometry(.25,.3,5,6),this.mat('tree-trunk',0x765b47),x,2.5,0);this.mesh(g,new THREE.SphereGeometry(3.3,8,6),this.mat('tree',0x3f8b71),x,6,0);}this.box(g,30,4,1,stone,0,2,7);},32,16,30);
    this.addLandmark('雙連市場',25.058,121.52,g=>{this.box(g,26,8,18,stone,0,4,0);this.box(g,28,1.5,20,red,0,8.8,0);for(let x=-10;x<=10;x+=5){this.box(g,4,2,3,this.mat('market-awning',0xe7b24b),x,4,-10);this.box(g,3,1,2,this.mat('market-counter',0x6b7161),x,.5,-11);}},30,24,35);
    this.addLandmark('圓山飯店',25.084,121.526,g=>{this.box(g,44,29,21,red,0,14.5,0);for(let y=5;y<=29;y+=6){this.box(g,48,1.2,24,stone,0,y,0);for(let x=-18;x<=18;x+=6)this.box(g,1,4,1,red,x,y-2,-12);}for(let i=0;i<2;i++){const m=this.mesh(g,new THREE.ConeGeometry(34-i*4,7,4),roof,0,33+i*6,0);m.rotation.y=Math.PI/4;m.scale.z=.65;}},52,30,54);
    this.addLandmark('士林夜市',25.0882,121.5244,g=>{this.box(g,2,9,2,red,-13,4.5,0);this.box(g,2,9,2,red,13,4.5,0);this.box(g,30,2,3,red,0,9,0);const r=this.mesh(g,new THREE.ConeGeometry(20,5,4),roof,0,12,0);r.rotation.y=Math.PI/4;r.scale.z=.25;for(let x=-10;x<=10;x+=5)this.mesh(g,new THREE.SphereGeometry(.9,8,6),this.mat('lantern',0xff553c),x,7,0);},32,12,32);
    this.addLandmark('松山河岸・夜市',25.05,121.578,g=>{this.box(g,2,9,2,red,-10,4.5,0);this.box(g,2,9,2,red,10,4.5,0);this.box(g,25,2,3,red,0,9,0);for(let i=0;i<3;i++){const m=this.mesh(g,new THREE.ConeGeometry(16-i*3,4,4),roof,0,11+i*3,0);m.rotation.y=Math.PI/4;m.scale.z=.4;}},30,16,36);
    this.addLandmark('內湖科技園區',25.083,121.59,g=>{this.box(g,22,52,20,glass,-12,26,0);this.box(g,25,36,25,glass,14,18,5);for(let y=4;y<50;y+=5)this.box(g,23,.35,21,stone,-12,y,0);},52,30,50);
    this.addLandmark('美麗華摩天輪',25.083,121.5575,g=>{this.box(g,36,14,26,this.mat('mall',0xdcd1a9),0,7,0);this.ferrisWheel=new THREE.Group();this.ferrisWheel.position.set(0,37,0);g.add(this.ferrisWheel);this.mesh(this.ferrisWheel,new THREE.TorusGeometry(22,.6,5,48),this.mat('wheel-metal',0xf2e8c6));for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.sin(a)*22,y=Math.cos(a)*22;const spoke=this.box(this.ferrisWheel,.22,22,.22,stone,Math.sin(a)*11,Math.cos(a)*11,0);spoke.rotation.z=-a;this.box(this.ferrisWheel,2.3,2.8,2,this.mat('cabin'+i,[0xf5b83c,0xde5b63,0x2dbdba][i%3]),x,y,0);}const leg=this.box(g,1.2,32,1.2,stone,-9,24,0);leg.rotation.z=-.3;const leg2=this.box(g,1.2,32,1.2,stone,9,24,0);leg2.rotation.z=.3;},46,32,45);
    this.addLandmark('陽明山・山線休息站',25.155,121.547,g=>{this.box(g,18,7,13,stone,0,3.5,0);const r=this.mesh(g,new THREE.ConeGeometry(16,6,4),roof,0,10,0);r.rotation.y=Math.PI/4;r.scale.z=.65;this.box(g,23,.5,20,this.mat('wood',0x977959),0,.25,0);},28,24,36);
    this.addLandmark('貓空纜車・貓空站',24.9687,121.5878,g=>{this.box(g,24,8,16,stone,0,4,0);this.box(g,28,1,20,roof,0,8.5,0);for(let x=-35;x<=35;x+=35){this.box(g,.8,24,.8,this.mat('pylon',0x65858a),x,12,6);this.box(g,6,.5,.8,stone,x,24,6);}this.box(g,85,.15,.15,stone,0,25,6);for(let x=-24;x<=24;x+=24){this.box(g,3,3.5,3,this.mat('gondola',0x39a89e),x,21,6);this.box(g,2.7,1.6,3.1,glass,x,21.8,6);}},32,20,45);
      this.addLandmark('臺北大巨蛋',25.0423,121.5601,g=>{this.box(g,56,7,42,this.mat('dome-wall',0xa8b8b9),0,3.5,0);const shell=this.mesh(g,new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2),this.mat('dome-shell',0xbec5bd),0,7,0);shell.scale.set(31,14,24);for(let x=-22;x<=22;x+=5.5)this.box(g,3,4,.3,glass,x,4,-21.2);},64,50,50);
    this.addLandmark('中正紀念堂',25.0347,121.5217,g=>{this.box(g,22,4,22,stone,0,2,0);this.box(g,17,15,17,stone,0,11.5,0);const top=this.mesh(g,new THREE.ConeGeometry(15,8,4),roof,0,23,0);top.rotation.y=Math.PI/4;for(let i=0;i<6;i++)this.box(g,15-i,.4,2.2,stone,0,i*.4,-12-i*1.7);},32,40,42);
  }

  cityStyleAt(x,z) {
    // Taipei is dense, but not uniformly dense. Commercial strips, older west-side
    // blocks, residential alleys, office districts and open-space edges all breathe
    // differently. This keeps the city recognizable without turning every road into
    // one continuous arcade/high-rise canyon.
    const mountain=z<-1540||z>980||Math.abs(x)>1750;
    if(mountain)return {step:34,wMin:9,wMax:15,dMin:10,dMax:16,hMin:6,hMax:16,arcade:.06,sign:.08,modern:.04,density:.34,heightPower:1.8};
    const west=x<-360&&z>-520&&z<620;
    const xinyi=x>220&&x<760&&z>-220&&z<520;
    const neihu=x>430&&z<-560&&z>-1180;
    const shilin=z<-620&&x>-650&&x<250;
    const south=z>500;
    if(west)return {step:21,wMin:10,wMax:16,dMin:14,dMax:21,hMin:10,hMax:31,arcade:.56,sign:.78,modern:.06,density:.82,heightPower:1.9};
    if(xinyi)return {step:29,wMin:16,wMax:26,dMin:19,dMax:31,hMin:28,hMax:74,arcade:.18,sign:.35,modern:.86,density:.54,heightPower:.9};
    if(neihu)return {step:30,wMin:16,wMax:28,dMin:20,dMax:32,hMin:21,hMax:66,arcade:.10,sign:.25,modern:.9,density:.48,heightPower:1.05};
    if(shilin)return {step:23,wMin:10,wMax:17,dMin:14,dMax:22,hMin:11,hMax:34,arcade:.38,sign:.58,modern:.14,density:.69,heightPower:1.7};
    if(south)return {step:25,wMin:10,wMax:18,dMin:14,dMax:22,hMin:11,hMax:36,arcade:.30,sign:.49,modern:.2,density:.62,heightPower:1.65};
    return {step:24,wMin:11,wMax:19,dMin:15,dMax:24,hMin:15,hMax:46,arcade:.36,sign:.54,modern:.3,density:.67,heightPower:1.55};
  }
  urbanOpenFactor(x,z){
    if(!this.openSpaceAnchors){
      const src=[
        ['大安森林公園',25.0315,121.5355,82,.08],['中正紀念堂廣場',25.0347,121.5217,82,.06],
        ['松山機場',25.0697,121.5525,180,.02],['臺大校園',25.0173,121.5397,145,.16],
        ['新生公園',25.0687,121.5307,76,.10],['花博圓山',25.0715,121.5232,72,.18],
        ['國父紀念館',25.0400,121.5600,62,.12],['植物園',25.0314,121.5109,65,.12],
        ['信義市府廣場',25.0375,121.5627,58,.20],['青年公園',25.0220,121.5065,72,.12]
      ];
      this.openSpaceAnchors=src.map(([name,lat,lng,r,factor])=>{const p=this.latLngToWorld(lat,lng);return {name,x:p.x,z:p.z,r,factor};});
    }
    let factor=1;for(const a of this.openSpaceAnchors){const d=Math.hypot(x-a.x,z-a.z);if(d<a.r){const t=d/a.r;factor=Math.min(factor,a.factor+(1-a.factor)*t*t);}}return factor;
  }
  streetMorphology(style,roadName='',roadWidth=18,x=0,z=0){
    const commercial=/重慶|延平|南京|民生|忠孝|中山|成都|桂林|艋舺|迪化|文林|士林中正|松山路|長安|長春/.test(roadName);
    const boulevard=roadWidth>=21||/仁愛|信義|敦化|復興|建國|中華|基隆/.test(roadName);
    const open=this.urbanOpenFactor(x,z),out={...style};out.density*=open;
    if(commercial){out.arcade=Math.min(.78,out.arcade+.20);out.sign=Math.min(.9,out.sign+.15);out.density=Math.min(.92,out.density+.08);}
    if(boulevard){out.step+=2.5;out.arcade*=.72;out.density*=.88;}
    return out;
  }
  rectsOverlap(a,b,gap=0) {
    const aa=a.angle||0,ba=b.angle||0,ac=Math.cos(aa),as=Math.sin(aa),bc=Math.cos(ba),bs=Math.sin(ba),dx=b.x-a.x,dz=b.z-a.z;
    const axes=[[ac,-as],[as,ac],[bc,-bs],[bs,bc]];
    for(const [ux,uz] of axes){
      const dist=Math.abs(dx*ux+dz*uz);
      const ar=Math.abs(ac*ux-as*uz)*a.w/2+Math.abs(as*ux+ac*uz)*a.d/2;
      const br=Math.abs(bc*ux-bs*uz)*b.w/2+Math.abs(bs*ux+bc*uz)*b.d/2;
      if(dist>ar+br+gap)return false;
    }
    return true;
  }
  addSpatialSolid(o) {
    const r=Math.hypot(o.w,o.d)/2+4;
    for(let x=Math.floor((o.x-r)/64);x<=Math.floor((o.x+r)/64);x++)for(let z=Math.floor((o.z-r)/64);z<=Math.floor((o.z+r)/64);z++){const key=x+','+z;if(!this.spatialSolids.has(key))this.spatialSolids.set(key,[]);this.spatialSolids.get(key).push(o);}
  }
  nearbyRectSolids(o,padding=3) {
    const r=Math.hypot(o.w,o.d)/2+padding,out=new Set();
    for(let x=Math.floor((o.x-r)/64);x<=Math.floor((o.x+r)/64);x++)for(let z=Math.floor((o.z-r)/64);z<=Math.floor((o.z+r)/64);z++)for(const solid of this.spatialSolids.get(x+','+z)||[])out.add(solid);
    return out;
  }
  buildStreetLife() {
    const gray=this.mat('concrete',0x8e9996),walk=this.mat('walk',0xffffff,'tile'),trim=this.mat('trim',0xe5d9c4),dark=this.mat('dark',0x2c4049),trunk=this.mat('tree-trunk',0x765b47),tree=this.mat('tree',0x3f8b71),arcadeCeiling=this.mat('arcade-soffit',0xc9c3b5);
    const landmarkSolids=this.streetSolids.slice();this.spatialSolids.clear();landmarkSolids.forEach(o=>this.addSpatialSolid(o));
    this.buildingCount=0;this.streetSignCount=0;this.treeCount=0;this.arcadeCount=0;this.hangingSignCount=0;
    for(const s of this.segments){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),rx=dz/len,rz=-dx/len,roadMeta=TAIPEI_ROADS[s.ri]||{},roadWidth=roadMeta.width||18,roadW=roadWidth/1.7;
      for(let d=10;d<len-7;){const x=s.a.x+dx*d/len,z=s.a.z+dz*d/len,style=this.streetMorphology(this.cityStyleAt(x,z),roadMeta.name||'',roadWidth,x,z),step=style.step+this.rand()*3;d+=step;
        for(const side of [-1,1]){const variant=Math.floor(this.rand()*6),w=style.wMin+this.rand()*(style.wMax-style.wMin),depth=style.dMin+this.rand()*(style.dMax-style.dMin),buildingRot=angle-side*Math.PI/2;
          const offset=roadW/2+3.0+depth/2,bx=x+rx*side*offset,bz=z+rz*side*offset,y=this.getTerrainHeight(bx,bz),mountain=z<-1540||z>980||Math.abs(x)>1750;
          const candidate={x:bx,z:bz,w,d:depth,height:0,y,angle:buildingRot,kind:'building'};
          if(this.riverDistance(bx,bz)<52||landmarkSolids.some(o=>this.rectsOverlap(candidate,o,5))||this.isReservedSite?.(candidate))continue;
          const nearest=this.snapRoad({x:bx,z:bz});if(nearest.segment!==s&&nearest.distance<Math.max(8,depth/2+roadW/3))continue;
          if(mountain&&this.rand()>.28){this.instance('trunks',trunk,bx,y+3,bz,.35,6,.35);this.instance('treetops',tree,bx,y+7,bz,4,6,4,0,new THREE.SphereGeometry(1,7,5));this.treeCount++;continue;}
          if(this.rand()>style.density){if(this.rand()<.34){this.instance('gapTrees',trunk,bx,y+2.6,bz,.26,5.2,.26);this.instance('gapTreeTops',tree,bx,y+6,bz,3.1,4.6,3.1,0,new THREE.SphereGeometry(1,7,5));this.treeCount++;}continue;}
          if(this.buildingCount>1280)continue;
          if([...this.nearbyRectSolids(candidate,2)].some(o=>this.rectsOverlap(candidate,o,.65)))continue;
          const h=style.hMin+Math.pow(this.rand(),style.heightPower||1)*(style.hMax-style.hMin),modern=this.rand()<style.modern;candidate.height=h+4;
          this.instance('facade-'+(modern?'glass-':'masonry-')+variant,this.mat('facade-'+(modern?'glass-':'masonry-')+variant,0xffffff,modern?'glass':'facade',variant),bx,y+h/2+3.8,bz,w,h,depth,buildingRot);this.instance('rooftrims',trim,bx,y+h+4,bz,w+.7,.6,depth+.7,buildingRot);
          this.instance('shops'+variant,this.mat('shopfront-'+variant,0xffffff,'shopfront',variant),bx,y+1.7,bz,w,3.4,depth,buildingRot);this.instance('foundations',gray,bx,y-.1,bz,w+.5,.6,depth+.5,buildingRot);
          const arcadeDepth=4.6,fx=bx-rx*side*(depth/2+arcadeDepth*.46),fz=bz-rz*side*(depth/2+arcadeDepth*.46),hasArcade=this.rand()<style.arcade;
          if(hasArcade){
            this.instance('arcadeSoffits',arcadeCeiling,fx,y+3.62,fz,w+.35,.26,arcadeDepth,buildingRot);
            this.instance('arcadeFascia'+variant,this.mat('awning'+variant,[0xb36248,0x358c88,0xd8b454,0x596e8b,0x95805f,0x687e72][variant]),fx-rx*side*1.9,y+3.7,fz-rz*side*1.9,w+.55,.38,.26,buildingRot);
            // 柱線留在人行道側：弧線外緣距路心至少 roadW/2+1.0，否則柱子會落在車道內。
            const cols=Math.max(2,Math.ceil(w/5.4)),colInset=Math.min(1.45,(3.0-arcadeDepth*.46)-1.0);for(let ci=0;ci<=cols;ci++){const along=-w/2+.85+(w-1.7)*ci/cols,cx=fx+Math.sin(angle)*along-rx*side*colInset,cz=fz+Math.cos(angle)*along-rz*side*colInset;const instance=this.instance('arcadeColumns',trim,cx,y+1.72,cz,.32,3.44,.32,angle);const col={x:cx,z:cz,w:.42,d:.42,height:3.44,y,angle,kind:'arcade-column',renderInstances:[instance]};this.streetSolids.push(col);this.addSpatialSolid(col);}
            this.arcadeCount++;
            {const awning={x:fx,z:fz,w:w+.35,d:arcadeDepth,y,height:3.75,angle:buildingRot,kind:'awning'};this.rideSlabs.push(awning);this.ceilingSlabs.push({...awning,ceilingBottom:y+3.49,ceilingThickness:.26,tag:'騎樓雨棚'});this.instance('rideAwningTrim',this.mat('ride-edge',0xf4c44c),fx-rx*side*2.18,y+3.79,fz-rz*side*2.18,w+.5,.1,.18,buildingRot);}
          }else this.instance('awnings'+variant,this.mat('awning'+variant,[0xb36248,0x358c88,0xd8b454,0x596e8b,0x95805f,0x687e72][variant]),fx,y+3.55,fz,w*.86,.2,2.4,buildingRot);
          const sidewalkX=x+rx*side*(roadW/2+2.0),sidewalkZ=z+rz*side*(roadW/2+2.0);this.instance('pavements',walk,sidewalkX,y+.18,sidewalkZ,4.0,.2,step+2,angle);
          if(!modern&&h>17){const frontX=bx-rx*side*(depth/2+.08),frontZ=bz-rz*side*(depth/2+.08);for(let floor=0;floor<Math.min(3,Math.floor(h/9));floor++)this.instance('balconyBands',trim,frontX,y+8.2+floor*6.8,frontZ,w*.82,.22,.72,buildingRot);}
          this.instance('waterTanks',gray,bx+rx*3,y+h+5.4,bz+rz*3,1.4,2.7,1.4,0,new THREE.CylinderGeometry(1,1,1,8));
          if(!modern&&this.buildingCount%3!==0){const ux=bx-rx*side*(depth/2+.18)+Math.sin(angle)*(w*.23),uz=bz-rz*side*(depth/2+.18)+Math.cos(angle)*(w*.23);this.instance('acUnits',this.mat('ac-unit',0xd4d7d0),ux,y+6.3,uz,.72,.48,.34,buildingRot);this.instance('utilityPipes',this.mat('utility-pipe',0x7d8581),ux+Math.sin(angle)*.5,y+4.55,uz+Math.cos(angle)*.5,.06,3,.06,0);}
          const signColor=this.mat('hanging-sign'+variant,[0xd84e3f,0x2b8e89,0xe0b544,0x395f8b,0x93606c,0x65835d][variant]);if(this.rand()<style.sign){const sx=fx+Math.sin(angle)*(w*.32),sz=fz+Math.cos(angle)*(w*.32);this.instance('hangingSigns'+variant,signColor,sx-rx*side*1.65,y+4.7,sz-rz*side*1.65,.5,2.6,1.1,angle);this.hangingSignCount++;}
          if(this.streetSignCount<290&&this.rand()<style.sign*.52){const sign=this.streetShopSign(this.buildingCount%24),m=this.mesh(this.scene,new THREE.PlaneGeometry(w*.7,1.75),sign,fx,y+3.35,fz);m.rotation.y=buildingRot;this.streetSignCount++;}
          this.streetSolids.push(candidate);this.addSpatialSolid(candidate);this.buildingCount++;
        }
      }
      // Short curb markings are cut at intersections so junctions remain readable at speed.
      for(let d=10;d<len;d+=10){const x=s.a.x+dx*d/len,z=s.a.z+dz*d/len;if(this.nodes.some(n=>n.edges.length>2&&Math.hypot(x-n.x,z-n.z)<10))continue;
        for(const side of [-1,1])this.instance('centerYellow',this.mat('center-yellow',0xf6d67d),x+rx*side*.16,this.getTerrainHeight(x,z)+.195,z+rz*side*.16,.1,.02,4,angle);
      }
    }
    for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i];if(n.edges.length<3||this.riverDistance(n.x,n.z)<80||i%2)continue;this.buildIntersection(n,i);}
    // River embankments make the water visible and add actual bridge-side railings.
    for(const river of this.worldRivers())for(let i=1;i<river.nodes.length;i++){const a=river.nodes[i-1],b=river.nodes[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),rx=dz/len,rz=-dx/len,angle=Math.atan2(dx,dz);for(let d=12;d<len;d+=24)for(const side of [-1,1]){const x=a.x+dx*d/len+rx*side*(river.width/2+7),z=a.z+dz*d/len+rz*side*(river.width/2+7),y=this.getTerrainHeight(x,z);if(this.snapRoad({x,z}).distance<14)continue;this.instance('riverwalls',gray,x,y+.15,z,1,1,24,angle);this.instance('riverParkTrees',tree,x+rx*side*7,y+3.5,z+rz*side*7,3,5,3,0,new THREE.SphereGeometry(1,7,5));}}
    for(const s of this.segments){const mid={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2};if(Math.min(this.riverDistance(s.a.x,s.a.z),this.riverDistance(s.b.x,s.b.z),this.riverDistance(mid.x,mid.z))>105)continue;const len=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),rx=(s.b.z-s.a.z)/len,rz=-(s.b.x-s.a.x)/len,angle=Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z);
      for(let d=6;d<len;d+=10){const x=s.a.x+(s.b.x-s.a.x)*d/len,z=s.a.z+(s.b.z-s.a.z)*d/len;if(this.riverDistance(x,z)>90)continue;for(const side of [-1,1]){this.instance('bridgeRails',trim,x+rx*side*8,this.getTerrainHeight(x,z)+1,z+rz*side*8,.2,1.1,9,angle);this.instance('bridgePosts',gray,x+rx*side*8,this.getTerrainHeight(x,z)+.5,z+rz*side*8,.4,1,.4);}}
    }
    this.indexStreetSolids();
  }
  buildVisuals() {
    // Shop staff stand at the roadside, with separate rounded bodies and branded aprons.
    this.customers.forEach((c,i)=>{
      c.ring.position.y=.25;
      [...c.group.children].forEach(child=>{if(child!==c.ring&&child!==c.icon&&child.type!=='Sprite'){c.group.remove(child);child.geometry?.dispose();}});
      const apron=this.mat('staff-apron'+i%4,[0x13a295,0xb66d49,0x4f718f,0xba9d55][i%4]),skin=this.mat('staff-skin'+i%3,[0xe9bb96,0xdca77c,0xf0c6a4][i%3]),shirt=this.mat('staff-shirt',0xf0e6d2),pants=this.mat('staff-pants',0x314755),hair=this.mat('staff-hair',0x34353a);
      const ball=(r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=this.mesh(c.group,new THREE.SphereGeometry(r,12,9),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
      ball(.3,shirt,0,1.18,0,.9,1.3,.7);ball(.27,apron,0,1.13,.1,1,1.2,.45);ball(.23,skin,0,1.75,0,.94,1.03,.9);this.mesh(c.group,new THREE.SphereGeometry(.24,12,8,0,Math.PI*2,0,Math.PI*.48),hair,0,1.81,-.025);
      for(const side of [-1,1]){this.mesh(c.group,new THREE.CylinderGeometry(.09,.08,.65,8),pants,side*.13,.52,0);ball(.11,this.mat('staff-shoes',0x26333b),side*.13,.16,.08,1,.55,1.6);const arm=this.mesh(c.group,new THREE.CylinderGeometry(.07,.08,.56,8),shirt,side*.32,1.18,.05);arm.rotation.z=side*.2;ball(.08,skin,side*.37,.91,.06);}
      ball(.045,skin,0,1.75,.225,.6,.7,1);for(const x of [-.085,.085])ball(.019,hair,x,1.8,.215);this.box(c.group,.24,.04,.015,this.mat('staff-reflect',0xf1e9b8),0,1.24,.237);
      const booth=new THREE.Group(),r=this.snapRoad(c.group.position),dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz),side=Math.sign((c.group.position.x-r.x)*dz-(c.group.position.z-r.z)*dx)||1,x=c.group.position.x+dz/len*11*side,z=c.group.position.z-dx/len*11*side;
      c.group.rotation.y=Math.atan2(dx,dz);const rp=c.ring.geometry.attributes.position,rc=Math.cos(c.group.rotation.y),rs=Math.sin(c.group.rotation.y);for(let k=0;k<rp.count;k++){const lx=rp.getX(k),lz=rp.getZ(k);rp.setY(k,this.getTerrainHeight(c.group.position.x+lx*rc+lz*rs,c.group.position.z-lx*rs+lz*rc)-c.group.position.y);}rp.needsUpdate=true;c.group.children.forEach(child=>{if(child!==c.ring&&child!==c.icon&&child.type!=='Sprite')child.position.x+=5.2*side;});
      booth.position.set(x,this.getTerrainHeight(x,z),z);booth.rotation.y=Math.atan2(dx,dz)-Math.PI/2*side;
      this.box(booth,4.6,3.3,2.5,this.mat('booth-wall',0x315860),0,1.65,0);this.box(booth,4.9,.2,3.3,apron,0,3.4,.35);this.box(booth,4,1.1,1,apron,0,.55,1.5);this.mesh(booth,new THREE.PlaneGeometry(4.1,.9),this.streetShopSign(i%24),0,2.5,1.26);this.scene.add(booth);
    });
    this.renderer.shadowMap.enabled=false;
  }
  streetShopSign(i) {
    this.shopSigns=this.shopSigns||[];if(this.shopSigns[i])return this.shopSigns[i];
    const names=['阿北豆漿大聯萌','松鬆燒臘快打','站錢茶舖','笑到發麵線','艋甲鹽酥基','大稻埕埕埕咖啡','忠笑東魯味','寧夏不夜炸','貓空空烏龍','內湖嚕啦啦便當','士林不士氣藥局','台北衝衝快送','信義很信義雞排','古亭古早衝早餐','木柵木瓜不木納','大安大大安飯糰','延三夜奔滷肉飯','南機場不飛便當','永康永遠康茶行','民生民聲熱炒','八德八得飽水餃','中山中衫洗衣社','華西滑西甜湯','光華光光修機店'];
    const sub=['豆漿・蛋餅・衝刺','燒臘・便當・加大飯','珍奶・粉角・少冰','麵線・臭豆腐・加香菜','鹽酥雞・甜不辣','COFFEE・BAKE・CHAT','魯味・關東煮','炸物・宵夜・狂歡','茶葉・霧氣・烏龍','便當・湯品・滷排','藥妝・日常・急救','EXPRESS・24H・BOOST','雞排・地瓜・氣勢','蛋餅・奶茶・趕課','木瓜牛奶・現打','飯糰・豆漿・加蛋','滷肉飯・半熟蛋','排骨・雞腿・不登機','茶葉・冷泡・散步','熱炒・白飯・續桌','水餃・酸辣湯','洗衣・燙衣・救白襯衫','甜湯・冰品・芋圓','維修・零件・救手機'];
    const note=['中山人通勤救星','松山胃口大爆發','北車趕車先喝一杯','西門口笑著排隊','萬華夜貓專用','迪化街邊走邊香','忠孝東路塞車也要吃','夜市續命配方','山線也能外送到','內科午休救援隊','士林夜市胃藥先準備','騎到冒火也要送','信義區也要先吃飽','學生上課前最後希望','木柵山風吹不走濃度','大安區早餐很大份','凌晨兩點還能再一碗','沒有登機門只有滷排','散步的人很多 茶先喝','民生社區晚餐集合','八德路吃八顆不夠','中山區白襯衫急救','華西街吃甜再回家','光華沒光也能修'];
    const plaques=['中山區','松山區','中正區','萬華區','萬華區','大同區','大安區','大同區','文山區','內湖區','士林區','台北市','信義區','中正區','文山區','大安區','大同區','萬華區','大安區','松山區','松山區','中山區','萬華區','中正區'];
    const roads=['赤峰街','民生東路','北車地下街','西門町','艋舺大道','迪化街','忠孝東路','寧夏夜市','貓空纜車下','瑞光路','基河路','八德路','信義路','羅斯福路','木柵路','大安路','延平北路三段','南機場周邊','永康街','民生社區','八德路','中山北路','華西街','市民大道'];
    const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.scale(2,2);const palette=[['#a33d34','#6f2827'],['#c7a13c','#876522'],['#317f7a','#20585c'],['#466b82','#2b435a']],colors=palette[i%4],grad=ctx.createLinearGradient(0,0,0,128);grad.addColorStop(0,colors[0]);grad.addColorStop(1,colors[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,512,128);
    // Backlit acrylic sign with metal frame, screws, slight grime and fluorescent banding.
    ctx.fillStyle='#14252a';ctx.fillRect(0,0,512,7);ctx.fillRect(0,121,512,7);ctx.fillRect(0,0,7,128);ctx.fillRect(505,0,7,128);ctx.strokeStyle='#eadfbd88';ctx.lineWidth=1;ctx.strokeRect(10.5,10.5,491,107);
    ctx.fillStyle='#0d2b36';ctx.fillRect(18,18,96,20);ctx.strokeStyle='#d7edf255';ctx.strokeRect(18.5,18.5,95,19);
    ctx.fillStyle='#eff6f1';ctx.font='700 11px "Noto Sans TC"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(plaques[i],66,28,84);
    for(let y=15;y<120;y+=9){ctx.fillStyle=y%18?'#ffffff08':'#00000008';ctx.fillRect(11,y,490,4);}for(let k=0;k<120;k++){ctx.fillStyle=this.rand()>.5?'#ffffff0b':'#151d1d10';ctx.fillRect(12+this.rand()*486,12+this.rand()*102,1+this.rand()*4,1);}
    ctx.fillStyle='#f1e9cf';ctx.font='900 38px "Noto Sans TC"';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(names[i],30,56,295);ctx.font='700 14px "Noto Sans TC"';ctx.fillStyle='#f6e7bb';ctx.fillText(sub[i],32,92,220);
    ctx.fillStyle='#203b43e8';ctx.fillRect(250,74,70,24);ctx.strokeStyle='#f4e6ba55';ctx.strokeRect(250.5,74.5,69,23);ctx.fillStyle='#ffd36c';ctx.font='700 11px "Noto Sans TC"';ctx.textAlign='center';ctx.fillText(roads[i],285,86,58);
    ctx.fillStyle='#172a2d99';ctx.fillRect(335,22,145,78);ctx.strokeStyle='#f4e6ba77';ctx.strokeRect(335.5,22.5,144,77);ctx.fillStyle='#f5ead0';ctx.font='800 16px "Noto Sans TC"';ctx.textAlign='center';ctx.fillText(note[i],407,49,126);ctx.font='700 11px "Noto Sans TC"';ctx.fillStyle='#d9ddcf';ctx.fillText('TAIPEI  ·  OPEN',407,75,126);ctx.fillText(i===11||i===23?'24 HOURS':'07:00–22:00',407,91,126);
    for(const x of [16,496])for(const y of [16,112]){ctx.fillStyle='#aeb8b4';ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e6a68';ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,roughness:.42,metalness:.08,emissive:0x4c351d,emissiveMap:t,emissiveIntensity:.28});this.shopSigns[i]=m;return m;
  }
  buildBlockInteriors() {
    // Interior lots are intentionally patchier than the street fronts. Taipei has a
    // lot of old stock, but also schools, courtyards, parking lots, parks and larger
    // setback developments; leaving those gaps makes districts read more truthfully.
    const roof=this.mat('infill-roof',0xb6b9ab),foundation=this.mat('foundation',0xadb1a8);let count=0;
    outer: for(let x=-1080;x<1320;x+=30)for(let z=-1120;z<900;z+=30){if(count>=540)break outer;const px=x+(this.rand()-.5)*5,pz=z+(this.rand()-.5)*5,style=this.cityStyleAt(px,pz);if(this.rand()>style.density*.72||this.urbanOpenFactor(px,pz)<.24)continue;
      const w=12+this.rand()*6,d=12+this.rand()*6,angle=(this.rand()-.5)*.045,candidate={x:px,z:pz,w,d,height:0,y:0,angle,kind:'building'};
      if(this.isReservedSite?.(candidate)||this.snapRoad({x:px,z:pz}).distance<18||this.riverDistance(px,pz)<58||[...this.nearbyRectSolids(candidate,3)].some(o=>this.rectsOverlap(candidate,o,1.2)))continue;
      const variant=Math.floor(this.rand()*6),y=this.getTerrainHeight(px,pz),h=Math.max(12,style.hMin+Math.pow(this.rand(),style.heightPower||1)*(style.hMax-style.hMin)*.82),modern=this.rand()<style.modern*.75;candidate.y=y;candidate.height=h;
      this.instance('infill'+variant,this.mat('infill-'+(modern?'glass-':'masonry-')+variant,0xffffff,modern?'glass':'facade',variant),px,y+h/2,pz,w,h,d,angle);this.instance('infillRoofs',roof,px,y+h+.3,pz,w+.5,.6,d+.5,angle);this.instance('infillBases',foundation,px,y-.1,pz,w+.5,.6,d+.5,angle);
      if(!modern&&h>24)this.instance('infillRoofTanks',this.mat('concrete',0x8e9996),px+2,y+h+1.4,pz-2,1.3,2.3,1.3,0,new THREE.CylinderGeometry(1,1,1,8));
      this.streetSolids.push(candidate);this.addSpatialSolid(candidate);this.buildingCount++;count++;
    }
    this.infillCount=count;this.indexStreetSolids();
  }
  buildIntersection(n,seed) {
    const g=new THREE.Group();g.position.set(n.x,this.getTerrainHeight(n.x,n.z),n.z);
    const pole=this.mat('signal-pole',0x3e5154),housing=this.mat('signal-housing',0x1d292d),curb=this.mat('crosswalk',0xe6e2d5);
    const heads=[];
    const makeHead=(x,z,rot,axis)=>{
      const arm=new THREE.Group();arm.position.set(x,0,z);arm.rotation.y=rot;
      this.box(arm,.22,6,.22,pole,0,3,0);this.box(arm,3.05,.22,.22,pole,-1.35,5.45,0);this.box(arm,.72,2.35,.52,housing,-2.65,5.15,0);
      const bulbs=[];for(let i=0;i<3;i++){const mat=new THREE.MeshBasicMaterial({color:[0x561b18,0x594718,0x174d36][i],toneMapped:false});const bulb=this.mesh(arm,new THREE.SphereGeometry(.2,8,6),mat,-2.65,5.78-i*.62,.29);bulbs.push(bulb);}g.add(arm);heads.push({axis,bulbs});
    };
    makeHead(8.2,8.2,0,'ns');makeHead(-8.2,-8.2,Math.PI,'ns');makeHead(-8.2,8.2,Math.PI/2,'ew');makeHead(8.2,-8.2,-Math.PI/2,'ew');
    for(let x=-6;x<=6;x+=2)this.box(g,1.15,.025,3.4,curb,x,.21,9.5);
    for(let z=-6;z<=6;z+=2)this.box(g,3.4,.025,1.15,curb,9.5,.21,z);
    if(seed%6===0){this.box(g,3.7,2.8,1.5,this.mat('bus-shelter',0x4c727b),-10.5,1.4,-10.5);this.box(g,4.3,.22,2.2,this.mat('busroof',0xefc14f),-10.5,3,-10.5);}
    this.scene.add(g);this.trafficSignals.push({nodeId:seed,group:g,heads});this.signalNodeIds.add(seed);
  }
  signalState(nodeId,axis='ns') {
    const phase=(this.elapsed+(nodeId%7)*1.17)%18;
    if(axis==='ns')return phase<7?'green':phase<9?'yellow':'red';
    return phase>=9&&phase<16?'green':phase>=16?'yellow':'red';
  }
  updateTrafficSignals(){
    const bright={red:0xff493f,yellow:0xffc94d,green:0x41e49a},dim={red:0x4b1917,yellow:0x554316,green:0x154532};
    for(const s of this.trafficSignals)for(const head of s.heads){const state=this.signalState(s.nodeId,head.axis);for(let i=0;i<3;i++){const name=['red','yellow','green'][i],mat=head.bulbs[i].material;mat.color.setHex(name===state?bright[name]:dim[name]);head.bulbs[i].scale.setScalar(name===state?1.18:1);}}
  }
  buildElevatedMRT() {
    const concrete=this.mat('viaduct',0xadb9b6),steel=this.mat('rail-steel',0x657d87);
    // Scenic elevated transit sits beside the eastern streets; gameplay roads remain unambiguous.
    const nodes=[[25.026,121.543],[25.0415,121.544],[25.0518,121.544],[25.061,121.544],[25.063,121.552],[25.079,121.546],[25.084,121.555],[25.082,121.567],[25.080,121.575],[25.078,121.584]].map(p=>this.latLngToWorld(...p));this.mrtSegments=[];
    for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);this.mrtSegments.push({a,b,len,underground:i>=4&&i<=6});if(i>=4&&i<=6)continue;
      for(let d=0;d<len;d+=12){const x=a.x+dx*(d+6)/len,z=a.z+dz*(d+6)/len,y=this.getTerrainHeight(x,z);this.instance('mrtDeck',concrete,x,y+11,z,6,.9,12,angle);for(const side of [-1,1])this.instance('mrtRails',steel,x+side*1.8,y+11.6,z,.12,.18,12,angle);
        if(d%48===0&&this.snapRoad({x,z}).distance>8)this.instance('mrtColumns',concrete,x,y+5.5,z,1.4,11,1.4);}
    }
    this.mrtTrain=new THREE.Group();const body=this.mat('mrt-body',0xd0e4df),blue=this.mat('mrt-blue',0x428ca9),window=this.mat('mrt-window',0x244951);
    for(let i=0;i<4;i++){this.box(this.mrtTrain,2.4,2.4,7.5,body,0,1.2,i*8);this.box(this.mrtTrain,2.45,.35,7.5,blue,0,.6,i*8);for(const side of [-1,1])this.box(this.mrtTrain,.02,.9,6.6,window,side*1.22,1.65,i*8);}
    const first=this.mrtSegments[0];this.mrtTrain.position.set(first.a.x,this.getTerrainHeight(first.a.x,first.a.z)+11.7,first.a.z);this.mrtTrain.rotation.y=Math.atan2(first.b.x-first.a.x,first.b.z-first.a.z);this.scene.add(this.mrtTrain);
  }
  buildUndergroundStreet() {
    // A stylized Taipei underground mall: exaggerated, rideable, and fully original.
    const base=this.latLngToWorld(25.0477,121.5170),angle=Math.PI/2,y=this.getTerrainHeight(base.x,base.z);
    const floor={x:base.x,z:base.z,w:21,d:112,height:.24,y:y+.02,angle,kind:'underground-floor'};
    const leftWall={x:base.x,z:base.z-10.9,w:112,d:1.2,height:3.8,y,angle:0,kind:'underground-wall'};
    const rightWall={x:base.x,z:base.z+10.9,w:112,d:1.2,height:3.8,y,angle:0,kind:'underground-wall'};
    const zoneGroup=new THREE.Group();zoneGroup.position.set(base.x,y,base.z);zoneGroup.rotation.y=angle;
    const floorMat=this.mat('ug-floor',0xffffff,'tile'),wallMat=this.mat('ug-wall',0xc7c0b4),trim=this.mat('ug-trim',0xebb951),roof=this.mat('ug-roof',0x17313f),light=this.mat('ug-light',0xffe7a8),rail=this.mat('ug-rail',0x6e8d95);
    this.box(zoneGroup,21,.24,112,floorMat,0,.12,0);this.box(zoneGroup,21,.02,112,this.mat('ug-floor-line',0x4ea8c0),0,.25,0);
    for(const side of [-1,1]){this.box(zoneGroup,.85,3.8,112,wallMat,side*10.95,1.9,0);this.box(zoneGroup,.35,.12,112,trim,side*9.95,3.28,0);}
    this.box(zoneGroup,18.8,.28,98,roof,0,3.45,0);
    for(let z=-42;z<=42;z+=14){this.box(zoneGroup,17.6,.08,1.1,light,0,3.22,z);for(const side of [-1,1])this.box(zoneGroup,.2,2.7,.2,rail,side*8.9,1.35,z);}
    const neonNames=['站錢熱炒','貓纜不纜','珍煮擔','鬆山鬆餅','北投笑餅','西門不西門','大稻埕不鹹酥','公館貢丸'];
    for(let i=0;i<8;i++){
      const booth=new THREE.Group(),side=i%2?-1:1,row=Math.floor(i/2),lz=-38+row*18;booth.position.set(side*7.7,0,lz);booth.rotation.y=side>0?-Math.PI/2:Math.PI/2;
      this.box(booth,6.8,2.9,2.8,this.mat('ug-shop-wall'+i,[0x213f4b,0x4c342c,0x334251,0x49503a][i%4]),0,1.45,0);this.box(booth,7.3,.25,3.4,this.mat('ug-shop-awning'+i,[0xd9504e,0x36a0a8,0xffce59,0x6c7fe1][i%4]),0,3.1,.1);
      const sign=this.mesh(booth,new THREE.PlaneGeometry(5.9,1.3),this.streetShopSign(i),0,2.24,1.55);sign.rotation.y=Math.PI;
      const sub=this.makeLabel(neonNames[i],['#ffebaa','#9df7f3','#ffd471','#ffc3d3'][i%4]);sub.scale.set(1.8,.45,1);sub.position.set(0,3.55,1.36);booth.add(sub);
      zoneGroup.add(booth);const c=Math.cos(angle),sn=Math.sin(angle),wx=base.x+booth.position.x*c+booth.position.z*sn,wz=base.z-booth.position.x*sn+booth.position.z*c,shopSolid={x:wx,z:wz,w:6.9,d:2.9,height:3.25,y,angle:angle+booth.rotation.y,kind:'underground-shop'};this.streetSolids.push(shopSolid);this.addSpatialSolid(shopSolid);
    }
    const entranceNames=['台北地下衝衝街','北車地下亂流區'];
    for(const side of [-1,1]){
      const ez=side*61,portal=new THREE.Group(),portalMat=this.mat('ug-portal',0x244656);portal.position.set(0,0,ez);this.box(portal,1.25,4.5,1.4,portalMat,-7.85,2.1,0);this.box(portal,1.25,4.5,1.4,portalMat,7.85,2.1,0);this.box(portal,17,1.15,1.4,portalMat,0,4.18,0);this.box(portal,15.8,.3,1.55,trim,0,4.72,.1);
      const banner=this.makeLabel(entranceNames[side>0?0:1],'#ffd766');banner.scale.set(2.4,.62,1);banner.position.set(0,4.24,.92);portal.add(banner);zoneGroup.add(portal);
      const pc=Math.cos(angle),ps=Math.sin(angle),pz=ez;for(const lx of [-7.85,7.85]){const wx=base.x+lx*pc+pz*ps,wz=base.z-lx*ps+pz*pc,col={x:wx,z:wz,w:1.35,d:1.5,height:4.5,y,angle,kind:'underground-portal-column'};this.streetSolids.push(col);this.addSpatialSolid(col);}
      const ramp={x:base.x+(side<0?-62:62),z:base.z,w:16,d:15,height:1.2,angle:side<0?Math.PI/2:-Math.PI/2,y:y+.02,id:'ug-ramp'+(side>0?1:0)};this.ramps.push(ramp);
      const rg=new THREE.Group();rg.position.set(ramp.x,ramp.y,ramp.z);rg.rotation.y=ramp.angle;const w=ramp.w/2,d=ramp.d/2,h=ramp.height,geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,-d,-w,h,d,w,0,-d,w,0,-d,-w,h,d,w,h,d],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,0,1,0,0,1,1,1],2));geo.computeVertexNormals();this.mesh(rg,geo,this.mat('ug-ramp-mat',0xffffff,'ramp'));this.scene.add(rg);
    }
    const finishLabel=this.makeLabel('地下街捷徑\n衝進去！','#8ff1f0');finishLabel.position.set(base.x,y+4.8,base.z);finishLabel.scale.set(2.8,.8,1);this.scene.add(finishLabel);
    this.scene.add(zoneGroup);this.streetSolids.push(leftWall,rightWall);this.addSpatialSolid(leftWall);this.addSpatialSolid(rightWall);
    this.ceilingSlabs.push({x:base.x,z:base.z,w:18.6,d:98,angle,ceilingBottom:y+3.29,ceilingThickness:.28,tag:'地下街天花'});this.undergroundZones.push({x:base.x,z:base.z,w:21,d:112,angle,name:'台北地下衝衝街'});
  }
  indexStreetSolids() {
    this.spatialSolids.clear();for(const o of this.streetSolids)this.addSpatialSolid(o);
  }
  nearbySolids(p){return this.spatialSolids.get(Math.floor(p.x/64)+','+Math.floor(p.z/64))||[];}
  localXZ(p,o){const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.angle||0),s=Math.sin(o.angle||0);return {x:dx*c-dz*s,z:dx*s+dz*c};}
  overlaps(p,o,padding=.5){const q=this.localXZ(p,o);return Math.abs(q.x)<o.w/2+padding&&Math.abs(q.z)<o.d/2+padding;}
  resolveRectPoint(prev,desired,o,padding=.48){
    const c=Math.cos(o.angle||0),sn=Math.sin(o.angle||0),toLocal=p=>{const dx=p.x-o.x,dz=p.z-o.z;return {x:dx*c-dz*sn,z:dx*sn+dz*c};},q=toLocal(desired),before=toLocal(prev),ex=o.w/2+padding,ez=o.d/2+padding;
    if(Math.abs(q.x)>=ex||Math.abs(q.z)>=ez)return null;const px=ex-Math.abs(q.x),pz=ez-Math.abs(q.z);let nx=0,nz=0;
    if(px<pz){const sign=Math.abs(before.x)>.02?Math.sign(before.x):(q.x>=0?1:-1);q.x=sign*(ex+.025);nx=sign*c;nz=-sign*sn;}
    else{const sign=Math.abs(before.z)>.02?Math.sign(before.z):(q.z>=0?1:-1);q.z=sign*(ez+.025);nx=sign*sn;nz=sign*c;}
    return {x:o.x+q.x*c+q.z*sn,z:o.z-q.x*sn+q.z*c,nx,nz};
  }
  sweepStaticMotion(old,target){
    const dx=target.x-old.x,dz=target.z-old.z,dist=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(dist/.42));let current={x:old.x,z:old.z},hit=false,nx=0,nz=0;
    for(let i=1;i<=steps;i++){let desired={x:old.x+dx*i/steps,z:old.z+dz*i/steps};for(let pass=0;pass<4;pass++){const probe={x:desired.x,y:this.carPos.y,z:desired.z};const solid=this.nearbySolids(probe).find(o=>this.carPos.y<o.y+o.height-.035&&this.overlaps(probe,o,.48));if(!solid)break;const r=this.resolveRectPoint(current,desired,solid,.48);if(!r){desired={...current};break;}desired={x:r.x,z:r.z};nx+=r.nx;nz+=r.nz;hit=true;}const probe={x:desired.x,y:this.carPos.y,z:desired.z};if(this.nearbySolids(probe).some(o=>this.carPos.y<o.y+o.height-.035&&this.overlaps(probe,o,.46)))desired={...current};current=desired;}
    return {x:current.x,z:current.z,hit,nx,nz};
  }
  nudgeFromWall(old,motion){
    if(!motion.hit){this.wallContactTime=Math.max(0,this.wallContactTime-.08);return;}
    const intended=Math.hypot(this.carPos.x-old.x,this.carPos.z-old.z);this.wallContactTime+=1/60;const n=Math.hypot(motion.nx,motion.nz)||1;this.wallContactNormal.set(motion.nx/n,motion.nz/n);
    if(this.wallContactTime>.38&&Math.abs(this.carSpeed)>2){const road=this.snapRoad(this.carPos),tx=road.x-this.carPos.x,tz=road.z-this.carPos.z,tl=Math.hypot(tx,tz);if(tl>.05){const amount=Math.min(1.35,tl);this.carPos.x+=tx/tl*amount;this.carPos.z+=tz/tl*amount;}else{this.carPos.x+=this.wallContactNormal.x*.8;this.carPos.z+=this.wallContactNormal.y*.8;}this.wallContactTime=0;this.showStatusToast('擦牆脫困 · 繼續衝！');}
  }
  buildRideParks(){
    // Low terraces, roofs and their approach ramps share one collision/ride surface.
    this.ridePlatforms=[];const deck=this.mat('ride-deck',0xffffff,'tile'),edge=this.mat('ride-edge',0xf4c44c);
    for(const s of this.segments.filter(s=>Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)>100)){
      const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),rx=dz/len,rz=-dx/len;
      let p=null;search:for(const frac of [.35,.65,.5])for(const side of [1,-1])for(const offset of [30,38,46]){const x=s.a.x+dx*frac+rx*offset*side,z=s.a.z+dz*frac+rz*offset*side,q={x,z,w:12,d:18,height:2.2,angle,y:this.getTerrainHeight(x,z),kind:'terrace'};if(this.isReservedSite?.(q)||this.riverDistance(x,z)<58||this.closestRawRoad(q).distance<17||[...this.nearbyRectSolids(q,4)].some(o=>this.rectsOverlap(q,o,2))||this.customers.some(c=>Math.hypot(x-c.group.position.x,z-c.group.position.z)<25))continue;p=q;break search;}
      if(!p)continue;const {x,z}=p;
      const g=new THREE.Group();g.position.set(x,p.y,z);g.rotation.y=angle;this.box(g,12,2.2,18,deck,0,1.1,0);this.box(g,12,.12,.3,edge,0,2.22,8.85);this.box(g,12,.12,.3,edge,0,2.22,-8.85);
      const label=this.makeLabel('便當不落地\n屋頂捷徑・跳上來！','#ffd564');label.position.set(0,4.5,0);g.add(label);this.scene.add(g);p.group=g;this.ridePlatforms.push(p);this.streetSolids.push(p);this.addSpatialSolid(p);
      const r={x:x-Math.sin(angle)*15,z:z-Math.cos(angle)*15,w:5,d:12,height:2.2,angle,y:p.y,id:'park-ramp'+this.ridePlatforms.length};
      const geo=new THREE.BufferGeometry(),w=r.w/2,d=r.d/2,h=r.height;geo.setAttribute('position',new THREE.Float32BufferAttribute([-w,0,-d,-w,h,d,w,0,-d,w,0,-d,-w,h,d,w,h,d],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,0,1,0,0,1,1,1],2));geo.computeVertexNormals();const rg=new THREE.Group();rg.position.set(r.x,r.y,r.z);rg.rotation.y=angle;this.mesh(rg,geo,this.mat('ramp',0xffffff,'ramp'));this.scene.add(rg);r.group=rg;this.ramps.push(r);
      if(this.ridePlatforms.length>=10)break;
    }
    this.indexStreetSolids();
  }
  rideSurface(p,ceiling=Infinity){
    let y=this.getTerrainHeight(p.x,p.z)+.16;
    for(const o of this.nearbySolids(p)){const top=o.y+o.height+.16;if(this.overlaps(p,o,-.15)&&top<=ceiling+.08)y=Math.max(y,top);}
    for(const o of this.rideSlabs){const top=o.y+o.height+.16;if(Math.abs(p.x-o.x)<o.w+o.d&&Math.abs(p.z-o.z)<o.w+o.d&&this.overlaps(p,o,-.1)&&top<=ceiling+.08)y=Math.max(y,top);}
    return y;
  }
  ceilingHit(oldY){
    const riderTop=1.52,prevTop=oldY+riderTop,newTop=this.carPos.y+riderTop;
    let hit=null,bottom=Infinity;
    for(const o of this.ceilingSlabs){if(!this.overlaps(this.carPos,o,-.12))continue;const b=o.ceilingBottom??(o.y+o.height-.02),t=b+(o.ceilingThickness||.28);if(prevTop<=b+.05&&newTop>=b-.02&&this.carPos.y<t&&b<bottom){bottom=b;hit=o;}}
    if(!hit)return false;
    this.carPos.y=bottom-riderTop-.02;this.carVy=this.carVy>0?-Math.max(2.6,this.carVy*.36):-1.8;this.hit('撞到'+(hit.tag||'騎樓'));return true;
  }
  spawnCivilianTraffic(){
    this.traffic=[];const mix=['sedan','taxi','hatch','sedan','suv','taxi','bus','van'];
    for(let i=0;i<40;i++){const type=mix[i%mix.length],group=this.makeTaipeiCar(type,i);this.scene.add(group);this.traffic.push({group,type,speed:6+i%5,dir:1,isPassed:false});}
  }
  spawnScooters(){
    super.spawnScooters();
    for(const [i,s] of this.scooters.entries()){
      const old=s.group.children[0];s.group.remove(old);old.geometry.dispose();old.material.dispose();
      const body=this.mesh(s.group,new THREE.SphereGeometry(1,12,8),this.mat('traffic-bike'+i%4,[0xf3d056,0x347c83,0xb84243,0xd7dfda][i%4]),0,.54,-.1);body.scale.set(.4,.29,.83);
      const front=this.mesh(s.group,new THREE.SphereGeometry(1,12,8),body.material,0,.76,.66);front.scale.set(.31,.52,.14);
      this.box(s.group,.38,.12,.65,this.mat('traffic-bike-seat',0x293540),0,.9,-.27);
      this.mesh(s.group,new THREE.SphereGeometry(.11,8,6),this.mat('car-headlight',0xfff3bb),0,1.1,.79);
      this.mergeStaticMeshes(s.group);
    }
  }
  mergeStaticMeshes(group){
    // One mesh per material keeps detailed parked/traffic vehicles practical on phones.
    group.updateMatrixWorld(true);const buckets=new Map(),remove=[],inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
    group.traverse(o=>{if(!o.isMesh)return;remove.push(o);const m=o.material;if(!buckets.has(m.uuid))buckets.set(m.uuid,{material:m,parts:[]});const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));buckets.get(m.uuid).parts.push(geo);});
    for(const o of remove)o.parent?.remove(o);
    for(const {material,parts} of buckets.values()){const geo=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const count=parts.reduce((n,p)=>n+p.attributes.position.count,0),size=name==='uv'?2:3,a=new Float32Array(count*size);let offset=0;for(const p of parts){const src=p.attributes[name];if(src)a.set(src.array,offset);offset+=p.attributes.position.count*size;}geo.setAttribute(name,new THREE.BufferAttribute(a,size));}geo.computeBoundingSphere();this.mesh(group,geo,material);parts.forEach(g=>g.dispose());}
  }
  makeTaipeiCar(type,seed){
    const g=new THREE.Group(),bus=type==='bus',van=type==='van',suv=type==='suv',hatch=type==='hatch',w=bus?2.4:van?2.05:1.9,l=bus?9:van?5:hatch?3.7:4.5,h=bus?3:van?2.3:suv?1.8:1.5;
    const paint=this.mat('car-paint-'+type+seed%4,type==='taxi'?0xffc531:bus?[0xeaf0e9,0x419d8b][seed%2]:[0xe6e8e4,0x334759,0x929b9d,0x9e363c][seed%4]);paint.roughness=.29;paint.metalness=.35;
    const glass=this.mat('car-glass',0x254858);glass.roughness=.14;glass.metalness=.4;const black=this.mat('car-rubber',0x17202a),chrome=this.mat('car-chrome',0xadb8b9);chrome.metalness=.7;
    const profile=(points,width,material,key)=>{this.carGeometries=this.carGeometries||new Map();let geo=this.carGeometries.get(key);if(!geo){const sh=new THREE.Shape();points.forEach(([z,y],i)=>i?sh.lineTo(z,y):sh.moveTo(z,y));sh.closePath();geo=new THREE.ExtrudeGeometry(sh,{depth:width,bevelEnabled:true,bevelThickness:.06,bevelSize:.09,bevelSegments:3,steps:1,curveSegments:4});geo.rotateY(Math.PI/2);geo.translate(-width/2,0,0);geo.computeVertexNormals();this.carGeometries.set(key,geo);}return this.mesh(g,geo,material);};
    profile([[-l/2+.25,.33],[-l/2,.57],[-l/2+.15,.87],[l/2-.15,.87],[l/2, .57],[l/2-.22,.33]],w,paint,type+'-body');
    profile(bus||van?[[-l/2+.35,.85],[-l/2+.4,h-.12],[-l/2+.6,h],[l/2-.4,h],[l/2-.25,.85]]:[[-l/2+.65,.84],[-.9,h-.08],[-.65,h],[.65,h],[1.25,.86]],w*.88,paint,type+'-cabin');
    const wheelGeo=new THREE.CylinderGeometry(.34,.34,.22,16);wheelGeo.rotateZ(Math.PI/2);for(const x of [-w/2,w/2])for(const z of [-l*.31,l*.31]){const tyre=this.mesh(g,wheelGeo,black,x,.34,z);const hub=this.mesh(tyre,new THREE.CylinderGeometry(.19,.19,.24,12).rotateZ(Math.PI/2),chrome);}
    for(const side of [-1,1]){
      if(bus||van){for(let z=-l/2+.9;z<l/2-.8;z+=bus?1.1:1.25)this.box(g,.035,h*.32,.85,glass,side*(w*.445+.07),h*.71,z);}
      else{for(const z of [-.5,.43]){const window=this.box(g,.04,.42,.72,glass,side*w*.445,h-.33,z);window.rotation.x=z<0?-.08:.05;}this.box(g,.045,.05,2.5,chrome,side*(w/2+.06),.82,0);}
      this.mesh(g,new THREE.SphereGeometry(.15,10,7),paint,side*(w/2+.12),1.02,l*.18).scale.set(1,.55,1.6);
      this.box(g,.045,.035,.18,chrome,side*(w*.445+.09),.91,-.3);
    }
    const wind=this.box(g,w*.79,bus?.7:.47,.05,glass,0,bus?2.25:h-.33,l/2-(bus?.27:1.12));wind.rotation.x=bus?0:-.5;
    this.box(g,w*.8,.27,.04,glass,0,h-.31,-l/2+(bus?.4:.76));
    for(const x of [-w*.32,w*.32]){this.box(g,.42,.14,.07,this.mat('car-headlight',0xfff3bb),x,.68,l/2+.04);this.box(g,.32,.13,.07,this.mat('car-tail',0xe83340),x,.65,-l/2-.04);}
    this.box(g,w*.57,.16,.07,black,0,.48,l/2+.06);this.box(g,.48,.13,.08,this.mat('car-plate',0xe8efe9),0,.36,l/2+.09);
    if(type==='taxi'){this.box(g,.57,.2,.3,this.mat('taxi-light',0xffec88),0,h+.15,0);const sign=this.makeLabel('小黃\n便當也有座位','#ffe58a');sign.scale.set(.65,.25,1);sign.position.set(0,h+.18,.2);g.add(sign);}
    if(bus){this.box(g,w,.3,l*.97,this.mat('bus-stripe',0x2bafa2),0,1.1,0);const sign=this.makeLabel('307 台北\n司機也想準時吃飯','#ffcc59');sign.scale.set(1.75,.45,1);sign.position.set(0,2.76,l/2+.11);g.add(sign);}
    if(van){const sign=this.makeLabel('湯不要灑\n冷藏配送・熱情駕駛','#b9efe0');sign.scale.set(1.5,.5,1);sign.position.set(0,1.65,-l/2-.13);g.add(sign);}
    g.userData={type,width:w,length:l,height:h};g.name='台北車流 '+type;this.mergeStaticMeshes(g);return g;
  }
  prepareTrafficRoutes(){
    // Traffic follows the same connected intersection graph as delivery navigation.
    const edges=[];this.nodes.forEach((n,id)=>{if(this.components[id]!==this.mainComponent)return;for(const e of n.edges)if(e.d>18)edges.push({from:id,to:e.to});});
    [...this.traffic,...this.scooters].forEach((t,i)=>{const list=t.type==='bus'?edges.filter(e=>this.nodes[e.from].z>-1300&&this.nodes[e.from].z<650&&this.nodes[e.to].z>-1300&&this.nodes[e.to].z<650):edges,edge=list[(i*17+5)%list.length];Object.assign(t,{nodeFrom:edge.from,nodeTo:edge.to,a:this.nodes[edge.from],b:this.nodes[edge.to],progress:(i*.113)%1,wasClose:false});t.length=Math.hypot(t.b.x-t.a.x,t.b.z-t.a.z);this.placeTraffic(t,t.type?2.35:4);});
  }
  placeTraffic(t,lane){const dx=t.b.x-t.a.x,dz=t.b.z-t.a.z;t.group.position.set(t.a.x+dx*t.progress-dz/t.length*lane,0,t.a.z+dz*t.progress+dx/t.length*lane);t.group.position.y=this.getTerrainHeight(t.group.position.x,t.group.position.z)+(t.type?.16:.3);t.group.rotation.y=Math.atan2(dx,dz);}
  advanceTraffic(t,dt,lane){
    // Signalized AI traffic respects lights; the player remains free to blast through them.
    const signal=t.nodeTo!==undefined&&this.signalNodeIds.has(t.nodeTo),dx=t.b.x-t.a.x,dz=t.b.z-t.a.z,axis=Math.abs(dx)>Math.abs(dz)?'ew':'ns';
    const remaining=(1-t.progress)*t.length,state=signal?this.signalState(t.nodeTo,axis):'green',stop=signal&&state!=='green'&&remaining<9.5;
    const approach=signal&&remaining<18?Math.max(.35,remaining/18):1;t.progress+=stop?0:dt*t.speed*approach/t.length;
    if(t.progress>=1&&t.nodeTo!==undefined){const n=this.nodes[t.nodeTo],allowed=t.type==='bus'?n.edges.filter(e=>this.nodes[e.to].z>-1300&&this.nodes[e.to].z<650):n.edges,choices=allowed.filter(e=>e.to!==t.nodeFrom&&e.d>2),list=choices.length?choices:allowed.length?allowed:n.edges;const next=list[Math.floor(this.rand()*list.length)];t.nodeFrom=t.nodeTo;t.nodeTo=next.to;t.a=n;t.b=this.nodes[next.to];t.length=Math.hypot(t.b.x-t.a.x,t.b.z-t.a.z);t.progress=0;t.wasClose=false;}
    else if(t.progress>=1)t.progress%=1;
    this.placeTraffic(t,lane);
  }
  makeParkedScooter(seed=0){
    const g=new THREE.Group(),paint=this.mat('parked-scooter-'+seed%5,[0xc94b42,0x3e7888,0xe0c654,0xd9ded9,0x76577d][seed%5]),dark=this.mat('parked-scooter-dark',0x222e33),metal=this.mat('parked-scooter-metal',0x9aa8a8);
    const body=this.mesh(g,new THREE.SphereGeometry(1,10,7),paint,0,.48,-.08);body.scale.set(.36,.26,.7);const nose=this.mesh(g,new THREE.SphereGeometry(1,10,7),paint,0,.67,.54);nose.scale.set(.28,.42,.13);this.box(g,.33,.1,.56,dark,0,.78,-.25);
    for(const z of [-.58,.58])this.mesh(g,new THREE.TorusGeometry(.22,.065,8,16).rotateY(Math.PI/2),dark,0,.28,z);this.box(g,.42,.035,.035,metal,0,.96,.48);this.mesh(g,new THREE.SphereGeometry(.08,8,6),this.mat('parked-scooter-lamp',0xfff0b6),0,.91,.67);this.mergeStaticMeshes(g);g.userData={width:.72,length:1.55,height:1.1};return g;
  }
  makePedestrian(seed=0){
    const g=new THREE.Group(),shirt=this.mat('ped-shirt-'+seed%6,[0x526f83,0xb85b55,0xd3af50,0x56856f,0x8b678a,0xd6d2c4][seed%6]),pants=this.mat('ped-pants-'+seed%3,[0x29363e,0x3e4851,0x59473d][seed%3]),skin=this.mat('ped-skin',0xd9a67f),hair=this.mat('ped-hair',0x2c2927);
    this.mesh(g,new THREE.CylinderGeometry(.19,.23,.72,8),shirt,0,1.18,0);this.mesh(g,new THREE.SphereGeometry(.19,10,7),skin,0,1.72,0);const cap=this.mesh(g,new THREE.SphereGeometry(.195,10,5,0,Math.PI*2,0,Math.PI/2),hair,0,1.78,0);for(const side of [-1,1]){const leg=this.mesh(g,new THREE.CylinderGeometry(.065,.075,.62,7),pants,side*.09,.52,0);leg.rotation.z=side*.08;const arm=this.mesh(g,new THREE.CylinderGeometry(.05,.06,.58,7),shirt,side*.27,1.16,0);arm.rotation.z=side*.18;}
    return g;
  }
  buildObstacles() {
    const rampMat=this.mat('street-ramp',0xffffff,'ramp'),edge=this.mat('stunt-edge',0xe9c14b),asphalt=this.mat('wave-asphalt',0xffffff,'asphalt');
    this.cityObstacles=[];this.ramps=[];this.roadWaves=[];this.parkedVehicles=[];this.pedestrians=[];
    const clearPoint=(p,r=20)=>!this.isReservedSite?.({...p,w:12,d:20,angle:0})&&!this.customers.some(c=>Math.hypot(c.group.position.x-p.x,c.group.position.z-p.z)<r)&&!this.dropoffs.some(d=>Math.hypot(d.pos.x-p.x,d.pos.z-p.z)<r)&&!this.nodes.some(n=>n.edges.length>2&&Math.hypot(n.x-p.x,n.z-p.z)<15);
    for(let i=0;i<this.segments.length;i++){
      const s=this.segments[i],len=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);if(len<52)continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,angle=Math.atan2(dx,dz),rx=dz/len,rz=-dx/len,roadW=(TAIPEI_ROADS[s.ri]?.width||18)/1.7;
      const point=frac=>({x:s.a.x+dx*frac,z:s.a.z+dz*frac});
      // Real Taipei-style curb clutter replaces crates and construction-barrier slaloms.
      if(i%4===0){const p=point(.25+(i%3)*.18),side=i%2?1:-1,offset=Math.max(3.8,roadW/2-1.0),x=p.x+rx*offset*side,z=p.z+rz*offset*side;if(clearPoint({x,z},16)){const type=['sedan','hatch','taxi','suv'][i%4],g=this.makeTaipeiCar(type,100+i);g.scale.setScalar(.94);g.position.set(x,this.getTerrainHeight(x,z)+.02,z);g.rotation.y=angle+(side<0?Math.PI:0);this.scene.add(g);const size=g.userData,o={id:'park-car'+i,x,z,w:size.width*.94,d:size.length*.94,height:size.height*.94,y:g.position.y,angle:g.rotation.y,kind:'parked-car',group:g,knocked:false};this.cityObstacles.push(o);this.parkedVehicles.push(o);}}
      if(i%4===2){const p=point(.42),side=i%2?1:-1,offset=Math.max(4.1,roadW/2-.55),x=p.x+rx*offset*side,z=p.z+rz*offset*side;if(clearPoint({x,z},14)){const g=this.makeParkedScooter(i);g.position.set(x,this.getTerrainHeight(x,z),z);g.rotation.y=angle+(side<0?Math.PI:0)+(this.rand()-.5)*.18;this.scene.add(g);const o={id:'park-scooter'+i,x,z,w:.72,d:1.55,height:1.1,y:g.position.y,angle:g.rotation.y,kind:'parked-scooter',group:g,knocked:false};this.cityObstacles.push(o);this.parkedVehicles.push(o);}}
      // Frequent but readable jump ramps: placed in a lane, never as a full-road barricade.
      if(i%3===0&&len>70){const p=point(.62),side=i%2?1:-1,x=p.x+rx*2.45*side,z=p.z+rz*2.45*side;if(clearPoint({x,z},19)){const r={x,z,w:4.25,d:9.5,height:1.45+(i%4)*.16,angle,y:this.getTerrainHeight(x,z),id:'street-ramp'+i,launch:11.5+(i%3)*.8};const hw=r.w/2,hd=r.d/2,geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-hw,0,-hd,-hw,r.height,hd,hw,0,-hd,hw,0,-hd,-hw,r.height,hd,hw,r.height,hd],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,1,0,1,0,0,1,1,1],2));geo.computeVertexNormals();const g=new THREE.Group();g.position.set(x,r.y,z);g.rotation.y=angle;this.mesh(g,geo,rampMat);this.box(g,.16,.12,r.d,edge,-hw+.12,r.height*.48,0);this.box(g,.16,.12,r.d,edge,hw-.12,r.height*.48,0);this.scene.add(g);r.group=g;this.ramps.push(r);}}
      // Broad up/down crests give the city a roller-coaster rhythm without looking like road debris.
      if(i%7===1&&len>92){const p=point(.34),x=p.x,z=p.z;if(clearPoint(p,18)){const w=Math.min(8.5,Math.max(6.2,roadW*.72)),d=18,h=1.0+(i%3)*.28,hw=w/2,hd=d/2,geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-hw,0,-hd,-hw,h,0,hw,0,-hd, hw,0,-hd,-hw,h,0,hw,h,0, -hw,h,0,-hw,0,hd,hw,h,0, hw,h,0,-hw,0,hd,hw,0,hd],3));geo.computeVertexNormals();const g=new THREE.Group();g.position.set(x,this.getTerrainHeight(x,z)+.015,z);g.rotation.y=angle;this.mesh(g,geo,asphalt);for(const sx of [-hw+.16,hw-.16])this.box(g,.12,.05,d,edge,sx,h*.48,0);this.scene.add(g);this.roadWaves.push({x,z,w,d,height:h,angle,y:this.getTerrainHeight(x,z),group:g,id:'road-wave'+i});}}
      // Sidewalk life and occasional crosswalk walkers; they dodge the player instead of becoming violent collision props.
      if(i%6===2){const p=point(.52),side=i%2?1:-1,offset=roadW/2+1.65,x=p.x+rx*offset*side,z=p.z+rz*offset*side;if(clearPoint({x,z},12)){const g=this.makePedestrian(i);g.position.set(x,this.getTerrainHeight(x,z),z);g.rotation.y=angle+(side>0?Math.PI:0);this.scene.add(g);this.pedestrians.push({group:g,x,z,baseX:x,baseZ:z,angle,sway:(i%5)*.7,speed:.35+(i%4)*.08,avoid:0});}}
    }
  }
  setupRoadPresentation() {
    // Only destination markers; old duplicate lane meshes and tall beam are intentionally retired.
    this.scene.fog.density=.00058;
    this.bikeShadow=this.mesh(this.scene,new THREE.CircleGeometry(1.1,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x102730,transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));this.bikeShadow.scale.set(.7,1,1.5);
    this.destBeam.children.forEach(m=>m.visible=false);const ring=this.mesh(this.destBeam,new THREE.RingGeometry(7.5,9,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffd260,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));this.deliveryGroundRing=ring;ring.visible=false;
    const marker=this.makeLabel('DELIVERY / 交付區','#ffd260');marker.position.set(0,7,0);this.destBeam.add(marker);
  }
  buildStuntRig() {
    // Move every motorcycle component under one pivot so both wheels, rider and cargo pitch together.
    this.bikeRig=new THREE.Group();const children=[...this.carGroup.children];children.forEach(c=>this.bikeRig.add(c));this.carGroup.add(this.bikeRig);
    this.exhaustFlames.forEach(f=>f.visible=false);this.exhaustFlames=[];
    const pipe=this.mesh(this.bikeRig,new THREE.CylinderGeometry(.09,.12,.72,10).rotateX(Math.PI/2),this.mat('pipe',0x718d98),.39,.4,-.65);
    for(const [r,len,color] of [[.19,1.55,0xff6433],[.105,1.15,0xffe8a1],[.07,.68,0x7df1ff]]){const flame=this.mesh(this.bikeRig,new THREE.ConeGeometry(r,len,10).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}),.39,.4,-1.1-len/2);flame.frustumCulled=false;this.exhaustFlames.push(flame);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(64*3),3));this.sparkPositions=geo.attributes.position;this.sparkLives=new Float32Array(64);this.sparkVelocities=Array.from({length:64},()=>new THREE.Vector3());this.sparks=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffd9a1,size:.15,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));this.sparks.frustumCulled=false;this.scene.add(this.sparks);this.sparkCursor=0;
  }
  updateNavigation() {
    super.updateNavigation();if(this.deliveryGroundRing&&this.activeCustomer){const center=this.destBeam.position,positions=this.deliveryGroundRing.geometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,this.getTerrainHeight(center.x+x,center.z+z)-center.y+.34);}positions.needsUpdate=true;this.deliveryGroundRing.geometry.computeBoundingSphere();}
  }
  relocateOrders() {
    super.relocateOrders();this.customers.forEach(c=>{const p=c.ring.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,this.getTerrainHeight(c.group.position.x+x,c.group.position.z+z)-c.group.position.y);}p.needsUpdate=true;});
  }
  buildPlayerTaxi() {
    this.carGroup=new THREE.Group();this.chassisMesh=new THREE.Group();this.carGroup.add(this.chassisMesh);
    this.chassisMat=new THREE.MeshStandardMaterial({color:this.currentDriver.color,roughness:.35,metalness:.26});
    const metal=this.mat('bike-chrome',0xafc5cc),dark=this.mat('bike-dark',0x233542),rubber=this.mat('bike-rubber',0x111c24),fabric=this.mat('rider-fabric',0xf3e7c8),pants=this.mat('rider-pants',0x294a59),skin=this.mat('rider-skin',0xe6b28c);
    metal.roughness=.3;metal.metalness=.7;
    const sphere=(r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=this.mesh(this.chassisMesh,new THREE.SphereGeometry(r,16,12),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
    const rod=(a,b,r,mat)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),m=this.mesh(this.chassisMesh,new THREE.CylinderGeometry(r,r*.95,delta.length(),10),mat);m.position.copy(from.add(to).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
    sphere(.5,this.chassisMat,0,.69,.12,.6,.62,1.32);sphere(.34,dark,0,1.02,-.2,.9,.24,1.35);
    sphere(.32,this.chassisMat,0,.87,.65,.86,1.35,.64);this.box(this.chassisMesh,.38,.12,.62,dark,0,.43,.28);
    for(const z of [-.88,.87]){const tyre=this.mesh(this.carGroup,new THREE.TorusGeometry(.285,.095,10,24).rotateY(Math.PI/2),rubber,0,.39,z);this.wheels=this.wheels||[];this.wheels.push(tyre);const rim=this.mesh(tyre,new THREE.TorusGeometry(.215,.035,6,20).rotateY(Math.PI/2),metal);for(let a=0;a<Math.PI*2;a+=Math.PI/4){const spoke=this.mesh(tyre,new THREE.BoxGeometry(.04,.43,.025),metal);spoke.rotation.x=a;}this.mesh(tyre,new THREE.CylinderGeometry(.055,.055,.23,8).rotateZ(Math.PI/2),metal);}
    for(const x of [-.14,.14]){rod([x,.4,.87],[x,1.12,.54],.035,metal);rod([x,.4,-.88],[x,.75,-.25],.05,metal);}
    rod([-.36,1.2,.53],[.36,1.2,.53],.03,dark);rod([0,1.03,.56],[0,1.2,.53],.04,metal);
    for(const side of [-1,1]){rod([side*.3,1.19,.53],[side*.36,1.42,.46],.018,metal);sphere(.06,dark,side*.38,1.43,.46,1.8,1.1,.3);}
    sphere(.17,this.mat('lamp-lens',0xffeac2),0,1.04,.88,1.35,.8,.22);
    this.box(this.chassisMesh,.23,.12,.04,this.mat('tail-lamp',0xf94740),0,.69,-1.08);
    // Rounded clothing volumes and visible joints replace the original box-like person.
    const torso=sphere(.3,fabric,0,1.4,-.04,.82,1.2,.7);torso.rotation.x=.17;
    const vest=sphere(.3,this.chassisMat,0,1.4,-.1,.85,1.07,.7);vest.rotation.x=.15;
    this.box(this.chassisMesh,.44,.045,.025,this.mat('reflective-tape',0xf1f6d5),0,1.4,-.32);
    this.box(this.chassisMesh,.03,.53,.018,dark,0,1.42,.145);
    for(const side of [-1,1]){const x=side*.18;rod([x,1.1,-.19],[side*.23,.77,.08],.1,pants);sphere(.11,pants,side*.23,.77,.08);rod([side*.23,.77,.08],[side*.24,.44,.25],.082,pants);sphere(.12,dark,side*.24,.43,.31,.8,.6,1.6);
      rod([side*.22,1.55,.02],[side*.29,1.31,.26],.075,fabric);sphere(.08,fabric,side*.29,1.31,.26);rod([side*.29,1.31,.26],[side*.31,1.21,.53],.063,fabric);sphere(.072,dark,side*.31,1.21,.53,1,1,1.2);}
    rod([0,1.62,.01],[0,1.77,.05],.09,skin);sphere(.225,skin,0,1.91,.065,.92,1.02,.92);
    this.mesh(this.chassisMesh,new THREE.SphereGeometry(.278,20,12,0,Math.PI*2,0,Math.PI*.63),this.chassisMat,0,1.95,.035);
    const visor=this.mesh(this.chassisMesh,new THREE.SphereGeometry(.282,20,8,0,Math.PI,Math.PI*.35,Math.PI*.24),this.mat('visor',0x234c61),0,1.95,.05);visor.material.roughness=.18;visor.material.metalness=.45;
    sphere(.04,skin,0,1.91,.267,.7,.8,1);this.box(this.chassisMesh,.28,.035,.015,this.mat('helmet-stripe',0xf4f4cf),0,2.16,.18);
    this.box(this.chassisMesh,.68,.58,.63,this.mat('delivery-bag',0x17ad9e),0,1.32,-.88);this.box(this.chassisMesh,.74,.08,.68,dark,0,1.64,-.88);
    for(const x of [-.29,.29])this.box(this.chassisMesh,.03,.6,.65,this.mat('bag-reflector',0xe4eabd),x,1.31,-.88);
    const badge=this.streetShopSign(11),m=this.mesh(this.chassisMesh,new THREE.PlaneGeometry(.6,.16),badge,0,1.35,-1.203);m.rotation.y=Math.PI;
    this.taxiSign=new THREE.Object3D();this.exhaustFlames=[];this.scene.add(this.carGroup);
  }
  showExhaustFlames(){this.flameFlash=.75;}
  startGame() {
    this.autoReverse=false;this.reverseHold=0;this.manualGear=1;this.shiftWindow=-99;this.shiftDip=0;this.jumpCooldown=0;this.boostCooldown=0;this.airTime=0;this.airDistance=0;this.airCleared.clear();this.wheelieAngle=0;this.wheelieTime=0;this.flameFlash=0;this.wallContactTime=0;this.cameraKick=0;this.stuntStats={jumps:0,clearances:0,wheelies:0,boosts:0};this.stuntSpeechAt=-99;this.maxJumpDistance=0;
    this.steerInput=0;this.cityObstacles.forEach(o=>{o.knocked=false;o.group.position.set(o.x,o.y,o.z);o.group.rotation.set(0,o.angle,0);});
    super.startGame();this.carGroup.position.copy(this.carPos);this.carGroup.rotation.y=this.carRotY;if(this.bikeRig)this.bikeRig.rotation.set(0,0,0);this.currentGear=this.isManualShift?'1':'D';this.refreshGearUI();
    this.showStatusToast('↑ 油門 · ← → 轉向 · Space 跳 · E 氮氣加速');
  }
  handleKeyDown(e) {
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ControlLeft','ControlRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
    if(this.gameState==='PLAYING'&&!e.repeat){
      if(e.code==='KeyA'||e.code==='KeyZ'){this.shiftGear(e.code==='KeyA'?1:-1);return;}
      if(e.code==='Space'){this.keys.Space=true;this.tryJump();return;}
      if(e.code==='KeyT'){this.autoReverse=false;this.reverseHold=0;this.isManualShift=!this.isManualShift;this.manualGear=1;this.currentGear=this.isManualShift?'1':'D';this.shiftWindow=-99;this.refreshGearUI();this.showStatusToast(this.isManualShift?'手排 · A 升檔 / Z 降檔':'自排 · A 前進 / Z 倒車');return;}
    }
    super.handleKeyDown(e);
  }
  shiftGear(direction) {
    if(this.gameState!=='PLAYING')return;
    this.autoReverse=false;this.reverseHold=0;
    // Gear selection only: no reverse/drive sequence activates a power move.
    this.shiftWindow=-99;
    if(this.isManualShift){this.manualGear=Math.max(-1,Math.min(4,this.manualGear+direction));this.currentGear=this.manualGear===-1?'R':this.manualGear===0?'N':String(this.manualGear);this.shiftDip=.09;}
    else this.currentGear=direction>0?'D':'R';
    this.refreshGearUI();
  }
  refreshGearUI() {
    document.getElementById('btn-toggle-shift-mode').textContent='排檔：'+(this.isManualShift?'手排':'自排');
    document.getElementById('gear-d').textContent=this.isManualShift?(this.manualGear>0?this.manualGear:'N'):'D';
    document.getElementById('gear-r').textContent='R';document.getElementById('gear-d').className='gear-item'+(this.currentGear!=='R'?' active-d':'');document.getElementById('gear-r').className='gear-item'+(this.currentGear==='R'?' active-r':'');document.getElementById('gear-label').textContent=this.isManualShift?'MANUAL / 手排':'AUTO / ↓ 倒車';
  }
  triggerDash(source='button') {
    const cost=this.currentDriver.perk?.boostCost||35;
    if(this.gameState!=='PLAYING'||this.boost<cost||this.boostCooldown>0||this.dashTime>0)return false;
    this.autoReverse=false;this.reverseHold=0;this.boost-=cost;this.boostCooldown=1.25;this.dashTime=1.05;this.carSpeed=Math.max(this.carSpeed,22);this.currentGear=this.isManualShift?String(Math.max(1,this.manualGear)):'D';
    if(this.isManualShift&&this.manualGear<1)this.manualGear=1;
    this.audio.playBoost();this.showExhaustFlames();this.stuntStats.boosts++;this.showComboBanner('氮氣爆發！','stunt-courier-dash');this.stuntMessage('boost');return true;
  }
  tryJump(velocity=10.5,ramp=false) {
    if(this.gameState!=='PLAYING'||!this.isGrounded||this.jumpCooldown>0)return false;
    velocity=(velocity+(ramp?0:Math.min(3.5,Math.abs(this.carSpeed)*.12)))*(this.currentDriver.perk?.jump||1);
    this.isGrounded=false;this.carVy=velocity;this.jumpCooldown=.65;this.airTime=0;this.airDistance=0;this.airCleared.clear();this.stuntStats.jumps++;this.airStart=this.carPos.clone();
    this.audio.playBoost();this.showComboBanner(ramp?'飛躍跳台！':'單輪彈跳！','stunt-courier-through');this.stuntMessage('jump');return true;
  }
  pollGamepad() {
    super.pollGamepad();const p=Array.from(navigator.getGamepads?navigator.getGamepads():[]).find(Boolean);if(!p)return;
    const jump=!!p.buttons[2]?.pressed;if(jump&&!this.padJump)this.tryJump();this.padJump=jump;this.padWheelie=!!p.buttons[3]?.pressed;
    const up=!!p.buttons[5]?.pressed,down=!!p.buttons[4]?.pressed;if(up&&!this.padShiftUp)this.shiftGear(1);if(down&&!this.padShiftDown)this.shiftGear(-1);this.padShiftUp=up;this.padShiftDown=down;
  }
  hit(label){
    if(this.collisionCooldown>0)return;const before=this.carSpeed,soft=/牆面|停車|路邊|機車|車流/.test(label),damage=(soft?6:12)*(this.currentDriver.perk?.cargo||1);
    this.collisionCooldown=soft?.62:.9;this.comboCount=0;this.comboTTL=0;if(this.activeCustomer){this.integrity=Math.max(0,this.integrity-damage);this.customerMessage('crash');}this.audio.playCrash();this.showStatusToast(label+(this.activeCustomer?' · 貨物完整度 −'+damage+'%':''));this.carSpeed=before*(soft?.38:.28);this.cameraKick=Math.min(.55,(this.cameraKick||0)+.28);
  }
  updateVehiclePhysics(dt) {
    this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);this.boostCooldown=Math.max(0,this.boostCooldown-dt);this.shiftDip=Math.max(0,this.shiftDip-dt);
    const rawSteer=(this.keys.ArrowRight||this.keys.KeyL?1:0)-(this.keys.ArrowLeft||this.keys.KeyJ?1:0)+(this.padConnected?this.padSteer:0);
    this.steerInput=(this.steerInput||0)+(Math.max(-1,Math.min(1,rawSteer))-(this.steerInput||0))*(1-Math.exp(-dt*26));const steer=this.steerInput;
    const gas=!!(this.keys.ArrowUp||this.keys.KeyW)||(this.padConnected&&this.padGas>.15),brake=!!(this.keys.ArrowDown||this.keys.KeyS)||(this.padConnected&&this.padBrake>.15);
    const driftKey=this.keys.ControlLeft||this.keys.ControlRight||this.padConnected&&this.padDrift;
    let drifting=!!driftKey&&Math.abs(steer)>.1&&this.carSpeed>10&&this.isGrounded;
    const perk=this.currentDriver.perk||{};
    this.boost=Math.min(100,this.boost+dt*12*(perk.charge||1));this.dashTime=Math.max(0,this.dashTime-dt);
    const max=this.currentDriver.topSpeed/3.6;const limits=[0,13,20,27,35];const gearMax=this.isManualShift&&this.manualGear>0?Math.min(max,limits[this.manualGear]):max;
    const v2=this.handlingMode==='ARCADE_V2';
    const throttle=v2&&!(this.keys.ArrowUp||this.keys.KeyW)&&this.padConnected?Math.max(0,Math.min(1,this.padGas)):1;
    const accel=(v2?HandlingV2.acceleration(this.carSpeed,gearMax)*throttle:1)*this.currentDriver.accel/90*15*(this.isManualShift?Math.max(.6,1.35-this.manualGear*.17):1);
    if(brake){
      this.dashTime=0;
      if(this.carSpeed>.05){this.carSpeed=Math.max(0,this.carSpeed-34*dt);this.reverseHold=0;}
      else if(this.isManualShift){this.carSpeed=Math.min(0,this.carSpeed+24*dt);}
      else {this.reverseHold=(this.reverseHold||0)+dt;if(this.reverseHold>=.82||this.autoReverse){if(!this.autoReverse){this.currentGear='R';this.autoReverse=true;this.refreshGearUI();}this.carSpeed=Math.max(-8,this.carSpeed-8*dt);}}
    }
    else if(gas&&this.shiftDip<=0){this.reverseHold=0;if(this.autoReverse){this.currentGear='D';this.autoReverse=false;this.refreshGearUI();}if(this.currentGear==='R')this.carSpeed-=this.carSpeed>0?24*dt:8*dt;else if(this.currentGear!=='N')this.carSpeed+=this.carSpeed<0?24*dt:accel*dt;}
    else this.carSpeed*=Math.exp(-(this.isGrounded?.55:.14)*dt);
    if(!brake)this.reverseHold=0;
    if(this.dashTime>0)this.carSpeed+=32*dt;
    // Downshifts use engine braking rather than an instantaneous speed snap.
    const cap=this.dashTime>0?max*1.7:gearMax;if(this.carSpeed>cap)this.carSpeed=Math.max(cap,this.carSpeed-11*dt);this.carSpeed=Math.max(-8,Math.min(max*1.7,this.carSpeed));
    const speedRatio=Math.min(Math.abs(this.carSpeed)/6,1),airControl=this.isGrounded?1:.55*(perk.air||1);
    if(v2)drifting=HandlingV2.update(this,dt,steer,driftKey,perk);
    else {
    this.carRotY-=Math.max(-1,Math.min(1,steer))*this.currentDriver.steerRate*.68*speedRatio*dt*(this.carSpeed>=0?1:-1)*(drifting?1.65*(perk.drift||1):1-.20*Math.min(1,Math.abs(this.carSpeed)/max))*airControl;
    let diff=Math.atan2(Math.sin(this.carRotY-this.heading),Math.cos(this.carRotY-this.heading));this.heading+=diff*Math.min(dt*(drifting?3:14*(perk.grip||1)),1);this.driftFactor=drifting?Math.min(1,this.driftFactor+dt*4):Math.max(0,this.driftFactor-dt*4);
    }
    if(drifting&&(!v2||Math.abs(steer)>ARCADE_HANDLING_V2.driftInput)){this.driftTime+=dt;if(this.driftTime>=.85){this.addTip(18);this.showComboBanner('甩尾快送！','stunt-courier-drift');this.customerMessage('drift');this.driftTime=0;}}else this.driftTime=0;
    const old=this.carPos.clone(),driveTarget={x:old.x+Math.sin(this.heading)*this.carSpeed*dt,z:old.z+Math.cos(this.heading)*this.carSpeed*dt};const motion=this.sweepStaticMotion(old,driveTarget);this.carPos.x=motion.x;this.carPos.z=motion.z;if(motion.hit){this.hit('擦撞牆面！');this.nudgeFromWall(old,motion);}else this.wallContactTime=Math.max(0,this.wallContactTime-dt*2.5);
    const ground=this.rideSurface(this.carPos,old.y);let rampHeight=0;
    for(const r of this.ramps){const p=this.localXZ(this.carPos,r),d=r.d||8;if(Math.abs(p.x)<r.w/2&&p.z>-d/2&&p.z<d/2+.5){const rampTop=(r.y??this.getTerrainHeight(r.x,r.z))+.16+Math.max(0,Math.min(1,(p.z+d/2)/d))*r.height;rampHeight=Math.max(rampHeight,rampTop-ground);const forward=Math.cos(this.heading-r.angle)*this.carSpeed;if(this.isGrounded&&p.z>d/2-.8&&forward>9){this.carPos.y=Math.max(this.carPos.y,ground+rampHeight);this.tryJump(r.launch||13,true);}}}
    for(const w of this.roadWaves){const p=this.localXZ(this.carPos,w);if(Math.abs(p.x)<w.w/2&&p.z>-w.d/2&&p.z<w.d/2){const t=(p.z+w.d/2)/w.d,profile=t<.5?t*2:(1-t)*2;rampHeight=Math.max(rampHeight,w.height*Math.max(0,profile));}}
    const support=ground+Math.max(0,rampHeight);
    if(this.isGrounded&&old.y-support>.6){this.isGrounded=false;this.carVy=0;this.airTime=0;this.airDistance=0;this.airCleared.clear();}
    if(this.isGrounded)this.carPos.y=support;
    else {this.carVy-=23*dt;this.carPos.y+=this.carVy*dt;this.airTime+=dt;this.airDistance+=Math.hypot(this.carPos.x-old.x,this.carPos.z-old.z);if(this.carPos.y<=support&&this.carVy<0){this.carPos.y=support;this.landJump();}else this.ceilingHit(old.y);}
    const road=this.snapRoad(this.carPos);if(this.isGrounded&&road.distance>13)this.carSpeed*=Math.exp(-.45*(perk.terrain||1)*dt);
    if(Math.abs(this.carPos.x)>3800||Math.abs(this.carPos.z)>3800){this.carPos.copy(old);this.carSpeed=0;this.showStatusToast('到達遊戲地圖邊界');}
    for(const o of this.cityObstacles){if(o.knocked||!this.overlaps(this.carPos,o,.5))continue;const clearance=this.carPos.y-(o.y+.16);if(!this.isGrounded&&clearance>o.height+.15){this.airCleared.add(o.id);continue;}
      if(o.kind==='cone'||o.kind==='parked-scooter'){o.knocked=true;o.knockedAt=this.elapsed;o.kickAngle=this.heading;this.audio.playHorn(650);this.addTip(o.kind==='parked-scooter'?6:0);}else {const r=this.resolveRectPoint(old,this.carPos,o,.48);if(r){this.carPos.x=r.x;this.carPos.z=r.z;}this.hit(o.kind==='parked-car'?'擦撞路邊停車':o.kind==='barrier'?'碰撞施工護欄':'碰撞路邊障礙');}}
    this.distanceDriven+=Math.hypot(this.carPos.x-old.x,this.carPos.z-old.z);
    const wheelie=!!(this.keys.ShiftLeft||this.keys.ShiftRight||this.padConnected&&this.padWheelie)&&this.carSpeed>8&&this.isGrounded;
    const target=wheelie?.48:!this.isGrounded?.18:0;this.wheelieAngle+=(target-this.wheelieAngle)*(1-Math.exp(-dt*10));
    if(wheelie){this.wheelieTime+=dt;if(this.wheelieTime>=1.8){this.wheelieTime=0;this.stuntStats.wheelies++;this.addTip(24);this.showComboBanner('孤輪快送！','stunt-courier-through');}}else this.wheelieTime=0;
    const fwd=this.getTerrainHeight(this.carPos.x+Math.sin(this.carRotY)*1.2,this.carPos.z+Math.cos(this.carRotY)*1.2),back=this.getTerrainHeight(this.carPos.x-Math.sin(this.carRotY)*1.2,this.carPos.z-Math.cos(this.carRotY)*1.2),slope=this.isGrounded?Math.atan2(fwd-back,2.4):0;
    this.carGroup.position.copy(this.carPos);this.carGroup.position.y+=.88*Math.sin(this.wheelieAngle)+.39*(1-Math.cos(this.wheelieAngle));this.carGroup.rotation.y=this.carRotY;
    if(this.bikeRig){this.bikeRig.rotation.x=-slope-this.wheelieAngle;this.bikeRig.rotation.z=this.reducedMotion?0:steer*(.16+this.driftFactor*.18)*speedRatio;}
    this.chassisMesh.rotation.z=0;this.wheels.forEach(w=>w.rotation.x+=this.carSpeed*dt/.37);this.audio.updateEngine(Math.min(1.2,Math.abs(this.carSpeed)/(this.isManualShift?Math.max(8,gearMax):max)));this.audio.setSkidVolume(drifting?.17:0);
    this.updateEffects(dt);
  }
  landJump() {
    const distance=this.airDistance,count=this.airCleared.size;this.isGrounded=true;this.carVy=0;this.maxJumpDistance=Math.max(this.maxJumpDistance,distance);this.stuntStats.clearances+=count;
    if(distance>4){this.addTip(Math.min(65,Math.round(distance*.9))+count*30);this.showComboBanner((count?'飛越 '+count+' 個障礙！':'漂亮落地！')+' '+Math.round(distance)+' m','stunt-courier-through');}
    this.airCleared.clear();this.airTime=0;
  }
  updateEffects(dt) {
    this.flameFlash=Math.max(0,(this.flameFlash||0)-dt);const on=this.dashTime>0||this.flameFlash>0;
    this.exhaustFlames.forEach((f,i)=>{f.visible=on;f.material.opacity=on?.8:0;f.scale.set(1,1,1+(this.reducedMotion?0:Math.sin(this.elapsed*65+i)*.2));});
    if(this.sparks){if(on&&!this.reducedMotion){for(let k=0;k<2;k++){const i=this.sparkCursor++%64;this.sparkLives[i]=.3+this.rand()*.15;this.sparkPositions.setXYZ(i,this.carPos.x-Math.sin(this.heading)*1.5,this.carPos.y+.4,this.carPos.z-Math.cos(this.heading)*1.5);this.sparkVelocities[i].set(-Math.sin(this.heading)*(3+this.rand()*4),this.rand()*2,-Math.cos(this.heading)*(3+this.rand()*4));}}
      for(let i=0;i<64;i++){this.sparkLives[i]-=dt;if(this.sparkLives[i]>0){const v=this.sparkVelocities[i];this.sparkPositions.setXYZ(i,this.sparkPositions.getX(i)+v.x*dt,this.sparkPositions.getY(i)+v.y*dt,this.sparkPositions.getZ(i)+v.z*dt);}else this.sparkPositions.setXYZ(i,this.carPos.x,-100,this.carPos.z);}this.sparkPositions.needsUpdate=true;}
    this.cityObstacles.forEach(o=>{if(o.knocked){const t=Math.min(1,this.elapsed-o.knockedAt);o.group.rotation.x=t*1.5;o.group.position.x=o.x+Math.sin(o.kickAngle)*t*2;o.group.position.z=o.z+Math.cos(o.kickAngle)*t*2;}});
    this.updateTrafficSignals();
    // Ambient sidewalk motion is independent of the rider; no proximity zones.
    for(const p of this.pedestrians){const sway=Math.sin(this.elapsed*p.speed+p.sway)*1.15;p.group.position.x+=(p.baseX+Math.sin(p.angle)*sway-p.group.position.x)*Math.min(1,dt*3);p.group.position.z+=(p.baseZ+Math.cos(p.angle)*sway-p.group.position.z)*Math.min(1,dt*3);p.group.position.y=this.getTerrainHeight(p.group.position.x,p.group.position.z);}
    if(this.ferrisWheel)this.ferrisWheel.rotation.z=this.elapsed*.025;
    if(this.mrtTrain){const total=this.mrtSegments.reduce((n,s)=>n+s.len,0);let d=(this.elapsed*12)%total;for(const s of this.mrtSegments){if(d>s.len){d-=s.len;continue;}this.mrtTrain.visible=!s.underground;const t=d/s.len,x=s.a.x+(s.b.x-s.a.x)*t,z=s.a.z+(s.b.z-s.a.z)*t;this.mrtTrain.position.set(x,this.getTerrainHeight(x,z)+11.7,z);this.mrtTrain.rotation.y=Math.atan2(s.b.x-s.a.x,s.b.z-s.a.z);break;}}
    if(this.bikeShadow){const h=this.carPos.y-this.getTerrainHeight(this.carPos.x,this.carPos.z);this.bikeShadow.material.opacity=.35/(1+h*.18);this.bikeShadow.scale.set(.7+h*.07,1,1.5+h*.1);}
    const underground=(this.undergroundZones||[]).find(z=>this.overlaps(this.carPos,z,-.2)),inside=!!underground;
    if(inside!==this.inUnderground){this.inUnderground=inside;const cabinet=document.getElementById('cabinet-overlay');if(cabinet){cabinet.classList.toggle('underground',inside);cabinet.querySelector('span').textContent=inside?'UNDERGROUND FEVER / 地下街爆走':'ARCADE CABINET VISION';}
      if(inside){this.showComboBanner('地下街爆走！','stunt-courier-through');this.audio.playHorn(520);if(this.activeCustomer&&this.elapsed-this.lastMessageAt>6){const actor=COURIER_PERSONAS[this.activeCustomer.persona%COURIER_PERSONAS.length],line=COURIER_UNDERGROUND_LINES[this.activeCustomer.persona%COURIER_UNDERGROUND_LINES.length];this.lastMessageAt=this.elapsed;this.messageUntil=this.elapsed+7;this.showPhoneLine(actor,line,'banter',underground.name);}}}
    const fever=this.dashTime>0||Math.abs(this.carSpeed)>28||this.comboCount>=4;const cabinet=document.getElementById('cabinet-overlay');if(cabinet)cabinet.classList.toggle('fever',fever);
    document.getElementById('speed-lines').classList.toggle('active',(on||fever)&&!this.reducedMotion);
  }
  updateCustomers(dt) {
    if(!this.isGrounded){const speed=this.carSpeed;this.carSpeed=Math.abs(speed)+5;super.updateCustomers(dt);this.carSpeed=speed;this.interact=0;}else super.updateCustomers(dt);
  }
  updateCivilianTraffic(dt) {
    // Height-aware collisions: jumping over a car actually clears it.
    this.traffic.forEach(t=>{this.advanceTraffic(t,dt,2.35);
      const d=Math.hypot(this.carPos.x-t.group.position.x,this.carPos.z-t.group.position.z),h=this.carPos.y-this.getTerrainHeight(t.group.position.x,t.group.position.z);
      const q=this.localXZ(this.carPos,{x:t.group.position.x,z:t.group.position.z,angle:t.group.rotation.y}),size=t.group.userData,close=Math.abs(q.x)<size.width/2+.4&&Math.abs(q.z)<size.length/2+.65,top=size.height+.25;
      if(close&&h<top){this.hit('擦撞車流');t.wasClose=true;}else if(close&&!this.isGrounded&&h>=top)this.airCleared.add('traffic'+this.traffic.indexOf(t));else if(d<5&&Math.abs(this.carSpeed)>12&&!t.wasClose){this.addTip(22);this.showComboBanner('擦身快送！','stunt-courier-through');this.customerMessage('near');t.wasClose=true;}if(d>12)t.wasClose=false;});
  }
  updateScooters(dt) {this.scooters.forEach((s,i)=>{this.advanceTraffic(s,dt,4);const d=Math.hypot(this.carPos.x-s.group.position.x,this.carPos.z-s.group.position.z),h=this.carPos.y-this.getTerrainHeight(s.group.position.x,s.group.position.z);if(d<1.2&&h<1.5)this.hit('擦撞機車');else if(d<1.2&&!this.isGrounded&&h>=1.5)this.airCleared.add('scooter'+i);});}
  rescue(){super.rescue();this.autoReverse=false;this.reverseHold=0;this.isGrounded=true;this.carVy=0;this.airCleared.clear();this.wheelieAngle=0;this.wheelieTime=0;}
  stuntMessage(event) {
    if(!this.activeCustomer||this.elapsed-this.stuntSpeechAt<9||this.elapsed-this.lastMessageAt<7)return;const persona=this.activeCustomer.persona%12,actor=COURIER_PERSONAS[persona],line=COURIER_STUNT_LINES[persona][event==='boost'?1:0];
    this.stuntSpeechAt=this.elapsed;this.lastMessageAt=this.elapsed;this.messageUntil=this.elapsed+7;this.pendingBanter=null;this.showPhoneLine(actor,line,'banter',this.activeCustomer.destination.name);
  }
  updateHUD(){super.updateHUD();this.refreshGearUI();document.getElementById('boost-label').textContent=this.boostCooldown>0?'噴焰回充 '+this.boostCooldown.toFixed(1)+'s':this.boost>=(this.currentDriver.perk?.boostCost||35)?'E / 手把 A / 觸控噴焰 · 氮氣 '+Math.floor(this.boost)+'%' :'氮氣回充中';document.getElementById('air-state').textContent=!this.isGrounded?'AIR '+this.airDistance.toFixed(0)+' m':this.wheelieAngle>.25?'WHEELIE / 孤輪':'Space 起跳 · Shift 孤輪';document.getElementById('combo-chip').textContent=this.comboCount?'技巧 '+this.comboCount+' 連段 · ×'+(1+Math.min(this.comboCount,10)*.1).toFixed(1):'甩尾 ＋ 越障 ＋ 孤輪 = 技巧獎勵';}
  endGame(){super.endGame();document.getElementById('speed-lines').classList.remove('active');document.getElementById('lic-mode-score').textContent=this.stuntStats.jumps+' 次跳躍 · '+this.stuntStats.clearances+' 次越障 · '+Math.round(this.maxJumpDistance)+'m 最遠';}
  toMenu(){super.toMenu();document.getElementById('speed-lines').classList.remove('active');}
  updateCamera(dt=.016) {
    super.updateCamera(dt);this.cameraKick=Math.max(0,(this.cameraKick||0)-dt*2.8);
    if(!this.reducedMotion){const speed=Math.min(1,Math.abs(this.carSpeed)/32),drift=this.driftFactor||0;this.camera.fov+=speed*3+(this.dashTime>0?7:0);this.camera.position.x+=Math.sin(this.carRotY+Math.PI/2)*drift*.38;this.camera.position.z+=Math.cos(this.carRotY+Math.PI/2)*drift*.38;this.camera.position.y+=Math.sin(this.elapsed*48)*this.cameraKick*.07;this.camera.updateProjectionMatrix();}
    this.camera.position.y=Math.max(this.camera.position.y,this.getTerrainHeight(this.camera.position.x,this.camera.position.z)+.85);
    // Pull chase camera in front of walls rather than placing it inside opaque buildings.
    if(this.cameraMode!==2){const start=new THREE.Vector3(this.carPos.x,this.carPos.y+2,this.carPos.z),delta=this.camera.position.clone().sub(start);for(let t=.15;t<=1;t+=.07){const p=start.clone().addScaledVector(delta,t),wall=this.nearbySolids(p).find(o=>this.overlaps(p,o,.25)&&p.y<o.y+o.height);if(wall){this.camera.position.copy(start).addScaledVector(delta,Math.max(.1,t-.08));break;}}}
  }
  mapXY(p){
    if(!this.mapBounds){const points=[...this.nodes,...this.worldRivers().flatMap(r=>r.nodes)],xs=points.map(p=>p.x),zs=points.map(p=>p.z);this.mapBounds={x0:Math.min(...xs)-120,x1:Math.max(...xs)+120,z0:Math.min(...zs)-100,z1:Math.max(...zs)+100};}
    const b=this.mapBounds,s=Math.min(820/(b.x1-b.x0),650/(b.z1-b.z0));return [450+(p.x-(b.x0+b.x1)/2)*s,365+(p.z-(b.z0+b.z1)/2)*s];
  }
  drawCityMap(){
    super.drawCityMap();const ctx=document.getElementById('city-map-canvas').getContext('2d');ctx.save();ctx.globalAlpha=.65;
    for(const r of this.worldRivers()){ctx.strokeStyle='#49a9ba';ctx.lineWidth=Math.max(3,r.width*.14);ctx.beginPath();r.nodes.forEach((p,i)=>i?ctx.lineTo(...this.mapXY(p)):ctx.moveTo(...this.mapXY(p)));ctx.stroke();const mid=r.nodes[Math.floor(r.nodes.length/2)],xy=this.mapXY(mid);ctx.fillStyle='#98e8ed';ctx.font='12px "Noto Sans TC"';ctx.fillText(r.name,xy[0]-45,xy[1]);}
    ctx.globalAlpha=1;ctx.fillStyle='#ffb84b';for(const r of this.ramps){const [x,y]=this.mapXY(r);ctx.fillRect(x-2,y-2,4,4);}ctx.fillStyle='#95b5be';ctx.font='14px "Noto Sans TC"';ctx.fillText('黃點：跳台 / 平台捷徑',35,718);ctx.restore();
  }
}


/* P2 Preview module: arcade.js */
/* 2.0: score-attack delivery, route choice, fair timers and resilient input.
   All art, characters, names and tuning are original. No network dependencies. */
const DELIVERY_TIERS = [
  {name:'短衝單',color:0xff695e,css:'#ff695e',min:220,max:480},
  {name:'跨區單',color:0xffce59,css:'#ffce59',min:480,max:880},
  {name:'橫越台北',color:0x67e79e,css:'#67e79e',min:880,max:1400}
];

class RushHourCourier extends FrenzyCourier {
  constructor(){
    super();this.arcadeReady=false;this.selectedMerchant=null;this.targetAge=0;
    this.deliveryChain=0;this.maxDeliveryChain=0;this.deliveryHistory=[];
    this.celebrationTime=0;this.goTime=0;this.contextLost=false;this.scoreSaved=false;
    this.quickDriftTime=0;this.skidCursor=0;this.skidAge=0;
    this.padNeedsRelease=true;this.touchOwners=new Map();this.best={};this.records={};
    try{
      const data=JSON.parse(localStorage.getItem('supercourier.arcade.v2')||'{}');
      for(const mode of ['ARCADE','WORK_5MIN','RUSH']){
        const valid=(data.records?.[mode]||[]);
        if(!Array.isArray(valid))continue;
        this.records[mode]=valid.filter(r=>r&&Number.isFinite(r.fare)&&r.fare>=0&&r.fare<1e9&&Number.isInteger(r.deliveries)&&r.deliveries>=0)
          .sort((a,b)=>b.fare-a.fare).slice(0,5);
        if(this.records[mode][0])this.best[mode]=this.records[mode][0];
      }
    }catch{}
  }
  async init(){
    document.getElementById('btn-start').disabled=true;
    await super.init();this.arcadeReady=true;
    this.customers.forEach(c=>this.decorateOrder(c));
    document.getElementById('target-button').addEventListener('click',()=>this.cycleMerchant());
    document.getElementById('btn-start').disabled=false;
    this.skidMarks=new THREE.InstancedMesh(new THREE.PlaneGeometry(.24,.85).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x182426,side:THREE.DoubleSide,transparent:true,opacity:.45,depthWrite:false}),160);
    this.skidMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.skidMarks.frustumCulled=false;this.skidDummy=new THREE.Object3D();
    this.skidMarks.count=0;this.scene.add(this.skidMarks);
    this.refreshRecords();this.updateNavigation();this.updateHUD();
  }
  save(){
    try{
      localStorage.setItem('supercourier.arcade.v2',JSON.stringify({version:2,records:this.records}));
      localStorage.setItem('supercourier.save.v1',JSON.stringify({version:1,best:{},muted:this.muted,reducedMotion:this.reducedMotion,voiceEnabled:this.voiceEnabled}));
    }catch{document.getElementById('record-line').textContent='無法儲存本機紀錄；本次成績保留在目前頁面。';}
  }
  refreshRecords(){
    super.refreshRecords();const rows=this.records?.[this.selectedMode]||[];
    document.getElementById('leaderboard-body').innerHTML=rows.length?rows.map((r,i)=>
      '<tr><td>'+String(i+1).padStart(2,'0')+'</td><td>NT$ '+Math.round(r.fare).toLocaleString()+'</td><td>'+r.deliveries+' 單</td></tr>').join(''):
      '<tr><td colspan="3">'+(this.selectedMode==='PRACTICE'?'練習模式不列入排名':'完成一班，留下你的第一筆紀錄。')+'</td></tr>';
  }
  buildArcadeDeliverySpotPool(){
    if(this.arcadeDeliverySpots?.length)return this.arcadeDeliverySpots;
    const spots=[],seen=new Set();
    const laneLabels=['騎樓門口','公寓大門','捷運出口旁','巷口交付點','市場側門','夜市入口','公園門口','商場落客處'];
    const zoneLabels=['站前廣場旁','騎樓取餐點','巷內門口','轉角等候區'];
    const landmarkLabels=['正門騎樓','側門廣場','轉角入口','前方集合點'];
    const tryAdd=(x,z,name,meta={})=>{
      if(!Number.isFinite(x)||!Number.isFinite(z))return false;
      const snapped=this.snapRoad({x,z});
      if(!snapped.segment||snapped.distance<3.4||snapped.distance>12.5)return false;
      if(this.riverDistance(x,z)<30)return false;
      if(this.nodes.some(n=>n.edges.length>2&&Math.hypot(n.x-x,n.z-z)<6))return false;
      const y=this.getTerrainHeight(x,z),probe={x,y,z};
      if(this.nearbySolids(probe).some(o=>this.overlaps(probe,o,.45)))return false;
      const key=Math.round(x/6)+'|'+Math.round(z/6);
      if(seen.has(key))return false;
      seen.add(key);spots.push({name,pos:new THREE.Vector3(x,y,z),...meta});
      return true;
    };
    const addOffsetSpot=(base,road,side,offset,along,name,meta={})=>{
      const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,len=Math.hypot(dx,dz)||1;
      const tx=dx/len,tz=dz/len,rx=dz/len,rz=-dx/len;
      return tryAdd(base.x+rx*side*offset+tx*along,base.z+rz*side*offset+tz*along,name,meta);
    };
    this.dropoffs.forEach((zone,i)=>{
      const road=this.snapRoad(zone.pos),base={x:road.x,z:road.z};
      const roadW=(TAIPEI_ROADS[road.ri]?.width||18)/1.7;
      addOffsetSpot(base,road,i%2?1:-1,roadW/2+5.2,(i%3-1)*8,zone.name+' · '+zoneLabels[i%zoneLabels.length],{district:zone.name,kind:'zone'});
      addOffsetSpot(base,road,i%2?-1:1,roadW/2+6.4,0,zone.name+' · '+zoneLabels[(i+1)%zoneLabels.length],{district:zone.name,kind:'zone'});
    });
    this.landmarks.forEach((lm,i)=>{
      const road=this.snapRoad(lm.pos),base={x:road.x,z:road.z};
      const roadW=(TAIPEI_ROADS[road.ri]?.width||18)/1.7;
      for(const [j,side] of [i%2?1:-1,i%2?-1:1].entries())addOffsetSpot(base,road,side,roadW/2+5.8+j*1.1,(i%3-1)*10,lm.name+' · '+landmarkLabels[(i+j)%landmarkLabels.length],{district:lm.name,kind:'landmark'});
    });
    (this.undergroundZones||[]).forEach((zone,i)=>{
      const dx=Math.sin(zone.angle||0),dz=Math.cos(zone.angle||0);
      for(const [j,offset] of [-24,0,24].entries()){
        const x=zone.x+dx*offset,z=zone.z+dz*offset,key=Math.round(x/6)+'|'+Math.round(z/6),y=this.getTerrainHeight(x,z);
        if(seen.has(key)||this.nearbySolids({x,y,z}).some(o=>this.overlaps({x,y,z},o,.35)))continue;
        seen.add(key);spots.push({name:zone.name+' · '+['1號出口交付點','地下街中段','美食區入口'][j],pos:new THREE.Vector3(x,y,z),district:zone.name,kind:'underground'});
      }
    });
    let streetCount=0;
    this.segments.forEach((s,i)=>{
      const len=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);
      if(len<55||streetCount>120||i%2)return;
      const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,roadW=(TAIPEI_ROADS[s.ri]?.width||18)/1.7;
      const fracs=len>120?[.22,.54]:[.38];
      fracs.forEach((frac,k)=>{
        const base={x:s.a.x+dx*frac,z:s.a.z+dz*frac};
        const side=(i+k)%2?1:-1;
        const name=(TAIPEI_ROADS[s.ri]?.name||'台北街頭').split('／')[0]+' · '+laneLabels[(i+k)%laneLabels.length];
        if(addOffsetSpot(base,s,side,roadW/2+5.1+(k%2)*1.4,(k?((i%3)-1)*7:0),name,{district:TAIPEI_ROADS[s.ri]?.name,kind:'street'}))streetCount++;
      });
    });
    this.arcadeDeliverySpots=spots;
    return spots;
  }
  orderDestination(c,seed){
    // Deliveries now target Taipei-style curbside/entrance spots instead of road centers.
    // Orders also bias farther cross-district routes to keep arcade runs alive longer.
    this.buildArcadeDeliverySpotPool();
    if(!c.arcadeChoices){
      const from=c.group.position;
      const localRegion=this.dropoffs.reduce((a,b)=>from.distanceTo(a.pos)<from.distanceTo(b.pos)?a:b);
      const candidates=this.arcadeDeliverySpots.filter(l=>{
        const euclid=Math.hypot(l.pos.x-from.x,l.pos.z-from.z);
        return euclid>160&&euclid<1480&&(!l.district||l.district!==localRegion.name||euclid>340);
      });
      c.arcadeChoices=candidates.map(l=>({l,d:this.routeDistance(this.findRoute(from,l.pos))}))
        .filter(v=>v.d>=200&&v.d<=1450)
        .sort((a,b)=>a.d-b.d);
    }
    const tier=DELIVERY_TIERS[((seed%3)+3)%3];
    let pool=c.arcadeChoices.filter(v=>v.d>=tier.min&&v.d<tier.max);
    if(tier.max>=1400&&pool.length<4)pool=c.arcadeChoices.filter(v=>v.d>=Math.max(720,tier.min-120)&&v.d<=1450);
    else if(tier.min>=480&&pool.length<4)pool=c.arcadeChoices.filter(v=>v.d>=360&&v.d<tier.max+140);
    let choices=pool;
    if(!choices.length){
      choices=c.arcadeChoices.filter(v=>v.d>=360);
      if(choices.length>8)choices=choices.slice(Math.max(0,choices.length-8));
    }
    if(!choices.length)choices=c.arcadeChoices.slice(-4);
    const choice=choices[(Math.floor(seed/3)+seed)%choices.length];
    return choice?.l||this.dropoffs.reduce((a,b)=>c.group.position.distanceTo(a.pos)<c.group.position.distanceTo(b.pos)?a:b);
  }
  decorateOrder(c){
    const d=this.routeDistance(this.findRoute(c.group.position,c.destination.pos));
    const tier=DELIVERY_TIERS.find(t=>d<t.max)||DELIVERY_TIERS[DELIVERY_TIERS.length-1];
    c.routeMeters=d;c.tier={...tier,color:0x83c8cf,css:'#83c8cf'};
    c.ring.material.color.setHex(c.tier.color);c.icon.material.color.setHex(c.tier.color);
    // Labels are replaced and disposed, never appended on every completed order.
    if(c.arcadeLabel){c.group.remove(c.arcadeLabel);c.arcadeLabel.material.map.dispose();c.arcadeLabel.material.dispose();}
    c.arcadeLabel=this.makeLabel('取貨 · '+c.shop+'\n'+Math.round(d)+' m · '+c.destination.name,c.tier.css);
    c.arcadeLabel.position.set(0,6.4,0);c.group.add(c.arcadeLabel);
  }
  startGame(){
    if(!this.arcadeReady||this.contextLost)return;
    this.closeLayers();this.clearInputs();this.selectedMerchant=null;this.orderSerial=0;
    this.deliveryChain=0;this.maxDeliveryChain=0;this.deliveryHistory=[];
    this.celebrationTime=0;this.goTime=.9;this.scoreSaved=false;this.targetAge=0;
    this.quickDriftTime=0;this.skidCursor=0;if(this.skidMarks)this.skidMarks.count=0;
    super.startGame();this.clearInputs();this.driftFactor=0;
    this.customers.forEach(c=>this.decorateOrder(c));
    this.traffic.forEach((t,i)=>{t.progress=(i*.13)%1;t.wasClose=false;});
    this.scooters.forEach((s,i)=>{s.progress=(i*.09)%1;s.wasClose=false;});
    this.collisionCooldown=1.2;this.updateCivilianTraffic(0);this.updateScooters(0);
    this.updateCamera(1);this.updateHUD();this.updateCompass();this.updateRadar();
    this.showArcadeSplash('GO!','搶時間，拚收入。',.9);
    this.showStatusToast('商家白色票墊停穩取貨 · B 選單 · E 噴焰 · Ctrl 甩尾');
  }
  closeLayers(){
    for(const id of ['pause-screen','city-map-modal','manual-modal','license-screen'])document.getElementById(id).style.display='none';
    this.mapPaused=false;
  }
  clearInputs(){
    this.keys={};this.padConnected=false;this.padSteer=this.padGas=this.padBrake=0;
    this.padDrift=this.padWheelie=false;this.padNeedsRelease=true;
    this.padDash=this.padJump=this.padShiftUp=this.padShiftDown=false;
    this.shiftWindow=-99;this.quickDriftTime=0;this.touchOwners.clear();
    document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('held'));
  }
  initExtraUI(){
    // Own pointers prevent one finger releasing a key held by another finger.
    const controls=document.querySelectorAll('[data-key]');
    const controlKeys=new Map(Array.from(controls,b=>[b,b.dataset.key]));
    controls.forEach(b=>b.removeAttribute('data-key'));
    super.initExtraUI();
    controls.forEach(b=>{
      const key=controlKeys.get(b);b.dataset.key=key;
      b.addEventListener('pointerdown',e=>{
        e.preventDefault();if(this.gameState!=='PLAYING'||e.button>0)return;
        b.setPointerCapture(e.pointerId);this.touchOwners.set(e.pointerId,key);
        this.handleKeyDown({code:key,repeat:false,preventDefault(){}});b.classList.add('held');
      });
      const release=e=>{const owned=this.touchOwners.get(e.pointerId);this.touchOwners.delete(e.pointerId);
        if(owned&&!Array.from(this.touchOwners.values()).includes(owned)){this.handleKeyUp({code:owned});b.classList.remove('held');}};
      for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,release);
    });
  }
  handleKeyDown(e){
    const map=document.getElementById('city-map-modal').style.display==='flex';
    const manual=document.getElementById('manual-modal').style.display==='flex';
    if(map||manual){if(['Escape','Tab','KeyP','Enter','Space'].includes(e.code))e.preventDefault();
      if(!e.repeat&&(e.code==='Escape'||map&&e.code==='Tab')){
        if(map)this.closeCityMap();else document.getElementById('manual-modal').style.display='none';
      }return;
    }
    if(this.gameState==='TITLE'&&e.target?.closest?.('button,select,input,textarea,summary'))return;
    if(e.code==='KeyB'&&this.gameState==='PLAYING'&&!e.repeat){e.preventDefault();this.cycleMerchant();return;}
    if(this.celebrationTime>0&&this.gameState==='PLAYING'&&!['Escape','KeyP','KeyM'].includes(e.code))return;
    super.handleKeyDown(e);
  }
  pause(){if(this.gameState!=='PLAYING')return;super.pause();this.clearInputs();}
  resume(){
    if(this.contextLost||document.getElementById('city-map-modal').style.display==='flex')return;
    if(this.gameState!=='PAUSED')return;
    this.clearInputs();super.resume();
  }
  openCityMap(){
    if(!this.arcadeReady||!['TITLE','PLAYING','PAUSED'].includes(this.gameState))return;
    if(document.getElementById('city-map-modal').style.display==='flex')return;
    super.openCityMap();document.getElementById('pause-screen').style.display='none';
  }
  closeCityMap(){
    document.getElementById('city-map-modal').style.display='none';
    if(this.mapPaused){this.mapPaused=false;this.resume();}
    else if(this.gameState==='PAUSED')document.getElementById('pause-screen').style.display='flex';
  }
  installContextRecovery(){
    const canvas=document.getElementById('game-canvas');
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;
      if(this.gameState==='PLAYING')this.pause();this.showStatusToast('圖形暫時中斷 · 計時已暫停');});
    canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.showStatusToast('圖形已恢復 · 按繼續配送');});
  }
  pollGamepad(){
    let pads=[];try{pads=Array.from(navigator.getGamepads?navigator.getGamepads():[]);}catch{}
    const p=pads.find(p=>p&&p.connected!==false&&p.mapping==='standard');
    if(!p){this.padConnected=false;this.padSteer=this.padGas=this.padBrake=0;this.padDrift=this.padWheelie=false;
      this.padDash=this.padJump=this.padShiftUp=this.padShiftDown=this.padPause=this.padTarget=false;
      this.padNeedsRelease=true;return;}
    const pressed=i=>!!p.buttons[i]?.pressed;
    const pause=pressed(9);
    if(pause&&!this.padPause){this.padPause=true;
      if(document.getElementById('city-map-modal').style.display==='flex')this.closeCityMap();
      else if(this.gameState==='PLAYING')this.pause();else if(this.gameState==='PAUSED')this.resume();return;}
    this.padPause=pause;
    if(this.gameState!=='PLAYING')return;
    const active=[0,1,2,3,4,5,6,7].some(pressed)||Math.abs(p.axes[0]||0)>.16;
    if(this.padNeedsRelease){if(active)return;this.padNeedsRelease=false;}
    this.padConnected=true;const a=p.axes[0]||0;this.padSteer=Math.abs(a)>.16?a:0;
    this.padGas=p.buttons[7]?.value||0;this.padBrake=p.buttons[6]?.value||0;
    this.padDrift=pressed(1);this.padWheelie=pressed(3);
    const actions=[[0,'padDash',()=>this.triggerDash()],[2,'padJump',()=>this.tryJump()],
      [4,'padShiftDown',()=>this.shiftGear(-1)],[5,'padShiftUp',()=>this.shiftGear(1)],
      [8,'padTarget',()=>this.cycleMerchant()]];
    for(const [i,key,fn] of actions){const down=pressed(i);if(down&&!this[key]&&this.celebrationTime<=0)fn();this[key]=down;}
  }
  loop(timestamp){
    requestAnimationFrame(t=>this.loop(t));let dt=Math.max(0,(timestamp-this.lastTime)/1000);this.lastTime=timestamp;
    // Never silently run a slower game clock on devices below 12 FPS.
    // A long browser suspension pauses rather than charging unseen gameplay.
    if(dt>1&&this.gameState==='PLAYING'){this.pause();this.showStatusToast('畫面中斷 · 已自動暫停');dt=0;}
    dt=Math.min(dt,.5);
    if(this.arcadeReady&&['PLAYING','PAUSED'].includes(this.gameState))this.pollGamepad();
    if(this.gameState==='PLAYING'){
      this.accumulator+=dt;
      while(this.accumulator>=1/60&&this.gameState==='PLAYING'){this.step(1/60);this.accumulator-=1/60;}
      this.updateHUD();document.getElementById('phone-message').classList.toggle('visible',this.elapsed<this.messageUntil);
      this.updateCompass();this.updateRadar();this.updateCamera(dt);
    }else if(this.gameState==='TITLE'&&this.arcadeReady){
      this.titleOrbit=(this.titleOrbit||0)+dt*.04;const p=this.getPlayerStartPos();
      this.camera.position.set(p.x+Math.sin(this.titleOrbit)*17,p.y+8,p.z-Math.cos(this.titleOrbit)*17);this.camera.lookAt(p.x,p.y+1,p.z);
    }
    if(this.renderer&&!this.contextLost)this.renderer.render(this.scene,this.camera);
  }
  step(dt){
    if(this.gameState!=='PLAYING')return;
    if(this.celebrationTime>0){this.celebrationTime=Math.max(0,this.celebrationTime-dt);
      if(this.celebrationTime===0){document.getElementById('arcade-splash').classList.remove('visible');this.clearInputs();}return;}
    this.goTime=Math.max(0,this.goTime-dt);
    if(this.goTime===0)document.getElementById('arcade-splash').classList.remove('visible');
    this.targetAge-=dt;super.step(dt);
  }
  merchantCandidates(){return this.customers.filter(c=>!c.isBoarded&&c.cooldown<=0)
    .sort((a,b)=>this.carPos.distanceTo(a.group.position)-this.carPos.distanceTo(b.group.position)).slice(0,3);}
  nearestMerchant(){
    if(this.selectedMerchant&&!this.selectedMerchant.isBoarded&&this.selectedMerchant.cooldown<=0)return this.selectedMerchant;
    this.selectedMerchant=null;return super.nearestMerchant();
  }
  cycleMerchant(){
    if(this.gameState!=='PLAYING'||this.activeCustomer||this.celebrationTime>0)return;
    const choices=this.merchantCandidates();if(!choices.length)return;
    const old=this.nearestMerchant(),i=choices.indexOf(old);this.selectedMerchant=choices[(i+1)%choices.length];
    this.interact=0;this.updateNavigation();this.updateHUD();
    this.showStatusToast('鎖定 '+this.selectedMerchant.shop+' · '+(this.selectedMerchant.tier?.name||'配送單'));
  }
  updateCustomers(dt){
    // Destination selection is for navigation. Any available shop can still be collected.
    this.customers.forEach(c=>{c.cooldown=Math.max(0,(c.cooldown||0)-dt);c.group.visible=!c.isBoarded&&c.cooldown<=0;
      if(c.icon)c.icon.position.y=3+Math.sin(this.elapsed*2+c.wavePhase)*.18;});
    if(this.activeCustomer){
      this.activeCustomerTimer=Math.max(0,this.activeCustomerTimer-dt);const c=this.activeCustomer;
      if(!c.warnedHalf&&this.activeCustomerTimer<this.activeCustomerInitialTime*.5){c.warnedHalf=true;this.customerMessage('half');}
      if(!c.warnedUrgent&&this.activeCustomerTimer<10){c.warnedUrgent=true;this.customerMessage('urgent',true);}
      if(this.activeCustomerTimer<=0){this.customerMessage('late',true);this.failures++;
        this.showStatusToast('TOO SLOW · 訂單取消，收入 $0');this.finishOrder(false);return;}
      const p=c.destination.pos;const near=Math.hypot(p.x-this.carPos.x,p.z-this.carPos.z)<10;
      this.interact=this.isGrounded&&near&&Math.abs(this.carSpeed)<1.5?this.interact+dt:0;
      if(this.interact>=.7)this.deliverCustomer();
    }else{
      const target=SuperCourierTaipei.prototype.nearestMerchant.call(this);
      const near=target&&Math.hypot(target.group.position.x-this.carPos.x,target.group.position.z-this.carPos.z)<7;
      if(this.interactionMerchant!==target)this.interact=0;this.interactionMerchant=target;
      this.interact=this.isGrounded&&near&&Math.abs(this.carSpeed)<1.5?this.interact+dt:0;
      if(this.interact>=.7)this.boardCustomer(target);
    }
    if(this.interact>0)document.getElementById('objective-line').textContent=(this.activeCustomer?'交付中':'取貨中')+' '+Math.min(100,Math.round(this.interact/.7*100))+'%';
  }
  boardCustomer(c){
    if(this.gameState!=='PLAYING'||this.activeCustomer||!c||c.cooldown>0||c.isBoarded)return;
    this.selectedMerchant=null;this.interactionMerchant=null;this.comboTTL=0;super.boardCustomer(c);
    this.collisionCooldown=Math.max(this.collisionCooldown,.8);
    document.getElementById('arcade-splash').classList.remove('visible');this.goTime=0;
  }
  deliverCustomer(){
    if(this.gameState!=='PLAYING'||!this.activeCustomer)return;
    if(this.activeCustomerTimer<=0){this.failures++;this.finishOrder(false);return;}
    const c=this.activeCustomer,remaining=this.activeCustomerTimer;
    const ratio=remaining/this.activeCustomerInitialTime;
    const grade=ratio>=.5?'SPEEDY':ratio>=.2?'GOOD':'JUST IN TIME';
    this.deliveryChain++;this.maxDeliveryChain=Math.max(this.maxDeliveryChain,this.deliveryChain);
    const multiplier=1+Math.min(6,this.deliveryChain-1)*.05;
    const base=c.baseFare,tips=this.currentTip,timeBonus=Math.round(remaining*2),cargoFactor=.4+.6*this.integrity/100;
    const fare=Math.round((base+tips+timeBonus)*cargoFactor*multiplier);
    const extension=this.selectedMode==='ARCADE'?Math.min(32,(grade==='SPEEDY'?16:grade==='GOOD'?11:7)+Math.min(10,Math.floor(c.routeMeters/135))+Math.min(6,this.deliveryChain-1)):0;
    const added=extension?Math.max(0,Math.min(extension,150-this.gameTime)):0;
    this.gameTime+=added;this.totalFare+=fare;this.deliveredCount++;if(grade==='SPEEDY')this.speedyCount++;
    this.deliveryHistory.push({shop:c.shop,destination:c.destination.name,grade,fare,base,tips,timeBonus,integrity:this.integrity,multiplier,added:Math.round(added*10)/10});
    this.customerMessage(this.integrity>=88?'success':'damaged',true);this.audio.playCash();
    this.finishOrder(true);this.carSpeed=0;this.dashTime=0;this.clearInputs();
    this.celebrationTime=1.1;this.showArcadeSplash(grade,'NT$ '+fare.toLocaleString()+(added?'  /  +'+added.toFixed(1).replace('.0','')+' 秒':'')+'  /  '+this.deliveryChain+' 連送',1.1);
    this.showComboBanner('送達！ NT$ '+fare+(added?' · +'+Math.round(added)+'s':''),'stunt-courier-dash');
  }
  finishOrder(success){
    if(!this.activeCustomer)return;
    const c=this.activeCustomer;if(!success)this.deliveryChain=0;
    this.orderGeneration++;this.pendingBanter=null;this.phoneQueue=[];this.selectedMerchant=null;
    super.finishOrder(success);this.decorateOrder(c);this.activeCustomerTimer=0;
  }
  showArcadeSplash(title,detail){
    document.getElementById('arcade-splash-title').textContent=title;
    document.getElementById('arcade-splash-detail').textContent=detail;
    document.getElementById('arcade-splash').classList.add('visible');
  }
  rescue(){
    if(this.gameState!=='PLAYING'||this.celebrationTime>0)return;
    super.rescue();this.clearInputs();this.dashTime=0;this.driftFactor=0;this.interact=0;
    this.comboCount=0;this.comboTTL=0;this.quickDriftTime=0;this.shiftDip=0;this.airDistance=0;
    this.carGroup.position.copy(this.carPos);this.carGroup.rotation.y=this.carRotY;
    if(this.bikeRig)this.bikeRig.rotation.set(0,0,0);
  }
  triggerDash(source='button'){
    if(this.celebrationTime>0)return false;return super.triggerDash(source);
  }
  updateVehiclePhysics(dt){
    const held=this.keys.ControlLeft;if(this.quickDriftTime>0)this.keys.ControlLeft=true;
    super.updateVehiclePhysics(dt);this.keys.ControlLeft=held;this.quickDriftTime=Math.max(0,this.quickDriftTime-dt);
    this.skidAge+=dt;
    if(this.skidMarks){
      this.skidMarks.visible=!this.reducedMotion;
      if(!this.reducedMotion&&this.driftFactor>.4&&this.isGrounded&&this.skidAge>.035){
        this.skidAge=0;const i=this.skidCursor++%160;
        this.skidDummy.position.set(this.carPos.x-Math.sin(this.carRotY)*.8,this.getTerrainHeight(this.carPos.x,this.carPos.z)+.2,this.carPos.z-Math.cos(this.carRotY)*.8);
        this.skidDummy.rotation.y=this.heading;this.skidDummy.updateMatrix();this.skidMarks.setMatrixAt(i,this.skidDummy.matrix);
        this.skidMarks.count=Math.min(160,this.skidCursor);this.skidMarks.instanceMatrix.needsUpdate=true;
      }
    }
  }
  updateHUD(){
    super.updateHUD();const c=this.activeCustomer||this.nearestMerchant(),loaded=!!this.activeCustomer;
    const target=document.getElementById('target-button');target.disabled=loaded||!c||this.celebrationTime>0;
    target.textContent=loaded?'配送中 · '+this.deliveryChain+' 連送':'B 換單 / '+(c?.tier?.name||'待派單');
    document.getElementById('hud-customer-box').classList.toggle('order-preview',!loaded);
    if(c&&!loaded){
      document.getElementById('order-customer').textContent=c.shop;
      document.getElementById('hud-destination').style.display='block';document.getElementById('hud-destination').textContent=c.destination.name;
      document.getElementById('hud-distance').style.display='block';document.getElementById('hud-distance').textContent=(c.tier?.name||'配送')+' · '+Math.round(c.routeMeters||0)+' m · 約 NT$ '+Math.round(90+(c.routeMeters||0)*.65);
      document.getElementById('order-item').textContent='紅 短單 / 黃 中單 / 綠 長單 · 停穩 0.7 秒';
    }
    document.getElementById('chain-value').textContent=this.deliveryChain+' 連送';
    document.getElementById('chain-value').classList.toggle('hot',this.deliveryChain>=3);
    document.getElementById('delivery-progress').style.background=loaded?(this.activeCustomerTimer<10?'#ff695e':'#ffd260'):(c?.tier?.css||'#00e5cf');
  }
  updateRadar(){
    super.updateRadar();const cv=document.getElementById('radar-canvas'),ctx=cv.getContext('2d'),cos=Math.cos(this.carRotY),sin=Math.sin(this.carRotY);
    for(const c of this.customers){if(c.cooldown>0||c.isBoarded)continue;
      const dx=c.group.position.x-this.carPos.x,dz=c.group.position.z-this.carPos.z;
      const x=140+(-dx*cos+dz*sin)*.38,y=172-(dx*sin+dz*cos)*.38;
      ctx.fillStyle=c.tier?.css||'#00edd0';ctx.fillRect(x-4,y-4,8,8);
      if(!this.activeCustomer&&c===this.nearestMerchant()){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x-8,y-8,16,16);}
    }
  }
  updateNavigation(){
    super.updateNavigation();if(this.activeCustomer||!this.customers.length)return;
    const c=this.nearestMerchant();if(!c){this.route=[];this.navDistance=0;
      if(this.roadRibbon)this.roadRibbon.visible=false;if(this.routeChevrons)this.routeChevrons.visible=false;
      document.getElementById('nav-route-total').textContent='商家備貨中 · 稍候接單';}
  }
  endGame(){
    if(this.gameState!=='PLAYING')return;
    const previous=this.best[this.selectedMode];this.clearInputs();this.closeLayers();super.endGame();
    if(this.selectedMode!=='PRACTICE'&&!this.scoreSaved){
      const record={fare:Math.round(this.totalFare),deliveries:this.deliveredCount,combo:this.maxCombo,chain:this.maxDeliveryChain};
      const list=this.records[this.selectedMode]||[];list.push(record);list.sort((a,b)=>b.fare-a.fare);
      this.records[this.selectedMode]=list.slice(0,5);this.best[this.selectedMode]=list[0];this.scoreSaved=true;this.save();
      document.getElementById('result-note').textContent=(!previous||record.fare>previous.fare?'新本機紀錄！':'本機最高 NT$ '+previous.fare.toLocaleString())+' · 最長 '+this.maxDeliveryChain+' 連送';
    }
    document.getElementById('arcade-splash').classList.remove('visible');
    document.getElementById('lic-mode-score').textContent=this.failures+' 單逾時 · '+this.maxDeliveryChain+' 連送 · '+(this.distanceDriven/1000).toFixed(1)+' km';
    const last=this.deliveryHistory.at(-1);
    document.getElementById('receipt-detail').textContent=last?'最後一單 '+last.grade+' / 基本 '+last.base+' + 技巧 '+last.tips+' + 時間 '+last.timeBonus+' / 貨況 '+last.integrity+'% / 連送 ×'+last.multiplier.toFixed(2):'完成配送可獲得運費、技巧小費與剩餘時間獎勵。';
    this.refreshRecords();
  }
  toMenu(){
    this.clearInputs();this.closeLayers();this.celebrationTime=0;this.goTime=0;
    document.getElementById('arcade-splash').classList.remove('visible');super.toMenu();
  }
  toggleQuality(){
    super.toggleQuality();this.renderer.setPixelRatio(this.highQuality?Math.min(devicePixelRatio,1.5):1);
  }
  updateRain(dt){
    if(!this.highQuality){if(this.rainMesh)this.rainMesh.visible=false;return;}
    super.updateRain(dt);
    if(this.rainMesh)this.rainMesh.position.y=this.getTerrainHeight(this.carPos.x,this.carPos.z);
  }
}


/* P2 Preview module: street-realism.js */
/* 3.0 Taipei Street Edition. Original geometry and generated elevation materials.
 * WGS84 anchors remain compressed; this is an arcade city, not a surveyed replica.
 * Collision envelope: three swept discs around the entire bike, with vertical intervals.
 */
const TAIPEI_FACADE_ATLAS='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y60TTcAAAAASUVORK5CYII=';
const TAIPEI_PORTRAIT_ATLAS='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y60TTcAAAAASUVORK5CYII=';
const TAIPEI_SHOP_ATLAS='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y60TTcAAAAASUVORK5CYII=';

// Separate west-side street names and their directional roles. These centerlines
// are hand-sampled design approximations, not GPS/survey or live routing data.
const mergedWestRoad=TAIPEI_ROADS.find(r=>r.name==='成都路／桂林路');
if(mergedWestRoad){mergedWestRoad.name='桂林路';mergedWestRoad.pts=[[25.0384,121.4960],[25.0384,121.5000],[25.0384,121.5040],[25.0384,121.5080],[25.0384,121.5135]];}
const mergedWanhuaRoad=TAIPEI_ROADS.find(r=>r.name==='艋舺大道／西園路');
if(mergedWanhuaRoad)mergedWanhuaRoad.name='艋舺大道';
TAIPEI_ROADS.push(
 {name:'成都路',width:13,pts:[[25.0420,121.5000],[25.0420,121.5040],[25.0420,121.5080]]},
 {name:'康定路',width:13,pts:[[25.0450,121.5025],[25.0420,121.5024],[25.0384,121.5023],[25.0350,121.5022],[25.0300,121.5020]]},
 {name:'西園路',width:15,pts:[[25.0384,121.5000],[25.0366,121.5000],[25.0330,121.4990],[25.0280,121.4955],[25.0230,121.4930]]},
 {name:'廣州街',width:12,pts:[[25.0366,121.4960],[25.0366,121.5000],[25.0366,121.5040],[25.0366,121.5080]]}
);

class TaipeiStreetCourierBase extends RushHourCourier {
  constructor(){
    super();this.streetVersion='3.0.0';this.riderHeight=2.28;this.bikeRadius=.49;
    this.visualSteer=0;this.dynamicContacts=0;this.cameraOcclusions=0;
  }
  async init(){
    // Decode embedded art before materials are built. A damaged image falls back to canvases.
    if(typeof Image!=='undefined')await Promise.all([
      ['facadeAtlas',TAIPEI_FACADE_ATLAS],['shopAtlas',TAIPEI_SHOP_ATLAS]
    ].map(([key,src])=>new Promise(resolve=>{
      const im=new Image();let done=false;
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
      const timer=setTimeout(finish,7000);
      im.onload=()=>{this[key]=im;finish();};im.onerror=finish;im.src=src;
    })));
    await super.init();this.styleLighting();this.streetReady=true;
    document.querySelectorAll('.driver-avatar').forEach((el,i)=>{
      el.innerHTML='';el.style.backgroundImage='url('+TAIPEI_PORTRAIT_ATLAS+')';el.style.backgroundSize='200% 200%';
      el.style.backgroundPosition=(i%2?'100%':'0%')+' '+(i>1?'100%':'0%');el.style.borderRadius='12px';
    });
  }
  makeTexture(kind,variant=0){
    if((kind==='facade'||kind==='glass')&&this.facadeAtlas||kind==='shopfront'&&this.shopAtlas){
      this.cityTextures=this.cityTextures||new Map();const key=kind==='glass'?'glass-atlas':kind+(variant%(kind==='shopfront'?4:3));
      if(this.cityTextures.has(key))return this.cityTextures.get(key);
      const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
      const tile=kind==='glass'?3:kind==='shopfront'?variant%4:variant%3,im=kind==='shopfront'?this.shopAtlas:this.facadeAtlas,sw=im.width/2,sh=im.height/2;
      ctx.drawImage(im,(tile%2)*sw,Math.floor(tile/2)*sh,sw,sh,0,0,1024,1024);

      const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
      t.anisotropy=Math.min(8,this.renderer?.capabilities?.getMaxAnisotropy?.()||1);
      this.cityTextures.set(key,t);return t;
    }
    // Texture detail randomness must never change road/building/traffic placement.
    const before=this.citySeed;let seed=2166136261;for(const ch of kind+variant)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
    this.citySeed=seed;try{return super.makeTexture(kind==='shopfront'?'facade':kind,variant);}finally{this.citySeed=before;}
  }
  curvedRoof(g,w,d,y,rise,material){
    const v=[],uv=[],nx=24,nz=16;
    const roofY=(x,z)=>{const rz=Math.abs(z)/(d/2),rx=Math.abs(x)/(w/2);return y+rise*(1-Math.max(Math.pow(rz,.8),Math.pow(rx,4)*.75))+.8*Math.pow(rz,5)+.35*Math.pow(rx,6);};
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const x0=-w/2+w*i/nx,x1=-w/2+w*(i+1)/nx,z0=-d/2+d*j/nz,z1=-d/2+d*(j+1)/nz;
      const a=[x0,roofY(x0,z0),z0],b=[x1,roofY(x1,z0),z0],c=[x0,roofY(x0,z1),z1],e=[x1,roofY(x1,z1),z1];
      v.push(...a,...c,...b,...b,...c,...e);uv.push(i/nx,j/nz,i/nx,(j+1)/nz,(i+1)/nx,j/nz,(i+1)/nx,j/nz,i/nx,(j+1)/nz,(i+1)/nx,(j+1)/nz);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    const m=material.clone();m.side=THREE.DoubleSide;this.mesh(g,geo,m);
    const ridge=this.mat('roof-ridge',0xb4a67c);this.box(g,w*.65,.22,.22,ridge,0,y+rise+.1,0);
    // Tile seams follow the roof pitch, supplying relief at street-level distances.
    const seams=[];for(let x=-w/2+.25;x<w/2;x+=.75)for(let j=0;j<16;j++){
      const z0=-d/2+d*j/16,z1=-d/2+d*(j+1)/16;seams.push(x,roofY(x,z0)+.024,z0,x,roofY(x,z1)+.024,z1);
    }
    const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(seams,3));
    const line=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:material.color.clone().multiplyScalar(.77)}));g.add(line);
  }
  arch(g,w,h,depth,mat,x,y,z){
    const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);
    s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);
    return this.mesh(g,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:12}),mat,x,y,z);
  }
  landmarkText(g,text,w,x,y,z,color='#f9e3b7'){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ct=c.getContext('2d');
    ct.fillStyle='#13232ade';ct.fillRect(0,0,1024,128);ct.fillStyle=color;ct.font='bold 64px "Noto Sans TC"';ct.textAlign='center';ct.textBaseline='middle';ct.fillText(text,512,64);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});
    return this.mesh(g,new THREE.PlaneGeometry(w,w/8),m,x,y,z);
  }
  buildTaipeiLandmarks(){
    super.buildTaipeiLandmarks();
    const stone=this.mat('detailed-stone',0xe4ded1),brick=this.mat('landmark-brick',0xffffff,'brick');
    const dark=this.mat('landmark-window',0x253d42),bronze=this.mat('landmark-bronze',0xab985b);
    const roof=this.mat('taipei-tile-roof',0x294b65),redRoof=this.mat('hotel-roof-red',0xaa412d);
    const replace=(name,build)=>{const g=this.landmarkGroups.find(g=>g.name===name);if(!g)return;
      for(const c of [...g.children]){g.remove(c);c.geometry?.dispose();}build(g);return g;};
    replace('台北101',g=>{
      const glass=this.mat('101-jade-glass',0x88bdb4,'glass',3);glass.roughness=.23;glass.metalness=.4;
      this.box(g,28,16,28,glass,0,8,0);this.box(g,24,10,24,glass,0,21,0);
      for(let tier=0;tier<8;tier++){
        const y=26+tier*13.5,w=17.8-tier*.14;
        const t=this.mesh(g,new THREE.CylinderGeometry(w*.76,w*.62,12.8,4),glass,0,y+6.4,0);t.rotation.y=Math.PI/4;
        this.box(g,w*1.08,.55,w*1.08,bronze,0,y+12.8,0);
        for(let floor=1;floor<7;floor++){const s=w*.91+floor*.025;this.box(g,s,.075,s,this.mat('101-floor-band',0x547f78),0,y+floor*1.8,0);}
        for(const side of [-1,1])for(const x of [-.3,.3])this.box(g,.23,12.8,.25,bronze,x*w,y+6.4,side*w*.505);
      }
      this.box(g,12,9,12,glass,0,138,0);this.box(g,8,9,8,glass,0,147,0);
      this.mesh(g,new THREE.CylinderGeometry(.22,.8,18,12),bronze,0,160,0);
      for(const s of [-1,1])this.mesh(g,new THREE.TorusGeometry(1.25,.18,8,20),bronze,s*9.4,24,12.2);
      this.landmarkText(g,'TAIPEI 101',12,0,10,14.05);
    });
    replace('西門紅樓',g=>{
      this.mesh(g,new THREE.CylinderGeometry(10.5,10.5,9.6,8),brick,0,4.8,0);
      this.mesh(g,new THREE.ConeGeometry(12,4.6,8),this.mat('redhouse-roof',0x514e49),0,11.9,0);
      this.box(g,18,5.6,16,brick,0,2.8,12);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4+Math.PI/8,front=new THREE.Group();front.rotation.y=a;g.add(front);
        for(const x of [-2.1,2.1]){this.arch(front,1.8,3.1,.08,dark,x,1.1,9.73);this.arch(front,1.75,2.6,.08,dark,x,5.7,9.73);this.box(front,2.2,.15,.18,stone,x,5.45,9.73);}
        this.box(front,7.8,.22,.28,stone,0,4.8,9.73);this.box(front,.42,8.5,.45,stone,-3.9,4.25,9.73);
      }
      this.landmarkText(g,'西 門 紅 樓',9,0,8.85,-9.76).rotation.y=Math.PI;
    });
    replace('台北車站',g=>{
      this.box(g,46,13.4,26,stone,0,6.7,0);this.box(g,50,1.2,29,brick,0,14,0);
      this.curvedRoof(g,52,31,15,6,redRoof);
      for(const side of [-1,1])for(let x=-19;x<=19;x+=4.75){this.box(g,2.9,6,.16,dark,x,7.5,side*13.1);this.box(g,.6,10,.3,stone,x-1.8,5,side*13.15);}
      this.landmarkText(g,'臺 北 車 站',18,0,12.1,-13.25).rotation.y=Math.PI;
      this.landmarkText(g,'TAIPEI MAIN STATION',16,0,3.4,-13.26).rotation.y=Math.PI;
    });
    replace('中正紀念堂',g=>{
      this.box(g,23,3,23,stone,0,1.5,0);this.box(g,17,14,17,stone,0,10,0);
      this.mesh(g,new THREE.CylinderGeometry(10.3,12.7,2,8),roof,0,18,0);
      this.mesh(g,new THREE.ConeGeometry(13.1,8,8),roof,0,23,0);
      this.mesh(g,new THREE.SphereGeometry(.65,12,8),bronze,0,27.2,0);
      for(const x of [-5,0,5])this.arch(g,3.1,7,.1,dark,x,3,-8.61).rotation.y=Math.PI;
      for(let i=0;i<9;i++)this.box(g,15-i*.12,.33,1.55,stone,0,2.84-i*.33,-12-i*.95);
      this.landmarkText(g,'中正紀念堂',7,0,13,-8.67).rotation.y=Math.PI;
    });
    replace('圓山飯店',g=>{
      const red=this.mat('hotel-red',0xa84431);this.box(g,43,29,20,red,0,14.5,0);
      for(let y=4;y<30;y+=3.5){this.box(g,46,.35,23,stone,0,y,0);for(let x=-19;x<20;x+=3.45){this.box(g,2.2,2.4,.15,dark,x,y+1.5,-10.05);this.box(g,.25,3.2,.3,red,x-1.3,y+1.6,-11.2);}}
      this.curvedRoof(g,51,29,31,8,redRoof);this.curvedRoof(g,42,24,38,4,redRoof);
      this.landmarkText(g,'圓 山 大 飯 店',19,0,27,-11.6).rotation.y=Math.PI;
    });
    this.addLandmark('北門・承恩門',25.0475,121.5100,g=>{
      this.box(g,17,7.3,11,brick,0,3.65,0);this.box(g,18,.45,12,stone,0,7.5,0);
      this.box(g,11.5,5,7.2,brick,0,10.2,0);this.curvedRoof(g,17,12,12.6,3,this.mat('northgate-red-roof',0x774934));
      this.arch(g,4.1,5.1,.08,dark,0,.03,-5.59).rotation.y=Math.PI;
      for(const x of [-4.2,0,4.2])this.box(g,1.1,1.7,.11,dark,x,10,-3.69);
      this.landmarkText(g,'承 恩 門',5,0,6.2,-5.68).rotation.y=Math.PI;
    },20,14,28);
    this.addLandmark('艋舺龍山寺',25.0372,121.4999,g=>{
      const red=this.mat('longshan-red',0xa74837),tile=this.mat('longshan-tile',0xb56b35);
      this.box(g,36,.4,28,stone,0,.2,0);
      for(const side of [-1,1]){this.box(g,3.4,4.4,20,brick,side*15.6,2.4,1);const wing=new THREE.Group();wing.position.set(side*15.6,0,1);wing.rotation.y=Math.PI/2;g.add(wing);this.curvedRoof(wing,23,6,4.8,2.2,tile);}
      for(const side of [-1,1])for(const z of [-10,-4,2,8])this.box(g,.25,2.5,.25,red,side*17.1,1.6,z);

      for(const z of [-8,6]){
        this.box(g,30,5.4,9,brick,0,3,z);const hallRoof=new THREE.Group();hallRoof.position.z=z;g.add(hallRoof);this.curvedRoof(hallRoof,35,14,5.8,3.4,tile);
        for(const x of [-12,-6,0,6,12])this.mesh(g,new THREE.CylinderGeometry(.32,.36,5.6,12),red,x,3,z-4.8);
        for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*12,9,z),new THREE.Vector3(side*14,10,z),new THREE.Vector3(side*16,9.6,z),new THREE.Vector3(side*16.8,11,z)]);this.mesh(g,new THREE.TubeGeometry(curve,16,.14,6,false),bronze);}
      }
      this.landmarkText(g,'龍 山 寺',9,0,4.7,-12.8).rotation.y=Math.PI;
      for(const x of [-12,-6,6,12]){this.box(g,1.9,2.8,.07,this.mat('temple-carving',0xba9559),x,2.7,-12.56);for(let k=0;k<4;k++)this.box(g,1.5,.08,.04,bronze,x,1.6+k*.6,-12.61);}
      this.mesh(g,new THREE.SphereGeometry(.42,12,8),bronze,0,9.65,-8);
      for(const x of [-7,7]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,9.3,-8),new THREE.Vector3(x*.75,10.4,-8),new THREE.Vector3(x*.4,10.1,-8),new THREE.Vector3(x*.3,9.7,-8)]);this.mesh(g,new THREE.TubeGeometry(curve,18,.17,7,false),bronze);}

    },39,31,38);
    // Replace the old 200m collision height with each landmark's actual visible height.
    for(const g of this.landmarkGroups){g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
      const solid=this.streetSolids.find(o=>Math.hypot(o.x-g.position.x,o.z-g.position.z)<.01);
      if(solid){solid.height=Math.max(1,bounds.max.y-g.position.y);solid.landmark=g.name;}
    }
  }
  buildStreetLife(){
    super.buildStreetLife();this.buildRoadDetails();this.buildFacadeDetails();
  }
  buildVisuals(){
    const before=new Set(this.scene.children);super.buildVisuals();
    for(const g of this.scene.children.filter(g=>!before.has(g)&&g.isGroup)){
      if(!g.children.some(m=>m.geometry?.type==='BoxGeometry'&&Math.abs(m.geometry.parameters.width-4.6)<.01))continue;
      this.streetSolids.push({x:g.position.x,z:g.position.z,y:g.position.y,w:4.9,d:4.3,height:3.6,angle:g.rotation.y,kind:'shop-booth',group:g});
      g.name='外送取貨店面';
    }
  }
  buildRoadDetails(){
    const red=this.mat('no-parking-red',0xc8443f),white=this.mat('road-white',0xe7e5d9),yellow=this.mat('tactile-yellow',0xd4ad4b);
    const pole=this.mat('street-pole',0x708483),lamp=this.mat('street-lamp',0xffe8bf);
    for(const [i,s]of this.segments.entries()){
      const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),rx=dz/len,rz=-dx/len,w=(TAIPEI_ROADS[s.ri]?.width||18)/1.7;
      for(let d=15;d<len-15;d+=20){const x=s.a.x+dx*d/len,z=s.a.z+dz*d/len;
        if(this.nodes.some(n=>n.edges.length>2&&Math.hypot(n.x-x,n.z-z)<13))continue;
        for(const side of [-1,1]){const px=x+rx*side*(w/2-.12),pz=z+rz*side*(w/2-.12);
          this.instance('red-curbs',red,px,this.getTerrainHeight(px,pz)+.22,pz,.15,.045,10,angle);
          if(w>12)this.instance('lane-white-dashes',white,x+rx*side*w*.26,this.getTerrainHeight(x,z)+.205,z+rz*side*w*.26,.12,.02,4.5,angle);
        }
      }
      if(i%4!==1||len<60)continue;
      const x=s.a.x+dx*.48+rx*(w/2+2),z=s.a.z+dz*.48+rz*(w/2+2),y=this.getTerrainHeight(x,z);
      const o={x,z,y,w:.22,d:.22,height:7.4,angle:0,kind:'lamp-post'};
      if(this.isReservedSite?.(o))continue;
      if(this.nearbyRectSolids(o).size&&[...this.nearbyRectSolids(o)].some(b=>this.rectsOverlap(o,b,.3)))continue;
      o.renderInstances=[this.instance('street-lamp-poles',pole,x,y+3.7,z,.14,7.4,.14),
      this.instance('street-lamp-arms',pole,x-rx*.7,y+7.35,z-rz*.7,.13,.14,1.6,angle-Math.PI/2),
      this.instance('street-lamp-heads',lamp,x-rx*1.45,y+7.3,z-rz*1.45,.45,.13,.8,angle)];
      this.streetSolids.push(o);this.addSpatialSolid(o);
      const cv=document.createElement('canvas');cv.width=512;cv.height=160;const ct=cv.getContext('2d');
      ct.fillStyle='#176956';ct.fillRect(0,0,512,160);ct.strokeStyle='#f4f3e8';ct.lineWidth=6;ct.strokeRect(6,6,500,148);
      ct.fillStyle='#ffffff';ct.font='bold 40px "Noto Sans TC"';ct.textAlign='center';ct.fillText((TAIPEI_ROADS[s.ri]?.name||'台北市').split('／')[0],256,65);
      ct.font='22px Arial';ct.fillText('TAIPEI CITY',256,117);const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
      const sign=this.mesh(this.scene,new THREE.PlaneGeometry(3.8,1.2),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}),x,y+3.7,z);sign.rotation.y=angle;o.renderObjects=[sign];
    }
    for(const n of this.nodes.filter(n=>n.edges.length>=3).slice(0,110)){
      const r=this.snapRoad(n),angle=Math.atan2(r.b.x-r.a.x,r.b.z-r.a.z),rx=Math.cos(angle),rz=-Math.sin(angle);
      for(const side of [-1,1])this.instance('tactile-crossings',yellow,n.x+rx*side*8,this.getTerrainHeight(n.x,n.z)+.23,n.z+rz*side*8,.65,.025,3.8,angle);
    }
  }
  buildFacadeDetails(){
    const rail=this.mat('balcony-rail',0x63716d),metal=this.mat('stainless-tank',0xa8b6b0),wall=this.mat('ac-case',0xd8d6c7),vent=this.mat('ac-vent',0x6c797a);
    metal.roughness=.3;metal.metalness=.7;
    const buildings=this.streetSolids.filter(o=>o.kind==='building'&&!o.landmark);
    for(const [i,b]of buildings.entries()){
      if(i%3||b.height<12||b.height>48)continue;
      const c=Math.cos(b.angle),sn=Math.sin(b.angle),front=(x,z)=>({x:b.x+x*c+z*sn,z:b.z-x*sn+z*c});
      const y=b.y+b.height;
      const p=front(b.w*.23,0);this.instance('roof-steel-tanks',metal,p.x,y+.6,p.z,1.6,1.2,1.6,0,new THREE.CylinderGeometry(1,1,1,14));
      for(let f=6;f<b.height-2;f+=5.8){const q=front(b.w*.24,b.d/2+.2);
        this.instance('dimensional-ac',wall,q.x,b.y+f,q.z,1.05,.6,.48,b.angle);
        const v=front(b.w*.24,b.d/2+.455);this.instance('dimensional-ac-vents',vent,v.x,b.y+f,v.z,.75,.3,.025,b.angle);
        if(i%2===0)for(const u of [-.36,-.24,-.12,0,.12,.24,.36]){const t=front(b.w*u,b.d/2+.5);this.instance('window-grilles',rail,t.x,b.y+f+1.7,t.z,.045,1.5,.055,b.angle);}
      }
    }
    // Rendered bridge rails used to have no physics. Keep their actual measured dimensions.
    for(const key of ['bridgeRails','bridgePosts','riverwalls'])for(const p of this.instanceBatches.get(key)?.items||[]){
      const o={x:p.x,z:p.z,w:p.sx,d:p.sz,y:p.y-p.sy/2,height:p.sy,angle:p.angle,kind:'railing',renderInstances:[p]};
      this.streetSolids.push(o);this.addSpatialSolid(o);
    }
  }
  buildPlayerTaxi(){
    this.wheels=[];super.buildPlayerTaxi();
    const dark=this.mat('rider-stitch',0x2d3c40),gold=this.mat('rider-reflector',0xe5eac7);
    const body=this.chassisMesh;
    // Helmet rim, vents, chin strap, sewn bag seams, rear carrier and number plate.
    this.mesh(body,new THREE.TorusGeometry(.261,.013,6,32).rotateX(Math.PI/2),dark,0,1.99,.035);
    for(const x of [-.12,0,.12])this.box(body,.022,.012,.09,dark,x,2.204,.01);
    for(const side of [-1,1])this.box(body,.025,.23,.035,dark,side*.17,1.82,.03);
    this.box(body,.1,.035,.06,dark,0,1.72,.11);
    this.box(body,.78,.08,.78,this.mat('rear-carrier',0x697d82),0,.99,-.82);
    for(const x of [-.31,.31])this.box(body,.02,.5,.018,gold,x,1.31,-1.204);
    this.box(body,.42,.035,.018,gold,0,1.56,-1.207);
    this.box(body,.3,.18,.025,this.mat('bike-plate',0xe9e9d9),0,.49,-1.135);
    for(const side of [-1,1])this.mesh(body,new THREE.SphereGeometry(.045,10,6),this.mat('bike-indicator',0xf6a544),side*.27,.72,-1.035);
    this.frontForks=body.children.filter(m=>m.isMesh&&m.geometry.type==='CylinderGeometry'&&m.position.z>.5);
    this.riderHelmet=body.children.find(m=>m.isMesh&&m.geometry.type==='SphereGeometry'&&m.position.y===1.95);
    this.carGroup.userData.collision={radius:this.bikeRadius,length:2.64,height:this.riderHeight};
  }
  makePedestrian(seed=0){
    const g=super.makePedestrian(seed),skin=this.mat('ped-skin',0xd9a67f),dark=this.mat('ped-detail',0x27343a);
    for(const x of [-.065,.065])this.mesh(g,new THREE.SphereGeometry(.018,8,6),dark,x,1.76,.172);
    this.mesh(g,new THREE.SphereGeometry(.028,8,6),skin,0,1.71,.191);
    for(const side of [-1,1]){this.box(g,.13,.075,.25,dark,side*.1,.18,.075);this.mesh(g,new THREE.SphereGeometry(.055,8,6),skin,side*.325,.87,0);}
    if(seed%3===0){this.box(g,.23,.32,.12,this.mat('ped-tote',0xc8b28f),.32,.66,.03);}
    if(seed%4===1)this.box(g,.13,.055,.07,dark,.27,1.06,.14);
    return g;
  }
  buildObstacles(){
    super.buildObstacles();for(const o of this.parkedVehicles){o.solid=true;this.streetSolids.push(o);}
    this.indexStreetSolids();
  }
  capsuleSamples(p,angle=this.carRotY||0){
    const sn=Math.sin(angle),c=Math.cos(angle);
    return [-.83,0,.83].map(d=>({x:p.x+sn*d,z:p.z+c*d}));
  }
  collisionRadius(){const lean=Math.abs(this.bikeRig?.rotation.z||0);return this.bikeRadius+Math.sin(lean)*.94;}
  bodyHeight(){const w=Math.abs(this.wheelieAngle||0);return this.riderHeight+Math.max(0,1.16*Math.sin(w)-1.89*(1-Math.cos(w)));}
  verticalOverlap(p,o){return p.y+this.bodyHeight()>(o.y||0)+.025&&p.y<(o.y||0)+o.height-.025;}
  capsuleOverlap(p,o,r=this.collisionRadius()){return this.capsuleSamples(p).some(q=>this.overlaps(q,o,r));}
  rayRect(start,delta,o,r){
    const q=this.localXZ(start,o),c=Math.cos(o.angle||0),s=Math.sin(o.angle||0);
    const dx=delta.x*c-delta.z*s,dz=delta.x*s+delta.z*c,ex=o.w/2+r,ez=o.d/2+r;
    let lo=-Infinity,hi=Infinity,nx=0,nz=0;
    for(const [p,d,e,ax,az]of [[q.x,dx,ex,c,-s],[q.z,dz,ez,s,c]]){
      if(Math.abs(d)<1e-9){if(Math.abs(p)>=e)return null;continue;}
      let a=(-e-p)/d,b=(e-p)/d,n=d>0?-1:1;if(a>b)[a,b]=[b,a];
      if(a>lo){lo=a;nx=ax*n;nz=az*n;}hi=Math.min(hi,b);if(lo>hi)return null;
    }
    if(hi<0||lo<-.00001||lo>1)return null;
    return {t:Math.max(0,lo),nx,nz,o};
  }
  sweepStaticMotion(old,target){
    let current={x:old.x,z:old.z},delta={x:target.x-old.x,z:target.z-old.z},hit=false,nx=0,nz=0;
    const mid={x:(old.x+target.x)/2,z:(old.z+target.z)/2,w:Math.abs(delta.x)+4,d:Math.abs(delta.z)+4,angle:0};
    const solids=[...this.nearbyRectSolids(mid,2)].filter(o=>!o.knocked&&this.verticalOverlap(this.carPos,o));
    // Overhead roofs also block lateral entry while airborne, using the entire rider height.
    for(const o of this.ceilingSlabs){const b=o.ceilingBottom??o.y+o.height-.28,t=b+(o.ceilingThickness||.28);
      if(this.carPos.y<t-.025&&this.carPos.y+this.bodyHeight()>b+.025&&Math.hypot(o.x-mid.x,o.z-mid.z)<Math.hypot(mid.w,mid.d)/2+Math.hypot(o.w,o.d)/2+2)solids.push({...o,y:b,height:t-b});
    }
    // Resolve a new orientation or a starting overlap before performing a sweep.
    for(let pass=0;pass<6;pass++){
      let correction=null;
      for(const o of solids)for(const sample of this.capsuleSamples(current)){
        const r=this.resolveRectPoint(sample,sample,o,this.collisionRadius());if(!r)continue;
        const dd=Math.hypot(r.x-sample.x,r.z-sample.z);if(!correction||dd>correction.dd)correction={...r,dx:r.x-sample.x,dz:r.z-sample.z,dd};
      }
      if(!correction)break;current.x+=correction.dx;current.z+=correction.dz;hit=true;nx+=correction.nx;nz+=correction.nz;
    }
    for(let pass=0;pass<4;pass++){
      let first=null;
      for(const o of solids)for(const sample of this.capsuleSamples(current)){
        const r=this.rayRect(sample,delta,o,this.collisionRadius());if(r&&(!first||r.t<first.t))first=r;
      }
      if(!first){current.x+=delta.x;current.z+=delta.z;break;}
      const t=Math.max(0,first.t-.0002);current.x+=delta.x*t+first.nx*.004;current.z+=delta.z*t+first.nz*.004;
      hit=true;nx+=first.nx;nz+=first.nz;delta.x*=1-t;delta.z*=1-t;
      const inward=delta.x*first.nx+delta.z*first.nz;if(inward<0){delta.x-=inward*first.nx;delta.z-=inward*first.nz;}
      if(Math.hypot(delta.x,delta.z)<1e-7)break;
    }
    return {...current,hit,nx,nz};
  }
  ceilingHit(oldY){
    const top=this.bodyHeight();
    let bottom=Infinity,hit=null;
    for(const o of this.ceilingSlabs){const b=o.ceilingBottom??o.y+o.height-.02,t=b+(o.ceilingThickness||.28);
      if(this.capsuleOverlap(this.carPos,o,.43)&&oldY+top<=b+.06&&this.carPos.y+top>=b-.02&&this.carPos.y<t&&b<bottom){bottom=b;hit=o;}
    }
    if(!hit)return false;this.carPos.y=bottom-top-.025;this.carVy=-Math.max(2.6,Math.abs(this.carVy)*.36);this.hit('撞到'+(hit.tag||'雨棚'));return true;
  }
  nudgeFromWall(old,motion){
    const before=this.carPos.clone();super.nudgeFromWall(old,motion);
    if(before.distanceToSquared(this.carPos)>.001){const safe=this.sweepStaticMotion(before,this.carPos);this.carPos.x=safe.x;this.carPos.z=safe.z;}
  }
  updateVehiclePhysics(dt){
    this.motionStart=this.carPos.clone();super.updateVehiclePhysics(dt);
    // Compose steering yaw before axle roll so a spinning front wheel cannot wobble.
    const steer=Math.max(-1,Math.min(1,(this.keys.ArrowRight||this.keys.KeyL?1:0)-(this.keys.ArrowLeft||this.keys.KeyJ?1:0)+(this.padConnected?this.padSteer:0)));
    this.visualSteer+=(steer*.22-this.visualSteer)*(1-Math.exp(-dt*12));
    this.frontWheelRoll=(this.frontWheelRoll||0)+this.carSpeed*dt/.37;
    if(this.wheels[1]){const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-this.visualSteer),roll=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.frontWheelRoll);this.wheels[1].quaternion.copy(yaw.multiply(roll));}
  }
  collideMoving(t,oldPosition,dt,id){
    const data=t.group.userData,angle=t.group.rotation.y;
    const o={x:oldPosition.x,z:oldPosition.z,y:oldPosition.y,w:data.width||.75,d:data.length||1.9,height:data.height||2.05,angle};
    const current=t.group.position,playerStart=dt>0&&this.motionStart?this.motionStart:this.carPos,relative={x:(this.carPos.x-playerStart.x)-(current.x-oldPosition.x),z:(this.carPos.z-playerStart.z)-(current.z-oldPosition.z)};
    const currentSolid={...o,x:current.x,z:current.z,y:current.y};
    const above=this.carPos.y>=current.y+o.height+.06;
    if(above){if(!this.isGrounded&&this.capsuleOverlap(this.carPos,currentSolid))this.airCleared.add(id);return false;}
    if(this.carPos.y+this.bodyHeight()<current.y)return false;
    let first=null;for(const s of this.capsuleSamples(playerStart)){const r=this.rayRect(s,relative,o,this.collisionRadius());if(r&&(!first||r.t<first.t))first=r;}
    if(first||this.capsuleOverlap(this.carPos,currentSolid)){
      if(first){this.carPos.x=playerStart.x+(this.carPos.x-playerStart.x)*first.t+first.nx*.07;this.carPos.z=playerStart.z+(this.carPos.z-playerStart.z)*first.t+first.nz*.07;}
      for(let k=0;k<5;k++){let moved=false;for(const s of this.capsuleSamples(this.carPos)){const r=this.resolveRectPoint(s,s,currentSolid,this.collisionRadius());if(r){this.carPos.x+=r.x-s.x;this.carPos.z+=r.z-s.z;moved=true;}}if(!moved)break;}
      const safe=this.sweepStaticMotion(this.carPos,this.carPos);this.carPos.x=safe.x;this.carPos.z=safe.z;
      this.carGroup.position.x=this.carPos.x;this.carGroup.position.z=this.carPos.z;
      this.hit(t.type?'擦撞車流':'擦撞機車');this.dynamicContacts++;t.wasClose=true;return true;
    }
    return false;
  }
  advanceTraffic(t,dt,lane){
    const before=t.group.position.clone(),progress=t.progress;
    const gap=Math.max(5,(t.group.userData.length||2)/2+3.4),queued=[...this.traffic,...this.scooters].some(other=>other!==t&&!!other.type===!!t.type&&other.nodeFrom===t.nodeFrom&&other.nodeTo===t.nodeTo&&other.progress>progress&&(other.progress-progress)*t.length<gap);
    super.advanceTraffic(t,queued?0:dt,lane);t.previousPosition=before;
  }
  updateCivilianTraffic(dt){
    for(const [i,t]of this.traffic.entries()){
      const old=t.group.position.clone();this.advanceTraffic(t,dt,2.35);
      const touched=this.collideMoving(t,old,dt,'traffic'+i),d=Math.hypot(this.carPos.x-t.group.position.x,this.carPos.z-t.group.position.z);
      if(!touched&&d<5&&Math.abs(this.carSpeed)>12&&!t.wasClose){this.addTip(22);this.showComboBanner('擦身快送！','stunt-courier-through');this.customerMessage('near');t.wasClose=true;}
      if(d>12)t.wasClose=false;
    }
  }
  updateScooters(dt){
    for(const [i,t]of this.scooters.entries()){const old=t.group.position.clone();this.advanceTraffic(t,dt,4);this.collideMoving(t,old,dt,'scooter'+i);}
  }
  styleLighting(){
    this.renderer.toneMappingExposure=1.03;this.scene.fog.color.setHex(0xa9c2cb);this.scene.fog.density=.00048;
    this.hemiLight.intensity=1.12;this.hemiLight.color.setHex(0xe4eef0);this.hemiLight.groundColor.setHex(0x777365);
    this.dirLight.intensity=1.2;this.dirLight.color.setHex(0xffedd4);
    if(this.cityMats)for(const [key,m]of this.cityMats)if(key.startsWith('facade-')){m.bumpScale=.018;m.roughness=key.includes('glass')?.32:.88;}
  }
  updateCamera(dt=.016){
    super.updateCamera(dt);
    const wanted=this.camera.fov;this.streetFov=this.streetFov??wanted;this.streetFov+=(wanted-this.streetFov)*(1-Math.exp(-dt*7));this.camera.fov=this.streetFov;this.camera.updateProjectionMatrix();
    if(this.cameraMode===2)return;
    const from={x:this.carPos.x,y:this.carPos.y+1.7,z:this.carPos.z},delta={x:this.camera.position.x-from.x,z:this.camera.position.z-from.z};
    let tMin=1;
    for(const o of [...this.nearbyRectSolids({x:(from.x+this.camera.position.x)/2,z:(from.z+this.camera.position.z)/2,w:Math.abs(delta.x)+1,d:Math.abs(delta.z)+1,angle:0},1),...this.ceilingSlabs.map(o=>({...o,y:o.ceilingBottom,height:o.ceilingThickness||.28}))]){
      const r=this.rayRect(from,delta,o,.28);if(!r)continue;const y=from.y+(this.camera.position.y-from.y)*r.t;
      if(y>o.y-.25&&y<o.y+o.height+.25)tMin=Math.min(tMin,Math.max(.08,r.t-.035));
    }
    if(tMin<1){this.camera.position.set(from.x+delta.x*tMin,from.y+(this.camera.position.y-from.y)*tMin,from.z+delta.z*tMin);this.cameraOcclusions++;}
  }
}


/* P2 Preview module: taipei-geography.js */
/* WGS84 design anchors. Roads are hand-sampled and compressed ~1:5.
 * Preserve district relationships; never present this as navigation/survey data.
 * Underground topology is checked against Taipei Metro's station information map.
 * Source URLs, uncertainties and deliberate arcade adaptations: docs/EVOLUTION-V4.md.
 */
const TAIPEI_V4_AXES = {
 '市民大道':[[25.0492,121.5101],[25.0492,121.5134],[25.0492,121.5164],[25.0492,121.5205],[25.0473,121.5292],[25.0459,121.5375],[25.0447,121.5440],[25.0446,121.5490],[25.0446,121.5550],[25.0448,121.5613],[25.0452,121.5680],[25.0470,121.5772],[25.0490,121.5870]],
 '南京東西路':[[25.0534,121.5070],[25.0533,121.5134],[25.0529,121.5205],[25.0522,121.5330],[25.0520,121.5440],[25.0518,121.5490],[25.0515,121.5550],[25.0512,121.5630],[25.0511,121.5680],[25.0508,121.5772]],
 '八德路':[[25.0448,121.5292],[25.0450,121.5375],[25.0460,121.5440],[25.0483,121.5490],[25.0481,121.5550],[25.0480,121.5630],[25.0493,121.5700],[25.0497,121.5781]],
 '仁愛路':[[25.0382,121.5080],[25.0382,121.5190],[25.0382,121.5324],[25.0381,121.5440],[25.0381,121.5490],[25.0380,121.5550],[25.0380,121.5615],[25.0379,121.5680]],
 '信義路':[[25.0350,121.5080],[25.0340,121.5190],[25.0334,121.5324],[25.0330,121.5440],[25.0330,121.5490],[25.0330,121.5550],[25.0328,121.5654],[25.0326,121.5700]],
 '台北車站接駁線':[[25.0462,121.5080],[25.0462,121.5134],[25.0462,121.5164],[25.0462,121.5205]],
 '南京東路／松山線':[[25.0511,121.5680],[25.0507,121.5772],[25.0500,121.5781]],
 '八德東城線':[[25.0481,121.5550],[25.0480,121.5630],[25.0493,121.5700],[25.0497,121.5781]],
 '承德路／大稻埕':[[25.0492,121.5164],[25.0550,121.5173],[25.0630,121.5180],[25.0730,121.5186],[25.0800,121.5194],[25.0930,121.5167],[25.1080,121.5080],[25.1190,121.5050]],
 '長安東西路':[[25.0500,121.5070],[25.0500,121.5164],[25.0499,121.5205],[25.0482,121.5330],[25.0481,121.5440],[25.0482,121.5490],[25.0483,121.5530]],
 '中山北路／士林線':[[25.0480,121.5205],[25.0530,121.5220],[25.0630,121.5220],[25.0710,121.5240],[25.0800,121.5250],[25.0930,121.5270],[25.1050,121.5300],[25.1160,121.5330]],
 '北安路／敬業三路':[[25.0800,121.5250],[25.0830,121.5400],[25.0840,121.5490],[25.0838,121.5575]],
 '和平東路／公館':[[25.0267,121.5460],[25.0250,121.5550],[25.0240,121.5630]],
};
for(const r of TAIPEI_ROADS)if(TAIPEI_V4_AXES[r.name])r.pts=TAIPEI_V4_AXES[r.name];
// Named local streets give the west city small blocks; eastern boulevards stay broad.
TAIPEI_ROADS.push(
 {name:'塔城街',width:13,pts:[[25.0462,121.5101],[25.0492,121.5101],[25.0534,121.5101]]},
 {name:'太原路',width:12,pts:[[25.0492,121.5152],[25.0533,121.5152],[25.0570,121.5152]]},
 {name:'館前路',width:16,pts:[[25.0462,121.5149],[25.0435,121.5149]]},
 {name:'公園路',width:16,pts:[[25.0462,121.5178],[25.0430,121.5178],[25.0382,121.5178]]},
 {name:'迪化街',width:11,pts:[[25.0534,121.5096],[25.0590,121.5096],[25.0630,121.5098],[25.0670,121.5100]]},
 {name:'寧夏路',width:11,pts:[[25.0533,121.5150],[25.0567,121.5150],[25.0630,121.5150]]},
 {name:'赤峰街',width:10,pts:[[25.0530,121.5198],[25.0580,121.5198]]},
 {name:'林森南北路',width:17,pts:[[25.0382,121.5250],[25.0460,121.5250],[25.0530,121.5255],[25.0630,121.5257],[25.0680,121.5257]]},
 {name:'永康街',width:10,pts:[[25.0334,121.5292],[25.0285,121.5292],[25.0264,121.5292]]},
 {name:'大安路',width:13,pts:[[25.0418,121.5461],[25.0330,121.5461],[25.0267,121.5461]]},
 {name:'愛國東西路',width:18,pts:[[25.0350,121.5080],[25.0350,121.5135],[25.0340,121.5190],[25.0330,121.5220]]},
 {name:'基河路',width:16,pts:[[25.0720,121.5186],[25.0820,121.5210],[25.0882,121.5244],[25.0950,121.5240]]},
 {name:'天母東西路',width:16,pts:[[25.1190,121.5050],[25.1190,121.5250],[25.1180,121.5330],[25.1180,121.5400]]},
 {name:'石牌路／文林北路',width:18,pts:[[25.1080,121.5080],[25.1150,121.5160],[25.1160,121.5240],[25.1160,121.5330]]},
 {name:'北投大業路',width:20,pts:[[25.1080,121.5080],[25.1190,121.5050],[25.1320,121.4980],[25.1375,121.5030]]},
 {name:'北投光明路／中山路',width:14,pts:[[25.1320,121.4980],[25.1360,121.5015],[25.1375,121.5030],[25.1368,121.5065],[25.1360,121.5140]]},
 {name:'行義路／山線聯絡',width:14,pts:[[25.1160,121.5240],[25.1260,121.5270],[25.1360,121.5290],[25.1430,121.5320]]},
 {name:'南港路',width:22,pts:[[25.0497,121.5781],[25.0510,121.5870],[25.0520,121.6000],[25.0530,121.6070],[25.0550,121.6165]]},
 {name:'忠孝東路南港段',width:20,pts:[[25.0440,121.5870],[25.0480,121.6000],[25.0490,121.6070],[25.0520,121.6150],[25.0550,121.6165]]},
 {name:'經貿二路',width:18,pts:[[25.0520,121.6150],[25.0550,121.6165],[25.0600,121.6170]]},
 {name:'成功路／金龍路',width:19,pts:[[25.0810,121.6040],[25.0740,121.5900],[25.0640,121.5850],[25.0590,121.5790],[25.0520,121.6000]]},
 {name:'洲子街',width:14,pts:[[25.0800,121.5650],[25.0800,121.5750],[25.0800,121.5850]]},
 {name:'康寧路／東湖',width:17,pts:[[25.0810,121.6040],[25.0790,121.6100],[25.0680,121.6170],[25.0600,121.6170]]},
 {name:'興隆路四段／木新路',width:15,pts:[[25.0060,121.5430],[24.9910,121.5530],[24.9860,121.5620],[24.9890,121.5720],[24.9980,121.5790]]}
);
// V6.2 east-corridor fallback: a deliberately game-scaled local street mesh
// between the current West Core OSM slice and Xinyi. These are NOT presented as
// survey/navigation data. They are automatically clipped away when a future OSM
// slice covers the same area, so real open-data streets can replace them cleanly.
const TAIPEI_EAST_CORRIDOR_FALLBACK=[
 {name:'東區街廓 E1',width:10,pts:[[25.0470,121.5250],[25.0471,121.5310],[25.0470,121.5370],[25.0469,121.5430],[25.0468,121.5490],[25.0469,121.5550],[25.0470,121.5610],[25.0472,121.5670],[25.0472,121.5700]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 E2',width:9.5,pts:[[25.0432,121.5250],[25.0433,121.5310],[25.0432,121.5370],[25.0431,121.5430],[25.0430,121.5490],[25.0432,121.5550],[25.0431,121.5610],[25.0432,121.5670],[25.0433,121.5700]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 E3',width:9.5,pts:[[25.0397,121.5250],[25.0396,121.5310],[25.0397,121.5370],[25.0398,121.5430],[25.0396,121.5490],[25.0395,121.5550],[25.0397,121.5610],[25.0396,121.5670],[25.0396,121.5700]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 E4',width:9,pts:[[25.0362,121.5250],[25.0361,121.5310],[25.0362,121.5370],[25.0363,121.5430],[25.0362,121.5490],[25.0360,121.5550],[25.0361,121.5610],[25.0360,121.5670],[25.0360,121.5700]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 E5',width:9,pts:[[25.0295,121.5250],[25.0297,121.5310],[25.0296,121.5370],[25.0296,121.5430],[25.0294,121.5490],[25.0295,121.5550],[25.0293,121.5610],[25.0293,121.5630]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N1',width:9,pts:[[25.0260,121.5285],[25.0320,121.5286],[25.0380,121.5285],[25.0440,121.5284],[25.0500,121.5286],[25.0545,121.5285]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N2',width:9.5,pts:[[25.0260,121.5350],[25.0320,121.5351],[25.0380,121.5350],[25.0440,121.5349],[25.0500,121.5350],[25.0545,121.5351]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N3',width:9,pts:[[25.0260,121.5410],[25.0320,121.5411],[25.0380,121.5412],[25.0440,121.5410],[25.0500,121.5411],[25.0545,121.5410]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N4',width:9.5,pts:[[25.0260,121.5465],[25.0320,121.5464],[25.0380,121.5465],[25.0440,121.5466],[25.0500,121.5465],[25.0545,121.5466]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N5',width:9,pts:[[25.0260,121.5520],[25.0320,121.5521],[25.0380,121.5522],[25.0440,121.5520],[25.0500,121.5521],[25.0545,121.5520]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N6',width:9.5,pts:[[25.0260,121.5575],[25.0320,121.5576],[25.0380,121.5575],[25.0440,121.5574],[25.0500,121.5576],[25.0545,121.5575]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N7',width:9,pts:[[25.0260,121.5630],[25.0320,121.5631],[25.0380,121.5630],[25.0440,121.5629],[25.0500,121.5630],[25.0545,121.5632]],eastCorridorFallback:true,streamedRoad:true},
 {name:'東區街廓 N8',width:9.5,pts:[[25.0260,121.5685],[25.0320,121.5684],[25.0380,121.5685],[25.0440,121.5686],[25.0500,121.5685],[25.0545,121.5684]],eastCorridorFallback:true,streamedRoad:true}
];
const TAIPEI_EAST_STREAMED_NAMES=new Set([
 '忠孝東西路','市民大道','南京東西路','八德路','長安東西路','民生東西路','長春路','仁愛路','信義路','和平東路／公館',
 '新生南北路','建國南北路','松江路','復興南北路','大安路','敦化南北路','光復南北路','基隆路','松仁路','市府路／逸仙路'
]);
function taipeiDensifyRoadForStreaming(road,maxSegment=120){
 const pts=road?.pts;if(!Array.isArray(pts)||pts.length<2)return 0;const out=[pts[0]];let added=0;
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=(b[1]-a[1])*20000,dz=(b[0]-a[0])*22200,len=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(len/maxSegment));
  for(let s=1;s<=steps;s++){const q=s/steps;out.push([a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q]);if(s<steps)added++;}
 }
 road.pts=out;road.streamingDensifiedPoints=(road.streamingDensifiedPoints||0)+added;return added;
}
for(const road of TAIPEI_ROADS)if(TAIPEI_EAST_STREAMED_NAMES.has(road.name))road.streamedRoad=true;
for(const road of TAIPEI_EAST_CORRIDOR_FALLBACK)TAIPEI_ROADS.push(road);
let TAIPEI_EAST_STREAMING_DENSIFIED_POINTS=0;
for(const road of TAIPEI_ROADS)if(road.streamedRoad)TAIPEI_EAST_STREAMING_DENSIFIED_POINTS+=taipeiDensifyRoadForStreaming(road);

COURIER_ZONES.push(
 {name:'北投',lat:25.1368,lng:121.5065,tag:'溫泉外送'},
 {name:'南港',lat:25.055,lng:121.6165,tag:'展館急件'},
 {name:'大稻埕',lat:25.059,lng:121.5096,tag:'老街穿梭'},
 {name:'公館',lat:25.016,lng:121.533,tag:'校園宵夜'}
);
const TAIPEI_UNDERGROUND_LAYOUT = [
 {id:'Y',name:'台北地下街 Y 區',color:'#ffd23f',width:14,pts:[[25.0492,121.5101],[25.0492,121.5164],[25.0492,121.5183]],shops:['轉蛋轉到飽','阿北電玩補給','地下街炸物王'],source:'825 m east–west under Civic Boulevard'},
 {id:'YR',name:'北車東側連通廊',color:'#ffd23f',width:10,pts:[[25.0492,121.5183],[25.0492,121.5205]],shops:[]},
 {id:'R',name:'中山地下街 R 區',color:'#ff688c',width:12,pts:[[25.0492,121.5205],[25.0530,121.5205],[25.0578,121.5205]],shops:['迷路書店','赤峰咖啡續命','雙連早餐救援'],source:'Taipei Main–Zhongshan–Shuanglian'},
 {id:'Z',name:'站前地下街 Z 區',color:'#64dcff',width:12,pts:[[25.0462,121.5118],[25.0462,121.5164]],shops:['站前鞋子快跑','北車便當不迷路'],source:'west of station, under Zhongxiao West Road'},
 {id:'HALL',name:'台北車站非付費連通廊',color:'#a5ee65',width:10,pts:[[25.0462,121.5164],[25.0492,121.5164]],shops:[],source:'simplified transfer hall; no platforms or paid gates'}
];
// Stair/escalator locations and entrance groups are retained as district cues.
// Long, wide ramps are deliberate fictional arcade adaptations, not real access.
const TAIPEI_UNDERGROUND_ENTRIES = [
 {id:'Y27',name:'塔城街 · Y27 側',corridor:'Y',at:0,side:1},
 {id:'Y13',name:'太原路 · Y13 側',corridor:'Y',at:.60,side:1},
 {id:'Y1',name:'北車東側 · Y1 方向',corridor:'Y',at:.94,side:-1},
 {id:'R4',name:'中山站 · R 區',corridor:'R',at:.46,side:1},
 {id:'R9',name:'雙連方向 · R 區',corridor:'R',at:.94,side:-1},
 {id:'Z',name:'忠孝西路 · Z 區',corridor:'Z',at:.22,side:-1}
];


/* P2 Preview module: taipei-arcade.js */
/* 4.0 Taipei Comic Rush. Original toon art and arcade delivery presentation.
 * Surface terrain is never lowered globally: stacked floors remain independent.
 */
class TaipeiStreetCourier extends TaipeiStreetCourierBase {
  constructor(){
    super();this.streetVersion='4.0.0';this.riderHeight=2.6;
    this.ugFloor=-7.8;this.ugClearance=3.75;this.ugPassages=[];this.ugEntries=[];
    this.ugCells=new Set();this.markerTime=0;this.mapLayer='surface';
  }
  async init(){
    await super.init();
    document.querySelectorAll('.driver-avatar').forEach((el,i)=>{
      el.style.backgroundImage='none';el.innerHTML=this.driverPortrait(i,DRIVERS[['lin','chen','mei','zhou'][i]].color);
    });
    this.arcadeDeliverySpots=null;this.customers.forEach((c,i)=>{
      c.arcadeChoices=null;c.destination=this.orderDestination(c,i);this.decorateOrder(c);
    });
    this.buildStopFrame();this.buildCityMascots();this.flushExtraInstances();
    this.styleLighting();this.updateNavigation();this.updateHUD();
    document.getElementById('map-layer-button').addEventListener('click',()=>{
      this.mapLayer=this.mapLayer==='surface'?'underground':'surface';this.drawCityMap();
    });
    this.streetReady=true;
  }
  // High contrast comic elevations. No photographic facade atlas is used in v4.
  makeTexture(kind,variant=0){
    if(!['facade','glass','shopfront','asphalt','tile','ground'].includes(kind))return super.makeTexture(kind,variant);
    this.cityTextures=this.cityTextures||new Map();const key='comic:'+kind+variant;
    if(this.cityTextures.has(key))return this.cityTextures.get(key);
    const cv=document.createElement('canvas');cv.width=cv.height=1024;const c=cv.getContext('2d');
    const palette=['#ffd897','#fb9483','#73d9d1','#baacff','#b8de86','#83bbe8'],ink='#253747';
    c.fillStyle=kind==='asphalt'?'#42566c':kind==='ground'?'#efdba9':kind==='tile'?'#fff0c8':palette[variant%6];c.fillRect(0,0,1024,1024);
    c.strokeStyle=ink;c.lineWidth=8;
    if(kind==='facade'||kind==='glass'){
      for(let y=30;y<1024;y+=170)for(let x=34;x<1024;x+=160){
        c.fillStyle=kind==='glass'?'#45bfd7':'#365b81';c.fillRect(x,y,110,111);c.strokeRect(x,y,110,111);
        c.fillStyle='#9af5ed';c.beginPath();c.moveTo(x+10,y+10);c.lineTo(x+63,y+10);c.lineTo(x+10,y+63);c.closePath();c.fill();
        c.fillStyle='#fff6d0';c.fillRect(x-9,y+112,131,14);c.strokeRect(x-9,y+112,131,14);
        if(kind==='facade'&&(x+y+variant)%3===0){c.fillStyle='#fff8ea';c.fillRect(x+70,y+131,50,26);c.strokeRect(x+70,y+131,50,26);c.fillStyle=ink;c.fillRect(x+78,y+139,32,8);}
      }
    }else if(kind==='shopfront'){
      for(let x=10;x<1024;x+=256){c.fillStyle='#20374c';c.fillRect(x,285,236,650);c.strokeRect(x,285,236,650);c.fillStyle=palette[(variant+x/256|0)%6];c.fillRect(x,70,236,175);c.strokeRect(x,70,236,175);c.fillStyle='#fff5d2';c.font='900 60px "Noto Sans TC"';c.textAlign='center';c.fillText(['吃飽','快送','再一杯','開店'][Math.floor(x/256)],x+118,179);c.fillStyle='#81ddd4';c.fillRect(x+18,332,91,460);c.fillStyle='#fff1a3';c.fillRect(x+131,360,79,270);}
    }else if(kind==='tile'||kind==='ground'){
      c.strokeStyle=kind==='tile'?'#d2ae7d':'#e4c594';c.lineWidth=4;
      for(let n=0;n<=1024;n+=128){c.beginPath();c.moveTo(n,0);c.lineTo(n,1024);c.moveTo(0,n);c.lineTo(1024,n);c.stroke();}
      if(kind==='tile'){c.fillStyle='#f1ca7b';for(let y=0;y<1024;y+=256)for(let x=0;x<1024;x+=256)c.fillRect(x+8,y+8,110,110);}
    }else{c.fillStyle='#5c7189';for(let y=24;y<1024;y+=170)for(let x=24;x<1024;x+=180)c.fillRect(x,y,36,7);}
    const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;
    this.cityTextures.set(key,t);return t;
  }
  mat(key,color=0xffffff,kind=null,variant=0){
    this.cityMats=this.cityMats||new Map();if(this.cityMats.has(key))return this.cityMats.get(key);
    if(!this.toonGradient){// r136+ 的 toon gradient 只取 .r；WebGL2 的 LuminanceFormat 在 r137+ 會變暗，故 WebGL2 改用 RedFormat（WebGL1 維持 Luminance）。
      this.toonGradient=new THREE.DataTexture(new Uint8Array([80,160,255]),3,1,this.renderer?.capabilities?.isWebGL2?THREE.RedFormat:THREE.LuminanceFormat);this.toonGradient.minFilter=this.toonGradient.magFilter=THREE.NearestFilter;this.toonGradient.needsUpdate=true;}
    const m=new THREE.MeshToonMaterial({color,map:kind?this.makeTexture(kind,variant):null,gradientMap:this.toonGradient});
    this.cityMats.set(key,m);return m;
  }
  streetShopSign(i){
    this.comicSigns=this.comicSigns||new Map();i=((i%24)+24)%24;if(this.comicSigns.has(i))return this.comicSigns.get(i);
    const names=['豆漿大聯萌','松鬆燒臘快打','站錢茶舖','笑到發麵線','艋甲鹽酥基','大稻埕埕咖啡','忠笑東滷味','寧夏不夜炸','貓空空烏龍','內湖嚕便當','士林不士氣','台北衝衝快送','信義巨巨雞排','古亭趕課早餐','木柵不木納','大安飯糰王','延三夜奔飯','南機場不飛','永康續命茶','民生大聲炒','八德八顆餃','中山救白衫','華西甜湯堡','光華修到好'];
    const colors=['#ff6858','#ffcc39','#53d9c7','#8f99ff'];
    const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const c=cv.getContext('2d');
    c.fillStyle='#172e43';c.fillRect(0,0,1024,256);c.fillStyle=colors[i%4];c.fillRect(10,10,1004,236);
    c.strokeStyle='#fff7d5';c.lineWidth=5;c.strokeRect(23,23,978,210);
    c.textAlign='left';c.font='900 88px "Noto Sans TC"';c.lineWidth=12;c.strokeStyle='#17334c';c.strokeText(names[i],45,126,790);c.fillStyle='#fff5d3';c.fillText(names[i],45,126,790);
    c.fillStyle='#18354c';c.font='bold 35px "Noto Sans TC"';c.fillText('吃飽再爆走！  •  TAIPEI',49,200,815);
    c.fillStyle='#fff8dc';c.beginPath();c.arc(929,116,51,0,Math.PI*2);c.fill();c.strokeStyle='#17334c';c.lineWidth=8;c.stroke();
    c.fillStyle='#17334c';for(const x of [912,945]){c.beginPath();c.arc(x,105,6,0,Math.PI*2);c.fill();}c.beginPath();c.arc(929,113,23,.15,Math.PI-.15);c.stroke();
    const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});this.comicSigns.set(i,m);return m;
  }
  styleLighting(){
    this.renderer.toneMappingExposure=1.14;this.scene.fog.color.setHex(this.isNight?0x233857:0x9ce4eb);this.scene.fog.density=this.isNight?.0008:.00038;
    this.hemiLight.intensity=1.05;this.hemiLight.color.setHex(0xfff6d4);this.hemiLight.groundColor.setHex(0x586499);this.dirLight.intensity=1.4;this.dirLight.color.setHex(0xffffff);
  }
  applyLighting(){super.applyLighting();if(this.renderer)this.styleLighting();}
  driverPortrait(i,color){
    const key=['lin','chen','mei','zhou'][i]||'lin';
    const cfg={
      lin:{fur:'#d98a42',light:'#ffe0b3',mark:'#6d462a',eye:'#4f785f',ears:'cat',acc:'#8d5836'},
      chen:{fur:'#f3ead8',light:'#fffaf0',mark:'#746d70',eye:'#66aee8',ears:'cat',acc:'#b9824b'},
      mei:{fur:'#dc8438',light:'#fff0cf',mark:'#7a4528',eye:'#49362e',ears:'dog',acc:'#3188c8'},
      zhou:{fur:'#788596',light:'#f6f4eb',mark:'#384859',eye:'#78c4e8',ears:'dog',acc:'#b7433b'}
    }[key];
    const ear=cfg.ears==='cat'
      ?'<path d="M13 20 17 4 26 17M47 20 43 4 34 17" fill="'+cfg.mark+'" stroke="#203747" stroke-width="2"/>'
      :'<path d="M13 21 12 6 24 17M47 21 48 6 36 17" fill="'+cfg.mark+'" stroke="#203747" stroke-width="2"/>';
    const mask=key==='chen'?'<ellipse cx="30" cy="29" rx="14" ry="13" fill="'+cfg.mark+'" opacity=".94"/><path d="M18 33q12-8 24 0v11H18z" fill="'+cfg.light+'"/>':
      key==='zhou'?'<path d="M17 23q6-10 13 0 7-10 13 0l-4 20H21z" fill="'+cfg.light+'"/>':'';
    const stripes=key==='lin'?'<path d="M24 17l3 7m3-8v8m6-7-3 7M16 30l7 2m21-2-7 2" stroke="'+cfg.mark+'" stroke-width="2.4" stroke-linecap="round"/>':'';
    const hat=key==='chen'
      ?'<path d="M12 16h36l-4-7H16z" fill="'+cfg.acc+'" stroke="#203747" stroke-width="2"/><path d="M20 10q10-9 20 0v5H20z" fill="#c9975b" stroke="#203747" stroke-width="2"/><circle cx="24" cy="11" r="4" fill="#243a4b"/><circle cx="36" cy="11" r="4" fill="#243a4b"/>'
      :key==='lin'
      ?'<path d="M17 14q13-12 26 0v6H17z" fill="'+cfg.acc+'" stroke="#203747" stroke-width="2"/><circle cx="24" cy="15" r="4" fill="#284b60"/><circle cx="36" cy="15" r="4" fill="#284b60"/>'
      :key==='zhou'
      ?'<path d="M15 16q15-16 30 0v6H15z" fill="'+cfg.acc+'" stroke="#203747" stroke-width="2"/><circle cx="30" cy="5" r="4" fill="#f2e6cf"/>'
      :'';
    const scarf=key==='mei'?'<path d="M14 49h32l-5 8-11-4-11 4z" fill="#3188c8" stroke="#203747" stroke-width="2"/>':
      key==='zhou'?'<path d="M13 49h34l-4 8-13-4-13 4z" fill="#b7433b" stroke="#203747" stroke-width="2"/>':'';
    return `<svg viewBox="0 0 60 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 64q2-20 22-20t22 20" fill="${cfg.fur}"/>${scarf}${ear}
      <ellipse cx="30" cy="31" rx="20" ry="20" fill="${cfg.fur}" stroke="#203747" stroke-width="2"/>${mask}${stripes}${hat}
      <ellipse cx="23" cy="30" rx="4.2" ry="5.2" fill="${cfg.eye}"/><ellipse cx="37" cy="30" rx="4.2" ry="5.2" fill="${cfg.eye}"/>
      <circle cx="23" cy="31" r="2.1" fill="#182735"/><circle cx="37" cy="31" r="2.1" fill="#182735"/>
      <ellipse cx="30" cy="39" rx="11" ry="7" fill="${cfg.light}"/><path d="M27 38q3-3 6 0l-3 3z" fill="#382c2c"/>
      <path d="M30 41q-4 4-8 1M30 41q4 4 8 1" fill="none" stroke="#684a42" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  }
  buildCourierVariant(key){
    const g=new THREE.Group();g.name='courier-'+key;this.chassisMesh.add(g);
    const defs={
      lin:{fur:0xd98a42,light:0xffe0b3,mark:0x6d462a,eye:0x4f785f,acc:0x8d5836},
      chen:{fur:0xf3ead8,light:0xfffaf0,mark:0x746d70,eye:0x66aee8,acc:0xb9824b},
      mei:{fur:0xdc8438,light:0xfff0cf,mark:0x7a4528,eye:0x49362e,acc:0x3188c8},
      zhou:{fur:0x788596,light:0xf6f4eb,mark:0x384859,eye:0x78c4e8,acc:0xb7433b}
    },d=defs[key],fur=this.mat('courier-'+key+'-fur',d.fur),light=this.mat('courier-'+key+'-light',d.light),mark=this.mat('courier-'+key+'-mark',d.mark),eye=this.mat('courier-'+key+'-eye',d.eye),ink=this.mat('courier-'+key+'-ink',0x203747),acc=this.mat('courier-'+key+'-acc',d.acc);
    const sphere=(r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=this.mesh(g,new THREE.SphereGeometry(r,14,10),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
    const cone=(r,h,mat,x,y,z,rz=0)=>{const m=this.mesh(g,new THREE.ConeGeometry(r,h,3),mat,x,y,z);m.rotation.z=rz;return m;};
    const torus=(R,r,mat,x,y,z,rx=0)=>{const geo=new THREE.TorusGeometry(R,r,6,18);geo.rotateX(rx);return this.mesh(g,geo,mat,x,y,z);};
    // Fluffy seated body and paws cover the legacy human rider while keeping the proven bike rig.
    sphere(.36,fur,0,1.43,-.04,.88,1.18,.74);
    sphere(.24,light,0,1.48,.20,.95,1.2,.35);
    for(const side of [-1,1]){
      sphere(.095,light,side*.31,1.21,.54,1.05,.8,1.2);
      sphere(.105,light,side*.23,.46,.28,1.0,.7,1.45);
    }
    // Head, ears, eyes and muzzle.
    sphere(.36,fur,0,2.08,.08,1.05,1.03,.92);
    if(key==='lin'||key==='chen'){
      cone(.17,.36,mark,-.19,2.37,.05,-.12);cone(.17,.36,mark,.19,2.37,.05,.12);
    }else{
      cone(.18,.34,mark,-.19,2.34,.04,-.18);cone(.18,.34,mark,.19,2.34,.04,.18);
    }
    if(key==='chen')sphere(.28,mark,0,2.08,.29,.93,.86,.27);
    if(key==='zhou'){
      sphere(.18,light,-.10,2.10,.29,.78,1.05,.22);sphere(.18,light,.10,2.10,.29,.78,1.05,.22);
      sphere(.16,light,0,1.98,.31,1.0,.75,.23);
    }
    for(const side of [-1,1]){
      sphere(.062,eye,side*.13,2.12,.398,1,1.12,.55);
      sphere(.025,ink,side*.13,2.12,.435,1,1,.45);
    }
    sphere(.12,light,-.065,2.01,.37,1,.72,.45);sphere(.12,light,.065,2.01,.37,1,.72,.45);
    sphere(.048,ink,0,2.035,.475,1.1,.75,.65);
    if(key==='lin'){
      for(const [x,y,a] of [[0,2.31,0],[-.07,2.28,-.25],[.07,2.28,.25]]){const s=this.box(g,.025,.13,.018,mark,x,y,.395);s.rotation.z=a;}
      // Pilot cap and goggles.
      sphere(.31,acc,0,2.31,.035,1.0,.55,.95);torus(.075,.018,ink,-.10,2.30,.285);torus(.075,.018,ink,.10,2.30,.285);this.box(g,.12,.018,.018,ink,0,2.30,.285);
      // Ringed tabby tail visible beside the delivery box.
      for(let n=0;n<6;n++){const t=n/5,s=sphere(.12-n*.007,n%2?mark:fur,.43+n*.045,1.10+n*.08,-.56-n*.09,1,1.05,1.25);s.rotation.x=.35;}
    }else if(key==='chen'){
      // 梅醬: blue-point Ragdoll inspired by the supplied photos: cream coat, grey mask/ears/tail, blue eyes.
      const brim=this.mesh(g,new THREE.CylinderGeometry(.42,.42,.045,18),acc,0,2.43,.03);
      const crown=this.mesh(g,new THREE.CylinderGeometry(.22,.27,.20,14),this.mat('courier-chen-hat',0xc99a62),0,2.53,.03);
      torus(.072,.018,ink,-.10,2.52,.245);torus(.072,.018,ink,.10,2.52,.245);this.box(g,.11,.018,.018,ink,0,2.52,.245);
      // Explorer side satchels and compass/map case.
      for(const side of [-1,1]){this.box(g,.30,.42,.18,this.mat('courier-chen-leather',0x8d5b39),side*.53,1.35,-.83);this.box(g,.22,.035,.20,acc,side*.53,1.57,-.83);}
      const compass=sphere(.105,this.mat('courier-chen-compass',0xf2df9d),-.42,1.25,.58,1,.15,1);torus(.105,.015,ink,-.42,1.25,.59);
      // Large fluffy grey tail, offset so the chase camera can read it clearly.
      for(let n=0;n<7;n++){const t=n/6,tail=sphere(.15-n*.006,mark,.48+.10*Math.sin(t*Math.PI),1.10+.22*t,-.58-.12*n,1.15,1.05,1.45);tail.rotation.x=.25;}
    }else if(key==='mei'){
      // Shiba scarf and phone mount.
      torus(.255,.055,acc,0,1.78,.06,Math.PI/2);this.box(g,.11,.34,.05,acc,.18,1.60,.17).rotation.z=-.22;
      this.box(g,.16,.26,.045,ink,.31,1.39,.68);this.box(g,.12,.18,.052,this.mat('courier-mei-phone',0x91d6df),.31,1.39,.705);
      // Curled Shiba tail.
      const pts=[[.40,1.16,-.55],[.53,1.28,-.70],[.55,1.43,-.83],[.43,1.55,-.90],[.31,1.49,-.82]];
      for(const [x,y,z] of pts)sphere(.115,fur,x,y,z,1,1,1.25);
    }else{
      // Husky winter beanie/scarf and insulated crate details.
      sphere(.31,acc,0,2.34,.035,1,.52,.96);torus(.27,.045,acc,0,2.25,.04,Math.PI/2);sphere(.075,light,0,2.53,.02);
      torus(.26,.06,acc,0,1.78,.04,Math.PI/2);this.box(g,.12,.38,.05,acc,-.20,1.58,.15).rotation.z=.16;
      for(const x of [-.31,.31])this.box(g,.025,.52,.03,this.mat('courier-zhou-crate',0xb8c3c8),x,1.37,-1.21);
      // Curled grey/white tail.
      const pts=[[.43,1.12,-.56],[.54,1.26,-.70],[.55,1.43,-.80],[.45,1.55,-.82],[.34,1.49,-.72]];
      pts.forEach(([x,y,z],n)=>sphere(.12,n>2?light:mark,x,y,z,1,1,1.22));
    }
    return g;
  }
  buildPlayerTaxi(){
    super.buildPlayerTaxi();
    // Replace the human head/helmet silhouette with animal-specific heads; keep the tested bike/body rig.
    for(const m of this.chassisMesh.children){
      if(m.position?.y>1.70&&m.position?.z>-.30)m.visible=false;
    }
    this.courierVariants={};
    for(const key of ['lin','chen','mei','zhou'])this.courierVariants[key]=this.buildCourierVariant(key);
    this.updatePlayerTaxiModel();
    this.carGroup.userData.collision.height=this.riderHeight;
  }
  updatePlayerTaxiModel(){
    super.updatePlayerTaxiModel();
    if(!this.courierVariants)return;
    for(const [key,g] of Object.entries(this.courierVariants))g.visible=key===this.selectedDriverKey;
  }
  relocateOrders(){
    super.relocateOrders();
    const occupied=[];
    this.customers.forEach((c,i)=>{
      const r=this.snapRoad(c.group.position),len=Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),rx=(r.b.z-r.a.z)/len,rz=-(r.b.x-r.a.x)/len,w=TAIPEI_ROADS[r.ri].width/1.7;
      let selected=null;
      for(const offset of [0,12,-12,24,-24,36,-36,48,-48,72,-72]){
        for(const side of [1,-1]){
          const t=Math.max(.02,Math.min(.98,r.t+offset/len)),p={x:r.a.x+(r.b.x-r.a.x)*t+rx*side*(w/2+3.5),z:r.a.z+(r.b.z-r.a.z)*t+rz*side*(w/2+3.5)},nearest=this.snapRoad(p);
          if(nearest.distance-2.8<TAIPEI_ROADS[nearest.ri].width/1.7/2+.1||occupied.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<9))continue;
          selected=p;break;
        }
        if(selected)break;
      }
      if(!selected)throw new Error('找不到安全的路邊接單點：'+c.shop);
      c.group.position.set(selected.x,this.getTerrainHeight(selected.x,selected.z),selected.z);occupied.push(selected);
      c.stopRadius=2.8;c.pickupLayer='surface';c.arcadeChoices=null;
      c.ring.geometry.dispose();c.ring.geometry=new THREE.RingGeometry(2.45,2.8,48).rotateX(-Math.PI/2);
      c.destination=this.orderDestination(c,i);
    });
  }
  isReservedSite(o){
    return this.customers.some(c=>this.rectsOverlap(o,{x:c.group.position.x,z:c.group.position.z,w:7,d:7,angle:0},.4))||this.ugEntries.some(r=>this.rectsOverlap(o,r,1));
  }
  decorateOrder(c){
    super.decorateOrder(c);
    const label=c.arcadeLabel;label.scale.set(10,3.1,1);label.position.y=5.5;
    // Clear stacked old shop labels so one task beacon owns the silhouette.
    for(const s of [...c.group.children])if(s.isSprite&&s!==label&&s!==c.moneyMark){c.group.remove(s);s.material.map?.dispose();s.material.dispose();}
    if(!c.moneyMark){c.moneyMark=this.makeLabel('配送取貨',c.tier.css);c.moneyMark.scale.set(3.8,1.2,1);c.moneyMark.position.set(0,3.45,0);c.group.add(c.moneyMark);}
    if(c.moneyMark.parent!==c.group)c.group.add(c.moneyMark);
    c.moneyMark.material.color.setHex(0x83c8cf);c.ring.visible=false;c.icon.visible=false;
    if(!c.pickupReceipt){const receipt=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.8).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe5e3cf,side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false}));receipt.position.y=.07;receipt.name='courier-pickup-receipt';c.pickupReceipt=receipt;c.group.add(receipt);}
  }
  flushExtraInstances(){
    const previous=this.instanceMeshes;this.flushInstances();this.instanceMeshes=[...previous,...this.instanceMeshes];
  }
  buildCityMascots(){
    const ink=this.mat('mascot-ink',0x20334c),white=this.mat('mascot-white',0xfff6d2);
    for(const [i,g] of this.landmarkGroups.entries()){
      if(!['台北101','台北車站','西門紅樓'].includes(g.name))continue;
      const bounds=new THREE.Box3().setFromObject(g),h=bounds.max.y-g.position.y;
      const face=new THREE.Group();face.position.set(0,h*.57,-(bounds.max.z-bounds.min.z)/2-.08);g.add(face);
      for(const side of [-1,1]){this.mesh(face,new THREE.SphereGeometry(.9,12,8),white,side*2.5,0,0).scale.set(1,1.3,.18);this.mesh(face,new THREE.SphereGeometry(.34,10,8),ink,side*2.5,0,-.22);}
      this.box(face,3.4,.26,.2,ink,0,-2,-.12);
      g.userData.comicLandmark=true;
    }
  }
  // --- Independent B1 network and continuous entrance ramps ---
  passagePoint(s,t,side=0){return {x:s.a.x+(s.b.x-s.a.x)*t+Math.cos(s.angle)*side,z:s.a.z+(s.b.z-s.a.z)*t-Math.sin(s.angle)*side,y:this.ugFloor};}
  undergroundAt(p){return this.ugPassages.find(s=>this.overlaps(p,{x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,w:s.width,d:s.length,angle:s.angle},-.1));}
  rampAt(p){return this.ugEntries.find(r=>this.overlaps(p,r,-.05)&&(!Number.isFinite(p.y)||p.y<=this.rampHeight(r,p)+1.4||this.overlaps(p,r.surfaceOpening||r,0)));}
  rampHeight(r,p){const q=this.localXZ(p,r),t=Math.max(0,Math.min(1,(q.z+r.d/2)/r.d));return r.top.y+(r.bottom.y-r.top.y)*t;}
  isBelowGround(p){return p.y<this.getTerrainHeight(p.x,p.z)-2;}
  buildUndergroundStreet(){
    this.ugPassages=[];this.ugEntries=[];this.ugCells=new Set();this.undergroundZones=[];
    const floor=this.ugFloor,cell=1;
    for(const def of TAIPEI_UNDERGROUND_LAYOUT){const pts=def.pts.map(p=>this.latLngToWorld(...p));
      for(let i=1;i<pts.length;i++){const a={...pts[i-1],y:floor},b={...pts[i],y:floor},angle=Math.atan2(b.x-a.x,b.z-a.z),length=Math.hypot(b.x-a.x,b.z-a.z);
        const s={a,b,angle,length,width:def.width,def};this.ugPassages.push(s);
        this.undergroundZones.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:def.width,d:length,angle,y:floor,name:def.name});
      }
    }
    for(const def of TAIPEI_UNDERGROUND_ENTRIES){
      const segments=this.ugPassages.filter(s=>s.def.id===def.corridor),total=segments.reduce((n,s)=>n+s.length,0);let d=Math.max(4,Math.min(total-4,total*def.at)),s=segments[0];
      for(const segment of segments){s=segment;if(d<=s.length)break;d-=s.length;}
      const at=this.passagePoint(s,Math.min(1,d/s.length)),nx=Math.cos(s.angle)*def.side,nz=-Math.sin(s.angle)*def.side;
      const bottom={x:at.x+nx*(s.width/2-3),z:at.z+nz*(s.width/2-3),y:floor};
      const top={x:bottom.x+nx*26,z:bottom.z+nz*26,y:0};top.y=this.getTerrainHeight(top.x,top.z);
      const r={...def,x:(top.x+bottom.x)/2,z:(top.z+bottom.z)/2,w:6.6,d:26,angle:Math.atan2(bottom.x-top.x,bottom.z-top.z),top,bottom,at,kind:'entrance-ramp'};
      this.ugEntries.push(r);
    }
    this.fitUndergroundEntrances?.();
    // Union the corridors so junctions have no internal wall, ceiling seam or overlap.
    for(const s of this.ugPassages){const rect={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,w:s.width,d:s.length+1,angle:s.angle};
      const radius=Math.hypot(rect.w,rect.d)/2;for(let ix=Math.floor(rect.x-radius);ix<=Math.ceil(rect.x+radius);ix++)for(let iz=Math.floor(rect.z-radius);iz<=Math.ceil(rect.z+radius);iz++)if(this.overlaps({x:ix+.5,z:iz+.5},rect,0))this.ugCells.add(ix+','+iz);
    }
    const g=new THREE.Group();g.name='Taipei B1 / Y–R–Z';this.undergroundRoot=g;this.scene.add(g);
    const floorMat=this.mat('ug-comic-floor',0xffffff,'tile'),wallMat=this.mat('ug-comic-wall',0xffdfa0),roofMat=this.mat('ug-comic-ceiling',0xede3bc),light=this.mat('ug-comic-light',0xfffaf1);
    const floorVertices=[],floorUV=[],roofVertices=[],roofUV=[],roofRows=new Map();
    const tile=(v,uv,x,z,y)=>{v.push(x,y,z,x,y,z+cell,x+cell,y,z,x+cell,y,z,x,y,z+cell,x+cell,y,z+cell);uv.push(x/8,z/8,x/8,(z+1)/8,(x+1)/8,z/8,(x+1)/8,z/8,x/8,(z+1)/8,(x+1)/8,(z+1)/8);};
    for(const key of this.ugCells){const [x,z]=key.split(',').map(Number);tile(floorVertices,floorUV,x,z,floor);
      if(!this.ugEntries.some(r=>this.overlaps({x:x+.5,z:z+.5},r,.6))){
        tile(roofVertices,roofUV,x,z,floor+this.ugClearance);
        if(!roofRows.has(z))roofRows.set(z,[]);roofRows.get(z).push(x);
      }
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        if(this.ugCells.has((x+dx)+','+(z+dz)))continue;const wx=x+.5+dx*.5,wz=z+.5+dz*.5;
        if(this.ugEntries.some(r=>this.overlaps({x:wx,z:wz},r,.35)))continue;
        const o={x:wx,z:wz,w:dx?.22:1,d:dz?.22:1,y:floor,height:-.12-floor,angle:0,kind:'underground-wall'};
        this.instance('ug-boundary-walls',wallMat,wx,floor+o.height/2,wz,o.w,o.height,o.d);this.streetSolids.push(o);this.addSpatialSolid(o);
      }
    }
    const surface=(v,uv,mat,name)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const m=this.mesh(g,geo,mat);m.name=name;return m;};
    surface(floorVertices,floorUV,floorMat,'B1 continuous floor');
    const ceiling=surface(roofVertices,roofUV,roofMat,'B1 ceiling');ceiling.material.side=THREE.DoubleSide;
    // Merge the exact visible roof cells into rectangles, preserving every ramp
    // aperture. Centerline slabs would seal part of a mouth or leave invisible gaps.
    const roofRects=[],active=new Map();
    for(const [z,xs] of [...roofRows].sort((a,b)=>a[0]-b[0])){
      xs.sort((a,b)=>a-b);const spans=[];let start=xs[0],end=start;
      for(const x of xs.slice(1)){if(x===end+1)end=x;else{spans.push([start,end+1]);start=end=x;}}spans.push([start,end+1]);
      for(const [a,b] of spans){const key=a+':'+b,previous=active.get(key);if(previous&&previous.z1===z)previous.z1=z+1;else{const rect={x0:a,x1:b,z0:z,z1:z+1};roofRects.push(rect);active.set(key,rect);}}
    }
    for(const r of roofRects)this.ceilingSlabs.push({x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2,w:r.x1-r.x0,d:r.z1-r.z0,angle:0,y:floor,ceilingBottom:floor+this.ugClearance,ceilingThickness:.25,tag:'B1 地下街天花'});
    for(const s of this.ugPassages){
      const mid=this.passagePoint(s,.5);
      for(let d=6;d<s.length;d+=15){const p=this.passagePoint(s,d/s.length);this.instance('ug-strip-lights',light,p.x,floor+3.68,p.z,s.width*.72,.06,.3,s.angle);
        if((d-6)%30===0){const label=this.makeLabel(s.def.id+'  '+s.def.name+'\n'+(s.def.id==='Y'?'← 北門・塔城街   台北車站 →':s.def.id==='R'?'← 台北車站   中山・雙連 →':'站前連通 / B1'),s.def.color);label.position.set(p.x,floor+3.1,p.z);label.scale.set(5.2,1,1);label.userData.ugSign=true;g.add(label);}
      }
      const shops=s.def.shops;
      for(let i=0;i<shops.length;i++){
        const p=this.passagePoint(s,(i+1)/(shops.length+1),s.width/2-1.7),r={x:p.x,z:p.z,w:2.6,d:7,height:3.1,y:floor,angle:s.angle,kind:'underground-shop'};
        if(this.ugEntries.some(entry=>this.rectsOverlap(r,entry,1)))continue;
        this.instance('ug-shop-blocks',this.mat('ug-shop-'+s.def.id,parseInt(s.def.color.slice(1),16)),p.x,floor+1.55,p.z,2.6,3.1,7,s.angle);this.streetSolids.push(r);this.addSpatialSolid(r);
        const sign=this.makeLabel(shops[i],s.def.color);sign.position.set(p.x,floor+2.8,p.z);sign.scale.set(5,1.2,1);g.add(sign);
      }
      this.undergroundZones.find(z=>z.name===s.def.name).floorY=floor;
    }
    this.buildEntranceRamps();this.cutEntranceHoles();this.buildUndergroundNavigation();
  }
  buildEntranceRamps(){
    for(const r of this.ugEntries){const g=new THREE.Group();g.name=r.id+' arcade entrance';g.position.set(r.x,0,r.z);g.rotation.y=r.angle;
      const hw=r.w/2,hd=r.d/2,v=[-hw,r.top.y,-hd,-hw,r.bottom.y,hd,hw,r.top.y,-hd,hw,r.top.y,-hd,-hw,r.bottom.y,hd,hw,r.bottom.y,hd];
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,3,1,0,1,0,0,3,1,3],2));geo.computeVertexNormals();this.mesh(g,geo,this.mat('ug-ramp-comic',0xffffff,'ramp'));this.scene.add(g);
      // Continuous swept side walls follow the ramp instead of a jump launch.
      for(let step=0;step<Math.ceil(r.d);step++){const t=(step+.5)/Math.ceil(r.d),p={x:r.top.x+(r.bottom.x-r.top.x)*t,z:r.top.z+(r.bottom.z-r.top.z)*t},y=this.rampHeight(r,p),h=Math.max(1.05,this.getTerrainHeight(p.x,p.z)-y-.08);
        for(const side of [-1,1]){const x=p.x+Math.cos(r.angle)*side*(hw+.13),z=p.z-Math.sin(r.angle)*side*(hw+.13),o={x,z,w:.24,d:1.03,y,height:h,angle:r.angle,kind:'entrance-wall'};
          this.instance('ug-ramp-walls',this.mat('ug-ramp-wall',0x53cabc),x,y+h/2,z,.24,h,1.03,r.angle);this.streetSolids.push(o);this.addSpatialSolid(o);
        }
      }
      const canopy=this.makeLabel(r.name+'\nB1 ↓ 遊戲改編坡道', '#fff19a');canopy.position.set(r.top.x,r.top.y+4.7,r.top.z);canopy.scale.set(9.4,2.7,1);this.scene.add(canopy);
      r.group=g;
    }
  }
  // Subtract exact rectangles from existing triangles. Ground, asphalt and route
  // holes agree with physics; no lowered global terrain or invisible portal warp.
  subtractPortal(poly,r){
    let inside=poly,out=[];const tests=[p=>r.w/2-this.localXZ(p,r).x,p=>r.w/2+this.localXZ(p,r).x,p=>r.d/2-this.localXZ(p,r).z,p=>r.d/2+this.localXZ(p,r).z];
    const clip=(points,fn,positive)=>{const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=fn(a),db=fn(b),ina=positive?da>=0:da<=0,inb=positive?db>=0:db<=0;if(ina)result.push(a);if(ina!==inb){const t=da/(da-db),q={};for(const k of Object.keys(a))q[k]=a[k]+(b[k]-a[k])*t;result.push(q);}}return result;};
    for(const fn of tests){if(!inside.length)break;const outside=clip(inside,fn,false);if(outside.length>=3)out.push(outside);inside=clip(inside,fn,true);}return out;
  }
  cutEntranceHoles(){
    for(const mesh of [this.groundMesh,this.roadMesh,this.openGeoNarrowRoadMesh,this.openGeoSidewalkMesh].filter(Boolean)){
      const geo=mesh.geometry,attrs=geo.attributes,idx=geo.index,vertices=[],uv=[],colors=[];
      const count=idx?idx.count:attrs.position.count;
      for(let i=0;i<count;i+=3){let polys=[[]];for(let j=0;j<3;j++){const n=idx?idx.getX(i+j):i+j,p=attrs.position;polys[0].push({x:p.getX(n),y:p.getY(n),z:p.getZ(n),u:attrs.uv?.getX(n)||0,v:attrs.uv?.getY(n)||0,r:attrs.color?.getX(n)||0,g:attrs.color?.getY(n)||0,b:attrs.color?.getZ(n)||0});}
        const xs=polys[0].map(p=>p.x),zs=polys[0].map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
        for(const entry of this.ugEntries){const r=entry.surfaceOpening||entry,rad=Math.hypot(r.w,r.d)/2;if(r.x+rad<x0||r.x-rad>x1||r.z+rad<z0||r.z-rad>z1)continue;polys=polys.flatMap(poly=>this.subtractPortal(poly,r));}
        for(const poly of polys)for(let j=1;j<poly.length-1;j++)for(const p of [poly[0],poly[j],poly[j+1]]){vertices.push(p.x,p.y,p.z);uv.push(p.u,p.v);colors.push(p.r,p.g,p.b);}
      }
      const replacement=new THREE.BufferGeometry();replacement.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));replacement.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(attrs.color)replacement.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));replacement.computeVertexNormals();mesh.geometry.dispose();mesh.geometry=replacement;mesh.userData.portalHoles=true;
    }
    // Remove street furnishings that would seal an entrance. The matching
    // physics objects are removed using the same footprint predicate.
    const blocksEntrance=o=>this.ugEntries.some(r=>this.rectsOverlap(o,r.surfaceOpening||r,.6));
    this.streetSolids=this.streetSolids.filter(o=>o.kind.startsWith('underground')||o.kind.startsWith('entrance')||!blocksEntrance(o));
    this.ceilingSlabs=this.ceilingSlabs.filter(o=>o.ceilingBottom<0||!blocksEntrance(o));
    this.rideSlabs=this.rideSlabs.filter(o=>!blocksEntrance(o));
    for(const [key,b] of this.instanceBatches)if(!key.startsWith('ug-'))b.items=b.items.filter(p=>!blocksEntrance({x:p.x,z:p.z,w:p.sx,d:p.sz,angle:p.angle}));
    for(const m of this.scene.children)if(m.isMesh&&m!==this.groundMesh&&m!==this.roadMesh&&m.position.y>=0&&this.ugEntries.some(r=>this.overlaps(m.position,r,.8)))m.visible=false;
    this.indexStreetSolids();
  }
  buildUndergroundNavigation(){
    const segments=this.ugPassages.map(s=>({...s,points:[{...s.a,t:0},{...s.b,t:1}]}));
    const add=(s,p)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(s.length*s.length)));s.points.push({x:s.a.x+dx*t,z:s.a.z+dz*t,y:this.ugFloor,t});};
    for(const r of this.ugEntries){const s=segments.find(s=>s.def.id===r.corridor&&this.overlaps(r.at,{x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,w:s.width,d:s.length+1,angle:s.angle},0));add(s,r.at);}
    this.ugNodes=[];const map=new Map();const node=p=>{const key=p.x.toFixed(2)+','+p.z.toFixed(2);if(!map.has(key)){map.set(key,this.ugNodes.length);this.ugNodes.push({...p,edges:[],layer:'B1'});}return map.get(key);};
    // Shared interior junctions (station hall / Y) must split the longitudinal way.
    for(const s of segments)for(const o of segments)for(const p of [o.a,o.b]){const q=this.localXZ(p,{x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,angle:s.angle});if(Math.abs(q.x)<.02&&Math.abs(q.z)<=s.length/2+.01)add(s,p);}
    for(const s of segments){s.points.sort((a,b)=>a.t-b.t);s.ids=s.points.map(node);for(let i=1;i<s.ids.length;i++){const a=s.ids[i-1],b=s.ids[i];if(a===b)continue;const d=Math.hypot(this.ugNodes[a].x-this.ugNodes[b].x,this.ugNodes[a].z-this.ugNodes[b].z);this.ugNodes[a].edges.push({to:b,d});this.ugNodes[b].edges.push({to:a,d});}}
    this.ugNavSegments=segments;
  }
  ugRoute(from,to){
    const snap=p=>{let best;for(const s of this.ugNavSegments){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/(s.length*s.length))),x=s.a.x+dx*t,z=s.a.z+dz*t,d=Math.hypot(p.x-x,p.z-z);if(!best||d<best.d)best={x,z,y:this.ugFloor,t,s,d};}return best;};
    const a=snap(from),b=snap(to),candidates=q=>q.s.ids.map(id=>({id,d:Math.hypot(this.ugNodes[id].x-q.x,this.ugNodes[id].z-q.z)}));
    const dist=this.ugNodes.map(()=>Infinity),prev=this.ugNodes.map(()=>-1),done=new Set();for(const v of candidates(a))dist[v.id]=v.d;
    for(let k=0;k<dist.length;k++){let u=-1;for(let i=0;i<dist.length;i++)if(!done.has(i)&&(u<0||dist[i]<dist[u]))u=i;if(u<0||!isFinite(dist[u]))break;done.add(u);for(const e of this.ugNodes[u].edges)if(dist[u]+e.d<dist[e.to]){dist[e.to]=dist[u]+e.d;prev[e.to]=u;}}
    const end=candidates(b).sort((x,y)=>dist[x.id]+x.d-dist[y.id]-y.d)[0];
    if(!isFinite(dist[end.id]))throw new Error('B1 network is disconnected');
    let path=[];if(a.s===b.s)path=[a,b];else{for(let u=end.id;u>=0;u=prev[u])path.unshift(this.ugNodes[u]);path=[a,...path,b];}
    return [from,...path,to].map(p=>({...p,y:this.ugFloor,layer:'B1'})).filter((p,i,ps)=>!i||Math.hypot(p.x-ps[i-1].x,p.z-ps[i-1].z)>.01);
  }
  findRoute(from,to){
    if(!this.ugNavSegments?.length)return this.surfaceRoute(from,to);
    const fr=this.rampAt(from),tr=this.rampAt(to),fu=this.isBelowGround(from)&&this.undergroundAt(from),tu=this.isBelowGround(to)&&this.undergroundAt(to);
    if(fu&&tu)return this.ugRoute(from,to);
    const surface=(a,b)=>this.surfaceRoute(a,b);
    const routeEntry=(r)=>[{...r.top,layer:'ramp',entry:r.name},{...r.bottom,layer:'ramp',entry:r.name}];
    if(fr){const dTop=Math.abs(from.y-fr.top.y),dBottom=Math.abs(from.y-fr.bottom.y);if(tu||tr&&tr===fr||dBottom<dTop&&this.isBelowGround(to))return [{...from,layer:'ramp'},...routeEntry(fr).slice(1),...this.findRoute(fr.bottom,to)];return [{...from,layer:'ramp'},{...fr.top,layer:'ramp'},...this.findRoute(fr.top,to)];}
    if(tr){const route=this.findRoute(from,{...tr.top,x:tr.top.x+Math.sin(tr.angle)*-.2,z:tr.top.z+Math.cos(tr.angle)*-.2});return [...route,{...tr.top,layer:'ramp'},{...to,layer:'ramp'}];}
    if(fu||tu){let best=null,bestDistance=Infinity;for(const r of this.ugEntries){const outside={...r.top,x:r.top.x-Math.sin(r.angle)*.2,z:r.top.z-Math.cos(r.angle)*.2};
        const path=tu?[...surface(from,outside),...routeEntry(r),...this.ugRoute(r.bottom,to)]:[...this.ugRoute(from,r.bottom),...routeEntry(r).reverse(),...surface(outside,to)];
        const d=this.routeDistance(path);if(d<bestDistance){bestDistance=d;best=path;}}
      return best;
    }
    return surface(from,to);
  }
  shortestTree(start){
    this.surfaceTrees=this.surfaceTrees||new Map();if(this.surfaceTrees.has(start))return this.surfaceTrees.get(start);
    const dist=this.nodes.map(()=>Infinity),prev=this.nodes.map(()=>-1),heap=[];
    const push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].d<=v.d)break;heap[i]=heap[p];i=p;}heap[i]=v;};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].d<heap[child].d)child++;if(heap[child].d>=last.d)break;heap[i]=heap[child];i=child;}heap[i]=last;}return top;};
    dist[start]=0;push({id:start,d:0});while(heap.length){const u=pop();if(u.d!==dist[u.id])continue;for(const e of this.nodes[u.id].edges)if(u.d+e.d<dist[e.to]){dist[e.to]=u.d+e.d;prev[e.to]=u.id;push({id:e.to,d:dist[e.to]});}}
    const tree={dist,prev};this.surfaceTrees.set(start,tree);return tree;
  }
  surfaceRoute(from,to){
    const a=this.snapRoad(from),b=this.snapRoad(to);
    const candidates=r=>{let lo=0;for(let i=0;i<r.segment.points.length;i++)if(r.segment.points[i].t<=r.t)lo=i;const hi=Math.min(lo+1,r.segment.points.length-1);return [...new Set([r.segment.ids[lo],r.segment.ids[hi]])].map(id=>({id,d:Math.hypot(this.nodes[id].x-r.x,this.nodes[id].z-r.z)}));};
    let best=Infinity,entry,exit,tree;
    for(const s of candidates(a)){const t=this.shortestTree(s.id);for(const e of candidates(b)){const d=s.d+t.dist[e.id]+e.d;if(d<best){best=d;entry=s;exit=e;tree=t;}}}
    let path=[];if(a.segment===b.segment&&Math.hypot(a.x-b.x,a.z-b.z)<=best)path=[from,a,b,to];
    else{if(!tree)throw new Error('訂單道路不連通');for(let u=exit.id;u>=0;u=tree.prev[u]){path.unshift(this.nodes[u]);if(u===entry.id)break;}path=[from,a,...path,b,to];}
    return path.map((p,i)=>({x:p.x,z:p.z,y:this.getTerrainHeight(p.x,p.z),layer:'surface',access:i===0||i===path.length-1})).filter((p,i,ps)=>!i||Math.hypot(p.x-ps[i-1].x,p.z-ps[i-1].z)>.1);
  }
  routeDistance(path){return path.reduce((n,p,i)=>n+(i?Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z,(p.y||0)-(path[i-1].y||0)):0),0);}
  rideSurface(p,ceiling=Infinity){
    const ramp=this.rampAt(p);if(ramp)return this.rampHeight(ramp,p)+.16;
    if(this.isBelowGround({...p,y:ceiling})&&this.undergroundAt(p))return this.ugFloor+.16;
    return super.rideSurface(p,ceiling);
  }
  buildArcadeDeliverySpotPool(){
    if(this.arcadeDeliverySpots?.length)return this.arcadeDeliverySpots;
    const saved=this.undergroundZones;this.undergroundZones=[];const base=super.buildArcadeDeliverySpotPool();this.undergroundZones=saved;
    for(const spot of base){spot.layer='surface';spot.stopW=5.6;spot.stopD=7;spot.angle=Math.atan2(this.snapRoad(spot.pos).b.x-this.snapRoad(spot.pos).a.x,this.snapRoad(spot.pos).b.z-this.snapRoad(spot.pos).a.z);}
    // Keep complete stopping rectangles clear, rather than probing a single point.
    const spots=base.filter(s=>this.stopOutsideTraffic(s)&&!this.nearbySolids(s.pos).some(o=>this.verticalOverlap(s.pos,o)&&this.rectsOverlap({...s.pos,w:s.stopW,d:s.stopD,angle:s.angle},o,.55)));
    for(const s of this.ugPassages.filter(s=>['Y','R','Z'].includes(s.def.id)))for(const [i,t] of [.22,.55,.82].entries()){
      const p=this.passagePoint(s,t,-1.5),rect={...p,w:4.6,d:6.4,angle:s.angle};if(this.nearbySolids(p).some(o=>o.y<0&&this.rectsOverlap(rect,o,.6)))continue;
      spots.push({name:s.def.name+' · '+['入口旁交付','店前交付','轉角交付'][i],pos:new THREE.Vector3(p.x,this.ugFloor,p.z),district:s.def.name,kind:'underground',layer:'B1',stopW:4.6,stopD:6.4,angle:s.angle});
    }
    this.arcadeDeliverySpots=spots;return spots;
  }
  stopOutsideTraffic(stop){
    const c=Math.cos(stop.angle),sn=Math.sin(stop.angle);
    for(const x of [-stop.stopW/2,0,stop.stopW/2])for(const z of [-stop.stopD/2,0,stop.stopD/2]){
      const road=this.snapRoad({x:stop.pos.x+x*c+z*sn,z:stop.pos.z-x*sn+z*c});
      if(road.distance<TAIPEI_ROADS[road.ri].width/1.7/2+.15)return false;
    }
    return true;
  }
  updateVehiclePhysics(dt){
    const old=this.carPos.clone(),props=this.cityObstacles,ramps=this.ramps,waves=this.roadWaves;
    if(this.isBelowGround(old)||this.rampAt(old)){this.cityObstacles=[];this.ramps=[];this.roadWaves=[];}
    super.updateVehiclePhysics(dt);this.cityObstacles=props;this.ramps=ramps;this.roadWaves=waves;
    // Surface props use planar legacy interaction; filter them while below street.
    if(this.isBelowGround(this.carPos)&&!this.undergroundAt(this.carPos)&&!this.rampAt(this.carPos)){
      this.carPos.copy(old);this.carSpeed=0;this.carVy=0;this.carGroup.position.copy(this.carPos);
    }
    if(this.bikeRig&&this.isGrounded){const r=this.rampAt(this.carPos);if(r)this.bikeRig.rotation.x=-Math.atan2((r.bottom.y-r.top.y)*Math.cos(this.carRotY-r.angle),r.d)-this.wheelieAngle;}
  }
  updateEffects(dt){
    // The inherited planar area trigger is restricted to the rider's actual floor.
    const all=this.undergroundZones;this.undergroundZones=this.isBelowGround(this.carPos)?all:[];super.updateEffects(dt);this.undergroundZones=all;
    if(this.bikeShadow)this.bikeShadow.position.y=this.rideSurface(this.carPos,this.carPos.y)+.03;
    this.markerTime+=dt;
    for(const label of this.undergroundRoot.children)if(label.userData.ugSign){const d=Math.hypot(label.position.x-this.carPos.x,label.position.z-this.carPos.z);label.visible=d>6&&d<90;}
    for(const c of this.customers){
      const distance=Math.hypot(c.group.position.x-this.carPos.x,c.group.position.z-this.carPos.z);
      if(c.moneyMark){c.moneyMark.position.y=3.45+(this.reducedMotion?0:Math.sin(this.elapsed*2.7+c.wavePhase)*.15);c.moneyMark.visible=distance<160;}
      if(c.arcadeLabel)c.arcadeLabel.visible=c===this.nearestMerchant()||distance<35;
    }
  }
  inStopZone(pos,stop){
    if(!this.isGrounded||Math.abs(pos.y-stop.pos.y-.16)>.8)return false;
    const q=this.localXZ(pos,{...stop.pos,angle:stop.angle||0});
    return Math.abs(q.x)<=stop.stopW/2&&Math.abs(q.z)<=stop.stopD/2;
  }
  updateCustomers(dt){
    this.customers.forEach(c=>{c.cooldown=Math.max(0,(c.cooldown||0)-dt);c.group.visible=!c.isBoarded&&c.cooldown<=0&&!this.isBelowGround(this.carPos);});
    if(this.activeCustomer){
      const c=this.activeCustomer;this.activeCustomerTimer=Math.max(0,this.activeCustomerTimer-dt);
      if(!c.warnedHalf&&this.activeCustomerTimer<this.activeCustomerInitialTime*.5){c.warnedHalf=true;this.customerMessage('half');}
      if(!c.warnedUrgent&&this.activeCustomerTimer<10){c.warnedUrgent=true;this.customerMessage('urgent',true);}
      if(this.activeCustomerTimer<=0){this.customerMessage('late',true);this.failures++;this.finishOrder(false);return;}
      this.interact=this.inStopZone(this.carPos,c.destination)&&Math.abs(this.carSpeed)<1.5?this.interact+dt:0;if(this.interact>=.7)this.deliverCustomer();
    }else{
      const target=this.customers.filter(c=>!c.isBoarded&&c.cooldown<=0).sort((a,b)=>this.carPos.distanceTo(a.group.position)-this.carPos.distanceTo(b.group.position))[0];
      if(this.interactionMerchant!==target)this.interact=0;this.interactionMerchant=target;
      const near=target&&this.isGrounded&&Math.abs(this.carPos.y-target.group.position.y-.16)<.8&&Math.hypot(target.group.position.x-this.carPos.x,target.group.position.z-this.carPos.z)<target.stopRadius;
      this.interact=near&&Math.abs(this.carSpeed)<1.5?this.interact+dt:0;if(this.interact>=.7)this.boardCustomer(target);
    }
    if(this.interact>0)document.getElementById('objective-line').textContent=(this.activeCustomer?'交付中':'取貨中')+' '+Math.min(100,Math.round(this.interact/.7*100))+'%';
  }
  buildStopFrame(){
    // A small delivery ticket replaces the enclosing luminous stop boundary.
    this.stopFrame=new THREE.Object3D();this.stopFrame.visible=false;
    this.stopLabel=this.makeLabel('交付\n停穩收單','#83c8cf');this.stopLabel.scale.set(7,2.2,1);this.scene.add(this.stopLabel);this.stopLabel.visible=false;
    this.destBeam.children.forEach(m=>m.visible=false);
  }
  updateStopFrame(){
    if(!this.stopFrame)return;
    const stop=this.activeCustomer?.destination;this.stopFrame.visible=false;
    this.stopLabel.visible=!!stop&&this.isBelowGround(this.carPos)===(stop.layer==='B1');if(!stop)return;
    this.stopLabel.scale.set(stop.layer==='B1'?5:7,stop.layer==='B1'?1.1:2.2,1);
    this.stopLabel.position.set(stop.pos.x,stop.pos.y+(stop.layer==='B1'?2.85:4.3),stop.pos.z);this.destBeam.visible=false;
  }
  paintRoadRoute(){
    super.paintRoadRoute();if(!this.roadRibbon)return;
    // Replace flat terrain projection with explicit floor/ramp elevation.
    const vertices=[],dummy=this.routeDummy;let count=0,travel=0;
    const point=(a,b,t,side,rx,rz)=>{const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=(a.y??this.getTerrainHeight(a.x,a.z))+((b.y??this.getTerrainHeight(b.x,b.z))-(a.y??this.getTerrainHeight(a.x,a.z)))*t;return [x+rx*side,y+.29,z+rz*side];};
    for(let i=1;i<this.route.length;i++){const a=this.route[i-1],b=this.route[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.05)continue;const rx=-dz/len*.45,rz=dx/len*.45;
      for(let d=0;d<len;d+=10){const t=d/len,tt=Math.min(1,(d+10)/len),al=point(a,b,t,-1,rx,rz),ar=point(a,b,t,1,rx,rz),bl=point(a,b,tt,-1,rx,rz),br=point(a,b,tt,1,rx,rz);vertices.push(...al,...ar,...bl,...ar,...br,...bl);}
      for(let d=5;d<len&&count<100&&travel+d<650;d+=10){const p=point(a,b,d/len,0,rx,rz);dummy.position.set(...p);dummy.rotation.set(0,Math.atan2(dx,dz),0);dummy.updateMatrix();this.routeChevrons.setMatrixAt(count++,dummy.matrix);}travel+=len;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));this.roadRibbon.geometry.dispose();this.roadRibbon.geometry=geo;this.roadRibbon.material.color.setHex(0x83c8cf);this.routeChevrons.visible=false;this.routeChevrons.count=0;this.routeChevrons.instanceMatrix.needsUpdate=true;
  }
  updateNavigation(){
    super.updateNavigation();this.updateStopFrame();
    const c=this.activeCustomer||this.nearestMerchant(),target=this.activeCustomer?c?.destination.pos:c?.group.position;if(!target)return;
    const entry=this.route.find(p=>p.layer==='ramp'),below=this.isBelowGround(this.carPos),destinationBelow=this.isBelowGround(target);
    document.getElementById('nav-floor').textContent=(below?'B1 地下':'地面')+' → '+(destinationBelow?'B1 地下':'地面');
    if(below!==destinationBelow&&entry){document.getElementById('nav-next-road').textContent=(destinationBelow?'從此下地下街：':'從此返回地面：')+entry.entry;}
    document.getElementById('nav-phase').textContent=this.activeCustomer?'配送交付':'商家取貨';
    this.updateArcadeArrow();
  }
  updateArcadeArrow(){document.getElementById('arcade-arrow').getContext('2d').clearRect(0,0,240,120);}
  updateCompass(){document.getElementById('hud-compass-canvas').getContext('2d').clearRect(0,0,240,240);}
  updateHUD(){
    super.updateHUD();document.getElementById('order-item').textContent=this.activeCustomer?this.activeCustomer.shop+' / '+this.activeCustomer.item:'配送票牌取貨 · 停穩收單';
    document.getElementById('current-layer').textContent=this.isBelowGround(this.carPos)?'B1 / 地下街':'TAIPEI / 地面';
  }
  updateCamera(dt=.016){
    if(this.isBelowGround(this.carPos)||this.rampAt(this.carPos)){
      const r=this.rampAt(this.carPos),distance=r?5:4.5;this.camera.position.set(this.carPos.x-Math.sin(this.carRotY)*distance,this.carPos.y+2.6,this.carPos.z-Math.cos(this.carRotY)*distance);this.camera.lookAt(this.carPos.x+Math.sin(this.carRotY)*4,this.carPos.y+1.5,this.carPos.z+Math.cos(this.carRotY)*4);
      this.camera.fov=70;this.camera.updateProjectionMatrix();
      if(!r)this.camera.position.y=Math.min(this.camera.position.y,this.ugFloor+this.ugClearance-.28);
      // Use measured vertical intervals for underground walls as for street walls.
      const start={x:this.carPos.x,y:this.carPos.y+1.6,z:this.carPos.z},delta={x:this.camera.position.x-start.x,z:this.camera.position.z-start.z};let t=1;
      for(const o of this.nearbyRectSolids({...start,w:12,d:12,angle:0},1)){if(start.y<o.y||start.y>o.y+o.height)continue;const hit=this.rayRect(start,delta,o,.18);if(hit)t=Math.min(t,Math.max(.05,hit.t-.03));}
      this.camera.position.x=start.x+delta.x*t;this.camera.position.z=start.z+delta.z*t;return;
    }
    super.updateCamera(dt);
  }
  rescue(){
    if(this.gameState!=='PLAYING'||this.celebrationTime>0)return;
    if(!this.isBelowGround(this.carPos)&&!this.rampAt(this.carPos))return super.rescue();
    const r=this.ugEntries.reduce((a,b)=>Math.hypot(a.top.x-this.carPos.x,a.top.z-this.carPos.z)<Math.hypot(b.top.x-this.carPos.x,b.top.z-this.carPos.z)?a:b);
    this.carPos.set(r.top.x-Math.sin(r.angle)*2,r.top.y+.16,r.top.z-Math.cos(r.angle)*2);this.carSpeed=this.carVy=0;this.isGrounded=true;this.clearInputs();this.carGroup.position.copy(this.carPos);this.carRotY=this.heading=r.angle+Math.PI;
    if(this.selectedMode!=='PRACTICE')this.gameTime=Math.max(.1,this.gameTime-5);if(this.activeCustomer)this.integrity=Math.max(0,this.integrity-8);this.updateNavigation();this.showStatusToast('已回到 '+r.name+' · 地面出口');
  }
  drawCityMap(){
    const button=document.getElementById('map-layer-button');button.textContent=this.mapLayer==='surface'?'查看 B1 地下街':'查看地面路網';
    if(this.mapLayer!=='underground'){super.drawCityMap();return;}
    const cv=document.getElementById('city-map-canvas');cv.width=900;cv.height=780;const c=cv.getContext('2d');c.fillStyle='#16263c';c.fillRect(0,0,900,780);
    const pts=this.ugPassages.flatMap(s=>[s.a,s.b]),x0=Math.min(...pts.map(p=>p.x))-45,z0=Math.min(...pts.map(p=>p.z))-45,x1=Math.max(...pts.map(p=>p.x))+45,z1=Math.max(...pts.map(p=>p.z))+45,scale=Math.min(780/(x1-x0),590/(z1-z0));
    const xy=p=>[60+(p.x-x0)*scale,65+(p.z-z0)*scale];
    for(const s of this.ugPassages){c.strokeStyle=s.def.color;c.lineWidth=s.width*scale;c.beginPath();c.moveTo(...xy(s.a));c.lineTo(...xy(s.b));c.stroke();const p=xy(this.passagePoint(s,.5));c.fillStyle='#ffffff';c.font='bold 15px "Noto Sans TC"';c.fillText(s.def.name,p[0]+9,p[1]-10);}
    for(const r of this.ugEntries){c.strokeStyle='#fff2a3';c.lineWidth=5;c.beginPath();c.moveTo(...xy(r.top));c.lineTo(...xy(r.bottom));c.stroke();const p=xy(r.top);c.fillStyle='#fff2a3';c.fillRect(p[0]-4,p[1]-4,8,8);c.font='13px "Noto Sans TC"';c.fillText(r.id+' ↓',p[0]+7,p[1]);}
    if(this.isBelowGround(this.carPos)){const p=xy(this.carPos);c.fillStyle='#fff';c.beginPath();c.arc(...p,6,0,Math.PI*2);c.fill();}
    if(this.activeCustomer?.destination.layer==='B1'){const p=xy(this.activeCustomer.destination.pos);c.strokeStyle='#97ff50';c.lineWidth=4;c.strokeRect(p[0]-7,p[1]-7,14,14);}
    c.fillStyle='#f4e9bc';c.font='bold 17px "Noto Sans TC"';c.fillText('北 ↑  Y：市民大道 / R：中山・雙連 / Z：忠孝西路',35,698);
    c.font='14px "Noto Sans TC"';c.fillText('黃色支線為遊戲改編坡道。連通廊簡化；捷運月台與付費區不開放騎乘。',35,735);
  }
}


/* P2 Preview module: v5-recovery.js */
/* 4.1 Recovery checkpoint.
 * Reconstructs the interrupted art / story / underground-safety pass from the
 * saved progress notes. It intentionally layers on top of v4 instead of
 * duplicating the city engine, so the checkpoint can be audited and reverted.
 */
const TAIPEI_STREET_ATLAS_V5='data:image/webp;base64,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';

const V5_NEW_PERSONAS=[
 {name:'阿明 · 房仲帶看中',icon:'🏠',color:'#f2b56b',pitch:.93,rate:1.12,reply:'我先送餐。房子的公設比等你吃飽再跟我算。',lines:{
  pickup:['{item}送{dest}。我等等帶看，拜託不要讓客人先看到我餓到發抖。','到{dest}找一直說「採光很好」那個，就是我。'],
  drift:['這個彎的採光不錯，但我的湯灑得更通透。','甩尾可以，餐盒不要做開放式格局。'],
  crash:['這聲音要列瑕疵嗎？我可以幫你寫「現況交屋」。','剛剛那下不是壁癌，是我心裡裂了一條。'],
  near:['這個車縫比我今天帶看的套房還窄。','你鑽過去了？很好，總價先不要問。'],
  half:['客人已經問第三次捷運幾分鐘，我現在只想知道便當幾分鐘。','帶看行程排滿了，胃也空得很完整。'],
  urgent:['十秒！這單再晚，午餐就要改列期屋。','快到！我的空腹已經可以立即入住。'],
  success:['五星，準時交屋——我是說交餐。','到了！這單零公設、百分之百能吃。'],
  damaged:['餐盒有點變形，我先當成格局微調。','內容物都還在，這叫使用坪效高。'],
  late:['取消。我先去看一間有附餅乾的房子。','太晚了，午餐今天不點交。']
 }},
 {name:'珊珊 · 婚攝趕場',icon:'📷',color:'#eaa4c8',pitch:1.12,rate:1.16,reply:'收到，我會把餐點拍得比我騎得穩。',lines:{
  pickup:['{item}送{dest}。新人可以等我五分鐘，我的胃不行。','到{dest}找背兩台相機還在找第三顆電池的人。'],
  drift:['這個甩尾很有動態感，但我沒有要拍動態便當。','慢一點，我的飲料不需要自然散景。'],
  crash:['剛剛那聲收進環境音了，後製救不了。','先確認鏡頭沒事。等等，先確認我的午餐。'],
  near:['這個擦身距離很電影感，我本人比較想要安全感。','你過得去，我的相機包不一定。'],
  half:['儀式快開始了，我還沒吃。等等笑容可能要靠後製。','我已經拍完戒指、捧花、爸媽，現在只缺便當特寫。'],
  urgent:['十秒！拜託把這段剪成準時抵達。','快快快，新人進場前我至少要吞三口。'],
  success:['五星，構圖完整、時間漂亮。','到啦！今天最準時的不是流程，是你。'],
  damaged:['看起來有點晃，我就當手持風格。','餐盒歪了，沒事，我會避開那個角度吃。'],
  late:['取消，我去拍甜點桌順便偷吃。','來不及了，這餐只能留在遺憾相簿。']
 }},
 {name:'小伍 · 地下樂團鼓手',icon:'🥁',color:'#91b5e8',pitch:.9,rate:1.22,reply:'我會跟拍點走，但不保證排氣聲在四四拍。',lines:{
  pickup:['{item}送{dest}。我們 soundcheck 已經從一首歌變一張專輯。','到{dest}找一直敲桌子的那個，我沒有鼓也會敲。'],
  drift:['這個甩尾有 groove，湯沒有。','後輪很準，餐盒的節拍已經散了。'],
  crash:['那一下是 crash cymbal 嗎？太真實了。','節奏可以重拍，便當不要重摔。'],
  near:['這個空隙切得漂亮，像進副歌前那一下。','你剛那個穿越比我們貝斯手進拍還準。'],
  half:['團員說再等五分鐘。我說這句今天已經 remix 六次。','鼓棒我都磨熱了，飯還沒熱到我手上。'],
  urgent:['十秒！進最後八小節！','最後一段，不要在終止式前迷路！'],
  success:['五星！準時落在第一拍。','到了，這才叫 ending 有收乾淨。'],
  damaged:['飯散了，當自由爵士。','餐盒有點破拍，但還能演。'],
  late:['取消，安可都唱完了。','太晚了，今晚的 setlist 沒有午餐。']
 }},
 {name:'林老師 · 補習班守門員',icon:'📚',color:'#9bd0a8',pitch:1.0,rate:1.08,reply:'老師，我先交外送這份作業，答案保證不是抄的。',lines:{
  pickup:['{item}送{dest}。下課鐘一響，學生跟我的胃會一起衝出來。','到{dest}找拿紅筆但今天只想拿筷子的那個。'],
  drift:['這個彎我給八十分，餐盒扣二十分。','步驟要寫清楚：轉彎，不是把飯轉出去。'],
  crash:['這題錯得很大聲。','我有說過不會的先跳過，不是叫你跳過牆。'],
  near:['這個縫是進階題，答對了也不要一直做。','你這樣鑽，我要開始出安全距離選擇題。'],
  half:['學生問還有幾分鐘下課，我也想問還有幾分鐘到。','我改完兩疊考卷了，午餐還沒交卷。'],
  urgent:['十秒，最後檢查！不要空白！','快交卷——我是說交餐！'],
  success:['五星，準時繳交，不用訂正。','很好，今天唯一不用留堂的是你。'],
  damaged:['內容有到，版面比較自由。','這份便當需要訂正，但可以先吃。'],
  late:['取消，逾時不收。老師也要守規則。','太晚了，這題下次再考。']
 }}
];
for(const p of V5_NEW_PERSONAS)COURIER_PERSONAS.push(p);
COURIER_STUNT_LINES.push(
 ['這跳躍看房可以省電梯，但午餐不用看景觀。','排氣噴火可以，房仲話術不要一起點燃。'],
 ['這個飛躍我拍到了，拜託落地也要在畫面裡。','噴火很有逆光感，餐點不要真的有火。'],
 ['這一下直接進副歌！落地記得回拍。','排氣在打拍子，拜託不要比鼓還大聲。'],
 ['跳題不扣分，跳牆會。請看清楚題目。','這個噴火特效我不會列入考試範圍。']
);
COURIER_UNDERGROUND_LINES.push(
 '地下街帶看也可以，先確認你不是把我帶去機房。',
 'B1 光線很難拍，你先把餐安全送到就有滿分。',
 '地下街的殘響不錯，碰牆的聲音不用幫我測。',
 '進 B1 是進階題：看指標、走通道、不要穿牆。'
);

const V5_STORY_ARCS=[
 ['需求永遠最後一版',['五分鐘後開會','真的最後一版','今天要準時下班']],
 ['巨巨補給線',['腿日救援','蛋白質不能水逆','最後一組真的最後']],
 ['宇宙客服中心',['今日宜外送','逆行的不是水星','大吉配送日']],
 ['巷口董事會',['以前那棵樹','周伯的捷徑','董事長請客']],
 ['貓咪集團急件',['紙箱優先','罐罐董事會','董事長親自驗收']],
 ['直播不能斷',['等箱直播','地下街實境秀','今晚有結局']],
 ['主委說要準時',['桌都擺好了','地下街也要報備','開桌前最後一單']],
 ['夜班交接',['休息八分鐘','不要送進急診','天亮前的熱飯']],
 ['北車迷航記',['先不要移動','Y 到 R 到底在哪','終於找到出口']],
 ['第七年論文',['可重現的午餐','邊界條件實驗','成功 deployment']],
 ['備註還有續頁',['第二十九條','地下街附錄','最終版真的最終']],
 ['三寶開飯',['遙控器不是點心','三個都在門口','家庭音量救援']],
 ['帶看空腹線',['採光很好先吃飯','格局微調','準時點交']],
 ['婚攝趕場線',['進場前五分鐘','地下街取景','最後一張是便當']],
 ['地下樂團補給',['Soundcheck 延長','B1 節拍','安可前一單']],
 ['補習班下課線',['鐘響前','進階題 B1','準時交卷']]
].map((a,i)=>({persona:i,title:a[0],chapters:a[1].map((title,j)=>({
  id:'p'+String(i+1).padStart(2,'0')+'-c'+(j+1),chapter:j+1,title,
  brief:[
   '穩穩送到，先把今天的麻煩壓下來。',
   '這次多一點變化；技巧與路線都會被記住。',
   '收尾章：把前兩章的笑話和路線一次送完。'
  ][j],reward:[120,180,260][j]
}))}));
const V5_SIDE_STORIES=V5_STORY_ARCS.flatMap(a=>a.chapters.map(c=>({...c,arc:a.title,persona:a.persona})));
const V5_ORDER_STYLES={
 steady:{id:'steady',name:'穩送',desc:'時間 +18% · 安全完成支線',fare:1,timer:1.18},
 stunt:{id:'stunt',name:'技巧單',desc:'時間 −10% · 3 次技巧可拿 25% 基本運費加成',fare:1,timer:.9,goal:3},
 double:{id:'double',name:'兩站合單',desc:'連跑兩個 STOP · 基本運費 ×1.45',fare:1.45,timer:1.35}
};

(()=>{
 const P=TaipeiStreetCourier.prototype;
 const oldInit=P.init,oldMakeTexture=P.makeTexture,oldRideSurface=P.rideSurface,
       oldUpdateNavigation=P.updateNavigation,oldUpdateRadar=P.updateRadar,
       oldBoardCustomer=P.boardCustomer,oldDeliverCustomer=P.deliverCustomer,
       oldFinishOrder=P.finishOrder,oldAddTip=P.addTip,oldUpdateHUD=P.updateHUD,
       oldHandleKeyDown=P.handleKeyDown,oldStartGame=P.startGame,oldToMenu=P.toMenu;

 P.v5LoadStreetAtlas=function(){
  if(this.v5StreetAtlas||typeof Image==='undefined')return Promise.resolve();
  return new Promise(resolve=>{const im=new Image();let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};const timer=setTimeout(finish,7000);im.onload=()=>{this.v5StreetAtlas=im;finish();};im.onerror=finish;im.src=TAIPEI_STREET_ATLAS_V5;});
 };
 P.init=async function(){
  this.streetVersion='4.1.0';
  await this.v5LoadStreetAtlas();
  await oldInit.call(this);
  this.streetVersion='4.1.0';
  this.v5StoryProgress=Array(16).fill(0);try{const raw=JSON.parse(localStorage.getItem('supercourier.v5.story')||'[]');if(Array.isArray(raw))for(let i=0;i<16;i++)this.v5StoryProgress[i]=Math.max(0,Math.min(3,Number(raw[i])||0));}catch{}
  this.v5InstallOrderChoice();
  let n=0;for(const [key,m] of this.cityMats||[]){if(key.startsWith('ug-shop-')){m.map=this.makeTexture('shopfront',4+n++);m.needsUpdate=true;}}
 };
 P.makeTexture=function(kind,variant=0){
  if(!this.v5StreetAtlas||!['facade','glass','shopfront'].includes(kind))return oldMakeTexture.call(this,kind,variant);
  this.cityTextures=this.cityTextures||new Map();const key='v5-atlas:'+kind+':'+variant;if(this.cityTextures.has(key))return this.cityTextures.get(key);
  const cv=document.createElement('canvas');cv.width=cv.height=1024;const c=cv.getContext('2d'),im=this.v5StreetAtlas,cols=2,rows=4,sw=im.width/cols,sh=im.height/rows;
  const facadeTiles=[0,1,2,4,5,6],shopTiles=[3,4,6,7],tile=kind==='glass'?5:(kind==='shopfront'?shopTiles[Math.abs(variant)%shopTiles.length]:facadeTiles[Math.abs(variant)%facadeTiles.length]);
  const sx=(tile%cols)*sw,sy=Math.floor(tile/cols)*sh;c.drawImage(im,sx,sy,sw,sh,0,0,1024,1024);
  c.strokeStyle='rgba(24,45,62,.32)';c.lineWidth=10;c.strokeRect(5,5,1014,1014);
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer?.capabilities?.getMaxAnisotropy?.()||1);this.cityTextures.set(key,t);return t;
 };

 P.v5InstallOrderChoice=function(){
  if(!document.body?.appendChild||document.getElementById('v5-order-choice'))return;
  const el=document.createElement('div');el.id='v5-order-choice';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.innerHTML='<div class="v5-order-card"><small>ORDER STYLE / 支線接法</small><h2 id="v5-story-title">選一種接法</h2><p id="v5-story-brief"></p><div class="v5-order-grid"></div><em>1 / 2 / 3 可快速選擇</em></div>';
  document.body.appendChild(el);const grid=el.querySelector('.v5-order-grid');
  for(const [i,k] of ['steady','stunt','double'].entries()){const s=V5_ORDER_STYLES[k],b=document.createElement('button');b.dataset.style=k;b.innerHTML='<b>'+(i+1)+' · '+s.name+'</b><span>'+s.desc+'</span>';b.addEventListener('click',()=>this.v5ChooseOrderStyle(k));grid.appendChild(b);}
 };
 P.v5CurrentStory=function(c=this.activeCustomer){if(!c)return null;const persona=c.persona%16,progress=this.v5StoryProgress?.[persona]||0,arc=V5_STORY_ARCS[persona],chapter=arc?.chapters[Math.min(progress,2)];return chapter?{...chapter,arc:arc.title,persona}:null;};
 P.v5OpenOrderChoice=function(c){
  if(!c)return;const box=document.body?.appendChild?document.getElementById('v5-order-choice'):null;if(!box){c.v5Story=this.v5CurrentStory(c);this.v5ChooseOrderStyle('steady');return;}const story=this.v5CurrentStory(c);c.v5Story=story;
  document.getElementById('v5-story-title').textContent=story?story.arc+' · 第 '+story.chapter+' 章「'+story.title+'」':'選擇配送方式';
  document.getElementById('v5-story-brief').textContent=story?story.brief:'穩送、技巧或兩站合單。';box.classList.add('visible');this.v5StateBeforeChoice=this.gameState;this.gameState='ORDER_SELECT';this.clearInputs?.();
 };
 P.v5ChooseOrderStyle=function(style){
  const c=this.activeCustomer,s=V5_ORDER_STYLES[style];if(!c||!s)return;const box=document.body?.appendChild?document.getElementById('v5-order-choice'):null;box?.classList.remove('visible');
  c.v5Style=style;c.v5StuntCount=0;c.v5BonusApplied=false;c.v5FirstStopDone=false;c.v5SecondDestination=null;
  c.baseFare=Math.round(c.baseFare*s.fare);c.activeStyleName=s.name;this.activeCustomerTimer*=s.timer;this.activeCustomerInitialTime=this.activeCustomerTimer;
  if(style==='double'){
   const first=c.destination,candidates=(this.arcadeDeliverySpots||[]).filter(x=>x!==first&&x.layer===first.layer&&Math.hypot(x.pos.x-first.pos.x,x.pos.z-first.pos.z)>55);
   if(candidates.length){c.v5SecondDestination=candidates.sort((a,b)=>this.routeDistance(this.findRoute(first.pos,a.pos))-this.routeDistance(this.findRoute(first.pos,b.pos)))[Math.min(candidates.length-1,2)];}
   else c.v5Style='steady';
  }
  this.gameState='PLAYING';this.lastTime=performance.now();this.accumulator=0;this.updateNavigation();this.updateHUD();this.showStatusToast(s.name+' · '+(c.v5Story?.title||'支線配送'));
 };
 P.boardCustomer=function(c){const before=this.activeCustomer;oldBoardCustomer.call(this,c);if(!before&&this.activeCustomer===c)this.v5OpenOrderChoice(c);};
 P.addTip=function(amount){if(this.activeCustomer?.v5Style==='stunt')this.activeCustomer.v5StuntCount=(this.activeCustomer.v5StuntCount||0)+1;return oldAddTip.call(this,amount);};
 P.deliverCustomer=function(){
  const c=this.activeCustomer;if(!c)return oldDeliverCustomer.call(this);
  if(c.v5Style==='double'&&!c.v5FirstStopDone&&c.v5SecondDestination){c.v5FirstStopDone=true;c.destination=c.v5SecondDestination;c.v5SecondDestination=null;const route=this.findRoute(this.carPos,c.destination.pos),extra=Math.max(18,Math.ceil(this.routeDistance(route)/9));this.activeCustomerTimer+=extra;this.activeCustomerInitialTime+=extra;this.interact=0;this.carSpeed=0;this.updateNavigation();this.updateHUD();this.showArcadeSplash?.('第一站完成','第二站 '+c.destination.name+' · +'+extra+' 秒',.9);this.showStatusToast('兩站合單 · 前往第二個 STOP');return;}
  if(c.v5Style==='stunt'&&!c.v5BonusApplied){c.v5BonusApplied=true;if((c.v5StuntCount||0)>=V5_ORDER_STYLES.stunt.goal){c.baseFare=Math.round(c.baseFare*1.25);this.showStatusToast('技巧單達標 · 基本運費 +25%');}else this.showStatusToast('技巧單 '+(c.v5StuntCount||0)+'/3 · 以基本運費結算');}
  return oldDeliverCustomer.call(this);
 };
 P.finishOrder=function(success){
  const c=this.activeCustomer,persona=c?.persona%16,story=c?.v5Story;oldFinishOrder.call(this,success);
  if(success&&c&&story&&Number.isFinite(persona)){this.v5StoryProgress=this.v5StoryProgress||Array(16).fill(0);const current=this.v5StoryProgress[persona]||0;if(current<3)this.v5StoryProgress[persona]=current+1;try{localStorage.setItem('supercourier.v5.story',JSON.stringify(this.v5StoryProgress));}catch{}this.showStatusToast('支線完成 · '+story.arc+' '+story.chapter+'/3');}
 };

 P.rideSurface=function(p,ceiling=Infinity){
  const surface=this.getTerrainHeight(p.x,p.z)+.16,y=Number.isFinite(p.y)?p.y:(Number.isFinite(ceiling)?ceiling:Infinity),belowIntent=y<surface-2||Number.isFinite(ceiling)&&ceiling<surface-2;
  if(belowIntent&&!this.rampAt(p)){if(this.undergroundAt(p))return this.ugFloor+.16;return this.ugFloor-20;}
  return oldRideSurface.call(this,p,ceiling);
 };

 P.updateNavigation=function(){
  oldUpdateNavigation.call(this);const c=this.activeCustomer,target=c?.destination;if(!c||!target)return;const targetB1=target.layer==='B1',below=this.isBelowGround(this.carPos),ramp=this.rampAt(this.carPos);if(!targetB1&&!below)return;
  const entry=this.route.find(p=>p.layer==='ramp'),zone=targetB1?(this.undergroundAt(target.pos)?.def?.name||target.district||'B1 地下街'):'地面',remain=Math.round(this.routeDistance(this.route||[]));
  if(targetB1&&!below&&!ramp){document.getElementById('nav-instruction').textContent='前往 B1 入口';document.getElementById('nav-next-road').textContent=(entry?.entry||'地下街入口')+' → 下坡 → '+zone+' → STOP';document.getElementById('nav-route-total').textContent='B1：入口 → 下坡 → '+zone+' → STOP · 剩餘 '+remain+' m';}
  else if(targetB1&&ramp){document.getElementById('nav-instruction').textContent='沿坡道下 B1';document.getElementById('nav-next-road').textContent='下坡 → '+zone+' → STOP';document.getElementById('nav-route-total').textContent='B1 下坡中 · 剩餘 '+remain+' m';}
  else if(targetB1&&below){document.getElementById('nav-instruction').textContent=zone+' → STOP';document.getElementById('nav-next-road').textContent='雷達已切換地下通道 · 跟綠線前進';document.getElementById('nav-route-total').textContent='B1 '+zone+' · 剩餘 '+remain+' m';}
  else if(!targetB1&&below){document.getElementById('nav-instruction').textContent='返回地面入口';document.getElementById('nav-next-road').textContent=(entry?.entry||'最近出口')+' → 上坡 → 地面';document.getElementById('nav-route-total').textContent='B1 → 出口 → 地面 · 剩餘 '+remain+' m';}
 };
 P.updateRadar=function(){
  const targetB1=this.activeCustomer?.destination?.layer==='B1',below=this.isBelowGround(this.carPos);if(!targetB1&&!below)return oldUpdateRadar.call(this);
  const cv=document.getElementById('radar-canvas');if(cv.width!==280)cv.width=cv.height=280;const ctx=cv.getContext('2d');ctx.clearRect(0,0,280,280);ctx.fillStyle='#081b2a';ctx.fillRect(0,0,280,280);
  const scale=.52,cos=Math.cos(this.carRotY),sin=Math.sin(this.carRotY),xy=p=>{const dx=p.x-this.carPos.x,dz=p.z-this.carPos.z;return [140+(-dx*cos+dz*sin)*scale,172-(dx*sin+dz*cos)*scale];};
  for(const s of this.ugPassages){const a=xy(s.a),b=xy(s.b);ctx.strokeStyle=s.def.color||'#527c91';ctx.globalAlpha=.6;ctx.lineWidth=Math.max(3,s.width*scale*.28);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}ctx.globalAlpha=1;
  for(const e of this.ugEntries){const p=xy(e.bottom);ctx.fillStyle='#ffe57a';ctx.fillRect(p[0]-3,p[1]-3,6,6);}
  ctx.strokeStyle='#9cff47';ctx.lineWidth=5;ctx.beginPath();let started=false;for(const p of this.route||[]){if(p.layer!=='B1'&&p.layer!=='ramp')continue;const q=xy(p);if(started)ctx.lineTo(...q);else{ctx.moveTo(...q);started=true;}}if(started)ctx.stroke();
  if(this.activeCustomer?.destination){const p=xy(this.activeCustomer.destination.pos);ctx.fillStyle='#9cff47';ctx.fillRect(p[0]-6,p[1]-6,12,12);ctx.strokeStyle='#fff';ctx.strokeRect(p[0]-9,p[1]-9,18,18);}
  ctx.save();ctx.translate(140,172);ctx.fillStyle='#fff';ctx.strokeStyle='#07131c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(-8,9);ctx.lineTo(0,5);ctx.lineTo(8,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#dffcff';ctx.font='bold 12px "Noto Sans TC"';ctx.fillText('B1 地下雷達 / 綠線到 STOP',12,22);
 };
 P.updateHUD=function(){oldUpdateHUD.call(this);const c=this.activeCustomer;if(!c)return;const style=V5_ORDER_STYLES[c.v5Style];if(style){const detail=c.v5Style==='stunt'?' · 技巧 '+(c.v5StuntCount||0)+'/3':c.v5Style==='double'?' · '+(c.v5FirstStopDone?'第 2/2 站':'第 1/2 站'):'';document.getElementById('order-state').textContent=style.name+detail;}}
 P.handleKeyDown=function(e){if(this.gameState==='ORDER_SELECT'&&!e.repeat){const map={Digit1:'steady',Numpad1:'steady',Digit2:'stunt',Numpad2:'stunt',Digit3:'double',Numpad3:'double'};if(map[e.code]){e.preventDefault?.();this.v5ChooseOrderStyle(map[e.code]);return;}if(e.code==='Escape'){e.preventDefault?.();this.v5ChooseOrderStyle('steady');return;}return;}return oldHandleKeyDown.call(this,e);};
 P.startGame=function(){if(document.body?.appendChild)document.getElementById('v5-order-choice')?.classList.remove('visible');return oldStartGame.call(this);};
 P.toMenu=function(){if(document.body?.appendChild)document.getElementById('v5-order-choice')?.classList.remove('visible');return oldToMenu.call(this);};
})();