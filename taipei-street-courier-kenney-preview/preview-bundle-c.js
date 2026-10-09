
/* Preview module: pedestrian-ai.js */
/* 行人輕量狀態機（P4-03）：只在 NEAR chunk 內建立 active 行人 AI；遠處維持原本便宜的 ambient 擺動。
 * 狀態：IDLE / WALK / WAIT_CROSSING / CROSS / REACT / DESPAWN。
 *   DESPAWN = 休眠（不在 NEAR）：回到 ambient 動畫；進入 NEAR 才啟用（IDLE）。
 *   REACT   = 驚嚇（startle）/ 後退（step-back）/ 看玩家（look）/ 手機拍照（photo），皆為本作程序化姿態，不使用任何現成 NPC 動畫。
 * 路口：只在前方沒有車輛 / 玩家逼近時才穿越（WAIT_CROSSING → CROSS）；穿越中偵測到車逼近會加速。
 * 純邏輯（PedestrianAI.step）只吃 plain object 與 world adapter，可在 Node 單元測試；任何錯誤 → 該行人退回 ambient。 */
(function(){
  const S=Object.freeze({IDLE:'IDLE',WALK:'WALK',WAIT:'WAIT_CROSSING',CROSS:'CROSS',REACT:'REACT',DESPAWN:'DESPAWN'});
  const C=Object.freeze({patrol:6,walkSpeed:1.25,crossSpeed:1.5,runSpeed:2.6,gap:14,vehicleDanger:6,maxWait:25,safeFor:.6,
    reactNear:7,reactSpeed:9,lookNear:12,reactCooldown:6,cap:24,crossingOffset:5.5,crossingReach:12,blendSpeed:1.4});
  const VARIANTS=Object.freeze(['startle','step-back','look','photo']);
  const hash=n=>{let h=(Math.imul(n+1,2654435761)>>>0);h^=h>>>15;return (Math.imul(h,2246822519)>>>0)/4294967296;};
  const sub=(a,b)=>({x:a.x-b.x,z:a.z-b.z});

  class PedestrianAI{
    constructor(index,home){
      this.index=index;this.state=S.DESPAWN;this.timer=0;this.n=0;this.rand=()=>hash(index*977+(this.n++));
      this.home={x:home.x,z:home.z};this.pos={x:home.x,z:home.z};this.heading=0;this.y=0;this.lean=0;
      this.t={x:1,z:0};this.nrm=null;this.halfRoad=0;this.s=0;this.dir=1;this.cross=null;this.react=null;this.cool=0;this.waitSafe=0;this.waited=0;this.blend={x:0,z:0};this.crossing=null;this.walkTo=null;
      this.stats={transitions:0,reacts:0,crossings:0,signalCrossings:0};
    }
    set(state,timer=0){if(this.state!==state)this.stats.transitions++;this.state=state;this.timer=timer;}
    // 以道路中心點決定 sidewalk 的切線 / 法線（法線指向道路中心）。
    setup(road,tangent){
      const dx=road.x-this.home.x,dz=road.z-this.home.z,d=Math.hypot(dx,dz);
      this.halfRoad=d;this.nrm=d>.5?{x:dx/d,z:dz/d}:null;
      const tl=Math.hypot(tangent.x,tangent.z)||1;this.t={x:tangent.x/tl,z:tangent.z/tl};this.s=0;
    }
    sidewalkPoint(s){return{x:this.home.x+this.t.x*s,z:this.home.z+this.t.z*s};}
    // world: {isNear(ai), player(), vehicles(), walkable(x,z), road(ai)->{x,z,tangent}|null}
    step(dt,w){
      this.cool=Math.max(0,this.cool-dt);this.timer+=dt;
      const near=w.isNear(this);
      if(!near){if(this.state!==S.DESPAWN)this.retire();return this.state;}
      if(this.state===S.DESPAWN){
        const r=w.road(this);if(!r||!(this.nrm||(this.setup(r,r.tangent),this.nrm)))return this.state;
        this.pos={x:this.home.x,z:this.home.z};this.set(S.IDLE,0);this.idleFor=.5+this.rand()*2;
      }
      const P=w.player(),dp=P?Math.hypot(P.x-this.pos.x,P.z-this.pos.z):Infinity;
      // 反應（不在穿越 / 已在反應 / 冷卻中）：快車逼近 → 驚嚇 / 後退；慢速或停下 → 偶爾看或拍照。
      if(this.state!==S.CROSS&&this.state!==S.REACT&&this.cool===0&&P){
        if(dp<C.reactNear&&Math.abs(P.speed)>C.reactSpeed)this.startReact(this.rand()<.5?'startle':'step-back',P);
        else if(dp<C.lookNear&&Math.abs(P.speed)<4&&this.rand()<dt*.04)this.startReact(this.rand()<.5?'look':'photo',P);
      }
      switch(this.state){
        case S.IDLE:
          if(this.timer>=this.idleFor){const goCross=this.nrm&&this.rand()<.3;this.set(goCross?S.WAIT:S.WALK,0);this.waitSafe=0;this.waited=0;this.crossing=null;}
          break;
        case S.WALK:{
          const step=C.walkSpeed*dt*this.dir,ns=this.s+step;
          const next=this.sidewalkPoint(ns);
          if(Math.abs(ns)>=C.patrol||!w.walkable(next.x,next.z)){this.dir=-this.dir;this.set(S.IDLE,0);this.idleFor=1+this.rand()*3;}
          else{this.s=ns;this.pos=next;this.heading=Math.atan2(this.t.x*this.dir,this.t.z*this.dir);}
          break;}
        case S.WAIT:{
          if(!this.nrm){this.set(S.IDLE,0);this.idleFor=1;break;}
          this.waited+=dt;
          // 進入 WAIT 時找附近的號誌路口（crossing metadata）；有的話先走到斑馬線，再依「共用號誌」判斷。
          if(this.crossing===null)this.crossing=w.crossing(this)||false;
          const cr=this.crossing;
          if(cr){
            const target=Math.max(-C.patrol,Math.min(C.patrol,cr.s));
            if(Math.abs(target-this.s)>.25){const sg=Math.sign(target-this.s),ns=this.s+sg*Math.min(Math.abs(target-this.s),C.walkSpeed*dt),np=this.sidewalkPoint(ns);
              if(w.walkable(np.x,np.z)){this.s=ns;this.pos=np;this.heading=Math.atan2(this.t.x*sg,this.t.z*sg);}else{this.crossing=false;}
              break;}
          }
          this.heading=Math.atan2(this.nrm.x,this.nrm.z);
          const from=this.sidewalkPoint(this.s),to={x:from.x+this.nrm.x*2*this.halfRoad,z:from.z+this.nrm.z*2*this.halfRoad};
          const T=Math.hypot(to.x-from.x,to.z-from.z)/C.crossSpeed;
          const safe=w.walkable(to.x,to.z)&&this.crossingSafe(from,to,w,P,cr?{signalled:true,walk:w.walkPhase(cr,T)}:null);
          this.waitSafe=safe?this.waitSafe+dt:0;
          if(this.waitSafe>=C.safeFor){this.cross={from,to,u:0,len:Math.hypot(to.x-from.x,to.z-from.z),signalled:!!cr};this.stats.crossings++;if(cr)this.stats.signalCrossings++;this.set(S.CROSS,0);}
          else if(this.waited>C.maxWait){this.crossing=null;this.set(S.IDLE,0);this.idleFor=2;}
          break;}
        case S.CROSS:{
          const c=this.cross;let speed=C.crossSpeed;
          for(const v of w.vehicles())if(Math.hypot(v.x-this.pos.x,v.z-this.pos.z)<C.vehicleDanger&&Math.hypot(v.vx||0,v.vz||0)>.5){speed=C.runSpeed;break;}
          c.u=Math.min(1,c.u+speed*dt/Math.max(c.len,.1));
          this.pos={x:c.from.x+(c.to.x-c.from.x)*c.u,z:c.from.z+(c.to.z-c.from.z)*c.u};this.heading=Math.atan2(c.to.x-c.from.x,c.to.z-c.from.z);
          if(c.u>=1){this.home={x:c.to.x,z:c.to.z};this.nrm={x:-this.nrm.x,z:-this.nrm.z};this.s=0;this.cross=null;this.set(S.IDLE,0);this.idleFor=1+this.rand()*2;}
          break;}
        case S.REACT:this.stepReact(dt);break;
      }
      return this.state;
    }
    // 預測式判斷：行人以 crossSpeed 穿越時，逐秒比較行人與每台車（以目前速度外推）的距離；停止中的車用較小的固定餘裕。
    crossingSafe(from,to,w,P,sig){
      const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1,T=len/C.crossSpeed;
      // 號誌路口：必須是行人綠燈（= 該方向車流紅燈，且穿越期間不會變回綠燈）。
      if(sig&&sig.signalled&&!sig.walk)return false;
      for(const v of w.vehicles()){
        const moving=Math.hypot(v.vx||0,v.vz||0)>.5;
        if(sig&&sig.signalled&&!moving)continue;   // 號誌路口：在停止線等紅燈的車不算阻擋；闖燈 / 移動中的車仍然要避
        for(let t=0;t<=T+.5;t+=.5){
          const u=Math.min(1,t/T),px=from.x+dx*u,pz=from.z+dz*u,d=Math.hypot(px-(v.x+(v.vx||0)*t),pz-(v.z+(v.vz||0)*t));
          if(d<(moving?C.gap*.45:C.gap*.3))return false;
        }
      }
      if(P&&Math.hypot(P.x-(from.x+to.x)/2,P.z-(from.z+to.z)/2)<C.gap&&Math.abs(P.speed)>4)return false;   // 玩家可以闖燈；行人看到就等
      return true;
    }
    startReact(variant,P){
      const away=sub(this.pos,P),proj=away.x*this.t.x+away.z*this.t.z,sg=Math.abs(proj)>.05?Math.sign(proj):(this.rand()<.5?1:-1);
      // 後退只沿人行道切線方向（不會退進馬路或建築）。
      this.react={variant,t:0,dur:variant==='startle'?.9:variant==='step-back'?1.1:variant==='look'?1.8:2.5,from:{x:this.pos.x,z:this.pos.z},
        away:{x:this.t.x*sg,z:this.t.z*sg},face:Math.atan2(P.x-this.pos.x,P.z-this.pos.z),resume:this.state};
      this.stats.reacts++;this.cool=C.reactCooldown;this.set(S.REACT,0);
    }
    stepReact(dt){
      const r=this.react;r.t+=dt;const k=Math.min(1,r.t/r.dur);
      if(r.variant==='startle'){const m=Math.min(1,r.t/.35)*1.0;this.pos={x:r.from.x+r.away.x*m,z:r.from.z+r.away.z*m};this.y=Math.sin(Math.min(1,r.t/.4)*Math.PI)*.18;this.heading=r.face;}
      else if(r.variant==='step-back'){const m=Math.min(1,r.t/.5)*1.6;this.pos={x:r.from.x+r.away.x*m,z:r.from.z+r.away.z*m};this.heading=r.face;}
      else if(r.variant==='look'){this.heading=r.face;}
      else{this.heading=r.face;this.lean=-.14*Math.min(1,r.t/.4);}   // photo：抬手機、身體微後仰
      if(k>=1){this.y=0;this.lean=0;this.react=null;
        // 後退 / 驚嚇後的位置成為新的 sidewalk 起點（沿切線投影回 patrol 範圍內）。
        const dx=this.pos.x-this.home.x,dz=this.pos.z-this.home.z;this.s=Math.max(-C.patrol,Math.min(C.patrol,dx*this.t.x+dz*this.t.z));
        this.pos=this.sidewalkPoint(this.s);this.set(S.IDLE,0);this.idleFor=.8;}
    }
    // 離開 NEAR：回到休眠（ambient）。目前所在人行道成為 ambient 的新 base。
    retire(){
      if(this.state===S.CROSS&&this.cross&&this.nrm){this.home={x:this.cross.to.x,z:this.cross.to.z};this.nrm={x:-this.nrm.x,z:-this.nrm.z};}   // 穿越到一半離開 NEAR：視為已到對側
      this.y=0;this.lean=0;this.react=null;this.cross=null;this.crossing=null;this.s=0;this.pos={x:this.home.x,z:this.home.z};this.set(S.DESPAWN,0);
    }
  }
  globalThis.TaipeiPedestrianAI=PedestrianAI;globalThis.PEDESTRIAN_AI_STATES=S;globalThis.PEDESTRIAN_AI_CONFIG=C;

  // ── 接到遊戲：updateEffects 內，把 active 行人從原本的 ambient 擺動排除，改由 AI 驅動 ──
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype,baseEffects=P.updateEffects;
  const off=typeof location!=='undefined'&&/(?:^|[?&])pedai=off(?:&|$)/.test(location.search||'');
  P.pedestrianWorld=function(){
    if(this._pedWorld)return this._pedWorld;
    const g=this;
    return this._pedWorld={
      isNear:ai=>{const st=g.worldChunkState,grid=g.worldChunkGrid;if(!st||!grid||!st.near)return false;return st.near.has?st.near.has(grid.keyForPoint(ai.pos.x,ai.pos.z)):st.near.includes(grid.keyForPoint(ai.pos.x,ai.pos.z));},
      player:()=>g.carPos?{x:g.carPos.x,z:g.carPos.z,speed:g.carSpeed||0}:null,
      dt:.016,
      vehicles:()=>{if(g._pedVeh)return g._pedVeh;const o=[],dt=Math.max(.001,g._pedDt||.016);for(const list of [g.traffic,g.scooters])if(list)for(const v of list){const p=v.group&&v.group.position,q=v.previousPosition;if(!p)continue;
        o.push({x:p.x,z:p.z,vx:q?(p.x-q.x)/dt:0,vz:q?(p.z-q.z)/dt:0});}return g._pedVeh=o;},   // 每個 frame 只算一次
      walkable:(x,z)=>{try{if(!g.nearbyRectSolids||!g.rectsOverlap)return true;const c={x,z,w:.8,d:.8,angle:0};for(const o of g.nearbyRectSolids(c,.6))if(g.rectsOverlap(c,o,.3))return false;return true;}catch(e){return true;}},   // nearbyRectSolids 只回傳格子候選，需再做重疊判斷
      crossing:ai=>{const list=g.pedestrianCrossings();if(!list.length||!ai.nrm)return null;let best=null,bd=C.crossingReach*C.crossingReach;
        for(const c of list){const rx=c.x-ai.home.x,rz=c.z-ai.home.z,along=rx*ai.t.x+rz*ai.t.z,across=rx*ai.nrm.x+rz*ai.nrm.z;
          if(Math.abs(c.dirX*ai.t.x+c.dirZ*ai.t.z)<.85||Math.abs(across-ai.halfRoad)>3.5)continue;   // 平行於這條人行道、且在同一條路上
          const d=along*along;if(d<bd){bd=d;best={id:c.id,nodeId:c.nodeId,axis:c.axis,s:along};}}
        return best;},
      // 行人綠燈 = 該方向車流為紅燈，且穿越期間（T 秒內）持續為紅燈。
      walkPhase:(cr,T)=>{for(let t=0;t<=T+1;t+=.5)if(g.pedestrianSignalAt(cr.nodeId,cr.axis,t)!=='red')return false;return true;},
      road:ai=>{const s=g.snapRoad&&g.snapRoad({x:ai.home.x,z:ai.home.z});if(!s||!Number.isFinite(s.distance)||s.distance===Infinity)return null;
        const a=s.a||s.segment&&s.segment.a,b=s.b||s.segment&&s.segment.b;return{x:s.x,z:s.z,tangent:a&&b?{x:b.x-a.x,z:b.z-a.z}:{x:1,z:0}};},
    };
  };
  // crossing metadata：由 road graph 的號誌節點產生（每條進入路口的 edge 一個斑馬線，位於路口前 crossingOffset 公尺）。
  P.pedestrianCrossings=function(){
    const ids=this.signalNodeIds,nodes=this.nodes;if(!ids||!nodes)return [];
    const key=ids.size+':'+nodes.length;if(this._crossings&&this._crossingsKey===key)return this._crossings;
    const out=[];
    for(const id of ids){const n=nodes[id];if(!n||!n.edges)continue;
      for(const e of n.edges){const m=nodes[e.to];if(!m||!(e.d>18))continue;
        const dx=m.x-n.x,dz=m.z-n.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l;
        // 沿這條 edge 進入路口的車流方向 = (n - m)：與 advanceTraffic 的 axis 判斷相同。
        out.push({id:id+':'+e.to,nodeId:id,to:e.to,x:n.x+ux*C.crossingOffset,z:n.z+uz*C.crossingOffset,dirX:ux,dirZ:uz,axis:Math.abs(dx)>Math.abs(dz)?'ew':'ns'});}}
    this._crossingsKey=key;return this._crossings=out;
  };
  // 共用號誌時序：直接呼叫車流用的 signalState（只暫時平移 elapsed 以預看未來），不另外維護行人計時器。
  P.pedestrianSignalAt=function(nodeId,axis,lead){const e=this.elapsed;try{this.elapsed=e+lead;return this.signalState(nodeId,axis);}finally{this.elapsed=e;}};
  P.pedestrianAIStats=function(){const out={active:0,total:(this.pedestrians||[]).length,states:{},cap:C.cap,enabled:!off&&this.pedestrianAIEnabled!==false};
    for(const p of this.pedestrians||[])if(p.ai){out.states[p.ai.state]=(out.states[p.ai.state]||0)+1;if(p.ai.state!==S.DESPAWN)out.active++;}return out;};
  P.updateEffects=function(dt){
    const peds=this.pedestrians;
    if(off||this.pedestrianAIEnabled===false||!peds||!peds.length||!this.worldChunkState)return baseEffects.call(this,dt);
    this._pedDt=dt;this._pedVeh=null;const w=this.pedestrianWorld(),ambient=[],active=[];let count=0;
    for(const p of peds){
      if(p.aiFault){ambient.push(p);continue;}
      try{
        if(!p.ai)p.ai=new PedestrianAI(peds.indexOf(p),{x:p.baseX,z:p.baseZ});
        const wasDormant=p.ai.state===S.DESPAWN;
        if(wasDormant&&count>=C.cap){ambient.push(p);continue;}   // 同時 active 上限
        p.ai.step(dt,w);
        if(wasDormant&&p.ai.state!==S.DESPAWN){p.ai.blend={x:p.group.position.x-p.ai.pos.x,z:p.group.position.z-p.ai.pos.z};}   // 從 ambient 位置平順過渡，不瞬移
        if(p.ai.state===S.DESPAWN){if(!wasDormant){p.baseX=p.ai.home.x;p.baseZ=p.ai.home.z;}ambient.push(p);}else{count++;active.push(p);}
      }catch(e){p.aiFault=String(e&&e.message||e);p.ai=null;ambient.push(p);}
    }
    this.pedestrians=ambient;
    try{baseEffects.call(this,dt);}finally{this.pedestrians=peds;}
        for(const p of active){const a=p.ai;{const bl=Math.hypot(a.blend.x,a.blend.z);if(bl>1e-6){const k=Math.max(0,bl-C.blendSpeed*dt)/bl;a.blend.x*=k;a.blend.z*=k;}}   // 以固定速度收斂偏差（不瞬移）
      const px=a.pos.x+a.blend.x,pz=a.pos.z+a.blend.z;p.group.position.x=px;p.group.position.z=pz;p.group.position.y=this.getTerrainHeight(px,pz)+a.y;p.group.rotation.y=a.heading;p.group.rotation.x=a.lean;}
  };
})();


