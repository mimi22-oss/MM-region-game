# မြို့သာရပ်ကွက် · ကလေးမြို့ — 3D Prototype

ပေးထားသော Google Maps screenshots ကို မျက်မြင်မှီငြမ်းထားသည့် React + TypeScript + React Three Fiber prototype ဖြစ်ပါတယ်။ AH1 လမ်းမကြီး၊ လမ်းသွယ်များ၊ အိမ် ၂၁ လုံး၊ လမ်းမဘေး သစ်ပင် ၆၄ ပင်၊ ဂိုဒေါင် ၈ လုံး၊ ဘောလုံးကွင်းနှင့် လယ်ကွင်း ၂ ကွက် ပါဝင်ပါတယ်။ မြေပြင်သည် 700 × 700 m၊ မြောက်ဘက်သည် -Z ဖြစ်ပါတယ်။ အိမ်နေရာ၊ အရွယ်၊ အမြင့်နှင့် လမ်းအကွာအဝေးများကို ခန့်မှန်းထားပြီး မြေတိုင်းမြေပုံ သို့မဟုတ် တိကျသော GIS reconstruction မဟုတ်ပါ။ External map API သို့မဟုတ် API key မလိုပါ။


House.tsx — ရိုးရိုးအိမ်များ
Farmhouse.tsx — စိုက်ခင်းအိမ်၊ စိုက်ခင်းနဲ့ကန်
Lane.tsx — လမ်းသွယ်
MainRoad.tsx — မိန်းလမ်းမကြီး
Tree.tsx — သစ်ပင်များ
Canal.tsx — ရေမြောင်း၊ တံတားနဲ့ရေစီးလှုပ်ရှားမှု
Field.tsx — လယ်ကွင်းများ
wards/myothar/Area5.tsx — မြို့သာရပ်ကွက် · နယ်မြေ (၅) 3D နှင့် 2D မြေပုံ component
wards/myothar/Warehouses.tsx — နယ်မြေ (၅) ဂိုဒေါင် ၈ လုံး
wards/myothar/FootballPitch.tsx — နယ်မြေ (၅) ဘောလုံးကွင်း
wards/myothar/index.tsx — မြို့သာရပ်ကွက် (နယ်မြေများ စုစည်းမှု) component
wards/index.tsx — ကလေးမြို့ရှိ ရပ်ကွက်ပေါင်း ၂၀ ကျော်ကို ရပ်ကွက်အလိုက် စုစည်းသည့် component
villages/tharsi/index.tsx — သာစည်ရွာ (Thar Si Village) 3D နှင့် 2D မြေပုံ component
villages/index.tsx — ကလေးမြို့နယ်ရှိ ကျေးရွာများ (Villages) ကို ရွာအလိုက် စုစည်းသည့် component

## Run

Node.js 22.18+ နှင့် npm လိုပါတယ်။ ဒီ folder ထဲ terminal ဖွင့်ပြီး:

```sh
npm install
npm run dev
```

