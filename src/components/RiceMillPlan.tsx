import { ward } from '../data/ward';
export function RiceMillPlan({labels}:{labels:boolean}){const m=ward.riceMill;return <>
 {[m.yard,...m.paths,...m.fields].map((p,i)=><g key={i} transform={`translate(${p.x} ${p.z}) rotate(${-p.rotation*180/Math.PI})`}><rect x={-p.width/2} y={-p.depth/2} width={p.width} height={p.depth} fill={i>2?'#79935b':'#c6b996'} stroke={i>2?'#b4aa76':'none'}/>{labels&&(i===0||i>2)&&<text textAnchor="middle" fontSize="4">{i===0?'ကွင်းပြင်':'လယ်ကွင်း'}</text>}</g>)}
 {m.buildings.map(b=><g key={b.id} transform={`translate(${b.x} ${b.z}) rotate(${-b.rotation*180/Math.PI})`}><rect x={-b.width/2} y={-b.depth/2} width={b.width} height={b.depth} fill={b.roof} stroke="#e2d0a5"/><line y1={-b.depth/2} y2={b.depth/2} stroke="#857251"/>{labels&&<text textAnchor="middle" fontSize="4">{b.name}</text>}</g>)}
 </>}
