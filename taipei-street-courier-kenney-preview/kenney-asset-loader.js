/* Playable Kenney preview — strict source SHA256, pinned CC0 GLBs. */
(function(){
 'use strict';
 const pin="08f0c913f6783cc81f9f6105a7cdda8562b1c192";
 const expected=[{"id":"kenney-construction-cone","path":"packs/city-kit-roads/construction-cone.glb","sha256":"a67f87e58615dd7ebbe485e7e985a5af9bd145e3619a9908dcbbeb7e43c8321a"},{"id":"kenney-construction-barrier","path":"packs/city-kit-roads/construction-barrier.glb","sha256":"498a6dda82a1fdecd0fb7b27cace5ee7c06367cac62f833bba5ae4399505982f"},{"id":"kenney-light-square","path":"packs/city-kit-roads/light-square.glb","sha256":"f167dff6392ec4ea186b8d3e5e3cb55aa5279af6a710ff3ce9f690f226234e17"},{"id":"kenney-taxi","path":"packs/car-kit/taxi.glb","sha256":"c0ead3df92617dbca425e522003e80777cffc5f8987f664abab1363ff786704c"}];
 const records=new Map(expected.map(r=>[r.id,r]));
 const pending=new Map();
 const bases=[
  'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@'+pin+'/',
  'https://raw.githubusercontent.com/Hidencod/tge-assets/'+pin+'/'
 ];
 async function verified(r){
  if(!globalThis.crypto?.subtle)throw Error('SHA-256 WebCrypto unavailable');
  const failures=[];
  for(const prefix of bases){
   try{
    const response=await fetch(prefix+r.path,{mode:'cors',cache:'force-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
    if(hex!==r.sha256)throw Error('Pinned model checksum mismatch');
    return bytes;
   }catch(error){failures.push(new URL(prefix).hostname+': '+String(error?.message||error));}
  }
  throw Error('Kenney '+r.id+' unavailable: '+failures.join(' / '));
 }
 globalThis.__kenneyPreviewLoadGLB=async id=>{
  const entry=records.get(id);
  if(!entry)throw Error('Unlisted Kenney GLB '+id);
  if(typeof THREE?.GLTFLoader!=='function')throw Error('THREE.GLTFLoader unavailable');
  if(!pending.has(id))pending.set(id,(async()=>{
   const buffer=await verified(entry);
   return new THREE.GLTFLoader().parseAsync(buffer,'');
  })());
  return pending.get(id);
 };
 globalThis.__kenneyPreviewInfo=Object.freeze({
  pinnedModelCommit:pin,ids:expected.map(x=>x.id),
  validatesSourceSha256:true,sourceLicense:'Kenney CC0-1.0'
 });
})();