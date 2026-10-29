/** Deterministic, stored UTF-8 ZIPs. Geometry stays in its original STL bytes. */
export interface ZipEntry{name:string;bytes:Uint8Array}
export const PACKAGE_LIMIT=256*1024*1024
const table=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0})
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
export function packZip(entries:ZipEntry[]):ArrayBuffer{
 if(entries.length>65535)throw Error('This package has too many files. Export assemblies separately.')
 const encoder=new TextEncoder(),seen=new Set<string>(),rows=entries.map(e=>{
  if(!e.name||e.name.includes('\\')||e.name.includes('\0')||e.name.startsWith('/')||/^[a-z]:/i.test(e.name)||e.name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('A package filename is unsafe.')
  const key=e.name.toLowerCase();if(seen.has(key))throw Error(`Filename collision: ${e.name}`);seen.add(key)
  const name=encoder.encode(e.name);if(name.length>65535)throw Error('A package filename is too long.')
  return{...e,name,crc:crc32(e.bytes),offset:0}
 })
 const size=rows.reduce((n,r)=>n+76+r.name.length*2+r.bytes.byteLength,22)
 if(size>PACKAGE_LIMIT)throw Error('This package exceeds the current 256 MB ZIP budget. Export smaller selections or assemblies separately.')
 const buffer=new ArrayBuffer(size),bytes=new Uint8Array(buffer),view=new DataView(buffer),u16=(o:number,n:number)=>view.setUint16(o,n,true),u32=(o:number,n:number)=>view.setUint32(o,n,true)
 let pos=0
 for(const r of rows){r.offset=pos;u32(pos,0x04034b50);u16(pos+4,20);u16(pos+6,0x800);u16(pos+12,0x21);u32(pos+14,r.crc);u32(pos+18,r.bytes.length);u32(pos+22,r.bytes.length);u16(pos+26,r.name.length);bytes.set(r.name,pos+30);bytes.set(r.bytes,pos+30+r.name.length);pos+=30+r.name.length+r.bytes.length}
 const central=pos
 for(const r of rows){u32(pos,0x02014b50);u16(pos+4,20);u16(pos+6,20);u16(pos+8,0x800);u16(pos+14,0x21);u32(pos+16,r.crc);u32(pos+20,r.bytes.length);u32(pos+24,r.bytes.length);u16(pos+28,r.name.length);u32(pos+42,r.offset);bytes.set(r.name,pos+46);pos+=46+r.name.length}
 u32(pos,0x06054b50);u16(pos+8,rows.length);u16(pos+10,rows.length);u32(pos+12,pos-central);u32(pos+16,central)
 return buffer
}
