'use client';

import { Floor } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Building2 } from 'lucide-react';

interface FloorCardProps {
    floor: Floor;
}

export function FloorCard({ floor }: FloorCardProps) {
    return (
        <Card className="w-full max-w-md">
            <CardContent className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {floor.level}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">{floor.name}</h3>
                            <p className="text-sm text-gray-600">{floor.level} 樓層</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">設施：</p>
                        <div className="flex flex-wrap gap-2">
                            {floor.facilities.map((facility, idx) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-gray-100 text-sm rounded-full text-gray-700 flex items-center gap-1"
                                >
                                    <Building2 className="h-3 w-3" />
                                    {facility}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