ပြထားသော URL (ပုံမှန် http://127.0.0.1:5173) ကို desktop browser မှာ ဖွင့်ပါ။ index.html ကို double click ဖြင့် မဖွင့်ပါနှင့်။

## Controls

- Scene click: mouse control စတင်ရန်
- WASD: လမ်းလျှောက်၊ Shift: ပြေး
- Mouse: ပတ်ကြည့်၊ V: first/third person ပြောင်း
- R: AH1 ပေါ် မူလနေရာသို့ပြန်၊ Esc: mouse လွှတ်

လမ်း၊ အိမ်၊ လယ်ကွင်းနှင့် minimap တို့သည် တူညီသော ward data ကို သုံးပါတယ်။ Rotated house footprint၊ ဝရန်တာ၊ သစ်ပင်နှင့် နယ်နိမိတ် collision ပါပါတယ်။ အိမ်အတွင်းဝင်ခြင်း၊ jump၊ mobile controls၊ real map import၊ editor နှင့် multiplayer မပါသေးပါ။

## ပြင်ဆင်ရန်

- `src/data/ward.ts`: လမ်း၊ အိမ်၊ သစ်ပင်၊ လယ်ကွင်း၊ spawn။ `toWorld(u,v)` သည် AH1 နှင့်တန်းညီသော coordinate ကို world X/Z သို့ပြောင်းပါတယ်။
- `src/components/Town.tsx`: 3D အဆောက်အအုံနှင့် မြေပြင်
- `src/components/Player.tsx`: movement / camera
- `src/game/collision.ts`: rotated footprint collision
- `src/main.tsx`: HUD / minimap

## စစ်ဆေးရန်

```sh
npm test
npm run build
npm run preview
```

Manual check: Scene click → WASD → Shift → V → အိမ်/သစ်ပင်/နယ်နိမိတ် → Esc → click → R။ WebGL နှင့် hardware acceleration လိုပါတယ်။

## နောက်ဆုံး မြေပုံဖွဲ့စည်းပုံ

AH1 ၏ နှစ်ဖက်တွင် သစ်ပင်တန်း၊ ထို့နောက် ဂိုဒေါင်တန်း ရှိပါတယ်။ Screenshot ၏ ဘယ်ဘက် (AH1 local u အနုတ်ဘက်) တွင် ရပ်ကွက်နှင့် လမ်းသွယ်များ၊ ညာဘက်တွင် ဘောလုံးကွင်း ရှိပါတယ်။ ကွင်းမှာ လျှောက်ဝင်နိုင်ပြီး football gameplay မပါသေးပါ။ ဂိုဒေါင်အတွင်း ဝင်လို့မရပါ။ `ward.warehouses` နှင့် `ward.pitch` ကို data file မှာ ပြင်နိုင်ပါတယ်။

## Ward Plan / Keyboard update

WARD PLAN ကို နှိပ်ပါက ရပ်ကွက်တစ်ခုလုံး၏ အပေါ်စီးမြေပုံ အကျယ်ဖွင့်ပါတယ်။ ပိတ်ရန် အပေါ်ဘက် ပိတ်ရန် button သို့မဟုတ် Esc ကို သုံးပါ။ Mouse lock ရှိပါက Esc နှိပ်ပြီး WARD PLAN ကို နှိပ်နိုင်ပါတယ်။

WASD နှင့် arrow keys သည် mouse lock မလုပ်ထားချိန်မှာလည်း အလုပ်လုပ်ပါတယ်။ မြေပုံဖွင့်ထားချိန် Up/W သည် မြောက်၊ Down/S သည် တောင်၊ Left/A သည် အနောက်၊ Right/D သည် အရှေ့သို့ ရွှေ့ပါတယ်။ 3D မြင်ကွင်းတွင် camera ဦးတည်ရာအတိုင်း ရွှေ့ပါတယ်။ Shift ဖြင့် ပြေးနိုင်ပါတယ်။ Mouse ပတ်ကြည့်ရန်သာ scene ကို click လုပ်ရန် လိုပါတယ်။

လမ်းမနှစ်ဖက် သစ်ပင်များကို အတွင်းဘက်ကိုင်းများနှင့် ထိယှက်သော အုပ်များဖြင့် လမ်းမပေါ် အမိုးသဖွယ် ပြင်ထားပါတယ်။

## ရေမြောင်းနှင့် ဘုန်းကြီးကျောင်းဝင်း

ရပ်ကွက်နှင့် ဂိုဒေါင်ကြားတွင် ရေစီးမျဉ်းများ လှုပ်ရှားသည့် ရေမြောင်းနှင့် လမ်းသွယ်ဆုံရာ တံတား ၄ စင်း ပါဝင်ပါတယ်။ မြောင်းကို တံတားကနေသာ ကူးနိုင်ပါတယ်။ ဘောလုံးကွင်းဘက် ကျောင်းဝင်းတွင် မဏ္ဍပ်၊ ဓမ္မာရုံ၊ ဘုန်းကြီးကျောင်းဆောင်၊ စေတီကြီးနှင့် စေတီငယ်များ၊ ကွင်းပြင် ပါဝင်ပါတယ်။ နေရာအစီအစဉ်သည် ပေးထားသောပုံကို ခန့်မှန်းမှီငြမ်းထားခြင်း ဖြစ်ပါတယ်။ ကျောင်းဆောင်အတွင်းဝင်ခြင်း မပါပါ။ WARD PLAN အကျယ်ဖွင့်လျှင် ကျောင်းဆောင်အမည်များ မြင်နိုင်ပါတယ်။ `src/components/Landmarks.tsx` တွင် 3D rendering၊ `src/data/ward.ts` တွင် နေရာဒေတာကို ပြင်နိုင်ပါတယ်။

## နေရာအစီအစဉ် ပြင်ဆင်ချက်

AH1 မှ ဂိုဒေါင်နောက်ဘက်သို့ ဝင်သွားသည့် အစီအစဉ်မှာ ဂိုဒေါင်တန်း → ဘောလုံးကွင်းနှင့် 100 × 100 m ကွက်လပ်ပြင်ကြီး → ဘုန်းကြီးကျောင်းဝင်း ဖြစ်ပါတယ်။ ဘောလုံးကွင်းနှင့် ကွက်လပ်ပြင်သည် အချင်းချင်းဘေးချင်းယှဉ်ရှိပြီး နှစ်ခုလုံးက ဂိုဒေါင်နှင့် ကျောင်းဝင်းကြားတွင် ရှိပါတယ်။ ကျောင်းဝင်းအတွင်း မဏ္ဍပ်၊ ကျောင်းဆောင်၊ ဓမ္မာရုံ၊ စေတီနှင့် သီးခြားကွင်းပြင် အစီအစဉ်ကို ဆက်လက်ထိန်းထားပါတယ်။ WARD PLAN တွင် နေရာသစ်အတိုင်း ပြထားပါတယ်။


ဘောလုံးကွင်းနှင့် ကွက်လပ်ပြင်ကြီး၏ နေရာများကို နောက်ဆုံးပြောင်းလဲထားပါတယ်။ ကျောင်းဝင်းသည် ဘောလုံးကွင်းနှင့် တန်းညီသော နောက်ဘက်တွင် ရှိပြီး မဏ္ဍပ်၊ ကျောင်းဆောင်၊ ဓမ္မာရုံနှင့် စေတီများလည်း ကျောင်းဝင်းနှင့်အတူ ရွှေ့ထားပါတယ်။

## ကွင်းဘေးနှင့် လမ်းမတစ်ဖက် လူနေရပ်ကွက်

ဘောလုံးကွင်းနှင့် ကျောင်းဝင်းကြားတွင် လမ်းသွယ်ရှိပြီး ကွင်းဘေး လူနေအိမ်စုကို လမ်းမကြီးနှင့် ချိတ်ထားပါတယ်။ ကွင်းဘေးတွင် လမ်းသွယ် ၅ လမ်း၊ ကြားက block ၄ ခုတွင် အိမ် ၂ တန်းစီ (တစ်တန်း ၆ လုံး) ထည့်ထားပါတယ်။ လမ်းမတစ်ဖက်တွင် လမ်းသွယ် ၃ လမ်းနှင့် အိမ်စု ထပ်ထည့်ထားပါတယ်။ မူလအိမ်များအပါအဝင် စုစုပေါင်း ၈၅ လုံးဖြစ်ပါတယ်။ `pitchLanes` နှင့် `oppositeLanes` တွင် လမ်းသွယ်နေရာများကို ပြင်နိုင်ပါတယ်။ 3D နှင့် WARD PLAN နှစ်ခုလုံးက ဒေတာတူညီစွာ သုံးပါတယ်။

## လမ်းမတစ်ဖက် နောက်ဆုံးပြင်ဆင်ချက်

လမ်းသွယ် ၄ လမ်း ဖြစ်ပါတယ်။ အိမ်တန်းကို AH1 မှ အတွင်းဘက်သို့ ရေတွက်ထားပါတယ်။ ပထမလမ်းသွယ်ဘက် အိမ်တန်း ၃ တန်းတွင် ၁၊ ၁၊ ၂ လုံးစီနှင့် ပထမနှစ်အိမ်နောက်က ခြံကျယ်များ ပါပါတယ်။ ဒုတိယလမ်းသွယ်ဘက် အိမ်တန်း ၄ တန်းတွင် နောက်ဆုံးတန်းက အိမ်တစ်လုံး၊ စိုက်ခင်း၊ ကန်ဘောင်နှင့် အပင်များ ပါပါတယ်။ ကျန်အိမ်စုကို ပုံမှန်အစီအစဉ်ဖြင့် ဆက်ထားပါတယ်။

ပထမအိမ်တန်းနောက် ရေမြောင်းတစ်ကြောင်းနှင့် ဒုတိယအိမ်တန်းနောက် မူလဂိုဒေါင်ဘေးမြောင်းမှ တိုက်ရိုက်ဆက်လာသော ရေမြောင်းတစ်ကြောင်း ရှိပါတယ်။ မြောင်းနှစ်ကြောင်းလုံးတွင် ရေစီးလှုပ်ရှားမှုနှင့် လမ်းကူးတံတားများ ပါပါတယ်။ ရေကန်နှင့် မြောင်းကို ဖြတ်လျှောက်လို့မရပါ။ WARD PLAN တွင် ခြံ၊ စိုက်ခင်း၊ ကန်နှင့် မြောင်းအသစ်များကို ပြထားပါတယ်။

## စိုက်ခင်းအိမ် နောက်ဆုံးနေရာချထားမှု

ဒုတိယလမ်းသွယ်ရှိ စိုက်ခင်းအိမ်ဘက်တွင် အိမ်တစ်လုံးသာ ထားပါတယ်။ AH1 မှ အတွင်းဘက်သို့ မြေကွက်လပ် → အိမ်တစ်လုံး → စိုက်ခင်း၊ ကန်ဘောင်၊ အပင်များ အစီအစဉ်ဖြစ်ပါတယ်။ အိမ်ရှေ့ဝင်ပေါက်ကို AH1 ဘက် မျက်နှာမူထားပါတယ်။ ယခင်ရှေ့တန်းအိမ် ၆ လုံးကို ဖယ်ထားပြီး မြောင်းနှစ်ကြောင်းနှင့် လမ်းကူးတံတားများကို ဆက်ထားပါတယ်။ စုစုပေါင်းအိမ် ၈၂ လုံး ဖြစ်ပါတယ်။

## လက်ရှိ စိုက်ခင်းအတန်း၏ အစီအစဉ်

မိန်းလမ်းမကြီး → မြေကွက်လပ် → ရေမြောင်း → အိမ်တစ်လုံး → စိုက်ခင်း → ကန်ဘောင်နှင့် အပင်များ → ရေမြောင်း → နောက်ထပ်အိမ်တစ်လုံး။ ယခင်နေရာချထားမှုဆိုင်ရာ ဖော်ပြချက်များထက် ဤအစီအစဉ်ကို အတည်ယူပါ။ မြေကွက်လပ်အတွင်း မြောင်းကို ဖြတ်မထားတော့ဘဲ အိမ်ရှေ့တွင်သာ ဆက်လက်ထားပါတယ်။ နောက်ဘက်မြောင်းနှင့် အိမ်အသစ်ကို လမ်းသွယ်၊ တံတားမှတစ်ဆင့် ရောက်နိုင်ပါတယ်။ 3D၊ WARD PLAN နှင့် collision တို့ကို တူညီသောဒေတာဖြင့် ပြင်ထားပါတယ်။

## ရေမြောင်းအရေအတွက် — အတည်ပြုထားသော နောက်ဆုံးပုံစံ

လမ်းမတစ်ဖက် လူနေအိမ်စုတွင် ရေမြောင်း စုစုပေါင်း ၂ ကြောင်းသာ ရှိပါတယ်။ ပထမကြောင်းသည် မူလဂိုဒေါင်ဘေးမှ ဆက်လာပြီး မြေကွက်လပ်နှင့် စိုက်ခင်းအိမ်ကြားမှတစ်ဆင့် အခြားလမ်းသွယ်များထိ ဆက်ပါတယ်။ ဒုတိယကြောင်းသည် ကန်ဘောင်/အပင်များနှင့် နောက်အိမ်ကြားမှတစ်ဆင့် ရပ်ကွက်တစ်လျှောက် ဆက်ပါတယ်။ ယခင် အပိုမြောင်းအပိုင်းများကို ဖယ်ထားပါတယ်။ လမ်းသွယ် ၄ လမ်းလုံးကို မြောင်းနှစ်ကြောင်းဖြတ်ကူးသော တံတားများနှင့် ဆက်ထားပါတယ်။

## စိုက်ခင်းအိမ်ကို အခြေခံသော မြောက်/တောင် အစီအစဉ်

မြောက်ဘက်သည် ဂိုဒေါင်နှင့် သစ်ပင်တန်းရှိရာ (local v လျော့သည့်ဘက်) ဖြစ်ပါတယ်။ WARD PLAN တွင် မြောက် ↖၊ တောင် ↘ အဖြစ် ပြထားပါတယ်။ အိမ်တန်းများကို မြောက်မှတောင်သို့ ရေတွက်ထားပါတယ်။ ဂိုဒေါင်ဘက်မှ စတင်ပါက လမ်းသွယ် → အိမ် ၃ တန်း → လမ်းသွယ် → အိမ် ၃ တန်း → စိုက်ခင်းအိမ် → အိမ် ၁ တန်း → လမ်းသွယ် → အိမ် ၃ တန်း ဖြစ်ပါတယ်။ တစ်တန်းလျှင် အိမ် ၃ လုံးစီ နေရာချထားပါတယ်။

စိုက်ခင်းအိမ်အနီး မြောက်ဘက်အိမ်စု၏ ပထမနှစ်တန်းကို အိမ်နှင့် ခြံငယ်သာ သတ်မှတ်ထားပါတယ်။ နောက်ဘက်မြေကွက်သည် စိုက်ခင်းအိမ်ပိုင်ဖြစ်ပြီး WARD PLAN တွင် အမည်တပ်ထားပါတယ်။ မြောင်း ၂ ကြောင်း၊ စိုက်ခင်း၊ ရေကန်နှင့် နောက်အိမ်တို့၏ လမ်းမမှ အတွင်းဘက်အစီအစဉ်ကို ဆက်လက်ထိန်းထားပါတယ်။ မြေပြင်အကျယ် 820 × 820 m၊ အိမ်စုစုပေါင်း 101 လုံး ဖြစ်ပါတယ်။

## လက်ရှိ အိမ်နှင့် မြေကွက်လပ် အစီအစဉ်

စိုက်ခင်းအိမ်၏ မြောက်ဘက်ကပ်လျက် အိမ်နှစ်လုံးကို ဖယ်ပြီး ၂ အိမ်စာ မြေကွက်လပ်အဖြစ် ပြထားပါတယ်။ ထိုအတန်းတွင် မြောက်ဘက်ဆုံးအိမ်တစ်လုံးသာ ကျန်ပါတယ်။ လမ်းမနှင့် လမ်းမအနီးဆုံးမြောင်းကြားတွင် အိမ်တန်းတစ်တန်းသာ ရှိပါတယ်။ ဦးတည်ချက်များမှာ မြောက် = ဂိုဒေါင်ဘက်၊ အရှေ့ = လမ်းမဘက်၊ အနောက် = စိုက်ခင်းဘက် ဖြစ်ပြီး WARD PLAN တွင် ပြထားပါတယ်။ စုစုပေါင်းအိမ် ၈၉ လုံး ဖြစ်ပါတယ်။

## အိမ်ဝင်တံတား

လမ်းမကြီးမှ မြေကွက်လပ်ကို ဖြတ်ပြီး စိုက်ခင်းအိမ်ရှေ့အထိ 3 m ကျယ် လမ်းကလေးနှင့် လက်ရန်းပါ မြောင်းကူးတံတား ထည့်ထားပါတယ်။ WASD / arrow keys ဖြင့် အိမ်ရှေ့အထိ ဖြတ်လျှောက်နိုင်ပါတယ်။ WARD PLAN တွင်လည်း ဝင်လမ်းနှင့် တံတား ပါပါတယ်။

## နှစ်ထပ်လူနေအိမ်ပုံစံ

လူနေအိမ်အားလုံးကို အောက်ထပ်နှင့် အပေါ်ထပ်ပါ နှစ်ထပ်ပုံစံ ပြောင်းထားပါတယ်။ ထပ်နှစ်ထပ်ကို ခွဲထားသော ကြမ်းခင်းတန်း၊ နှစ်ထပ်စလုံးရှိ ပြတင်းပေါက်များ၊ အပေါ်ထပ်တံခါး၊ တိုင်ထောက်ဝရန်တာနှင့် လက်ရန်း ပါပါတယ်။ ခေါင်မိုးအမြင့်သည် 8 m ခန့် ဖြစ်ပါတယ်။ ဤပြင်ဆင်မှုသည် အပြင်ဘက်ပုံစံအတွက် ဖြစ်ပြီး အိမ်အတွင်းဝင်ခြင်းနှင့် အပေါ်ထပ်တက်ခြင်း မပါသေးပါ။

## သစ်ပင်ကြီးများ

လမ်းမနှင့် စိုက်ခင်းအိမ်ရှေ့ မြေကွက်လပ်အနားတွင် သစ်ပင်ကြီးတစ်ပင် ထည့်ထားပါတယ်။ ကွင်းဘေးလမ်းသွယ်၊ လမ်းမတစ်ဖက်လမ်းသွယ်၊ မူလရပ်ကွက်လမ်းနှင့် ကျောင်းဝင်းဘေးလမ်းတို့တွင်လည်း သစ်ပင်ကြီးများ ထည့်ထားပါတယ်။ သစ်ပင်ကြီးအသစ် စုစုပေါင်း ၂၇ ပင်၊ အမြင့် ၁၈ m ခန့်ဖြစ်ပြီး ပင်စည် collision နှင့် WARD PLAN သစ်ပင်အုပ်ပုံများ ပါဝင်ပါတယ်။


## Tree height update

All tree groups (road canopy, lane shade trees and farm trees) now reach approximately 17.6 m, about twice the two-storey house roof height. Trunk positions and ground collision radii are unchanged.

## အရှေ့ဘက်အိမ်တန်းနှင့် ဖြတ်မြောင်း

AH1 အရှေ့ဘက် လူနေအိမ်များ၏ အရှေ့/အနောက်မျက်နှာမူမှုကို လမ်းမဘက် (အနောက်ဘက်) သို့ ပြောင်းထားပြီး လမ်းမမျက်နှာစာတွင် အပြာရောင်သွပ်ခြံစည်းရိုးနှင့် ဂိတ်ပေါက် ပါပါတယ်။ စိုက်ခင်းအိမ်နှင့် မျက်နှာချင်းဆိုင်ဘက်တွင် ပထမတန်း အိမ် ၄ လုံး၊ ဒုတိယတန်း အိမ် ၁ လုံး ထပ်ထည့်ထားပါတယ်။ နှစ်တန်းကြား အရှေ့–အနောက်မြောင်းက AH1 ကို ဖြတ်ပြီး အနောက်ဘက် တောင်–မြောက်မြောင်း ၂ ကြောင်းလုံးနှင့် ဆက်ပါတယ်။ လမ်းမပေါ်တွင် ရေဖြတ်ပေါက်ပါ တံတားပိုင်းရှိပြီး ဖြတ်လျှောက်နိုင်ပါတယ်။ ပထမတန်းနှင့် မြောင်းကြား သစ်ပင်ကြီးတစ်ပင် ပါပါတယ်။


## Southern cross-drain route

The east-west branch crosses AH1 between the eastern home rows, bends south along the road edge, then turns west beyond the southernmost house row to join both north-south canals. It no longer cuts through the farmhouse land. Flow animation, WARD PLAN and walking collision share this route. Culvert decks preserve AH1 and the southern residential lane crossing.


## Rice mill compound

Added the rice mill beside the single-home eastern row, with an open field between AH1 and the mill. A separate paddy warehouse and two compound homes follow the reference image. On the road-side southern edge, a house row, two bunded paddy plots, and a final house row follow in order. The 3D scene and WARD PLAN share placement data; buildings block walking while yards and fields remain accessible. Layout dimensions are approximate.


Two additional large shade trees stand between AH1 and the first canal-side eastern home, and at the road-facing front of the rice mill frontage yard. They use the existing approximately 17.6 m tree model and appear in WARD PLAN with trunk collision.


## Scene components

All files below are in `src/components/`. Placement data remains in `src/data/ward.ts`; collision remains in `src/game/collision.ts`.

| File | Responsibility |
| --- | --- |
| `House.tsx` | Reusable two-storey `House` with fences; shared plan orientation helpers |
| `Farmhouse.tsx` | Dedicated farmhouse, garden, pond, land and entrance fence; rendered once outside the ordinary house list |
| `MainRoad.tsx` | AH1 main road |
| `Lane.tsx` | Individual `Lane` and collection `Lanes` |
| `Road.tsx` | Shared road surface and markings |
| `Tree.tsx` | Individual `Tree` with large, canopy and farm variants; `Trees` and `FarmTrees` collections |
| `Canal.tsx` | Two north-south canals, curved connecting branch, bridges and animated flow |
| `Field.tsx` | Individual `Field`, optional bunded paddy style, and `Fields` collection |
| `Primitives.tsx` | Shared `Box` and `Block` geometry |
| `Town.tsx` | Scene composition, lighting, ground and remaining landmarks |

Examples: `<House h={houseData}/>`; `<Lane r={roadData}/>`; `<Tree t={treeData} variant="large"/>`; `<Field f={fieldData} bunded/>`. The existing geometry, coordinates, controls, and map data are retained.


## Western fields and mountain range

Five bunded paddy plots extend west behind the rear home beyond the farmhouse. Five northern and five southern plots flank them (15 new plots). `ward.westernFields` defines placement; `Field.tsx` renders them. `Mountains.tsx` adds two overlapping western ridges, with peaks approximately 145-246 m tall, and the matching plan symbols. The ground and walkable world expand to 1600 m square; WARD PLAN uses the same bounds. Mountain footprints block walking. Existing homes and canal routes retain their positions.


## Village rendering performance

- `StaticBatch.tsx` / `game/staticBatch.ts` combine opaque static primitives into instanced batches within 128 m tiles. Box dimensions become instance transforms, preserving existing models and colors. Transparent meshes and animated canal flow stay separate. Cleanup restores source meshes for React remounts.
- Small static details are hidden beyond 180 m from their tile bounds; nearby house details and the main building shapes remain visible. Village data and locations are unchanged.
- `game/spatialIndex.ts` indexes buildings and tree trunks in 64 m cells. Walking checks only nearby candidates instead of rebuilding all village arrays on every substep.
- The static town and plan layers are memoized. Stationary player updates do not redraw the UI. Pixel ratio is capped at 1.25 and the shadow map uses 1024 pixels.
- Validation: TypeScript passes, 25 existing collision/layout tests and 2 batching/spatial tests pass. Browser FPS has not been measured. Production build passed on 2026-10-23, and dist/ plus the distribution archive were refreshed.


## Reference-based forested mountains

The supplied `mountain near yar inn.png` guides the visual treatment: continuous irregular ridges, eroded gullies, forest-green slopes, exposed soil patches and blue atmospheric background ranges. `game/mountainTerrain.ts` generates tiled heightfields with smooth shared-edge normals and deterministic vertex colors; `Mountains.tsx` renders them and keeps the summit pagoda and existing plan labels. This is an artistic interpretation, not surveyed terrain reconstruction. Existing mountain locations, the AH1 pass and collision footprints remain unchanged.

The foreground terrain uses 58 meshes / 28,504 triangles and generated in approximately 129 ms in a local Node check. These are geometry-generation measurements, not browser FPS. Forest appearance uses surface colors instead of additional tree objects.


## Robot player character

`RobotCharacter.tsx` replaces the previous human placeholder with a native 3D model inspired by `robot cartoon.png`: mint shell, dark face panel, white eyes and smile, orange ear discs and antenna, chest controls, articulated-looking arms and two rubber wheels. The model faces -Z to match player heading. Wheels rotate from actual movement distance and remain still when blocked or moving the aerial camera. First-person visibility and existing controls remain managed by `Player.tsx`.


Robot body heading is independent of camera yaw: mouse orbit while stationary reveals the front and sides. The robot faces actual ground movement, including sideways/backward input; reset and teleport initialize both headings.


## Autonomous village robots

`RobotCharacter` is shared by the player and bots. Its `palette` prop accepts `shell`, `accent`, `panel`, `rubber`, and `trim`; `size` scales the complete model. The player uses the default mint palette. `botAppearance(index)` creates 64 distinct body colors and sizes, excluding mint/cyan body hues.

`RobotBots.tsx` adds eight bots per village and eight in Myothar (64 total). `robotRoutes.ts` splits road centerlines at intersections and validates patrol edges against buildings, trees and water, with extra clearance for larger bots. Bots choose junction turns and reverse at dead ends; facing and wheels follow actual travel. Road graphs are cached across StrictMode remounts. Nearby bots use the detailed shared character; distant bots use a five-mesh proxy and are hidden beyond 1,000 m. Moving bots are kept outside static scene batching.

Example: `<RobotCharacter wheels={wheelRef} palette={customPalette} size={0.8}/>`.


## Reference car

`Car.tsx` provides `<Car color="#277fbd" size={1}/>`: a rounded blue body, light-blue windows, orange wheel hubs, lights and bumpers inspired by `car.png`. A parked example is placed near the Myothar spawn at local (8.5, 103), with a plan symbol and collision footprint. It is a display vehicle, not a driving controller.

## Mobile controls

On narrow screens or coarse-pointer devices, hold the left half for 220 ms to move in the robot's facing direction. Faint arrow buttons select a direction; dragging the held left finger changes direction. Icons fade out while moving and return on release. Hold the right half simultaneously for sprint speed; no Shift button is shown. Dragging on the right orbits the camera. Each touch has its own captured pointer ID, and cancellation, focus loss, hidden tabs, menus and map opening reset movement.

Mobile hides the location-toast body and collapsed WARD PLAN; open WARD PLAN from Settings. Desktop keeps keyboard/mouse controls, toast details and the collapsed plan. Phone menus scroll in short landscape viewports. Browser/device touch gestures have not yet been manually verified.
