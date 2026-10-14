// P13: dependency-free ZIP STORE writer for user's browser evidence only.
// ZIP spec: local file records, central directory, EOCD. No ZIP64/compression.
const encoder=new TextEncoder();
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){
 let c=n;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
 t[n]=c>>>0;
}return t})();
export function crc32(bytes){
 if(!(bytes instanceof Uint8Array))throw new TypeError('CRC32 needs Uint8Array');
 let crc=0xffffffff;
 for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
const put16=(view,offset,n)=>view.setUint16(offset,n,true);
const put32=(view,offset,n)=>view.setUint32(offset,n>>>0,true);
export function makeEvidenceZip(files){
 if(!Array.isArray(files)||files.length<1||files.length>128)
  throw new RangeError('Expected 1..128 evidence files');
 const written=new Set(),locals=[],central=[];
 let offset=0,centralSize=0;
 for(const input of files){
  const name=input?.name,data=input?.data;
  if(typeof name!=='string'||name.length<1||name.length>240||
    name.includes('\\')||name.startsWith('/')||name.includes('..')||
    /[\x00-\x1f]/.test(name)||written.has(name))throw new RangeError('Unsafe/duplicate ZIP name');
  if(!(data instanceof Uint8Array)||data.byteLength>0x7fffffff)
   throw new TypeError('ZIP file must be a Uint8Array <=2GiB');
  written.add(name);
  const label=encoder.encode(name);
  if(label.length>65535)throw new RangeError('ZIP name too long');
  const crc=crc32(data);
  const local=new Uint8Array(30+label.length),lh=new DataView(local.buffer);
  put32(lh,0,0x04034b50);put16(lh,4,20);put16(lh,6,0x0800);
  put16(lh,8,0);put16(lh,10,0);put16(lh,12,0x0021);
  put32(lh,14,crc);put32(lh,18,data.length);put32(lh,22,data.length);
  put16(lh,26,label.length);put16(lh,28,0);local.set(label,30);
  locals.push(local,data);
  const c=new Uint8Array(46+label.length),ch=new DataView(c.buffer);
  put32(ch,0,0x02014b50);put16(ch,4,20);put16(ch,6,20);
  put16(ch,8,0x0800);put16(ch,10,0);put16(ch,12,0);
  put16(ch,14,0x0021);put32(ch,16,crc);
  put32(ch,20,data.length);put32(ch,24,data.length);
  put16(ch,28,label.length);put16(ch,30,0);put16(ch,32,0);
  put16(ch,34,0);put16(ch,36,0);put32(ch,38,0);
  put32(ch,42,offset);c.set(label,46);central.push(c);
  offset+=local.length+data.length;centralSize+=c.length;
  if(offset>=0xffffffff||centralSize>=0xffffffff)throw new RangeError('ZIP64 required; evidence bundle too large');
 }
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 put32(ev,0,0x06054b50);put16(ev,4,0);put16(ev,6,0);
 put16(ev,8,files.length);put16(ev,10,files.length);
 put32(ev,12,centralSize);put32(ev,16,offset);put16(ev,20,0);
 const chunks=[...locals,...central,end];
 const output=new Uint8Array(offset+centralSize+end.length);
 let cursor=0;for(const chunk of chunks){output.set(chunk,cursor);cursor+=chunk.length;}
 if(cursor!==output.length)throw new Error('ZIP byte accounting mismatch');
 return output;
}
