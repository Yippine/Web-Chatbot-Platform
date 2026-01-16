import { Brand } from '@/types';

export const brands: Brand[] = [
    {
        id: 'apple',
        name: 'Apple Store',
        floor: '2F',
        category: ['3C', '手機', '電腦'],
        keywords: ['Apple', 'iPhone', 'iPad', 'Mac', '蘋果', '手機', '電腦', '筆電'],
        hours: '11:00 - 22:00',
        description: 'Apple 官方授權經銷商，提供 iPhone、iPad、Mac 等全系列產品'
    },
    {
        id: 'razer',
        name: 'Razer Store',
        floor: '2F',
        category: ['3C', '電競', '周邊'],
        keywords: ['Razer', '雷蛇', '鍵盤', '滑鼠', '電競', '遊戲', '周邊'],
        hours: '11:00 - 22:00',
        description: '電競品牌 Razer 旗艦店，提供電競鍵盤、滑鼠、耳機等專業設備'
    },
    {
        id: 'sony',
        name: 'Sony Store',
        floor: '3F',
        category: ['3C', '相機', '音響'],
        keywords: ['Sony', '索尼', '相機', '耳機', '音響', '攝影'],
        hours: '11:00 - 22:00',
        description: 'Sony 官方旗艦店，展示相機、耳機、音響等影音產品'
    },
    {
        id: 'dyson',
        name: 'Dyson',
        floor: '4F',
        category: ['家電', '生活'],
        keywords: ['Dyson', '戴森', '吸塵器', '吹風機', '空氣清淨機', '家電'],
        hours: '11:00 - 22:00',
        description: 'Dyson 官方體驗店，提供吸塵器、吹風機、空氣清淨機等產品'
    },
    {
        id: 'lego',
        name: 'LEGO Store',
        floor: '6F',
        category: ['玩具', '模型'],
        keywords: ['LEGO', '樂高', '積木', '玩具', '模型'],
        hours: '11:00 - 22:00',
        description: 'LEGO 官方認證專賣店，提供各系列樂高積木與限定商品'
    },
    {
        id: 'gundam',
        name: 'GUNDAM BASE',
        floor: '6F',
        category: ['模型', '動漫'],
        keywords: ['鋼彈', 'Gundam', '模型', '公仔', '動漫', '模型'],
        hours: '11:00 - 22:00',
        description: '鋼彈模型專賣店，提供各式鋼彈模型與周邊商品'
    },
    {
        id: 'animate',
        name: 'Animate',
        floor: '6F',
        category: ['動漫', '周邊'],
        keywords: ['動漫', '漫畫', '公仔', '周邊', 'Animate'],
        hours: '11:00 - 22:00',
        description: '日本動漫專賣店，提供漫畫、輕小說、動漫周邊商品'
    },
    {
        id: 'xiaomi',
        name: '小米專賣店',
        floor: '2F',
        category: ['3C', '手機', '智能家居'],
        keywords: ['小米', 'Xiaomi', '手機', '智能家居', '米家', '家電'],
        hours: '11:00 - 22:00',
        description: '小米官方授權專賣店，提供小米手機與米家智能家居產品'
    }
];
