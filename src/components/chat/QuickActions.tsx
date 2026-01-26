'use client';

interface QuickAction {
    service_id: string;
    query: string;
}

interface QuickActionsProps {
    actions: QuickAction[];
    services: any;
    onActionClick: (action: QuickAction) => void;
}

export function QuickActions({ actions, services, onActionClick }: QuickActionsProps) {
    return (
        <div className="flex gap-2 p-3 overflow-x-auto">
            {actions.map((action, index) => {
                const service = services[action.service_id];
                if (!service) return null;
                
                return (
                    <button
                        key={index}
                        onClick={() => onActionClick(action)}
                        className="px-4 py-2 rounded-full text-sm whitespace-nowrap bg-blue-100 text-blue-700 hover:opacity-80 flex items-center gap-2"
                    >
                        <span>{service.icon}</span>
                        <span>{service.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
