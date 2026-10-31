import * as THREE from 'three'
import {SoftwareRenderer} from './SoftwareRenderer'

export interface StudioRenderer {
 readonly domElement:HTMLCanvasElement
 readonly mode:'webgl'|'software'
 localClippingEnabled:boolean
 setPixelRatio(ratio:number):void
 setSize(width:number,height:number):void
 setScissor(x:number,y:number,width:number,height:number):void
 setScissorTest(enabled:boolean):void
 clear():void
 render(scene:THREE.Scene,camera:THREE.Camera):void
 dispose():void
}

export function createStudioRenderer(alpha=false):StudioRenderer {
 for(const antialias of [true,false]){
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha,antialias})
  try{
   // Safari's virtual graphics driver can return a context that is already
   // lost. Passing that object to Three crashes its precision initialization.
   if(!gl||gl.isContextLost()||!gl.getParameter(gl.VERSION)||!gl.getShaderPrecisionFormat(gl.VERTEX_SHADER,gl.HIGH_FLOAT))continue
   const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha,antialias}),dispose=renderer.dispose.bind(renderer)
   renderer.domElement.dataset.renderer='webgl'
   renderer.dispose=()=>{dispose();renderer.forceContextLoss()}
   return Object.assign(renderer,{mode:'webgl'as const})
  }catch{/* Try a fresh context without multisampling before using software. */}
  finally{if(gl&&!canvas.dataset.renderer)gl.getExtension('WEBGL_lose_context')?.loseContext()}
 }
 return new SoftwareRenderer()
}
