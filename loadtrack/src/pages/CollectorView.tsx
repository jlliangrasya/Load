import { useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, List, Map, X } from 'lucide-react';
import { formatPeso } from '../utils/currency';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface CollectorClient {
  id: string;
  name: string;
  contact: string;
  address: string;
  balance: number;
  lat?: number;
  lng?: number;
  collectorName: string;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.flyTo([lat, lng], 16, { duration: 0.8 });
  return null;
}

function ClickAway({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: onClose });
  return null;
}

export default function CollectorView({ clients }: { clients: CollectorClient[] }) {
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const setMarkerRef = useCallback((id: string, ref: L.Marker | null) => {
    markerRefs.current[id] = ref;
  }, []);

  const collectorName = clients[0]?.collectorName ?? 'Collector';
  const totalBalance = clients.reduce((s, c) => s + c.balance, 0);
  const mappedClients = useMemo(() => clients.filter(c => c.lat && c.lng), [clients]);
  const center: [number, number] = mappedClients.length > 0
    ? [mappedClients[0].lat!, mappedClients[0].lng!]
    : [14.5995, 120.9842];

  const handleLocate = (c: CollectorClient) => {
    if (!c.lat || !c.lng) return;
    setTab('map');
    setFlyTarget({ lat: c.lat, lng: c.lng });
    setActivePopup(c.id);
    setTimeout(() => {
      markerRefs.current[c.id]?.openPopup();
    }, 900);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 pt-10 pb-4">
        <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Collection List for</p>
        <h1 className="text-lg font-bold">{collectorName}</h1>
        <p className="text-sm text-blue-100 mt-1">
          {clients.length} client{clients.length !== 1 ? 's' : ''} &middot; Total: {formatPeso(totalBalance)}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-200">
        <button
          onClick={() => setTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          <List size={16} /> List
        </button>
        <button
          onClick={() => setTab('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'map' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          <Map size={16} /> Map
        </button>
      </div>

      {/* List tab */}
      {tab === 'list' && (
        <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-20">
          {clients.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">No clients to collect from.</div>
          )}
          {clients.map((c, idx) => (
            <div key={c.id} className="bg-white rounded-xl border border-amber-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact}</p>
                    {c.address && <p className="text-xs text-gray-400">{c.address}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-red-600">{formatPeso(c.balance)}</p>
                  {c.lat && c.lng && (
                    <button
                      onClick={() => handleLocate(c)}
                      className="mt-1 flex items-center gap-1 text-xs text-blue-600 font-medium"
                    >
                      <MapPin size={12} /> View on map
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map tab */}
      {tab === 'map' && (
        <div className="flex-1 relative">
          {mappedClients.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50">
              <p className="text-sm text-gray-400 text-center px-8">
                No clients on this list have a pinned location.
              </p>
            </div>
          )}
          <MapContainer center={center} zoom={13} className="h-full w-full" style={{ minHeight: 'calc(100vh - 140px)' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappedClients.map(c => (
              <Marker
                key={c.id}
                position={[c.lat!, c.lng!]}
                ref={ref => setMarkerRef(c.id, ref)}
                eventHandlers={{
                  click: () => setActivePopup(c.id),
                }}
              >
                <Popup>
                  <div className="text-xs min-w-[140px]">
                    <p className="font-bold text-sm text-gray-900">{c.name}</p>
                    <p className="text-gray-500">{c.contact}</p>
                    {c.address && <p className="text-gray-400 mt-0.5">{c.address}</p>}
                    <p className="font-bold text-red-600 mt-1">Balance: {formatPeso(c.balance)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {flyTarget && (
              <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} key={`${flyTarget.lat}-${flyTarget.lng}`} />
            )}
            {activePopup && <ClickAway onClose={() => setActivePopup(null)} />}
          </MapContainer>

          {/* Mini client list on map */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-h-40 overflow-y-auto z-[1000]">
            {mappedClients.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setFlyTarget({ lat: c.lat!, lng: c.lng! });
                  setActivePopup(c.id);
                  setTimeout(() => markerRefs.current[c.id]?.openPopup(), 900);
                }}
                className="w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center justify-between active:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.address && <p className="text-xs text-gray-400">{c.address}</p>}
                </div>
                <span className="text-xs font-bold text-red-600 shrink-0 ml-2">{formatPeso(c.balance)}</span>
              </button>
            ))}
            {clients.filter(c => !c.lat || !c.lng).map(c => (
              <div key={c.id} className="px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center justify-between opacity-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">No location pinned</p>
                </div>
                <span className="text-xs font-bold text-red-600 shrink-0 ml-2">{formatPeso(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Name prompt shown when the link is first opened ── */
export function CollectorNameGate({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <List size={28} className="text-blue-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Collection List</h1>
          <p className="text-sm text-gray-500 mt-1">Please enter your full name to continue.</p>
        </div>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); }}
          placeholder="Your full name"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          disabled={!value.trim()}
          onClick={() => onConfirm(value.trim())}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40"
        >
          View Collection List
        </button>
      </div>
    </div>
  );
}
