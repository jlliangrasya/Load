import { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Navigation, MapPin, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

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

interface Props {
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.setView([lat, lng], 16);
  return null;
}

function DraggableMarker({
  position,
  onMove,
}: {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const latlng = (e.target as L.Marker).getLatLng();
          onMove(latlng.lat, latlng.lng);
        },
      }}
    />
  );
}

export default function PinLocationModal({ onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<'choose' | 'search' | 'device'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gettingDevice, setGettingDevice] = useState(false);
  const [pinPos, setPinPos] = useState<[number, number] | null>(null);
  const [recenter, setRecenter] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultCenter: [number, number] = [14.5995, 120.9842];

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=ph`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch {
        toast.error('Search failed');
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  const handleSelectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setPinPos([lat, lng]);
    setRecenter(true);
    setSearchResults([]);
    setSearchQuery(r.display_name);
  };

  const handleUseDevice = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported on this device');
      return;
    }
    setGettingDevice(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPinPos([pos.coords.latitude, pos.coords.longitude]);
        setRecenter(true);
        setGettingDevice(false);
        setMode('device');
      },
      () => {
        toast.error('Could not get device location');
        setGettingDevice(false);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (!pinPos) return;
    onConfirm(pinPos[0], pinPos[1]);
  };

  // — Choose mode —
  if (mode === 'choose') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
        <div className="bg-white w-full max-w-md rounded-t-2xl p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">Pin Location</h2>
            <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
          </div>

          <button
            onClick={() => setMode('search')}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-gray-200 bg-gray-50 active:bg-gray-100 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Search size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Search Address</p>
              <p className="text-xs text-gray-500">Find a place and adjust the pin on the map</p>
            </div>
          </button>

          <button
            onClick={handleUseDevice}
            disabled={gettingDevice}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-gray-200 bg-gray-50 active:bg-gray-100 text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              {gettingDevice
                ? <Loader size={18} className="text-green-600 animate-spin" />
                : <Navigation size={18} className="text-green-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Use My Location</p>
              <p className="text-xs text-gray-500">Pin using this device's current GPS location</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // — Search or Device mode (map view) —
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        <h2 className="text-base font-semibold text-gray-900 flex-1">
          {mode === 'search' ? 'Search Address' : 'Confirm Location'}
        </h2>
      </div>

      {/* Search bar (search mode only) */}
      {mode === 'search' && (
        <div className="px-4 py-2 bg-white border-b border-gray-100 relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {searching && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search barangay, street, city..."
              className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && !searching && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-20 left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.place_id}
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 text-sm text-gray-800 hover:bg-gray-50"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-700 text-center">
          {pinPos
            ? 'Drag the pin or tap the map to adjust the location'
            : mode === 'search'
            ? 'Search for an address to place the pin'
            : 'Getting your location...'}
        </p>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={pinPos ?? defaultCenter}
          zoom={pinPos ? 16 : 12}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pinPos && (
            <>
              {recenter && (
                <RecenterMap
                  lat={pinPos[0]}
                  lng={pinPos[1]}
                  key={`${pinPos[0]}-${pinPos[1]}`}
                />
              )}
              <DraggableMarker
                position={pinPos}
                onMove={(lat, lng) => {
                  setPinPos([lat, lng]);
                  setRecenter(false);
                }}
              />
            </>
          )}
          {!pinPos && (
            <DraggableMarkerBlank
              onPlace={(lat, lng) => {
                setPinPos([lat, lng]);
                setRecenter(false);
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Confirm */}
      <div className="px-4 py-4 bg-white border-t border-gray-200 space-y-2">
        {pinPos && (
          <p className="text-xs text-center text-gray-500">
            <MapPin size={12} className="inline mr-1" />
            {pinPos[0].toFixed(5)}, {pinPos[1].toFixed(5)}
          </p>
        )}
        <button
          onClick={handleConfirm}
          disabled={!pinPos}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700 disabled:opacity-40"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}

// Allows tapping the map to place initial pin when none exists yet
function DraggableMarkerBlank({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
