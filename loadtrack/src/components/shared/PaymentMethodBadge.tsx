interface PaymentMethodBadgeProps {
  method: 'cash' | 'gcash' | 'online_transfer';
}

const styles = {
  cash: 'bg-gray-100 text-gray-700',
  gcash: 'bg-purple-100 text-purple-700',
  online_transfer: 'bg-teal-100 text-teal-700',
};

const labels = {
  cash: 'Cash',
  gcash: 'GCash',
  online_transfer: 'Online',
};

export default function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[method]}`}>
      {labels[method]}
    </span>
  );
}
