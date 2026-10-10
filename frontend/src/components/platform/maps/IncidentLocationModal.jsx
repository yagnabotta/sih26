import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, 
  MapPin, 
  Search, 
  Layers, 
  Crosshair, 
  Check, 
  AlertCircle, 
  Building2, 
  Compass, 
  Navigation,
  Info,
  Maximize2
} from 'lucide-react';
import { 
  INDUSTRIAL_FACILITY_PRESETS, 
  getSelectionMarkerIcon, 
  reverseGeocode 
} from './mapUtils';

export default function IncidentLocationModal({
  isOpen,
  onClose,
  initialLocation,
  userLocation,
  selectedUnit = 'Unit 1',
  onConfirm,
  isMobile = false
}) {
  if (!isOpen) return null;

  const fallbackUnit = selectedUnit || 'Unit 1';

  const handleSelectSector = (unitKey) => {
    const unitCoords = {
      'Unit 1': { lat: 12.9716, lng: 77.5946, name: 'Unit 1 – Crude Distillation Unit (CDU)' },
      'Unit 2': { lat: 12.9705, lng: 77.5932, name: 'Unit 2 – Fluid Catalytic Cracking (FCCU)' },
      'Unit 3': { lat: 12.9742, lng: 77.5975, name: 'Unit 3 – Hydrocracker & Hydrogen Unit' },
      'Unit 4': { lat: 12.9680, lng: 77.5920, name: 'Unit 4 – LPG Bullets & Storage Farm' }
    };
    const target = unitCoords[unitKey] || unitCoords['Unit 1'];
    setCurrentCoords({ lat: target.lat, lng: target.lng });
    setLocationAddress(target.name);
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([target.lat, target.lng], 17, { animate: true });
      markerRef.current.setLatLng([target.lat, target.lng]);
    }
    handleCoordinatesChange(target.lat, target.lng);
  };

  // Initial map center defaults
  const defaultCoords = initialLocation
    ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
    : userLocation
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : { lat: 12.9716, lng: 77.5946 };

  const initialAddr = (initialLocation?.address && !initialLocation.address.toLowerCase().startsWith('coordinates'))
    ? initialLocation.address
    : (initialLocation?.name && !initialLocation.name.toLowerCase().includes('vicinity') ? initialLocation.name : fallbackUnit);

  const [currentCoords, setCurrentCoords] = useState(defaultCoords);
  const [locationAddress, setLocationAddress] = useState(initialAddr);
  const [mapType, setMapType] = useState('street'); // 'street' or 'satellite'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [statusNotice, setStatusNotice] = useState(
    userLocation
      ? 'Map centered using your device context. Drag the pin to pinpoint the exact incident site.'
      : 'Select or drag the pin to set the exact incident location.'
  );

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      center: [currentCoords.lat, currentCoords.lng],
      zoom: 16,
      zoomControl: false // custom placement
    });
    mapInstanceRef.current = map;

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Street Tile layer
    const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    streetTiles.addTo(map);
    tileLayerRef.current = streetTiles;

    // Add draggable incident marker
    const marker = L.marker([currentCoords.lat, currentCoords.lng], {
      icon: getSelectionMarkerIcon(),
      draggable: true
    }).addTo(map);
    markerRef.current = marker;

    marker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
        <strong style="color: #FF5A36; font-size: 13px;">📍 Incident Location</strong>
        <div style="margin-top: 4px; font-weight: 600; color: #1e293b;">${locationAddress || fallbackUnit}</div>
      </div>
    `);

    // Handle marker drag end
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      const updated = { lat: pos.lat, lng: pos.lng };
      setCurrentCoords(updated);
      handleCoordinatesChange(updated.lat, updated.lng);
    });

    // Handle map click to place marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCurrentCoords({ lat, lng });
      handleCoordinatesChange(lat, lng);
    });

    // Ensure map container renders properly after modal transition
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    if (mapType === 'satellite') {
      const satTiles = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
      );
      satTiles.addTo(mapInstanceRef.current);
      tileLayerRef.current = satTiles;
    } else {
      const streetTiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      );
      streetTiles.addTo(mapInstanceRef.current);
      tileLayerRef.current = streetTiles;
    }
  }, [mapType]);

  // Handle coordinate updates with reverse geocoding
  const handleCoordinatesChange = async (lat, lng) => {
    setIsReverseGeocoding(true);
    setStatusNotice('Resolving location address...');

    try {
      const geo = await reverseGeocode(lat, lng);
      const cleanAddr = (geo.address && !geo.address.toLowerCase().startsWith('coordinates'))
        ? geo.address
        : (geo.name && !geo.name.toLowerCase().includes('vicinity') ? geo.name : fallbackUnit);

      setLocationAddress(cleanAddr);
      setStatusNotice(`Pin positioned: ${cleanAddr}`);

      if (markerRef.current) {
        markerRef.current.setPopupContent(`
          <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
            <strong style="color: #FF5A36; font-size: 13px;">📍 Incident Location</strong>
            <div style="margin-top: 4px; font-weight: 600; color: #1e293b;">${cleanAddr}</div>
          </div>
        `);
      }
    } catch (e) {
      setLocationAddress(fallbackUnit);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Center map on a specific coordinate
  const panToCoords = (lat, lng, name, address) => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
    markerRef.current.setLatLng([lat, lng]);
    setCurrentCoords({ lat, lng });
    if (name) setLocationName(name);
    if (address) setLocationAddress(address);
    markerRef.current.openPopup();
    setStatusNotice(`Selected: ${name || 'Map Point'}`);
  };

  // Handle Search Input (Industrial presets or Nominatim search)
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Check if query is in lat, lng format (e.g. 12.9716, 77.5946)
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        panToCoords(lat, lng, `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`, query);
        handleCoordinatesChange(lat, lng);
        setSearchResults([]);
        return;
      }
    }

    // Filter local industrial facility presets
    const localMatches = INDUSTRIAL_FACILITY_PRESETS.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    setIsSearching(true);
    try {
      // Also query Nominatim for geocoding
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const onlineResults = res.ok ? await res.json() : [];

      const combined = [
        ...localMatches.map(p => ({
          name: p.name,
          address: `${p.category} — ${p.description}`,
          lat: p.coords.lat,
          lng: p.coords.lng,
          isPreset: true
        })),
        ...onlineResults.map(r => ({
          name: r.display_name.split(',')[0],
          address: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          isPreset: false
        }))
      ];

      setSearchResults(combined);
      if (combined.length === 0) {
        setStatusNotice(`No exact match found for "${query}". You can drag the pin manually.`);
      }
    } catch {
      setSearchResults(
        localMatches.map(p => ({
          name: p.name,
          address: `${p.category} — ${p.description}`,
          lat: p.coords.lat,
          lng: p.coords.lng,
          isPreset: true
        }))
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Center map on user's current GPS location and move the incident marker
  // (Convenient starting point only; user must confirm or drag to adjust)
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      if (userLocation) {
        const lat = userLocation.latitude;
        const lng = userLocation.longitude;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
          markerRef.current.setLatLng([lat, lng]);
        }
        setCurrentCoords({ lat, lng });
        handleCoordinatesChange(lat, lng);
        setStatusNotice('Incident marker moved to current location. Drag to adjust if needed, then click Confirm Location.');
        return;
      }
      setStatusNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setStatusNotice('Requesting current GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
          markerRef.current.setLatLng([lat, lng]);
        }
        setCurrentCoords({ lat, lng });
        setStatusNotice('Incident marker moved to your current GPS location. Drag to adjust exact coordinates if needed, then click Confirm Location.');
        await handleCoordinatesChange(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        // Fallback to userLocation prop if available
        if (userLocation) {
          const lat = userLocation.latitude;
          const lng = userLocation.longitude;
          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
            markerRef.current.setLatLng([lat, lng]);
          }
          setCurrentCoords({ lat, lng });
          handleCoordinatesChange(lat, lng);
          setStatusNotice('Using last known coordinates. Drag to adjust if needed, then click Confirm Location.');
          return;
        }

        let msg = 'Unable to get current location.';
        if (err.code === 1) { // PERMISSION_DENIED
          msg = 'Location permission was denied. Please allow location access in your browser or drag the marker manually.';
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          msg = 'Current location is unavailable. You can search or drag the marker manually.';
        } else if (err.code === 3) { // TIMEOUT
          msg = 'Location request timed out. Please try again or drag the marker manually.';
        }
        setStatusNotice(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Confirm Location Handler
  const handleConfirmLocation = () => {
    const finalAddress = locationAddress || fallbackUnit;
    onConfirm({
      latitude: parseFloat(currentCoords.lat.toFixed(6)),
      longitude: parseFloat(currentCoords.lng.toFixed(6)),
      address: finalAddress,
      name: finalAddress
    });
    onClose();
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 sm:absolute z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-fadeIn select-none">
        <div className="bg-white rounded-t-[32px] w-full h-[94vh] sm:h-[760px] max-h-[96vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp relative">
          
          {/* Mobile Drag Bar & Header */}
          <div className="p-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-tight">
                  Pin Incident Location
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  {fallbackUnit} • GPS Coordinates
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCurrentLocation}
                disabled={isLocating}
                title="Current GPS Location"
                className="px-2 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                <span>{isLocating ? 'Locating...' : 'GPS'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Map Viewport Area */}
          <div className="relative flex-1 w-full bg-slate-100 overflow-hidden min-h-[260px]">
            
            {/* Top Floating Mobile Controls */}
            <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-col gap-1.5 pointer-events-none">
              
              {/* Layer Toggle Pills */}
              <div className="flex items-center justify-between pointer-events-auto">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-0.5 shadow-md border border-slate-200 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMapType('street')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      mapType === 'street'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Street
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('satellite')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      mapType === 'satellite'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Satellite
                  </button>
                </div>

                <div className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs border border-slate-200 text-[9px] font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Interactive Map</span>
                </div>
              </div>
            </div>

            {/* Leaflet Map Div */}
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Hint Overlay */}
            <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs border border-slate-200 text-[10px] font-semibold text-slate-600 flex items-center justify-center gap-1.5 pointer-events-none text-center">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <span>Drag orange pin or tap map to position hazard</span>
            </div>

          </div>

          {/* Bottom Confirmation Drawer */}
          <div className="p-3.5 bg-white border-t border-slate-100 space-y-2.5 shrink-0">
            
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="px-1 py-0.2 rounded bg-white text-blue-800 font-mono font-bold text-[9px] border border-blue-200">
                      {fallbackUnit}
                    </span>
                    <span className="text-[11px] font-bold text-slate-900 truncate block">
                      {locationAddress || fallbackUnit}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-mono truncate">
                    {currentCoords.lat.toFixed(5)}° N, {currentCoords.lng.toFixed(5)}° E
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm & Cancel Buttons */}
            <div className="space-y-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleConfirmLocation}
                disabled={isReverseGeocoding}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.98] text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirm Incident Location</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-1.5 text-center text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border-2 border-stone-200 shadow-2xl max-w-4xl w-full h-[92vh] max-h-[820px] flex flex-col overflow-hidden text-slate-800">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-300 text-[#FF5A36] flex items-center justify-center shrink-0 shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black font-heading text-slate-900 tracking-tight leading-tight">
                  Select Incident Location
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-orange-100 text-[#FF5A36] border border-orange-200">
                  Target Destination
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Pinpoint where the hazard occurred (User context ≠ Incident location)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-stone-200 flex items-center justify-center transition-all cursor-pointer"
            title="Close Map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Viewport Area */}
        <div className="relative flex-1 w-full bg-slate-100 overflow-hidden min-h-[300px]">
          
          {/* Map Layer Controls & Current Location Option */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-md border border-stone-200 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mapType === 'street'
                    ? 'bg-[#FF5A36] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Street Map
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mapType === 'satellite'
                    ? 'bg-[#FF5A36] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Satellite Imagery
              </button>
            </div>

            {/* New Control: [ 📍 Current Location ] */}
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={isLocating}
              title="Acquire current GPS location and position incident marker"
              className="bg-white/95 backdrop-blur-md hover:bg-orange-50 text-slate-700 hover:text-[#FF5A36] font-bold px-3 py-1.5 rounded-xl shadow-md border border-stone-200 hover:border-orange-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLocating ? (
                <span className="w-3 h-3 border-2 border-[#FF5A36] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-xs leading-none">📍</span>
              )}
              <span>{isLocating ? 'Locating...' : 'Current Location'}</span>
            </button>
          </div>

          {/* Leaflet Map Div */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Hint Overlay */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-stone-200 text-[11px] font-semibold text-slate-600 flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse" />
            <span>Click map or drag the orange marker to adjust exact coordinates</span>
          </div>
        </div>

        {/* Selected Location Details & Action Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-stone-200 space-y-3 shrink-0">
          <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-orange-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF5A36]" />
                <span>CONFIRMING INCIDENT LOCATION (NOT USER LOCATION):</span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {locationAddress || fallbackUnit}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold font-mono text-orange-900 bg-white px-3 py-1.5 rounded-xl border border-orange-200 shadow-2xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                <span>{fallbackUnit}</span>
              </span>
            </div>
          </div>

          {/* Buttons: Cancel and Confirm Location */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmLocation}
              disabled={isReverseGeocoding}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF6B4A] via-[#FF5A36] to-[#FFA133] hover:opacity-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-orange-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
