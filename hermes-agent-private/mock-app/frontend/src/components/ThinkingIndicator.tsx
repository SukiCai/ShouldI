export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3" aria-label="thinking">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
