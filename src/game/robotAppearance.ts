export type RobotPalette={shell:string;accent:string;panel:string;rubber:string;trim:string};
export const playerPalette:RobotPalette={shell:'#b5f3e5',accent:'#ff9b3e',panel:'#291d36',rubber:'#44404f',trim:'#a7e7dc'};
/** Each bot gets a deterministic palette and size; cyan/mint hues are excluded. */
export function botAppearance(index:number){
 const band=(index*137.508)%255,hue=band<105?band:band+95;
 const accent=(hue+55)%360;
 return {palette:{shell:`hsl(${hue.toFixed(3)}, 72%, 48%)`,accent:`hsl(${accent.toFixed(3)}, 85%, 62%)`,panel:`hsl(${hue.toFixed(3)}, 48%, 12%)`,rubber:'#252733',trim:`hsl(${hue.toFixed(3)}, 62%, 32%)`},size:0.66+(index*37%97)/220};
}
