interface NetworkBadgeProps {
  network: 'smart' | 'globe';
}

export default function NetworkBadge({ network }: NetworkBadgeProps) {
  const isS = network === 'smart';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
      isS ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
    }`}>
      {isS ? 'Smart' : 'Globe'}
    </span>
  );
}
