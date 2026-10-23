import { ward } from '../data/ward';
import { Road, type RoadData } from './Road';
export function MainRoad({roads=ward.roads}:{roads?:RoadData[]}){return <>{roads.filter(r=>r.main).map(r=><Road key={r.id} r={r}/>)}</>}
