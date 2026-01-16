'use client';

interface QuickAction {
    icon: string;
    text: string;
    query: string;
}

interface QuickActionsProps {
    actions: QuickAction[];
    onActionClick: (query: string) => void;
}

export function QuickActions({ actions, onActionClick }: QuickActionsProps) {
    return (
        <div className="flex gap-2 p-3 overflow-x-auto">
            {actions.map((action, index) => (
                <button
                    key={index}
                    onClick={() => onActionClick(action.query)}
                    className="px-4 py-2 rounded-full text-sm whitespace-nowrap bg-blue-100 text-blue-700 hover:opacity-80 flex items-center gap-2"
                >
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                </button>
            ))}
        </div>
    );
}
