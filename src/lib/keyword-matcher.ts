import { Intent } from '@/types';

interface KeywordMatch {
    intent: Intent;
    confidence: number;
    matchedKeywords: string[];
}

// Intent keywords mapping
const intentKeywords = {
    greeting: ['你好', '哈囉', 'hi', 'hello', '嗨', '您好', '早安', '午安', '晚安'],
    brand: ['品牌', '店', '哪裡', '在哪', '位置', '櫃位', '專賣', '買', '購買', '找'],
    floor: ['樓層', '廁所', '洗手間', 'wc', '電梯', '手扶梯', '停車', '停車場', '出口', '入口', '服務台'],
    event: ['活動', '展覽', '展', '特展', '工作坊', '課程', '比賽', '賽事'],
    restaurant: ['餐廳', '吃', '美食', '食物', '咖啡', '午餐', '晚餐', '早餐', '飲料', '速食', '拉麵', '火鍋']
};

/**
 * Extract keywords from user input
 */
export function extractKeywords(input: string): string[] {
    // Convert to lowercase for matching
    const normalizedInput = input.toLowerCase().trim();

    // Split into words (handle both Chinese and English)
    const words: string[] = [];

    // Extract Chinese characters and words
    const chineseMatches = normalizedInput.match(/[\u4e00-\u9fa5]+/g) || [];
    words.push(...chineseMatches);

    // Extract English words
    const englishMatches = normalizedInput.match(/[a-z]+/g) || [];
    words.push(...englishMatches);

    return words;
}

/**
 * Identify user intent from input
 */
export function identifyIntent(input: string): KeywordMatch {
    const keywords = extractKeywords(input);
    const intentScores: { [key in Intent]?: number } = {};
    const matchedKeywords: { [key in Intent]?: string[] } = {};

    // Check greeting first (highest priority)
    for (const keyword of keywords) {
        if (intentKeywords.greeting.some(k => keyword.includes(k) || k.includes(keyword))) {
            return {
                intent: 'greeting',
                confidence: 1.0,
                matchedKeywords: [keyword]
            };
        }
    }

    // Score each intent based on keyword matches
    for (const [intent, intentWords] of Object.entries(intentKeywords)) {
        if (intent === 'greeting') continue; // Already handled

        let score = 0;
        const matched: string[] = [];

        for (const keyword of keywords) {
            for (const intentWord of intentWords) {
                if (keyword.includes(intentWord) || intentWord.includes(keyword)) {
                    score += 1;
                    matched.push(keyword);
                    break;
                }
            }
        }

        if (score > 0) {
            intentScores[intent as Intent] = score;
            matchedKeywords[intent as Intent] = matched;
        }
    }

    // Find the intent with highest score
    let maxScore = 0;
    let bestIntent: Intent = 'unknown';

    for (const [intent, score] of Object.entries(intentScores)) {
        if (score > maxScore) {
            maxScore = score;
            bestIntent = intent as Intent;
        }
    }

    // Calculate confidence (normalize by number of keywords)
    const confidence = keywords.length > 0 ? maxScore / keywords.length : 0;

    return {
        intent: bestIntent,
        confidence,
        matchedKeywords: matchedKeywords[bestIntent] || []
    };
}

/**
 * Match keywords against a list of target keywords
 */
export function matchKeywords(input: string, targetKeywords: string[]): number {
    const inputKeywords = extractKeywords(input);
    let matchCount = 0;

    for (const inputKw of inputKeywords) {
        for (const targetKw of targetKeywords) {
            if (inputKw.includes(targetKw) || targetKw.includes(inputKw)) {
                matchCount++;
                break;
            }
        }
    }

    return matchCount;
}
