import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { ChevronDown, ChevronUp, FileDown, FileSpreadsheet } from 'lucide-react';
import { useCapital } from '../hooks/useCapital';
import { useDisbursements } from '../hooks/useDisbursements';
import { usePayments } from '../hooks/usePayments';
import { useExpenses } from '../hooks/useExpenses';
import { useClients } from '../hooks/useClients';
import { formatPeso } from '../utils/currency';
import { calculateProfitSummary } from '../utils/profit';
import { exportProfitReportPdf } from '../utils/exportPdf';
import { exportFullReportXlsx } from '../utils/exportXlsx';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import toast from 'react-hot-toast';
import type { Client } from '../types';

type ViewMode = 'monthly' | 'session';

export default function Reports() {
  const [view, setView] = useState<ViewMode>('monthly');
  const [monthStr, setMonthStr] = useState(format(new Date(), 'yyyy-MM'));
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const { capitals } = useCapital();
  const { disbursements: allDisbursements } = useDisbursements();
  const { payments: allPayments } = usePayments();
  const { expenses: allExpenses } = useExpenses();
  const { clients } = useClients();
  const clientsMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  // Monthly calculations
  const monthStart = startOfMonth(parseISO(`${monthStr}-01`));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  const monthCapitals = useMemo(
    () => (capitals).filter(c => c.date >= monthStartStr && c.date <= monthEndStr),
    [capitals, monthStartStr, monthEndStr]
  );

  const monthDisbursements = useMemo(
    () => (allDisbursements).filter(d => d.date >= monthStartStr && d.date <= monthEndStr),
    [allDisbursements, monthStartStr, monthEndStr]
  );

  const monthPayments = useMemo(
    () => (allPayments).filter(p => p.date >= monthStartStr && p.date <= monthEndStr),
    [allPayments, monthStartStr, monthEndStr]
  );

  const monthExpenses = useMemo(
    () => (allExpenses).filter(e => e.date >= monthStartStr && e.date <= monthEndStr),
    [allExpenses, monthStartStr, monthEndStr]
  );

  const summary = useMemo(
    () => calculateProfitSummary(monthStr, monthCapitals, monthDisbursements, monthExpenses),
    [monthStr, monthCapitals, monthDisbursements, monthExpenses]
  );

  // Chart data: Smart vs Globe disbursements by network
  const networkChartData = [
    {
      name: 'Smart',
      count: summary.by_network.smart.disbursed_count,
      failed: summary.by_network.smart.failed_count,
    },
    {
      name: 'Globe',
      count: summary.by_network.globe.disbursed_count,
      failed: summary.by_network.globe.failed_count,
    },
  ];

  // Chart data: daily collections
  const dailyCollections = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const total = monthPayments
        .filter(p => p.date === dayStr)
        .reduce((s, p) => s + p.amount, 0);
      return { day: format(day, 'd'), amount: total };
    });
  }, [monthStart, monthEnd, monthPayments]);

  // Session view data
  const sortedCapitals = useMemo(
    () => [...(capitals)].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [capitals]
  );

  const isLoading = false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Reports" showBack />
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Reports" showBack />

      <div className="p-4 space-y-4">
        {/* View Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setView('monthly')}
            className={`flex-1 py-3 text-sm font-semibold ${
              view === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setView('session')}
            className={`flex-1 py-3 text-sm font-semibold ${
              view === 'session' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            By Session
          </button>
        </div>

        {view === 'monthly' && (
          <>
            {/* Month Picker */}
            <input
              type="month"
              value={monthStr}
              onChange={e => setMonthStr(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Capital Spent" value={formatPeso(summary.total_capital_spent)} color="text-gray-900" />
              <SummaryCard label="Commission" value={formatPeso(summary.total_commission_earned)} color="text-green-600" />
              <SummaryCard label="Markup Earned" value={formatPeso(summary.total_markup_earned)} color="text-green-600" />
              <SummaryCard label="Gross Income" value={formatPeso(summary.total_gross_income)} color="text-blue-600" />
              <SummaryCard label="Losses (Failed)" value={formatPeso(summary.losses_from_failed)} color="text-red-600" />
              <SummaryCard label="Expenses" value={formatPeso(summary.total_expenses)} color="text-orange-600" />
              <SummaryCard label="Net Profit" value={formatPeso(summary.net_profit)} color={summary.net_profit >= 0 ? 'text-green-700' : 'text-red-700'} highlight />
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try { await exportProfitReportPdf(monthStr, summary); toast.success('PDF exported!'); }
                  catch { toast.error('Export failed'); }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-medium"
              >
                <FileDown size={16} /> Export PDF
              </button>
              <button
                onClick={async () => {
                  try { await exportFullReportXlsx(monthStr, summary); toast.success('Excel exported!'); }
                  catch { toast.error('Export failed'); }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-green-600 text-sm font-medium"
              >
                <FileSpreadsheet size={16} /> Export Excel
              </button>
            </div>

            {/* Bar Chart: Smart vs Globe */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Smart vs Globe Disbursements</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={networkChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Success" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line Chart: Daily Collections */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Collections</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dailyCollections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                  <Tooltip formatter={(value) => formatPeso(Number(value))} />
                  <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {view === 'session' && (
          sortedCapitals.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-12">No capital sessions recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {sortedCapitals.map(cap => {
                const isExpanded = expandedSession === cap.id;
                const sessionDisb = (allDisbursements).filter(d => d.capital_purchase_id === cap.id);
                const successDisb = sessionDisb.filter(d => d.status === 'success');
                const totalSold = successDisb.reduce((s, d) => s + d.selling_price, 0);
                const totalMarkup = successDisb.reduce((s, d) => s + d.markup, 0);
                const sessionProfit = cap.commission + totalMarkup;

                return (
                  <div key={cap.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : cap.id)}
                      className="w-full px-4 py-3 flex items-center justify-between"
                    >
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <NetworkBadge network={cap.network} />
                          <span className="text-xs text-gray-500">{cap.date}</span>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatPeso(cap.face_value)}
                          <span className="text-xs text-gray-400 ml-1">face value</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${sessionProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPeso(sessionProfit)}
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3">
                        {/* Session Summary */}
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[10px] text-gray-500 uppercase">Cost</p>
                            <p className="text-xs font-bold">{formatPeso(cap.cost_price)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[10px] text-gray-500 uppercase">Sold</p>
                            <p className="text-xs font-bold">{formatPeso(totalSold)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-[10px] text-gray-500 uppercase">Remaining</p>
                            <p className={`text-xs font-bold ${cap.remaining_balance < 500 ? 'text-red-600' : ''}`}>
                              {formatPeso(cap.remaining_balance)}
                            </p>
                          </div>
                        </div>

                        {/* Disbursement List */}
                        {sessionDisb.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">No disbursements from this batch</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500">{sessionDisb.length} disbursement(s)</p>
                            {sessionDisb
                              .sort((a, b) => b.created_at.localeCompare(a.created_at))
                              .map(d => (
                                <div key={d.id} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-medium text-gray-900">
                                      {clientsMap?.[d.client_id]?.name ?? 'Unknown'}
                                    </p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <StatusBadge status={d.status} />
                                      <span className="text-[10px] text-gray-400">{d.date}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs font-semibold">{formatPeso(d.selling_price)}</p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-green-50 border-2 border-green-200' : 'bg-white border border-gray-200'}`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
