import { useState, useCallback } from 'react';
import { Delete } from 'lucide-react';

interface PinLockProps {
  correctPin: string;
  onUnlock: () => void;
}

export default function PinLock({ correctPin, onUnlock }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    setError(false);
    const next = pin + digit;
    if (next.length === correctPin.length) {
      if (next === correctPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    } else {
      setPin(next);
    }
  }, [pin, correctPin, onUnlock]);

  const handleDelete = useCallback(() => {
    setError(false);
    setPin(p => p.slice(0, -1));
  }, []);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">LT</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">LoadTrack</h1>
        <p className="text-sm text-gray-500 mt-1">Enter PIN to continue</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8">
        {Array.from({ length: correctPin.length }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              error
                ? 'bg-red-500'
                : i < pin.length
                ? 'bg-blue-600 scale-110'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium mb-4">Incorrect PIN</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                className="h-16 rounded-2xl flex items-center justify-center text-gray-600 active:bg-gray-200 transition-colors"
              >
                <Delete size={24} />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-white border border-gray-200 text-xl font-semibold text-gray-800 active:bg-blue-50 active:border-blue-300 transition-colors shadow-sm"
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
