import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/** Build a round colored DivIcon. Color chosen by sun score bucket. */
function makeIcon(sunPercent: number | null | undefined): L.DivIcon {
  let bg = '#94a3b8'; // slate (unknown / low)
  let label = '?';
  if (sunPercent != null) {
    label = `${sunPercent}`;
    if (sunPercent >= 65) bg = '#f59e0b'; // amber 500
    else if (sunPercent >= 25) bg = '#fdba74'; // amber 300
    else bg = '#94a3b8'; // slate (shadowed / night)
  }
  const html = `
    <div style="
      background:${bg};
      width:28px;height:28px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:10px;
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">${label}</div>
  `;
  return new L.DivIcon({
    html,
    className: 'sun-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

export interface MapMarker { name: string; lat: number; lng: number; sunPercent?: number | null }
export interface Props { markers: MapMarker[]; center: [number, number]; zoom?: number }

export default function MiniMap({ markers, center, zoom = 14 }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className="mini-map" style={{ height: 320, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={`${m.lat}-${m.lng}-${m.name}`} position={[m.lat, m.lng]} icon={makeIcon(m.sunPercent)}>
          <Popup>
            <strong>{m.name}</strong>
            {typeof m.sunPercent === 'number' && <><br />☀️ {m.sunPercent}% de soleil</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
