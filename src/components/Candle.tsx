import {useFrame} from '@react-three/fiber';
import {candleGeometry,candleHolderGeometry,candlePoolGeometry,flameGeometry,candleGlowGeometry,candleSolidMaterial,candleHolderLitMaterial,candlePoolLitMaterial,CANDLE_LIGHT_COLOR,candleFlameMaterial,candleGlowMaterial,CANDLE_WICK_TOP,HOLDER_CANDLE_BASE,HOLDER_CANDLE_SCALE,animateCandleFlames} from '../game/candleModel';
type Position=[number,number,number];
type Props={position?:Position;scale?:number};
export function CandleFlame({position=[0,0,0],scale=1}:{position?:Position;scale?:number}){
 return <group position={position} scale={scale} dispose={null}><mesh geometry={flameGeometry} material={candleFlameMaterial}/><mesh position={[0,.065,0]} geometry={candleGlowGeometry} material={candleGlowMaterial} frustumCulled={false}/></group>;
}
/** Reusable bare wax candle for narrow fence rails. */
export function Candle({position=[0,0,0],scale=1,lit=true}:{lit?:boolean}&Props){
 return <group name="candle" position={position} scale={scale} dispose={null}>
  <mesh geometry={candleGeometry} material={candleSolidMaterial}/>
  {lit&&<>
   <CandleFlame position={[0,CANDLE_WICK_TOP,0]}/>
   <pointLight position={[0,CANDLE_WICK_TOP+.1,0]} color={CANDLE_LIGHT_COLOR} intensity={2.8} distance={8} decay={1.8}/>
  </>}
 </group>;
}
/** Empty ornamental cup, independent of wax and flame. */
export function CandleHolder({position=[0,0,0],scale=1,lit=false}:Props&{lit?:boolean}){
 return <group name="candle-holder" position={position} scale={scale} dispose={null}><mesh geometry={candleHolderGeometry} material={lit?candleHolderLitMaterial:candleSolidMaterial}/></group>;
}
/** A short candle in a purple wax pool, inside the gold cup from candle.png. */
export function CandleInHolder({position=[0,0,0],scale=1,lit=true,hasLight=true,flameScale=1.4}:{lit?:boolean;hasLight?:boolean;flameScale?:number}&Props){
 return <group name="candle-in-holder" position={position} scale={scale} dispose={null}>
  <CandleHolder lit={lit}/>
  <mesh geometry={candlePoolGeometry} material={lit?candlePoolLitMaterial:candleSolidMaterial}/>
  <mesh position={[0,HOLDER_CANDLE_BASE,0]} scale={[1.1,HOLDER_CANDLE_SCALE,1.1]} geometry={candleGeometry} material={candleSolidMaterial}/>
  {lit&&<>
   <CandleFlame position={[0,HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE,0]} scale={flameScale}/>
   {hasLight&&<pointLight position={[0,HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE+.14,0]} color={CANDLE_LIGHT_COLOR} intensity={3.8} distance={11} decay={1.7}/>}
  </>}
 </group>;
}

/** Mount one clock per Canvas; all candle instances share its GPU animation. */
export function CandleAnimation(){useFrame(({clock,gl,size})=>animateCandleFlames(clock.elapsedTime,size.height*gl.getPixelRatio()));return null;}
