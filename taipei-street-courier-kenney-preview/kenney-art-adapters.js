
/* Kenney feature adapter sidecar from ad2b6ebac0061b6b966d7bb626217d390292de39; preview-only pinned-asset URLs. */

/* external-street-art.js */
/* Opt-in Kenney CC0 visual-only roadside furniture.
 * Decorate existing Taipei lamp/signal groups; no new placements, road nodes,
 * colliders, signal bulbs, route handling, AI, gameplay or geographic changes.
 * All files come from the pinned, locally built art-models/manifest.json.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const MAX_LAMPS=8;
  const MAX_LAMP_ANCHORS=4096;
  const MAX_SIGNALS=6;
  const IDS=Object.freeze({
    lamp:'kenney-light-square',
    cone:'kenney-construction-cone',
    barrier:'kenney-construction-barrier'
  });
  const enabled=()=>typeof location!=='undefined'&&
    /(?:^|[?&])externalart=on(?:&|$)/.test(location.search||'')&&
    (location.protocol==='http:'||location.protocol==='https:');

  // The original lamp factory owns each physical placement. Collect only
  // its just-added Group; never generate another street light or position.
  const originalLamp=P.createStreetLamp;
  if(typeof originalLamp==='function'){
    P.createStreetLamp=function(...args){
      if(!enabled())return originalLamp.apply(this,args);
      const scene=this.scene;
      const n=scene?.children?.length||0;
      const result=originalLamp.apply(this,args);
      const group=scene?.children?.length===n+1?scene.children[n]:null;
      if(group?.isGroup){
        this.externalStreetLampAnchors=this.externalStreetLampAnchors||[];
        if(this.externalStreetLampAnchors.length<MAX_LAMP_ANCHORS)this.externalStreetLampAnchors.push(group);
      }
      return result;
    };
  }

  P.restoreExternalStreetArt=function(){
    for(const entry of this.externalStreetArtOverlays||[]){
      entry.group.remove(entry.overlay);
      for(const old of entry.hidden)old.object.visible=old.visible;
    }
    this.externalStreetArtOverlays=[];
    if(this.externalStreetArtState){
      this.externalStreetArtState.status='off';
      this.externalStreetArtState.attached=0;
    }
  };

  P.activateExternalStreetArt=async function(index){
    if(!enabled()||!this.scene||!THREE.GLTFLoader||!THREE.Box3 ||
       index?.schema!==1||!Array.isArray(index.items))return false;
    const epoch=this.externalArtEpoch||0;
    const state=this.externalStreetArtState={status:'loading',attached:0,error:null,counts:{}};
    const records=[];
    try{
      const assets={};
      const loader=new THREE.GLTFLoader();
      for(const [kind,id] of Object.entries(IDS)){
        const record=index.items.find(r=>r.id===id);
        if(!record||record.path!=='models/'+id+'.glb'||
           record.role!=='street-prop'||record.license!=='CC0-1.0'||
           !/^[0-9a-f]{64}$/.test(record.sha256))
          throw new Error('CC0 street model manifest mismatch: '+id);
        const gltf=await globalThis.__kenneyPreviewLoadGLB(id);
        if(!gltf?.scene)throw new Error('Empty street model: '+id);
        this.prepareExternalModelResources?.(gltf.scene,id);
        assets[kind]=gltf.scene;
      }
      if((this.externalArtEpoch||0)!==epoch)return false;

      const fit=(source,name,width,height,depth,x,z)=>{
        const model=source.clone(true);
        const bounds=new THREE.Box3().setFromObject(model);
        if(bounds.isEmpty())throw new Error('Street model empty: '+name);
        const size=bounds.getSize(new THREE.Vector3());
        const centre=bounds.getCenter(new THREE.Vector3());
        if(![size.x,size.y,size.z,bounds.min.y].every(Number.isFinite) ||
           Math.min(size.x,size.y,size.z)<=0)throw new Error('Street model dimensions invalid: '+name);
        const scale=Math.min(width/size.x,height/size.y,depth/size.z);
        if(!Number.isFinite(scale)||scale<=0||scale>100)throw new Error('Street model scale unsafe: '+name);
        model.scale.setScalar(scale);
        model.position.set(-centre.x*scale,-bounds.min.y*scale,-centre.z*scale);
        model.traverse(o=>{if(o.isMesh){
          o.castShadow=false;
          o.receiveShadow=true;
          o.userData.externalArtCosmetic=true;
        }});
        const overlay=new THREE.Group();
        overlay.name='Kenney CC0 '+name+' (visual only)';
        overlay.userData.externalArtCosmetic=true;
        overlay.position.set(x,0,z);
        overlay.add(model);
        return overlay;
      };

      // Choose anchors nearest the unchanged player spawn. Collection is capped
      // for memory safety, but only eight road-side lamp meshes are replaced.
      const focus=this.getPlayerStartPos?.()||this.carPos||{x:0,z:0};
      const distanceToFocus=group=>{
        const p=group?.position;
        return Number.isFinite(p?.x)&&Number.isFinite(p?.z) &&
          Number.isFinite(focus.x)&&Number.isFinite(focus.z)
          ?Math.hypot(p.x-focus.x,p.z-focus.z):Infinity;
      };
      const lamps=(this.externalStreetLampAnchors||[]).slice()
        .sort((a,b)=>distanceToFocus(a)-distanceToFocus(b))
        .slice(0,MAX_LAMPS);
      // Existing lamp Groups already sit at the correct road-side world
      // coordinates. Replace their original meshes, not the lamp placements.
      for(const group of lamps){
        if(!group?.isGroup||!group.parent)continue;
        const overlay=fit(assets.lamp,'streetlamp',1.4,6,1.4,0,0);
        records.push({group,overlay,
          hidden:group.children.filter(o=>o.isMesh)
            .map(object=>({object,visible:object.visible})),kind:'lamp'});
      }
      // Intersections already have four fixed signal poles (+/-8.2, +/-8.2).
      // Tiny decorative hardware stays at those pole bases, NOT in a new
      // road/intersection location. Dynamic red/yellow/green bulbs stay live.
      const signals=(this.trafficSignals||[]).slice()
        .sort((a,b)=>distanceToFocus(a?.group)-distanceToFocus(b?.group))
        .slice(0,MAX_SIGNALS);
      for(const signal of signals){
        const group=signal?.group;
        if(!group?.isGroup||!group.parent||!Array.isArray(signal.heads)||signal.heads.length!==4)continue;
        records.push({group,overlay:fit(assets.cone,'signal-pole-cone',.52,.78,.52,8.2,8.2),hidden:[],kind:'cone'});
        records.push({group,overlay:fit(assets.barrier,'signal-pole-guard',1.25,1.0,.42,-8.2,-8.2),hidden:[],kind:'barrier'});
      }
      if((this.externalArtEpoch||0)!==epoch)return false;
      this.restoreExternalStreetArt();
      this.externalStreetArtState=state;
      for(const r of records){
        r.group.add(r.overlay);
        for(const old of r.hidden)old.object.visible=false;
        this.externalStreetArtOverlays.push(r);
        state.counts[r.kind]=(state.counts[r.kind]||0)+1;
      }
      state.attached=records.length;
      state.status='loaded';
      return true;
    }catch(err){
      this.restoreExternalStreetArt();
      state.status='fallback';
      state.error=String(err?.message||err);
      state.attached=0;
      this.externalStreetArtState=state;
      return false;
    }
  };
})();


/* external-art.js */
/* P8-05 experimental CC0 NPC cosmetics.
 * Opt-in only: ?externalart=on on an HTTP(S) dist/web build.
 * Does not create colliders, change city geometry, traffic graph, player or gameplay.
 * ?externalart=off (also the default) is byte-for-byte visual fallback.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const TAXI_ID='kenney-taxi';
  const MODEL_PATH='models/kenney-taxi.glb';
  const MAX_TAXIS=4;
  const allowed=()=>typeof location!=='undefined'&&
    /(?:^|[?&])externalart=on(?:&|$)/.test(location.search||'')&&
    (location.protocol==='https:'||location.protocol==='http:');

  P.externalArtRequested=function(){return allowed();};

  P.restoreExternalArt=function(options){
    if(!options?.internal)this.externalArtEpoch=(this.externalArtEpoch||0)+1;
    this.restoreExternalStreetArt?.();
    for(const entry of this.externalArtOverlays||[]){
      entry.group.remove(entry.overlay);
      for(const old of entry.hidden)old.object.visible=old.visible;
    }
    this.externalArtOverlays=[];
    if(this.externalArtState){
      this.externalArtState.status='off';
      this.externalArtState.attached=0;
    }
  };

  // No route/physics fields are ever modified; only old meshes are hidden
  // *after* the replacement was safely created and attached to the same Group.
  P.activateExternalArt=async function(){
    if(!allowed()||!this.scene||!Array.isArray(this.traffic)||
       !THREE.GLTFLoader||!THREE.Box3)return false;
    if(this.externalArtState?.status==='loaded')return true;
    const epoch=this.externalArtEpoch||0;
    const state=this.externalArtState={status:'loading',attached:0,error:null,streetAttached:0};
    try{
      const result=await fetch('./art-models/manifest.json',{cache:'no-store'});
      if(!result.ok)throw new Error('model manifest HTTP '+result.status);
      const index=await result.json();
      const entry=index?.items?.find(row=>row.id===TAXI_ID);
      if(index?.schema!==1||!entry||entry.path!==MODEL_PATH||
         entry.role!=='traffic'||entry.license!=='CC0-1.0'||
         !/^[a-f0-9]{64}$/.test(entry.sha256))
        throw new Error('Kenney taxi missing or provenance mismatch');
      const gltf=await globalThis.__kenneyPreviewLoadGLB(TAXI_ID);
      if(!gltf?.scene)throw new Error('Kenney GLB has no scene');
      this.prepareExternalModelResources?.(gltf.scene,TAXI_ID);
      const targets=this.traffic.filter(t=>t.type==='taxi'&&t.group?.isGroup).slice(0,MAX_TAXIS);
      const prepared=[];
      for(const taxi of targets){
        const group=taxi.group,original=gltf.scene.clone(true);
        const bounds=new THREE.Box3().setFromObject(original);
        if(bounds.isEmpty())throw new Error('Empty Kenney taxi model');
        const size=bounds.getSize(new THREE.Vector3());
        const center=bounds.getCenter(new THREE.Vector3());
        const dimensions=group.userData||{};
        if(![size.x,size.y,size.z,dimensions.width,dimensions.length,dimensions.height]
          .every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid taxi bounds');
        // Uniform fit inside the *existing* 1.9×4.5×1.5 NPC collider.
        const scale=Math.min(dimensions.width*.94/size.x,
          dimensions.length*.94/size.z,dimensions.height*.96/size.y);
        if(!Number.isFinite(scale)||scale<=0||scale>100)throw new Error('Unsafe cosmetic scale');
        original.scale.setScalar(scale);
        original.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
        original.traverse(o=>{
          if(o.isMesh){
            o.castShadow=false;
            o.receiveShadow=true;
            o.userData.externalArtCosmetic=true;
          }
        });
        const overlay=new THREE.Group();
        overlay.name='Kenney CC0 taxi cosmetic (visual only)';
        overlay.userData.externalArtCosmetic=true;
        overlay.add(original);
        prepared.push({group,overlay,hidden:group.children.filter(o=>o.isMesh)
          .map(object=>({object,visible:object.visible}))});
      }
      // Manual rollback during fetch cancels the cosmetic swap.
      if((this.externalArtEpoch||0)!==epoch)return false;
      this.restoreExternalArt({internal:true});
      // restoreExternalArt modifies the old state; only set success after swap.
      this.externalArtState=state;
      for(const entry of prepared){
        entry.group.add(entry.overlay);
        for(const old of entry.hidden)old.object.visible=false;
        this.externalArtOverlays.push(entry);
      }
      state.status='loaded';
      state.attached=prepared.length;
      // Props share the same authenticated, locally built manifest.
      // Their failure never undoes a successful NPC cosmetic replacement.
      if(typeof this.activateExternalStreetArt==='function'){
        try{
          await this.activateExternalStreetArt(index);
          state.streetAttached=this.externalStreetArtState?.attached||0;
        }catch(_err){state.streetAttached=0;}
      }
      this.refreshExternalArtVisibility?.();
      return true;
    }catch(err){
      this.restoreExternalArt();
      state.status='fallback';
      state.error=String(err?.message||err);
      state.attached=0;
      this.externalArtState=state;
      // Do not poison browser QA with an uncaught rejection or console.error.
      return false;
    }
  };

  const previousInit=P.init;
  P.init=async function(...args){
    const result=await previousInit.apply(this,args);
    this.externalArtState={status:'off',attached:0,error:null};
    this.externalArtOverlays=[];
    // Never await a cosmetic download or delay entering the original game.
    if(allowed())this.externalArtPromise=this.activateExternalArt();
    return result;
  };
})();


/* external-art-budget.js */
/* P8-08 opt-in Kenney LOD: mesh visibility only, no extra RAF or timers.
 * Does not change Taipei geography, physics, steering, traffic or game state.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const limits=Object.freeze({
    low:Object.freeze({radius:120,taxi:1,lamp:2,cone:1,barrier:1}),
    medium:Object.freeze({radius:210,taxi:2,lamp:4,cone:3,barrier:3}),
    high:Object.freeze({radius:360,taxi:4,lamp:8,cone:6,barrier:6})
  });
  const kinds=['taxi','lamp','cone','barrier'];
  function dist(group,focus){
    const p=group?.position;
    return p&&[p.x,p.z,focus.x,focus.z].every(Number.isFinite)?
      Math.hypot(p.x-focus.x,p.z-focus.z):Infinity;
  }
  function reveal(record,yes){
    if(record.active===yes)return;
    record.active=yes;
    if(record.overlay)record.overlay.visible=yes;
    for(const old of record.hidden||[])old.object.visible=yes?false:old.visible;
  }
  P.refreshExternalArtVisibility=function(){
    const entries=[
      ...(this.externalArtOverlays||[]).map(e=>({kind:'taxi',record:e})),
      ...(this.externalStreetArtOverlays||[]).map(e=>({kind:e.kind,record:e}))
    ];
    const counts={taxi:0,lamp:0,cone:0,barrier:0};
    if(!entries.length)return this.externalArtBudget={
      quality:'off',radius:0,mounted:0,visible:0,visibleByType:counts
    };
    let quality=this.effectiveGraphicsQuality?.()||'high';
    if(!Object.hasOwn(limits,quality))quality='high';
    const max=limits[quality],focus=(this.gameState==='TITLE'?this.getPlayerStartPos?.():null)||
      this.carPos||{x:NaN,z:NaN};
    for(const kind of kinds){
      const candidates=entries.filter(e=>e.kind===kind)
        .map(e=>({record:e.record,distance:dist(e.record.group,focus)}))
        .sort((a,b)=>a.distance-b.distance);
      candidates.forEach((item,index)=>{
        const threshold=max.radius*(item.record.active?1.12:1);
        const visible=index<max[kind]&&item.distance<=threshold;
        reveal(item.record,visible);
        if(visible)counts[kind]++;
      });
    }
    return this.externalArtBudget={
      quality,radius:max.radius,mounted:entries.length,
      visible:counts.taxi+counts.lamp+counts.cone+counts.barrier,
      visibleByType:counts
    };
  };
  P.getExternalArtBudget=function(){
    return this.externalArtBudget||{
      quality:'off',radius:0,mounted:0,visible:0,
      visibleByType:{taxi:0,lamp:0,cone:0,barrier:0}
    };
  };
  // Keep the game's single existing requestAnimationFrame loop.
  const originalLoop=P.loop;
  if(typeof originalLoop==='function'){
    P.loop=function(timestamp,...rest){
      if((this.externalArtOverlays?.length||this.externalStreetArtOverlays?.length)&&
         Number.isFinite(timestamp)&&
         (this.externalArtCullAt===undefined||timestamp-this.externalArtCullAt>=250)){
        this.externalArtCullAt=timestamp;
        try{this.refreshExternalArtVisibility();}
        catch(_error){this.restoreExternalArt?.();}
      }
      return originalLoop.call(this,timestamp,...rest);
    };
  }
})();


/* external-art-resources.js */
/* P8-09 opt-in CC0 atlas pooling and observable renderer budgets.
 * Never touches the original scene's textures, materials, geometry or physics.
 * Three GLTFLoader clones already share geometry; street GLBs use one proven
 * identical, source-SHA-pinned Kenney City Roads 512x512 colormap.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const atlasIds=new Set([
    'kenney-light-square','kenney-construction-cone','kenney-construction-barrier'
  ]);
  function textureData(texture){
    return texture?.source?.data||texture?.image||null;
  }
  function mipBytes(width,height){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)return 0;
    let total=0,w=width,h=height;
    do{total+=w*h*4;w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));}
    while(w>1||h>1);
    return total+4;
  }
  function signature(texture){
    // Reject aliasing unless all sampler/transform/color-space settings match.
    const vector=o=>o&&[o.x,o.y].every(Number.isFinite)?[o.x,o.y]:null;
    const image=textureData(texture);
    const v={
      width:image?.width,height:image?.height,
      mapping:texture.mapping,wrapS:texture.wrapS,wrapT:texture.wrapT,
      magFilter:texture.magFilter,minFilter:texture.minFilter,
      format:texture.format,type:texture.type,
      anisotropy:texture.anisotropy,colorSpace:texture.colorSpace,
      flipY:texture.flipY,premultiplyAlpha:texture.premultiplyAlpha,
      unpackAlignment:texture.unpackAlignment,generateMipmaps:texture.generateMipmaps,
      channel:texture.channel,offset:vector(texture.offset),
      repeat:vector(texture.repeat),center:vector(texture.center),
      rotation:texture.rotation,matrixAutoUpdate:texture.matrixAutoUpdate
    };
    if(v.width!==512||v.height!==512)return null;
    return JSON.stringify(v);
  }
  function allMaterials(scene){
    const found=new Set();
    scene.traverse(o=>{
      if(!o.isMesh)return;
      for(const mat of Array.isArray(o.material)?o.material:[o.material])
        if(mat)found.add(mat);
    });
    return [...found];
  }
  P.prepareExternalModelResources=function(scene,id){
    if(!atlasIds.has(id)||!scene?.traverse)return false;
    const materials=allMaterials(scene);
    if(!materials.length)return false;
    const textures=[...new Set(materials.map(m=>m.map).filter(t=>t?.isTexture))];
    if(textures.length!==1||materials.some(m=>m.map!==textures[0]))return false;
    const texture=textures[0],sig=signature(texture);
    if(!sig)return false;
    const stats=this.externalArtResourcePoolStats||{
      atlasGroups:0,sharedModelTextures:0,estimatedGpuBytesAvoided:0,unsharedDueToMismatch:0
    };
    this.externalArtResourcePoolStats=stats;
    const pool=this.externalArtAtlasPool||(this.externalArtAtlasPool=new Map());
    const key='kenney-roads-cc0-512-colormap';
    const cached=pool.get(key);
    if(!cached){
      pool.set(key,{texture,signature:sig});
      stats.atlasGroups=1;
      return true;
    }
    if(cached.signature!==sig){
      stats.unsharedDueToMismatch++;
      return false;
    }
    if(cached.texture===texture)return true;
    for(const material of materials){
      // Dedicated imported materials only; no original Taipei material is edited.
      material.map=cached.texture;
      material.needsUpdate=true;
    }
    stats.sharedModelTextures++;
    stats.estimatedGpuBytesAvoided+=mipBytes(512,512);
    return true;
  };
  P.getExternalArtResourceStats=function(){
    const stats=this.externalArtResourcePoolStats||{};
    const entries=[...(this.externalArtOverlays||[]),...(this.externalStreetArtOverlays||[])];
    const uniqueGeometries=new Set(),uniqueMaterials=new Set(),uniqueTextures=new Set();
    let drawCallsUpperBound=0,trianglesUpperBound=0,visibleOverlays=0;
    for(const item of entries){
      if(!item.overlay?.visible)continue;
      visibleOverlays++;
      item.overlay.traverse(o=>{
        if(!o.isMesh||o.visible===false)return;
        const geometry=o.geometry;
        if(geometry){
          uniqueGeometries.add(geometry);
          const count=geometry.index?.count||geometry.attributes?.position?.count||0;
          if(Number.isFinite(count))trianglesUpperBound+=Math.ceil(count/3);
        }
        for(const material of Array.isArray(o.material)?o.material:[o.material]){
          if(!material)continue;
          uniqueMaterials.add(material);
          if(material.map?.isTexture)uniqueTextures.add(material.map);
        }
        // Bounding: one draw per visible mesh, regardless of material groups.
        // This is an estimate, not renderer.info.render.calls.
        drawCallsUpperBound++;
      });
    }
    // Batched road meshes are now scene-root InstancedMeshes. Their source
    // Group overlays remain hidden; account for batches once per visible kind,
    // rather than counting all original source meshes as GPU draw calls.
    const batches=this.externalArtInstanceBatches||[];
    for(const batch of batches){
      const count=batch.mesh?.visible?batch.mesh.count:0;
      if(!count)continue;
      visibleOverlays+=count;
      drawCallsUpperBound++;
      const geometry=batch.mesh.geometry,material=batch.mesh.material;
      if(geometry){
        uniqueGeometries.add(geometry);
        const triangles=(geometry.index?.count||geometry.attributes?.position?.count||0)/3;
        if(Number.isFinite(triangles))trianglesUpperBound+=Math.ceil(triangles)*count;
      }
      if(material){
        uniqueMaterials.add(material);
        if(material.map?.isTexture)uniqueTextures.add(material.map);
      }
    }
    // Moving taxi meshes are root InstancedMesh batches too. Hidden source
    // taxi overlay meshes no longer contribute draw calls. Count each live
    // mesh slot once and multiply its primitives by visible cars.
    for(const batch of this.externalTaxiInstanceBatches||[]){
      const count=batch.mesh?.visible?batch.mesh.count:0;
      if(!count)continue;
      drawCallsUpperBound++;
      const geometry=batch.mesh.geometry,material=batch.mesh.material;
      if(geometry){
        uniqueGeometries.add(geometry);
        const triangles=(geometry.index?.count||geometry.attributes?.position?.count||0)/3;
        if(Number.isFinite(triangles))trianglesUpperBound+=Math.ceil(triangles)*count;
      }
      if(material){
        uniqueMaterials.add(material);
        if(material.map?.isTexture)uniqueTextures.add(material.map);
      }
    }
    visibleOverlays+=this.getExternalTaxiInstancingStats?.().carsVisible||0;
    return {
      visibleOverlays,drawCallsEstimate:drawCallsUpperBound,
      trianglesEstimate:trianglesUpperBound,
      geometryObjects:uniqueGeometries.size,
      materialObjects:uniqueMaterials.size,
      textureObjects:uniqueTextures.size,
      atlasGroups:stats.atlasGroups||0,
      sharedModelTextures:stats.sharedModelTextures||0,
      estimatedGpuBytesAvoided:stats.estimatedGpuBytesAvoided||0,
      unsharedDueToMismatch:stats.unsharedDueToMismatch||0
    };
  };
})();


/* external-art-instancing.js */
/* P8-10: Optional Kenney roadside InstancedMesh batching.
 * Only the three already-mounted, single-mesh CC0 street props are batched.
 * Original Taipei lamp coordinates, intersection groups, signal animations,
 * physics, traffic AI and mission logic remain unchanged.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const KINDS=['lamp','cone','barrier'];
  function sourceMesh(overlay){
    if(!overlay?.traverse)return null;
    const meshes=[];
    overlay.traverse(o=>{if(o.isMesh)meshes.push(o);});
    // GLB structure may evolve. Multi-mesh/skinned/morphing assets are not safe to batch.
    if(meshes.length!==1)return null;
    const mesh=meshes[0];
    if(!mesh.geometry||!mesh.material||Array.isArray(mesh.material)||
       mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.morphTargetInfluences?.length||
       mesh.geometry.groups?.length>1)return null;
    return mesh;
  }
  P.clearExternalArtInstancing=function(){
    const batches=this.externalArtInstanceBatches||[];
    this.externalArtInstanceBatches=[];
    // Restore every GLB source first, even if GPU buffer disposal fails.
    for(const batch of batches){
      for(const {record} of batch.members||[]){
        record.externalArtInstanced=false;
        if(record.overlay)record.overlay.visible=record.active===true;
      }
    }
    for(const batch of batches){
      try{batch.mesh?.parent?.remove(batch.mesh);}
      catch(_error){this.scene?.remove(batch.mesh);}
      // Dispose instance data only; source GLTF geometry and shared material
      // remain owned by the source model and are never disposed.
      try{batch.mesh?.dispose?.();}catch(_error){/* visual fallback wins */}
    }
  };
  P.syncExternalArtInstances=function(){
    const batches=this.externalArtInstanceBatches||[];
    if(!batches.length)return true;
    try{
      if(!this.scene||typeof THREE.Matrix4!=='function')
        throw new Error('Street instance matrix renderer unavailable');
      // Preflight ALL active source transforms before hiding a single source
      // GLB. Silent skips previously made negative-scale props disappear.
      this.scene.updateWorldMatrix(true,false);
      const rootDet=this.scene.matrixWorld.determinant();
      if(!Number.isFinite(rootDet)||rootDet===0)
        throw new Error('Invalid street instance scene root');
      const inverse=new THREE.Matrix4().copy(this.scene.matrixWorld).invert();
      const planned=[];
      for(const batch of batches){
        if(batch.mesh?.parent!==this.scene)
          throw new Error('Detached street batch '+batch.kind);
        const matrices=[];
        for(const {record,source} of batch.members){
          if(!record?.active||!record.group?.parent)continue;
          source.updateWorldMatrix(true,false);
          const determinant=source.matrixWorld.determinant();
          if(!Number.isFinite(determinant)||determinant<=0)
            throw new Error('Unsafe street instance scale '+batch.kind);
          const matrix=new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld);
          if(!Number.isFinite(matrix.determinant())||matrix.determinant()<=0||
             !matrix.elements.every(Number.isFinite))
            throw new Error('Unsafe street instance transform '+batch.kind);
          matrices.push(matrix);
        }
        planned.push({batch,matrices});
      }
      // Commit only after the full street plan is valid. If GPU upload
      // throws halfway, catch below restores ALL source models.
      for(const {batch,matrices} of planned){
        matrices.forEach((matrix,i)=>batch.mesh.setMatrixAt(i,matrix));
        batch.mesh.count=matrices.length;
        batch.mesh.visible=matrices.length>0;
        if(matrices.length)batch.mesh.instanceMatrix.needsUpdate=true;
      }
      for(const batch of batches)
        for(const {record} of batch.members)record.overlay.visible=false;
      this.externalArtInstancingError=null;
      return true;
    }catch(error){
      this.externalArtInstancingError=String(error?.message||error);
      this.clearExternalArtInstancing();
      return false;
    }
  };
  P.prepareExternalArtInstancing=function(){
    this.clearExternalArtInstancing();
    this.externalArtInstancingError=null;
    if(!this.scene||typeof THREE.InstancedMesh!=='function'||
       typeof THREE.Matrix4!=='function')return false;
    const all=this.externalStreetArtOverlays||[];
    const prepared=[];
    try{
      for(const kind of KINDS){
        const records=all.filter(row=>row.kind===kind);
        if(records.length<2)continue;
        const members=records.map(record=>({record,source:sourceMesh(record.overlay)}));
        if(members.some(m=>!m.source))continue;
        const geometry=members[0].source.geometry,material=members[0].source.material;
        if(members.some(m=>m.source.geometry!==geometry||m.source.material!==material))
          continue;
        const mesh=new THREE.InstancedMesh(geometry,material,members.length);
        // Stage immediately: later setup (including setUsage) can throw.
        // Every created batch is then guaranteed to reach catch cleanup.
        prepared.push({kind,mesh,members});
        mesh.name='Kenney CC0 '+kind+' (visual InstancedMesh only)';
        mesh.frustumCulled=false;
        mesh.castShadow=false;
        mesh.receiveShadow=true;
        mesh.userData.externalArtCosmetic=true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count=0;
        mesh.visible=false;
      }
      if(!prepared.length)return false;
      // Scene mutation is deliberately deferred until *all* mesh
      // constructors and buffers have been initialized successfully.
      for(const batch of prepared){
        this.scene.add(batch.mesh);
        this.externalArtInstanceBatches.push(batch);
        for(const {record} of batch.members)record.externalArtInstanced=true;
      }
      return this.syncExternalArtInstances();
    }catch(error){
      this.externalArtInstancingError=String(error?.message||error);
      const mounted=new Set(this.externalArtInstanceBatches||[]);
      this.clearExternalArtInstancing();
      // clearExternalArtInstancing disposes mounted batches. Here, dispose
      // only the still-unmounted staged batches to avoid double-disposal.
      for(const batch of prepared){
        if(mounted.has(batch))continue;
        try{batch.mesh.parent?.remove(batch.mesh);}catch(_error){}
        try{batch.mesh.dispose?.();}catch(_error){}
      }
      return false;
    }
  };
  P.getExternalArtInstancingStats=function(){
    const batches=this.externalArtInstanceBatches||[];
    const perKind={lamp:0,cone:0,barrier:0};
    let visible=0;
    for(const batch of batches){
      const count=batch.mesh.visible?batch.mesh.count:0;
      perKind[batch.kind]=(perKind[batch.kind]||0)+count;
      visible+=count;
    }
    const drawCalls=batches.reduce((n,b)=>n+(b.mesh.visible&&b.mesh.count>0?1:0),0);
    return {
      enabled:batches.length>0,batches:batches.length,
      lastError:this.externalArtInstancingError||null,
      instancesMounted:batches.reduce((n,b)=>n+b.members.length,0),
      instancesVisible:visible,perKind,
      drawCallsEstimate:drawCalls,drawCallsSavedEstimate:Math.max(0,visible-drawCalls)
    };
  };
  const originalRefresh=P.refreshExternalArtVisibility;
  if(typeof originalRefresh==='function'){
    P.refreshExternalArtVisibility=function(...args){
      const state=originalRefresh.apply(this,args);
      this.syncExternalArtInstances();
      return state;
    };
  }
  const originalActivate=P.activateExternalStreetArt;
  if(typeof originalActivate==='function'){
    P.activateExternalStreetArt=async function(...args){
      const loaded=await originalActivate.apply(this,args);
      if(loaded){
        try{this.prepareExternalArtInstancing();}
        catch(_err){this.clearExternalArtInstancing();}
        this.refreshExternalArtVisibility?.();
      }
      return loaded;
    };
  }
  const originalRestore=P.restoreExternalStreetArt;
  if(typeof originalRestore==='function'){
    P.restoreExternalStreetArt=function(...args){
      this.clearExternalArtInstancing();
      return originalRestore.apply(this,args);
    };
  }
})();


