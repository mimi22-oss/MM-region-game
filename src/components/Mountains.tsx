import { ward } from '../data/ward';

/** Overlapping low-poly ridges beyond the western paddy fields. */
export function Mountains(){return <>{[...ward.mountains,...ward.weipula.peaks].map((m,i)=><group key={m.id} position={[m.x,0,m.z]} rotation={[0,i*0.7,0]}>
 <mesh position={[0,m.height/2-1,0]} castShadow receiveShadow><coneGeometry args={[m.radius,m.height,7,1]}/><meshStandardMaterial color={m.color} flatShading roughness={1}/></mesh>
 <mesh position={[m.radius*0.3,m.height*0.23,-m.radius*0.1]} castShadow receiveShadow><coneGeometry args={[m.radius*0.7,m.height*0.46,6,1]}/><meshStandardMaterial color="#536d55" flatShading roughness={1}/></mesh>
 </group>)}</>}
export function WesternLandscapePlan(){return <>
 {[...ward.westernFields,...ward.southernFields].map(f=><rect key={f.id} x={f.x-f.width/2} y={f.z-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke="#c1b57f" strokeWidth="1" transform={`rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})`}/>)}
 {[...ward.mountains,...ward.weipula.peaks].map(m=><g key={m.id}><circle cx={m.x} cy={m.z} r={m.radius} fill={m.color} stroke="#506752"/><path d={`M ${m.x-20} ${m.z+15} L ${m.x} ${m.z-22} L ${m.x+20} ${m.z+15} Z`} fill="#b1bbb0"/></g>)}
 <text x={ward.taungphila.label.x} y={ward.taungphila.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">{ward.taungphila.name}</text>
 <text x={ward.weipula.label.x} y={ward.weipula.label.z} textAnchor="middle" fontSize="26" fill="#f3edcb" stroke="#304b4b" strokeWidth="0.6">{ward.weipula.name}</text>
 </>}
