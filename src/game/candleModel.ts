import {BufferGeometry,Float32BufferAttribute,CylinderGeometry,TorusGeometry,SphereGeometry,LatheGeometry,Vector2,Color,MeshStandardMaterial,ShaderMaterial,AdditiveBlending} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function colored(g:BufferGeometry,color:string){
 const c=new Color(color),values=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}
 g.setAttribute('color',new Float32BufferAttribute(values,3));return g;
}
function merge(parts:BufferGeometry[]){const g=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());g.userData.shared=true;return g;}
function ring(radius:number,tube:number,y:number,color:string){return colored(new TorusGeometry(radius,tube,4,24).rotateX(Math.PI/2).translate(0,y,0),color);}
export const CANDLE_WICK_TOP=.235;
export const HOLDER_CANDLE_BASE=.098;
export const HOLDER_CANDLE_SCALE=.52;

// All models have their origin on the supporting surface; the cup is genuinely hollow.
export const candleGeometry=merge([
 colored(new CylinderGeometry(.029,.032,.22,12).translate(0,.11,0),'#fff1cf'),
 ring(.025,.005,.219,'#fff9e9'),
 colored(new CylinderGeometry(.003,.004,.024,6).translate(0,.228,0),'#39231b'),
 ...[-1,0,1].map((n)=>colored(new SphereGeometry(1,6,4).scale(.007,.018+n*.003,.005).translate(Math.sin(n*2)*.030,.193,Math.cos(n*2)*.030),'#fff9e9')),
]);
export const candleHolderGeometry=merge([
 colored(new LatheGeometry([[0,0],[.105,0],[.145,.018],[.20,.06],[.235,.11],[.252,.158],[.25,.168],[.237,.168],[.226,.115],[.19,.068],[.11,.033],[0,.033]].map(p=>new Vector2(...p)),24),'#ffc43a'),
 ring(.243,.012,.14,'#f99b13'),ring(.251,.004,.166,'#fff6da'),
 ring(.17,.004,.038,'#e68b13'),ring(.218,.004,.086,'#f29a16'),
 ...Array.from({length:24},(_,i)=>{const phi=i*Math.PI/12;return colored(new SphereGeometry(.0075,6,4).translate(Math.sin(phi)*.252,.142,Math.cos(phi)*.252),'#fff9dd');}),
]);
export const candlePoolGeometry=merge([colored(new CylinderGeometry(.209,.209,.004,24).translate(0,.096,0),'#6e578c')]);
export const flameGeometry=(()=>{
 const g=new LatheGeometry(Array.from({length:13},(_,i)=>{const t=i/12;return new Vector2(.054*Math.sin(Math.PI*Math.pow(t,.73))*Math.pow(1-t,.35),t*.19);}),12);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){const t=p.getY(i)/.19;p.setX(i,p.getX(i)+.018*t*t*t);}
 g.computeVertexNormals();g.userData.shared=true;return g;
})();
export const candleGlowGeometry=new SphereGeometry(.22,10,8);candleGlowGeometry.userData.shared=true;
export const candleSolidMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.08});candleSolidMaterial.userData.shared=true;

const vertexShader=`
uniform float time;
varying vec3 normalView;
varying vec3 eye;
varying float height;
varying float pulse;
void main(){
 vec3 p=position;
 vec4 origin=vec4(0.,0.,0.,1.);
 #ifdef USE_INSTANCING
 origin=instanceMatrix*origin;
 #endif
 origin=modelMatrix*origin;
 float seed=dot(origin.xz,vec2(1.37,2.71));
 pulse=.92+.09*sin(time*8.+seed)+.04*sin(time*16.+seed*1.9);
 height=clamp(p.y/.19,0.,1.);
 #ifndef HALO
 p.x+=sin(time*3.2+seed)*.014*height*height;
 p.z+=sin(time*4.1+seed*.7)*.009*height*height;
 p.y*=pulse;
 #endif
 vec4 world=vec4(p,1.);
 #ifdef USE_INSTANCING
 world=instanceMatrix*world;
 #endif
 vec4 view=modelViewMatrix*world;
 eye=-view.xyz;normalView=normalMatrix*normal;
 gl_Position=projectionMatrix*view;
}`;
export const candleFlameMaterial=new ShaderMaterial({uniforms:{time:{value:0}},vertexShader,fragmentShader:`
varying vec3 normalView;varying vec3 eye;varying float height;varying float pulse;
void main(){
 vec3 n=normalize(normalView);
 vec3 v=normalize(eye);
 float facing=abs(dot(n,v));
 float core=pow(facing,2.0)*(1.-smoothstep(.06,.85,height));
 vec3 blueBase=vec3(.3,.6,1.8);
 vec3 flameColor=mix(vec3(3.2,1.8,.35),vec3(2.4,.85,.06),smoothstep(.12,.9,height));
 vec3 base=mix(blueBase,flameColor,smoothstep(0.,.16,height));
 vec3 fire=mix(base,vec3(4.2,3.8,2.5),core*.85+.35);
 gl_FragColor=vec4(fire*pulse,1.);
}`,toneMapped:false});
export const candleGlowMaterial=new ShaderMaterial({uniforms:candleFlameMaterial.uniforms,defines:{HALO:1},vertexShader,fragmentShader:`
varying vec3 normalView;varying vec3 eye;varying float pulse;
void main(){
 vec3 n=normalize(normalView);
 vec3 v=normalize(eye);
 float facing=max(0.,dot(n,v));
 float a=(.48*pow(facing,1.6)+.15*facing)*pulse;
 vec3 glow=vec3(2.4,1.25,.32)*a;
 gl_FragColor=vec4(glow,a);
}`,transparent:true,depthWrite:false,blending:AdditiveBlending,toneMapped:false});
candleFlameMaterial.userData.shared=true;candleGlowMaterial.userData.shared=true;
export function animateCandleFlames(time:number){candleFlameMaterial.uniforms.time.value=time;}

