import { formatPeso } from '../../utils/currency';

interface QuickAmountsProps {
  amounts: number[];
  onSelect: (amount: number) => void;
  selected?: number;
}

export default function QuickAmounts({ amounts, onSelect, selected }: QuickAmountsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {amounts.map(a => (
        <button
          key={a}
          onClick={() => onSelect(a)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            selected === a
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 active:bg-gray-200'
          }`}
        >
          {formatPeso(a)}
        </button>
      ))}
    </div>
  );
}