/* external-taxi-instancing.js */
/* P8-11: optional moving Kenney taxi InstancedMesh batches.
 * Only existing opt-in GLB cosmetics are instanced; traffic movement, AI,
 * collision, labels, player, scene geography and game rules are untouched.
 * All five meshes must have compatible shared GLB geometry/material or the
 * *entire* taxi optimization is skipped (existing visuals stay active).
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const EXPECTED_MESHES=5;
  function collect(overlay){
    if(!overlay?.traverse)return null;
    const found=[];
    overlay.traverse(o=>{if(o.isMesh)found.push(o);});
    if(found.length!==EXPECTED_MESHES)return null;
    for(const mesh of found){
      if(!mesh.geometry||!mesh.material||Array.isArray(mesh.material)||
         mesh.isSkinnedMesh||mesh.isInstancedMesh||
         mesh.morphTargetInfluences?.length||mesh.geometry.groups?.length>1)
        return null;
    }
    return found;
  }
  P.clearExternalTaxiInstancing=function(){
    const batches=this.externalTaxiInstanceBatches||[];
    // Idempotent: drop the owned batch list BEFORE touching GPU objects.
    this.externalTaxiInstanceBatches=[];
    // Source GLBs must become visible even when a GPU dispose fails.
    for(const record of this.externalArtOverlays||[]){
      record.externalTaxiInstanced=false;
      if(record.overlay)record.overlay.visible=record.active===true;
    }
    for(const batch of batches){
      // If Object3D.remove itself fails, the stale batch must never keep
      // drawing alongside the recovered source GLB.
      if(batch.mesh)batch.mesh.visible=false;
      try{batch.mesh?.parent?.remove(batch.mesh);}
      catch(_error){
        try{this.scene?.remove(batch.mesh);}catch(_ignored){}
      }
      // Three.js InstancedMesh.dispose releases ONLY instance GPU resources.
      // Shared GLTFLoader geometry/material/texture remain owned by sources.
      try{batch.mesh?.dispose?.();}catch(_error){/* continue cleanup */}
    }
  };
  P.syncExternalTaxiInstances=function(){
    const batches=this.externalTaxiInstanceBatches||[];
    if(!batches.length)return true;
    try{
      this.scene.updateWorldMatrix(true,false);
      const rootDet=this.scene.matrixWorld.determinant();
      if(!Number.isFinite(rootDet)||rootDet===0)
        throw new Error('Unsafe taxi scene-root transform');
      const inverse=new THREE.Matrix4().copy(this.scene.matrixWorld).invert();
      const worldToRoot=new THREE.Matrix4();
      // A detached or replaced mesh cannot render. Never hide the original
      // taxi GLB just because the stale instance-list still exists.
      for(const batch of batches){
        if(batch.mesh?.parent!==this.scene)
          throw new Error('Detached Kenney taxi instance slot '+batch.slot);
        let count=0;
        for(const {record,source} of batch.members){
          if(!record.active||!record.group?.parent)continue;
          if(source.geometry!==batch.mesh.geometry||
             source.material!==batch.mesh.material)
            throw new Error('Taxi instance source geometry/material drift slot '+batch.slot);
          // Source meshes are hidden when batched, but their transforms remain
          // accurate and are updated even when parents are invisible.
          source.updateWorldMatrix(true,false);
          const determinant=source.matrixWorld.determinant();
          if(!Number.isFinite(determinant)||determinant<=0)
            throw new Error('Unsafe taxi instance matrix');
          worldToRoot.multiplyMatrices(inverse,source.matrixWorld);
          if(!Number.isFinite(worldToRoot.determinant())||
             worldToRoot.determinant()<=0||
             !worldToRoot.elements.every(Number.isFinite))
            throw new Error('Nonfinite taxi instance transform');
          batch.mesh.setMatrixAt(count++,worldToRoot);
        }
        batch.mesh.count=count;
        batch.mesh.visible=count>0;
        if(count)batch.mesh.instanceMatrix.needsUpdate=true;
      }
      // Only after ALL five slots synchronized successfully may the
      // five source GLB meshes stop rendering. Parent transforms continue
      // updating even though these visual containers are invisible.
      for(const {record} of batches[0].members)record.overlay.visible=false;
      return true;
    }catch(error){
      // Fail closed, restoring the existing per-car GLB render. Never let
      // cosmetic GPU errors interrupt game steering or collision updates.
      this.externalTaxiInstancingError=String(error?.message||error);
      this.clearExternalTaxiInstancing();
      return false;
    }
  };
  P.prepareExternalTaxiInstancing=function(){
    this.clearExternalTaxiInstancing();
    this.externalTaxiInstancingError=null;
    if(!this.scene||typeof THREE.InstancedMesh!=='function'||
       typeof THREE.Matrix4!=='function')return false;
    const records=this.externalArtOverlays||[];
    if(records.length<2)return false; // no draw-call savings for one taxi
    const perCar=records.map(record=>collect(record.overlay));
    if(perCar.some(meshes=>!meshes))return false;
    const proposed=[];
    try{
      for(let slot=0;slot<EXPECTED_MESHES;slot++){
        const meshes=perCar.map(list=>list[slot]);
        const geometry=meshes[0].geometry,material=meshes[0].material;
        if(meshes.some(m=>m.geometry!==geometry||m.material!==material))
          throw new Error('Non-identical taxi mesh/material slot');
        // GLB nodes can contain nested scale/rotation. Check handedness
        // before hiding any source GLB mesh.
        for(const mesh of meshes){
          mesh.updateWorldMatrix(true,false);
          const determinant=mesh.matrixWorld.determinant();
          if(!Number.isFinite(determinant)||determinant<=0)
            throw new Error('Unsupported negative taxi instance scale');
        }
        const instance=new THREE.InstancedMesh(geometry,material,records.length);
        // Track immediately: configuration/setUsage can fail before mounting.
        proposed.push({slot,mesh:instance,members:records.map((record,i)=>({
          record,source:meshes[i]
        }))});
        instance.name='Kenney CC0 taxi slot '+slot+' (moving InstancedMesh only)';
        instance.frustumCulled=false;
        instance.castShadow=false;
        instance.receiveShadow=true;
        instance.userData.externalArtCosmetic=true;
        instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instance.count=0;instance.visible=false;
      }
      // No source GLB visibility changes until all five batches are valid.
      this.externalTaxiInstanceBatches=proposed;
      for(const batch of proposed)this.scene.add(batch.mesh);
      for(const record of records)record.externalTaxiInstanced=true;
      if(!this.syncExternalTaxiInstances())return false;
      return true;
    }catch(error){
      this.externalTaxiInstancingError=String(error?.message||error);
      // Mounted batches are disposed by clearExternalTaxiInstancing().
      // Never dispose the same instance twice, even if scene.add throws.
      const mounted=new Set(this.externalTaxiInstanceBatches||[]);
      this.clearExternalTaxiInstancing();
      for(const batch of proposed){
        if(mounted.has(batch))continue;
        try{batch.mesh.parent?.remove(batch.mesh);}catch(_ignored){}
        try{batch.mesh.dispose?.();}catch(_ignored){}
      }
      return false;
    }
  };
  P.getExternalTaxiInstancingStats=function(){
    const batches=this.externalTaxiInstanceBatches||[];
    const meshSlotsVisible=batches.reduce((n,b)=>
      n+(b.mesh.visible&&b.mesh.count>0?1:0),0);
    const instancesVisible=batches.reduce((n,b)=>
      n+(b.mesh.visible?b.mesh.count:0),0);
    return {
      enabled:batches.length===EXPECTED_MESHES,
      batches:batches.length,
      lastError:this.externalTaxiInstancingError||null,
      carsMounted:batches.length?batches[0].members.length:0,
      carsVisible:batches.length?Math.min(...batches.map(b=>b.mesh.visible?b.mesh.count:0)):0,
      meshInstancesVisible:instancesVisible,
      drawCallsEstimate:meshSlotsVisible,
      drawCallsSavedEstimate:Math.max(0,instancesVisible-meshSlotsVisible)
    };
  };

  // The previous P8-08 adapter runs proximity LOD once every 250ms. Repack
  // active taxi mesh instances immediately after any quota/visibility change.
  const previousRefresh=P.refreshExternalArtVisibility;
  if(typeof previousRefresh==='function'){
    P.refreshExternalArtVisibility=function(...args){
      const result=previousRefresh.apply(this,args);
      this.syncExternalTaxiInstances();
      return result;
    };
  }
  // Actual traffic movement occurs here, before the game's existing render
  // call. Do not throttle moving matrices to the 250ms *visibility* cadence.
  const previousTraffic=P.updateCivilianTraffic;
  if(typeof previousTraffic==='function'){
    P.updateCivilianTraffic=function(...args){
      const result=previousTraffic.apply(this,args);
      this.syncExternalTaxiInstances();
      return result;
    };
  }
  const previousActivate=P.activateExternalArt;
  if(typeof previousActivate==='function'){
    P.activateExternalArt=async function(...args){
      const result=await previousActivate.apply(this,args);
      if(result){
        this.prepareExternalTaxiInstancing();
        this.refreshExternalArtVisibility?.();
      }
      return result;
    };
  }
  const previousRestore=P.restoreExternalArt;
  if(typeof previousRestore==='function'){
    P.restoreExternalArt=function(...args){
      this.clearExternalTaxiInstancing();
      return previousRestore.apply(this,args);
    };
  }
})();


