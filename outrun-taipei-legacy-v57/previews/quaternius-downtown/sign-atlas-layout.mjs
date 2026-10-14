// P9 deterministic layout for one shared 1024x1024 Chinese storefront atlas.
// Pure JS for Node unit tests and optional future Unity-compatible manifests.
export const SIGN_ATLAS=Object.freeze({
 width:1024,height:1024,count:7,
 main:Object.freeze({x:0,y:0,width:1024,height:100,strideY:100}),
 vertical:Object.freeze({x:0,y:704,width:112,height:312,strideX:112}),
 inset:5
});
export function atlasCell(index,kind){
 if(!Number.isInteger(index)||index<0||index>=SIGN_ATLAS.count)
  throw new RangeError('Sign index must be 0-6');
 if(kind!=='main'&&kind!=='vertical')throw new RangeError('Invalid sign type');
 const r=SIGN_ATLAS[kind];
 const x=r.x+(r.strideX||0)*index;
 const y=r.y+(r.strideY||0)*index;
 if(x+r.width>SIGN_ATLAS.width||y+r.height>SIGN_ATLAS.height)
  throw new RangeError('Atlas cell exceeds texture bounds');
 return Object.freeze({index,kind,x,y,width:r.width,height:r.height});
}
export function atlasUV(index,kind,inset=SIGN_ATLAS.inset){
 const cell=atlasCell(index,kind);
 if(!Number.isFinite(inset)||inset<0||inset*2>=Math.min(cell.width,cell.height))
  throw new RangeError('Invalid atlas inset');
 const u0=(cell.x+inset)/SIGN_ATLAS.width;
 const u1=(cell.x+cell.width-inset)/SIGN_ATLAS.width;
 const v0=1-(cell.y+cell.height-inset)/SIGN_ATLAS.height;
 const v1=1-(cell.y+inset)/SIGN_ATLAS.height;
 return Object.freeze({u0,u1,v0,v1});
}
export function describeSignAtlas(shopCount){
 if(!Number.isInteger(shopCount)||shopCount<1||shopCount>7)
  throw new RangeError('Shop count out of range');
 const oldPixels=shopCount*(1024*192+192*512);
 const newPixels=SIGN_ATLAS.width*SIGN_ATLAS.height;
 return Object.freeze({
  atlasTextures:1,legacyTextures:2*shopCount,shopCount,
  oldRGBA8Bytes:oldPixels*4,newRGBA8Bytes:newPixels*4,
  newTextureRGBA8KiB:(newPixels*4)/1024,
  note:'Only theoretical uncompressed RGBA8 base level; excludes mipmaps, driver alignment, GLTF textures'
 });
}
