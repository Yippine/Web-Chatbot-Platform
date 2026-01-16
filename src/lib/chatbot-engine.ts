import { Message, CardData, Brand, Event, Restaurant } from '@/types';
import { identifyIntent, extractKeywords, matchKeywords } from './keyword-matcher';
import { brands } from '@/data/brands';
import { floors, findFloorByFacility } from '@/data/floors';
import { events } from '@/data/events';
import { restaurants, getRestaurantsByType } from '@/data/restaurants';
import { greetingResponses, unknownResponses } from '@/data/responses';

/**
 * Process user input and generate bot response
 */
export function processUserInput(input: string): Message[] {
    const { intent, matchedKeywords } = identifyIntent(input);
    const responses: Message[] = [];

    switch (intent) {
        case 'greeting':
            responses.push(createTextMessage(getRandomResponse(greetingResponses)));
            break;

        case 'brand':
            responses.push(...handleBrandQuery(input, matchedKeywords));
            break;

        case 'floor':
            responses.push(...handleFloorQuery(input, matchedKeywords));
            break;

        case 'event':
            responses.push(...handleEventQuery());
            break;

        case 'restaurant':
            responses.push(...handleRestaurantQuery(input, matchedKeywords));
            break;

        default:
            responses.push(createTextMessage(getRandomResponse(unknownResponses)));
    }

    return responses;
}

/**
 * Handle brand-related queries
 */
function handleBrandQuery(input: string, matchedKeywords: string[]): Message[] {
    const results: Brand[] = [];

    // Search brands by keywords
    for (const brand of brands) {
        const score = matchKeywords(input, [...brand.keywords, brand.name]);
        if (score > 0) {
            results.push(brand);
        }
    }

    if (results.length === 0) {
        return [createTextMessage('抱歉，找不到相關的品牌。您可以試試搜尋其他關鍵字，或是點選「找品牌」查看所有品牌。')];
    }

    // Sort by relevance (this is simplified, could be improved)
    results.sort((a, b) => {
        const scoreA = matchKeywords(input, [...a.keywords, a.name]);
        const scoreB = matchKeywords(input, [...b.keywords, b.name]);
        return scoreB - scoreA;
    });

    // Take top 3 results
    const topResults = results.slice(0, 3);

    if (topResults.length === 1) {
        const brand = topResults[0];
        return [
            createTextMessage(`${brand.name} 位於 **${brand.floor}**\n\n${brand.description}\n\n營業時間：${brand.hours}`)
        ];
    } else {
        const brandCards: CardData[] = topResults.map(brand => ({
            type: 'brand',
            data: brand
        }));

        return [
            createTextMessage(`為您找到 ${topResults.length} 個相關品牌：`),
            createCarouselMessage(brandCards)
        ];
    }
}

/**
 * Handle floor/facility queries
 */
function handleFloorQuery(input: string, matchedKeywords: string[]): Message[] {
    // Check if asking about specific facility
    const facilityKeywords = ['廁所', '洗手間', 'wc', '電梯', '手扶梯', '停車', '停車場', '出口', '入口', '服務台'];

    for (const keyword of facilityKeywords) {
        if (input.includes(keyword)) {
            const floor = findFloorByFacility(keyword);
            if (floor) {
                return [
                    createTextMessage(`${keyword}位於多個樓層，以下是主要位置：\n\n• **${floor.level}** ${floor.name}\n\n您也可以前往 1F 服務台詢問詳細位置。`)
                ];
            }
        }
    }

    // General floor information
    return [
        createTextMessage('三創生活共有 B2 到 6F，各樓層主題如下：\n\n• **B2** 停車場\n• **B1** 美食街\n• **1F** 精品生活\n• **2F** 數位潮流區\n• **3F** 影音娛樂\n• **4F** 生活家電\n• **5F** 餐飲休憩\n• **6F** 動漫基地')
    ];
}

/**
 * Handle event queries
 */
function handleEventQuery(): Message[] {
    if (events.length === 0) {
        return [createTextMessage('目前沒有進行中的活動，請持續關注我們的最新消息！')];
    }

    const eventCards: CardData[] = events.map(event => ({
        type: 'event',
        data: event
    }));

    return [
        createTextMessage(`目前有 ${events.length} 個精彩活動：`),
        createCarouselMessage(eventCards)
    ];
}

/**
 * Handle restaurant queries
 */
function handleRestaurantQuery(input: string, matchedKeywords: string[]): Message[] {
    let results: Restaurant[] = [];

    // Check for specific type
    const typeKeywords = ['咖啡', '速食', '日式', '中式'];
    for (const typeKw of typeKeywords) {
        if (input.includes(typeKw)) {
            results = getRestaurantsByType(typeKw);
            break;
        }
    }

    // If no specific type, show all
    if (results.length === 0) {
        results = restaurants;
    }

    if (results.length === 0) {
        return [createTextMessage('抱歉，找不到符合條件的餐廳。')];
    }

    const restaurantCards: CardData[] = results.slice(0, 5).map(restaurant => ({
        type: 'restaurant',
        data: restaurant
    }));

    return [
        createTextMessage(`為您推薦 ${results.length} 間餐廳：`),
        createCarouselMessage(restaurantCards)
    ];
}

/**
 * Helper: Create text message
 */
function createTextMessage(content: string): Message {
    return {
        id: generateId(),
        sender: 'bot',
        type: 'text',
        content,
        timestamp: new Date()
    };
}

/**
 * Helper: Create carousel message
 */
function createCarouselMessage(cards: CardData[]): Message {
    return {
        id: generateId(),
        sender: 'bot',
        type: 'carousel',
        content: cards,
        timestamp: new Date()
    };
}

/**
 * Helper: Get random response from array
 */
function getRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Helper: Generate unique ID
 */
function generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