/* external-art-ab.js */
/* P8-12: A/B switching for already-opted-in Kenney GLB batches.
 * No new model loading, gameplay changes, timers or saved settings.
 * QA uses this switch to compare the exact same scene on the same page.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  function status(game){
    const street=game.getExternalArtInstancingStats?.()||{batches:0};
    const taxi=game.getExternalTaxiInstancingStats?.()||{batches:0};
    return {
      enabled:street.batches===3&&taxi.batches===5,
      streetBatches:street.batches,
      taxiBatches:taxi.batches,
      mountedStreet:game.externalStreetArtOverlays?.length||0,
      mountedTaxis:game.externalArtOverlays?.length||0,
      requested:game.externalArtRequested?.()===true
    };
  }
  P.getExternalArtBatchingState=function(){return status(this);};

  P.setExternalArtBatchingEnabled=function(enable){
    // Never activate cosmetics or fetch anything in ordinary/offline mode.
    if(this.externalArtRequested?.()!==true||
       this.externalArtState?.status!=='loaded'||
       this.externalStreetArtState?.status!=='loaded')return false;
    const desired=enable===true;
    try{
      // Clear old GPU instance buffers first. Underlying source meshes,
      // existing NPC Groups, original street lamps and colliders are retained.
      this.clearExternalTaxiInstancing?.();
      this.clearExternalArtInstancing?.();
      if(!desired){
        this.refreshExternalArtVisibility?.();
        return !status(this).enabled;
      }
      const street=this.prepareExternalArtInstancing?.();
      const taxis=this.prepareExternalTaxiInstancing?.();
      if(!street||!taxis||!status(this).enabled){
        this.clearExternalTaxiInstancing?.();
        this.clearExternalArtInstancing?.();
        this.refreshExternalArtVisibility?.();
        return false;
      }
      this.refreshExternalArtVisibility?.();
      return status(this).enabled;
    }catch(_error){
      this.clearExternalTaxiInstancing?.();
      this.clearExternalArtInstancing?.();
      this.refreshExternalArtVisibility?.();
      return false;
    }
  };
})();


/* external-art-audit.js */
/* P8-13: read-only audit of Kenney InstancedMesh world-transform parity.
 * Called only on demand from QA. No loop, no timer, no scene/collider writes.
 * The source GLB remains in each original Group even while render-hidden.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const TOLERANCE=1e-4;
  P.getExternalArtRenderAudit=function(){
    const report={
      ok:true,mode:'off',checkedMatrices:0,maxMatrixDelta:0,
      sourceOverlays:0,batches:0,drawnInstances:0,errors:[]
    };
    if(!this.externalArtRequested?.()||!this.scene||typeof THREE.Matrix4!=='function')
      return report;
    const street=this.externalStreetArtOverlays||[];
    const taxi=this.externalArtOverlays||[];
    const streetBatches=this.externalArtInstanceBatches||[];
    const taxiBatches=this.externalTaxiInstanceBatches||[];
    const batches=[...streetBatches,...taxiBatches];
    const records=[...street,...taxi];
    report.sourceOverlays=records.length;
    report.batches=batches.length;
    report.mode=batches.length?'batched':'unbatched';
    const error=(label)=>{report.errors.push(label);report.ok=false;};
    if(batches.length){
      this.scene.updateWorldMatrix(true,false);
      const inverse=new THREE.Matrix4().copy(this.scene.matrixWorld).invert();
      const expected=new THREE.Matrix4(),observed=new THREE.Matrix4();
      for(const batch of batches){
        const key=batch.kind||('taxi-slot-'+batch.slot);
        if(batch.mesh?.parent!==this.scene)error(key+': detached batch mesh');
        const selected=[];
        for(const member of batch.members||[]){
          if(!member.record?.group?.parent||!member.record.active)continue;
          member.source.updateWorldMatrix(true,false);
          const determinant=member.source.matrixWorld.determinant();
          if(Number.isFinite(determinant)&&determinant>0)selected.push(member);
          else error(key+': nonpositive source determinant');
        }
        if(batch.mesh?.count!==selected.length)
          error(key+': instance count '+batch.mesh?.count+' !== '+selected.length);
        if(batch.mesh?.visible!==(selected.length>0))
          error(key+': visibility/count mismatch');
        report.drawnInstances+=batch.mesh?.visible?batch.mesh.count||0:0;
        for(let index=0;index<selected.length;index++){
          const member=selected[index];
          if(batch.mesh?.geometry!==member.source.geometry||
             batch.mesh?.material!==member.source.material)
            error(key+': geometry or material identity drift');
          try{
            expected.multiplyMatrices(inverse,member.source.matrixWorld);
            batch.mesh.getMatrixAt(index,observed);
            let delta=0;
            for(let j=0;j<16;j++)
              delta=Math.max(delta,Math.abs(expected.elements[j]-observed.elements[j]));
            if(!Number.isFinite(delta)||delta>TOLERANCE)
              error(key+': matrix '+index+' drift '+delta);
            report.maxMatrixDelta=Math.max(report.maxMatrixDelta,delta);
            report.checkedMatrices++;
          }catch(e){error(key+': invalid matrix '+index);}
        }
        for(const member of batch.members||[])
          if(member.record?.overlay?.visible)
            error(key+': source overlay double-rendered');
      }
    }
    for(const record of records){
      const isInstanced=record.externalTaxiInstanced||record.externalArtInstanced;
      if(!isInstanced&&record.overlay?.visible!==(record.active===true))
        error('unbatched overlay visibility mismatch');
      if(record.active===true){
        for(const old of record.hidden||[])
          if(old.object.visible!==false)error('original procedural mesh still visible');
      }else{
        for(const old of record.hidden||[])
          if(old.object.visible!==old.visible)error('original procedural mesh not restored');
      }
    }
    return report;
  };
})();


/* external-art-field-capture.js */
/* P8-25: manual-only WebGL scene readback for Kenney field A/B.
 * Read synchronously after renderer.render; no timers, telemetry, gameplay writes.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype,MAX_PIXELS=3000000;
  P.captureExternalArtFramebuffer=function(){
    const gl=this.renderer?.getContext?.();
    if(!gl?.readPixels)throw Error('Real WebGL readPixels is unavailable');
    const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    if(!Number.isInteger(width)||!Number.isInteger(height)||
       width<1||height<1||width*height>MAX_PIXELS)
      throw Error('A/B framebuffer exceeds 3 million pixels; reduce the game window size');
    const pixels=new Uint8Array(width*height*4);
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL frame readback error');
    return {width,height,pixels};
  };
  P.compareExternalArtFrames=function(a,b){
    if(!a||!b||a.width!==b.width||a.height!==b.height||
       a.pixels?.length!==a.width*a.height*4||
       b.pixels?.length!==b.width*b.height*4)
      throw Error('ON/OFF framebuffer dimensions differ');
    let changed=0,centerChanged=0,centerCount=0,rgbDiff=0;
    let offMin=765,offMax=0,onMin=765,onMax=0;
    const w=a.width,h=a.height;
    const x0=Math.floor(w*.2),x1=Math.ceil(w*.8),
      y0=Math.floor(h*.2),y1=Math.ceil(h*.8);
    for(let i=0;i<a.pixels.length;i+=4){
      const dr=Math.abs(a.pixels[i]-b.pixels[i]);
      const dg=Math.abs(a.pixels[i+1]-b.pixels[i+1]);
      const db=Math.abs(a.pixels[i+2]-b.pixels[i+2]);
      const difference=Math.max(dr,dg,db)>18;
      if(difference)changed++;
      rgbDiff+=dr+dg+db;
      const offSum=a.pixels[i]+a.pixels[i+1]+a.pixels[i+2];
      const onSum=b.pixels[i]+b.pixels[i+1]+b.pixels[i+2];
      offMin=Math.min(offMin,offSum);offMax=Math.max(offMax,offSum);
      onMin=Math.min(onMin,onSum);onMax=Math.max(onMax,onSum);
      const n=i/4,x=n%w,y=Math.floor(n/w);
      if(x>=x0&&x<x1&&y>=y0&&y<y1){
        centerCount++;
        if(difference)centerChanged++;
      }
    }
    const total=w*h;
    return {
      width:w,height:h,thresholdRgb:18,
      changedPixels:changed,
      changedPercent:Number((100*changed/total).toFixed(3)),
      meanRgbError:Number((rgbDiff/(total*3)).toFixed(4)),
      offContrast:Number(((offMax-offMin)/3).toFixed(4)),
      onContrast:Number(((onMax-onMin)/3).toFixed(4)),
      centerChangedPercent:centerCount?
        Number((100*centerChanged/centerCount).toFixed(3)):0,
      note:'Raw un-postprocessed WebGL framebuffer difference; observational only, not QA approval.'
    };
  };
  P.createExternalArtPairPng=function(a,b){
    if(!a||!b||a.width!==b.width||a.height!==b.height)
      throw Error('A/B screenshot dimensions differ');
    const canvas=document.createElement('canvas');
    canvas.width=a.width*2;canvas.height=a.height;
    const ctx=canvas.getContext?.('2d');
    if(!ctx?.createImageData||!ctx.putImageData||!canvas.toDataURL)
      throw Error('2D canvas PNG export unavailable');
    for(const [frame,offset] of [[a,0],[b,a.width]]){
      const im=ctx.createImageData(frame.width,frame.height),row=frame.width*4;
      for(let y=0;y<frame.height;y++)
        im.data.set(frame.pixels.subarray((frame.height-1-y)*row,(frame.height-y)*row),y*row);
      ctx.putImageData(im,offset,0);
    }
    return canvas.toDataURL('image/png');
  };
  P.getExternalArtFieldEnvironment=function(){
    try{
      const gl=this.renderer.getContext(),
        extension=gl.getExtension?.('WEBGL_debug_renderer_info');
      return {
        viewport:{width:window.innerWidth||null,height:window.innerHeight||null,
          devicePixelRatio:window.devicePixelRatio||1},
        drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},
        glVersion:String(gl.getParameter(gl.VERSION)||'unknown'),
        glVendor:String(gl.getParameter(gl.VENDOR)||'unknown'),
        glRenderer:String(gl.getParameter(gl.RENDERER)||'unknown'),
        unmaskedRenderer:extension?
          String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)||'unavailable'):null,
        note:'Manual local export only; renderer may be software. Not hardware FPS.'
      };
    }catch(error){return {error:String(error?.message||error)};}
  };
})();


/* external-art-field-verdict.js */
/* P8-26: opt-in field A/B integrity fingerprint + conservative triage.
 * This is NOT an automatic visual-release PASS. No game or traffic writes.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const P=TaipeiStreetCourier.prototype;
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const coord=v=>v?[
    v.x??null,v.y??null,v.z??null
  ]:null;
  function brief(record,type,index){
    const obj=record.group;
    return [type,index,record.active===true,
      coord(obj?.position),coord(obj?.rotation),coord(obj?.scale)];
  }
  function hash(input){
    let value=2166136261;
    for(let i=0;i<input.length;i++){
      value^=input.charCodeAt(i);
      value=Math.imul(value,16777619);
    }
    return (value>>>0).toString(16).padStart(8,'0');
  }
  P.getExternalArtFieldInvariant=function(){
    const taxis=this.externalArtOverlays||[];
    const streets=this.externalStreetArtOverlays||[];
    const records=[
      ...taxis.map((x,i)=>brief(x,'taxi',i)),
      ...streets.map((x,i)=>brief(x,x.kind||'street',i))
    ];
    const activeByType={taxi:0,lamp:0,cone:0,barrier:0};
    for(const entry of records)
      if(entry[2])activeByType[entry[0]]=(activeByType[entry[0]]||0)+1;
    const camera=this.camera;
    const state={
      gameState:this.gameState||'unknown',
      car:coord(this.carPos),
      camera:{
        position:coord(camera?.position),rotation:coord(camera?.rotation),
        quaternion:camera?.quaternion?
          [camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w]:null,
        near:camera?.near??null,far:camera?.far??null,
        fov:camera?.fov??null,aspect:camera?.aspect??null,
        projection:camera?.projectionMatrix?.elements?
          Array.from(camera.projectionMatrix.elements):null
      },
      roads:this.segments?.length??null,
      nodes:this.nodes?.length??null,
      obstacles:this.cityObstacles?.length??null,
      solids:this.streetSolids?.length??null,
      traffic:(this.traffic||[]).map(t=>[
        coord(t.group?.position),coord(t.group?.rotation),
        t.speed??null,t.type??null
      ]),
      art:records
    };
    const signature=JSON.stringify(state);
    return {
      signature,
      fingerprint:hash(signature),
      modelsMounted:records.length,
      activeTotal:Object.values(activeByType).reduce((a,b)=>a+b,0),
      activeByType
    };
  };
  P.assessExternalArtFieldComparison=function(context){
    const {initial,offScene,onScene,off,on,pixelDiff}=context||{};
    const problems=[],reviews=[];
    const invalid=(code,message)=>problems.push({code,message});
    const review=(code,message)=>reviews.push({code,message});
    const offB=off?.state||{},onB=on?.state||{};
    if(!initial?.signature||!offScene?.signature||!onScene?.signature)
      invalid('SCENE_MISSING','Cannot verify camera and scene invariants');
    else if(initial.signature!==offScene.signature||
            initial.signature!==onScene.signature)
      invalid('SCENE_DRIFT','Camera, visible model set or traffic/world state changed between passes');
    if(initial?.modelsMounted!==24||initial?.activeTotal<1)
      review('INSUFFICIENT_MODELS',
        'Expected 24 Kenney overlays and at least one active model for useful comparison');
    if(offB.enabled!==false||offB.streetBatches!==0||offB.taxiBatches!==0)
      invalid('OFF_NOT_BASELINE','Source GLB pass still has GPU instance batches');
    if(onB.enabled!==true||onB.streetBatches!==3||onB.taxiBatches!==5)
      invalid('ON_NOT_BATCHED','Batch pass did not activate all 3+5 groups');
    if(off?.audit?.ok!==true||on?.audit?.ok!==true||
       !(on?.audit?.checkedMatrices>0))
      invalid('MATRIX_AUDIT','Kenney source visibility or instanced world matrices failed QA');
    if(!finite(off?.drawCalls)||!finite(on?.drawCalls)||
       !finite(off?.triangles)||!finite(on?.triangles))
      invalid('INVALID_COUNTER','Missing renderer.info counts');
    else{
      if(off.triangles!==on.triangles)
        review('TRIANGLE_COUNT_DIFFERENCE',
          'Frustum culling differs between source meshes and batch; inspect the PNG');
      if(on.drawCalls>=off.drawCalls)
        review('NO_DRAW_SAVINGS','GPU instancing did not reduce renderer draw calls');
    }
    const shape=['width','height','changedPercent','centerChangedPercent',
      'meanRgbError','offContrast','onContrast'];
    if(!pixelDiff||!shape.every(k=>finite(pixelDiff[k]))||
       pixelDiff.width<1||pixelDiff.height<1)
      invalid('PIXEL_CAPTURE_INVALID','No valid WebGL OFF/ON pixel comparison');
    else{
      if(pixelDiff.offContrast<16||pixelDiff.onContrast<16)
        review('FLAT_OR_BLANK_FRAME',
          'One WebGL framebuffer has very low pixel variation; inspect camera and GLB scene');
      if(pixelDiff.changedPercent>4||
         pixelDiff.centerChangedPercent>4||
         pixelDiff.meanRgbError>4)
        review('VISUAL_DIFFERENCE',
          'RGB differences exceed provisional review thresholds; inspect the PNG');
    }
    return {
      status:problems.length?'INVALID':reviews.length?'REVIEW':'CANDIDATE',
      problems,reviews,
      thresholds:{changedPercentMax:4,centerChangedPercentMax:4,
        meanRgbErrorMax:4,minRgbContrast:16},
      scene:{
        original:initial?.fingerprint||null,
        off:offScene?.fingerprint||null,
        on:onScene?.fingerprint||null,
        modelsMounted:initial?.modelsMounted??null,
        activeTotal:initial?.activeTotal??null,
        activeByType:initial?.activeByType||null
      },
      releaseApproved:false,
      note:'CANDIDATE means consistent measurements only; manual PNG review and real-device QA are mandatory.'
    };
  };
})();


/* external-art-field-qa.js */
/* P8-24: opt-in, browser-side Kenney field QA overlay.
 * Only ?externalart=on&artqa=1 over HTTP(S). No extra RAF, polling
 * timers, localStorage, analytics, new assets, colliders or scene edits.
 * Allows a human with working WebGL to capture actual renderer counters.
 */
