import { ward } from '../data/ward';
import { Road, type RoadData } from './Road';
export function Lane({r}:{r:RoadData}){return <Road r={r}/>}
export function Lanes({roads=ward.roads}:{roads?:RoadData[]}){return <>{roads.filter(r=>!r.main).map(r=><Lane key={r.id} r={r}/>)}</>}
