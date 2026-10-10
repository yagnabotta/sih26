import L from 'leaflet';

// Known industrial plant facilities for quick selection and fallback reverse geocoding
export const INDUSTRIAL_FACILITY_PRESETS = [
  {
    name: 'Crude Distillation Unit (CDU)',
    category: 'Primary Refining',
    coords: { lat: 12.9716, lng: 77.5946 },
    description: 'High-temperature atmospheric crude fractionation tower and furnace'
  },
  {
    name: 'Vacuum Distillation Unit (VDU)',
    category: 'Heavy Ends Processing',
    coords: { lat: 12.9728, lng: 77.5962 },
    description: 'Reduced pressure column for heavy gas oil separation'
  },
  {
    name: 'Fluid Catalytic Cracking Unit (FCCU)',
    category: 'Conversion',
    coords: { lat: 12.9705, lng: 77.5932 },
    description: 'High-temperature catalyst regenerator and riser'
  },
  {
    name: 'Natural Gas Compressor Bay A',
    category: 'Gas Processing',
    coords: { lat: 12.9692, lng: 77.5958 },
    description: 'High-pressure multi-stage centrifugal gas compression'
  },
  {
    name: 'Electrical Substation 02 (415V/11kV)',
    category: 'Utilities & Power',
    coords: { lat: 12.9735, lng: 77.5938 },
    description: 'Main power distribution switchboard and transformer bay'
  },
  {
    name: 'LPG Bulk Storage Farm & Bullets',
    category: 'Pressurized Storage',
    coords: { lat: 12.9680, lng: 77.5920 },
    description: 'Pressurized liquid petroleum gas mounded vessels and manifolds'
  },
  {
    name: 'Hydrocracker High-Pressure Unit',
    category: 'Hydro-Processing',
    coords: { lat: 12.9742, lng: 77.5975 },
    description: 'High-pressure hydrogen reactor (150 bar) and separator'
  },
  {
    name: 'Motor Spirit (MS) Storage Tank Farm',
    category: 'Atmospheric Storage',
    coords: { lat: 12.9675, lng: 77.5980 },
    description: 'Floating roof hydrocarbon finished product storage tanks'
  },
  {
    name: 'Offsite Flare Stack & Knockout Drum',
    category: 'Safety Systems',
    coords: { lat: 12.9760, lng: 77.5910 },
    description: 'Emergency pressure relief elevated flare and liquid knockout drum'
  },
  {
    name: 'Effluent Treatment Plant (ETP)',
    category: 'Environmental',
    coords: { lat: 12.9660, lng: 77.5940 },
    description: 'Oily water separation, API separators, and bio-treatment basins'
  }
];

// Calculate Haversine distance between two coordinates in kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance nicely: meters if < 1km, km if >= 1km
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

// Estimate travel time based on distance (assuming ~30 km/h in plant/urban zone)
export function estimateTravelTime(distanceKm) {
  const averageSpeedKmH = 30;
  const hours = distanceKm / averageSpeedKmH;
  const minutes = Math.max(1, Math.round(hours * 60));
  if (minutes < 60) {
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// Create Risk Score color-coded custom Leaflet divIcon
// Risk Score < 33 -> GREEN (Low Risk)
// Risk Score 33-66 -> BLUE (Medium Risk)
// Risk Score > 66 -> RED (High Risk)
export function getRiskMarkerIcon(riskScore, isDraggable = false) {
  let color = '#10B981'; // Green
  let pulseColor = 'rgba(16, 185, 129, 0.4)';
  let label = 'LOW';

  if (typeof riskScore === 'number') {
    if (riskScore > 66) {
      color = '#EF4444'; // Red
      pulseColor = 'rgba(239, 68, 68, 0.4)';
      label = 'HIGH';
    } else if (riskScore >= 33) {
      color = '#2563EB'; // Blue
      pulseColor = 'rgba(37, 99, 235, 0.4)';
      label = 'MED';
    }
  }

  const html = `
    <div style="position: relative; width: 44px; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: ${isDraggable ? 'grab' : 'pointer'};">
      <div style="
        position: absolute;
        top: 2px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${pulseColor};
        animation: pinPulse 2s ease-out infinite;
      "></div>
      <div style="
        position: relative;
        z-index: 2;
        width: 36px;
        height: 36px;
        background: ${color};
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: #ffffff;
          font-weight: 900;
          font-size: 11px;
          font-family: monospace;
          letter-spacing: -0.5px;
        ">${typeof riskScore === 'number' ? riskScore : '📍'}</span>
      </div>
      <div style="
        position: absolute;
        bottom: 2px;
        width: 12px;
        height: 4px;
        background: rgba(0,0,0,0.25);
        border-radius: 50%;
        filter: blur(1px);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-risk-marker',
    iconSize: [44, 52],
    iconAnchor: [22, 50],
    popupAnchor: [0, -48]
  });
}

// Marker for Location Selection (Orange draggable pin)
export function getSelectionMarkerIcon() {
  const html = `
    <div style="position: relative; width: 46px; height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: grab;">
      <div style="
        position: absolute;
        top: 2px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 90, 54, 0.4);
        animation: pinPulse 1.8s ease-out infinite;
      "></div>
      <div style="
        position: relative;
        z-index: 2;
        width: 38px;
        height: 38px;
        background: #FF5A36;
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 6px 14px rgba(255, 90, 54, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: #ffffff;
          font-weight: 900;
          font-size: 14px;
        ">📍</span>
      </div>
      <div style="
        position: absolute;
        bottom: 1px;
        width: 14px;
        height: 5px;
        background: rgba(0,0,0,0.3);
        border-radius: 50%;
        filter: blur(1px);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-selection-marker',
    iconSize: [46, 54],
    iconAnchor: [23, 52],
    popupAnchor: [0, -50]
  });
}

