export function LoadingMessage({ text = '思考中' }: { text?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm flex-shrink-0">
        🤖
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm max-w-[80%]">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-sm">{text}</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      </div>
    </div>
  );
}
