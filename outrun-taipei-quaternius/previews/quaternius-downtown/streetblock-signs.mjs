// P9 one CanvasTexture and one geometry/material per building for TWO signs.
// This module is used by the isolated art preview only, not the Taipei game.
import {SIGN_ATLAS,atlasCell,atlasUV,describeSignAtlas} from './sign-atlas-layout.mjs';

export function createStreetblockSigns(THREE,samples,buildFacadePlan){
 if(!Array.isArray(samples)||samples.length!==SIGN_ATLAS.count)
  throw new RangeError('P9 sign atlas requires the seven preview shop samples');
 const fontFamily='"Microsoft JhengHei","Noto Sans TC","PingFang TC",system-ui,sans-serif';
 let shared=null;
 function paintCell(ctx,item,index,kind){
  const cell=atlasCell(index,kind);
  const palette=buildFacadePlan(item.style).palette;
  const isVertical=kind==='vertical';
  ctx.save();
  ctx.beginPath();
  ctx.rect(cell.x,cell.y,cell.width,cell.height);
  ctx.clip();
  ctx.clearRect(cell.x,cell.y,cell.width,cell.height);
  ctx.fillStyle=palette.signText;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='rgba(13,20,28,.60)';
  ctx.lineJoin='round';
  ctx.lineWidth=3;
  ctx.shadowColor='rgba(255,226,156,.38)';
  ctx.shadowBlur=6;
  if(isVertical){
   const characters=Array.from(item.name).slice(-2);
   const y0=cell.y+cell.height/2-characters.length*110/2+55;
   ctx.font='700 68px '+fontFamily;
   characters.forEach((char,j)=>{
    const x=cell.x+cell.width/2,y=y0+j*110;
    ctx.strokeText(char,x,y,cell.width-16);
    ctx.fillText(char,x,y,cell.width-16);
   });
  }else{
   let size=70;
   const usable=cell.width-80;
   do{ctx.font='700 '+size+'px '+fontFamily;if(ctx.measureText(item.name).width<=usable)break;size-=3;}
   while(size>42);
   const x=cell.x+cell.width/2,y=cell.y+40;
   ctx.strokeText(item.name,x,y,usable);
   ctx.fillText(item.name,x,y,usable);
   ctx.shadowBlur=0;
   ctx.lineWidth=0;
   ctx.font='500 18px '+fontFamily;
   ctx.fillText('台北街屋・風格示範',x,cell.y+80,usable);
  }
  ctx.restore();
 }
 function getShared(){
  if(shared)return shared;
  const canvas=document.createElement('canvas');
  canvas.width=SIGN_ATLAS.width;canvas.height=SIGN_ATLAS.height;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)throw new Error('Cannot draw Traditional Chinese sign atlas');
  for(let i=0;i<samples.length;i++){
   paintCell(ctx,samples[i],i,'main');
   paintCell(ctx,samples[i],i,'vertical');
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.encoding=THREE.sRGBEncoding;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  const material=new THREE.MeshBasicMaterial({
   map:texture,transparent:true,side:THREE.DoubleSide,
   depthWrite:false,toneMapped:false
  });
  shared={canvas,texture,material,metrics:describeSignAtlas(samples.length)};
  return shared;
 }
 function makeShopSign(building,descriptors){
  const atlas=getShared();
  const index=samples.findIndex(s=>s.id===building.id);
  if(index<0)throw new RangeError('Shop not found in atlas: '+building.id);
  if(descriptors.length!==2)throw new RangeError('Expect two preview shop signs');
  const positions=[],uvs=[],indices=[];
  for(const d of descriptors){
   const {u0,u1,v0,v1}=atlasUV(index,d.id);
   const [x,y,z]=d.position,[width,height]=d.size;
   const offset=positions.length/3;
   positions.push(x-width/2,y-height/2,z, x+width/2,y-height/2,z,
    x+width/2,y+height/2,z, x-width/2,y+height/2,z);
   uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
   indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,atlas.material);
  mesh.name='P9_AtlasMergedChineseSigns';
  mesh.frustumCulled=false;
  return mesh;
 }
 return Object.freeze({makeShopSign,atlasMetrics:()=>getShared().metrics});
}
