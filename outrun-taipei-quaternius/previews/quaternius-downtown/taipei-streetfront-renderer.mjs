// P7 isolated Taipei-inspired facade accents. No source-game or map imports.
import {buildTaipeiStreetfrontPlan} from './taipei-streetfront.mjs';

// Factory dependencies permit later reuse in a Unity facade builder from the data plan.
// The browser preview renders the plan with the existing Three.js r149.
export function createTaipeiStreetfrontArtist(THREE,placeBox) {
  const materialCache=new Map();
  const signCache=new Map();
  const signPlane=new THREE.PlaneGeometry(1,1);
  let night=false;

  function materialsFor(palette,style){
    if(materialCache.has(style))return materialCache.get(style);
    const make=(color,metalness=0,roughness=.82)=>new THREE.MeshStandardMaterial({
      color,metalness,roughness
    });
    const mats={
      plaster:make(palette.plaster,0,.87),
      awning:make(palette.awning,0,.74),
      awningAlt:make(palette.awningAlt,0,.76),
      railing:make(palette.railing,.47,.46),
      condenser:make(palette.condenser,.18,.68),
      signBg:make(palette.signBg,.08,.60),
      accentGlow:new THREE.MeshStandardMaterial({
        color:palette.accent,emissive:palette.accent,
        emissiveIntensity:night?1.35:.15,metalness:0,roughness:.42
      })
    };
    materialCache.set(style,mats);
    return mats;
  }

  function textureFor(style,info,palette){
    const key=style+':'+info.id;
    if(signCache.has(key))return signCache.get(key);
    const vertical=info.id==='vertical';
    const c=document.createElement('canvas');
    c.width=vertical?192:768;
    c.height=vertical?512:160;
    const ctx=c.getContext('2d');
    if(!ctx)throw new Error('2D canvas unavailable for Traditional Chinese signage');
    ctx.clearRect(0,0,c.width,c.height);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle=palette.signText;
    ctx.shadowColor='rgba(255,209,137,.35)';
    ctx.shadowBlur=7;
    if(vertical){
      ctx.font='700 74px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
      const letters=[...info.text];
      const height=Math.min(110,(c.height-95)/Math.max(1,letters.length));
      const start=(c.height-(letters.length-1)*height)/2;
      letters.forEach((letter,i)=>ctx.fillText(letter,c.width/2,start+i*height));
    }else{
      ctx.font='700 78px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
      ctx.fillText(info.text,c.width/2,68,c.width-44);
      ctx.shadowBlur=0;
      ctx.font='500 29px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
      ctx.fillText(info.subtitle,c.width/2,132,c.width-52);
    }
    const texture=new THREE.CanvasTexture(c);
    texture.encoding=THREE.sRGBEncoding;
    texture.anisotropy=1;
    const mat=new THREE.MeshBasicMaterial({
      map:texture,transparent:true,side:THREE.DoubleSide,
      depthWrite:false,toneMapped:false
    });
    signCache.set(key,mat);
    return mat;
  }

  function attach(style,near,far){
    const plan=buildTaipeiStreetfrontPlan(style);
    const mats=materialsFor(plan.palette,style);
    for(const b of plan.nearBoxes)placeBox(near,b.scale,b.position,mats[b.material]);
    for(const b of plan.farBoxes)placeBox(far,b.scale,b.position,mats[b.material]);
    for(const info of plan.signs){
      const text=new THREE.Mesh(signPlane,textureFor(style,info,plan.palette));
      text.name='P7_OriginalTraditionalChineseSign_'+info.id;
      text.scale.set(info.size[0],info.size[1],1);
      text.position.set(...info.position);
      near.add(text);
    }
    return {
      profileLabel:plan.palette.label,
      shopLabel:plan.palette.sign,
      nearObjects:plan.nearBoxes.length+plan.signs.length,
      nearTriangles:plan.nearBoxes.length*12+plan.signs.length*2,
      farObjects:plan.farBoxes.length,
      farTriangles:plan.farBoxes.length*12
    };
  }

  function setNight(value){
    night=!!value;
    for(const m of materialCache.values())m.accentGlow.emissiveIntensity=night?1.35:.15;
  }

  return Object.freeze({attach,setNight});
}
