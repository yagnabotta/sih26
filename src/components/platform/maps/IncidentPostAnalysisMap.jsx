import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Layers, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck,
  Compass,
  ArrowRight
} from 'lucide-react';
import { getRiskMarkerIcon } from './mapUtils';

export default function IncidentPostAnalysisMap({
  incidentLocation,
  riskScore = 50,
  riskLevel = 'Medium Risk',
  incidentType = 'Near Miss',
  reportName = 'Safety Observation',
  onNavigate,
  isAdmin = true
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapType, setMapType] = useState('street');

  const lat = incidentLocation?.latitude || 12.9716;
  const lng = incidentLocation?.longitude || 77.5946;
  const locationName = incidentLocation?.name || 'Crude Distillation Unit (CDU)';
  const locationAddress = incidentLocation?.address || `${locationName} Operating Area`;

  // Determine risk presentation rules:
  // Risk Score < 33 -> Green (Low Risk)
  // Risk Score 33-66 -> Blue (Medium Risk)
  // Risk Score > 66 -> Red (High Risk)
  let markerColorClass = 'text-emerald-700 bg-emerald-100 border-emerald-300';
  let badgeText = 'LOW RISK';
  let hexColor = '#10B981';

  if (riskScore > 66) {
    markerColorClass = 'text-rose-700 bg-rose-100 border-rose-300';
    badgeText = 'HIGH RISK';
    hexColor = '#EF4444';
  } else if (riskScore >= 33) {
    markerColorClass = 'text-blue-700 bg-blue-100 border-blue-300';
    badgeText = 'MEDIUM RISK';
    hexColor = '#2563EB';
  }

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);

    const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    streetTiles.addTo(map);
    tileLayerRef.current = streetTiles;

    // Custom marker with risk score color
    const marker = L.marker([lat, lng], {
      icon: getRiskMarkerIcon(riskScore, false)
    }).addTo(map);
    markerRef.current = marker;

    // Informative popup matching user requirement 7:
    // Risk Score: 78
    // Risk Level: High
    // Incident Type: Fire Blast
    // Location: Crude Distillation Unit
    // Latitude: 12.9716
    // Longitude: 77.5946
    const popupContent = `
      <div style="font-family: 'Outfit', 'Inter', system-ui, sans-serif; min-width: 220px; padding: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${hexColor}; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="font-weight: 900; font-size: 13px; color: #0f172a; text-transform: uppercase;">
            📍 INCIDENT SITE
          </div>
          <span style="background: ${hexColor}; color: white; padding: 2px 8px; border-radius: 6px; font-weight: 900; font-size: 11px; font-family: monospace;">
            SCORE: ${riskScore}
          </span>
        </div>
        <div style="font-size: 12px; line-height: 1.6; color: #334155;">
          <div><strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Risk Level:</strong> <span style="font-weight: 800; color: ${hexColor};">${badgeText}</span></div>
          <div><strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Incident Type:</strong> <span style="font-weight: 700; color: #0f172a;">${incidentType}</span></div>
          <div><strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Location:</strong> <span style="font-weight: 700; color: #0f172a;">${locationName}</span></div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">
            Lat: ${lat.toFixed(6)}<br/>
            Lng: ${lng.toFixed(6)}
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent).openPopup();

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, riskScore, incidentType, locationName]);

  // Tile layer toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    if (mapType === 'satellite') {
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri World Imagery' }
      );
      sat.addTo(mapInstanceRef.current);
      tileLayerRef.current = sat;
    } else {
      const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });
      street.addTo(mapInstanceRef.current);
      tileLayerRef.current = street;
    }
  }, [mapType]);

  return (
    <div className="rounded-2xl border-2 border-stone-200 overflow-hidden bg-white shadow-xs space-y-0">
      
      {/* Map Header */}
      <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
            style={{ backgroundColor: hexColor }}
          >
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black font-heading text-slate-900 uppercase tracking-tight">
                INCIDENT LOCATION MAP
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase border ${markerColorClass}`}>
                {badgeText} ({riskScore}/100)
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 block truncate max-w-sm">
              {locationName} &bull; {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
        </div>

        {/* Street / Satellite Toggle */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              mapType === 'street' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Street
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              mapType === 'satellite' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative h-64 sm:h-72 w-full bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Navigation Footer for Administrators */}
      <div className="p-3.5 sm:p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hexColor }} />
            <span>Target: {locationName}</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500 truncate max-w-md">
            📍 Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] shrink-0"
          >
            <Compass className="w-4 h-4 text-blue-200 animate-spin-slow" />
            <span>Navigate to Incident Location</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </button>
        )}
      </div>

    </div>
  );
}
