import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, SendHorizonal, Wallet, MapPin } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';

type Filter = 'all' | 'with_balance' | 'fully_paid';

export default function Clients() {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  const resetForm = () => {
    setName('');
    setContactNumber('');
    setAddress('');
    setLat(undefined);
    setLng(undefined);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (client: (typeof clients)[0]) => {
    setName(client.name);
    setContactNumber(client.contact_number);
    setAddress(client.address ?? '');
    setLat(client.latitude);
    setLng(client.longitude);
    setEditingId(client.id);
    setShowForm(true);
  };

  void handleEdit; // available for inline edit triggers

  const handlePinLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); toast.success('Location pinned!'); },
      () => toast.error('Could not get location')
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Please enter a name'); return; }
    if (!contactNumber.trim()) { toast.error('Please enter a contact number'); return; }

    if (editingId) {
      await updateClient(editingId, {
        name: name.trim(),
        contact_number: contactNumber.trim(),
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
      toast.success('Client updated!');
    } else {
      await addClient({
        name: name.trim(),
        contact_number: contactNumber.trim(),
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
      toast.success('Client added!');
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteClient(id);
    setConfirmDelete(null);
    toast.success('Client deleted');
  };

  const filtered = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'with_balance') return matchesSearch && c.outstanding_balance > 0;
    if (filter === 'fully_paid') return matchesSearch && c.outstanding_balance <= 0;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Clients" />

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'with_balance', 'fully_paid'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f === 'all' ? 'All' : f === 'with_balance' ? 'With Balance' : 'Fully Paid'}
            </button>
          ))}
        </div>

        {/* Add Button / Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
          >
            <Plus size={18} /> Add Client
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {editingId ? 'Edit Client' : 'Add Client'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Client name"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
              <input
                type="tel"
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                placeholder="09XX XXX XXXX"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Street, Barangay, City"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handlePinLocation}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium"
            >
              <MapPin size={16} />
              {lat ? `Pinned: ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : 'Pin Current Location'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
              >
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Client List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title={search ? 'No clients found' : 'No clients yet'}
            description={search ? 'Try a different search term.' : 'Add your first client to get started.'}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact_number}</p>
                  </div>
                  <p className={`text-sm font-bold ${c.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {c.outstanding_balance > 0 ? formatPeso(c.outstanding_balance) : 'Paid'}
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => navigate(`/disburse?client=${c.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium"
                  >
                    <SendHorizonal size={14} /> Disburse
                  </button>
                  <button
                    onClick={() => navigate(`/payments?client=${c.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-green-50 text-green-600 text-xs font-medium"
                  >
                    <Wallet size={14} /> Pay
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="py-2 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>

                {confirmDelete === c.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium"
                    >
                      Confirm Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
