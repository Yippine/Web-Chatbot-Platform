// Message types
export type MessageType = 'text' | 'card' | 'carousel' | 'floor-map' | 'quick-reply';

export interface Message {
    id: string;
    sender: 'user' | 'bot';
    type: MessageType;
    content: string | CardData | CardData[];
    timestamp: Date;
}

// Card data types
export interface CardData {
    type: 'brand' | 'event' | 'floor' | 'restaurant';
    data: Brand | Event | Floor | Restaurant;
}

// Brand data
export interface Brand {
    id: string;
    name: string;
    floor: string;
    category: string[];
    keywords: string[];
    hours: string;
    description: string;
    logo?: string;
}

// Event data
export interface Event {
    id: string;
    title: string;
    date: string;
    location: string;
    poster: string;
    description: string;
}

// Floor data
export interface Floor {
    id: string;
    level: string;
    name: string;
    facilities: string[];
    mapImage: string;
}

// Restaurant data
export interface Restaurant {
    id: string;
    name: string;
    type: string;
    floor: string;
    hours: string;
    image?: string;
    description: string;
}

// Intent types
export type Intent = 'brand' | 'floor' | 'event' | 'restaurant' | 'greeting' | 'unknown';
