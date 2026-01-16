'use client';

import { Event } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EventCardProps {
    event: Event;
}

export function EventCard({ event }: EventCardProps) {
    return (
        <Card className="w-[280px] flex-shrink-0 hover:shadow-md transition-shadow overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-orange-400 via-yellow-400 to-purple-400 flex items-center justify-center">
                <div className="text-white text-center p-4">
                    <p className="text-sm font-medium">活動海報</p>
                    <p className="text-xs mt-1 opacity-90">{event.title}</p>
                </div>
            </div>

            <CardContent className="p-4">
                <div className="space-y-3">
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                        {event.title}
                    </h3>

                    <p className="text-sm text-gray-600 line-clamp-2">
                        {event.description}
                    </p>

                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="h-4 w-4 text-orange-500" />
                            <span>{event.date}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-700">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span>{event.location}</span>
                        </div>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full" size="sm">
                    查看詳情
                </Button>
            </CardFooter>
        </Card>
    );
}
