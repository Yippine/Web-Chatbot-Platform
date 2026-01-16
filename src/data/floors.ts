import { Floor } from '@/types';

export const floors: Floor[] = [
    {
        id: 'b2',
        level: 'B2',
        name: '停車場',
        facilities: ['停車場', '電梯'],
        mapImage: '/images/floors/b2.png'
    },
    {
        id: 'b1',
        level: 'B1',
        name: '美食街',
        facilities: ['美食街', '廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/b1.png'
    },
    {
        id: '1f',
        level: '1F',
        name: '精品生活',
        facilities: ['服務台', '廁所', '電梯', '手扶梯', '出入口'],
        mapImage: '/images/floors/1f.png'
    },
    {
        id: '2f',
        level: '2F',
        name: '數位潮流區',
        facilities: ['廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/2f.png'
    },
    {
        id: '3f',
        level: '3F',
        name: '影音娛樂',
        facilities: ['廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/3f.png'
    },
    {
        id: '4f',
        level: '4F',
        name: '生活家電',
        facilities: ['廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/4f.png'
    },
    {
        id: '5f',
        level: '5F',
        name: '餐飲休憩',
        facilities: ['餐廳', '廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/5f.png'
    },
    {
        id: '6f',
        level: '6F',
        name: '動漫基地',
        facilities: ['廁所', '電梯', '手扶梯'],
        mapImage: '/images/floors/6f.png'
    }
];

// Helper function to find floor by facility
export function findFloorByFacility(facility: string): Floor | undefined {
    return floors.find(floor =>
        floor.facilities.some(f => f.includes(facility) || facility.includes(f))
    );
}
