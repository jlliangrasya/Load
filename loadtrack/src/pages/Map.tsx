import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, X, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClients } from '../hooks/useClients';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import PinLocationModal from '../components/shared/PinLocationModal';
import toast from 'react-hot-toast';
import type { Client } from '../types';

// Fix default Leaflet marker icons
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

const highlightIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [35, 56],
  iconAnchor: [17, 56],
  popupAnchor: [1, -46],
  shadowSize: [56, 56],
});

const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component that flies to a target and opens its popup
function FlyToTarget({ target, markerRefs }: {
  target: { id: string; lat: number; lng: number } | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], 16, { duration: 0.8 });
    // Open popup after fly animation
    const timer = setTimeout(() => {
      const marker = markerRefs.current[target.id];
      if (marker) marker.openPopup();
    }, 900);
    return () => clearTimeout(timer);
  }, [target, map, markerRefs]);

  return null;
}

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const sharedData = searchParams.get('data');

  if (sharedData) {
    return <SharedMapView data={sharedData} />;
  }

  return <FullMapView />;
}

function FullMapView() {
  const { clients: allClients } = useClients();
  const clients = allClients.length > 0 ? allClients : undefined;
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const [pinningClient, setPinningClient] = useState<Client | null>(null);

  const pinnedClients = useMemo(
    () => (clients ?? []).filter(c => c.latitude && c.longitude),
    [clients]
  );
  const unpinnedClients = useMemo(
    () => (clients ?? []).filter(c => !c.latitude || !c.longitude),
    [clients]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return pinnedClients;
    const q = search.toLowerCase();
    return pinnedClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contact_number.includes(q) ||
      (c.address ?? '').toLowerCase().includes(q)
    );
  }, [search, pinnedClients]);

  const center: [number, number] = pinnedClients.length > 0
    ? [pinnedClients[0].latitude!, pinnedClients[0].longitude!]
    : [14.5995, 120.9842];

  const handleSelectClient = (c: Client) => {
    setFlyTarget({ id: c.id, lat: c.latitude!, lng: c.longitude! });
    setShowResults(false);
    setSearch('');
  };

  const setMarkerRef = useCallback((id: string, ref: L.Marker | null) => {
    markerRefs.current[id] = ref;
  }, []);


  const handlePinConfirm = async (lat: number, lng: number) => {
    if (!pinningClient) return;
    await supabase.from('clients').update({
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    }).eq('id', pinningClient.id);
    toast.success(`Location pinned for ${pinningClient.name}`);
    setPinningClient(null);
  };

  const isLoading = clients === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Map" showBack />
        <div className="p-4"><div className="bg-white rounded-xl h-64 animate-pulse" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Client Map" showBack />

      <div className="p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search client name, number, or address..."
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowResults(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={16} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {showResults && search.trim() && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No pinned clients match</p>
              ) : (
                searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.contact_number}</p>
                      {c.address && <p className="text-xs text-gray-400">{c.address}</p>}
                    </div>
                    <Navigation size={14} className="text-blue-500 shrink-0 ml-2" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>



        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '50vh' }}>
          <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pinnedClients.map(c => (
              <Marker
                key={c.id}
                position={[c.latitude!, c.longitude!]}
                icon={flyTarget?.id === c.id ? highlightIcon : defaultIcon}
                ref={(ref) => setMarkerRef(c.id, ref)}
              >
                <Popup>
                  <div className="text-xs min-w-[140px]">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-gray-500">{c.contact_number}</p>
                    {c.address && <p className="text-gray-400 mt-0.5">{c.address}</p>}
                    <p className={`font-bold mt-1 ${c.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Balance: {formatPeso(c.outstanding_balance)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            <FlyToTarget target={flyTarget} markerRefs={markerRefs} />
          </MapContainer>
        </div>

        {/* Pinned Client List */}
        {pinnedClients.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              All pinned clients ({pinnedClients.length})
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {pinnedClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectClient(c)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between active:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.address ?? c.contact_number}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-semibold ${c.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatPeso(c.outstanding_balance)}
                    </span>
                    <Navigation size={14} className="text-blue-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unpinned Clients */}
        {unpinnedClients.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Clients without location</h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {unpinnedClients.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact_number}</p>
                  </div>
                  <button
                    onClick={() => setPinningClient(c)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium"
                  >
                    <MapPin size={14} /> Pin Location
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pinningClient && (
        <PinLocationModal
          onConfirm={handlePinConfirm}
          onClose={() => setPinningClient(null)}
        />
      )}
    </div>
  );
}

interface SharedPin {
  n: string;
  a: string;
  lt: number;
  ln: number;
  p?: string;
}

function SharedMapView({ data }: { data: string }) {
  let pins: SharedPin[] = [];
  try {
    pins = JSON.parse(atob(data));
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-sm text-red-500">Invalid shared map link.</p>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-sm text-gray-500">No client locations in this shared map.</p>
      </div>
    );
  }

  return <SharedMapInner pins={pins} />;
}

function SharedMapInner({ pins }: { pins: SharedPin[] }) {
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const center: [number, number] = [pins[0].lt, pins[0].ln];

  const searchResults = useMemo(() => {
    if (!search.trim()) return pins;
    const q = search.toLowerCase();
    return pins.filter(p =>
      p.n.toLowerCase().includes(q) ||
      (p.a ?? '').toLowerCase().includes(q) ||
      (p.p ?? '').includes(q)
    );
  }, [search, pins]);

  const handleSelect = (pin: SharedPin, idx: number) => {
    setFlyTarget({ id: String(idx), lat: pin.lt, lng: pin.ln });
    setShowResults(false);
    setSearch('');
  };

  const setMarkerRef = useCallback((id: string, ref: L.Marker | null) => {
    markerRefs.current[id] = ref;
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 text-center">
        <h1 className="text-base font-semibold">LoadTrack - Collector Map</h1>
        <p className="text-xs text-blue-200">{pins.length} client location(s)</p>
      </header>

      {/* Search */}
      <div className="px-3 py-2 bg-white border-b border-gray-200 relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search client..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowResults(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showResults && search.trim() && (
          <div className="absolute z-20 left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No clients match</p>
            ) : (
              searchResults.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(p, pins.indexOf(p))}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.n}</p>
                    {p.a && <p className="text-xs text-gray-400">{p.a}</p>}
                  </div>
                  <Navigation size={14} className="text-blue-500 shrink-0 ml-2" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((pin, i) => (
            <Marker
              key={i}
              position={[pin.lt, pin.ln]}
              icon={flyTarget?.id === String(i) ? highlightIcon : defaultIcon}
              ref={(ref) => setMarkerRef(String(i), ref)}
            >
              <Popup>
                <div className="text-xs min-w-[120px]">
                  <p className="font-semibold text-sm">{pin.n}</p>
                  {pin.a && <p className="text-gray-500">{pin.a}</p>}
                  {pin.p && <p className="text-gray-400">{pin.p}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
          <FlyToTarget target={flyTarget} markerRefs={markerRefs} />
        </MapContainer>
      </div>

      {/* Client List */}
      <div className="bg-white border-t border-gray-200 max-h-40 overflow-y-auto">
        {pins.map((pin, i) => (
          <button
            key={i}
            onClick={() => handleSelect(pin, i)}
            className="w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center justify-between active:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{pin.n}</p>
              {pin.a && <p className="text-xs text-gray-400">{pin.a}</p>}
            </div>
            <Navigation size={14} className="text-blue-400 shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
}