/* Preview module: postprocessing.js */
/* 可設定的街機後製管線（P2-01）：RenderPass → Bloom → Output(tone map + sRGB) → Color grade → FXAA。
 *
 * 設計重點
 * - 完全可關閉：?postfx=off / localStorage('courier.postfx') / game.setPostProcessing(false) / 選單按鈕。
 *   關閉時 renderer.render 直接走原本的路徑，畫面與升級前逐像素一致；composer 不會被建立或渲染。
 * - 不讓整座城市 Bloom：Bloom 門檻設在 HDR（線性、tone mapping 之前）> 場景一般受光亮度；只有被登記的物件
 *   （DELIVERY 標記、Nitro 火焰、夜間路燈 / 招牌 / 窗光）在 FX 啟用時被放大到門檻之上。
 *   放大是 shader 內的 uniform（postfxBoost），FX 關閉時為 1，不改動材質顏色資料。
 * - OutputPass 必須在 LDR 的 grading / FXAA 之前（FXAA 而非 SMAA：SMAA 會嵌入 base64 查找貼圖，違反 originality audit 的內嵌 payload 清單）（tone mapping 與 sRGB 轉換都在 OutputPass）。
 * - 畫質：由 graphics-quality.js 的預設決定（LOW 無 Bloom/Grade/FXAA；MEDIUM 有 Grade+FXAA；HIGH 加 Bloom）。
 * - Reduced Motion 不影響顏色輸出（此管線不讀取 reducedMotion）。 */
(function(){
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const STORE='courier.postfx';
  const DEFAULTS={
    // Bloom：threshold 為 HDR 線性亮度（受光的一般表面約 <1.5）；strength/radius 白天值，夜間由 applyLighting 覆寫。
    bloom:{strength:.35,radius:.4,threshold:2.0},
    // 顏色校正（顯示空間，OutputPass 之後）：輕微對比 / 飽和，保持中性。
    grade:{contrast:1.03,saturation:1.05},
    // 各類發光物件在 FX 啟用時的 HDR 放大倍率。
    boost:{delivery:4.0,nitro:4.0,lamp:3.2,sign:2.6,window:3.0},
  };
  P.postFxDefaults=DEFAULTS;

  function readPreference(){
    try{
      const q=(typeof location!=='undefined'&&location.search||'').match(/(?:^|[?&])postfx=(on|off|1|0)(?:&|$)/);
      if(q)return q[1]==='on'||q[1]==='1';
      const v=typeof localStorage!=='undefined'?localStorage.getItem(STORE):null;
      if(v==='off')return false;if(v==='on')return true;
    }catch(e){/* storage 不可用時使用預設 */}
    return true;
  }

  const GradeShader={
    uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D tDiffuse;uniform float contrast;uniform float saturation;varying vec2 vUv;'+
      'void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));'+
      'vec3 s=mix(vec3(l),c.rgb,saturation);s=(s-.5)*contrast+.5;gl_FragColor=vec4(clamp(s,0.,1.),c.a);}',
  };

  // 在不改動材質顏色的前提下，用 uniform 放大輸出（channel: 'color' 放大最終色；'emissive' 只放大自發光）。
  function boostMaterial(game,mat,factor,channel='color'){
    if(!mat||typeof mat!=='object')return;
    const reg=game.postFxBoosted||(game.postFxBoosted=new Map());
    let rec=reg.get(mat);
    if(!rec){
      rec={uniform:{value:1},factor,channel};
      const prev=mat.onBeforeCompile;
      mat.onBeforeCompile=function(shader,renderer){
        if(prev)prev.call(this,shader,renderer);
        shader.uniforms.postfxBoost=rec.uniform;
        let fs=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float postfxBoost;');
        if(rec.channel==='emissive'&&fs.includes('#include <emissivemap_fragment>'))fs=fs.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=postfxBoost;');
        else fs=fs.replace('#include <fog_fragment>','gl_FragColor.rgb*=postfxBoost;\n#include <fog_fragment>');
        shader.fragmentShader=fs;
      };
      const key=mat.customProgramCacheKey;
      mat.customProgramCacheKey=function(){return (key?key.call(this):'')+'|postfx-'+channel;};
      mat.needsUpdate=true;
      reg.set(mat,rec);
    }
    rec.factor=factor;
    rec.uniform.value=game.postFxActive&&game.postFxActive()?factor:1;
  }

  // 登記目前場景中所有「應該發光」的材質。可重複呼叫（夜間切換、機車重建後）。
  P.registerPostFxTargets=function(){
    const b=(this.postFxConfig||DEFAULTS).boost;
    this.destBeam?.traverse(o=>{if(o.material)boostMaterial(this,o.material,b.delivery);});
    // Current delivery/pickup ranges replace the hidden legacy beam. They
    // are created after the renderer's early postprocessing initialization.
    this.stopFrame?.traverse(o=>{if(o.material)boostMaterial(this,o.material,b.delivery);});
    (this.customers||[]).forEach(c=>c.pickupRange?.traverse(o=>{if(o.material)boostMaterial(this,o.material,b.delivery);}));
    (this.exhaustFlames||[]).forEach(f=>boostMaterial(this,f.material,b.nitro));
    if(this.isNight){
      const lamp=this.cityMats?.get('street-lamp');if(lamp)boostMaterial(this,lamp,b.lamp);
      (this.signMeshes||[]).forEach(m=>boostMaterial(this,m.material,b.sign));
      this.scene.traverse(o=>{if(o.isMesh&&o.material&&this.emissiveWindowTex&&o.material.emissiveMap===this.emissiveWindowTex)boostMaterial(this,o.material,b.window,'emissive');});
    }
    this.syncPostFxBoost();
  };
  P.syncPostFxBoost=function(){
    const on=this.postFxActive();
    for(const rec of (this.postFxBoosted||new Map()).values())rec.uniform.value=on?rec.factor:1;
  };

  P.postFxActive=function(){return !!(this.postFx&&this.postFx.enabled&&this.composer);};

  P.setPostProcessing=function(enabled,persist=true){
    if(!this.postFx)return false;
    this.postFx.enabled=!!enabled&&!!this.composer;
    this.syncPostFxBoost();
    if(persist){try{localStorage.setItem(STORE,enabled?'on':'off');}catch(e){/* ignore */}}
    const btn=document.getElementById('btn-postfx');if(btn)btn.textContent='後製：'+(this.postFx.enabled?'開':'關');
    return this.postFx.enabled;
  };

  P.initPostProcessing=function(){
    this.postFx={enabled:false,supported:false};
    const r=this.renderer;
    // 非 WebGL 環境（Node 測試用的假 renderer）或 addons 缺失：維持直接渲染。
    if(!r||typeof r.getContext!=='function'||!THREE.EffectComposer||!THREE.UnrealBloomPass)return;
    const cfg=this.postFxConfig=JSON.parse(JSON.stringify(DEFAULTS));
    const size=new THREE.Vector2();r.getSize(size);
    const composer=this.composer=new THREE.EffectComposer(r);
    composer.setPixelRatio(r.getPixelRatio());composer.setSize(size.x,size.y);
    composer.addPass(new THREE.RenderPass(this.scene,this.camera));
    const bloom=this.bloomPass=new THREE.UnrealBloomPass(size.clone(),cfg.bloom.strength,cfg.bloom.radius,cfg.bloom.threshold);
    bloom.enabled=this.highQuality!==false;
    composer.addPass(bloom);
    composer.addPass(new THREE.OutputPass());
    const grade=this.postFxGradePass=new THREE.ShaderPass(GradeShader);
    grade.uniforms.contrast.value=cfg.grade.contrast;grade.uniforms.saturation.value=cfg.grade.saturation;
    composer.addPass(grade);
    const aa=this.postFxAaPass=new THREE.FXAAPass();
    aa.enabled=this.highQuality!==false;
    composer.addPass(aa);
    this.postFx.supported=true;this.postFx.enabled=readPreference();

    // renderer.render 是實例屬性：包裝它，讓所有原本的 render 呼叫點不需修改。RenderPass 內部再呼叫 render 時走原函式。
    const direct=r.render.bind(r);let inside=false,lastRatio=r.getPixelRatio();
    const game=this;
    r.render=function(scene,camera){
      if(inside||!game.postFxActive()||scene!==game.scene||camera!==game.camera){return direct(scene,camera);}
      const ratio=r.getPixelRatio();
      if(ratio!==lastRatio){composer.setPixelRatio(ratio);lastRatio=ratio;}
      r.getSize(size);if(composer._width!==size.x||composer._height!==size.y){composer.setSize(size.x,size.y);}
      // 品質切換：LOW 關閉 Bloom 與 FXAA。
      // 品質由 graphics-quality.js 的預設決定；尚未初始化時退回 highQuality。
      if(game.graphicsPreset){const p=game.graphicsPreset();bloom.enabled=p.bloom;grade.enabled=p.grade;aa.enabled=p.aa;}
      else{const high=game.highQuality!==false;bloom.enabled=high;aa.enabled=high;}
      inside=true;
      try{composer.render();}finally{inside=false;}
    };
    // 夜間切換後，窗光 / 招牌需重新登記；FX 狀態同步。
    const applyLighting=this.applyLighting;
    this.applyLighting=function(...a){const out=applyLighting.apply(this,a);this.registerPostFxTargets();return out;};
    this.registerPostFxTargets();
    // 選單按鈕（動態加入，避免改動 HTML 模板）。
    const q=document.getElementById('btn-quality');
    if(q&&!document.getElementById('btn-postfx')){
      const b=q.cloneNode(false);b.id='btn-postfx';b.textContent='後製：'+(this.postFx.enabled?'開':'關');
      b.addEventListener('click',()=>this.setPostProcessing(!this.postFx.enabled));
      q.insertAdjacentElement('afterend',b);
    }
  };
  const baseInit=P.init;
  P.init=async function(...args){
    const out=await baseInit.apply(this,args);
    if(this.postFx?.supported)this.registerPostFxTargets();
    return out;
  };
})();


/* Preview module: graphics-quality.js */
/* 畫質預設 LOW / MEDIUM / HIGH（P2-02）。
 *
 * 規則
 * - 自動建議值（auto）與玩家手動值（manual）分開儲存；手動值永遠優先：effective = manual ?? auto。
 * - 自動建議只看能力訊號：navigator.hardwareConcurrency、navigator.deviceMemory（若存在）、renderer.capabilities。
 *   不使用 userAgent 判斷手機。
 * - 選項寫入 save（'supercourier.save.v1' 的 graphics 欄位；舊存檔缺少欄位時使用自動建議）。
 * - URL ?quality=low|medium|high|auto 只在本次連線覆寫（不寫入 save），方便 QA 與除錯。 */
