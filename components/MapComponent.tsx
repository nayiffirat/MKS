import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker, useMapEvents, useMap, WMSTileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ArrowLeft, Ruler, Square, Trash2, Search, Navigation, Undo2, Map as MapIcon, Layers, Share2, Copy, MapPin, Save, X, Edit2 } from 'lucide-react';
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
        };
        map.on("locationfound", handleLocationFound);
        
        map.locate({ setView: true, maxZoom: 16 });

        return () => { map.off("locationfound", handleLocationFound); };
    }, [map]);

    return (
        <>
            <button 
                onClick={() => map.locate({ setView: true, maxZoom: 16 })}
                className="absolute bottom-8 right-4 z-[1000] p-3 bg-white rounded-full shadow-lg border border-stone-200 text-blue-600 active:scale-95 transition-transform"
            >
                <Navigation size={24} />
            </button>
            {position && <Marker position={position} icon={userLocationIcon} />}
        </>
    );
};

const SavedFeatureRenderer = ({ feature, onRemove, onEdit }: { feature: any, onRemove: (id: string) => void, onEdit: (id: string) => void }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const onZoom = () => {
            setZoom(map.getZoom());
            if (showMenu) setShowMenu(false); // zoom değişince menüyü kapat
        };
        map.on('zoomend', onZoom);
        return () => { map.off('zoomend', onZoom); };
    }, [map, showMenu]);

    // 13 ve üstü zoom seviyelerinde görünsün (yaklaşık 1000m ve daha yakın)
    if (zoom < 13) return null;

    const centerPoint = feature.type === 'COORDINATE' 
        ? feature.points[0] 
        : L.polygon(feature.points).getBounds().getCenter();

    const renderTooltipContent = () => {
        if (showMenu) {
            return (
                <div 
                    className="bg-black/90 px-2 py-1.5 rounded-xl border border-white/20 shadow-xl flex items-center gap-1.5 pointer-events-auto backdrop-blur-md"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                >
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(feature.id); setShowMenu(false); }}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded p-1.5 flex items-center justify-center transition-colors"
                        title="Düzenle"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(feature.id); setShowMenu(false); }}
                        className="bg-rose-600 hover:bg-rose-500 text-white rounded p-1.5 flex items-center justify-center transition-colors"
                        title="Sil"
                    >
                        <Trash2 size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                        className="bg-stone-700 hover:bg-stone-600 text-white rounded p-1.5 flex items-center justify-center transition-colors shadow-sm"
                        title="İptal"
                    >
                        <X size={12} />
                    </button>
                </div>
            );
        }

        return (
            <div 
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowMenu(true);
                }}
                className="bg-black/80 px-4 py-2 rounded-full border border-white/20 shadow-xl flex items-center justify-center pointer-events-auto backdrop-blur-md cursor-pointer hover:bg-black/90 transition-all scale-100 active:scale-95"
            >
                <span className="font-bold text-[11px] text-white max-w-[150px] truncate">{feature.name}</span>
            </div>
        );
    };

    const transparentTooltipClasses = "!bg-transparent !border-0 !shadow-none !p-0";

    if (feature.type === 'COORDINATE') {
        return (
            <CircleMarker center={feature.points[0]} radius={0} weight={0} opacity={0} fillOpacity={0}>
                <Tooltip permanent interactive direction="center" className={transparentTooltipClasses}>
                    {renderTooltipContent()}
                </Tooltip>
            </CircleMarker>
        );
    }
    
    if (feature.type === 'AREA') {
        return (
            <Polygon positions={feature.points} color="#3b82f6" fillOpacity={0.3} weight={3} interactive={false}>
                <Tooltip permanent interactive direction="center" className={transparentTooltipClasses}>
                    {renderTooltipContent()}
                </Tooltip>
            </Polygon>
        );
    }

    if (feature.type === 'DISTANCE') {
        return (
            <Polyline positions={feature.points} color="#ef4444" weight={4} interactive={false}>
                <Tooltip permanent interactive direction="center" className={transparentTooltipClasses}>
                    {renderTooltipContent()}
                </Tooltip>
            </Polyline>
        );
    }
    
    return null;
};

