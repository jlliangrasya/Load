import type { CapitalPurchase, Disbursement, Expense, NetworkSummary, ProfitSummary } from '../types';

export function calculateProfitSummary(
  period: string,
  capitals: CapitalPurchase[],
  disbursements: Disbursement[],
  expenses: Expense[] = []
): ProfitSummary {
  const successDisbursements = disbursements.filter(d => d.status === 'success');
  const failedDisbursements = disbursements.filter(d => d.status === 'failed' || d.status === 'returned');

  const total_capital_spent = capitals.reduce((sum, c) => sum + c.cost_price, 0);
  const total_commission_earned = capitals.reduce((sum, c) => sum + c.commission, 0);
  const total_markup_earned = successDisbursements.reduce((sum, d) => sum + d.markup, 0);
  const gross_profit = total_commission_earned + total_markup_earned;
  const total_gross_income = successDisbursements.reduce((sum, d) => sum + d.selling_price, 0);
  const losses_from_failed = failedDisbursements.reduce((sum, d) => sum + d.face_value, 0);
  const total_expenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net_profit = gross_profit - losses_from_failed - total_expenses;

  function networkSummary(network: 'smart' | 'globe'): NetworkSummary {
    const netCapitals = capitals.filter(c => c.network === network);
    const netSuccess = successDisbursements.filter(d => d.network === network);
    const netFailed = failedDisbursements.filter(d => d.network === network);
    return {
      capital_spent: netCapitals.reduce((s, c) => s + c.cost_price, 0),
      commission: netCapitals.reduce((s, c) => s + c.commission, 0),
      markup: netSuccess.reduce((s, d) => s + d.markup, 0),
      disbursed_count: netSuccess.length,
      failed_count: netFailed.length,
    };
  }

  return {
    period,
    total_capital_spent,
    total_commission_earned,
    total_markup_earned,
    total_gross_income,
    gross_profit,
    losses_from_failed,
    total_expenses,
    net_profit,
    by_network: {
      smart: networkSummary('smart'),
      globe: networkSummary('globe'),
    },
  };
}
