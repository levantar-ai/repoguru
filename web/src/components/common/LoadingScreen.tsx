const DOT_STYLES = Array.from({ length: 20 }).map((_, i) => ({
  key: i,
  width: `${((i * 7 + 3) % 4) + 2}px`,
  height: `${((i * 7 + 3) % 4) + 2}px`,
  left: `${(i * 17 + 5) % 100}%`,
  top: `${(i * 13 + 11) % 100}%`,
  animation: `float ${3 + ((i * 11) % 4)}s ease-in-out infinite`,
  animationDelay: `${((i * 7) % 30) / 10}s`,
}));

export function LoadingScreen() {
  return (
    <output
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a]"
      aria-label="Loading Repo Guru"
    >
      {/* Background animated dots — decorative */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {DOT_STYLES.map((dot) => (
          <div
            key={dot.key}
            className="absolute rounded-full bg-neon/10"
            style={{
              width: dot.width,
              height: dot.height,
              left: dot.left,
              top: dot.top,
              animation: dot.animation,
              animationDelay: dot.animationDelay,
            }}
          />
        ))}
      </div>

      {/* Logo with animated ring */}
      <div className="relative mb-8" aria-hidden="true">
        {/* Pulsing outer ring */}
        <div className="absolute inset-0 -m-4 rounded-full border-2 border-neon/30 animate-ping" />
        <div className="absolute inset-0 -m-2 rounded-full border border-neon/20 animate-pulse" />

        {/* Logo circle */}
        <div
          className="relative h-20 w-20 rounded-2xl bg-primary-500/15 flex items-center justify-center"
          style={{
            boxShadow: '0 0 40px rgba(56, 189, 248, 0.3), 0 0 80px rgba(56, 189, 248, 0.1)',
          }}
        >
          <svg
            className="h-10 w-10 text-neon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {/* Brand name */}
      <h1 className="text-4xl font-bold tracking-tight text-text mb-3">
        {'Repo'}
        <span className="text-neon" style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>
          Rev
        </span>
      </h1>

      {/* Loading indicator */}
      <div className="flex items-center gap-2 text-text-muted">
        <div className="flex gap-1" aria-hidden="true">
          <div
            className="h-1.5 w-1.5 rounded-full bg-neon animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-neon animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="h-1.5 w-1.5 rounded-full bg-neon animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-sm animate-pulse">Preparing your experience</span>
      </div>

      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
      `}</style>
    </output>
  );
}
