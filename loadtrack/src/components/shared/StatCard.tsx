import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: string;
  onClick?: () => void;
}

export default function StatCard({ label, value, icon, color = 'text-gray-900', onClick }: StatCardProps) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 text-left ${onClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </Component>
  );
}
