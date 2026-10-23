/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) ၏ 3D နှင့် 2D Map Plan Components စုစည်းမှု။
 *
 * ကျေးရွာအသစ် ထပ်ထည့်သည့်အခါ `src/components/villages/<village-name>/index.tsx` ဆောက်၍
 * အောက်ပါ `<KalayVillages />` နှင့် `<KalayVillagesPlan />` တို့တွင် ထည့်သွင်းနိုင်ပါသည်။
 */
export function KalayVillages(){
 return <group name="kalay-villages">
  {/* ကျေးရွာ 3D component များကို ဤနေရာတွင် ထည့်သွင်းပါ */}
 </group>;
}

export function KalayVillagesPlan(_props:{labels:boolean}){
 return <g id="kalay-villages-plan">
  {/* ကျေးရွာ 2D Map Plan SVG component များကို ဤနေရာတွင် ထည့်သွင်းပါ */}
 </g>;
}

