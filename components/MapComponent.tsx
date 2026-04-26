import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ArrowLeft, Ruler, Square, Trash2, Search, Navigation, Undo2 } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';

// Fix for icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userLocationIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: "<div style='width: 16px; height: 16px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);'></div>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const LocateButton = () => {
    const map = useMap();
    const [position, setPosition] = useState<L.LatLng | null>(null);

    useEffect(() => {
        const handleLocationFound = (e: L.LocationEvent) => {
            setPosition(e.latlng);
            map.flyTo(e.latlng, 16);
        };
        map.on("locationfound", handleLocationFound);
        return () => { map.off("locationfound", handleLocationFound); };
    }, [map]);

    return (
        <>
            <button 
                onClick={() => map.locate()}
                className="absolute bottom-8 right-4 z-[1000] p-3 bg-white rounded-full shadow-lg border border-stone-200 text-blue-600 active:scale-95 transition-transform"
            >
                <Navigation size={24} />
            </button>
            {position && <Marker position={position} icon={userLocationIcon} />}
        </>
    );
};

export const MapComponent = ({ onBack }: { onBack: () => void }) => {
  const { farmers } = useAppViewModel();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [mode, setMode] = useState<'DISTANCE' | 'AREA' | null>(null);
  const [search, setSearch] = useState('');
  const mapRef = useRef<L.Map>(null);

  const MapEvents = () => {
    useMapEvents({ click: (e) => mode && setPoints([...points, e.latlng]) });
    return null;
  };

  const calculateArea = (latlngs: L.LatLng[]) => {
      if (latlngs.length < 3) return 0;
      let area = 0;
      for (let i = 0; i < latlngs.length; i++) {
          let j = (i + 1) % latlngs.length;
          area += latlngs[i].lat * latlngs[j].lng;
          area -= latlngs[j].lat * latlngs[i].lng;
      }
      return Math.abs(area) * 111320 * 111320 * Math.cos(latlngs[0].lat * Math.PI / 180) / 2;
  };

  const totalDistance = points.reduce((acc, curr, i, arr) => i === 0 ? 0 : acc + curr.distanceTo(arr[i - 1]), 0);
  const area = calculateArea(points);

  const filteredFarmers = farmers.filter(f => 
      f.fullName.toLowerCase().includes(search.toLowerCase()) || 
      f.village.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col pt-safe bg-stone-950">
       <div className="absolute top-4 left-4 right-4 z-[1000] space-y-2">
            <div className="flex gap-2 items-center bg-stone-900 p-2 rounded-2xl border border-stone-800 shadow-xl">
                <button onClick={onBack} className="p-2 text-stone-400"><ArrowLeft /></button>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-stone-600" size={18}/>
                    <input 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Çiftçi veya Köy ara..."
                        className="w-full bg-stone-950 text-white p-2 pl-9 rounded-xl text-xs outline-none"
                    />
                </div>
                <button onClick={() => {setMode('DISTANCE'); setPoints([]);}} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${mode === 'DISTANCE' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                    <Ruler size={14} />
                    <span>Mesafe (m)</span>
                </button>
                <button onClick={() => {setMode('AREA'); setPoints([]);}} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${mode === 'AREA' ? 'bg-blue-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                    <Square size={14} />
                    <span>Alan (da)</span>
                </button>
            </div>
            {mode && (
                <div className="flex gap-2 items-center bg-stone-900 p-2 rounded-2xl border border-stone-800 shadow-xl justify-end">
                    <button onClick={() => setPoints(p => p.slice(0, -1))} className="p-2 rounded-xl bg-stone-800 text-stone-300"><Undo2 size={18}/></button>
                    <button onClick={() => setPoints([])} className="p-2 rounded-xl bg-rose-900/50 text-rose-200"><Trash2 size={18}/></button>
                </div>
            )}
       </div>

       {mode && (
           <div className="absolute bottom-6 left-4 z-[1000] bg-black/80 px-4 py-2 rounded-2xl border border-white/10 text-emerald-400 text-sm font-black shadow-xl">
                {mode === 'DISTANCE' ? `Mesafe: ${totalDistance.toFixed(0)} m` : `Alan: ${(area / 1000).toFixed(2)} da`}
           </div>
       )}
       
       <MapContainer ref={mapRef} center={[39.16, 35.43]} zoom={6} zoomControl={false} className="h-full w-full">
         <TileLayer 
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
            maxZoom={20}
            attribution="&copy; Google Maps"
         />
         <MapEvents />
         <LocateButton />
         {points.map((p, i) => <Marker key={i} position={p} />)}
         {mode === 'DISTANCE' && points.length > 1 && <Polyline positions={points} color="red" />}
         {mode === 'AREA' && points.length > 2 && <Polygon positions={points} color="blue" />}
       </MapContainer>
    </div>
  );
};
