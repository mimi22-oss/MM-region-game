/** Fractional life is drawn as a clipped heart, including the 1.5-life car penalty. */
export function LifeMeter({lives}:{lives:number}){
 const value=Math.max(0,Math.min(3,lives));
 return <span className="life-meter" role="img" aria-label={`Life ${value} / 3`}>
  {[0,1,2].map(i=><span key={i} className="life-heart" aria-hidden="true"><span>♥</span><span className="life-heart-fill" style={{width:`${Math.max(0,Math.min(1,value-i))*100}%`}}>♥</span></span>)}
 </span>;
}