(function(){
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const SAVE_KEY='supercourier.save.v1';
  const LEVELS=['low','medium','high'];
  const LABEL={low:'低',medium:'中',high:'高'};
  const PRESETS=Object.freeze({
    low:Object.freeze({pixelRatioCap:1,bloom:false,grade:false,aa:false,rain:'off',shadows:false,worldLod:Object.freeze({midRadius:1,farRadius:2})}),
    medium:Object.freeze({pixelRatioCap:1.25,bloom:false,grade:true,aa:true,rain:'normal',shadows:false,worldLod:null}),
    high:Object.freeze({pixelRatioCap:1.5,bloom:true,grade:true,aa:true,rain:'enhanced',shadows:'optional',worldLod:null}),
  });
  P.graphicsPresets=PRESETS;

  // 只依能力訊號給建議；回傳 {level, reasons, signals}。
  P.suggestGraphicsQuality=function(env){
    const nav=typeof navigator!=='undefined'?navigator:{};
    const caps=this.renderer?.capabilities||{};
    const signals=env||{cores:nav.hardwareConcurrency,memoryGB:nav.deviceMemory,maxTextureSize:caps.maxTextureSize};
    const reasons=[];let level='high';
    const cores=Number.isFinite(signals.cores)?signals.cores:null,mem=Number.isFinite(signals.memoryGB)?signals.memoryGB:null,tex=Number.isFinite(signals.maxTextureSize)?signals.maxTextureSize:null;
    if(tex!==null&&tex<4096){level='low';reasons.push('max texture size '+tex+' < 4096');}
    if(mem!==null&&mem<=2){level='low';reasons.push('deviceMemory '+mem+'GB <= 2');}
    if(cores!==null&&cores<=2){level='low';reasons.push('hardwareConcurrency '+cores+' <= 2');}
    if(level==='high'){
      if(mem!==null&&mem<=4){level='medium';reasons.push('deviceMemory '+mem+'GB <= 4');}
      if(cores!==null&&cores<=4){level='medium';reasons.push('hardwareConcurrency '+cores+' <= 4');}
    }
    if(!reasons.length)reasons.push('capability signals allow HIGH');
    return{level,reasons,signals};
  };

  function readSaved(){
    try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');const g=s&&s.graphics;
      if(g&&g.version===1)return{manual:LEVELS.includes(g.manual)?g.manual:null,shadows:g.shadows===true};}
    catch(e){/* 壞掉的存檔視為沒有設定 */}
    return{manual:null,shadows:false};
  }
  function readUrlOverride(){
    const m=(typeof location!=='undefined'&&location.search||'').match(/(?:^|[?&])quality=(low|medium|high|auto)(?:&|$)/);
    return m?m[1]:null;
  }

  P.effectiveGraphicsQuality=function(){const g=this.graphics;if(!g)return 'high';return g.sessionOverride&&g.sessionOverride!=='auto'?g.sessionOverride:(g.sessionOverride==='auto'?g.auto.level:(g.manual||g.auto.level));};
  P.graphicsPreset=function(){return PRESETS[this.effectiveGraphicsQuality()]||PRESETS.high;};

  // 把目前有效的預設套用到 renderer / 世界 LOD / 後製 / 雨 / 陰影。
  P.applyGraphicsQuality=function(){
    const level=this.effectiveGraphicsQuality(),p=PRESETS[level];
    this.highQuality=level!=='low';                                   // 相容既有的 highQuality 讀取點（雨、後製）
    if(this.renderer?.setPixelRatio)this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,p.pixelRatioCap));
    if(this.postFx?.supported){
      if(this.bloomPass)this.bloomPass.enabled=p.bloom;
      if(this.postFxGradePass)this.postFxGradePass.enabled=p.grade;
      if(this.postFxAaPass)this.postFxAaPass.enabled=p.aa;
    }
    if(this.rainMesh){this.rainMesh.geometry.setDrawRange(0,p.rain==='off'?0:p.rain==='normal'?1250:2500);this.rainMesh.material.opacity=p.rain==='enhanced'?.55:.4;if(p.rain==='off')this.rainMesh.visible=false;}
    const shadowsOn=p.shadows==='optional'&&this.graphics.shadows===true;
    if(this.renderer?.shadowMap&&this.renderer.shadowMap.enabled!==shadowsOn){this.renderer.shadowMap.enabled=shadowsOn;if(this.dirLight)this.dirLight.castShadow=shadowsOn;}
    const grid=this.worldChunkGrid;
    if(grid){
      const lod=p.worldLod,def=typeof TAIPEI_WORLD_CHUNK_CONFIG!=='undefined'?TAIPEI_WORLD_CHUNK_CONFIG:{midRadius:2,farRadius:4};
      const mid=lod?lod.midRadius:def.midRadius,far=lod?lod.farRadius:def.farRadius;
      if(grid.midRadius!==mid||grid.farRadius!==far){grid.midRadius=Math.max(grid.nearRadius,mid);grid.farRadius=Math.max(grid.midRadius,far);this.updateWorldChunkStreaming?.(true);}
    }
    const btn=typeof document!=='undefined'?document.getElementById('btn-quality'):null;
    if(btn)btn.innerText='畫質：'+(this.graphics.manual||this.graphics.sessionOverride&&this.graphics.sessionOverride!=='auto'?'':'自動·')+LABEL[level];
    return level;
  };

  // 玩家手動設定：'low'|'medium'|'high'，或 'auto' 清除手動值（回到自動建議）。
  P.setGraphicsQuality=function(choice){
    if(!this.graphics)return null;
    if(choice==='auto')this.graphics.manual=null;
    else if(LEVELS.includes(choice))this.graphics.manual=choice;
    else return this.effectiveGraphicsQuality();
    this.graphics.sessionOverride=null;
    const level=this.applyGraphicsQuality();this.save();return level;
  };
  P.setGraphicsShadows=function(on){if(!this.graphics)return;this.graphics.shadows=!!on;this.applyGraphicsQuality();this.save();};
  // 按鈕循環：低 → 中 → 高 → 自動 → 低 …
  P.toggleQuality=function(){
    const g=this.graphics;if(!g)return;
    const order=['low','medium','high','auto'],cur=g.manual||'auto';
    this.setGraphicsQuality(order[(order.indexOf(cur)+1)%order.length]);
  };

  // save：在原本的 save() 之後把 graphics 欄位併回同一份 JSON（原本的實作不認識此欄位）。
  const baseSave=P.save;
  P.save=function(...a){
    const out=baseSave.apply(this,a);
    try{
      if(this.graphics){
        const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};s.version=1;
        s.graphics={version:1,manual:this.graphics.manual,shadows:this.graphics.shadows,auto:{level:this.graphics.auto.level,reasons:this.graphics.auto.reasons,signals:this.graphics.auto.signals}};
        localStorage.setItem(SAVE_KEY,JSON.stringify(s));
      }
    }catch(e){/* 儲存失敗時沿用原 save() 的提示 */}
    return out;
  };

  P.initGraphicsQuality=function(){
    const saved=readSaved(),auto=this.suggestGraphicsQuality();
    this.graphics={manual:saved.manual,shadows:saved.shadows,auto,sessionOverride:readUrlOverride()};
    this.applyGraphicsQuality();
    if(!saved.manual&&!this.graphics.sessionOverride)this.save();   // 記錄自動建議值（與手動值分開）
  };

  // renderer 與 chunk grid 都在 init 之後才存在：init 完成後套用。
  const baseInit=P.init;
  P.init=async function(...a){const out=await baseInit.apply(this,a);this.initGraphicsQuality();return out;};
})();


/* Preview module: surface-materials.js */
/* Web material pass: portable Standard/PBR surfaces, with the original toon
 * couriers and legacy colour/light contract retained. No external textures,
 * extra geometry, per-frame scene traversal or full-scene bloom. */
(()=>{
 const P=TaipeiStreetCourier.prototype;
 // Boot-time A/B gate. ?pbr=off always restores the untouched legacy
 // materials and lighting without allocating any PBR textures or PMREM.
 // Query preference takes priority over the saved preference.
 function readSurfacePreference(){
  const q=(typeof location!=='undefined'&&location.search||'').match(/(?:^|[?&])pbr=(on|off|1|0)(?:&|$)/);
  if(q)return q[1]==='on'||q[1]==='1';
  try{return typeof localStorage==='undefined'||localStorage.getItem('courier.pbr')!=='off';}
  catch(e){return true;}
 }
 const pbrEnabled=readSurfacePreference();
 P.surfacePbrEnabled=function(){return pbrEnabled;};
 if(!pbrEnabled)return;
 const surfaceKey=/^(road$|open-building-|open-geo-sidewalk$|detailed-stone$|landmark-brick$|101-jade-glass$|landmark-bronze$|stainless-tank$|street-pole$|balcony-rail$|ug-comic-floor$|ug-ramp-comic$)/;
 function canvasTexture(game,canvas,color=false){
  const t=new THREE.CanvasTexture(canvas);
  if(color)t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=Math.min(8,game.renderer?.capabilities?.getMaxAnisotropy?.()||1);
  return t;
 }
 function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 P.surfaceTexture=function(kind){
  const cache=this.surfaceTextures||(this.surfaceTextures=new Map());
  if(cache.has(kind))return cache.get(kind);
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),rand=random(781130);
  if(kind==='asphalt'){
   x.fillStyle='#39434a';x.fillRect(0,0,256,256);
   for(let i=0;i<18000;i++){
    const v=38+Math.floor(rand()*45);x.fillStyle=`rgba(${v},${v+7},${v+10},.45)`;
    x.fillRect(Math.floor(rand()*256),Math.floor(rand()*256),1,1);
   }
   // Broad, low-contrast wear keeps repetition unobtrusive at riding speed.
   const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,'#b8b3a009');g.addColorStop(.5,'#17242c0b');g.addColorStop(1,'#b8b3a009');x.fillStyle=g;x.fillRect(0,0,256,256);
  }else{
   x.fillStyle=kind==='facade-height'?'#999999':'#eeeeee';x.fillRect(0,0,256,256);
   x.fillStyle=kind==='facade-height'?'#929292':'#dddddd';
   for(let i=0;i<256;i+=16){x.fillRect(0,i,256,1);x.fillRect(i,0,1,256);}
   if(kind.startsWith('facade-')){
    x.fillStyle=kind==='facade-height'?'#888888':'#666666';
    for(const u of [20,144])x.fillRect(u,32,92,166);
    x.fillStyle=kind==='facade-height'?'#a0a0a0':'#cccccc';x.fillRect(0,222,256,14);
   }
  }
  const t=canvasTexture(this,c,kind==='asphalt');cache.set(kind,t);return t;
 };
 // Generate tangent-space normal maps once from the original procedural
 // height sources. No network assets, extra scene meshes or per-frame work.
 P.surfaceNormal=function(kind){
  const cache=this.surfaceTextures||(this.surfaceTextures=new Map()),key='normal:'+kind;
  if(cache.has(key))return cache.get(key);
  const source=this.surfaceTexture(kind).image,w=source.width,h=source.height;
  const pixels=source.getContext('2d').getImageData(0,0,w,h).data;
  const value=(x,y)=>{
   const i=4*(((y+h)%h)*w+(x+w)%w);
   return (pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)/255;
  };
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const context=cv.getContext('2d'),output=context.createImageData(w,h);
  const strength=kind==='asphalt'?1.7:3.0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const dx=(value(x-1,y)-value(x+1,y))*strength;
   const dy=(value(x,y-1)-value(x,y+1))*strength;
   const len=Math.hypot(dx,dy,1),i=4*(y*w+x);
   output.data[i]=Math.round(127.5+127.5*dx/len);
   output.data[i+1]=Math.round(127.5+127.5*dy/len);
   output.data[i+2]=Math.round(127.5+127.5/len);
   output.data[i+3]=255;
  }
  context.putImageData(output,0,0);
  const t=canvasTexture(this,cv);cache.set(key,t);return t;
 };
 P.surfaceEnvironment=function(){
  if(this.surfaceEnvTarget)return this.surfaceEnvTarget.texture;
  // Node contract tests have a mock renderer; PMREM needs the real WebGL API.
  if(!this.renderer?.getContext||!THREE.PMREMGenerator)return null;
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  const sky=x.createLinearGradient(0,0,0,256);
  for(const [at,color] of [[0,'#7facc7'],[.42,'#d1e2e6'],[.5,'#eff0e3'],[.58,'#909890'],[1,'#424d49']])sky.addColorStop(at,color);
  x.fillStyle=sky;x.fillRect(0,0,512,256);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(this.renderer);
  try{this.surfaceEnvTarget=pmrem.fromEquirectangular(t);}finally{t.dispose();pmrem.dispose();}
  return this.surfaceEnvTarget.texture;
 };
 const baseTexture=P.makeTexture;
 P.makeTexture=function(kind,...args){return kind==='asphalt'?this.surfaceTexture('asphalt'):baseTexture.call(this,kind,...args);};
 const baseFacade=P.makeOpenGeoFacadeTexture;
 P.makeOpenGeoFacadeTexture=function(glass=false){
  const t=baseFacade.call(this,glass);
  if(t.userData.surfaceDetail)return t;
  const x=t.image.getContext('2d');
  // Keep the one-storey/two-bay UV contract; distinguish recessed glazing
  // from ceramic/concrete without adding window meshes or draw calls.
  x.fillStyle=glass?'#64808b22':'#807b6e24';
  for(let y=0;y<256;y+=16)x.fillRect(0,y,256,1);
  for(let u=0;u<256;u+=16)x.fillRect(u,0,1,256);
  for(const u of [20,144]){
   const reflection=x.createLinearGradient(u,32,u+92,198);
   reflection.addColorStop(0,glass?'#a7cad3':'#8daab6');reflection.addColorStop(.4,'#577b90');reflection.addColorStop(1,'#2e485b');
   x.fillStyle=reflection;x.fillRect(u+5,37,82,156);
   x.fillStyle='#d7e6e42a';x.fillRect(u+8,39,10,152);
   x.fillStyle='#d4e2dd';x.fillRect(u+44,32,4,166);x.fillRect(u,106,92,3);
   x.fillStyle='#20333c55';x.fillRect(u,198,92,4);
  }
  t.userData.surfaceDetail=true;t.needsUpdate=true;return t;
 };
 const baseMat=P.mat;
 P.mat=function(key,color=0xffffff,kind=null,variant=0){
  const old=baseMat.call(this,key,color,kind,variant);
  if(!surfaceKey.test(key)||old.isMeshStandardMaterial)return old;
  const glass=kind==='glass'||key==='101-jade-glass',metal=/metal|bronze|tank|pole|rail/.test(key),road=key==='road';
  const m=new THREE.MeshStandardMaterial({color:old.color,map:old.map,side:old.side,
   roughness:glass?.27:metal?.38:road?.91:.88,metalness:metal?.65:glass?.12:0,
   envMap:this.surfaceEnvironment(),envMapIntensity:glass?.55:metal?.45:.18});
  if(road){m.normalMap=this.surfaceNormal('asphalt');m.normalScale.set(.25,.25);}
  else if(!glass&&!metal){m.normalMap=this.surfaceNormal('tile-height');m.normalScale.set(.35,.35);}
  m.name='Courier surface / '+key;m.userData.surfaceMaterial=true;
  this.cityMats.set(key,m);old.dispose();return m;
 };
 const baseChunkMaterials=P.ensureWorldChunkMaterials;
 P.ensureWorldChunkMaterials=function(){
  const m=baseChunkMaterials.call(this);
  if(!m.wall.userData.surfaceFacade){
   m.wall.normalMap=this.surfaceNormal('facade-height');m.wall.normalScale.set(.4,.4);
   m.wall.roughnessMap=this.surfaceTexture('facade-roughness');m.wall.roughness=.92;
   m.glass.normalMap=null;m.glass.bumpMap=null;
   m.glass.roughnessMap=this.surfaceTexture('facade-roughness');m.glass.roughness=.5;
   m.glass.metalness=.12;m.glass.envMapIntensity=.5;
   m.wall.userData.surfaceFacade=true;m.wall.needsUpdate=m.glass.needsUpdate=true;
  }
  return m;
 };
 P.syncSurfaceWeather=function(){
  const all=new Set([...(this.cityMats?.values()||[]),...Object.values(this.worldChunkMaterials||{})]);
  for(const m of all)if(m.userData.surfaceMaterial){
   const glass=m===this.worldChunkMaterials?.glass||m.name?.includes('101-jade-glass');
   m.envMapIntensity=(this.isNight?.12:1)*(glass?.5:m.metalness>.3?.45:.18);
  }
  const road=this.roadMesh?.material;
  if(road?.isMeshStandardMaterial){
   // Legacy toggleRain() swaps every road's shared map for the old rain
   // texture. Restore our PBR aggregate in BOTH weather states; wetness
   // is expressed physically through roughness, not fake metallic paint.
   const asphalt=this.surfaceTexture('asphalt');
   if(road.map!==asphalt){road.map=asphalt;road.needsUpdate=true;}
   road.roughness=this.isRaining?.3:.91;
   road.metalness=0;
   road.envMapIntensity=this.isNight?.16:this.isRaining?.65:.18;
  }
 };
 const baseLighting=P.styleLighting;
 P.styleLighting=function(){
  const out=baseLighting.call(this);
  if(this.isNight){
   this.renderer.toneMappingExposure=.95;this.hemiLight.intensity=.32;
   this.hemiLight.color.setHex(0x889fcd);this.hemiLight.groundColor.setHex(0x273445);
   this.dirLight.intensity=.28;this.dirLight.color.setHex(0x9bb5e0);
  }else{
   this.renderer.toneMappingExposure=.94;this.hemiLight.intensity=.78;
   this.hemiLight.color.setHex(0xe6eff5);this.hemiLight.groundColor.setHex(0x77746b);
   this.dirLight.intensity=1.12;this.dirLight.color.setHex(0xffecd5);
   this.fillLight.intensity=.18;this.fillLight.color.setHex(0xc1d8ec);
  }
  this.syncSurfaceWeather();return out;
 };
 const baseRain=P.toggleRain;
 P.toggleRain=function(...args){const out=baseRain.apply(this,args);this.syncSurfaceWeather();return out;};
})();


/* Preview module: taipei-district-styles.js */
/* P2.3 | Data-light Taipei district facades and decorative shop panels.
 * No third-party artwork, POI assertions, physics modifications or HTTP fetch.
 * Opt-out: ?facades=off. The LOW preset also retains original architecture.
 */