// Marker for Admin Location (Officer Blue Badge)
export function getAdminMarkerIcon() {
  const html = `
    <div style="position: relative; width: 44px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        top: 2px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(79, 70, 229, 0.35);
        animation: pinPulse 2s ease-out infinite;
      "></div>
      <div style="
        position: relative;
        z-index: 2;
        width: 36px;
        height: 36px;
        background: #4F46E5;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: #ffffff;
          font-weight: 900;
          font-size: 14px;
        ">🛡️</span>
      </div>
      <div style="
        position: absolute;
        bottom: 2px;
        width: 12px;
        height: 4px;
        background: rgba(0,0,0,0.25);
        border-radius: 50%;
        filter: blur(1px);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-admin-marker',
    iconSize: [44, 50],
    iconAnchor: [22, 48],
    popupAnchor: [0, -46]
  });
}

// Helper to reverse geocode a lat/lng to a friendly name
export async function reverseGeocode(lat, lng) {
  // 1. Check if it's very close (< 250m) to one of our industrial facility presets
  let closestPreset = null;
  let minDistance = Infinity;

  INDUSTRIAL_FACILITY_PRESETS.forEach(preset => {
    const dist = calculateDistanceKm(lat, lng, preset.coords.lat, preset.coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestPreset = preset;
    }
  });

  if (closestPreset && minDistance <= 0.35) {
    return {
      name: closestPreset.name,
      address: `${closestPreset.name} (Operating Sector, ${closestPreset.category})`
    };
  }

  // 2. Try Nominatim Reverse Geocoding API with 2.5s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' }
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const primary =
          addr.industrial ||
          addr.commercial ||
          addr.factory ||
          addr.building ||
          addr.road ||
          addr.suburb ||
          addr.city ||
          'Refinery Sector';
        return {
          name: primary,
          address: data.display_name
        };
      }
    }
  } catch (e) {
    // Network / offline fallback
  }

  // 3. Fallback
  return {
    name: closestPreset ? `${closestPreset.name} Vicinity` : 'Refinery Operations Sector',
    address: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
}

// Helper to fetch realistic driving route from OSRM
export async function fetchRouteGeometry(startLat, startLng, endLat, endLng) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lat, lng]
        const distanceKm = route.distance / 1000;
        const durationMins = Math.max(1, Math.round(route.duration / 60));

        const steps = (route.legs?.[0]?.steps || []).map(s => {
          let instruction = s.maneuver?.type || 'Drive';
          if (s.name) instruction += ` along ${s.name}`;
          return {
            instruction: instruction.replace(/_/g, ' '),
            distance: `${Math.round(s.distance)} m`,
            duration: `${Math.round(s.duration)} s`
          };
        });

        return {
          coordinates,
          distanceKm,
          durationMins,
          steps: steps.length > 0 ? steps : null
        };
      }
    }
  } catch (e) {
    // Fallback on error / offline
  }

  // Straight line fallback
  const distanceKm = calculateDistanceKm(startLat, startLng, endLat, endLng);
  return {
    coordinates: [
      [startLat, startLng],
      [endLat, endLng]
    ],
    distanceKm,
    durationMins: Math.max(1, Math.round((distanceKm / 30) * 60)),
    steps: [
      {
        instruction: 'Proceed directly toward Incident Location coordinates',
        distance: formatDistance(distanceKm),
        duration: estimateTravelTime(distanceKm)
      }
    ]
  };
}
