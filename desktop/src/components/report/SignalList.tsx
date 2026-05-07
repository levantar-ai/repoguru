import type { Signal } from '@/services/grpc-client';

interface Props {
  signals: Signal[];
}

export function SignalList({ signals }: Props) {
  return (
    <ul className="space-y-1.5">
      {signals.map((signal) => (
        <li key={signal.name} className="flex items-start gap-2 text-xs">
          {signal.found ? (
            <svg
              className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <div className="flex-1 min-w-0">
            <span className={signal.found ? 'text-gray-300' : 'text-gray-500'}>{signal.name}</span>
            {signal.details && <span className="text-gray-600 ml-1">({signal.details})</span>}
            {signal.points > 0 && <span className="text-gray-600 ml-1">+{signal.points}pts</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