(()=>{
 'use strict';
 const P=TaipeiStreetCourier.prototype;
 const names=['ximen','oldWest','station','zhongshan'];
 const palettes={
  ximen:{wall:'#e9baa3',trim:'#874755',window:'#55798d',accent:'#c45c62',sign:0xb84d59,colors:[0xe4b19f,0xd7a78c,0xe2b9ad,0xc9a69c,0xbcaeac,0xcfa08c]},
  oldWest:{wall:'#d5c0a2',trim:'#6c635a',window:'#74919b',accent:'#aa8669',sign:0x91735e,colors:[0xc2a78d,0xc5b59f,0xd9baa0,0xb9aaa0,0xb8b6ab,0xc6a18c]},
  station:{wall:'#bcd1db',trim:'#4e6777',window:'#7aabbb',accent:'#8faebc',sign:0x477b9e,colors:[0x97b7c8,0xb4ced5,0x9eb3ca,0xacc8d6,0xa5c0c8,0x8daab9]},
  zhongshan:{wall:'#d7c6b8',trim:'#685b60',window:'#789596',accent:'#a98880',sign:0x866d76,colors:[0xc6b2a6,0xd7bcaa,0xb5ada8,0xbfc2b7,0xc8adae,0xbcb6ad]}
 };
 const pick=name=>palettes[name]?name:'zhongshan';
 const district=(x,z)=>x<-660?(z>-20?'ximen':'oldWest'):x<-525?'station':'zhongshan';
 function override(){
  if(typeof location==='undefined')return null;
  const m=(location.search||'').match(/(?:^|[?&])facades=(off|on)(?:&|$)/);return m?m[1]:null;
 }
 P.taipeiDistrictFor=district;
 P.taipeiDistrictFacadeEnabled=function(){
  const forced=override();
  if(forced==='off')return false;
  if(forced==='on')return true;
  // Before initGraphicsQuality has run, the session URL is still authoritative.
  // Avoid eager high-quality district allocations during an explicit low boot.
  if(!this.graphics&&typeof location!=='undefined'&&/(?:^|[?&])quality=low(?:&|$)/.test(location.search||''))return false;
  return this.effectiveGraphicsQuality?.()!=='low';
 };
 P.taipeiDistrictBuildingColor=(name,style)=>palettes[pick(name)].colors[((Number(style)||0)%6+6)%6];
 P.makeTaipeiDistrictTexture=function(name,glass=false){
  name=pick(name);
  const key='p23:'+name+':'+(glass?'glass':'wall'),cache=this.cityTextures||(this.cityTextures=new Map());
  if(cache.has(key))return cache.get(key);
  const cv=document.createElement('canvas');cv.width=cv.height=256;
  const c=cv.getContext('2d'),v=palettes[name];
  if(!c)return this.makeOpenGeoFacadeTexture(glass);
  c.fillStyle=v.wall;c.fillRect(0,0,256,256);
  c.fillStyle=v.accent;c.fillRect(0,224,256,name==='ximen'?19:11);
  if(name==='station')c.fillRect(0,12,256,9);
  if(name==='oldWest')c.fillRect(0,184,256,8);
  const bays=name==='station'?[[13,108],[136,108]]:name==='oldWest'?[[33,73],[151,73]]:name==='ximen'?[[21,90],[140,91]]:[[26,81],[151,80]];
  for(const [x,w] of bays){
   c.fillStyle=v.trim;c.fillRect(x-6,25,w+12,174);
   c.fillStyle=v.window;c.fillRect(x,33,w,155);
   c.fillStyle=glass?'#a4cbd9':'#c0d9d8';c.fillRect(x+7,37,Math.max(5,w*.14),148);
   c.fillStyle=v.trim;c.fillRect(x,119,w,5);
   if(name==='station'){c.fillStyle='#d4e7ed';c.fillRect(x+Math.floor(w/2),33,4,155);}
   if(name==='oldWest')c.fillRect(x,157,w,7);
   if(name==='ximen'){c.fillStyle='#f5dbb5';c.fillRect(x,188,w,8);}
  }
  c.fillStyle=v.trim;c.fillRect(0,244,256,7);
  const texture=new THREE.CanvasTexture(cv);texture.encoding=THREE.sRGBEncoding;
  if('colorSpace' in texture&&THREE.SRGBColorSpace)texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=Math.min(8,this.renderer?.capabilities?.getMaxAnisotropy?.()||1);
  cache.set(key,texture);return texture;
 };
 const ensure=P.ensureWorldChunkMaterials;
 P.ensureWorldChunkMaterials=function(){
  const materials=ensure.call(this);
  if(materials.p23Pairs||!this.taipeiDistrictFacadeEnabled())return materials;
  // Create the collection now, but allocate each district's two GPU textures
  // only when a visible building actually uses that district.
  // Keep it non-enumerable: PBR weather scans Object.values(materials).
  Object.defineProperty(materials,'p23Pairs',{value:Object.create(null),configurable:true});
  return materials;
 };
 P.taipeiDistrictWallMaterial=function(name,glass=false){
  if(!this.taipeiDistrictFacadeEnabled())return null;
  name=pick(name);
  const materials=this.ensureWorldChunkMaterials(),pairs=materials.p23Pairs;
  if(!pairs[name]){
   const wall=materials.wall.clone(),glazing=materials.glass.clone();
   wall.map=this.makeTaipeiDistrictTexture(name,false);
   glazing.map=this.makeTaipeiDistrictTexture(name,true);
   wall.name='Taipei '+name+' facade';glazing.name='Taipei '+name+' glazing';
   if(wall.isMeshStandardMaterial)wall.envMapIntensity=this.isNight?.035:.18;
   if(glazing.isMeshStandardMaterial)glazing.envMapIntensity=this.isNight?.10:.50;
   wall.needsUpdate=glazing.needsUpdate=true;
   pairs[name]={wall,glass:glazing};
  }
  return pairs[name][glass?'glass':'wall'];
 };
 const oldWeather=P.syncSurfaceWeather;
 if(oldWeather)P.syncSurfaceWeather=function(){
  const result=oldWeather.apply(this,arguments);
  for(const pair of Object.values(this.worldChunkMaterials?.p23Pairs||{})){
   if(pair.wall.isMeshStandardMaterial)pair.wall.envMapIntensity=this.isNight?.035:.18;
   if(pair.glass.isMeshStandardMaterial)pair.glass.envMapIntensity=this.isNight?.10:.50;
  }
  return result;
 };
 const oldBatch=P.rebuildWorldChunkDetailBatches;
 P.rebuildWorldChunkDetailBatches=function(){
  const count=oldBatch.call(this);
  this.taipeiDistrictSignStats={signs:0,batches:0};
  if(!this.taipeiDistrictFacadeEnabled()||!this.worldChunkDetailGroup)return count;
  // Reuse near-road, already-validated awning placements. One instanced batch
  // per district at most; no new ride slabs, collider or fabricated POI IDs.
  const rows=[];
  for(const entry of this.worldChunkRenderEntries?.values?.()||[]){
   if(entry.tier!=='near')continue;
   for(const awning of entry.detailRows?.awning||[]){
    if(rows.length>=320)break;
    rows.push({...awning,district:district(awning.x,awning.z)});
   }
  }
  const text={ximen:'小吃',oldWest:'雜貨',station:'商店',zhongshan:'茶飲'};
  const cache=this.taipeiSignMaterials||(this.taipeiSignMaterials=new Map());
  let batches=0;
  for(const name of names){
   const list=rows.filter(s=>s.district===name);if(!list.length)continue;
   let material=cache.get(name);
   if(!material){
    const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');
    c.fillStyle=palettes[name].trim;c.fillRect(0,0,256,128);
    c.fillStyle=palettes[name].accent;c.fillRect(8,8,240,112);
    c.fillStyle='#fff4df';c.font='bold 56px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(text[name],128,65,215);
    const map=new THREE.CanvasTexture(cv);map.encoding=THREE.sRGBEncoding;
    if('colorSpace' in map&&THREE.SRGBColorSpace)map.colorSpace=THREE.SRGBColorSpace;
    material=this.mat('open-building-p23-sign',0xffffff).clone();material.map=map;material.color.setHex(0xffffff);
    material.name='P23 generic shop lightbox '+name;material.needsUpdate=true;
    cache.set(name,material);
   }
   const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,list.length);
   const mat=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
   list.forEach((s,i)=>{quat.setFromAxisAngle(axis,s.a||0);pos.set(s.x,s.y-.47,s.z);scale.set(s.w*.76,.60,.12);mat.compose(pos,quat,scale);mesh.setMatrixAt(i,mat);});
   mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;mesh.castShadow=false;
   mesh.name='P23 generic storefront / '+name;mesh.userData.openDataDistrictSign=name;mesh.userData.decorativeOnly=true;
   mesh.userData.worldChunkLod='near';this.worldChunkDetailGroup.add(mesh);batches++;
  }
  this.taipeiDistrictSignStats={signs:rows.length,batches};
  return count; // Original merged-detail accounting intentionally unchanged.
 };
 globalThis.TAIPEI_P23_STREET_STYLE=Object.freeze({districts:names.slice(),signBatchLimit:4,signLimit:320,rollback:'?facades=off'});
})();

/* Preview module: graphics-lighting.js */
/* V7 P2: local sun shadows and coherent day/night city lighting.
 * Extends the Three.js browser track; no gameplay, physics, AI, save schema,
 * external textures or global city scans in the animation loop.
 * Set ?lighting=off for a boot-time rollback to P1 lighting. */
(()=>{
 const P=TaipeiStreetCourier.prototype;
 function param(name){
  if(typeof location==='undefined')return null;
  const m=(location.search||'').match(new RegExp('(?:^|[?&])'+name+'=(on|off|1|0)(?:&|$)'));
  return m?(m[1]==='on'||m[1]==='1'):null;
 }
 const enabled=param('lighting')!==false;
 const shadowOverride=param('shadows');
 P.v7LightingEnabled=function(){return enabled;};
 if(!enabled)return;

 const daylight=Object.freeze({
  background:0x9bc4e2,fog:0xaec9cd,density:.00039,sky:0xffffff,
  hemi:0xf2f3e8,ground:0x727a77,ambient:.83,
  sun:0xffe9cf,sunPower:1.18,fill:0xbcd5ec,fillPower:.22,exposure:.94
 });
 const moonlight=Object.freeze({
  background:0x111c30,fog:0x1d2c44,density:.00068,sky:0x405570,
  hemi:0x99b0d2,ground:0x253143,ambient:.3,
  sun:0xadc6f0,sunPower:.2,fill:0xffc38b,fillPower:.16,exposure:1.0
 });
 const oldStyle=P.styleLighting;
 P.styleLighting=function(...args){
  const result=oldStyle.apply(this,args);
  if(!this.scene||!this.renderer||!this.hemiLight||!this.dirLight||!this.fillLight)return result;
  const profile=this.isNight?moonlight:daylight;
  this.scene.background?.setHex(profile.background);
  if(this.scene.fog){
   this.scene.fog.color.setHex(profile.fog);
   this.scene.fog.density=profile.density;
  }
  // The textured sky is a single BackSide sphere created by initThree().
  // Cache it: never traverse the scene for each lighting/weather change.
  if(!this.v7Sky){
   this.v7Sky=this.scene.children.find(o=>o.isMesh&&o.material?.side===THREE.BackSide&&o.geometry?.type==='SphereGeometry')||null;
  }
  this.v7Sky?.material?.color?.setHex(profile.sky);
  this.hemiLight.color.setHex(profile.hemi);
  this.hemiLight.groundColor.setHex(profile.ground);
  this.hemiLight.intensity=profile.ambient;
  this.dirLight.color.setHex(profile.sun);
  this.dirLight.intensity=profile.sunPower;
  this.fillLight.color.setHex(profile.fill);
  this.fillLight.intensity=profile.fillPower;
  this.renderer.toneMappingExposure=profile.exposure;
  this.syncV7SunShadows();
  return result;
 };

 P.setupV7Sun=function(){
  if(this.v7SunReady||!this.renderer?.shadowMap||!this.dirLight?.shadow)return;
  const light=this.dirLight,sh=light.shadow,camera=sh.camera;
  // The original 1000-unit shadow frustum had very low texel density.
  // Restrict it to the local street while reusing the one existing sun.
  const radius=135;
  camera.left=-radius;camera.right=radius;
  camera.top=radius;camera.bottom=-radius;
  camera.near=2;camera.far=520;camera.updateProjectionMatrix();
  sh.mapSize.set(Math.min(1024,this.renderer.capabilities?.maxTextureSize||1024),Math.min(1024,this.renderer.capabilities?.maxTextureSize||1024));
  sh.bias=-.0002;sh.normalBias=.027;
  this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if(light.target.parent!==this.scene)this.scene.add(light.target);
  this.v7SunReady=true;
 };

 P.updateV7Sun=function(force=false){
  if(!this.renderer?.shadowMap.enabled||!this.dirLight||!this.scene)return;
  const center=(this.gameState==='PLAYING'&&this.carPos)||this.getPlayerStartPos?.();
  if(!center||!Number.isFinite(center.x)||!Number.isFinite(center.z))return;
  const prev=this.v7SunAnchor,dx=prev?center.x-prev.x:Infinity,dz=prev?center.z-prev.z:Infinity;
  // Snap the shadow region only after moving 18 game units. No scene scans.
  if(!force&&dx*dx+dz*dz<18*18)return;
  const y=Number.isFinite(center.y)?center.y:0;
  this.dirLight.target.position.set(center.x,y,center.z);
  this.dirLight.position.set(center.x+105,y+225,center.z+92);
  this.dirLight.target.updateMatrixWorld();
  this.dirLight.updateMatrixWorld();
  if(!this.v7SunAnchor)this.v7SunAnchor=new THREE.Vector3();
  this.v7SunAnchor.set(center.x,y,center.z);
 };

 P.updateV7ShadowButton=function(){
  const button=typeof document!=='undefined'?document.getElementById('btn-shadows'):null;
  if(!button)return;
  const requested=this.v7ShadowOverride===null?this.graphics?.shadows===true:this.v7ShadowOverride;
  const high=this.effectiveGraphicsQuality?.()==='high';
  button.textContent='陰影：'+(requested?(high?(this.isNight?'夜間停用':'開'):'僅高畫質'):'關');
 };
 P.syncV7SunShadows=function(){
  if(!this.renderer?.shadowMap||!this.dirLight)return;
  const requested=this.v7ShadowOverride===null?this.graphics?.shadows===true:this.v7ShadowOverride;
  const shouldEnable=!!requested&&this.effectiveGraphicsQuality?.()==='high'&&!this.isNight;
  this.renderer.shadowMap.enabled=shouldEnable;
  this.dirLight.castShadow=shouldEnable;
  if(shouldEnable){this.setupV7Sun();this.updateV7Sun(true);}
  this.updateV7ShadowButton();
 };

 // New streamed NEAR masonry casts the sun; transparent glass and MID/FAR
 // instanced skyline remain excluded from expensive shadow rendering.
 const oldBuildNear=P.buildWorldChunkNear;
 if(oldBuildNear)P.buildWorldChunkNear=function(...args){
  const entry=oldBuildNear.apply(this,args);
  for(const child of entry.group?.children||[]){
   if(!child.isMesh||!child.userData?.openDataBuildings)continue;
   const material=child.material;
   const districtWall=Object.values(this.worldChunkMaterials?.p23Pairs||{}).some(pair=>material===pair.wall);
   child.castShadow=child.userData.openDataBuildingLayer==='roofs'||material===this.worldChunkMaterials?.wall||districtWall;
  }
  return entry;
 };

 const oldApplyQuality=P.applyGraphicsQuality;
 P.applyGraphicsQuality=function(...args){
  const result=oldApplyQuality.apply(this,args);
  this.syncV7SunShadows();
  return result;
 };
 const oldSetShadows=P.setGraphicsShadows;
 P.setGraphicsShadows=function(on){
  // Manual selection wins over ?shadows=on/off for the current session.
  this.v7ShadowOverride=null;
  return oldSetShadows.call(this,on);
 };
 const oldApplyLighting=P.applyLighting;
 P.applyLighting=function(...args){
  const result=oldApplyLighting.apply(this,args);
  this.syncV7SunShadows();
  return result;
 };
 const oldLoop=P.loop;
 P.loop=function(timestamp){
  this.updateV7Sun();
  return oldLoop.call(this,timestamp);
 };
 const oldInit=P.init;
 P.init=async function(...args){
  this.v7ShadowOverride=shadowOverride;
  const result=await oldInit.apply(this,args);
  const anchor=typeof document!=='undefined'?document.getElementById('btn-quality'):null;
  if(anchor&&!document.getElementById('btn-shadows')){
   const btn=anchor.cloneNode(false);
   btn.id='btn-shadows';
   btn.addEventListener('click',()=>{
    const current=this.v7ShadowOverride===null?this.graphics?.shadows===true:this.v7ShadowOverride;
    this.setGraphicsShadows(!current);
   });
   anchor.insertAdjacentElement('afterend',btn);
  }
  this.syncV7SunShadows();
  return result;
 };
})();

