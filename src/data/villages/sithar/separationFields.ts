import type {FieldPlot} from '../../types.ts';
import {toWorld} from './sitharData.ts';
const colors=['#8ca65c','#a6af68','#7e9c55','#96a85d','#86a257'];
function row(prefix:string,v:number,depth:number,west:number[]):FieldPlot[]{
 return [...west,24,50,76,102,128].map((u,i)=>({id:`${prefix}-${i}`,row:0,u,v,...toWorld(u,v),width:22,depth,rotation:Math.PI/4,color:colors[i%colors.length]}));
}
/** Ten plots in each village gap, five on either side of the continuous AH1. */
export const kyarInnSiTharSeparationFields=row('kyarinn-sithar-sep-field',4027.5,8,[-234,-208,-182,-156,-130]);
export const siTharNatMyaungSeparationFields=row('sithar-natmyaung-sep-field',4095,14,[-210,-184,-76,-50,-24]);
export const siTharLeftSeparationFields:FieldPlot[]=[];
export const siTharRightSeparationFields:FieldPlot[]=[];
export const siTharSeparationFields=[...kyarInnSiTharSeparationFields,...siTharNatMyaungSeparationFields];
