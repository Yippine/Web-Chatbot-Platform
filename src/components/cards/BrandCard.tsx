'use client';

import { Brand } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BrandCardProps {
    brand: Brand;
}

export function BrandCard({ brand }: BrandCardProps) {
    return (
        <Card className="w-[280px] flex-shrink-0 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="space-y-3">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">{brand.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{brand.description}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                            <MapPin className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">{brand.floor}</span>
                        </div>

                        <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span>{brand.hours}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                        {brand.category.slice(0, 3).map((cat, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 bg-gradient-to-r from-orange-100 to-purple-100 text-xs rounded-full text-gray-700"
                            >
                                {cat}
                            </span>
                        ))}
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