/* Preview module: arcade-fx.js */
/* 原創街機速度 / 交付回饋（P2-03）：速度暗角、Nitro 邊緣光暈脈衝、落地衝擊、擦身 HUD 脈衝、
 * PERFECT DELIVERY 閃光、combo 里程碑脈衝。全部用 DOM 疊層 + 少量鏡頭偏移，不增加 3D draw call。
 *
 * Reduced Motion（game.reducedMotion）時一律關閉：鏡頭晃動（落地衝擊）、快速脈衝（Nitro / HUD / 閃光）、
 * 過度速度效果（暗角）；PERFECT DELIVERY 只留下靜態文字橫幅。
 * 視覺語彙刻意與其他街機遊戲區隔：青 / 金柔光、圓角膠囊橫幅、無箭頭、無沿用字體或動畫。 */
(function(){
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const MILESTONES=[3,5,8,10];
  const NEAR_MISS={min:1.2,max:3.4,speed:14,cooldown:1.1};

  P.arcadeFxState=function(){
    if(!this.arcadeFx){
      // 無真實 DOM（Node 測試 harness）時使用假元素，事件計數與邏輯照常運作。
      const real=typeof document!=='undefined'&&document.body&&typeof document.body.appendChild==='function';
      const dummy=()=>({style:{},offsetWidth:0,textContent:'',classList:{add(){},remove(){},toggle(){}}});
      const root=real?document.createElement('div'):dummy();if(real)root.id='arcade-fx';
      const mk=c=>{if(!real)return dummy();const d=document.createElement('div');d.className=c;root.appendChild(d);return d;};
      const els={vignette:mk('fx-vignette'),nitro:mk('fx-nitro'),land:mk('fx-land'),flash:mk('fx-flash')};
      // 橫幅獨立成最上層元素（HUD 面板之上），其餘疊層維持在 HUD 之下。
      const banner=real?document.createElement('div'):dummy();if(real){banner.id='arcade-fx-banner';banner.className='fx-banner';}els.banner=banner;
      if(real){document.body.appendChild(root);document.body.appendChild(banner);}
      this.arcadeFx={root,els,prevGrounded:true,prevVy:0,land:0,nearMisses:0,perfects:0,lastMilestone:0,nearCooldown:0,bannerTimer:null,landings:0};
    }
    return this.arcadeFx;
  };
  const retrigger=(el,cls)=>{el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);};
  const hudPulse=(game,id)=>{if(game.reducedMotion)return;let el=null;try{el=document.getElementById(id);}catch(e){/* harness */}if(el&&el.classList&&typeof el.classList.remove==='function')retrigger(el,'fx-hud-pulse');};

  P.fxBanner=function(text,ms=1300){
    const fx=this.arcadeFxState(),b=fx.els.banner;b.textContent=text;b.classList.add('show');
    b.classList.toggle('animated',!this.reducedMotion);if(!this.reducedMotion)retrigger(b,'animated');
    clearTimeout(fx.bannerTimer);fx.bannerTimer=setTimeout(()=>b.classList.remove('show'),ms);
  };

  // 每個 simulation frame 呼叫：連續效果（暗角 / Nitro）與事件偵測（落地 / 擦身）。
  P.updateArcadeFx=function(dt){
    const fx=this.arcadeFxState(),rm=!!this.reducedMotion,playing=this.gameState==='PLAYING';
    const speed=Math.abs(this.carSpeed||0);
    // 進入 Reduced Motion：清掉可能殘留的脈衝 class（class 在動畫結束後仍會留在元素上）。
    if(rm&&!fx.rmCleared){
      for(const k of ['nitro','land','flash'])fx.els[k].classList.remove('pulse','hit');
      fx.els.banner.classList.remove('animated');
      for(const id of ['technique-card','hud-combo-counter','skill-chain']){let el=null;try{el=document.getElementById(id);}catch(e){/* harness */}if(el&&el.classList&&typeof el.classList.remove==='function')el.classList.remove('fx-hud-pulse');}
      fx.land=0;fx.rmCleared=true;
    }else if(!rm)fx.rmCleared=false;
    // 速度暗角：10 → 32 單位之間連續上升，最大 .85 不透明度。
    const v=playing&&!rm?Math.max(0,Math.min(1,(speed-10)/22)):0;
    fx.els.vignette.style.opacity=(v*.85).toFixed(3);
    // Nitro：dashTime > 0 時顯示邊緣光暈，開始瞬間單次脈衝。
    const nitro=playing&&!rm&&(this.dashTime||0)>0;
    if(nitro&&!fx.nitroOn)retrigger(fx.els.nitro,'pulse');
    fx.nitroOn=nitro;fx.els.nitro.style.opacity=nitro?'1':'0';
    // 落地衝擊：離地 → 著地且下墜速度夠大時，鏡頭下沉量隨 exp 衰減；Reduced Motion 不產生。
    const grounded=!!this.isGrounded,vy=this.carVy||0;
    if(playing&&!fx.prevGrounded&&grounded&&fx.prevVy<-4&&!rm){
      fx.land=Math.min(1,-fx.prevVy/18);fx.landings++;retrigger(fx.els.land,'hit');
    }
    fx.prevGrounded=grounded;fx.prevVy=vy;fx.land*=Math.exp(-9*dt);if(fx.land<.003)fx.land=0;
    // 擦身而過：高速經過其他載具的近距離（未碰撞）。
    fx.nearCooldown=Math.max(0,fx.nearCooldown-dt);
    if(playing&&fx.nearCooldown===0&&speed>NEAR_MISS.speed&&!(this.collisionCooldown>0)){
      const p=this.carPos;
      for(const list of [this.traffic,this.scooters]){
        for(const t of list||[]){
          const q=t.group?.position||t.position;if(!q)continue;
          const d=Math.hypot(q.x-p.x,q.z-p.z);
          if(d>NEAR_MISS.min&&d<NEAR_MISS.max&&Math.abs((q.y||0)-p.y)<3){
            fx.nearMisses++;fx.nearCooldown=NEAR_MISS.cooldown;hudPulse(this,'technique-card');break;
          }
        }
        if(fx.nearCooldown>0)break;
      }
    }
    // combo 里程碑（只在跨過里程碑的那一刻脈衝一次）。
    const c=this.comboCount||0;
    if(c<fx.lastMilestone)fx.lastMilestone=0;
    for(const m of MILESTONES)if(c>=m&&fx.lastMilestone<m){fx.lastMilestone=m;this.gameFxEvent?.('combo-milestone');hudPulse(this,'hud-combo-counter');hudPulse(this,'skill-chain');}
  };

  // 鏡頭：落地下沉（Reduced Motion 時 fx.land 恆為 0，不晃動）。
  const baseCamera=P.updateCamera;
  P.updateCamera=function(dt){
    const out=baseCamera.apply(this,arguments);
    const fx=this.arcadeFx;if(fx&&fx.land>0&&this.camera)this.camera.position.y-=fx.land*.45;
    return out;
  };
  const baseEffects=P.updateEffects;
  P.updateEffects=function(dt){const out=baseEffects.call(this,dt);this.updateArcadeFx(dt);return out;};

  // PERFECT DELIVERY：成功交付、貨物完好（integrity 100）且倒數還剩一半以上。
  const baseFinish=P.finishOrder;
  P.finishOrder=function(success){
    const perfect=!!success&&!!this.activeCustomer&&this.integrity>=100&&this.activeCustomerTimer>(this.activeCustomerInitialTime||0)*.5;
    const out=baseFinish.apply(this,arguments);
    // 音效事件（role 名稱由 audio-manager 集中對應；Reduced Motion 不影響音訊）。
    if(success&&this.gameFxEvent)this.gameFxEvent(perfect?'perfect-delivery':'delivery-success');
    if(perfect){const fx=this.arcadeFxState();fx.perfects++;if(!this.reducedMotion)retrigger(fx.els.flash,'hit');this.fxBanner('PERFECT DELIVERY · 完美交付');}
    return out;
  };
  // 新一班開始時重置累計（不影響 DOM 疊層本身）。
  const baseStart=P.startGame;
  P.startGame=function(){const out=baseStart.apply(this,arguments);const fx=this.arcadeFxState();fx.nearMisses=0;fx.perfects=0;fx.lastMilestone=0;fx.land=0;fx.landings=0;return out;};
})();


/* Preview module: delivery-modifiers.js */
/* 原創 Delivery Modifier framework（P5-01）。
 * 每個 modifier 是一份資料定義：id / label / description / rewardMultiplier / timeMultiplier / integrityRule / eligible / condition / icon。
 * deliverCustomer() 等既有流程不含任何 modifier 判斷；這個檔案只用 wrapper 掛上 board / 傷害 / 交付 / 結束 hook。
 *   - eligible(ctx)  ：接單時這張訂單能不能帶這個 modifier（例如 RAIN_BONUS 只在下雨時、UNDERGROUND 只在 B1 目的地）。
 *   - condition(ctx) ：交付時獎勵是否成立（例如 HOT_FOOD 要在時限四分之一前送達；不成立 → 這個 modifier 不加成，但訂單照常完成）。
 *   - integrityRule  ：damageMultiplier（碰撞貨損倍率）、decayPerSecond（隨時間損耗，如冰淇淋融化）。
 * 舊普通訂單（沒有 modifiers）完全不受影響：不改計時、不改運費、不顯示任何 UI。
 * 自動指派預設關閉（chance=0），供 P5-04 Contract Director 與 QA 以 seed 決定性地使用；網址 ?modifiers=on 可開啟試玩（chance .35）。 */
