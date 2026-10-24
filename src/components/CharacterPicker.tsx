export type CharacterKind = 'cartoon' | 'robot';
export const CHARACTER_STORAGE_KEY = 'myanmar-town.character';

export function savedCharacter(): CharacterKind {
 try { return localStorage.getItem(CHARACTER_STORAGE_KEY) === 'robot' ? 'robot' : 'cartoon'; }
 catch { return 'cartoon'; }
}

export function CharacterPicker({value,onChange}:{value:CharacterKind;onChange:(kind:CharacterKind)=>void}) {
 return <fieldset className="character-picker">
  <legend>ကစားမည့် Character</legend>
  <div className="character-options">
   <button type="button" aria-pressed={value==='cartoon'} onClick={()=>onChange('cartoon')}>
    <span className="character-swatch character-swatch-cartoon" aria-hidden="true"/>
    <span><strong>Cartoon</strong><small>ခရမ်းရောင် hoodie</small></span>
   </button>
   <button type="button" aria-pressed={value==='robot'} onClick={()=>onChange('robot')}>
    <span className="character-swatch character-swatch-robot" aria-hidden="true"/>
    <span><strong>Robot</strong><small>မူလစက်ရုပ်လေး</small></span>
   </button>
  </div>
  <p>နှစ်မျိုးလုံးကို လက်ရှိနေရာမှာ ပြောင်းလဲရွေးချယ်နိုင်ပါတယ်။</p>
 </fieldset>;
}
