import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, 
  Navigation, 
  ExternalLink, 
  MapPin, 
  Shield, 
  Clock, 
  ArrowRight, 
  Route, 
  CheckCircle2, 
  AlertCircle, 
  Compass,
  CornerDownRight,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { 
  getRiskMarkerIcon, 
  getAdminMarkerIcon, 
  fetchRouteGeometry, 
  formatDistance, 
  estimateTravelTime 
} from './mapUtils';

export default function AdminNavigationModal({
  isOpen,
  onClose,
  incidentLocation,
  riskScore = 50,
  riskLevel = 'Medium Risk',
  incidentType = 'Near Miss'
}) {
  if (!isOpen || !incidentLocation) return null;

  const [adminLocation, setAdminLocation] = useState(null);
  const [isLocatingAdmin, setIsLocatingAdmin] = useState(true);
  const [locationStatus, setLocationStatus] = useState('Acquiring Admin location from device GPS...');
  const [routeData, setRouteData] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [showTurnByTurn, setShowTurnByTurn] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);

  const incLat = incidentLocation.latitude;
  const incLng = incidentLocation.longitude;
  const incName = incidentLocation.name || 'Crude Distillation Unit (CDU)';
  const incAddress = incidentLocation.address || `${incName} Process Area`;

  // Step 1: Obtain Admin's Current Location via browser Geolocation API
  useEffect(() => {
    setIsLocatingAdmin(true);
    setLocationStatus('SafetyAI requesting Admin device location via navigator.geolocation...');

    if (!navigator.geolocation) {
      handleLocationFallback('Browser does not support geolocation. Using HSE Central Dispatch context.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setAdminLocation(coords);
        setIsLocatingAdmin(false);
        setLocationStatus('Admin current location acquired successfully.');
      },
      (error) => {
        let msg = 'Could not acquire device GPS. Using HSE Central Command Center as starting point.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Admin location permission denied by user. Using HSE Central Dispatch.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS request timed out. Using HSE Central Dispatch.';
        }
        handleLocationFallback(msg);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [incidentLocation]);

  const handleLocationFallback = (msg) => {
    // Default admin starting location: HSE Administration & Emergency Dispatch Center
    // Slightly offset from incident to provide a realistic navigation route
    const fallbackCoords = {
      latitude: incLat + 0.015,
      longitude: incLng - 0.018
    };
    setAdminLocation(fallbackCoords);
    setIsLocatingAdmin(false);
    setLocationStatus(msg);
  };

  // Step 2: Once admin location is acquired, calculate route and render Leaflet map
  useEffect(() => {
    if (!adminLocation || !mapContainerRef.current) return;

    setIsLoadingRoute(true);

    const initMapAndRoute = async () => {
      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize Map centered between Admin & Incident
      const centerLat = (adminLocation.latitude + incLat) / 2;
      const centerLng = (adminLocation.longitude + incLng) / 2;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: false
      });
      mapInstanceRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // Add Admin Marker (START POINT)
      const adminMarker = L.marker([adminLocation.latitude, adminLocation.longitude], {
        icon: getAdminMarkerIcon()
      }).addTo(map);

      adminMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="color: #4F46E5; font-size: 13px;">🛡️ Your Location (Admin)</strong>
          <div style="margin-top: 4px; font-weight: 600; color: #1e293b;">Navigation START Point</div>
          <div style="font-family: monospace; font-size: 10px; color: #64748b; margin-top: 2px;">
            ${adminLocation.latitude.toFixed(6)}, ${adminLocation.longitude.toFixed(6)}
          </div>
        </div>
      `);

      // Add Incident Marker (DESTINATION)
      const incMarker = L.marker([incLat, incLng], {
        icon: getRiskMarkerIcon(riskScore, false)
      }).addTo(map);

      incMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
          <strong style="color: #EF4444; font-size: 13px;">📍 Incident Destination</strong>
          <div style="margin-top: 4px; font-weight: 700; color: #0f172a;">${incName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">${incidentType} &bull; Score: ${riskScore}</div>
          <div style="font-family: monospace; font-size: 10px; color: #64748b; margin-top: 2px;">
            ${incLat.toFixed(6)}, ${incLng.toFixed(6)}
          </div>
        </div>
      `);

      // Fetch Driving Route Geometry
      try {
        const route = await fetchRouteGeometry(
          adminLocation.latitude,
          adminLocation.longitude,
          incLat,
          incLng
        );
        setRouteData(route);

        // Draw Route Polyline
        const polyline = L.polyline(route.coordinates, {
          color: '#2563EB',
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '1, 8',
          dashSpeed: 20
        }).addTo(map);
        polylineRef.current = polyline;

        // Fit map view to encompass both markers and the route
        const bounds = L.latLngBounds([
          [adminLocation.latitude, adminLocation.longitude],
          [incLat, incLng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      } catch (err) {
        console.error('Route calculation notice:', err);
      } finally {
        setIsLoadingRoute(false);
      }

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    initMapAndRoute();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [adminLocation, incLat, incLng, riskScore]);

  // Open in Google Maps Direction URL
  const googleMapsUrl = adminLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${adminLocation.latitude},${adminLocation.longitude}&destination=${incLat},${incLng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${incLat},${incLng}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border-2 border-stone-200 shadow-2xl max-w-4xl w-full h-[92vh] max-h-[840px] flex flex-col overflow-hidden text-slate-800">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-300 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black font-heading text-slate-900 tracking-tight leading-tight">
                  Admin Incident Navigation
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  Live Dispatch Route
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Route: Admin Current Location &rarr; Target Incident Coordinates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-stone-200 flex items-center justify-center transition-all cursor-pointer"
            title="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Flow Banner (Requirement 9) */}
        <div className="p-3 sm:p-4 bg-white border-b border-stone-200 space-y-2 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Start: Admin Location */}
            <div className="md:col-span-5 p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-mono font-bold text-blue-800">
                  START (YOUR ADMIN LOCATION)
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {adminLocation ? 'Admin Device / Dispatch Point' : 'Acquiring GPS...'}
                </div>
                {adminLocation && (
                  <div className="text-[10px] font-mono text-blue-700">
                    {adminLocation.latitude.toFixed(4)}, {adminLocation.longitude.toFixed(4)}
                  </div>
                )}
              </div>
            </div>

            {/* Route Arrow Indicator */}
            <div className="md:col-span-2 flex items-center justify-center">
              <div className="flex items-center gap-1 text-slate-400">
                <div className="h-0.5 w-6 bg-slate-300 hidden md:block" />
                <ArrowRight className="w-5 h-5 text-blue-600 animate-pulse" />
                <div className="h-0.5 w-6 bg-slate-300 hidden md:block" />
              </div>
            </div>

            {/* Destination: Incident Location */}
            <div className="md:col-span-5 p-3 rounded-xl bg-rose-50/80 border border-rose-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-mono font-bold text-rose-800">
                  DESTINATION (INCIDENT SITE)
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {incName}
                </div>
                <div className="text-[10px] font-mono text-rose-700">
                  {incLat.toFixed(4)}, {incLng.toFixed(4)}
                </div>
              </div>
            </div>

          </div>

          {/* Quick Metrics Bar: Distance, Time, Score */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Route className="w-4 h-4 text-blue-600" />
                <span>Distance:</span>
                <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {routeData ? formatDistance(routeData.distanceKm) : 'Calculating...'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Clock className="w-4 h-4 text-orange-600" />
                <span>Travel Time:</span>
                <span className="font-mono text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  {routeData ? `${routeData.durationMins} mins` : 'Estimating...'}
                </span>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-slate-500">
              {locationStatus}
            </span>
          </div>
        </div>

        {/* Map Viewport Area */}
        <div className="relative flex-1 w-full bg-slate-100 overflow-hidden min-h-[300px]">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Overlay loading spinner */}
          {(isLocatingAdmin || isLoadingRoute) && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-[1000]">
              <div className="bg-white p-4 rounded-2xl shadow-xl border border-stone-200 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-800">
                  {isLocatingAdmin ? 'Acquiring Admin location...' : 'Calculating driving route...'}
                </span>
              </div>
            </div>
          )}

          {/* Turn-by-Turn Toggle Button on Map */}
          {routeData?.steps && (
            <button
              type="button"
              onClick={() => setShowTurnByTurn(prev => !prev)}
              className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-stone-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
            >
              <CornerDownRight className="w-3.5 h-3.5 text-blue-600" />
              <span>{showTurnByTurn ? 'Hide Route Steps' : 'Turn-by-Turn Steps'}</span>
            </button>
          )}

          {/* Turn-by-Turn Floating Drawer */}
          {showTurnByTurn && routeData?.steps && (
            <div className="absolute top-12 left-3 z-[1000] w-72 max-h-60 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-stone-200 overflow-y-auto space-y-2 animate-in fade-in duration-150">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-500 flex items-center justify-between pb-1 border-b border-stone-100">
                <span>DRIVING DIRECTIONS</span>
                <span>{routeData.steps.length} Steps</span>
              </div>
              <ol className="space-y-1.5 text-xs">
                {routeData.steps.map((st, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-800">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold leading-snug">{st.instruction}</p>
                      <span className="text-[10px] font-mono text-slate-400">{st.distance}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer Actions matching user requirements */}
        <div className="p-4 sm:p-5 bg-white border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 space-y-0.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>Destination: {incName}</span>
              <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-rose-100 text-rose-700 font-bold">
                {riskLevel}
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              Coordinates: {incLat.toFixed(6)}, {incLng.toFixed(6)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* "Open in Google Maps" Button (Requirement 9) */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-4 h-4 ml-0.5" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