(function(){
  const MAX_REWARD=2.5,MIN_TIME=.7;
  const def=o=>Object.freeze({...o,integrityRule:Object.freeze({damageMultiplier:1,decayPerSecond:0,...(o.integrityRule||{})}),icon:Object.freeze(o.icon)});
  const MODIFIERS=Object.freeze({
    HOT_FOOD:def({id:'HOT_FOOD',label:'熱食',description:'趁熱送：時限縮短 15%，在時限剩 25% 以前送達才有加成',rewardMultiplier:1.25,timeMultiplier:.85,icon:{glyph:'♨',color:'#ff8a4c'},
      eligible:()=>true,condition:c=>c.remainingRatio>=.25}),
    FRAGILE:def({id:'FRAGILE',label:'易碎',description:'碰撞貨損 ×1.6；貨物完整度需維持 70% 以上才有加成',rewardMultiplier:1.35,timeMultiplier:1,integrityRule:{damageMultiplier:1.6},icon:{glyph:'✦',color:'#9bd7ff'},
      eligible:()=>true,condition:c=>c.integrity>=70}),
    ICE_CREAM:def({id:'ICE_CREAM',label:'冰品',description:'會隨時間融化（每秒 −0.4% 完整度）；完整度 60% 以上才有加成',rewardMultiplier:1.3,timeMultiplier:.8,integrityRule:{decayPerSecond:.4},icon:{glyph:'❄',color:'#8ee9ff'},
      eligible:()=>true,condition:c=>c.integrity>=60}),
    VIP:def({id:'VIP',label:'VIP',description:'貴賓件：貨損 ×1.2、時限 −10%；完整度 85% 以上才有加成',rewardMultiplier:1.6,timeMultiplier:.9,integrityRule:{damageMultiplier:1.2},icon:{glyph:'★',color:'#ffd260'},
      eligible:()=>true,condition:c=>c.integrity>=85}),
    NIGHT_ONLY:def({id:'NIGHT_ONLY',label:'夜間單',description:'只在夜間接得到，夜間送達有加成',rewardMultiplier:1.3,timeMultiplier:1,icon:{glyph:'☾',color:'#b9a8ff'},
      eligible:c=>!!c.night,condition:c=>!!c.night}),
    RAIN_BONUS:def({id:'RAIN_BONUS',label:'雨天加成',description:'下雨時接單：時限 +10%，雨中送達有加成',rewardMultiplier:1.25,timeMultiplier:1.1,icon:{glyph:'☂',color:'#6ec6ff'},
      eligible:c=>!!c.rain,condition:c=>!!c.rain}),
    UNDERGROUND:def({id:'UNDERGROUND',label:'地下街',description:'目的地在 B1 地下街：時限 +15%',rewardMultiplier:1.3,timeMultiplier:1.15,icon:{glyph:'▼',color:'#7ee2b8'},
      eligible:c=>!!c.undergroundDestination,condition:()=>true}),
    STUNT_BONUS:def({id:'STUNT_BONUS',label:'技巧單',description:'送單途中完成 3 次以上技巧才有加成',rewardMultiplier:1.2,timeMultiplier:1,icon:{glyph:'⚡',color:'#ffe066'},
      eligible:()=>true,condition:c=>c.stunts>=3}),
    LONG_DISTANCE:def({id:'LONG_DISTANCE',label:'長途',description:'路程 900 m 以上：時限 +10%',rewardMultiplier:1.35,timeMultiplier:1.1,icon:{glyph:'➜',color:'#c3f584'},
      eligible:c=>(c.routeMeters||0)>=900,condition:()=>true}),
  });
  const IDS=Object.freeze(Object.keys(MODIFIERS));
  // 互斥：同一張單不會同時帶這些組合（時限 / 損耗規則會互相抵消，玩家也讀不懂）。
  const EXCLUSIVE=Object.freeze([['FRAGILE','VIP'],['HOT_FOOD','ICE_CREAM'],['NIGHT_ONLY','RAIN_BONUS']]);
  const hash=n=>{let h=(Math.imul((n>>>0)+1,2654435761)>>>0);h^=h>>>15;h=Math.imul(h,2246822519)>>>0;h^=h>>>13;return (Math.imul(h,3266489917)>>>0)/4294967296;};
  const rngFrom=seed=>{let n=0;return()=>hash((seed|0)*7919+(n++));};

  // 純函式：seed + context → 決定性的 modifier id 清單（最多 count 個，遵守互斥）。
  function pick(seed,ctx,count=1){
    const pool=IDS.filter(id=>MODIFIERS[id].eligible(ctx)),rand=rngFrom(seed),out=[];
    while(out.length<count&&pool.length){
      const i=Math.floor(rand()*pool.length),id=pool.splice(i,1)[0];
      if(out.some(o=>EXCLUSIVE.some(([a,b])=>(a===o&&b===id)||(b===o&&a===id))))continue;
      out.push(id);
    }
    return out;
  }
  const clean=ids=>{const out=[];for(const id of ids||[])if(MODIFIERS[id]&&!out.includes(id)&&!out.some(o=>EXCLUSIVE.some(([a,b])=>(a===o&&b===id)||(b===o&&a===id))))out.push(id);return out;};
  // 純函式：套用到時限 / 運費 / 損耗。
  const timeMultiplier=ids=>Math.max(MIN_TIME,ids.reduce((m,id)=>m*MODIFIERS[id].timeMultiplier,1));
  const damageMultiplier=ids=>ids.reduce((m,id)=>m*MODIFIERS[id].integrityRule.damageMultiplier,1);
  const decayPerSecond=ids=>ids.reduce((s,id)=>s+MODIFIERS[id].integrityRule.decayPerSecond,0);
  function evaluate(ids,ctx){
    const active=[],voided=[];let mult=1;
    for(const id of ids){if(MODIFIERS[id].condition(ctx)){active.push(id);mult*=MODIFIERS[id].rewardMultiplier;}else voided.push(id);}
    return{active,voided,multiplier:Math.min(MAX_REWARD,mult)};
  }

  class DeliveryModifiers{
    constructor(game){this.game=game;this.enabled=true;this.chance=0;this.maxPerOrder=2;this.lastError=null;this.stats={assigned:0,rewarded:0,voided:0,bonus:0};}
    static get MODIFIERS(){return MODIFIERS;}static get IDS(){return IDS;}
    static pick(seed,ctx,count){return pick(seed,ctx,count);}static evaluate(ids,ctx){return evaluate(ids,ctx);}
    static timeMultiplier(ids){return timeMultiplier(ids);}static damageMultiplier(ids){return damageMultiplier(ids);}static decayPerSecond(ids){return decayPerSecond(ids);}
    context(c){
      const g=this.game,ratio=g.activeCustomerInitialTime>0?Math.max(0,g.activeCustomerTimer)/g.activeCustomerInitialTime:1;
      return{night:!!g.isNight,rain:!!g.isRaining,routeMeters:c&&c.routeMeters||0,undergroundDestination:!!(c&&c.destination&&c.destination.layer==='B1'),
        integrity:g.integrity,remainingRatio:ratio,stunts:c&&c.modStunts||0};
    }
    // 指派（可手動指定 ids，或以 seed 決定性挑選）；一張單只指派一次。
    assign(c,ids,seed){
      if(!c||c.modifiersAssigned)return c&&c.modifiers||[];
      let list;
      if(Array.isArray(ids))list=clean(ids).slice(0,this.maxPerOrder);
      else if(this.chance>0&&hash((seed|0)+991)<this.chance){const n=hash((seed|0)+4421)<.15?2:1;list=pick(seed,this.context(c),Math.min(n,this.maxPerOrder));}
      else list=[];
      c.modifiers=list;c.modifiersAssigned=true;if(list.length)this.stats.assigned++;return list;
    }
    // 接單時：一次性套用時限倍率。
    applyAtBoard(c){
      if(!c||c.modifiersApplied||!c.modifiers||!c.modifiers.length)return;
      const g=this.game,m=timeMultiplier(c.modifiers);c.modifiersApplied=true;c.modStunts=0;
      g.activeCustomerTimer*=m;g.activeCustomerInitialTime=Math.max(g.activeCustomerInitialTime*m,g.activeCustomerTimer);
    }
    // 交付時：回傳加成倍率（不修改運費；由 deliver hook 套用）。
    settle(c){const ids=c&&c.modifiers||[];if(!ids.length)return{active:[],voided:[],multiplier:1};return evaluate(ids,this.context(c));}
    // UI：訂單卡內的一列小標籤；沒有 modifiers 時完全隱藏（不佔版面）。
    ui(c){
      if(typeof document==='undefined')return;
      try{
        let el=document.getElementById('modifier-chips');
        if(!el){
          // 放在訂單卡的標題列（狀態與模式徽章之間的空位），不增加訂單卡高度，也不會蓋到其他 HUD。
          const header=document.querySelector('#hud-customer-box .order-header');if(!header)return;
          el=document.createElement('div');el.id='modifier-chips';el.setAttribute('aria-label','訂單加成');
          const badge=document.getElementById('hud-mode-badge');badge&&badge.parentNode===header?header.insertBefore(el,badge):header.appendChild(el);
          if(!document.getElementById('modifier-chips-style')){const st=document.createElement('style');st.id='modifier-chips-style';
            st.textContent='#modifier-chips{display:none;flex:1 1 0;min-width:0;gap:4px;justify-content:center;flex-wrap:nowrap;overflow:hidden;pointer-events:none}#modifier-chips.show{display:flex}'+
            '.dm-chip{display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:999px;border:1px solid currentColor;background:#081b25b8;font-size:10px;line-height:1.3;white-space:nowrap;font-weight:700;flex:0 0 auto}'+
            '.dm-chip b{font-size:11px}@media(max-width:760px){.dm-chip{font-size:9px;padding:0 3px}}';document.head.appendChild(st);}}
        const ids=c&&c.modifiers||[];el.textContent='';
        for(const id of ids){const m=MODIFIERS[id],chip=document.createElement('span');chip.className='dm-chip';chip.dataset.id=id;chip.style.color=m.icon.color;chip.title=m.label+'：'+m.description;chip.setAttribute('aria-label',m.label+' ×'+m.rewardMultiplier);
          const b=document.createElement('b');b.textContent=m.icon.glyph;chip.appendChild(b);chip.appendChild(document.createTextNode('×'+m.rewardMultiplier));el.appendChild(chip);}
        el.classList.toggle('show',ids.length>0);
      }catch(e){this.lastError=String(e&&e.message||e);}
    }
    describe(){return{enabled:this.enabled,chance:this.chance,lastError:this.lastError,...this.stats};}
  }
  globalThis.TaipeiDeliveryModifiers=DeliveryModifiers;globalThis.DELIVERY_MODIFIERS=MODIFIERS;

  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype,baseInit=P.init,baseBoard=P.boardCustomer,baseHit=P.hit,baseTip=P.addTip,baseUpdate=P.updateCustomers,baseDeliver=P.deliverCustomer,baseFinish=P.finishOrder;
  const safe=(dm,fn)=>{if(!dm||!dm.enabled)return;try{fn();}catch(e){dm.enabled=false;dm.lastError=String(e&&e.message||e);}};
  P.init=async function(...a){const out=await baseInit.apply(this,a);
    this.deliveryModifiers=new DeliveryModifiers(this);
    if(typeof location!=='undefined'&&/(?:^|[?&])modifiers=on(?:&|$)/.test(location.search||''))this.deliveryModifiers.chance=.35;
    return out;};
  P.boardCustomer=function(c){
    const before=this.activeCustomer;baseBoard.apply(this,arguments);
    if(!before&&this.activeCustomer&&this.activeCustomer===c){const dm=this.deliveryModifiers;safe(dm,()=>{dm.assign(c,undefined,(this.orderSerial|0)*131+(this.customers?this.customers.indexOf(c):0));dm.applyAtBoard(c);dm.ui(c);});}
  };
  P.hit=function(label){
    const dm=this.deliveryModifiers,c=this.activeCustomer,before=this.integrity;baseHit.apply(this,arguments);
    if(c&&c.modifiers&&c.modifiers.length)safe(dm,()=>{const m=damageMultiplier(c.modifiers),lost=before-this.integrity;if(m>1&&lost>0)this.integrity=Math.max(0,this.integrity-lost*(m-1));});
  };
  P.addTip=function(amount){const c=this.activeCustomer;if(c&&c.modifiers&&c.modifiers.length)c.modStunts=(c.modStunts||0)+1;return baseTip.apply(this,arguments);};
  P.updateCustomers=function(dt){
    baseUpdate.apply(this,arguments);
    const c=this.activeCustomer,dm=this.deliveryModifiers;
    if(c&&c.modifiers&&c.modifiers.length&&this.gameState==='PLAYING'&&dt>0)safe(dm,()=>{const d=decayPerSecond(c.modifiers);if(d>0)this.integrity=Math.max(0,this.integrity-d*dt);});
  };
  P.deliverCustomer=function(){
    const c=this.activeCustomer,dm=this.deliveryModifiers;
    if(!c||!c.modifiers||!c.modifiers.length||!dm||!dm.enabled)return baseDeliver.apply(this,arguments);
    const beforeFare=this.totalFare,beforeCount=this.deliveredCount,settle=dm.settle(c),ids=c.modifiers.slice();
    baseDeliver.apply(this,arguments);
    if(this.deliveredCount===beforeCount+1){   // 只有成功交付才加成（逾時 / 失敗照原版 0 元）
      safe(dm,()=>{
        const base=this.totalFare-beforeFare,bonus=Math.round(base*(settle.multiplier-1));
        const rec=this.deliveryHistory&&this.deliveryHistory[this.deliveryHistory.length-1];
        if(bonus>0){this.totalFare+=bonus;if(rec){rec.fare+=bonus;}dm.stats.bonus+=bonus;dm.stats.rewarded++;}
        if(settle.voided.length)dm.stats.voided+=settle.voided.length;
        if(rec){rec.modifiers=ids;rec.modifierBonus=bonus>0?bonus:0;rec.modifiersActive=settle.active;rec.modifiersVoided=settle.voided;}
        const names=settle.active.map(id=>MODIFIERS[id].label+' ×'+MODIFIERS[id].rewardMultiplier).join(' · ');
        if(this.showStatusToast)this.showStatusToast(bonus>0?'合約加成 '+names+' · +NT$ '+bonus:'合約條件未達成 · 無加成');
      });
    }
  };
  const reset=c=>{if(c){c.modifiers=undefined;c.modifiersAssigned=false;c.modifiersApplied=false;c.modStunts=0;}};   // 每張單各自指派：商家的 customer 物件會被重複使用
  P.finishOrder=function(success){const c=this.activeCustomer;baseFinish.apply(this,arguments);if(c){reset(c);safe(this.deliveryModifiers,()=>this.deliveryModifiers.ui(null));}};
  for(const name of ['startGame','endGame']){const base=P[name];P[name]=function(){const out=base.apply(this,arguments);try{(this.customers||[]).forEach(reset);this.deliveryModifiers&&this.deliveryModifiers.ui(null);}catch(e){}return out;};}
})();


/* Preview module: audio-bank.js */
/* CC0 取樣銀行：build 時由 scripts/audio_bank.py 依 assets/audio/source-manifest.json 驗證並嵌入（role → data URI）。
 * gameplay 程式只使用 role 名稱，從不直接引用檔名。 */
const TAIPEI_AUDIO_BANK={"schema":1,"roles":{}};


/* Preview module: audio-manager.js */
/* AudioManager（P3-01）：以 Howler.js 管理取樣音效 / 音樂 / 環境音 / UI / 語音，與既有的 procedural WebAudio
 * （引擎振盪器、打滑雜訊、電台節拍、舊有提示音）並存，不移除任何 procedural 聲音。
 *
 * Buses：master / engine / sfx / music / ambience / voice（UI 取樣走 sfx）。
 * - Howler 取樣的音量 = master × bus × 個別音量。
 * - procedural 聲音經由「每個 bus 一個 GainNode」接到 CourierAudio 的 AudioContext：engine/skid → engine；
 *   提示音 → sfx；電台 → music。因此 bus 音量對兩種聲音來源都有效。
 * - mute 相容舊存檔：沿用 save 的 muted 布林（master 靜音）；新增的 bus 音量存在 save.audio（舊存檔缺欄位則用預設）。
 * - 瀏覽器 autoplay policy：Howler 與 CourierAudio 的 AudioContext 都只在使用者手勢內 resume；
 *   `manager.state` 為 'locked' | 'running' | 'unsupported'，鎖定時 play() 會排隊，解鎖後才播放，不丟錯。 */
