'use client';

import { Restaurant } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { MapPin, Clock, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RestaurantCardProps {
    restaurant: Restaurant;
}

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
    return (
        <Card className="w-[280px] flex-shrink-0 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="space-y-3">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">{restaurant.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{restaurant.description}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                            <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">{restaurant.type}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-700">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span>{restaurant.floor}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="h-4 w-4 text-green-500" />
                            <span>{restaurant.hours}</span>
                        </div>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full" size="sm">
                    前往
                </Button>
            </CardFooter>
        </Card>
    );
}
