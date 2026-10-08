#!/usr/bin/env python3
"""Offline ODbL map compiler: Overpass JSON -> shared metre-space Unity/Web data.
No synthetic geography is emitted. Closed ways retain their actual outline;
relations are joined by node IDs, with holes retained rather than filled.
"""
import argparse, hashlib, json, math
from pathlib import Path
ORIGIN=(25.0305,121.5375)
BBOX=(25.022,121.525,25.039,121.550)
R=6378137.0
DRIVE={'primary','secondary','tertiary','residential','unclassified','living_street','service','primary_link','secondary_link','tertiary_link'}
PATH={'footway','path','pedestrian','cycleway','steps'}
WIDTH={'primary':14,'secondary':11,'tertiary':8.5,'residential':5.5,'service':3.5,'footway':3,'path':3,'pedestrian':5,'cycleway':3,'steps':2}
def project(lat,lon):
    return {'lat':lat,'lon':lon,'x':round(R*math.radians(lon-ORIGIN[1])*math.cos(math.radians(ORIGIN[0])),3),'z':round(-R*math.radians(lat-ORIGIN[0]),3)}
def contains(ring,p):
    inside=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a['z']>p['z'])!=(b['z']>p['z']) and p['x']<(b['x']-a['x'])*(p['z']-a['z'])/(b['z']-a['z'])+a['x']:inside=not inside
    return inside

def join_rings(parts):
    rings=[];remaining=[list(p) for p in parts if len(p)>1]
    while remaining:
        p=remaining.pop(0)
        while p[0]!=p[-1]:
            match=next((i for i,q in enumerate(remaining) if p[-1] in (q[0],q[-1])),None)
            if match is None:break
            q=remaining.pop(match)
            if q[-1]==p[-1]:q.reverse()
            p.extend(q[1:])
        if p[0]==p[-1] and len(p)>=4:rings.append(p[:-1])
    return rings

def compile_map(raw,source_hash):
    elements=raw['elements'];nodes={e['id']:e for e in elements if e['type']=='node' and 'lat' in e};ways={e['id']:e for e in elements if e['type']=='way'}
    result={'schema':1,'id':'daan-forest-pilot','name':'大安森林公園探索試玩區','bbox':list(BBOX),'projection':{'method':'local-equirectangular','originLat':ORIGIN[0],'originLon':ORIGIN[1],'earthRadius':R,'units':'metres','gameUnitsPerMetre':0.2},'source':{'url':'https://overpass-api.de/api/interpreter','copyright':'© OpenStreetMap contributors','license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','timestamp':raw.get('osm3s',{}).get('timestamp_osm_base','unknown'),'sha256':source_hash},'roads':[],'paths':[],'areas':[],'entrances':[],'pois':[]}
    def points(ids):return [project(nodes[i]['lat'],nodes[i]['lon']) for i in ids if i in nodes]
    def inside(p):return BBOX[0]<=p['lat']<=BBOX[2] and BBOX[1]<=p['lon']<=BBOX[3]
    def area_kind(t):
        if 'building' in t and t['building']!='no':return 'building'
        if t.get('natural')=='water' or t.get('water'):return 'water'
        if t.get('leisure') in ('park','garden','playground','pitch'):return t['leisure']
        return None
    relation_members=set()
    for e in elements:
        t=e.get('tags',{});kind=area_kind(t)
        if e['type']=='relation' and t.get('type')=='multipolygon' and kind:
            outer=join_rings([ways[m['ref']]['nodes'] for m in e['members'] if m['type']=='way' and m.get('role','outer') in ('','outer') and m['ref'] in ways]);inner=join_rings([ways[m['ref']]['nodes'] for m in e['members'] if m['type']=='way' and m.get('role')=='inner' and m['ref'] in ways])
            for i,ring in enumerate(outer):
                pts=points(ring)
                if len(pts)==len(ring) and any(inside(p) for p in pts):result['areas'].append({'id':f"relation/{e['id']}/{i}",'kind':kind,'name':t.get('name',''),'points':pts,'holes':[{'points':points(h)} for h in inner if len(points(h))==len(h) and contains(pts,points(h)[0])],'levels':t.get('building:levels','')})
            relation_members.update(m['ref'] for m in e['members'] if m['type']=='way')
    for e in elements:
        t=e.get('tags',{});sid=f"{e['type']}/{e['id']}"
        if e['type']=='node' and t.get('railway')=='subway_entrance' and inside(e):result['entrances'].append({'id':sid,'name':t.get('name',t.get('ref','捷運入口')),'point':project(e['lat'],e['lon'])})
        if e['type']!='way':continue
        ids=e.get('nodes',[]);pts=points(ids)
        if len(pts)!=len(ids) or len(pts)<2 or not any(inside(p) for p in pts):continue
        highway=t.get('highway')
        if highway in DRIVE|PATH and t.get('access') not in ('private','no') and t.get('tunnel') not in ('yes','building_passage') and t.get('bridge')!='yes' and t.get('layer','0')=='0':
            try:width=float(t.get('width','').split()[0])
            except (ValueError,IndexError):width=WIDTH.get(highway,5)
            result['paths' if highway in PATH else 'roads'].append({'id':sid,'name':t.get('name',''),'kind':highway,'widthMetres':min(40,max(1,width)),'points':pts,'oneway':t.get('oneway')=='yes'})
        kind=area_kind(t)
        if kind and e['id'] not in relation_members and ids[0]==ids[-1] and len(pts)>=4:result['areas'].append({'id':sid,'name':t.get('name',''),'kind':kind,'points':pts[:-1],'holes':[],'levels':t.get('building:levels','')})
    for key in ('roads','paths','areas','entrances'):result[key].sort(key=lambda f:f['id'])
    park=next((a for a in result['areas'] if a['name']=='大安森林公園'),None)
    if park:
        park_paths=[p for line in result['paths'] if line['kind']!='steps' for p in line['points'] if contains(park['points'],p)]
        selected=[('mrt','捷運森林入口','node/3270346882','從捷運入口開始，停穩收集森林郵票。'),('pond','生態池觀察站','relation/1506268/0','沿池畔步道找水鳥；水面不能騎入。'),('play','兒童遊戲區','relation/16771219/0','童趣遊戲區，收下第二枚公園回憶。'),('court','籃球場補給點','way/1227287674','球場旁停穩，替快遞夥伴補充活力。'),('waterfall','環型水瀑','way/556941705','走訪捷運站旁的水瀑，完成森林一圈。')]
        features={f['id']:f for f in result['areas']+result['entrances']}
        for pid,name,fid,description in selected:
            if fid not in features:raise ValueError('Missing verified POI feature '+fid)
            f=features[fid]
            center=f.get('point') or project(sum(p['lat'] for p in f['points'])/len(f['points']),sum(p['lon'] for p in f['points'])/len(f['points']))
            point=min(park_paths,key=lambda p:(p['x']-center['x'])**2+(p['z']-center['z'])**2)
            result['pois'].append({'id':pid,'name':name,'featureId':fid,'description':description,'point':point,'radiusMetres':32,'placement':'game marker on nearest mapped park path, not exact facility centre'})
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('input',type=Path);ap.add_argument('output',type=Path);a=ap.parse_args();content=a.input.read_bytes();
    if a.input.suffix=='.gz':
        import gzip
        content=gzip.decompress(content)
    out=compile_map(json.loads(content),hashlib.sha256(content).hexdigest());a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n');print({k:len(out[k]) for k in ('roads','paths','areas','entrances')})
if __name__=='__main__':main()
