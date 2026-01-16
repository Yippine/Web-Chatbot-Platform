import { Event } from '@/types';

export const events: Event[] = [
    {
        id: 'tech-expo-2025',
        title: '2025 未來科技展',
        date: '2025/11/20 - 2025/12/15',
        location: '1F 中庭',
        poster: '/images/events/tech-expo.jpg',
        description: '展示最新科技產品與創新應用，包含 AI、VR/AR、智能家居等主題'
    },
    {
        id: 'gundam-exhibition',
        title: '鋼彈模型特展',
        date: '2025/11/01 - 2025/12/31',
        location: '6F 動漫基地',
        poster: '/images/events/gundam.jpg',
        description: '展出限定版鋼彈模型與經典系列作品，鋼彈迷不容錯過'
    },
    {
        id: 'apple-workshop',
        title: 'Apple 創意工作坊',
        date: '每週六、日 14:00-16:00',
        location: '2F Apple Store',
        poster: '/images/events/apple-workshop.jpg',
        description: '免費參加 Apple 產品教學課程，學習攝影、影片剪輯等創意技巧'
    },
    {
        id: 'gaming-tournament',
        title: '電競大賽',
        date: '2025/12/10',
        location: '3F 電競區',
        poster: '/images/events/gaming.jpg',
        description: '年度電競賽事，獎金豐厚，歡迎玩家報名參加'
    }
];
