import {Scene,Color,PerspectiveCamera,WebGLRenderer,WebGLRenderTarget,Group,Mesh,PlaneGeometry,MeshBasicMaterial,AmbientLight,Vector3} from 'three';
import {decorateFestivalRegion} from '../../src/game/festivalCandles';
import {candleGeometry,candleHolderGeometry,candlePoolGeometry,candleSolidMaterial,flameGeometry,candleGlowGeometry,candleFlameMaterial,candleGlowMaterial,animateCandleFlames,CANDLE_WICK_TOP,HOLDER_CANDLE_BASE,HOLDER_CANDLE_SCALE} from '../../src/game/candleModel';
const renderer=new WebGLRenderer({logarithmicDepthBuffer:true,antialias:false});renderer.setSize(256,256);document.body.appendChild(renderer.domElement);
const scene=new Scene();scene.background=new Color('#101820');scene.add(new AmbientLight('#ffffff',2));
const ground=new Mesh(new PlaneGeometry(10000,10000),new MeshBasicMaterial({color:'#30363a'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
const target=new WebGLRenderTarget(256,256),before=new Uint8Array(256*256*4),after=new Uint8Array(before.length),camera=new PerspectiveCamera(45,1,.01,9000);
animateCandleFlames(3,256);
const samples:{kind:string;view:string;litPixels:number}[]=[];
for(const kind of ['individual','instanced']){
 const model=new Group();scene.add(model);
 if(kind==='instanced'){const anchor=new Group();anchor.userData={dynamic:true,festivalCandles:[{x:0,y:0,z:0,holder:true}]};model.add(anchor);decorateFestivalRegion(model);}
 else{
  model.add(new Mesh(candleHolderGeometry,candleSolidMaterial),new Mesh(candlePoolGeometry,candleSolidMaterial));
  const wax=new Mesh(candleGeometry,candleSolidMaterial);wax.position.y=HOLDER_CANDLE_BASE;wax.scale.y=HOLDER_CANDLE_SCALE;model.add(wax);
  const flame=new Mesh(flameGeometry,candleFlameMaterial);flame.name='festival-flames';flame.position.y=HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE;model.add(flame);
  const glow=new Mesh(candleGlowGeometry,candleGlowMaterial);glow.name='festival-glows';glow.position.y=flame.position.y+.065;glow.frustumCulled=false;model.add(glow);
 }
 const lights:Mesh[]=[];model.traverse(o=>{if(o instanceof Mesh&&(o.name==='festival-flames'||o.name==='festival-glows'))lights.push(o);});
 for(const [view,position] of Object.entries({front:[0,1,2],back:[0,1,-2],left:[-2,1,0],right:[2,1,0],overhead:[0,3,.001],aerial:[0,1200,.001]})){
  camera.position.fromArray(position);camera.lookAt(new Vector3(0,.28,0));renderer.setRenderTarget(target);
  lights.forEach(m=>m.visible=false);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,256,before);
  lights.forEach(m=>m.visible=true);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,256,256,after);
  let litPixels=0;for(let i=0;i<after.length;i+=4)if(after[i]-before[i]>35&&after[i+1]>=before[i+1])litPixels++;
  samples.push({kind,view,litPixels});
 }
 model.removeFromParent();
}
renderer.setRenderTarget(null);renderer.render(scene,camera);
(window as any).candleAnglesResult={samples,passed:samples.every(s=>s.litPixels>=3)};
document.body.append(JSON.stringify((window as any).candleAnglesResult));target.dispose();
