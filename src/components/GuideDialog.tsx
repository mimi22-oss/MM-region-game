import { useState, useEffect, useCallback } from 'react';

export type DeviceMode = 'mobile' | 'laptop';

interface GuideDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onStart?: () => void;
}

interface GuideSlide {
	id: string;
	title: string;
	icon: string;
	badge: string;
	subtitle: string;
	mobileContent: {
		summary: string;
		steps: { title: string; desc: string; icon?: string; tag?: string }[];
		tips?: string[];
	};
	laptopContent: {
		summary: string;
		steps: { title: string; desc: string; keys?: string[]; tag?: string }[];
		tips?: string[];
	};
}

const GUIDE_SLIDES: GuideSlide[] = [
	{
		id: 'exit-house',
		title: 'အိမ်ပြင်ထွက်နည်း',
		icon: '🚪',
		badge: 'အစပြုခြင်း',
		subtitle: 'နေအိမ်နှင့် ခြံဝင်းအတွင်းမှ အပြင်ဘက် လမ်းမကြီးဆီသို့ ထွက်ခွာခြင်း',
		mobileContent: {
			summary: 'ဂိမ်းစတင်ချိန်တွင် ဇာတ်ကောင်သည် ခြံဝင်းအတွင်းရှိ နေအိမ်ထဲ၌ ရောက်ရှိနေပါမည်။',
			steps: [
				{
					title: '၁။ အိမ်တံခါးပေါက်ဆီသို့ လျှောက်ပါ',
					desc: 'မျက်နှာပြင် ဘယ်ဘက်ရှိ Joystick ကို အသုံးပြုပြီး ကြမ်းပြင်ပေါ်ရှိ အစိမ်းရောင် ညွှန်ပြမြှားများအတိုင်း အိမ်ရှေ့တံခါးမကြီးဆီသို့ လျှောက်လှမ်းပါ။',
					icon: '🕹️',
					tag: 'Joystick'
				},
				{
					title: '၂။ တံခါးရှေ့တွင် ၃ စက္ကန့် ငြိမ်ငြိမ်ရပ်ပါ',
					desc: 'အိမ်တံခါးရှေ့သို့ ရောက်လျှင် မလှုပ်ဘဲ ၃ စက္ကန့် ငြိမ်ငြိမ်ရပ်ပေးပါ။ တံခါးသည် အလိုအလျောက် ပွင့်သွားမည်ဖြစ်ပြီး လှေကားမှ ခြံဝင်းထဲသို့ ဆင်းနိုင်ပါမည်။',
					icon: '⏱️',
					tag: '၃ စက္ကန့် ရပ်ရန်'
				},
				{
					title: '၃။ ခြံတံခါးမကြီး (Gate) ဆီသို့ သွားပါ',
					desc: 'ခြံဝင်းရှေ့ရှိ သံတံခါးမကြီးရှေ့သို့ လျှောက်သွားပြီး ၃ စက္ကန့် ခေတ္တရပ်လိုက်ပါက ခြံတံခါးပွင့်သွားပြီး AH1 အာရှလမ်းမကြီးပေါ်သို့ ရောက်ရှိပါမည်။',
					icon: '🏡',
					tag: 'ခြံတံခါးပွင့်မည်'
				}
			],
			tips: [
				'💡 အကြံပြုချက်: တံခါးမပွင့်ပါက တံခါးနားတွင် မရွှေ့ဘဲ ၃ စက္ကန့် ခေတ္တစောင့်ပေးပါ၊ တံခါး အလိုအလျောက် ပွင့်လာပါမည်။'
			]
		},
		laptopContent: {
			summary: 'ဂိမ်းစတင်ချိန်တွင် ဇာတ်ကောင်သည် ခြံဝင်းအတွင်းရှိ နေအိမ်ထဲ၌ ရောက်ရှိနေပါမည်။',
			steps: [
				{
					title: '၁။ အိမ်တံခါးဆီသို့ လျှောက်ပါ',
					desc: 'W, A, S, D သို့မဟုတ် မြှားခလုတ်များဖြင့် ကြမ်းပြင်ပေါ်ရှိ အစိမ်းရောင် လမ်းညွှန်မြှားများအတိုင်း အိမ်ရှေ့တံခါးဆီသို့ လျှောက်ပါ။',
					keys: ['W', 'A', 'S', 'D']
				},
				{
					title: '၂။ တံခါးရှေ့တွင် ၃ စက္ကန့် ငြိမ်ငြိမ်ရပ်ပါ',
					desc: 'တံခါးမကြီးရှေ့သို့ ရောက်ပါက ခလုတ်များကို လွှတ်၍ ၃ စက္ကန့် ငြိမ်ငြိမ်ရပ်ပေးပါ။ တံခါး အလိုအလျောက် ပွင့်သွားပါမည်။',
					tag: '၃ စက္ကန့် ရပ်ပါ'
				},
				{
					title: '၃။ လှေကားဆင်းပြီး ခြံတံခါးမကြီးဆီသို့ သွားပါ',
					desc: 'အိမ်ရှေ့လှေကားမှ ဆင်းပြီး ခြံတံခါးရှေ့တွင် ၃ စက္ကန့် ရပ်ပေးပါက ခြံတံခါးပွင့်ပြီး AH1 အာရှလမ်းမကြီးဆီသို့ ထွက်နိုင်ပါပြီ။',
					tag: 'လမ်းမကြီးသို့ ထွက်ရန်'
				}
			],
			tips: [
				'💡 ကွန်ပျူတာတွင် မျက်နှာပြင်ကို ကလစ်နှိပ်ထားပါက Mouse ဖြင့် ကင်မရာမြင်ကွင်း ၃၆၀° ကို ချောမွေ့စွာ လှည့်ကြည့်နိုင်ပါသည်။'
			]
		}
	},
	{
		id: 'walk-controls',
		title: 'လမ်းလျှောက်နည်း',
		icon: '🕹️',
		badge: 'အခြေခံ ထိန်းချုပ်မှု',
		subtitle: 'ဇာတ်ကောင် ရွေ့လျားခြင်း၊ အမြန်ပြေးခြင်းနှင့် မြင်ကွင်းကြည့်ရှုခြင်း',
		mobileContent: {
			summary: 'ဖုန်းမျက်နှာပြင်တွင် ထိတွေ့ထိန်းချုပ်မှုများဖြင့် လွယ်ကူစွာ လမ်းလျှောက်နိုင်ပါသည်။',
			steps: [
				{
					title: 'Virtual Joystick (ဘယ်ဘက်)',
					desc: 'မျက်နှာပြင် ဘယ်ဘက်ခြမ်းကို ဖိဆွဲပြီး ၃၆၀° မည်သည့်အရပ်မျက်နှာသို့မဆို လွတ်လပ်စွာ လမ်းလျှောက်ပါ။',
					icon: '🕹️',
					tag: 'ဘယ်ဘက်ဆွဲပါ'
				},
				{
					title: 'ပြေးခလုတ် (ညာဘက်)',
					desc: 'မျက်နှာပြင် ညာဘက်အောက်ရှိ "ပြေး" (ခြေဖဝါးပုံ) ခလုတ်ကို ဖိထားပြီး ဘယ်ဘက် Joystick ဖြင့် တွဲနှိပ်ပါက လျင်မြန်စွာ ပြေးပါမည်။',
					icon: '👣',
					tag: 'ပြေး ဖိထားပါ'
				},
				{
					title: 'ကင်မရာလှည့်ကြည့်ခြင်း (Pan)',
					desc: 'မျက်နှာပြင် ညာဘက်ခြမ်းကို လက်ဖြင့် ဖိဆွဲ၍ ပတ်ဝန်းကျင် ရှုခင်းများကို ၃၆၀° လှည့်ပတ်ကြည့်ရှုပါ။',
					icon: '🔄',
					tag: 'ညာဘက်ဆွဲပါ'
				},
				{
					title: 'Zoom ချဲ့/ချုံ့ခြင်း (Pinch)',
					desc: 'လက်နှစ်ချောင်းဖြင့် ညှပ်ဆွဲ (Pinch-to-zoom) ပြုလုပ်ပြီး မြင်ကွင်းကို အနီး/အဝေး ချိန်ညှိနိုင်ပါသည်။',
					icon: '🔍',
					tag: 'လက်နှစ်ချောင်း'
				}
			],
			tips: [
				'💡 အပေါ်ညာဘက်ရှိ ⚙ ဆက်တင်ကို နှိပ်ပြီး နေ့ခင်း ☀️ / ညချမ်း 🌙 အလင်းရောင်နှင့် ဇာတ်ကောင် (စက်ရုပ်/ကာတွန်း) ပြောင်းနိုင်ပါသည်။'
			]
		},
		laptopContent: {
			summary: 'Keyboard နှင့် Mouse ကို အသုံးပြု၍ ချောမွေ့စွာ ထိန်းချုပ်နိုင်ပါသည်။',
			steps: [
				{
					title: 'ရှေ့၊ နောက်၊ ဘယ်၊ ညာ လမ်းလျှောက်ရန်',
					desc: 'W (ရှေ့)၊ S (နောက်)၊ A (ဘယ်)၊ D (ညာ) သို့မဟုတ် ကီးဘုတ် မြှားခလုတ်များ ဖြင့် လမ်းလျှောက်ပါ။',
					keys: ['W', 'A', 'S', 'D', '↑', '↓', '←', '→']
				},
				{
					title: 'အမြန်ပြေးရန် (Sprint)',
					desc: 'Shift ခလုတ်ကို ဖိထားပြီး လမ်းလျှောက်ပါက အမြန်ပြေးပါမည်။',
					keys: ['Shift']
				},
				{
					title: 'ကင်မရာ ၃၆၀° လှည့်ကြည့်ရန်',
					desc: 'မျက်နှာပြင်ကို ကလစ်နှိပ်ပြီး Mouse ကို ရွှေ့၍ ကြည့်ရှုပါ (Mouse Pointer Lock စနစ်)။',
					keys: ['Mouse']
				},
				{
					title: 'Zoom ချဲ့/ချုံ့ခြင်းနှင့် မြင်ကွင်းပြောင်းခြင်း',
					desc: 'Scroll Wheel လှည့်၍ Zoom ချဲ့/ချုံ့ပါ။ V နှိပ်၍ First-person / Third-person ပြောင်းပါ။ T နှိပ်၍ ကောင်းကင်တည့်တည့် မြင်ကွင်းရယူပါ။',
					keys: ['Wheel', 'V', 'T']
				}
			],
			tips: [
				'💡 Mouse cursor ပြန်လွှတ်လိုပါက Esc ခလုတ်ကို နှိပ်ပါ။ မူလအစသို့ ပြန်သွားလိုပါက R ခလုတ်ကို နှိပ်ပါ။'
			]
		}
	},
	{
		id: 'motorcycle-ride',
		title: 'ဆိုင်ကယ်မောင်းနည်း',
		icon: '🏍️',
		badge: 'ယာဉ်စီးနင်းမှု',
		subtitle: 'ဂန္ထဝင်ဆိုင်ကယ်ကို ရှာဖွေပြီး လျင်မြန်စွာ စီးနင်းလည်ပတ်ခြင်း',
		mobileContent: {
			summary: 'ခြံရှေ့လမ်းဘေးတွင် အပြာရောင် ဂန္ထဝင်ဆိုင်ကယ် ရပ်ထားပါသည်။',
			steps: [
				{
					title: '၁။ ဆိုင်ကယ်တက်စီးခြင်း',
					desc: 'ဆိုင်ကယ်နားသို့ လျှောက်သွားပြီး ခေတ္တရပ်လိုက်ပါက ဆိုင်ကယ်ပေါ်သို့ အလိုအလျောက် တက်စီးသွားပါမည်။',
					icon: '🏍️',
					tag: 'အနီးကပ်ရပ်ပါ'
				},
				{
					title: '၂။ မောင်းနှင်ခြင်းနှင့် ကွေ့ခြင်း',
					desc: 'မျက်နှာပြင် ဘယ်ဘက် Joystick ကို အသုံးပြု၍ ရှေ့သို့မောင်းရန်၊ နောက်ဆုတ်ရန်နှင့် ဘယ်/ညာ ကွေ့ရန် ပြုလုပ်ပါ။',
					icon: '🕹️',
					tag: 'Joystick'
				},
				{
					title: '၃။ အရှိန်မြှင့်ခြင်း (Boost) နှင့် ဘရိတ်',
					desc: 'ညာဘက်ရှိ "လီဗာ" ခလုတ်ကို ဖိထားပါက 60 km/h အထိ အရှိန်တင်မောင်းနိုင်ပါသည်။ ရပ်တန့်လိုပါက "ဘရိတ်" ခလုတ်ကို ဖိထားပါ။',
					icon: '⚡',
					tag: 'လီဗာ & ဘရိတ်'
				},
				{
					title: '၄။ ဆိုင်ကယ်မှဆင်းခြင်းနှင့် အသက်စနစ်',
					desc: 'ဆိုင်ကယ်မှ ဆင်းလိုပါက "ဆင်းရန်" ခလုတ်ကို နှိပ်ပါ။ လမ်းဘေးအတားအဆီးများကို တိုက်မိပါက အသက် ❤️ ၁ ချောင်း လျော့ပါမည်။',
					icon: '🚪',
					tag: 'ဆင်းရန်'
				}
			],
			tips: [
				'💡 Speedometer ဒိုင်ခွက်ပေါ်ရှိ ကိန်းဂဏန်း (30 / 45 / 60) ကို နှိပ်ပြီး အမြင့်ဆုံး အရှိန်ကန့်သတ်ချက်ကို ပြောင်းလဲနိုင်ပါသည်။'
			]
		},
		laptopContent: {
			summary: 'Keyboard ဖြင့် ဆိုင်ကယ်ကို လျင်မြန်ပေါ့ပါးစွာ မောင်းနှင်နိုင်ပါသည်။',
			steps: [
				{
					title: 'တက်စီးခြင်း / ဆင်းခြင်း',
					desc: 'ဆိုင်ကယ်အနီးသို့ ရောက်ရှိပါက E ခလုတ်ကို နှိပ်၍ တက်စီးပါ သို့မဟုတ် ဆင်းပါ။',
					keys: ['E']
				},
				{
					title: 'ရှေ့သို့မောင်းခြင်းနှင့် ကွေ့ခြင်း',
					desc: 'W (သို့မဟုတ် ↑) ဖြင့် ရှေ့သို့ အရှိန်တင်ပါ။ A, D (သို့မဟုတ် ←, →) ဖြင့် ဘယ်/ညာ ကွေ့ပါ။ S (သို့မဟုတ် ↓) ဖြင့် နောက်ဆုတ်ပါ။',
					keys: ['W', 'A', 'S', 'D']
				},
				{
					title: 'Turbo Boost အရှိန်မြှင့်တင်ရန်',
					desc: 'Shift ခလုတ်ကို ဖိထားပါက အရှိန်အမြင့်ဆုံး 60 km/h အထိ မြန်ဆန်စွာ မောင်းနှင်နိုင်ပါသည်။',
					keys: ['Shift']
				},
				{
					title: 'ဘရိတ်အုပ်ခြင်း (Handbrake)',
					desc: 'Space ခလုတ်ကို ဖိထားပါက ဆိုင်ကယ်ကို ချက်ချင်း အရှိန်လျှော့ရပ်တန့်နိုင်ပါသည်။',
					keys: ['Space']
				}
			],
			tips: [
				'💡 ဆိုင်ကယ်မောင်းနှင်နေစဉ် V ခလုတ်ကို နှိပ်ပြီး ကင်မရာမြင်ကွင်းကို ပြောင်းလဲကြည့်ရှုနိုင်ပါသည်။'
			]
		}
	},
	{
		id: 'car-drive',
		title: 'ကားမောင်းနည်း',
		icon: '🚗',
		badge: 'ကားခေါ် & မောင်းနှင်မှု',
		subtitle: 'AH1 လမ်းမကြီးဆုံမှတ်တွင် ကားခေါ်ယူခြင်းနှင့် Clutch/Gear စနစ်ဖြင့် မောင်းနှင်ခြင်း',
		mobileContent: {
			summary: 'ကလေးမြို့ AH1 အာရှလမ်းမကြီးတွင် ကားခေါ်ယူပြီး လက်တွေ့ဆန်သော ဂီယာစနစ်ဖြင့် မောင်းနှင်နိုင်ပါသည်။',
			steps: [
				{
					title: '၁။ လမ်းမကြီးဆုံမှတ်တွင် ကားခေါ်ပါ',
					desc: 'AH1 လမ်းမကြီးဆုံမှတ်ရှိ အဝိုင်းထဲတွင် ၃ စက္ကန့် ရပ်နေပါက "🚗 ကားခေါ်မှာလား?" ပေါ်လာပါမည်။ "📞 ခေါ်မည်" နှိပ်ပါ။ ကားသည် လမ်းမကြီးရှေ့သို့ အလိုအလျောက် မောင်းလာပါမည်။ (၁၀ စက္ကန့်အတွင်း မစီးပါက မူလနေရာသို့ ပြန်လှည့်သွားပါမည်)',
					icon: '📞',
					tag: '၃ စက္ကန့် ရပ်၍ခေါ်ပါ'
				},
				{
					title: '၂။ ကားတက်စီးခြင်း',
					desc: 'ရောက်ရှိလာသော ကားနားသို့ ကပ်သွားပါက ကားတက်စီးပြီး စတီယာရင်နှင့် မောင်းနှင်ခလုတ်များ ပေါ်လာပါမည်။',
					icon: '🚗',
					tag: 'အလိုအလျောက် စီးမည်'
				},
				{
					title: '၃။ ဂီယာထိုးခြင်း (Clutch & Gear)',
					desc: 'ညာဘက်ရှိ "ကလပ် (Clutch)" ကို လက်ဖြင့် ဖိထားပါ → စတီယာရင်အပေါ်ရှိ "1" ဂီယာကို နှိပ်ပါ → "ကလပ်" ကို လွှတ်ပြီး "လီဗာ" ကို ဖိနင်းပါက ကားစတင် ထွက်ခွာပါမည်။',
					icon: '⚙️',
					tag: 'ကလပ် → ဂီယာ ၁ → လီဗာ'
				},
				{
					title: '၄။ စတီယာရင်၊ ဘရိတ်နှင့် နောက်ဆုတ်',
					desc: 'ဘယ်ဘက်ရှိ "စတီယာရင်ခွေ" ကို ဆွဲလှည့်၍ ကွေ့ပါ။ ရပ်ရန် "ဘရိတ်" နင်းပါ။ နောက်ဆုတ်ရန် ကလပ်ဖိပြီး "R" ဂီယာကို ရွေးပါ။ ကားမှဆင်းရန် "ကားဆင်းမည်" ခလုတ်ကို နှိပ်ပါ။',
					icon: '🔄',
					tag: 'စတီယာရင် & R'
				}
			],
			tips: [
				'💡 ကားမောင်းနေစဉ် ညာဘက်ရှိ "မြင်ကွင်း" ခလုတ်ကို နှိပ်ပြီး ကားအတွင်းခန်း ဒိုင်ခွက်မြင်ကွင်းနှင့် အပြင်ဘက်မြင်ကွင်း ပြောင်းနိုင်ပါသည်။'
			]
		},
		laptopContent: {
			summary: 'Keyboard ဖြင့် ကလပ် (Clutch)၊ ဂီယာ ၄ ချက်နှင့် စတီယာရင်ကို လက်တွေ့ကျကျ ထိန်းချုပ်နိုင်ပါသည်။',
			steps: [
				{
					title: '၁။ ကားခေါ်ယူခြင်းနှင့် တက်စီးခြင်း',
					desc: 'လမ်းမကြီးဆုံမှတ် အဝိုင်းထဲတွင် ၃ စက္ကန့် ရပ်၍ ကားခေါ်ပါ။ ကားရောက်လာပါက ကားအနီးတွင် E ခလုတ်နှိပ်၍ တက်စီးပါ (ဆင်းလိုပါကလည်း E နှိပ်ပါ)။',
					keys: ['E']
				},
				{
					title: '၂။ ကလပ်နင်းပြီး ဂီယာထိုးခြင်း',
					desc: 'C ခလုတ်ကို ဖိထားပါ (Clutch) → 1 နှိပ်ပါ (ဂီယာ ၁) → C ကို လွှတ်ပါ → W ကို ဖိထားပါ (လီဗာနင်း၍ အရှိန်တင်ခြင်း)။',
					keys: ['C', '1', 'W']
				},
				{
					title: '၃။ စတီယာရင် ကွေ့ခြင်းနှင့် ဘရိတ်',
					desc: 'A / D ဖြင့် ဘယ်/ညာ စတီယာရင်ကွေ့ပါ။ Space ဖြင့် လက်ဘရိတ်အုပ်ပါ။ S ဖြင့် ခြေဘရိတ်နင်းပါ။',
					keys: ['A', 'D', 'Space', 'S']
				},
				{
					title: '၄။ နောက်ဆုတ်ခြင်း (Reverse) နှင့် အတွင်းခန်း',
					desc: 'C (Clutch) ဖိထားပြီး R နှိပ်ပါက နောက်ဆုတ်ဂီယာ ကျပါမည်။ V နှိပ်ပါက ကားအတွင်းခန်း (Dashboard) မြင်ကွင်းသို့ ပြောင်းနိုင်ပါသည်။',
					keys: ['C + R', 'V']
				}
			],
			tips: [
				'💡 ဂီယာပြောင်းတိုင်း C (Clutch) ကို အရင်ဖိထားပြီးမှ ဂီယာနံပါတ် (1, 2, 3, 4, R) ကို ရွေးချယ်ရပါမည်။'
			]
		}
	},
	{
		id: 'balloon-ride',
		title: 'မီးပုံးပျံ စီးနင်းနည်း',
		icon: '🎈',
		badge: 'လေကြောင်းခရီး',
		subtitle: 'မီးပုံးပျံကြီးဖြင့် ကလေးမြို့နှင့် ရပ်ကွက်ကျေးရွာများကို ကောင်းကင်ယံမှ လှည့်လည်ကြည့်ရှုခြင်း',
		mobileContent: {
			summary: 'ဘောလုံးကွင်းအတွင်းရှိ မီးပုံးပျံနားသို့ သွားရောက်ကာ ကောင်းကင်ယံသို့ ပျံတက်နိုင်ပါသည်။',
			steps: [
				{
					title: '၁။ မီးပုံးပျံ တက်စီးခြင်း',
					desc: 'ဘောလုံးကွင်းအတွင်းရှိ မီးပုံးပျံလှည့်လည်ရာ စင်မြင့်နားသို့ သွားပြီး ခေတ္တရပ်ပါက အလိုအလျောက် စီးနင်းပါမည်။',
					icon: '🎈',
					tag: 'အနီးကပ်ရပ်ပါ'
				},
				{
					title: '၂။ အတက်အဆင်းနှင့် လမ်းကြောင်းရွှေ့ခြင်း',
					desc: 'ဘယ်ဘက် Joystick ဖြင့် ရှေ့/နောက်/ဘယ်/ညာ ရွှေ့နိုင်ပြီး ညာဘက်အကွေးခလုတ်ရှိ "↑ တက်" နှင့် "↓ ဆင်း" တို့ဖြင့် အမြင့်ကို ထိန်းညှိပါ။',
					icon: '🕹️',
					tag: 'Joystick & ↑/↓'
				},
				{
					title: '၃။ မြင်ကွင်းနှင့် Zoom ချိန်ညှိခြင်း',
					desc: '"အတွင်း/အပြင်" ဖြင့် ခြင်းတောင်းအတွင်းမြင်ကွင်းနှင့် အပြင်မြင်ကွင်း ပြောင်းပါ။ "အပေါ်မှကြည့်" နှင့် "− / +" ဖြင့် Zoom ချိန်ပါ။',
					icon: '🔍',
					tag: 'မြင်ကွင်း & Zoom'
				},
				{
					title: '၄။ မြေပြင်သို့ ဆင်းသက်ခြင်း (Exit)',
					desc: 'ညီညာသော မြေပြင်ပေါ်သို့ ဖြည်းဖြည်းချင်းဆင်းပြီး "မြေပြင်ပေါ်" အခြေအနေရောက်မှ ညာဘက်အောက်ရှိ "ဆင်းမည် (↩)" ခလုတ်ဖြင့် ဆင်းပါ။',
					icon: '🚪',
					tag: '↩ ဆင်းမည်'
				}
			],
			tips: [
				'💡 အမြင့်ပေ ၁၆၀၀ မီတာအထိ ပျံတက်နိုင်ပြီး ကလေးမြို့ဒေသတစ်ခုလုံးကို လေကြောင်းရှုခင်းအဖြစ် လှပစွာ ကြည့်ရှုနိုင်ပါသည်။'
			]
		},
		laptopContent: {
			summary: 'Keyboard ဖြင့် မီးပုံးပျံကို ကောင်းကင်ယံတွင် လွတ်လပ်ပေါ့ပါးစွာ မောင်းနှင်နိုင်ပါသည်။',
			steps: [
				{
					title: '၁။ အတက်အဆင်း ထိန်းချုပ်ရန်',
					desc: 'မြှားအပေါ် (↑) သို့မဟုတ် PageUp ဖြင့် အပေါ်တက်ပါ။ မြှားအောက် (↓) သို့မဟုတ် PageDown ဖြင့် အောက်ဆင်းပါ။',
					keys: ['↑', '↓', 'PageUp', 'PageDown']
				},
				{
					title: '၂။ ရှေ့၊ နောက်၊ ဘယ်၊ ညာ ရွေ့လျားရန်',
					desc: 'W (ရှေ့)၊ S (နောက်)၊ A (ဘယ်)၊ D (ညာ) တို့ဖြင့် မီးပုံးပျံကို လိုရာအရပ်သို့ ရွှေ့ပါ။ Space ဖြင့် ရပ်တန့်ပါ။ Shift ဖြင့် အရှိန်မြှင့်ပါ။',
					keys: ['W', 'A', 'S', 'D', 'Space', 'Shift']
				},
				{
					title: '၃။ ကင်မရာမြင်ကွင်းနှင့် Zoom',
					desc: 'V ဖြင့် ခြင်းတောင်းအတွင်း/အပြင် မြင်ကွင်းပြောင်းပါ။ T ဖြင့် ကောင်းကင်တည့်တည့် မြင်ကွင်းကြည့်ပါ။ Mouse Wheel ဖြင့် Zoom အနီး/အဝေး ချိန်ပါ။',
					keys: ['V', 'T', 'Wheel']
				},
				{
					title: '၄။ မီးပုံးပျံမှ ဆင်းရန်',
					desc: 'မြေပြင်ပေါ်သို့ ညင်သာစွာ ဆင်းသက်ပြီး ကိန်းဂဏန်း km/h ရပ်တန့်သွားချိန်တွင် E ခလုတ်နှိပ်၍ ဆင်းပါ။',
					keys: ['E']
				}
			],
			tips: [
				'💡 ရှေ့တွင် အဆောက်အဦ အတားအဆီးရှိပါက အမြင့်ကို အရင်တင်ပြီးမှ ကျော်လွန်ပျံသန်းပေးပါ။'
			]
		}
	}
];

