import { Restaurant } from '@/types';

export const restaurants: Restaurant[] = [
    {
        id: 'starbucks',
        name: 'Starbucks',
        type: '咖啡廳',
        floor: '1F',
        hours: '08:00 - 22:00',
        description: '提供各式咖啡、茶飲與輕食'
    },
    {
        id: 'mcdonald',
        name: "McDonald's",
        type: '速食',
        floor: 'B1',
        hours: '10:00 - 22:00',
        description: '經典速食餐廳，提供漢堡、薯條等餐點'
    },
    {
        id: 'mos-burger',
        name: 'MOS Burger',
        type: '速食',
        floor: 'B1',
        hours: '10:00 - 22:00',
        description: '日式漢堡專賣店，主打新鮮食材'
    },
    {
        id: 'din-tai-fung',
        name: '鼎泰豐',
        type: '中式料理',
        floor: '5F',
        hours: '11:00 - 21:30',
        description: '知名小籠包餐廳，提供精緻中式料理'
    },
    {
        id: 'yakiniku',
        name: '燒肉 Like',
        type: '日式料理',
        floor: '5F',
        hours: '11:30 - 22:00',
        description: '一人燒肉專門店，快速方便的用餐選擇'
    },
    {
        id: 'louisa',
        name: '路易莎咖啡',
        type: '咖啡廳',
        floor: '5F',
        hours: '08:00 - 22:00',
        description: '台灣連鎖咖啡品牌，提供咖啡與輕食'
    },
    {
        id: 'ramen',
        name: '一蘭拉麵',
        type: '日式料理',
        floor: 'B1',
        hours: '11:00 - 22:00',
        description: '日本知名拉麵店，主打豚骨拉麵'
    }
];

// Helper function to filter restaurants by type
export function getRestaurantsByType(type: string): Restaurant[] {
    return restaurants.filter(r => r.type.includes(type) || type.includes(r.type));
}
