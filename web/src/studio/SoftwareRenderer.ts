import * as THREE from 'three'

// Display only: rasterize the existing Three scene, never change its STL or
// geometry. A depth buffer preserves holes, overlapping parts and cutaways.
type Vertex=number[] // clip xyzw, world xyz, linear rgb, uv, world normal xyz
type Paint=THREE.MeshStandardMaterial&{isMeshBasicMaterial?:boolean;isLineBasicMaterial?:boolean}
type Pass={scene:THREE.Scene;camera:THREE.Camera;clip:number[]|null}
const srgb=new Uint8Array(4097),linear=new Float32Array(256)
for(let i=0;i<srgb.length;i++){const c=i/4096;srgb[i]=Math.round(255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055))}
for(let i=0;i<256;i++){const c=i/255;linear[i]=c<=.04045?c/12.92:((c+.055)/1.055)**2.4}
const byte=(c:number)=>srgb[Math.max(0,Math.min(4096,Math.round(c*4096)))]
const mix=(a:Vertex,b:Vertex,t:number)=>a.map((v,i)=>v+(b[i]-v)*t)
function clipPolygon(vertices:Vertex[],distance:(v:Vertex)=>number){
 const result:Vertex[]=[];let a=vertices.at(-1)!,da=distance(a)
 for(const b of vertices){const db=distance(b);if((da>=0)!==(db>=0))result.push(mix(a,b,da/(da-db)));if(db>=0)result.push(b);a=b;da=db}
 return result
}

