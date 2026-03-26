interface StatusBadgeProps {
  status: 'success' | 'failed' | 'returned';
}

const styles = {
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  returned: 'bg-amber-100 text-amber-700',
};

const labels = {
  success: 'Success',
  failed: 'Failed',
  returned: 'Returned',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