(function(){
  'use strict';
  if(typeof TaipeiStreetCourier==='undefined')return;
  const enabled=()=>typeof location!=='undefined'&&
    /^https?:$/.test(location.protocol||'')&&
    /(?:^|[?&])externalart=on(?:&|$)/.test(location.search||'')&&
    /(?:^|[?&])artqa=1(?:&|$)/.test(location.search||'');
  if(!enabled())return;
  const P=TaipeiStreetCourier.prototype;
  const MAX_SAMPLES=120;
  const nf=n=>typeof n==='number'&&Number.isFinite(n);
  const fmt=n=>nf(n)?n.toLocaleString('en-US'):'—';
  function snapshot(game){
    const r=game?.renderer,info=r?.info;
    const batches=game?.getExternalArtBatchingState?.()||{};
    const budget=game?.getExternalArtBudget?.()||{};
    return {
      art:game?.externalArtState?.status||'pending',
      street:game?.externalStreetArtState?.status||'pending',
      batchEnabled:!!batches.enabled,
      streetBatches:batches.streetBatches||0,
      taxiBatches:batches.taxiBatches||0,
      modelsMounted:(game?.externalArtOverlays?.length||0)+
        (game?.externalStreetArtOverlays?.length||0),
      modelsVisible:budget.visible??null,
      drawCalls:info?.render?.calls??null,
      triangles:info?.render?.triangles??null,
      geometries:info?.memory?.geometries??null,
      textures:info?.memory?.textures??null,
      urban:game?.getTaipeiUrbanDetailStats?.()||null,
      gameState:game?.gameState||'unknown',
      quality:budget.quality||'unknown'
    };
  }
  function captureRender(game){
    const r=game.renderer;
    if(!r||!game.scene||!game.camera)throw Error('WebGL renderer not ready');
    // Same camera and same JS event turn for ON/OFF. No traffic/physics tick.
    r.info.reset();
    r.render(game.scene,game.camera);
    const audit=game.getExternalArtRenderAudit?.();
    return {
      drawCalls:r.info.render.calls,triangles:r.info.render.triangles,
      geometries:r.info.memory.geometries,textures:r.info.memory.textures,
      state:game.getExternalArtBatchingState?.(),
      audit:audit?{ok:audit.ok,checkedMatrices:audit.checkedMatrices,
        errors:(audit.errors||[]).slice(0,16)}:null,
      frame:game.captureExternalArtFramebuffer()
    };
  }
  function compare(game){
    if(game.externalArtState?.status!=='loaded'||
       game.externalStreetArtState?.status!=='loaded')
      throw Error('Kenney GLB not fully loaded');
    if(typeof game.setExternalArtBatchingEnabled!=='function')
      throw Error('A/B switch unavailable');
    const previous=game.getExternalArtBatchingState?.().enabled===true,
      oldState=game.gameState;
    const report={status:'INCOMPLETE',capturedAt:new Date().toISOString(),
      method:'same camera, same JS turn, raw WebGL scene without post-FX',
      originalBatchEnabled:previous};
    let png=null;
    try{
      game.gameState='PAUSED';
      const initial=game.getExternalArtFieldInvariant?.();
      if(!game.setExternalArtBatchingEnabled(false))
        throw Error('Cannot render source Kenney GLB meshes');
      const off=captureRender(game);
      const offScene=game.getExternalArtFieldInvariant?.();
      if(!game.setExternalArtBatchingEnabled(true))
        throw Error('Cannot render instanced Kenney meshes');
      const on=captureRender(game);
      const onScene=game.getExternalArtFieldInvariant?.();
      // Preserve metadata only. Never put framebuffer bytes into report JSON.
      report.off={...off,frame:undefined};
      report.on={...on,frame:undefined};
      report.pixelDiff=game.compareExternalArtFrames(off.frame,on.frame);
      png=game.createExternalArtPairPng(off.frame,on.frame);
      report.callsSaved=off.drawCalls-on.drawCalls;
      report.equalTriangles=off.triangles===on.triangles;
      report.pngColumns='Left: original GLB OFF; right: InstancedMesh ON';
      const verdict=game.assessExternalArtFieldComparison?.({
        initial,offScene,onScene,off,on,pixelDiff:report.pixelDiff
      });
      if(!verdict)throw Error('Field A/B integrity evaluator unavailable');
      report.status=verdict.status;
      report.integrity=verdict;
      report.releaseApproved=false;
    }catch(error){
      report.status='FAIL';
      report.error=String(error?.message||error);
    }finally{
      let restored=false;
      try{restored=game.setExternalArtBatchingEnabled(previous)===true;}
      catch(_error){}
      if(!restored){
        try{
          game.clearExternalTaxiInstancing?.();
          game.clearExternalArtInstancing?.();
        }catch(_error){}
        report.status='FAIL';
        report.restoreError='Unable to restore batching; original GLB fallback used';
      }
      game.gameState=oldState;
      try{game.renderer?.render(game.scene,game.camera);}catch(_error){}
    }
    return {report,png};
  }
  function make(tag,text,parent){
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;
    if(parent)parent.appendChild(el);
    return el;
  }
  function qa(game){
    const host=make('section',undefined,document.body);
    host.id='external-art-field-qa';
    host.setAttribute('aria-label','Kenney 美術實機驗收');
    host.style.cssText='position:fixed;right:10px;top:72px;z-index:2147480000;'+
      'width:min(310px,calc(100vw - 20px));padding:10px;box-sizing:border-box;'+
      'background:rgba(8,15,28,.91);color:#f0f6fc;border:1px solid #627e92;'+
      'border-radius:9px;box-shadow:0 4px 20px #0008;font:12px/1.45 ui-monospace,monospace;';
    const title=make('div','Kenney 實機 QA · 僅測試模式',host);
    title.style.cssText='font-weight:bold;margin-bottom:4px;';
    const output=make('pre','正在載入 GLB…',host);
    output.style.cssText='white-space:pre-wrap;margin:4px 0 8px;';
    output.setAttribute('role','status');
    const message=make('div','實測只代表目前瀏覽器；CANDIDATE 不等於正式驗收',host);
    message.style.cssText='color:#cfe8aa;min-height:20px;white-space:pre-wrap;';
    const controls=make('div',undefined,host);
    controls.style.cssText='display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;';
    const styleButton=b=>{
      b.type='button';
      b.style.cssText='background:#203b55;color:#fff;border:1px solid #7898ad;'+
        'padding:6px 8px;border-radius:5px;cursor:pointer;font:inherit;';
      return b;
    };
    const on=styleButton(make('button','批次 ON',controls));
    const off=styleButton(make('button','原 GLB',controls));
    const ab=styleButton(make('button','同鏡頭 A/B',controls));
    const pngBtn=styleButton(make('button','下載 A/B PNG',controls));
    const exportBtn=styleButton(make('button','匯出 JSON',controls));
    const collapse=styleButton(make('button','收起',controls));
    const record={version:3,tool:'P8-26 Kenney field integrity QA',
      collectedAt:new Date().toISOString(),samples:[],comparisons:[],
      environment:game.getExternalArtFieldEnvironment?.()||null};
    let lastPng=null;
    pngBtn.disabled=true;
    pngBtn.style.opacity='.45';
    const renderSamples=[];
    function update(current){
      const data=current||snapshot(game);
      const frames=renderSamples.slice().sort((a,b)=>a-b);
      const median=frames.length?frames[Math.floor(frames.length*.5)]:null;
      const p95=frames.length?frames[Math.floor(frames.length*.95)]:null;
      output.textContent=[
        '模型：'+data.art+' / '+data.street,
        'GLB：'+fmt(data.modelsVisible)+' / '+fmt(data.modelsMounted)+' 可見 / 已掛載',
        '批次：'+(data.batchEnabled?'ON':'OFF')+
          ' · 街 '+data.streetBatches+' / 車 '+data.taxiBatches,
        'Calls '+fmt(data.drawCalls)+' · Tri '+fmt(data.triangles),
        'GPU 資源物件：Geo '+fmt(data.geometries)+' / Tex '+fmt(data.textures),
        '台北街景：'+(data.urban?.active?'ON':'OFF')+
          ' · '+fmt(data.urban?.buildings)+' 棟 / '+fmt(data.urban?.scooters)+' 台機車',
        'RAF 間隔：p50 '+(median===null?'—':median.toFixed(1))+
          'ms · p95 '+(p95===null?'—':p95.toFixed(1))+'ms'
      ].join('\n');
      const loaded=data.art==='loaded'&&data.street==='loaded';
      on.disabled=off.disabled=ab.disabled=!loaded;
      for(const btn of [on,off,ab])btn.style.opacity=loaded?'1':'.45';
    }
    function switchBatch(desired){
      const ok=game.setExternalArtBatchingEnabled?.(desired)===true;
      message.textContent=ok?(desired?'批次已啟用':'已切回原 GLB'):
        '切換失敗，請匯出報告查看錯誤';
      update();
    }
    on.addEventListener('click',()=>switchBatch(true));
    off.addEventListener('click',()=>switchBatch(false));
    ab.addEventListener('click',()=>{
      const {report,png}=compare(game);
      lastPng=png;
      pngBtn.disabled=!png;
      pngBtn.style.opacity=png?'1':'.45';
      record.comparisons.push(report);
      if(record.comparisons.length>30)record.comparisons.shift();
      const issue=[...(report.integrity?.problems||[]),
        ...(report.integrity?.reviews||[])][0];
      message.textContent='同鏡頭 A/B '+report.status+
        (nf(report.callsSaved)?' · 節省 '+report.callsSaved+' Calls':'')+
        (nf(report.pixelDiff?.changedPercent)?
          ' · RGB 差異 '+report.pixelDiff.changedPercent+'%':'')+
        (issue?' · '+issue.code:'')+
        (report.error?' · '+report.error:'')+
        (report.status==='CANDIDATE'?' · 仍需人工驗圖':'');
      update();
    });
    pngBtn.addEventListener('click',()=>{
      if(!lastPng)return;
      const anchor=make('a');
      anchor.href=lastPng;
      anchor.download='kenney-ab-left-off-right-on-'+Date.now()+'.png';
      document.body.appendChild(anchor);
      anchor.click();anchor.remove();
      message.textContent='已要求下載 A/B PNG：左原 GLB，右合批';
    });
    exportBtn.addEventListener('click',()=>{
      const report={...record,exportedAt:new Date().toISOString(),
        current:snapshot(game),
        errors:{
          taxi:game.externalTaxiInstancingError||null,
          street:game.externalArtInstancingError||null,
          model:game.externalArtState?.error||null,
          props:game.externalStreetArtState?.error||null
        }};
      const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
      const uri=URL.createObjectURL(blob),link=make('a');
      link.href=uri;link.download='kenney-field-qa-'+Date.now()+'.json';
      document.body.appendChild(link);
      link.click();link.remove();
      // One-off cleanup for a user-triggered download, no polling timer.
      setTimeout(()=>URL.revokeObjectURL(uri),3000);
      message.textContent='JSON 已要求下載，可直接附在對話中分析';
    });
    collapse.addEventListener('click',()=>{
      const hidden=controls.style.display!=='none';
      controls.style.display=hidden?'none':'flex';
      output.style.display=hidden?'none':'block';
      message.style.display=hidden?'none':'block';
      collapse.textContent=hidden?'展開':'收起';
      if(hidden){
        // Move the one expand button to title area so it remains accessible.
        title.appendChild(collapse);
      }else controls.appendChild(collapse);
    });
    return {
      tick(timestamp){
        const s=this;
        if(nf(timestamp)&&nf(s.lastTime)){
          const d=timestamp-s.lastTime;
          if(d>3&&d<250){
            renderSamples.push(d);
            if(renderSamples.length>MAX_SAMPLES)renderSamples.shift();
          }
        }
        s.lastTime=timestamp;
        if(!nf(timestamp)||nf(s.lastPaint)&&timestamp-s.lastPaint<800)return;
        s.lastPaint=timestamp;
        const current=snapshot(game);
        update(current);
        record.samples.push({t:Number((timestamp/1000).toFixed(2)),...current});
        if(record.samples.length>60)record.samples.shift();
      },
      getReport(){return record;}
    };
  }
  const previous=P.loop;
  if(typeof previous==='function'){
    P.loop=function(timestamp,...args){
      // The game's original single RAF loop is retained, not duplicated.
      const output=previous.call(this,timestamp,...args);
      if(!this.renderer||typeof document==='undefined'||!document.body)return output;
      if(!this.externalArtFieldQA){
        try{this.externalArtFieldQA=qa(this);}
        catch(_error){return output;}
      }
      try{this.externalArtFieldQA.tick(timestamp);}catch(_error){}
      return output;
    };
  }
})();