export class SoftwareRenderer {
 readonly mode='software'
 readonly domElement=document.createElement('canvas')
 localClippingEnabled=true
 private context:CanvasRenderingContext2D
 private pixels=new Uint8ClampedArray(0)
 private depth=new Float32Array(0)
 private passes:Pass[]=[]
 private clip:number[]|null=null
 private scissor=false
 private queued=false
 private disposed=false
 private previous=''
 private frames=0
 private textures=new WeakMap<THREE.Texture,{data:Uint8ClampedArray;width:number;height:number}|null>()
 constructor(){
  const context=this.domElement.getContext('2d');if(!context)throw Error('Canvas rendering is unavailable')
  this.context=context;this.domElement.dataset.renderer=this.mode;this.setSize(this.domElement.width,this.domElement.height)
 }
 setPixelRatio(_ratio:number){} // Software uses CSS-pixel resolution on Retina.
 setSize(width:number,height:number){
  const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height))
  if(this.domElement.width!==w||this.domElement.height!==h||this.pixels.length!==w*h*4){this.domElement.width=w;this.domElement.height=h;this.pixels=new Uint8ClampedArray(w*h*4);this.depth=new Float32Array(w*h);this.previous=''}
  this.domElement.style.width=width+'px';this.domElement.style.height=height+'px'
 }
 setScissor(x:number,y:number,width:number,height:number){this.clip=[x,y,width,height]}
 setScissorTest(enabled:boolean){this.scissor=enabled}
 clear(){this.passes=[]}
 render(scene:THREE.Scene,camera:THREE.Camera){
  if(this.disposed)return
  this.passes.push({scene,camera,clip:this.scissor&&this.clip?[...this.clip]:null})
  // Comparison views render two scissored scenes in one animation callback.
  // Flush together and avoid continuously rerasterizing an unchanged view.
  if(!this.queued){this.queued=true;queueMicrotask(()=>this.flush())}
 }
 private signature(pass:Pass){
  const {scene,camera}=pass;scene.updateMatrixWorld();camera.updateMatrixWorld()
  const key:any[]=[scene.uuid,camera.matrixWorldInverse.elements.join(),camera.projectionMatrix.elements.join(),pass.clip?.join(),(scene.background as THREE.Color)?.getHex?.()]
  scene.traverseVisible(object=>{
   const mesh=object as THREE.Mesh;if(!mesh.geometry)return
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
   const position=mesh.geometry.getAttribute('position');key.push(mesh.geometry.id,position&&('version'in position?position.version:position.data.version),object.matrixWorld.elements.join())
   for(const m of materials){const p=m as Paint;key.push(p.id,p.version,p.visible,p.opacity,p.color?.getHex(),p.wireframe,p.flatShading,p.vertexColors,p.map?.version,...(p.clippingPlanes??[]).map(v=>[v.normal.x,v.normal.y,v.normal.z,v.constant].join()))}
  })
  return key.join('|')
 }
 private flush(){
  this.queued=false;if(this.disposed)return
  const passes=this.passes;this.passes=[]
  const key=this.domElement.width+'x'+this.domElement.height+passes.map(p=>this.signature(p)).join(';')
  if(key===this.previous)return
  for(const pass of passes)this.drawPass(pass)
  this.context.putImageData(new ImageData(this.pixels,this.domElement.width,this.domElement.height),0,0)
  this.previous=key;this.domElement.dataset.renderFrame=String(++this.frames)
 }
 private rectangle(clip:number[]|null){
  const w=this.domElement.width,h=this.domElement.height
  return clip?[Math.max(0,Math.round(clip[0])),Math.max(0,Math.round(h-clip[1]-clip[3])),Math.min(w,Math.round(clip[0]+clip[2])),Math.min(h,Math.round(h-clip[1]))]:[0,0,w,h]
 }
 private drawPass({scene,camera,clip}:Pass){
  const rect=this.rectangle(clip),w=this.domElement.width,background=scene.background instanceof THREE.Color?scene.background:null
  for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++){
   const i=y*w+x,j=i*4;this.depth[i]=Infinity;this.pixels[j]=background?byte(background.r):0;this.pixels[j+1]=background?byte(background.g):0;this.pixels[j+2]=background?byte(background.b):0;this.pixels[j+3]=background?255:0
  }
  const lights:THREE.Light[]=[],objects:THREE.Object3D[]=[]
  scene.traverseVisible(object=>{if((object as THREE.Light).isLight)lights.push(object as THREE.Light);if((object as THREE.Mesh).isMesh||(object as THREE.Line).isLine)objects.push(object)})
  // All current viewer solids are opaque; transparent layout guides follow.
  objects.sort((a,b)=>Number(!!((a as THREE.Mesh).material as THREE.Material).transparent)-Number(!!((b as THREE.Mesh).material as THREE.Material).transparent)||a.renderOrder-b.renderOrder)
  for(const object of objects)this.drawObject(object,camera,lights,rect)
 }
 private drawObject(object:THREE.Object3D,camera:THREE.Camera,lights:THREE.Light[],rect:number[]){
  const mesh=object as THREE.Mesh,geometry=mesh.geometry,pos=geometry.getAttribute('position');if(!pos)return
  const normal=geometry.getAttribute('normal'),colour=geometry.getAttribute('color'),uv=geometry.getAttribute('uv')
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),normalMatrix=new THREE.Matrix3().getNormalMatrix(object.matrixWorld)
  const world=new THREE.Vector3(),n=new THREE.Vector3(),point=new THREE.Vector4(),vertices:Vertex[]=[]
  for(let i=0;i<pos.count;i++){
   world.fromBufferAttribute(pos,i).applyMatrix4(object.matrixWorld);point.set(world.x,world.y,world.z,1).applyMatrix4(projection)
   n.set(normal?.getX(i)??0,normal?.getY(i)??0,normal?.getZ(i)??1).applyMatrix3(normalMatrix).normalize()
   vertices.push([point.x,point.y,point.z,point.w,world.x,world.y,world.z,colour?.getX(i)??1,colour?.getY(i)??1,colour?.getZ(i)??1,uv?.getX(i)??0,uv?.getY(i)??0,n.x,n.y,n.z])
  }
  const index=geometry.index,count=index?.count??pos.count,isLine=(object as THREE.Line).isLine,stride=isLine?((object as THREE.LineSegments).isLineSegments?2:1):3
  const get=(i:number)=>vertices[index?index.getX(i):i]
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
  const start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count)
  const loop=(object as THREE.LineLoop).isLineLoop
  for(let i=start;i+(isLine?1:2)<end+(loop?1:0);i+=stride){
   const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count),material=materials[group?.materialIndex??0]as Paint
   if(!material?.visible)continue
   const a=get(i),b=get(loop&&i+1===end?start:i+1),c=isLine?b:get(i+2),face=new THREE.Vector3().subVectors(new THREE.Vector3(b[4],b[5],b[6]),new THREE.Vector3(a[4],a[5],a[6])).cross(new THREE.Vector3(c[4]-a[4],c[5]-a[5],c[6]-a[6])).normalize()
   const shade=(v:Vertex)=>{
    const value=[...v],rgb=[material.color?.r??1,material.color?.g??1,material.color?.b??1]
    if(material.vertexColors)for(let k=0;k<3;k++)rgb[k]*=v[7+k]
    if(!material.isMeshBasicMaterial&&!isLine){
     const direction=material.flatShading?face:new THREE.Vector3(v[12],v[13],v[14]),light=[0,0,0]
     const eye=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).sub(new THREE.Vector3(v[4],v[5],v[6]));if(material.side===THREE.DoubleSide&&direction.dot(eye)<0)direction.negate()
     for(const source of lights){
      const color=source.color,intensity=source.intensity*.32
      if((source as THREE.HemisphereLight).isHemisphereLight){const hemi=source as THREE.HemisphereLight,t=direction.dot(source.position.clone().normalize())*.5+.5;for(let k=0;k<3;k++){const channel=['r','g','b'][k]as'r'|'g'|'b';light[k]+=intensity*(hemi.groundColor[channel]*(1-t)+color[channel]*t)}}
      else{const factor=(source as THREE.DirectionalLight).isDirectionalLight?Math.max(0,direction.dot(source.position.clone().normalize())):1;light[0]+=color.r*intensity*factor;light[1]+=color.g*intensity*factor;light[2]+=color.b*intensity*factor}
     }
     for(let k=0;k<3;k++)rgb[k]*=light[k]
    }
    value.splice(7,3,...rgb);return value
   }
   const polygon=[shade(a),shade(b),shade(c)],planes=(material.clippingPlanes??[]).map(p=>(v:Vertex)=>v[4]*p.normal.x+v[5]*p.normal.y+v[6]*p.normal.z+p.constant)
   planes.push(v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2])
   if(isLine||material.wireframe){
    const pairs=isLine?[[polygon[0],polygon[1]]]:[[polygon[0],polygon[1]],[polygon[1],polygon[2]],[polygon[2],polygon[0]]]
    for(let [x,y]of pairs){let visible=true;for(const distance of planes){const dx=distance(x),dy=distance(y);if(dx<0&&dy<0){visible=false;break}if((dx>=0)!==(dy>=0)){const p=mix(x,y,dx/(dx-dy));if(dx<0)x=p;else y=p}}if(visible)this.line(x,y,material,rect)}
   }else{
    let clipped=polygon;for(const distance of planes){clipped=clipPolygon(clipped,distance);if(!clipped.length)break}
    for(let j=1;j+1<clipped.length;j++)this.triangle(clipped[0],clipped[j],clipped[j+1],material,rect)
   }
  }
 }
 private screen(v:Vertex){return [(v[0]/v[3]+1)*this.domElement.width/2,(1-v[1]/v[3])*this.domElement.height/2,v[2]/v[3]]}
 private pixel(x:number,y:number,z:number,r:number,g:number,b:number,alpha:number,material:Paint){
  const i=y*this.domElement.width+x,j=i*4;if(alpha<=0||material.depthTest&&z>this.depth[i]+1e-6)return
  const a=Math.max(0,Math.min(1,alpha)),old=this.pixels[j+3]/255,total=a+old*(1-a)
  this.pixels[j]=(byte(r)*a+this.pixels[j]*old*(1-a))/total;this.pixels[j+1]=(byte(g)*a+this.pixels[j+1]*old*(1-a))/total;this.pixels[j+2]=(byte(b)*a+this.pixels[j+2]*old*(1-a))/total;this.pixels[j+3]=total*255
  if(material.depthWrite)this.depth[i]=z
 }
 private texture(map:THREE.Texture){
  if(this.textures.has(map))return this.textures.get(map)
  const image=map.image as HTMLImageElement,canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height
  const context=canvas.getContext('2d');let texture=null
  if(context&&canvas.width&&canvas.height){context.drawImage(image,0,0);texture={data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height}}
  this.textures.set(map,texture);return texture
 }
 private triangle(a:Vertex,b:Vertex,c:Vertex,material:Paint,rect:number[]){
  const A=this.screen(a),B=this.screen(b),C=this.screen(c),area=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])
  if(Math.abs(area)<1e-9||material.side===THREE.FrontSide&&area>=0||material.side===THREE.BackSide&&area<0)return
  const texture=material.map?this.texture(material.map):null
  const x0=Math.max(rect[0],Math.floor(Math.min(A[0],B[0],C[0]))),x1=Math.min(rect[2]-1,Math.ceil(Math.max(A[0],B[0],C[0]))),y0=Math.max(rect[1],Math.floor(Math.min(A[1],B[1],C[1]))),y1=Math.min(rect[3]-1,Math.ceil(Math.max(A[1],B[1],C[1])))
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5,u=((B[0]-px)*(C[1]-py)-(B[1]-py)*(C[0]-px))/area,v=((C[0]-px)*(A[1]-py)-(C[1]-py)*(A[0]-px))/area,w=1-u-v
   if(u< -1e-8||v< -1e-8||w< -1e-8)continue
   const z=u*A[2]+v*B[2]+w*C[2],q=u/a[3]+v/b[3]+w/c[3],U=u/a[3]/q,V=v/b[3]/q,W=w/c[3]/q
   let r=U*a[7]+V*b[7]+W*c[7],g=U*a[8]+V*b[8]+W*c[8],blue=U*a[9]+V*b[9]+W*c[9],alpha=material.opacity
   if(texture){const tu=U*a[10]+V*b[10]+W*c[10],tv=U*a[11]+V*b[11]+W*c[11],tx=Math.max(0,Math.min(texture.width-1,Math.floor(tu*texture.width))),ty=Math.max(0,Math.min(texture.height-1,Math.floor((material.map!.flipY?1-tv:tv)*texture.height))),j=(ty*texture.width+tx)*4;r*=linear[texture.data[j]];g*=linear[texture.data[j+1]];blue*=linear[texture.data[j+2]];alpha*=texture.data[j+3]/255}
   if(alpha<material.alphaTest)continue
   this.pixel(x,y,z,r,g,blue,alpha,material)
  }
 }
 private line(a:Vertex,b:Vertex,material:Paint,rect:number[]){
  const A=this.screen(a),B=this.screen(b),steps=Math.max(1,Math.ceil(Math.max(Math.abs(B[0]-A[0]),Math.abs(B[1]-A[1]))))
  for(let i=0;i<=steps;i++){const t=i/steps,x=Math.round(A[0]+(B[0]-A[0])*t),y=Math.round(A[1]+(B[1]-A[1])*t);if(x<rect[0]||x>=rect[2]||y<rect[1]||y>=rect[3])continue;this.pixel(x,y,A[2]+(B[2]-A[2])*t,a[7]+(b[7]-a[7])*t,a[8]+(b[8]-a[8])*t,a[9]+(b[9]-a[9])*t,material.opacity,material)}
 }
 dispose(){this.disposed=true;this.passes=[];this.pixels=new Uint8ClampedArray(0);this.depth=new Float32Array(0);this.domElement.width=this.domElement.height=1}
}
