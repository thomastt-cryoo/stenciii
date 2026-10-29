import * as THREE from 'three'
/** Display-only clustering; exports and validation always use the original STL. */
export function reducedDisplay(src:THREE.BufferGeometry){
 const pos=src.getAttribute('position'),box=src.boundingBox!,size=box.getSize(new THREE.Vector3()),cell=Math.max(size.x,size.y,size.z)/150||1
 const map=new Map<string,number>(),sums:number[][]=[],counts:number[]=[],ids=new Uint32Array(pos.count)
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),key=`${Math.floor((x-box.min.x)/cell)},${Math.floor((y-box.min.y)/cell)},${Math.floor((z-box.min.z)/cell)}`
  let id=map.get(key);if(id===undefined){id=sums.length;map.set(key,id);sums.push([0,0,0]);counts.push(0)}
  ids[i]=id;counts[id]++;sums[id][0]+=x;sums[id][1]+=y;sums[id][2]+=z
 }
 sums.forEach((p,i)=>p.forEach((v,j)=>p[j]=v/counts[i]))
 const out:number[]=[]
 for(let i=0;i+2<ids.length;i+=3){const a=ids[i],b=ids[i+1],c=ids[i+2];if(a!==b&&b!==c&&a!==c)out.push(...sums[a],...sums[b],...sums[c])}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.computeVertexNormals();g.computeBoundingBox();return g
}
