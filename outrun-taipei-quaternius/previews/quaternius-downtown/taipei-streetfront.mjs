// P7: data-only Taipei-inspired facade accents for the ISOLATED Quaternius preview.
// Fictional signage; these descriptors are render-engine agnostic for later Unity use.
// Coordinates are facade-local (metres in the preview), never map coordinates.

export const TAIPEI_STREETFRONT_PRESETS = Object.freeze({
  mixed: Object.freeze({
    label: '騎樓店住混合',
    sign: '巷口食堂',
    subtitle: '家常料理・TAIPEI',
    vertical: '食堂',
    signBg: '#983e3e',
    signText: '#fff0d5',
    accent: '#e9bb70',
    awning: '#b54c47',
    awningAlt: '#e5d2ac',
    plaster: '#aaa99b',
    railing: '#4f6171',
    condenser: '#c7d2d4'
  }),
  metal: Object.freeze({
    label: '都會轉角茶舖',
    sign: '街角茶舖',
    subtitle: '每日現泡・TEA',
    vertical: '茶舖',
    signBg: '#245b56',
    signText: '#edf5df',
    accent: '#d7cc89',
    awning: '#397c73',
    awningAlt: '#b9c7b4',
    plaster: '#b7c2be',
    railing: '#455e69',
    condenser: '#bec9d0'
  }),
  brick: Object.freeze({
    label: '磚造生活街屋',
    sign: '日常雜貨',
    subtitle: '街坊選物・GOODS',
    vertical: '雜貨',
    signBg: '#364867',
    signText: '#fff2d4',
    accent: '#d6a776',
    awning: '#a85b40',
    awningAlt: '#d9b790',
    plaster: '#bcb0a2',
    railing: '#5a504d',
    condenser: '#c2c9c7'
  })
});

const item=(role,scale,position,material)=>Object.freeze({
  role,scale:Object.freeze(scale),position:Object.freeze(position),material
});

export function buildTaipeiStreetfrontPlan(style) {
  const palette=TAIPEI_STREETFRONT_PRESETS[style];
  if(!palette)throw new RangeError('Unknown facade preset: '+style);
  const near=[];
  const far=[];
  // Recessed sheltered sidewalk and corner columns make an arcade-like edge,
  // while leaving the existing Quaternius storefront and door geometry intact.
  near.push(item('arcade-canopy',[10.1,.14,1.6],[0,2.57,.83],'plaster'));
  far.push(item('arcade-canopy',[10.1,.14,1.6],[0,2.57,.83],'plaster'));
  for(const x of [-4.82,4.82]){
    near.push(item('arcade-column',[.25,2.48,.25],[x,1.24,1.37],'plaster'));
    far.push(item('arcade-column',[.25,2.48,.25],[x,1.24,1.37],'plaster'));
  }
  for(let i=0;i<9;i++){
    const x=-4.24+i*1.06;
    near.push(item('awning-top',[1.02,.045,1.12],[x,2.675,1.05],i%2?'awningAlt':'awning'));
    near.push(item('awning-valance',[1.02,.17,.065],[x,2.515,1.65],i%2?'awningAlt':'awning'));
  }
  near.push(item('sign-backboard',[8.1,.72,.16],[0,3.01,1.72],'signBg'));
  far.push(item('sign-silhouette',[8.1,.72,.16],[0,3.01,1.72],'signBg'));
  near.push(item('vertical-sign-backboard',[.78,1.94,.15],[-4.38,4.76,1.10],'signBg'));
  far.push(item('vertical-sign-silhouette',[.78,1.94,.15],[-4.38,4.76,1.10],'signBg'));
  near.push(item('sign-light-strip',[8.18,.07,.10],[0,2.63,1.82],'accentGlow'));
  // Modest upper-floor balcony/metal bars.
  for(const bayX of [-3,3]){
    near.push(item('balcony-sill',[3.24,.15,.5],[bayX,3.2,.25],'plaster'));
    near.push(item('balcony-top-rail',[3.06,.065,.075],[bayX,3.73,.49],'railing'));
    near.push(item('balcony-bottom-rail',[3.06,.065,.075],[bayX,3.33,.49],'railing'));
    for(let i=0;i<6;i++){
      const x=bayX-1.4+i*.56;
      near.push(item('balcony-vertical',[.042,.42,.065],[x,3.53,.49],'railing'));
    }
    far.push(item('balcony-silhouette',[3.1,.12,.46],[bayX,3.27,.25],'railing'));
  }
  // Outdoor AC condenser and heat-exchanger grille, not a branded prop.
  near.push(item('aircon-bracket',[1.1,.09,.68],[3.97,4.75,.38],'railing'));
  near.push(item('aircon-case',[1.13,.86,.58],[3.97,5.22,.39],'condenser'));
  near.push(item('aircon-face',[.91,.67,.03],[3.97,5.22,.70],'railing'));
  for(let i=0;i<4;i++){
    near.push(item('aircon-vent',[.70,.028,.035],[3.97,5.02+i*.11,.74],'condenser'));
  }
  far.push(item('aircon-silhouette',[1.13,.86,.58],[3.97,5.22,.39],'condenser'));
  near.push(item('rain-pipe',[.09,3.0,.09],[4.90,4.68,.16],'railing'));
  near.push(item('rain-elbow',[.42,.085,.09],[4.72,3.19,.16],'railing'));
  // These are pure declarative placements. No direct scene/gameplay access.
  return Object.freeze({
    style,palette,
    nearBoxes:Object.freeze(near),
    farBoxes:Object.freeze(far),
    signs:Object.freeze([
      Object.freeze({id:'main',text:palette.sign,subtitle:palette.subtitle,size:Object.freeze([7.68,.58]),position:Object.freeze([0,3.02,1.825])}),
      Object.freeze({id:'vertical',text:palette.vertical,subtitle:'',size:Object.freeze([.67,1.79]),position:Object.freeze([-4.38,4.76,1.19])})
    ])
  });
}