export function GuideDialog({ isOpen, onClose, onStart }: GuideDialogProps) {
	// Detect screen size: mobile if <= 768px, else laptop
	const [deviceMode, setDeviceMode] = useState<DeviceMode>(() => {
		if (typeof window !== 'undefined' && window.innerWidth <= 768) {
			return 'mobile';
		}
		return 'laptop';
	});

	const [activeSlide, setActiveSlide] = useState(0);

	// Automatically update device mode on window resize
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth <= 768) {
				setDeviceMode('mobile');
			} else {
				setDeviceMode('laptop');
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// Keyboard arrow navigation for carousel slides
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isOpen) return;
			if (e.key === 'Escape') {
				onClose();
			} else if (e.key === 'ArrowRight') {
				setActiveSlide((prev) => (prev + 1) % GUIDE_SLIDES.length);
			} else if (e.key === 'ArrowLeft') {
				setActiveSlide((prev) => (prev - 1 + GUIDE_SLIDES.length) % GUIDE_SLIDES.length);
			}
		},
		[isOpen, onClose]
	);

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	if (!isOpen) return null;

	const currentSlide = GUIDE_SLIDES[activeSlide];
	const isMobile = deviceMode === 'mobile';
	const content = isMobile ? currentSlide.mobileContent : currentSlide.laptopContent;

	return (
		<div
			className="guide-dialog-backdrop"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="guide-dialog-title"
		>
			<div className="guide-dialog-modal" onClick={(e) => e.stopPropagation()}>
				{/* Top Header */}
				<div className="guide-modal-header" role="banner">
					<div className="guide-modal-brand">
						<span className="guide-modal-icon" aria-hidden="true">
							📖
						</span>
						<div>
							<h2 id="guide-dialog-title" className="guide-modal-title">
								အသုံးပြုနည်း လမ်းညွှန်
							</h2>
							<p className="guide-modal-desc">
								{isMobile ? 'ဖုန်းမျက်နှာပြင် အသုံးပြုနည်းများ' : 'ကွန်ပျူတာ (Laptop / PC) အသုံးပြုနည်းများ'}
							</p>
						</div>
					</div>

					{/* Device Mode Switcher */}
					<div className="guide-device-switcher" role="radiogroup" aria-label="ကိရိယာ ရွေးချယ်မှု">
						<button
							type="button"
							className={`guide-device-btn ${deviceMode === 'mobile' ? 'guide-device-active' : ''}`}
							onClick={() => setDeviceMode('mobile')}
							aria-checked={deviceMode === 'mobile'}
							role="radio"
						>
							<span className="guide-device-icon">📱</span>
							<span>ဖုန်း (Mobile)</span>
						</button>
						<button
							type="button"
							className={`guide-device-btn ${deviceMode === 'laptop' ? 'guide-device-active' : ''}`}
							onClick={() => setDeviceMode('laptop')}
							aria-checked={deviceMode === 'laptop'}
							role="radio"
						>
							<span className="guide-device-icon">💻</span>
							<span>ကွန်ပျူတာ (Laptop)</span>
						</button>
					</div>

					{/* Close Button */}
					<button
						type="button"
						className="guide-modal-close"
						onClick={onClose}
						aria-label="လမ်းညွှန် ပိတ်မည်"
						title="ပိတ်မည် (Esc)"
					>
						✕
					</button>
				</div>

				{/* Topic Navigation Carousel Tabs */}
				<nav className="guide-carousel-tabs" aria-label="လမ်းညွှန် ခေါင်းစဉ်များ">
					{GUIDE_SLIDES.map((slide, idx) => {
						const isActive = idx === activeSlide;
						return (
							<button
								type="button"
								key={slide.id}
								className={`guide-tab-btn ${isActive ? 'guide-tab-active' : ''}`}
								onClick={() => setActiveSlide(idx)}
								aria-selected={isActive}
								role="tab"
							>
								<span className="guide-tab-icon">{slide.icon}</span>
								<span className="guide-tab-text">{slide.title}</span>
								{isActive && <span className="guide-tab-indicator" />}
							</button>
						);
					})}
				</nav>

				{/* Active Slide Body with Glassmorphic Card */}
				<div className="guide-slide-body" role="tabpanel">
					{/* Slide Header Banner */}
					<div className="guide-slide-banner">
						<div className="guide-slide-title-wrap">
							<span className="guide-slide-badge">{currentSlide.badge}</span>
							<h3 className="guide-slide-heading">
								<span className="guide-slide-heading-icon">{currentSlide.icon}</span>
								<span>{currentSlide.title}</span>
							</h3>
							<p className="guide-slide-subtitle">{currentSlide.subtitle}</p>
						</div>
						<div className="guide-slide-counter" aria-label={`စာမျက်နှာ ${activeSlide + 1} / ${GUIDE_SLIDES.length}`}>
							<span>{activeSlide + 1}</span>
							<small>/{GUIDE_SLIDES.length}</small>
						</div>
					</div>

					{/* Slide Summary Callout */}
					<div className="guide-summary-callout">
						<span className="guide-summary-icon">{isMobile ? '📱' : '💻'}</span>
						<p>{content.summary}</p>
					</div>

					{/* Steps Grid */}
					<div className="guide-steps-grid">
						{content.steps.map((step, sIdx) => (
							<div key={sIdx} className="guide-step-card">
								<div className="guide-step-header">
									<strong className="guide-step-title">{step.title}</strong>
									{step.tag && <span className="guide-step-tag">{step.tag}</span>}
									{'keys' in step && step.keys && (
										<div className="guide-step-keys">
											{step.keys.map((k, kIdx) => (
												<kbd key={kIdx} className="guide-key">
													{k}
												</kbd>
											))}
										</div>
									)}
								</div>
								<p className="guide-step-desc">{step.desc}</p>
							</div>
						))}
					</div>

					{/* Tips List */}
					{content.tips && content.tips.length > 0 && (
						<div className="guide-tips-box">
							{content.tips.map((tip, tIdx) => (
								<p key={tIdx} className="guide-tip-text">
									{tip}
								</p>
							))}
						</div>
					)}
				</div>

				{/* Modal Footer with Carousel Navigation */}
				<div className="guide-modal-footer" role="contentinfo">
					{/* Prev / Next Carousel Controls */}
					<div className="guide-nav-controls">
						<button
							type="button"
							className="guide-nav-btn guide-nav-prev"
							onClick={() => setActiveSlide((prev) => (prev - 1 + GUIDE_SLIDES.length) % GUIDE_SLIDES.length)}
							disabled={activeSlide === 0}
							aria-label="ရှေ့ စာမျက်နှာသို့ (Previous)"
						>
							‹ ရှေ့သို့
						</button>

						{/* Dots Indicator */}
						<div className="guide-dots-indicator" role="tablist">
							{GUIDE_SLIDES.map((slide, dIdx) => (
								<button
									type="button"
									key={slide.id}
									className={`guide-dot ${dIdx === activeSlide ? 'guide-dot-active' : ''}`}
									onClick={() => setActiveSlide(dIdx)}
									aria-label={`ခေါင်းစဉ် ${slide.title} သို့ သွားပါ`}
									title={slide.title}
								/>
							))}
						</div>

						<button
							type="button"
							className="guide-nav-btn guide-nav-next"
							onClick={() => setActiveSlide((prev) => (prev + 1) % GUIDE_SLIDES.length)}
							disabled={activeSlide === GUIDE_SLIDES.length - 1}
							aria-label="နောက် စာမျက်နှာသို့ (Next)"
						>
							နောက်သို့ ›
						</button>
					</div>

					{/* Action Buttons */}
					<div className="guide-action-buttons">
						<button type="button" className="guide-btn-secondary" onClick={onClose}>
							✕ ပိတ်မည်
						</button>
						{onStart && (
							<button
								type="button"
								className="guide-btn-primary"
								onClick={() => {
									onClose();
									onStart();
								}}
							>
								🚀 စတင်မယ်
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