/* Original procedural Taiwanese urban detail; feature branch P8-27 */
/* P8-27: original procedural Taipei streetscape, visual-only and opt-in.
 * Reuses existing streamed NEAR building colliders AS POSITION REFERENCES
 * without changing them, street geometry, traffic AI, physics or routes.
 * No third-party models, brands, text assets, timers or network requests.
 * ?urban=on over HTTP(S), ?urban=off/default preserves original rendering.
 */
(function(){
 'use strict';
 if(typeof TaipeiStreetCourier==='undefined')return;
 const P=TaipeiStreetCourier.prototype;
 const active=game=>typeof location!=='undefined'&&
   /^https?:$/.test(location.protocol||'')&&
   (game.urbanDetailManualEnabled??/(?:^|[?&])urban=on(?:&|$)/.test(location.search||''))===true;
 const maxForQuality={low:12,medium:32,high:56};
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const types=[
  'arcadeBeam','arcadePillar','shop','windowGlass','windowFrame','balcony','ac','tank',
  'roofShed','scooterBody','scooterSeat','scooterWheel','scooterStem'
 ];
 const styles=[
  {name:'西門',color:0x993947,paint:'#9a3d4f',accent:'#fff0d4'},
  {name:'街坊',color:0x627b68,paint:'#4c755c',accent:'#f8e8bb'},
  {name:'茶屋',color:0x8c5a43,paint:'#9b6046',accent:'#f6eddc'},
  {name:'麵食',color:0x466d7b,paint:'#446579',accent:'#e6f4ef'}
 ];

 function chooseFront(b,road){
  const a=Number(b.angle)||0,c=Math.cos(a),s=Math.sin(a);
  const dx=road.x-b.x,dz=road.z-b.z;
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  const frontZ=Math.abs(lz/Math.max(b.d,1))>=Math.abs(lx/Math.max(b.w,1));
  const face=frontZ?a+(lz>=0?0:Math.PI):
    a+(lx>=0?Math.PI/2:-Math.PI/2);
  const d=(frontZ?b.d:b.w)/2+.08;
  return{a:face,x:b.x+Math.sin(face)*d,z:b.z+Math.cos(face)*d,
    width:frontZ?b.w:b.d};
 }
 function placed(f,u,outward,height){
  return{
   x:f.x+Math.cos(f.a)*u+Math.sin(f.a)*outward,
   y:height,
   z:f.z-Math.sin(f.a)*u+Math.cos(f.a)*outward,
   a:f.a
  };
 }
 P.taipeiUrbanDetailEnabled=function(){return active(this);};
 P.setTaipeiUrbanDetailEnabled=function(enable){
  this.urbanDetailManualEnabled=enable===true;
  const result=this.rebuildTaipeiUrbanDetail();
  this.updateTaipeiUrbanDetailPanel?.();
  return result;
 };
 P.ensureTaipeiUrbanDetailPanel=function(){
  if(typeof location==='undefined'||typeof document==='undefined'||!document.body||
    !/(?:^|[?&])urban=(on|off)(?:&|$)/.test(location.search||''))return null;
  if(this.taipeiUrbanPanel)return this.taipeiUrbanPanel;
  const host=document.createElement('section');
  host.id='taipei-urban-detail-panel';
  host.setAttribute('aria-label','台北街景美術試玩狀態');
  host.style.cssText='position:fixed;left:10px;bottom:12px;z-index:99998;'+
   'background:#102736ef;color:#fff;border:1px solid #a2d4d0;'+
   'border-radius:8px;padding:8px 10px;font:12px/1.45 system-ui,sans-serif;'+
   'max-width:min(300px,calc(100vw - 20px));pointer-events:auto';
  const status=document.createElement('div');
  status.setAttribute('role','status');
  const button=document.createElement('button');button.type='button';
  button.style.cssText='margin-top:5px;cursor:pointer;background:#204957;'+
   'color:#fff;border:1px solid #99d5de;border-radius:5px;padding:5px 8px';
  host.appendChild(status);host.appendChild(button);
  document.body.appendChild(host);
  button.addEventListener('click',()=>{
   this.setTaipeiUrbanDetailEnabled(!this.taipeiUrbanDetailEnabled());
  });
  this.taipeiUrbanPanel={host,status,button};
  return this.taipeiUrbanPanel;
 };
 P.updateTaipeiUrbanDetailPanel=function(){
  const panel=this.taipeiUrbanPanel;
  if(!panel)return;
  const st=this.getTaipeiUrbanDetailStats(),on=this.taipeiUrbanDetailEnabled();
  panel.status.textContent=!on?'🏘 街景 OFF · 原始外觀':
   st.active?'🏘 街景 ON · '+st.buildings+' 棟 / '+st.signs+
     ' 招牌 / '+st.scooters+' 機車':
   '🏘 街景 ON · 等待建築串流 · '+(st.nearChunks||0)+' 區塊';
  panel.button.textContent=on?'關閉街景，比較原版':'開啟台北街景';
 };
 P.clearTaipeiUrbanDetail=function(){
  const current=this.taipeiUrbanDetailGroup;
  if(current){
   this.scene?.remove?.(current);
   current.traverse?.(obj=>{
    // InstancedMesh.dispose releases instance GPU buffers, NOT shared source
    // geometry/material/texture; those live for the entire preview session.
    if(obj.isInstancedMesh)try{obj.dispose?.();}catch(_e){}
   });
  }
  this.taipeiUrbanDetailGroup=null;
  this.taipeiUrbanDetailStats={
   active:false,buildings:0,signs:0,scooters:0,
   arcadeColumns:0,meshBatches:0,instances:0,
   nearChunks:0,candidates:0,roadRejected:0,frontageRejected:0
  };
  this.updateTaipeiUrbanDetailPanel?.();
 };
 P.ensureTaipeiUrbanDetailAssets=function(){
  if(this.taipeiUrbanDetailAssets)return this.taipeiUrbanDetailAssets;
  if(typeof THREE?.InstancedMesh!=='function')return null;
  const mat=(name,color,extras={})=>
   new THREE.MeshStandardMaterial({
    name:'Taipei original cosmetic '+name,color,roughness:.86,
    metalness:0,...extras
   });
  const box=new THREE.BoxGeometry(1,1,1);
  const wheel=new THREE.CylinderGeometry(.25,.25,.12,9);
  wheel.rotateZ(Math.PI/2);
  const tank=new THREE.CylinderGeometry(.48,.48,.95,10);
  const materials={
   arcadeBeam:mat('arcade lintel',0xbaa89b),
   arcadePillar:mat('arcade pillar',0xd0b9a6),
   shop:mat('shop glass',0x507482,{roughness:.24,metalness:.08}),
   windowGlass:mat('glazed Taipei window',0x9cc0ca,{roughness:.26,metalness:.10}),
   windowFrame:mat('dark iron grille',0x354850,{roughness:.65,metalness:.3}),
   balcony:mat('balcony railing',0x4f6063,{metalness:.35}),
   ac:mat('air conditioner',0xe1e2db),
   tank:mat('rooftop water tank',0x819ba1,{metalness:.15}),
   roofShed:mat('tin rooftop shed',0x8d9c9b,{metalness:.25}),
   scooterBody:mat('parked scooter paint',0xa63d51,{metalness:.1}),
   scooterSeat:mat('scooter saddle',0x252c33),
   scooterWheel:mat('scooter tire',0x24272a),
   scooterStem:mat('scooter handlebar',0x9da5aa,{metalness:.35})
  };
  const signMaterials=styles.map((s,i)=>{
   const cv=document.createElement('canvas');cv.width=256;cv.height=128;
   const ctx=cv.getContext?.('2d');
   if(ctx){
    ctx.fillStyle=s.paint;ctx.fillRect(0,0,256,128);
    ctx.strokeStyle=s.accent;ctx.lineWidth=8;ctx.strokeRect(9,9,238,110);
    ctx.fillStyle=s.accent;ctx.font='bold 48px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(s.name,128,59,220);
    ctx.font='15px sans-serif';ctx.fillText('TAIPEI · STREET',128,101,230);
   }
   const tex=new THREE.CanvasTexture(cv);
   if('colorSpace' in tex&&THREE.SRGBColorSpace)tex.colorSpace=THREE.SRGBColorSpace;
   return mat('original Taiwanese generic sign '+i,0xffffff,
    {map:tex,emissive:s.color,emissiveIntensity:.11});
  });
  return(this.taipeiUrbanDetailAssets={box,wheel,tank,materials,signMaterials});
 };
 P.rebuildTaipeiUrbanDetail=function(){
  this.ensureTaipeiUrbanDetailPanel?.();
  if(!active(this)){
   this.clearTaipeiUrbanDetail();
   return false;
  }
  const assets=this.ensureTaipeiUrbanDetailAssets();
  if(!assets||!this.scene)return false;
  const quality=this.effectiveGraphicsQuality?.()||'high';
  const limit=maxForQuality[quality]||maxForQuality.high;
  const rows=new Map(types.map(x=>[x,[]]));
  for(let i=0;i<styles.length;i++){rows.set('sign'+i,[]);rows.set('vertical'+i,[]);}
  // Match the actual west-Taipei TITLE/LOADING streaming anchor (not carPos 0,0).
  const title=this.gameState==='TITLE'||this.gameState==='LOADING'||!this.presentationReady;
  const origin=(title?this.getPlayerStartPos?.():this.carPos)||
    this.getPlayerStartPos?.()||this.carPos||{x:0,z:0};
  const selected=[];
  const entries=[...(this.worldChunkRenderEntries?.entries?.()||[])];
  let nearChunks=0;
  entries.sort(([a],[b])=>String(a).localeCompare(String(b)));
  for(const [key,entry] of entries){
   if(entry.tier!=='near')continue;
   nearChunks++;
   for(const b of entry.colliders||[]){
    if(b.kind!=='open-building'||!finite(b.x)||!finite(b.z)||!
      [b.w,b.d,b.height,b.y].every(finite)||
      b.w<3||b.d<1.6||b.height<9||b.height>55)continue;
    selected.push({...b,_key:key});
   }
  }
  selected.sort((a,b)=>{
   const da=(a.x-origin.x)**2+(a.z-origin.z)**2;
   const db=(b.x-origin.x)**2+(b.z-origin.z)**2;
   return da-db||String(a._key).localeCompare(String(b._key))||a.x-b.x||a.z-b.z;
  });
  let buildings=0,signs=0,scooters=0,columns=0,roadRejected=0,frontageRejected=0;
  function push(kind,f,u,out,y,w,h,d){
   const p=placed(f,u,out,y);
   if([p.x,p.y,p.z,w,h,d,p.a].some(n=>!finite(n)||Math.abs(n)>1e6))return;
   rows.get(kind).push({...p,w,h,d});
  }
  // Rejected facades must not exhaust the limited visual building quota.
  for(const b of selected){
   if(buildings>=limit)break;
   let road;
   try{road=this.snapRoad?.({x:b.x,z:b.z});}catch(_e){}
   if(!road||!finite(road.x)||!finite(road.z)||
      Math.hypot(road.x-b.x,road.z-b.z)>42){roadRejected++;continue;}
   const f=chooseFront(b,road),front=Math.min(12,f.width*.84);
   if(front<2.4){frontageRejected++;continue;}
   const seed=Math.floor(Math.abs(b.x*19+b.z*37+b.height*11));
   const style=seed%styles.length,base=b.y;
   // Every painted detail sits on an existing validated building facade
   // (or immediately at its edge). NONE are added to physical solid arrays.
   push('arcadeBeam',f,0,.65,base+3.18,front,.24,1.12);
   // The real Taipei footprints include many narrow 3-4m street houses.
   // Two arcade columns on a narrow face leave the shop glass visible.
   const pillarOffsets=front<4?[-front*.42,front*.42]:
     [-front*.42,0,front*.42];
   for(const u of pillarOffsets){
    push('arcadePillar',f,u,.87,base+1.51,.18,3.03,.18);
    columns++;
   }
   push('shop',f,0,.12,base+1.38,front*.77,2.45,.09);
   push('sign'+style,f,0,.25,base+2.72,Math.min(4.2,front*.68),.58,.15);
   signs++;
   if(seed%3!==0&&b.height>=16){
    const nx=seed%2?front*.3:-front*.3;
    push('vertical'+style,f,nx,.43,base+5.0,.67,2.35,.17);
    signs++;
   }
   const floors=Math.min(6,Math.floor((b.height-4)/3.6));
   for(let floor=0;floor<floors;floor++){
    const y=base+5.2+floor*3.35;
    if(y+1>b.y+b.height)break;
    push('windowGlass',f,front*.07,.145,y+.7,Math.max(.9,front*.38),1.26,.055);
    push('windowFrame',f,front*.07,.205,y+1.39,Math.max(.9,front*.41),.11,.085);
    push('windowFrame',f,front*.07,.205,y+.03,Math.max(.9,front*.41),.11,.085);
    push('balcony',f,0,.28,y,front*.55,.12,.45);
    push('balcony',f,0,.53,y+.39,front*.55,.78,.075);
    if((floor+seed)%2===0)
     push('ac',f,-front*.31,.42,y+.52,.80,.60,.55);
   }
   if(b.height>=15){
    const rooftop={...f,x:b.x,z:b.z,a:0};
    if(seed%3===0)push('tank',rooftop,0,0,base+b.height+.63,1,1,1);
    if(seed%5===0)push('roofShed',rooftop,0,0,base+b.height+.4,2.1,.8,1.6);
   }
   // Tiny, purely visual parked scooters live at existing shopfronts and
   // NEVER participate in the rider/NPC collision or gameplay state.
   if(scooters<24&&front>=3.4&&seed%2===0){
    const q=placed(f,front*.24,.63,base+.44);
    const sample={x:q.x,z:q.z,w:.42,d:1.55,
      angle:f.a,kind:'cosmetic-parked-scooter'};
    let isRoad=true;
    try{isRoad=this.onOrdinaryRoad?.(sample,.2)!==false;}catch(_e){}
    if(!isRoad){
     push('scooterBody',f,front*.24,.63,base+.66,.42,.45,1.42);
     push('scooterSeat',f,front*.24,.63,base+.96,.32,.15,.67);
     push('scooterWheel',f,front*.24,.35,base+.26,.85,1,1);
     push('scooterWheel',f,front*.24,1.12,base+.26,.85,1,1);
     push('scooterStem',f,front*.24,1.02,base+1.04,.12,.72,.12);
     scooters++;
    }
   }
   buildings++;
  }
  const group=new THREE.Group();group.name='P8 Original Taipei Urban Detail (cosmetic only)';
  group.userData.decorativeOnly=true;
  const axis=new THREE.Vector3(0,1,0),mat=new THREE.Matrix4(),
   quat=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();
  let batches=0,instances=0;
  try{
   for(const [kind,items] of rows){
    if(!items.length)continue;
    const sign=kind.startsWith('sign')||kind.startsWith('vertical');
    const style=sign?Number(kind.replace(/[^0-9]/g,''))||0:null;
    const geometry=kind==='tank'?assets.tank:kind==='scooterWheel'?assets.wheel:assets.box;
    const material=sign?assets.signMaterials[style]:assets.materials[kind];
    if(!material||!geometry)throw Error('Missing original Taipei visual asset '+kind);
    const mesh=new THREE.InstancedMesh(geometry,material,items.length);
    mesh.name='P8 Taipei streetscape '+kind;
    mesh.userData.decorativeOnly=true;
    mesh.userData.taipeiUrbanDetail=true;
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
    group.add(mesh);
    items.forEach((o,i)=>{
     pos.set(o.x,o.y,o.z);quat.setFromAxisAngle(axis,o.a);
     scale.set(o.w,o.h,o.d);mat.compose(pos,quat,scale);
     mesh.setMatrixAt(i,mat);
    });
    mesh.instanceMatrix.needsUpdate=true;
    batches++;instances+=items.length;
   }
  }catch(error){
   group.traverse?.(o=>{if(o.isInstancedMesh)try{o.dispose?.();}catch(_e){}});
   this.taipeiUrbanDetailError=String(error?.message||error);
   return false;
  }
  this.clearTaipeiUrbanDetail();
  if(batches){
   this.scene.add(group);
   this.taipeiUrbanDetailGroup=group;
  }
  this.taipeiUrbanDetailStats={active:batches>0,buildings,signs,scooters,
    arcadeColumns:columns,meshBatches:batches,instances,nearChunks,
    candidates:selected.length,roadRejected,frontageRejected,quality};
  this.updateTaipeiUrbanDetailPanel?.();
  return batches>0;
 };
 P.getTaipeiUrbanDetailStats=function(){return this.taipeiUrbanDetailStats||{
   active:false,buildings:0,signs:0,scooters:0,arcadeColumns:0,
   meshBatches:0,instances:0,nearChunks:0,candidates:0,
   roadRejected:0,frontageRejected:0
 };};
 // Streaming owns the NEAR lifecycle. Build/unbuild decorative instances
 // only when the game already rebuilds its streamed detail batches.
 const old=P.rebuildWorldChunkDetailBatches;
 if(typeof old==='function')P.rebuildWorldChunkDetailBatches=function(...args){
  const result=old.apply(this,args);
  try{this.rebuildTaipeiUrbanDetail();}catch(e){
   this.taipeiUrbanDetailError=String(e?.message||e);
   this.clearTaipeiUrbanDetail();
  }
  return result;
 };
})();