(function(){
  if(typeof CourierAudio==='undefined')return;
  const BUSES=['master','engine','sfx','music','ambience','voice'];
  const DEFAULT_VOLUMES=Object.freeze({master:1,engine:1,sfx:1,music:1,ambience:1,voice:1});
  const lib=typeof HowlerLib!=='undefined'?HowlerLib:null;
  const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):1));

  // 事件 role 的預設 bus / 音量。檔案由 build 時的 CC0 銀行（TAIPEI_AUDIO_BANK，來源記錄於 assets/audio/source-manifest.json）
  // 以 role 名稱提供；gameplay 程式只使用這些 role，不引用任何檔名。要換音效 = 換 manifest 內該 role 的檔案與 provenance。
  const ROLES=Object.freeze({
    'menu-click':{bus:'sfx',volume:.55,minGap:.04},
    'order-accepted':{bus:'sfx',volume:.8,minGap:.2},
    'delivery-success':{bus:'sfx',volume:.85,minGap:.3},
    'perfect-delivery':{bus:'sfx',volume:.9,minGap:.3},
    'combo-milestone':{bus:'sfx',volume:.75,minGap:.25},
    'jump':{bus:'sfx',volume:.6,minGap:.15},
    'landing':{bus:'sfx',volume:.7,minGap:.15},
    'cone-hit':{bus:'sfx',volume:.7,minGap:.1},
    'collision':{bus:'sfx',volume:.85,minGap:.2},
    'money':{bus:'sfx',volume:.7,minGap:.1},
    'unlock':{bus:'sfx',volume:.8,minGap:.3},
  });
  const EXT={'audio/wav':'wav','audio/ogg':'ogg','audio/mpeg':'mp3'};

  class AudioManager{
    constructor(game){
      this.game=game;this.volumes={...DEFAULT_VOLUMES};this.muted=false;this.sounds=new Map();this.queue=[];this.unavailable=new Map();this.lastPlay=new Map();this.stats={played:0};
      // 沒有 AudioContext 或沒有 navigator.userAgent（Node 測試 harness / 極舊瀏覽器）時視為 unsupported，維持純 procedural。
      const hasWebAudio=typeof window!=='undefined'&&!!(window.AudioContext||window.webkitAudioContext)&&typeof navigator!=='undefined'&&typeof navigator.userAgent==='string';
      this.available=!!(lib&&lib.Howl&&hasWebAudio);this.unlockedFlag=false;
    }
    get state(){
      if(!this.available)return 'unsupported';
      const ctx=lib.Howler.ctx;
      return(this.unlockedFlag||(ctx&&ctx.state==='running'))?'running':'locked';
    }
    busVolume(bus){return this.muted?0:clamp01(this.volumes.master)*(bus==='master'?1:clamp01(this.volumes[bus]));}
    setBusVolume(bus,v){
      if(!BUSES.includes(bus))return false;
      this.volumes[bus]=clamp01(v);this.applyVolumes();return true;
    }
    setMuted(m){this.muted=!!m;this.applyVolumes();}
    applyVolumes(){
      if(this.available){try{lib.Howler.volume(this.muted?0:clamp01(this.volumes.master));}catch(e){/* Howler 不可用時不影響 procedural 音訊 */}}
      for(const s of this.sounds.values())s.howl.volume(clamp01(s.volume)*(s.bus==='master'?1:clamp01(this.volumes[s.bus])));
      this.game?.audio?.applyBusGains?.();
    }
    // 註冊一個取樣：{src:[url...]}。bus 預設 sfx。載入失敗（解碼 / 編碼不支援）時移除並記錄，呼叫端自動 fallback procedural。
    register(id,{src,bus='sfx',volume=1,loop=false,format}={}){
      if(!this.available||this.sounds.has(id)||!src)return false;
      try{
        const howl=new lib.Howl({src:Array.isArray(src)?src:[src],...(format?{format:Array.isArray(format)?format:[format]}:{}),loop,volume:clamp01(volume)*clamp01(this.volumes[bus]),html5:false,preload:true,
          onloaderror:(_i,err)=>{this.sounds.delete(id);this.unavailable.set(id,'loaderror:'+String(err));},
          onplayerror:(_i,err)=>{this.unavailable.set(id,'playerror:'+String(err));}});
        this.sounds.set(id,{howl,bus,volume});return true;
      }catch(e){this.unavailable.set(id,'exception');return false;}
    }
    // 載入 build 嵌入的 CC0 銀行：每個 role 一個 Howl；瀏覽器不支援該編碼（例如舊 Safari 的 OGG）時略過 → procedural fallback。
    loadBank(bank){
      const roles=bank&&bank.roles;if(!roles||!this.available)return 0;let n=0;
      for(const [role,entry] of Object.entries(roles)){
        const def=ROLES[role];if(!def){this.unavailable.set(role,'unknown-role');continue;}
        const ext=EXT[entry.mime];
        if(!ext||(typeof lib.Howler.codecs==='function'&&!lib.Howler.codecs(ext))){this.unavailable.set(role,'codec:'+ext);continue;}
        if(this.register(role,{src:entry.src,format:ext,bus:def.bus,volume:def.volume}))n++;
      }
      return n;
    }
    hasRole(role){return this.sounds.has(role);}
    // 依 role 播放（含最小間隔限流）。回傳 true 表示已交給 Howler（或已排隊等待解鎖）；false → 呼叫端使用 procedural fallback。
    playRole(role,opts={}){
      const s=this.sounds.get(role);if(!s||this.muted)return false;
      const now=(typeof performance!=='undefined'?performance.now():Date.now())/1000,gap=ROLES[role]?.minGap||0;
      if(now-(this.lastPlay.get(role)||-1e9)<gap)return true;     // 太密集：視為已處理，不重複播放也不退回 procedural
      this.lastPlay.set(role,now);
      const handled=this.state==='running';
      this.play(role,opts);
      if(handled)this.stats.played++;
      return true;
    }
    // 播放；autoplay 鎖定時排隊（最多 8 筆），解鎖後依序播放。回傳是否已實際交給 Howler。
    play(id,opts={}){
      const s=this.sounds.get(id);if(!s)return false;
      if(this.muted)return false;
      if(this.state!=='running'){if(this.queue.length<8)this.queue.push([id,opts]);return false;}
      const sid=s.howl.play();if(opts.rate)s.howl.rate(opts.rate,sid);if(opts.volume!==undefined)s.howl.volume(clamp01(s.volume)*clamp01(this.volumes[s.bus])*clamp01(opts.volume),sid);return true;
    }
    // 必須在使用者手勢內呼叫（CourierAudio.init 的包裝會呼叫）。
    unlock(){
      if(!this.available)return 'unsupported';
      try{const ctx=lib.Howler.ctx;if(ctx&&ctx.state==='suspended')ctx.resume().then(()=>this.afterUnlock()).catch(()=>{});else if(ctx)this.afterUnlock();}catch(e){/* 保持 locked */}
      return this.state;
    }
    afterUnlock(){this.unlockedFlag=true;const q=this.queue.splice(0);for(const [id,o] of q)this.play(id,o);}
    // save 序列化 / 還原（舊存檔沒有 audio 欄位 → 預設值；muted 沿用舊布林）。
    toSave(){return{version:1,volumes:{...this.volumes}};}
    fromSave(a){
      if(a&&a.version===1&&a.volumes)for(const b of BUSES)if(b in a.volumes)this.volumes[b]=clamp01(a.volumes[b]);
    }
  }
  globalThis.TaipeiAudioManager=AudioManager;
  globalThis.TAIPEI_AUDIO_BUSES=BUSES;

  // ── CourierAudio（procedural）接上 bus：不修改原類別，改以包裝方式把 destination 換成對應 bus 節點。 ──
  const CA=CourierAudio.prototype;
  const ROUTE={setupEngine:'engine',setupSkid:'engine',updateEngine:'engine',setSkidVolume:'engine',
    playBoost:'sfx',playHop:'sfx',playHorn:'sfx',playCrash:'sfx',playCash:'sfx',playTunerStatic:'sfx',playRadioBeat:'music'};
  const withBus=(audio,bus,fn)=>{
    const ctx=audio.ctx,node=audio.busNodes?.[bus];
    if(!ctx||!node)return fn();
    // 方法內使用 this.ctx.destination：暫時換成帶有 bus destination 的 ctx proxy；其他成員一律轉給真正的 ctx。
    const proxy=new Proxy(ctx,{get(t,k){if(k==='destination')return node;const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}});
    audio.ctx=proxy;
    try{return fn();}finally{audio.ctx=ctx;}
  };
  CA.routeTo=function(bus,fn){return withBus(this,bus,fn);};   // 讓其他模組（Radio Director）把自己的聲音接到指定 bus
  const baseInit=CA.init;
  CA.init=function(){
    const had=!!this.ctx;
    // 先建立 context 與 bus 節點，再讓原本的 init 建引擎 / 打滑（它們會經由包裝接到 engine bus）。
    if(!this.ctx){const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(AC){try{this.ctx=new AC();}catch(e){/* 交給原 init 處理 */}}}
    if(this.ctx&&!this.busNodes)this.buildBusNodes();
    const out=baseInit.apply(this,arguments);
    this.manager?.unlock();
    return out;
  };
  CA.buildBusNodes=function(){
    const ctx=this.ctx;if(!ctx||typeof ctx.createGain!=='function')return;
    const master=ctx.createGain();master.connect(ctx.destination);
    this.busNodes={master};
    for(const b of ['engine','sfx','music','ambience','voice']){const g=ctx.createGain();g.connect(master);this.busNodes[b]=g;}
    this.applyBusGains();
  };
  CA.applyBusGains=function(){
    const m=this.manager;if(!this.busNodes||!m)return;
    this.busNodes.master.gain.value=m.muted?0:clamp01(m.volumes.master);
    for(const b of ['engine','sfx','music','ambience','voice'])this.busNodes[b].gain.value=clamp01(m.volumes[b]);
  };
  for(const [name,bus] of Object.entries(ROUTE)){
    const orig=CA[name];if(typeof orig!=='function')continue;
    CA[name]=function(...a){return withBus(this,bus,()=>orig.apply(this,a));};
  }
  // 逐步 delegate：有對應 CC0 取樣且已解鎖、未靜音時走 Howler；否則維持 procedural 原行為（fallback）。
  const delegate=(name,pick)=>{
    const proc=CA[name];
    CA[name]=function(...a){
      const m=this.manager,role=m&&pick.call(this,...a);
      if(role&&m.hasRole(role)&&m.state==='running'&&!m.muted&&m.playRole(role))return;
      return proc.apply(this,a);
    };
  };
  delegate('playCash',()=>'money');
  delegate('playCrash',()=>'collision');
  delegate('playHorn',f=>f===650?'cone-hit':null);                         // 650Hz 是撞倒路錐 / 停車機車時的喇叭
  delegate('playBoost',function(){return this.roleHint==='jump'?'jump':null;});   // 跳躍沿用 playBoost；Nitro 仍為 procedural

  // ── 遊戲整合 ──
  const P=TaipeiStreetCourier.prototype;
  const SAVE_KEY='supercourier.save.v1';
  const baseInitGame=P.init;
  P.init=async function(...a){
    const out=await baseInitGame.apply(this,a);
    const m=this.audioManager=new AudioManager(this);
    this.audio.manager=m;
    try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');m.fromSave(s&&s.audio);}catch(e){/* 壞存檔使用預設 */}
    m.setMuted(!!this.muted);                      // 舊存檔的 muted 布林 → master 靜音
    m.loadBank(typeof TAIPEI_AUDIO_BANK!=='undefined'?TAIPEI_AUDIO_BANK:null);
    this.audio.applyBusGains?.();
    return out;
  };
  const baseToggleMute=P.toggleMute;
  P.toggleMute=function(...a){const out=baseToggleMute.apply(this,a);this.audioManager?.setMuted(!!this.muted);return out;};
  const baseSave=P.save;
  P.save=function(...a){
    const out=baseSave.apply(this,a);
    try{if(this.audioManager){const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};s.version=1;s.audio=this.audioManager.toSave();localStorage.setItem(SAVE_KEY,JSON.stringify(s));}}catch(e){/* 沿用原 save() 的提示 */}
    return out;
  };
  P.setAudioBusVolume=function(bus,v){const ok=this.audioManager?.setBusVolume(bus,v);if(ok)this.save();return ok;};

  // 遊戲事件 → role。集中在此；其他程式只呼叫 game.gameFxEvent('<role>')。
  P.gameFxEvent=function(role,opts){const m=this.audioManager;if(m&&ROLES[role])m.playRole(role,opts);};
  const wrap=(name,before,after)=>{
    const orig=P[name];if(typeof orig!=='function')return;
    P[name]=function(...a){const ctx=before?before.call(this,...a):undefined;const out=orig.apply(this,a);if(after)after.call(this,out,ctx,...a);return out;};
  };
  // 跳躍：playBoost 在 tryJump 內被呼叫；用 hint 讓它選用 jump 取樣（Nitro 的 playBoost 不受影響）。
  const baseJump=P.tryJump;
  if(typeof baseJump==='function')P.tryJump=function(...a){this.audio.roleHint='jump';try{return baseJump.apply(this,a);}finally{this.audio.roleHint=null;}};
  wrap('landJump',function(){return this.carVy;},function(_o,vy){if(vy<-2)this.gameFxEvent('landing',{volume:Math.min(1,Math.abs(vy)/16)});});
  wrap('boardCustomer',function(){return !this.activeCustomer;},function(_o,wasFree){if(wasFree&&this.activeCustomer)this.gameFxEvent('order-accepted');});
  wrap('finishCourierDrill',function(){return this.courierDrill?.status;},function(_o,was,success){if(was==='running'&&success)this.gameFxEvent('unlock');});
  // 選單 / HUD 按鈕點擊音（同時是 autoplay 的使用者手勢）。
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('click',e=>{
      const t=e.target&&e.target.closest?e.target.closest('button,.mode-card,.driver-card,[role="button"]'):null;
      if(t&&!t.disabled&&window.__game)window.__game.gameFxEvent('menu-click');
    },true);
  }
})();


/* Preview module: radio-director.js */
/* Radio Director（P3-03）：把 procedural 電台升級為依情境切換 layer / intensity 的導播系統。
 *
 * - RadioStation 資料：id / name / BPM / 區域 tag / 天氣 tag / track metadata（目前皆為原創 procedural pattern，
 *   無任何授權音樂；日後 CC0 / 授權曲目以同一份 metadata 結構加入，kind 改為 'sample'）。
 * - 情境：正常巡航 / 高 combo / 最後 20 秒（三個 intensity tier）+ 地下街 / 雨天（修飾：濾波與層次調整）。
 * - 第一版 layer：kick、snare、hat、bass(原本的吉他線)、lead、pad。cruise 的 layer 組合與原本 oscillator beat 相同。
 * - fallback：director 可關閉（enabled=false），或任何錯誤都會自動關閉並回到原本的 oscillator beat（CourierAudio.playRadioBeat 原版）。
 * - 自動選台依區域 / 天氣 tag；玩家手動換台後（toggleRadio）以手動為準。 */
(function(){
  if(typeof CourierAudio==='undefined'||typeof TaipeiStreetCourier==='undefined')return;
  const CA=CourierAudio.prototype;

  const STATIONS=Object.freeze([
    Object.freeze({id:'rock101',name:'電台 1：搖滾台北 101',bpm:205,regionTags:Object.freeze(['101','松山','內湖','大直']),weatherTags:Object.freeze(['clear','night']),
      tracks:Object.freeze([Object.freeze({id:'rock101-neon',title:'Neon Run 101',kind:'procedural',license:'original-procedural',key:'D',intensityRange:[1,3],chords:[[146.83,146.83,220,196]]})])}),
    Object.freeze({id:'westcore',name:'電台 2：西岸硬核',bpm:195,regionTags:Object.freeze(['西門町','台北車站','中山','雙連']),weatherTags:Object.freeze(['clear']),
      tracks:Object.freeze([Object.freeze({id:'westcore-alley',title:'Alley Rush',kind:'procedural',license:'original-procedural',key:'E',intensityRange:[1,3],chords:[[164.81,130.81,196,146.83]]})])}),
    Object.freeze({id:'retrosurf',name:'電台 3：復古衝浪',bpm:165,regionTags:Object.freeze(['圓山','士林','陽明山','文山']),weatherTags:Object.freeze(['rain','night']),
      tracks:Object.freeze([Object.freeze({id:'retrosurf-drizzle',title:'Drizzle Surf',kind:'procedural',license:'original-procedural',key:'A',intensityRange:[1,3],chords:[[110,110,146.83,146.83]]})])}),
  ]);
  const TIERS=Object.freeze({cruise:1,combo:2,final:3});
  const LAYERS=Object.freeze({
    cruise:Object.freeze(['kick','snare','bass']),
    combo:Object.freeze(['kick','snare','bass','hat','lead']),
    final:Object.freeze(['kick','snare','bass','hat','lead','pad']),
  });
  const THRESH=Object.freeze({comboEnter:5,comboExit:3,finalSeconds:20,stationHoldBars:16});

  // 純函式：給定情境與前一個 tier，決定 tier（combo 有遲滯，避免 combo 在邊界抖動）。
  function decideTier(ctx,prevTier){
    if(ctx.finalCountdown)return 'final';
    if(ctx.combo>=THRESH.comboEnter)return 'combo';
    if(prevTier==='combo'&&ctx.combo>=THRESH.comboExit)return 'combo';
    return 'cruise';
  }
  function decide(ctx,prev={}){
    const tier=decideTier(ctx,prev.tier);
    return{tier,intensity:TIERS[tier],underground:!!ctx.underground,rain:!!ctx.rain,layers:[...LAYERS[tier],...(ctx.underground&&!LAYERS[tier].includes('pad')?['pad']:[])]};
  }
  // 純函式：區域 tag 符合 +2、天氣 tag 符合 +1；平手保持目前電台。
  function pickStation(ctx,current=0){
    const weather=ctx.rain?'rain':ctx.night?'night':'clear';
    let best=current,bestScore=-1;
    STATIONS.forEach((s,i)=>{const sc=(s.regionTags.includes(ctx.region)?2:0)+(s.weatherTags.includes(weather)?1:0);if(sc>bestScore||(sc===bestScore&&i===current)){best=i;bestScore=sc;}});
    return best;
  }

  class RadioDirector{
    constructor(game){this.game=game;this.enabled=true;this.auto=true;this.lastError=null;this.state={tier:'cruise',underground:false,rain:false,layers:[...LAYERS.cruise],station:0,bar:0,lastStationBar:-1e9};this.zoneCache=null;}
    static get STATIONS(){return STATIONS;}
    static decide(ctx,prev){return decide(ctx,prev);}
    static pickStation(ctx,current){return pickStation(ctx,current);}
    nearestRegion(){
      const g=this.game;if(!g||!g.carPos||typeof g.latLngToWorld!=='function'||typeof COURIER_ZONES==='undefined')return null;
      if(!this.zoneCache)this.zoneCache=COURIER_ZONES.map(z=>({name:z.name,p:g.latLngToWorld(z.lat,z.lng)}));
      let best=null,bd=Infinity;for(const z of this.zoneCache){const d=Math.hypot(z.p.x-g.carPos.x,z.p.z-g.carPos.z);if(d<bd){bd=d;best=z.name;}}
      return best;
    }
    readContext(){
      const g=this.game;
      return{combo:g.comboCount||0,finalCountdown:g.gameState==='PLAYING'&&Number.isFinite(g.gameTime)&&g.gameTime>0&&g.gameTime<=THRESH.finalSeconds,
        underground:!!(g.carPos&&typeof g.isBelowGround==='function'&&g.isBelowGround(g.carPos)),rain:!!g.isRaining,night:!!g.isNight,region:this.nearestRegion()};
    }
    // 每個 bar 的第一拍呼叫：更新 tier / 修飾 / 自動選台。
    updateBar(audio){
      const ctx=this.readContext(),plan=decide(ctx,this.state);
      this.state={...this.state,...plan,bar:this.state.bar+1};
      if(this.auto&&this.state.bar-this.state.lastStationBar>=THRESH.stationHoldBars){
        const next=pickStation(ctx,audio.currentStation);
        if(next!==audio.currentStation){audio.currentStation=next;this.state.lastStationBar=this.state.bar;}
      }
      this.state.station=audio.currentStation;return this.state;
    }
    describe(audio){const st=STATIONS[audio?.currentStation??this.state.station];return{...this.state,enabled:this.enabled,auto:this.auto,station:{id:st.id,name:st.name,bpm:st.bpm,regionTags:[...st.regionTags],weatherTags:[...st.weatherTags]},track:st.tracks[0].id};}

    // 播放一拍（16 分音符）。voices 全部走 audio.ctx.destination（已被 audio-manager 轉到 music bus）。
    playStep(audio){
      const ctx=audio.ctx,step=audio.runRadioStep%16;
      if(step===0)this.updateBar(audio);
      const s=this.state,station=STATIONS[audio.currentStation%STATIONS.length],track=station.tracks[0];
      const tempoScale=s.tier==='final'?1.06:s.rain?.95:1,st=60/(station.bpm*tempoScale)/4,n=ctx.currentTime;
      // 修飾：地下街 = 悶（低通 + 少量 pad）；雨天 = 柔和（較低的低通、hat 改為輕刷）。每拍一個濾波節點，最後接到 destination。
      const out=ctx.createGain();out.gain.value=s.underground?.8:1;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=s.underground?1300:s.rain?3200:20000;
      out.connect(lp);lp.connect(ctx.destination);
      const has=l=>s.layers.includes(l);
      const voice=(type,f,gain,dur,sweepTo)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,n);if(sweepTo)o.frequency.exponentialRampToValueAtTime(sweepTo,n+dur*.9);g.gain.setValueAtTime(gain,n);g.gain.exponentialRampToValueAtTime(.01,n+dur);o.connect(g);g.connect(out);o.start(n);o.stop(n+dur+.01);};
      const kickSteps=s.tier==='final'?[0,4,6,8,12,14]:[0,6,8,14];
      if(has('kick')&&kickSteps.includes(step))voice('sine',140,.3,.09,35);
      if(has('snare')&&(step===4||step===12))voice('triangle',220,.2,.1);
      if(has('hat')){const every=s.tier==='final'?1:2;if(step%every===(every===1?0:1))voice(s.rain?'triangle':'square',s.rain?3200:6200,s.rain?.025:.045,.03);}
      if(has('bass')&&step%2===0){const ch=track.chords[0],rf=ch[Math.floor(audio.runRadioStep/8)%ch.length];voice('sawtooth',rf*(step%4===0?1:1.5),.12,st*1.5);}
      if(has('lead')&&step%2===1){const ch=track.chords[0],rf=ch[Math.floor(audio.runRadioStep/8)%ch.length];voice('triangle',rf*(s.tier==='final'?4:2)*(step%4===1?1:1.25),.07,st*1.2);}
      if(has('pad')&&step===0){const ch=track.chords[0],rf=ch[Math.floor(audio.runRadioStep/8)%ch.length];voice('sine',rf*2,.06,st*16);voice('sine',rf*3,.04,st*16);}
      audio.runRadioStep++;audio.radioTimer=setTimeout(()=>audio.playRadioBeat(),st*1000);
    }
  }
  globalThis.TaipeiRadioDirector=RadioDirector;
  globalThis.TAIPEI_RADIO_STATIONS=STATIONS;

  // ── 接到 CourierAudio：保留原版 oscillator beat 作為 fallback ──
  const legacyBeat=CA.playRadioBeat;
  CA.playRadioBeat=function(){
    const d=this.director;
    if(!d||!d.enabled||!this.ctx||!this.radioPlaying)return legacyBeat.apply(this,arguments);
    if(this.ctx.state!=='running'){this.radioTimer=setTimeout(()=>this.playRadioBeat(),250);return;}
    try{
      const run=()=>d.playStep(this);
      return typeof this.routeTo==='function'?this.routeTo('music',run):run();
    }catch(err){
      // 任何導播錯誤：關閉 director，回到原本的 oscillator beat（不中斷音樂）。
      d.enabled=false;d.lastError=String(err&&err.message||err);
      return legacyBeat.apply(this,arguments);
    }
  };
  const legacyToggle=CA.toggleRadio;
  CA.toggleRadio=function(){if(this.director)this.director.auto=false;return legacyToggle.apply(this,arguments);};   // 玩家手動換台 → 手動優先
  CA.getStationName=function(){return STATIONS[this.currentStation%STATIONS.length].name;};

  const P=TaipeiStreetCourier.prototype,baseInit=P.init;
  P.init=async function(...a){const out=await baseInit.apply(this,a);this.audio.director=this.radioDirector=new RadioDirector(this);return out;};
  P.setRadioDirectorEnabled=function(on){if(this.radioDirector){this.radioDirector.enabled=!!on;if(on)this.radioDirector.lastError=null;}};
})();