export const MapComponent = ({ onBack }: { onBack: () => void }) => {
  const { farmers } = useAppViewModel();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [mode, setMode] = useState<'DISTANCE' | 'AREA' | 'COORDINATE' | null>(null);
  const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');
  const [showParsel, setShowParsel] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [saveDialog, setSaveDialog] = useState<{isOpen: boolean, defaultName: string}>({isOpen: false, defaultName: ''});
  const [savedFeatures, setSavedFeatures] = useState<any[]>(() => {
      const saved = localStorage.getItem('map_saved_features');
      return saved ? JSON.parse(saved) : [];
  });
  const isSelecting = useRef(false);
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
      localStorage.setItem('map_saved_features', JSON.stringify(savedFeatures));
  }, [savedFeatures]);

  useEffect(() => {
      if (search.length < 3) {
          setSuggestions([]);
          return;
      }
      if (isSelecting.current) {
          isSelecting.current = false;
          setSuggestions([]);
          return;
      }
      const timeout = setTimeout(async () => {
          try {
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&countrycodes=tr&limit=5`);
              const data = await res.json();
              setSuggestions(data);
          } catch (err) {
              console.error('Arama hatası:', err);
          }
      }, 600);
      return () => clearTimeout(timeout);
  }, [search]);

  const handleSelectSuggestion = (sug: any) => {
      if (mapRef.current) {
          mapRef.current.flyTo([parseFloat(sug.lat), parseFloat(sug.lon)], 14);
      }
      isSelecting.current = true;
      setSearch(sug.display_name.split(',')[0]);
      setSuggestions([]);
  };

  const MapEvents = () => {
    useMapEvents({ 
        click: (e) => {
            if (mode === 'COORDINATE') {
                setPoints([e.latlng]);
            } else if (mode) {
                setPoints([...points, e.latlng]);
            }
        } 
    });
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

  const handleSaveFeature = () => {
      let defaultName = 'Konum';
      if (mode === 'AREA') defaultName = 'Alan';
      if (mode === 'DISTANCE') defaultName = 'Mesafe';

      setSaveDialog({ isOpen: true, defaultName });
  };

  const confirmSave = (name: string) => {
      if (name.trim()) {
          let finalName = name.trim();
          if (mode === 'AREA') {
              finalName = `${finalName} (${(area / 1000).toFixed(2)} da)`;
          } else if (mode === 'DISTANCE') {
              finalName = `${finalName} (${totalDistance.toFixed(0)} m)`;
          }

          const newFeature = {
              id: Math.random().toString(36).substr(2, 9),
              name: finalName,
              type: mode,
              points: points.map(p => ({ lat: p.lat, lng: p.lng }))
          };
          setSavedFeatures([...savedFeatures, newFeature]);
          setPoints([]);
          setMode(null);
          setSaveDialog({ isOpen: false, defaultName: '' });
      }
  };

  const cancelSave = () => {
      setSaveDialog({ isOpen: false, defaultName: '' });
  };

  const handleRemoveFeature = (id: string) => {
      if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
          setSavedFeatures(savedFeatures.filter(f => f.id !== id));
      }
  };

  const handleEditFeature = (id: string) => {
      const feature = savedFeatures.find(f => f.id === id);
      if (feature) {
          const newName = window.prompt('Yeni ismi girin:', feature.name);
          if (newName && newName.trim()) {
              setSavedFeatures(savedFeatures.map(f => f.id === id ? { ...f, name: newName.trim() } : f));
          }
      }
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
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (suggestions.length > 0) {
                            handleSelectSuggestion(suggestions[0]);
                        }
                    }}
                    className="relative flex-1"
                >
                    <Search className="absolute left-3 top-2.5 text-stone-600" size={18}/>
                    <input 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Örn: Dereli, Akçakale, Şanlıurfa"
                        className="w-full bg-stone-950 text-white p-2.5 pl-9 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-stone-700 transition-all shadow-inner"
                    />
                    {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden shadow-2xl flex flex-col z-[1100]">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSelectSuggestion(s)}
                                    className="text-left px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 border-b border-stone-800/50 last:border-0 truncate"
                                >
                                    {s.display_name}
                                 </button>
                            ))}
                        </div>
                    )}
                </form>
            </div>
            
            <div className="flex justify-end gap-2">
                <button onClick={() => {setMode(mode === 'COORDINATE' ? null : 'COORDINATE'); setPoints([]);}} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${mode === 'COORDINATE' ? 'bg-amber-600 text-white shadow-lg' : 'bg-stone-900 text-stone-300 shadow-md border border-stone-800 hover:bg-stone-800'}`}>
                    <MapPin size={14} />
                    <span>Konum Al</span>
                </button>
                <button onClick={() => {setMode(mode === 'DISTANCE' ? null : 'DISTANCE'); setPoints([]);}} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${mode === 'DISTANCE' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-900 text-stone-300 shadow-md border border-stone-800 hover:bg-stone-800'}`}>
                    <Ruler size={14} />
                    <span>Mesafe (m)</span>
                </button>
                <button onClick={() => {setMode(mode === 'AREA' ? null : 'AREA'); setPoints([]);}} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${mode === 'AREA' ? 'bg-blue-600 text-white shadow-lg' : 'bg-stone-900 text-stone-300 shadow-md border border-stone-800 hover:bg-stone-800'}`}>
                    <Square size={14} />
                    <span>Alan (da)</span>
                </button>
            </div>

            {mode && (
                <div className="flex gap-2 items-center justify-end">
                    <button onClick={() => setPoints(p => p.slice(0, -1))} className="p-2.5 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors shadow-lg border border-stone-700"><Undo2 size={18}/></button>
                    <button onClick={() => setPoints([])} className="p-2.5 rounded-xl bg-rose-900/90 text-rose-100 hover:bg-rose-800 transition-colors shadow-lg border border-rose-800"><Trash2 size={18}/></button>
                </div>
            )}
       </div>

        {mode && mode !== 'COORDINATE' && (
            <div className="absolute bottom-6 left-4 right-4 z-[1000] md:left-4 md:right-auto bg-black/40 backdrop-blur-xl px-5 py-5 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col gap-4 md:min-w-[340px] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                 {saveDialog.isOpen ? (
                    <div className="flex items-center gap-3 w-full">
                        <input 
                            autoFocus
                            defaultValue={saveDialog.defaultName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmSave(e.currentTarget.value);
                                if (e.key === 'Escape') cancelSave();
                            }}
                            className="bg-white/10 text-white text-xs px-5 py-3 rounded-2xl outline-none border border-white/5 flex-1 focus:border-emerald-500/50 focus:bg-white/15 transition-all"
                            placeholder="İsim girin..."
                        />
                        <div className="flex gap-2">
                            <button onClick={(e) => {
                                const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                                confirmSave(input.value);
                            }} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl p-3 transition-all active:scale-90 shadow-lg shadow-emerald-500/20"><Save size={18}/></button>
                            <button onClick={cancelSave} className="bg-white/10 hover:bg-white/20 text-white rounded-2xl p-3 transition-all active:scale-90 border border-white/5"><X size={18}/></button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.1em]">{mode === 'DISTANCE' ? 'Toplam Mesafe' : 'Hesaplanan Alan'}</span>
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-black tracking-tight">
                                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                    {mode === 'DISTANCE' ? <Ruler size={16} /> : <Square size={16} />}
                                </div>
                                <span>{mode === 'DISTANCE' ? `${totalDistance.toFixed(0)} m` : `${(area / 1000).toFixed(2)} da`}</span>
                            </div>
                        </div>
                        {(mode === 'DISTANCE' ? points.length > 1 : points.length > 2) && (
                            <button onClick={handleSaveFeature} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl p-3.5 transition-all active:scale-90 shadow-xl shadow-emerald-900/40 group">
                                <Save size={20} className="group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        )}

       {mode === 'COORDINATE' && points.length > 0 && (
        <div className="absolute bottom-6 left-4 right-4 z-[1000] md:left-4 md:right-auto bg-black/40 backdrop-blur-xl px-5 py-5 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col gap-4 md:min-w-[340px] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                {saveDialog.isOpen ? (
                    <div className="flex items-center gap-3 w-full">
                        <input 
                            autoFocus
                            defaultValue={saveDialog.defaultName}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmSave(e.currentTarget.value);
                                if (e.key === 'Escape') cancelSave();
                            }}
                            className="bg-white/10 text-white text-xs px-5 py-3 rounded-2xl outline-none border border-white/5 flex-1 focus:border-amber-500/50 focus:bg-white/15 transition-all"
                            placeholder="Konuma isim verin..."
                        />
                        <div className="flex gap-2">
                            <button onClick={(e) => {
                                const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                                confirmSave(input.value);
                            }} className="bg-amber-500 hover:bg-amber-400 text-black rounded-2xl p-3 transition-all active:scale-90 shadow-lg shadow-amber-500/20"><Save size={18}/></button>
                            <button onClick={cancelSave} className="bg-white/10 hover:bg-white/20 text-white rounded-2xl p-3 transition-all active:scale-90 border border-white/5"><X size={18}/></button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.1em]">Seçilen Koordinat</span>
                                <div className="flex items-center gap-2 text-white text-sm font-medium tracking-tight">
                                    <div className="p-1.5 bg-amber-500/20 rounded-lg">
                                        <MapPin size={16} className="text-amber-500" />
                                    </div>
                                    <span className="font-mono">{points[0].lat.toFixed(6)}, {points[0].lng.toFixed(6)}</span>
                                </div>
                            </div>
                            <button onClick={handleSaveFeature} className="bg-amber-500 hover:bg-amber-400 text-black rounded-2xl p-3.5 transition-all active:scale-90 shadow-xl shadow-amber-500/20 group">
                                <Save size={20} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                        
                        <div className="h-px bg-white/10 w-full" />
                        
                        <div className="grid grid-cols-3 gap-3">
                            <a 
                                href={`https://parselsorgu.tkgm.gov.tr/#arama/koordinat/${points[0].lng}/${points[0].lat}`}
                                target="_blank" rel="noreferrer"
                                className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2.5 transition-all border border-white/5 hover:border-white/20 active:scale-95"
                            >
                                <div className="p-2 bg-indigo-500/20 rounded-xl">
                                    <MapIcon size={18} className="text-indigo-400" /> 
                                </div>
                                <span className="text-white/70">Parsel</span>
                            </a>
                            <a 
                                href={`https://wa.me/?text=${encodeURIComponent(`Konum: https://maps.google.com/?q=${points[0].lat},${points[0].lng}`)}`} 
                                target="_blank" rel="noreferrer"
                                className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2.5 transition-all border border-white/5 hover:border-white/20 active:scale-95"
                            >
                                <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <Share2 size={18} className="text-emerald-400" /> 
                                </div>
                                <span className="text-white/70">Paylaş</span>
                            </a>
                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${points[0].lat},${points[0].lng}`} 
                                target="_blank" rel="noreferrer"
                                className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2.5 transition-all border border-white/5 hover:border-white/20 active:scale-95"
                            >
                                <div className="p-2 bg-blue-500/20 rounded-xl">
                                    <Navigation size={18} className="text-blue-400" /> 
                                </div>
                                <span className="text-white/70">Tarif</span>
                            </a>
                        </div>
                    </div>
                )}
           </div>
       )}
       
       <div className="absolute bottom-24 right-4 z-[1000] flex flex-col items-end gap-2">
            <button onClick={() => setShowParsel(p => !p)} className={`flex items-center gap-2 p-3 rounded-full shadow-lg border transition-colors ${showParsel ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-stone-900 text-stone-300 border-stone-700 hover:bg-stone-800'}`} title="Ada/Parsel Göster">
                <MapIcon size={20} />
            </button>
            <button onClick={() => setMapType(t => t === 'satellite' ? 'street' : 'satellite')} className="flex items-center gap-2 p-3 rounded-full bg-stone-900 text-stone-300 shadow-lg border border-stone-700 hover:bg-stone-800 transition-colors" title={mapType === 'satellite' ? 'Sokak Haritasına Geç' : 'Uydu Haritasına Geç'}>
                <Layers size={20} />
            </button>
       </div>

       <MapContainer ref={mapRef} center={[39.16, 35.43]} zoom={6} zoomControl={false} className="h-full w-full">
         <TileLayer 
            url={mapType === 'satellite' ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} 
            maxZoom={20}
            attribution={mapType === 'satellite' ? "&copy; Google Maps" : "&copy; OpenStreetMap contributors"}
         />
         {showParsel && (
             <WMSTileLayer 
                url="https://megsiswms.tkgm.gov.tr/tkgm.mahalli/wms"
                layers="TKGM.MAHALLI.PARSEL"
                transparent={true}
                format="image/png"
                version="1.1.1"
                maxZoom={20}
                opacity={0.6}
             />
         )}
         <MapEvents />
         <LocateButton />
         {savedFeatures.map(f => (
             <SavedFeatureRenderer key={f.id} feature={f} onRemove={handleRemoveFeature} onEdit={handleEditFeature} />
         ))}
         {points.map((p, i) => <Marker key={i} position={p} />)}
         {mode === 'DISTANCE' && points.length > 1 && <Polyline positions={points} color="red" />}
         {mode === 'AREA' && points.length > 2 && <Polygon positions={points} color="blue" />}
       </MapContainer>
    </div>
  );
};
