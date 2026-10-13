// Independent facade preview LOD policy. No game route/physics dependencies.
// Hysteresis: switch to proxy at >= 28 units, restore modules at <= 23 units.
export function decideFacadeLod({mode='auto',distance,previous='near',enterFar=28,exitFar=23} = {}) {
  if(!['auto','near','far'].includes(mode)) throw new RangeError('Invalid LOD mode');
  if(!Number.isFinite(distance)||distance<0) throw new RangeError('Invalid camera distance');
  if(!(Number.isFinite(enterFar)&&Number.isFinite(exitFar)&&exitFar>=0&&enterFar>exitFar))
    throw new RangeError('Invalid LOD hysteresis thresholds');
  if(mode!=='auto') return mode;
  if(previous==='far') return distance<=exitFar?'near':'far';
  return distance>=enterFar?'far':'near';
}
export const FACADE_LOD_THRESHOLDS=Object.freeze({enterFar:28,exitFar:23});