/* Preview module: ambience.js */
/* 台北城市環境音（P3-04）：依區域組合 traffic / crowd / rain bed 與 MRT、行人過街嗶聲事件；B1 以低通 + 回授延遲做出「地下空間」感。
 * 所有聲音皆為本作 WebAudio 合成（噪音 + 濾波 + 振盪器），不使用任何真實捷運廣播或有版權錄音，也沒有新增素材檔。
 * 走 ambience bus（受 bus 音量與靜音控制）；任何錯誤 → 關閉環境音並記錄 lastError，不影響遊戲或其他音訊。 */
(function(){
  const AMBIENCE=globalThis.AMBIENCE_ZONES=Object.freeze([
    Object.freeze({id:'ximen',name:'西門',lat:25.0421,lng:121.508,traffic:.5,crowd:.9,mrt:true,crossing:true}),
    Object.freeze({id:'station',name:'北車',lat:25.0478,lng:121.517,traffic:.6,crowd:.8,mrt:true,crossing:true}),
    Object.freeze({id:'east',name:'東區',lat:25.0415,lng:121.5515,traffic:.7,crowd:.55,mrt:true,crossing:true}),
    Object.freeze({id:'xinyi',name:'信義',lat:25.033,lng:121.5654,traffic:.6,crowd:.5,mrt:false,crossing:true}),
    Object.freeze({id:'riverside',name:'河岸',lat:25.0838,lng:121.5575,traffic:.22,crowd:.1,mrt:false,crossing:false}),
  ]);
  const ZONE_RADIUS=650,B1_ZONE=Object.freeze({id:'b1',name:'B1',traffic:.08,crowd:.55,mrt:true,crossing:false});
  const CITY_BED=Object.freeze({id:'city',name:'市區',traffic:.3,crowd:.12,mrt:false,crossing:false});

  // 純函式：zone + 天氣 → 各層目標增益與濾波；測試與 runtime 共用。
  function plan(ctx){
    const z=ctx.underground?B1_ZONE:(AMBIENCE.find(a=>a.id===ctx.zone)||CITY_BED);
    const rain=!!ctx.rain&&!ctx.underground;   // 地下聽不到雨（只剩悶悶的環境）
    return{zone:z.id,traffic:z.traffic*(rain?1.1:1),crowd:z.crowd*(rain?.7:1),rain:rain?.55:0,
      lowpass:ctx.underground?900:20000,reverb:ctx.underground?.35:0,mrt:z.mrt,crossing:z.crossing&&!rain};
  }
  const rng=(seed=1)=>()=>(seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296;

  class AmbienceDirector{
    constructor(game){this.game=game;this.enabled=true;this.lastError=null;this.zoneCache=null;this.graph=null;this.rand=rng(20260101);
      this.state={zone:'city',underground:false,rain:false};this.nextMrt=0;this.nextCross=0;this.events={mrt:0,crossing:0};this.timer=null;}
    static plan(c){return plan(c);}
    nearestZone(){
      const g=this.game;if(!g||!g.carPos||typeof g.latLngToWorld!=='function')return null;
      if(!this.zoneCache)this.zoneCache=AMBIENCE.map(z=>({id:z.id,p:g.latLngToWorld(z.lat,z.lng)}));
      let best=null,bd=ZONE_RADIUS;for(const z of this.zoneCache){const d=Math.hypot(z.p.x-g.carPos.x,z.p.z-g.carPos.z);if(d<bd){bd=d;best=z.id;}}
      return best;
    }
    readContext(){const g=this.game;return{zone:this.nearestZone(),underground:!!(g.carPos&&typeof g.isBelowGround==='function'&&g.isBelowGround(g.carPos)),rain:!!g.isRaining};}
    // 懶建立：白噪音 loop → (濾波 → 增益) 三層 + B1 回授延遲，全部接到 ambience bus。
    build(audio){
      const ctx=audio.ctx,bus=audio.busNodes&&audio.busNodes.ambience||ctx.destination;
      const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
      for(let i=0;i<len;i++){const w=this.rand()*2-1;b=(b+.02*w)/1.02;d[i]=(w*.5+b*3.5)*.5;}   // 白噪音 + 一點棕噪音
      const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
      const master=ctx.createGain();master.gain.value=1;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=20000;
      const mk=(type,freq,q)=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=ctx.createGain();g.gain.value=0;f.connect(g);g.connect(master);src.connect(f);return{f,g};};
      const traffic=mk('lowpass',420,.7),crowd=mk('bandpass',900,.8),rain=mk('highpass',3200,.5);
      const lfo=ctx.createOscillator(),lfoG=ctx.createGain();lfo.frequency.value=.17;lfoG.gain.value=260;lfo.connect(lfoG);lfoG.connect(crowd.f.frequency);lfo.start();   // 人聲起伏
      const dry=ctx.createGain(),wet=ctx.createGain(),delay=ctx.createDelay(.5),fb=ctx.createGain();dry.gain.value=1;wet.gain.value=0;delay.delayTime.value=.09;fb.gain.value=.38;
      master.connect(lp);lp.connect(dry);dry.connect(bus);lp.connect(delay);delay.connect(fb);fb.connect(delay);delay.connect(wet);wet.connect(bus);   // reverb-like：回授延遲
      src.start();
      this.graph={ctx,bus,src,traffic,crowd,rain,lp,wet,lfo};
    }
    apply(p){
      const G=this.graph,t=G.ctx.currentTime,s=(param,v)=>param.setTargetAtTime(v,t,.6);
      s(G.traffic.g.gain,p.traffic*.42);s(G.crowd.g.gain,p.crowd*.3);s(G.rain.g.gain,p.rain*.22);s(G.lp.frequency,p.lowpass);s(G.wet.gain,p.reverb);
    }
    // MRT：低頻隆隆（鋸齒 + 低通）+ 兩音到站提示（原創音高，不模仿實際廣播）。
    playMrt(){
      const G=this.graph,c=G.ctx,t=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
      o.type='sawtooth';o.frequency.setValueAtTime(48,t);o.frequency.linearRampToValueAtTime(70,t+2.6);f.type='lowpass';f.frequency.value=240;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2,t+1.6);g.gain.linearRampToValueAtTime(0,t+4.2);o.connect(f);f.connect(g);g.connect(G.bus);o.start(t);o.stop(t+4.4);
      [660,523.25].forEach((fr,i)=>{const q=c.createOscillator(),qg=c.createGain(),st=t+4.4+i*.34;q.type='sine';q.frequency.value=fr;qg.gain.setValueAtTime(0,st);qg.gain.linearRampToValueAtTime(.07,st+.02);qg.gain.exponentialRampToValueAtTime(.001,st+.32);q.connect(qg);qg.connect(G.bus);q.start(st);q.stop(st+.34);});
      this.events.mrt++;
    }
    // 行人過街嗶聲：短促方波 1.2 kHz，節奏 4 Hz。
    playCrossing(){
      const G=this.graph,c=G.ctx,t=c.currentTime;
      for(let i=0;i<6;i++){const o=c.createOscillator(),g=c.createGain(),st=t+i*.25;o.type='square';o.frequency.value=1200;g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(.035,st+.01);g.gain.setValueAtTime(.035,st+.11);g.gain.linearRampToValueAtTime(0,st+.13);o.connect(g);g.connect(G.bus);o.start(st);o.stop(st+.14);}
      this.events.crossing++;
    }
    tick(audio){
      if(!this.enabled)return;
      try{
        const ctx=audio.ctx;if(!ctx||ctx.state!=='running'||this.game.gameState!=='PLAYING')return;
        if(!this.graph)this.build(audio);
        const c=this.readContext(),p=plan(c);this.state={zone:p.zone,underground:c.underground,rain:c.rain};this.apply(p);
        const now=ctx.currentTime;
        if(p.mrt&&now>=this.nextMrt){if(this.nextMrt>0)this.playMrt();this.nextMrt=now+22+this.rand()*20;}
        if(p.crossing&&now>=this.nextCross){if(this.nextCross>0)this.playCrossing();this.nextCross=now+9+this.rand()*8;}
      }catch(err){this.enabled=false;this.lastError=String(err&&err.message||err);}
    }
    start(audio){if(this.timer||typeof setInterval!=='function')return;this.timer=setInterval(()=>this.tick(audio),400);if(this.timer&&this.timer.unref)this.timer.unref();}
    describe(){return{enabled:this.enabled,lastError:this.lastError,built:!!this.graph,...this.state,events:{...this.events}};}
  }
  globalThis.TaipeiAmbience=AmbienceDirector;

  const P=TaipeiStreetCourier.prototype,baseInit=P.init;
  P.init=async function(...a){const out=await baseInit.apply(this,a);
    const off=typeof location!=='undefined'&&/(?:^|[?&])ambience=off(?:&|$)/.test(location.search||'');
    this.ambience=this.audio.ambienceDirector=new AmbienceDirector(this);if(off)this.ambience.enabled=false;
    if(typeof window!=='undefined'&&window.AudioContext)this.ambience.start(this.audio);return out;};
})();


/* Preview module: debug-diagnostics.js */
/* Renderer capability diagnostics（P1-05）。
 * - 資料 API：game.rendererDiagnostics()（無 UI 副作用，供 QA / 除錯主控台使用）。
 * - 畫面疊層只在 debug mode 才建立：網址帶 ?debug=1。一般遊玩不建立任何元素、也不啟動計時器。 */
(function(){
  if(typeof TaipeiStreetCourier==='undefined')return;
  TaipeiStreetCourier.prototype.rendererDiagnostics=function(){
    const r=this.renderer;if(!r)return null;
    const gl=r.getContext(),info=r.info,caps=r.capabilities;
    const version=String(gl.getParameter(gl.VERSION)||'');
    return{
      three:THREE.REVISION,
      webgl:/WebGL\s*2/i.test(version)||caps.isWebGL2===true?2:1,
      glVersion:version,
      maxTextureSize:caps.maxTextureSize,
      drawCalls:info.render.calls,
      triangles:info.render.triangles,
      textures:info.memory.textures,
      geometries:info.memory.geometries,
    };
  };
  const debug=typeof location!=='undefined'&&/(?:^|[?&])debug=1(?:&|$)/.test(location.search||'');
  if(!debug)return;
  const fmt=d=>d?[
    'Three r'+d.three+' · WebGL '+d.webgl,
    'max texture '+d.maxTextureSize,
    'draw calls '+d.drawCalls,
    'triangles '+d.triangles.toLocaleString('en-US'),
    'textures '+d.textures,
    'geometries '+d.geometries,
  ].join('\n'):'renderer not ready';
  const timer=setInterval(()=>{
    const g=window.__game;if(!g||!g.renderer)return;
    let el=document.getElementById('renderer-diagnostics');
    if(!el){
      el=document.createElement('pre');el.id='renderer-diagnostics';
      el.style.cssText='position:fixed;left:6px;top:6px;z-index:99999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#cfe;background:rgba(0,0,0,.62);border-radius:4px;pointer-events:none;white-space:pre';
      document.body.appendChild(el);
    }
    el.textContent=fmt(g.rendererDiagnostics());
  },500);
  window.__rendererDiagnosticsTimer=timer;
})();


/* Preview module: taipei-street-monitor.js */
/* P2.4 opt-in diagnostics: QA callable, zero allocations/loops during play.
 * Collection samples renderer.info and chunk scene ownership on demand only.
 */
(()=>{
 'use strict';
 const P=TaipeiStreetCourier.prototype;
 P.taipeiStreetDiagnostics=function(){
  const entries=[...(this.worldChunkRenderEntries?.values?.()||[])];
  const tierCounts={near:0,mid:0,far:0},wallBatches={near:0,mid:0},colliders={near:0,mid:0,far:0};
  for(const entry of entries){
   if(!Object.prototype.hasOwnProperty.call(tierCounts,entry.tier))continue;
   tierCounts[entry.tier]++;
   colliders[entry.tier]+=entry.colliders?.length||0;
   for(const mesh of entry.group?.children||[])
    if(entry.tier==='near'&&mesh.userData?.openDataBuildingLayer==='walls')wallBatches.near++;
    else if(entry.tier==='mid'&&/^polygon-(walls|glass)$/.test(mesh.userData?.openDataBuildingLayer||''))wallBatches.mid++;
  }
  const renderer=this.renderer?.info||{},signs=this.taipeiDistrictSignStats||{signs:0,batches:0};
  const facades=[...(this.cityTextures?.keys?.()||[])].filter(k=>typeof k==='string'&&k.startsWith('p23:')).length;
  const activeStyles=Object.keys(this.worldChunkMaterials?.p23Pairs||{});
  const signMaterials=this.taipeiSignMaterials?.size||0;
  const budget={
   facadeTextures:facades<=8,signMaterials:signMaterials<=4,
   signInstances:signs.signs<=320,signDrawBatches:signs.batches<=4,
   zeroMidFarColliders:colliders.mid===0&&colliders.far===0
  };
  return{
   enabled:!!this.taipeiDistrictFacadeEnabled?.(),
   quality:this.effectiveGraphicsQuality?.()||'unknown',center:this.worldChunkState?.center||null,
   chunks:tierCounts,colliders,wallBatches,activeDistrictMaterials:activeStyles,
   facadeTextures:facades,signMaterials,signs:{...signs},
   renderer:{drawCalls:renderer.render?.calls??null,triangles:renderer.render?.triangles??null,
    textures:renderer.memory?.textures??null,geometries:renderer.memory?.geometries??null},
   budget,budgetPass:Object.values(budget).every(Boolean)
  };
 };
})();