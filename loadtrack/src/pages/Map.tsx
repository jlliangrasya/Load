import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useLiveQuery } from 'dexie-react-hooks';
import { Share2, MapPin } from 'lucide-react';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
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

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const sharedData = searchParams.get('data');

  // If shared map, render read-only version
  if (sharedData) {
    return <SharedMapView data={sharedData} />;
  }

  return <FullMapView />;
}

function FullMapView() {
  const clients = useLiveQuery(() => db.clients.toArray(), []);

  const pinnedClients = useMemo(
    () => (clients ?? []).filter(c => c.latitude && c.longitude),
    [clients]
  );
  const unpinnedClients = useMemo(
    () => (clients ?? []).filter(c => !c.latitude || !c.longitude),
    [clients]
  );

  const center: [number, number] = pinnedClients.length > 0
    ? [pinnedClients[0].latitude!, pinnedClients[0].longitude!]
    : [14.5995, 120.9842]; // Default: Manila

  const handleShare = () => {
    const shareData = pinnedClients.map(c => ({
      n: c.name,
      a: c.address ?? '',
      lt: c.latitude,
      ln: c.longitude,
    }));
    const encoded = btoa(JSON.stringify(shareData));
    const url = `${window.location.origin}/map?data=${encoded}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } else {
      toast('Could not copy. URL is ready in the address bar.');
    }
  };

  const handlePinLocation = async (client: Client) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await db.clients.update(client.id, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          updated_at: new Date().toISOString(),
        });
        toast.success(`Location pinned for ${client.name}`);
      },
      () => toast.error('Could not get location')
    );
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

      <div className="p-4 space-y-4">
        {/* Share Button */}
        {pinnedClients.length > 0 && (
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
          >
            <Share2 size={16} /> Share Map with Collector
          </button>
        )}

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '50vh' }}>
          <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pinnedClients.map(c => (
              <Marker key={c.id} position={[c.latitude!, c.longitude!]}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-gray-500">{c.contact_number}</p>
                    <p className={`font-bold mt-1 ${c.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Balance: {formatPeso(c.outstanding_balance)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

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
                    onClick={() => handlePinLocation(c)}
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
    </div>
  );
}

interface SharedPin {
  n: string;
  a: string;
  lt: number;
  ln: number;
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

  const center: [number, number] = [pins[0].lt, pins[0].ln];

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 text-center">
        <h1 className="text-base font-semibold">LoadTrack - Collector Map</h1>
        <p className="text-xs text-blue-200">{pins.length} client location(s)</p>
      </header>
      <div className="flex-1">
        <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((pin, i) => (
            <Marker key={i} position={[pin.lt, pin.ln]}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold text-sm">{pin.n}</p>
                  {pin.a && <p className="text-gray-500">{pin.a}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
