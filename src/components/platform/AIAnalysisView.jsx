import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  MapPin, 
  Zap, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle, 
  FileText, 
  Activity, 
  Flame, 
  Scale, 
  Sparkles, 
  Copy, 
  Check, 
  Bookmark, 
  Sliders, 
  ChevronRight,
  Send,
  AlertOctagon,
  RefreshCw,
  Radio,
  Eye,
  X,
  ExternalLink,
  Database,
  Network,
  Crosshair,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import FullAnalysisModal from './FullAnalysisModal';
import { 
  addReportRecord, 
  addWeakSignalToBoard, 
  getStoredWeakSignals, 
  subscribeSafetyStore,
  getTodayDateString,
  getStoreState,
  extractUnitKey
} from '../../services/safetyStore';

// Available uploaded safety report data from ingestion registry
const AVAILABLE_UPLOADED_REPORTS = [
  {
    ref: 'OIL-BATCH-01',
    name: 'Main Pipeline High-Pressure Gas Leakage',
    type: 'NEAR_MISS',
    location: 'Unit 1',
    text: 'High-pressure gas pipeline flange developed severe leakage. Gas alarm at 65% LEL near switch.'
  },
  {
    ref: 'OIL-BATCH-02',
    name: 'Electrical Switchboard Fire and Smoke Outbreak',
    type: 'NEAR_MISS',
    location: 'Unit 2',
    text: 'Electrical fire erupted in distribution board due to overloaded breaker with open flames visible.'
  },
  {
    ref: 'OIL-BATCH-03',
    name: 'Storage Shed LPG Gas Cylinder Valve Leakage',
    type: 'UNSAFE_CONDITION',
    location: 'Unit 3',
    text: 'Pressurized LPG cylinder valve found leaking flammable propane gas inside storage shed.'
  },
  {
    ref: 'OIL-BATCH-04',
    name: 'Hot Work Welding Sparks Floor Flash Fire',
    type: 'UNSAFE_ACT',
    location: 'Unit 4',
    text: 'Welding sparks near solvent drum ignited oily rags on the floor causing an immediate flash fire.'
  }
];

// Baseline 6 Total Records from Database Ledger - Simple Fire and Gas Leakage Issues
const BASELINE_TOTAL_REPORTS = [
  {
    id: 1,
    report_reference: 'REP-ID001-0001',
    report_name: 'Compressor Station Natural Gas Pipeline Leakage',
    report_type: 'Near Miss',
    description: 'High-pressure natural gas pipeline flange suffered gasket blowout, releasing massive gas cloud across the compressor bay. Gas detector alarm triggered at 70% LEL in vicinity of unclassified electrical lights.',
    location: 'Unit 1',
    facility_unit: 'Gas Compressor Bay A',
    report_date: '2026-09-02',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    ai_score: 95,
    status: 'Action Required',
    identified_hazard: 'Flammable Natural Gas Leakage & Vapor Cloud Explosion Hazard',
    energy_source: 'High-Pressure Combustible Gas (60 bar)',
    barrier_status: 'PRIMARY GASKET SEAL FAILED',
    recommended_action: 'Trip Emergency Shutdown (ESD) valve, isolate gas supply, and replace flange gasket.'
  },
  {
    id: 2,
    report_reference: 'REP-ID001-0002',
    report_name: 'Main Substation Electrical Cabinet Fire Outbreak',
    report_type: 'Near Miss',
    description: 'Electrical fire erupted inside the 415V power distribution panel due to loose cable lug overheating. Flames reached 1.5 meters high with thick toxic smoke spreading into the control room.',
    location: 'Unit 2',
    facility_unit: 'Electrical Substation 02',
    report_date: '2026-09-03',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    ai_score: 92,
    status: 'Action Required',
    identified_hazard: 'Electrical Panel Fire Outbreak & Toxic Smoke Exposure',
    energy_source: 'Thermal & Electrical Energy (415V Arc Plasma)',
    barrier_status: 'ELECTRICAL FIRE BARRIER BREACHED',
    recommended_action: 'Trip substation main breaker, discharge CO2 extinguisher, and clear all combustible materials.'
  },
  {
    id: 3,
    report_reference: 'REP-ID001-0003',
    report_name: 'LPG Storage Tank Flange Flammable Gas Leakage',
    report_type: 'Unsafe Condition',
    description: 'Heavy propane gas leak detected around the bottom discharge flange of LPG Bulk Storage Tank 03. Flammable gas vapor pooled in low-lying ground trench near vehicle roadway without safety barricades.',
    location: 'Unit 3',
    facility_unit: 'LPG Storage Farm',
    report_date: '2026-09-04',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    ai_score: 89,
    status: 'Action Required',
    identified_hazard: 'Flammable LPG Gas Leakage & Low-Lying Vapor Cloud',
    energy_source: 'Pressurized Liquid Petroleum Gas (18 bar)',
    barrier_status: 'TANK BOTTOM FLANGE GASKET DAMAGED',
    recommended_action: 'Close emergency isolation valve, establish 100m cordon, and spray water curtain.'
  },
  {
    id: 4,
    report_reference: 'REP-ID001-0004',
    report_name: 'Structural Welding Sparks Igniting Solvent Floor Fire',
    report_type: 'Unsafe Act',
    description: 'Welder operated cutting torch directly above open degreaser solvent tub. Falling molten slag sparks ignited cleaning solvent, causing an instant 2-meter floor fire. No fire extinguisher or fire blanket was at the work post.',
    location: 'Unit 4',
    facility_unit: 'Fabrication Workshop Bay 4',
    report_date: '2026-09-01',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    ai_score: 86,
    status: 'Action Required',
    identified_hazard: 'Hot Work Welding Sparks Igniting Flammable Liquid Fire',
    energy_source: 'Thermal Molten Slag & Chemical Solvent Flame',
    barrier_status: 'FIRE BLANKET & HOT WORK CONTROLS OMITTED',
    recommended_action: 'Enforce 10-meter clearance from flammables and mandate certified continuous Fire Watch.'
  },
  {
    id: 5,
    report_reference: 'REP-ID001-0005',
    report_name: 'Staff Canteen Cooking Gas Stove Valve Micro-Leak',
    report_type: 'Unsafe Condition',
    description: 'Faint gas odor detected near kitchen commercial stove burner valve. Soap bubble test showed slow micro-seep on rubber hose clamp. Non-SIF low-pressure localized odor; kitchen exhaust was running.',
    location: 'Unit 1',
    facility_unit: 'Staff Facility Kitchen',
    report_date: '2026-09-02',
    risk_level: 'Low',
    sif_precursor_assessment: 'NO',
    ai_score: 28,
    status: 'Under Review',
    identified_hazard: 'Minor Low-Pressure Cooking Gas Valve Seep',
    energy_source: 'Low-Pressure Fuel Gas (< 0.5 bar)',
    barrier_status: 'PRIMARY VALVE SEAL AGED',
    recommended_action: 'Tighten hose clamp, replace aged rubber gas hose, and re-test with gas detector.'
  },
  {
    id: 6,
    report_reference: 'REP-ID001-0006',
    report_name: 'Office Smoking Area Trash Bin Smoldering Cigarette',
    report_type: 'Near Miss',
    description: 'Smoldering paper cup and cigarette butt found smoking inside metal trash bin outside office doorway. Extinguished immediately with a cup of water. Isolated minor housekeeping incident with zero flame spread.',
    location: 'Unit 2',
    facility_unit: 'Office Perimeter Walkway',
    report_date: '2026-09-04',
    risk_level: 'Low',
    sif_precursor_assessment: 'NO',
    ai_score: 19,
    status: 'Closed',
    identified_hazard: 'Smoldering Paper Waste in Metal Bin',
    energy_source: 'Low Thermal Ember',
    barrier_status: 'METAL ENCLOSURE CONTAINED EMBERS',
    recommended_action: 'Empty waste bin, fill ash receptacle with sand, and remind staff of smoking policy.'
  }
];

function getStoredTotalRecords() {
  try {
    const isWiped = typeof localStorage !== 'undefined' && localStorage.getItem('safetyai_data_wiped_fresh') === 'true';
    if (isWiped) {
      return [];
    }
    const raw = localStorage.getItem('SAFETY_TOTAL_REPORTS_V3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

function autoPersistToTotalRecords(newRecord) {
  try {
    const current = getStoredTotalRecords();
    const existingIndex = current.findIndex(
      r => (r.description && newRecord.description && r.description.trim() === newRecord.description.trim()) ||
           (r.report_reference && r.report_reference === newRecord.report_reference)
    );
    let updated;
    let savedRecord = newRecord;
    if (existingIndex >= 0) {
      savedRecord = { ...current[existingIndex], ...newRecord };
      updated = [...current];
      updated[existingIndex] = savedRecord;
    } else {
      updated = [newRecord, ...current];
    }
    localStorage.setItem('SAFETY_TOTAL_REPORTS_V3', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    return { record: savedRecord, totalCount: updated.length };
  } catch (err) {
    console.error('Error auto-saving report to total records:', err);
    return { record: newRecord, totalCount: 7 };
  }
}

const SAFETY_KEYWORDS = [
  // Hazards, Incidents & Conditions
  'leak', 'gas', 'fire', 'flame', 'smoke', 'spark', 'explosion', 'blast', 'burn', 'flash',
  'spill', 'blowout', 'hazard', 'unsafe', 'danger', 'risk', 'incident', 'injury', 'injur',
  'hurt', 'wound', 'fatality', 'fatal', 'precursor', 'sif', 'near miss', 'accident',
  'damage', 'defect', 'rupture', 'burst', 'crack', 'collapse', 'corros', 'rust', 'erosion',
  'slip', 'trip', 'fall', 'dropped', 'falling', 'pinch', 'crush', 'struck', 'whipping',
  'flying', 'sharp', 'cut', 'amputation', 'puncture', 'impact', 'collision',
  
  // Electrical & Energy Isolation
  'electrical', 'electric', 'voltage', '11kv', '415v', 'wire', 'arc', 'cable', 'breaker',
  'panel', 'switch', 'switchgear', 'switchboard', 'transformer', 'conduit', 'fuse', 'loto',
  'lockout', 'tagout', 'isolation', 'isolate', 'energiz', 'de-energiz', 'grounding', 'earthing',
  'shock', 'electrocution', 'overheat', 'short circuit',
  
  // Pressure, Piping & Fluids
  'valve', 'pipe', 'pipeline', 'flange', 'gasket', 'tank', 'cylinder', 'pressure', 'relief',
  'psi', 'bar', 'hiss', 'seep', 'weep', 'discharge', 'vent', 'flare', 'manifold', 'separator',
  'vessel', 'boiler', 'steam', 'hydraulic', 'pneumatic', 'fluid', 'gauge', 'meter',
  
  // Chemicals & Atmosphere
  'toxic', 'chemical', 'acid', 'caustic', 'asphyx', 'h2s', 'methane', 'propane', 'lpg',
  'hydrocarbon', 'fume', 'vapor', 'vapour', 'co2', 'nitrogen', 'oxygen', 'lel', 'gas detector',
  'monitor', 'detector', 'sensor', 'sniff', 'smell', 'odor', 'odour', 'dust', 'confined',
  
  // Mechanical, Lifting & Work at Height
  'crane', 'lift', 'hoist', 'rigging', 'sling', 'shackle', 'hook', 'winch', 'wire rope',
  'load', 'suspended', 'derrick', 'rig', 'drill', 'casing', 'tongs', 'rotary', 'wellhead',
  'scaffold', 'scaffolding', 'ladder', 'height', 'catwalk', 'grating', 'deck', 'platform',
  'guardrail', 'handrail', 'harness', 'lanyard', 'lifeline', 'anchor', 'tie-off', 'manway',
  
  // Barriers, Controls & PPE
  'barrier', 'barricade', 'fence', 'guard', 'interlock', 'e-stop', 'emergency stop', 'alarm',
  'siren', 'ppe', 'helmet', 'hard hat', 'glasses', 'goggle', 'gloves', 'boots', 'respirator',
  'mask', 'permit', 'ptw', 'work authorization', 'signage', 'caution', 'warning',
  
  // Plant Equipment, Mobile & Logistics
  'pump', 'engine', 'compressor', 'turbine', 'generator', 'motor', 'forklift', 'truck',
  'vehicle', 'trailer', 'traffic', 'reversing', 'driver', 'driving', 'seatbelt', 'brake',
  'excavat', 'trench', 'pit', 'housekeeping', 'clutter', 'obstruction', 'puddle'
];

const UNRELATED_TERMS = [
  'nothing', 'none', 'nil', 'na', 'n/a', 'not applicable', 'no issue', 'no issues', 
  'no hazard', 'nothing to report', 'all good', 'all normal', 'ok', 'okay', 'fine', 
  'good', 'test', 'testing', 'hi', 'hii', 'hiii', 'hiiii', 'hello', 'hey', 'heyy', 'check', 
  'demo', 'sample', 'abc', 'xyz', 'foo', 'bar', 'asdf', 'qwerty', 'asdfgh', '123', 
  '1234', 'blank', 'empty', 'null', 'undefined', 'nothin', 'clear', 'clean', 'normal'
];

const CONVERSATIONAL_PATTERNS = [
  /\b(beautiful|handsome|gorgeous|cute|pretty|sweet|sexy)\b/i,
  /\b(how\s+are\s+you|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do)\b/i,
  /\b(love\s+(you|this)|like\s+you|hate\s+you|marry\s+me)\b/i,
  /\b(good\s+(morning|afternoon|evening|night|day))\b/i,
  /\b(thank\s+you|thanks\s+a\s+lot|thanks|bye|goodbye|see\s+you)\b/i,
  /\b(you\s+are\s+(so|very|really)?\s*(cool|smart|great|good|bad|nice|awesome|amazing|wonderful))\b/i,
  /\b(tell\s+me\s+a\s+joke|sing\s+a\s+song|weather|movie|music)\b/i,
  /^(hi|hii|hiii|hello|hey|heyy|yo|test|testing|check)\b/i
];

function isUnrelatedIssue(text) {
  if (!text) return true;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length === 0) return true;
  if (UNRELATED_TERMS.includes(cleaned)) return true;
  if (CONVERSATIONAL_PATTERNS.some(p => p.test(cleaned))) return true;

  const hasSafetyWord = SAFETY_KEYWORDS.some(k => cleaned.includes(k));
  if (!hasSafetyWord) {
    return true;
  }
  if (cleaned.length < 4) return true;
  return false;
}

function isTrivialInput(text) {
  return isUnrelatedIssue(text);
}

function deriveReportName(text, type, loc) {
  if (!text) return `Safety Observation (${loc})`;
  if (isUnrelatedIssue(text)) return 'Enter Correct Issue';
  const matched = AVAILABLE_UPLOADED_REPORTS.find(r => r.text.trim() === text.trim());
  if (matched && matched.name) return matched.name;

  const lower = text.toLowerCase();
  if (lower.includes('gas') && (lower.includes('pipeline') || lower.includes('compressor'))) {
    return 'Main Pipeline High-Pressure Gas Leakage';
  } else if (lower.includes('lpg') || lower.includes('propane') || (lower.includes('gas') && lower.includes('cylinder'))) {
    return 'Storage Shed LPG Gas Cylinder Valve Leakage';
  } else if (lower.includes('gas') || lower.includes('leak')) {
    return 'Flammable Gas Pipeline Leakage Report';
  } else if (lower.includes('electrical') || lower.includes('switchboard') || lower.includes('panel') || lower.includes('breaker')) {
    return 'Electrical Switchboard Fire and Smoke Outbreak';
  } else if (lower.includes('welding') || lower.includes('spark') || lower.includes('hot work') || lower.includes('solvent')) {
    return 'Hot Work Welding Sparks Floor Flash Fire';
  } else if (lower.includes('fire') || lower.includes('flame') || lower.includes('smoke')) {
    return 'Industrial Facility Fire Outbreak Report';
  } else if (lower.includes('height') || lower.includes('scaffold') || lower.includes('fall')) {
    return 'Working at Height Scaffolding Hazard Report';
  } else if (lower.includes('crane') || lower.includes('sling') || lower.includes('lift')) {
    return 'Heavy Lifting Rigging and Hoisting Hazard Report';
  } else if (lower.includes('confined') || lower.includes('tank entry') || lower.includes('asphyxiat')) {
    return 'Confined Space Atmospheric Entry Hazard Report';
  } else if (lower.includes('chemical') || lower.includes('acid') || lower.includes('caustic')) {
    return 'Hazardous Chemical Exposure and Containment Report';
  }
  const firstClause = text.split(/[.!?\n]/)[0].trim();
  if (firstClause.length > 8 && firstClause.length <= 50) {
    return `${firstClause} Report`;
  }
  return `Safety Observation Report (${loc})`;
}

function calculateDynamicRiskScore(hazard, energy, exposure, barrierStatus, sifStatus, text) {
  if (isTrivialInput(text)) return 0;
  
  // 1. Hazard severity (0–30)
  let sev = 10;
  const hLow = (hazard || '').toLowerCase();
  if (['arc flash', 'electrical', 'explosion', 'gas leak', 'flammable', 'suspended load', 'dropped object', 'amputation'].some(k => hLow.includes(k))) {
    sev = 28;
  } else if (['fall from height', 'work at height', 'excavation', 'fire', 'chemical'].some(k => hLow.includes(k))) {
    sev = 24;
  } else if (hLow.includes('slip') || hLow.includes('trip')) {
    sev = 8;
  }

  // 2. Energy exposure (0–25)
  let ene = 5;
  const eLow = (energy || '').toLowerCase();
  if (energy && energy !== 'Insufficient Information') {
    if (['high-voltage', 'arc flash', 'pneumatic', 'pressure', 'toxic', 'thermal'].some(k => eLow.includes(k))) {
      ene = 24;
    } else if (eLow.includes('gravity / kinetic') || eLow.includes('low kinetic')) {
      ene = 5;
    } else if (eLow.includes('gravity') || eLow.includes('kinetic')) {
      ene = 15;
    }
  }

  // 3. Worker exposure (0–20)
  let exp = 5;
  const exLow = (exposure || '').toLowerCase();
  if (exposure && exposure !== 'Insufficient Information') {
    if (['line-of-fire', 'direct physical proximity', 'fall edge'].some(k => exLow.includes(k))) {
      exp = 18;
    } else if (exLow.includes('slip/fall exposure')) {
      exp = 6;
    }
  }

  // 4. Barrier condition (0–15)
  let bar = 4;
  if (barrierStatus === 'Barrier Failed' || barrierStatus === 'BARRIER_FAILED') {
    bar = 15;
  } else if (barrierStatus === 'Barrier Missing' || barrierStatus === 'BARRIER_MISSING') {
    bar = 13;
  } else if (barrierStatus === 'Barrier Intact' || barrierStatus === 'BARRIER_PRESENT') {
    bar = 2;
  } else {
    bar = 4;
  }

  // 5. Escalation potential (0–10)
  let esc = 3;
  const tLow = (text || '').toLowerCase();
  if (['flame', 'smoke', 'hiss', 'pressure', 'high', 'spreading'].some(k => tLow.includes(k))) {
    esc = 9;
  } else if (['stairs', 'steps', 'edge', 'ramp'].some(k => tLow.includes(k))) {
    esc = 5;
  } else if (['water', 'oil', 'grease', 'spill'].some(k => tLow.includes(k))) {
    esc = 4;
  }

  const total = sev + ene + exp + bar + esc;
  return Math.max(0, Math.min(100, total));
}

function getDynamicRecommendations(hazard, text) {
  const hLow = (hazard || '').toLowerCase();
  const tLow = (text || '').toLowerCase();
  if (hLow.includes('slip') || tLow.includes('slip') || tLow.includes('slippery') || tLow.includes('slick')) {
    return [
      'Clean and dry the affected area.',
      'Identify and correct the source of moisture.',
      'Place warning signage if the area remains slippery.',
      'Verify the area during routine inspection.'
    ];
  }
  if (hLow.includes('electrical') || hLow.includes('arc') || tLow.includes('electr')) {
    return [
      'De-energize electrical circuit and perform Lockout/Tagout (LOTO).',
      'Verify zero voltage using a calibrated test instrument before contact.',
      'Inspect enclosure, insulation, and conductors for thermal damage.',
      'Mandate qualified electrical PPE per NFPA 70E standards.'
    ];
  }
  if (hLow.includes('gas') || hLow.includes('pressure') || tLow.includes('gas') || tLow.includes('leak')) {
    return [
      'Isolate upstream supply valve and depressurize affected line segment.',
      'Evacuate area and perform continuous atmospheric gas testing (0% LEL).',
      'Inspect flange gasket, valve seals, and fittings for degradation.',
      'Establish safety exclusion perimeter until re-pressurization tests pass.'
    ];
  }
  if (hLow.includes('height') || hLow.includes('fall') || tLow.includes('scaffold')) {
    return [
      'Ensure certified 100% tie-off with inspected harness and lanyard.',
      'Install top-rail, mid-rail, and toe-board fall protection barriers.',
      'Red-tag scaffold or ladder until certified inspection sign-off.',
      'Clear walkway of trip hazards and verify secure planking.'
    ];
  }
  if (hLow.includes('load') || hLow.includes('crane') || tLow.includes('rigging')) {
    return [
      'Barricade drop zone and prohibit personnel from walking under suspended loads.',
      'Inspect rigging slings, hooks, and shackles for wear before lifting.',
      'Verify crane operator and rigger certifications and review lift plan.',
      'Use tag lines to control load swing from a safe distance.'
    ];
  }
  if (hLow.includes('chemical') || tLow.includes('chemical')) {
    return [
      'Deploy chemical spill kit and contain runoff with compatible absorbent.',
      'Wear appropriate chemical-resistant gloves, goggles, and respiratory PPE.',
      'Review Safety Data Sheet (SDS) for specific neutralization protocols.',
      'Ventilate area and verify integrity of primary chemical containers.'
    ];
  }
  return [
    'Conduct immediate walkdown inspection to identify hazard root cause.',
    'Implement appropriate physical controls and warning demarcation.',
    'Verify area condition during regular shift safety inspections.',
    'Log findings in facility safety maintenance tracking register.'
  ];
}

function getDynamicExplanation(sifStatus, hazard, energy, exposure, barrierStatus, text) {
  if (sifStatus === 'NO' || sifStatus === 'NON-SIF') {
    if (hazard && hazard.toLowerCase().includes('slip')) {
      return 'Classified as Non-SIF because the report indicates a slip/fall hazard but does not provide evidence of high-energy exposure, significant worker exposure, or a barrier deficiency.';
    }
    return `Classified as Non-SIF because the report indicates ${hazard ? hazard.toLowerCase() : 'a routine operational condition'} without evidence of fatal high-energy vectors or critical barrier failure.`;
  }
  if (sifStatus === 'INSUFFICIENT_INFORMATION') {
    return 'Insufficient information is available for a reliable SIF precursor assessment. The report text does not provide adequate detail regarding specific hazardous energy sources, personnel exposure points, or safety barrier controls.';
  }
  return `Potential SIF precursor identified based on detected ${energy || 'hazardous energy'} and ${exposure || 'worker exposure'} with ${barrierStatus || 'barrier deficiency'}. Immediate barrier restoration required.`;
}

function getDynamicConfidence(hazard, energy, exposure, barrierStatus, text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 3 || (hazard === 'Insufficient Information' && energy === 'Insufficient Information')) {
    return 'Not Available';
  }
  let base = 82.0;
  if (hazard && hazard !== 'Insufficient Information') base += 6.5;
  if (energy && energy !== 'Insufficient Information') base += 4.5;
  if (barrierStatus && barrierStatus !== 'Insufficient Information') base += 3.5;
  return Math.min(96.8, Math.round(base * 10) / 10);
}

function analyzeSafetyObservation(text, rType) {
  const lower = (text || '').toLowerCase().trim();

  // 1. Hazard
  let hazard = 'Insufficient Information';
  if (/slip\w*|slippery|slick|trip|uneven surface|water on floor|oily floor|oil.*leak/i.test(lower)) {
    hazard = 'Slip / Fall Hazard (Walking-Working Surface)';
  } else if (/heat|extreme heat|cooling system|heat stroke|heat exhaustion|high temperature|ambient heat/i.test(lower)) {
    hazard = 'Heat Exposure & Thermal Environmental Hazard';
  } else if (/hot pipe|hot surface|touching.*hot|hot equipment|scalding/i.test(lower)) {
    hazard = 'Hot Surface & Thermal Hazard';
  } else if (/suspended load|overhead load|crane lift|rigging|dropped object|falling pipe/i.test(lower)) {
    hazard = 'Suspended Load & Dropped Object Hazard';
  } else if (/height|scaffold|ladder|roof|edge|climbing/i.test(lower)) {
    hazard = 'Work at Height & Fall Hazard';
  } else if (/conductor|live conductor|insulation|electr|voltage|arc flash|switchboard|breaker|live wire/i.test(lower)) {
    hazard = 'Electrical Arc Flash & Shock Hazard';
  } else if (/gas|pipeline|propane|lpg|cylinder|compressor|hiss/i.test(lower)) {
    hazard = 'Flammable Gas Leakage';
  } else if (/pressure release|high-pressure release|uncontrolled.*pressure|pressur|hydraulic|steam|line break|hydrotest/i.test(lower)) {
    hazard = 'Hazardous Pressure & Line Release';
  } else if (/fire|flame|spark|welding|hot work|combustible/i.test(lower)) {
    hazard = 'Fire & Thermal Ignition Hazard';
  } else if (/chemical|acid|caustic|solvent|corrosive/i.test(lower)) {
    hazard = 'Hazardous Chemical Exposure';
  } else if (/moving vehicle|struck by.*vehicle|vehicle.*plant|forklift|vehicle|truck|dumper|loader/i.test(lower)) {
    hazard = 'Mobile Equipment & Vehicle Interaction Hazard';
  } else if (/rotating|pinch|conveyor|roller|blade|entangle|machine guard|machinery without/i.test(lower)) {
    hazard = 'Rotating Machinery & Entanglement Hazard';
  }

  // 2. Energy Vector
  let energyVector = 'Insufficient Information';
  if (/heat|extreme heat|hot pipe|hot surface|cooling system|thermal|fire|flame|spark/i.test(lower)) {
    energyVector = 'Thermal Energy';
  } else if (/live conductor|conductor|insulation|electr|voltage|415v|11kv|arc/i.test(lower)) {
    energyVector = 'Electrical Energy';
  } else if (/pressure release|high-pressure release|uncontrolled.*pressure|gas|pressure|pneumatic|hydraulic|steam/i.test(lower)) {
    energyVector = 'Stored Pressure / Pneumatic & Hydraulic Energy';
  } else if (/moving vehicle|struck by.*vehicle|vehicle.*plant|vehicle|truck|forklift/i.test(lower)) {
    energyVector = 'Kinetic Energy';
  } else if (/rotating|machinery|roller|blade|nip point|machine guard/i.test(lower)) {
    energyVector = 'Mechanical Energy';
  } else if (/height|scaffold|ladder|roof|edge|dropped/i.test(lower)) {
    energyVector = 'Gravity';
  } else if (/slip\w*|slippery|slick|wet floor|oily floor|oil leaked/i.test(lower)) {
    energyVector = 'Gravity / Kinetic';
  } else if (/chemical|acid|toxic|caustic/i.test(lower)) {
    energyVector = 'Chemical / Toxic Energy';
  }

  // 3. Worker Exposure
  let workerExposure = 'Insufficient Information';
  if (/hot pipe|hot surface|touching.*hot/i.test(lower)) {
    workerExposure = 'Direct contact with hot surface / thermal equipment';
  } else if (/heat|extreme heat|cooling system|high temperature|heat-rest/i.test(lower)) {
    workerExposure = 'Exposure to excessive heat / elevated thermal environment';
  } else if (/live.*conductor|energized conductor|contact.*energized|near energized/i.test(lower)) {
    workerExposure = 'Worker in direct physical proximity or potential contact with live electrical conductors';
  } else if (/struck by.*vehicle|moving vehicle|vehicle.*plant|pedestrian/i.test(lower)) {
    workerExposure = 'Pedestrian worker situated in immediate trajectory of mobile equipment';
  } else if (/uncontrolled.*pressure|pressure release/i.test(lower)) {
    workerExposure = 'Worker situated in direct line-of-fire of uncontrolled pressure release';
  } else if (/under load|beneath|in drop zone/i.test(lower)) {
    workerExposure = 'Worker directly exposed in line-of-fire beneath suspended load';
  } else if (/at height|on scaffold|on roof|near edge/i.test(lower)) {
    workerExposure = 'Worker exposed to unprotected fall edge at elevation';
  } else if (/machinery without.*guard|unguarded.*machin/i.test(lower)) {
    workerExposure = 'Worker limbs in proximity to unguarded mechanical movement';
  } else if (/slip|slippery|slick|oily floor/i.test(lower)) {
    workerExposure = 'Potential slip/fall exposure on compromised walking surface';
  }

  // 4. Barrier Status
  let barrierStatus = 'Insufficient Information';
  if (/cooling system failed|damaged electrical insulation|damaged insulation|uncontrolled.*pressure|snapped|broke|failed|barrier failed/i.test(lower)) {
    barrierStatus = 'Barrier Failed';
  } else if (/ignored.*heat-rest|without.*guard|no guard|missing guard|no harness|without permit|ignored.*ppe|without.*ppe/i.test(lower)) {
    barrierStatus = 'Barrier Missing';
  } else if (/safety net caught|harness arrested|interlock stopped|emergency stop activated|tripped breaker|alarm sounded/i.test(lower)) {
    barrierStatus = 'Barrier Intact';
  } else if (/heat|extreme heat/i.test(lower)) {
    barrierStatus = 'Insufficient information regarding heat controls';
  }

  // 5. Dynamic Classification Logic
  const hasNoInjury = /\b(not injured|no injury|no one was injured|no one injured|avoided injury|without injury)\b/i.test(lower);
  const hasInjury = /\b(injured|injury|burns?|wound|cut|amputation|fracture|heat stroke|hospitaliz|hurt)\b/i.test(lower) && !hasNoInjury;
  const hasNearMiss = /\b(almost slipped|nearly slipped|nearly struck|almost struck|nearly hit|nearly contacted|almost contacted|nearly came into contact|narrowly avoided|close call)\b/i.test(lower);
  const hasUnsafeAct = /\b(ignored.*(heat-rest|schedule|ppe|rule|procedure|warning|permit)|operated.*without|operating.*without|without required|without the required|failed to wear|bypassed|entered.*restricted|without authorization|without following the required procedure)\b/i.test(lower);

  let classification = 'UNSAFE CONDITION';
  let classificationCode = 'UNSAFE_CONDITION';
  if (hasInjury) {
    if (hasUnsafeAct) {
      classification = 'UNSAFE ACT';
      classificationCode = 'UNSAFE_ACT';
    } else {
      classification = 'UNSAFE CONDITION';
      classificationCode = 'UNSAFE_CONDITION';
    }
  } else {
    if (hasNearMiss || (hasNoInjury && /\b(almost|nearly|narrowly|close call|slipped|contact|struck)\b/i.test(lower))) {
      classification = 'NEAR MISS';
      classificationCode = 'NEAR_MISS';
    } else if (hasUnsafeAct) {
      classification = 'UNSAFE ACT';
      classificationCode = 'UNSAFE_ACT';
    } else {
      classification = 'UNSAFE CONDITION';
      classificationCode = 'UNSAFE_CONDITION';
    }
  }

  // 6. Context-Derived Root Cause
  let rootCause = 'Insufficient Information';
  if (/ignored.*heat-rest/i.test(lower)) {
    rootCause = 'Failure to follow the mandatory heat-rest schedule resulted in prolonged worker exposure to extreme heat and consequent injury.';
  } else if (/cooling system failed/i.test(lower)) {
    rootCause = 'Mechanical failure of the workspace cooling system resulted in excessive heat accumulation and consequent heat injury.';
  } else if (/\b(heat|extreme heat)\b/i.test(lower) && !/welding|fire|hot pipe/i.test(lower)) {
    rootCause = hasInjury
      ? 'The reported injury appears to be associated with uncontrolled heat exposure; additional information is required to determine the specific underlying cause.'
      : 'Excessive thermal environmental conditions created heat exposure hazard without adequate cooling or rest controls.';
  } else if (/ignored.*ppe/i.test(lower) && /chemical|burn|acid/i.test(lower)) {
    rootCause = 'Failure to follow required PPE controls resulted in worker exposure to the chemical hazard.';
  } else if (/operated.*machin.*without.*guard|machinery without.*guard/i.test(lower)) {
    rootCause = 'Operating machinery without the required safeguard in place resulted in direct worker contact with moving parts and injury.';
  } else if (/oil was leaking|oil leaked/i.test(lower)) {
    rootCause = 'Failure to control the equipment leak resulted in oil accumulation and created a slip hazard.';
  } else if (/almost slipped/i.test(lower)) {
    rootCause = 'Inadequate control of the walking surface condition created a slip potential, narrowly avoiding personnel injury.';
  } else if (/damaged electrical insulation/i.test(lower)) {
    rootCause = 'Physical degradation or mechanical damage to electrical insulation compromised energized conductor isolation.';
  } else if (/nearly contacted/i.test(lower) && /conductor|electrical|wire/i.test(lower)) {
    rootCause = 'Inadequate electrical isolation, guarding, or clearance boundaries allowed worker proximity to energized conductors.';
  } else if (/uncontrolled.*pressure/i.test(lower)) {
    rootCause = 'Loss of pressure containment or mechanical integrity failure resulted in an uncontrolled high-pressure energy release.';
  } else if (/struck by.*vehicle/i.test(lower)) {
    rootCause = 'Inadequate pedestrian segregation and traffic management controls allowed moving vehicle interaction with worker.';
  } else if (classification === 'UNSAFE ACT') {
    rootCause = 'Deviation from established operational safety protocols directly contributed to the observed event.';
  } else if (classification === 'UNSAFE CONDITION' && hazard !== 'Insufficient Information') {
    rootCause = 'Physical or environmental workplace hazards remained unmitigated, presenting operational risk.';
  }

  // 7. SIF Determination
  const isSevereHeat = /\b(life-threatening|heat stroke|hospitaliz|critical|unconscious)\b/i.test(lower);
  const isHighEnergy = (
    /\b(uncontrolled.*pressure|high-pressure release|struck by.*vehicle|moving vehicle|live conductor|energized conductor|suspended load|dropped object|fall from height|machinery without.*guard|amputation)\b/i.test(lower) ||
    (['Electrical Energy', 'Stored Pressure / Pneumatic & Hydraulic Energy', 'Kinetic Energy', 'Gravity'].includes(energyVector) && !hazard.includes('Slip')) ||
    (energyVector === 'Thermal Energy' && isSevereHeat)
  );

  let sifPrecursor = isHighEnergy ? 'YES' : 'NO';
  let sifStatus = isHighEnergy ? 'SIF' : 'NON-SIF';

  const riskScore = calculateDynamicRiskScore(hazard, energyVector, workerExposure, barrierStatus, sifPrecursor, text);
  const confidence = getDynamicConfidence(hazard, energyVector, workerExposure, barrierStatus, text);
  const recommendations = getDynamicRecommendations(hazard, text);
  
  let explanation = '';
  if ((lower.includes('heat') || lower.includes('thermal')) && hasInjury && classification === 'UNSAFE CONDITION') {
    explanation = 'The report describes an actual heat-related injury, so it is not a near miss. The available information does not identify unsafe worker behavior, so the event should not automatically be classified as an unsafe act. The reported context primarily indicates heat exposure as the hazard. No clear SIF pathway is established from the available information.';
  } else {
    explanation = getDynamicExplanation(sifPrecursor, hazard, energyVector, workerExposure, barrierStatus, text);
  }

  return {
    classification,
    classificationCode,
    sifStatus,
    sifPrecursor,
    hazard,
    energyVector,
    workerExposure,
    barrierStatus,
    rootCause,
    riskScore,
    confidence,
    recommendations,
    explanation,
    detectedHazards: [
      `Hazard: ${hazard}`,
      `Energy Vector: ${energyVector}`,
      `Worker Exposure: ${workerExposure}`,
      `Barrier Status: ${barrierStatus}`
    ]
  };
}

// Dynamic Weak Signals Correlation across Real Records Only
// STRICT RULE: Requires >= 2 recurring observations across Location + Activity + Time
function generateAllWeakSignalsAnalysis(storedReports, currentResult, currentText, currentLocation) {
  const textLower = (currentText || '').toLowerCase();
  if (!textLower.trim() || isTrivialInput(textLower)) return [];

  const candidateCategories = [
    {
      id: 'WS-001',
      code: 'GAS-LEAK-RECURRING',
      category: 'Gas Containment & Leak Prevention',
      keywords: ['gas', 'leak', 'pipeline', 'compressor', 'flange', 'hissing', 'lel', 'propane', 'lpg'],
      title: 'Recurring Gas Containment & Micro-Leakage Observations',
      aiDetectionCriteria: 'Recurring gas leak observations or vapor accumulation across operating facilities.',
      systemicMitigation: '1. Shut Emergency Shutdown (ESD) valves.\n2. Evacuate personnel upwind.\n3. Replace degraded seals and verify bubble leak test.'
    },
    {
      id: 'WS-002',
      code: 'ELEC-THERMAL-RECURRING',
      category: 'Electrical Safety & Distribution Panels',
      keywords: ['electrical', 'panel', 'breaker', 'switchboard', 'cable', 'arcing', 'substation', 'lug', 'transformer'],
      title: 'Recurring Electrical Panel & Enclosure Integrity Observations',
      aiDetectionCriteria: 'Multiple observations noting overheated busbars, damaged conduit, or tripping breakers.',
      systemicMitigation: '1. De-energize and LOTO circuit.\n2. Perform infrared thermal scanning.\n3. Verify torque on terminal connections.'
    },
    {
      id: 'WS-003',
      code: 'FALL-HEIGHT-RECURRING',
      category: 'Working at Height & Scaffold Safety',
      keywords: ['scaffold', 'height', 'ladder', 'guardrail', 'harness', 'plank', 'fall'],
      title: 'Recurring Elevated Work & Fall Protection Gaps',
      aiDetectionCriteria: 'Multiple height safety observations in identical operating zones.',
      systemicMitigation: '1. Mandate 100% harness tie-off.\n2. Install certified guardrails.\n3. Red-tag scaffold until re-inspected.'
    }
  ];

  const matchesKeywords = (str, keywords) => {
    const s = (str || '').toLowerCase();
    return keywords.some(k => s.includes(k));
  };

  const results = [];

  candidateCategories.forEach(config => {
    const matchesCurrent = matchesKeywords(textLower, config.keywords);
    const matchingRecords = [];

    if (matchesCurrent) {
      matchingRecords.push({
        ref: 'Current Analyzed Record',
        name: currentResult?.report_name || deriveReportName(currentText, 'NEAR_MISS', currentLocation),
        unit: currentLocation || 'Operating Unit',
        date: new Date().toISOString().split('T')[0],
        role: 'Active Trigger Record',
        excerpt: currentText.length > 150 ? currentText.slice(0, 150) + '...' : currentText
      });
    }

    // Correlate ONLY against actual stored records in the system
    if (Array.isArray(storedReports)) {
      storedReports.forEach(rep => {
        const repText = ((rep.description || '') + ' ' + (rep.identified_hazard || '') + ' ' + (rep.report_name || '')).toLowerCase();
        const repLoc = rep.facility_unit || rep.location || '';
        if (matchesKeywords(repText, config.keywords)) {
          // Verify Location or Activity match
          const locMatch = !currentLocation || repLoc.includes(currentLocation) || currentLocation.includes(repLoc);
          if (locMatch || matchesCurrent) {
            matchingRecords.push({
              ref: rep.report_reference || `REC-${rep.id}`,
              name: rep.report_name || rep.identified_hazard || 'Operational Record',
              unit: repLoc || 'Facility',
              date: rep.report_date || '2026-09-03',
              role: 'Database Correlated Record',
              excerpt: rep.description ? (rep.description.length > 150 ? rep.description.slice(0, 150) + '...' : rep.description) : 'Archived safety observation.'
            });
          }
        }
      });
    }

    // STRICT THRESHOLD: Must have 2 or more real observations across location/activity/time
    if (matchingRecords.length >= 2 && matchesCurrent) {
      results.push({
        ...config,
        isPresentInCurrent: true,
        identifyingRecords: matchingRecords,
        identifyingRecordsCount: matchingRecords.length,
        presentRecordObservation: currentText,
        historicalMatches: matchingRecords.filter(r => r.ref !== 'Current Analyzed Record'),
        why_identified: `Recurring pattern of ${matchingRecords.length} related observations identified across ${currentLocation} over time.`
      });
    }
  });

  return results;
}

export default function AIAnalysisView() {
  const [reportType, setReportType] = useState('NEAR_MISS');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Unit 1');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [uploadedIndex, setUploadedIndex] = useState(0);

  // Auto-saved confirmation state
  const [autoSavedInfo, setAutoSavedInfo] = useState(null);

  // Weak Signals Modal State
  const [showWeakSignalsModal, setShowWeakSignalsModal] = useState(false);
  const [selectedWeakSignal, setSelectedWeakSignal] = useState(null);
  const [selectedDossierReport, setSelectedDossierReport] = useState(null);
  const [expandedHistoricalRecord, setExpandedHistoricalRecord] = useState(null);
  const [totalStoredRecords, setTotalStoredRecords] = useState(getStoredTotalRecords);

  useEffect(() => {
    const handleStorageChange = () => {
      setTotalStoredRecords(getStoredTotalRecords());
    };
    window.addEventListener('storage', handleStorageChange);
    const unsubStore = subscribeSafetyStore(() => {
      setTotalStoredRecords(getStoredTotalRecords());
    });
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      unsubStore();
    };
  }, []);

  const executeInference = async (textToAnalyze, typeToUse, unitToUse) => {
    const text = (textToAnalyze || description || '').trim();
    const loc = unitToUse || location;
    const rType = typeToUse || reportType;

    if (!text) return;

    setIsAnalyzing(true);
    setAutoSavedInfo(null);
    setAnalysisStep('Phase 1/4: Ingesting uploaded report telemetry & parsing energy vectors...');

    setTimeout(() => {
      setAnalysisStep('Phase 2/4: Screening IOGP Life-Saving Rules & barrier failure states...');
    }, 250);

    setTimeout(() => {
      setAnalysisStep('Phase 3/4: Correlating multi-signal interaction & detecting weak signals...');
    }, 500);

    setTimeout(() => {
      setAnalysisStep('Phase 4/4: Computing neural risk score & SIF precursor determination...');
    }, 750);

    const isUnrelated = isUnrelatedIssue(text);
    const reportName = deriveReportName(text, rType, loc);

    // UNRELATED / TRIVIAL INPUT INTERCEPT: Prompt user to enter a correct safety issue
    if (isUnrelated) {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisStep('');
        setValidationError('Enter Correct Issue: Please describe an active operational safety observation, equipment condition, or hazard.');

        const finalResult = {
          is_unrelated: true,
          report_name: 'Enter Correct Issue',
          sif_precursor: 'NO',
          confidence: 0,
          risk_score: 0,
          classification: rType,
          detected_hazards: [
            'Observation does not contain recognized industrial safety hazards or equipment context',
            'Zero physical energy vectors or critical barrier failures found in input'
          ],
          energy_source: 'None Identified',
          barrier_status: 'Not Applicable (Unrelated Input)',
          iogp_rule: 'Not Applicable',
          explainable_reasoning: `The input "${text}" is not recognized as a related operational safety issue. Please enter a correct safety issue describing equipment, location, barrier conditions, or hazardous energy vectors.`,
          recommended_controls: [
            'Enter a correct safety issue describing equipment, location, and conditions',
            'Include specific hazard parameters (e.g. pressure, voltage, chemical, elevation)',
            'Or click below to populate a pre-configured verified operational report'
          ],
          corrective_actions: [
            'Provide frontline coaching on entering actionable safety observations'
          ]
        };

        setAnalysisResult(finalResult);
      }, 400);
      return;
    }

    // Try backend AI analysis endpoint for real observations
    try {
      const backendResult = await api.executeAiAnalysis({
        report_text: text,
        report_name: reportName,
        report_type: rType === 'NEAR_MISS' ? 'Near Miss' : rType === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition',
        location: loc,
        site: loc === 'Unit 1' ? 'Plant 01' : loc === 'Unit 2' ? 'Plant 02' : loc === 'Unit 3' ? 'Plant 03' : 'Plant 04',
        report_date: reportDate
      });

      if (backendResult) {
        setTimeout(() => {
          setIsAnalyzing(false);
          setAnalysisStep('');

          if (backendResult.is_unrelated) {
            setValidationError('Enter Correct Issue: Please describe an active operational safety observation, equipment condition, or hazard.');
            setAnalysisResult({
              is_unrelated: true,
              report_name: 'Enter Correct Issue',
              sif_precursor: 'NO',
              confidence: 0,
              risk_score: 0,
              classification: rType,
              detected_hazards: [
                'Observation does not contain recognized industrial safety hazards or equipment context',
                'Zero physical energy vectors or critical barrier failures found in input'
              ],
              energy_source: 'None Identified',
              barrier_status: 'Not Applicable (Unrelated Input)',
              iogp_rule: 'Not Applicable',
              explainable_reasoning: `The input "${text}" is not recognized as a related operational safety issue. Please enter a correct safety issue describing equipment, location, barrier conditions, or hazardous energy vectors.`,
              recommended_controls: [
                'Enter a correct safety issue describing equipment, location, and conditions',
                'Include specific hazard parameters (e.g. pressure, voltage, chemical, elevation)',
                'Or click below to populate a pre-configured verified operational report'
              ],
              corrective_actions: [
                'Provide frontline coaching on entering actionable safety observations'
              ]
            });
            return;
          }

          const detStatus = (backendResult.determination_status || '').toLowerCase();
          const sifVal = backendResult.sif_precursor || (detStatus.includes('sif') && !detStatus.includes('no sif') && !detStatus.includes('not a sif') ? 'YES' : detStatus.includes('insufficient') ? 'INSUFFICIENT_INFORMATION' : 'NO');
          const isSIF = sifVal === 'YES';
          const dynamicRiskScore = typeof backendResult.sif_potential_score === 'number' 
            ? backendResult.sif_potential_score 
            : calculateDynamicRiskScore(backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, sifVal, text);
          const confidence = backendResult.confidence !== undefined ? backendResult.confidence : getDynamicConfidence(backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, text);

          const hazards = Array.isArray(backendResult.detected_hazards) && backendResult.detected_hazards.length > 0
            ? backendResult.detected_hazards
            : [
                `Hazard: ${backendResult.hazard || 'Insufficient Information'}`,
                `Energy Vector: ${backendResult.energy_vector || 'Insufficient Information'}`,
                `Worker Exposure: ${backendResult.worker_exposure || 'Insufficient Information'}`,
                `Barrier Status: ${backendResult.barrier_status || 'Insufficient Information'}`
              ];

          const recControls = Array.isArray(backendResult.recommended_controls) && backendResult.recommended_controls.length > 0
            ? backendResult.recommended_controls
            : getDynamicRecommendations(backendResult.hazard, text);

          const capaActions = Array.isArray(backendResult.corrective_actions) && backendResult.corrective_actions.length > 0
            ? backendResult.corrective_actions
            : [
                'Log observation in facility safety maintenance tracking register',
                'Verify area condition during routine safety inspections'
              ];

          const reasoning = backendResult.explanation || backendResult.why_identified?.summary || getDynamicExplanation(sifVal, backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, text);

          const classifiedType = backendResult.classification || (rType === 'NEAR_MISS' ? 'NEAR MISS' : rType === 'UNSAFE_ACT' ? 'UNSAFE ACT' : 'UNSAFE CONDITION');
          const finalResult = {
            report_name: backendResult.report_name || reportName,
            sif_precursor: sifVal,
            confidence: confidence,
            risk_score: dynamicRiskScore,
            classification: classifiedType,
            hazard: backendResult.hazard,
            detected_hazards: hazards,
            energy_source: backendResult.energy_vector || (isSIF ? 'High Potential Energy Vector' : 'Gravity / Kinetic'),
            barrier_status: backendResult.barrier_status || 'Insufficient Information',
            root_cause: backendResult.root_cause || (backendResult.why_identified?.root_cause) || 'Insufficient Information',
            iogp_rule: backendResult.life_saving_rule || (isSIF ? 'Line of Fire (LSR-03)' : 'Workplace Housekeeping Standards'),
            explainable_reasoning: reasoning,
            recommended_controls: recControls,
            corrective_actions: capaActions
          };

          setAnalysisResult(finalResult);

          // AUTOMATICALLY PERSIST INTO CENTRAL SAFETY STORE & TOTAL RECORDS
          const currentRecords = getStoredTotalRecords();
          const nextRef = `REP-ID001-000${currentRecords.length + 1}`;
          const newRecordToSave = {
            id: Date.now(),
            report_reference: nextRef,
            report_name: finalResult.report_name,
            report_type: classifiedType === 'NEAR MISS' ? 'Near Miss' : classifiedType === 'UNSAFE ACT' ? 'Unsafe Act' : 'Unsafe Condition',
            description: text.slice(0, 100),
            location: loc,
            facility_unit: `${loc} Active Operations`,
            report_date: reportDate,
            risk_level: isSIF ? 'Critical' : 'Low',
            sif_precursor_assessment: sifVal,
            ai_score: dynamicRiskScore,
            status: isSIF ? 'Action Required' : 'Under Review',
            identified_hazard: finalResult.hazard || 'Operational Hazard',
            energy_source: finalResult.energy_source,
            barrier_status: finalResult.barrier_status,
            root_cause: finalResult.root_cause,
            recommended_action: recControls[0] || 'Implement critical barrier control.',
            // Requirement 11: Store separate AI fields for human review compatibility
            ai_classification: classifiedType === 'NEAR MISS' ? 'Near Miss' : classifiedType === 'UNSAFE ACT' ? 'Unsafe Act' : 'Unsafe Condition',
            ai_sif_score: dynamicRiskScore,
            ai_confidence: confidence,
            human_classification: null,
            human_sif_score: null,
            reviewer_feedback: null,
            review_status: 'Pending Review'
          };

          const centralSaved = addReportRecord(newRecordToSave);
          const persistResult = autoPersistToTotalRecords(newRecordToSave);
          const savedRef = centralSaved?.report?.report_reference || persistResult?.record?.report_reference || nextRef;
          const savedCount = centralSaved?.totalCount || persistResult?.totalCount || currentRecords.length + 1;
          setAutoSavedInfo({ reference: savedRef, totalCount: savedCount });
          setTotalStoredRecords(getStoredTotalRecords());

          // Auto-sync detected weak signals to Weak Signals Board
          if (Array.isArray(backendResult.weak_signals) && backendResult.weak_signals.length > 0) {
            backendResult.weak_signals.forEach(ws => {
              addWeakSignalToBoard({
                title: ws.title || `${ws.category} Latent Deviation`,
                category: ws.category || 'Process Safety Management',
                risk_score: ws.risk_score || dynamicRiskScore,
                risk_level: ws.risk_score >= 90 ? 'High' : 'Medium',
                energy_source: ws.energy_source || finalResult.energy_source,
                barrier_status: ws.barrier_status || finalResult.barrier_status,
                potential_sif_precursor: ws.potential_sif_precursor || `Potential SIF Precursor escalation toward ${finalResult.hazard}`,
                source_reports: [{
                  report_id: savedRef,
                  report_type: newRecordToSave.report_type,
                  date_submitted: newRecordToSave.report_date,
                  short_description: newRecordToSave.description,
                  unit: newRecordToSave.location,
                  excerpt: text
                }]
              });
            });
          }

        }, 850);
        return;
      }
    } catch (err) {
      // Fallback to internal dynamic evaluation
    }

    // INTERNAL DYNAMIC SAFETY OBSERVATION EVALUATION
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisStep('');

      const dynamicAnalysis = analyzeSafetyObservation(text, rType);
      const sifVal = dynamicAnalysis.sifPrecursor;
      const isSIF = sifVal === 'YES';

      const classifiedType = dynamicAnalysis.classification || (rType === 'NEAR_MISS' ? 'NEAR MISS' : rType === 'UNSAFE_ACT' ? 'UNSAFE ACT' : 'UNSAFE CONDITION');
      const finalResult = {
        report_name: reportName,
        sif_precursor: sifVal,
        confidence: dynamicAnalysis.confidence,
        risk_score: dynamicAnalysis.riskScore,
        classification: classifiedType,
        hazard: dynamicAnalysis.hazard,
        detected_hazards: dynamicAnalysis.detectedHazards,
        energy_source: dynamicAnalysis.energyVector,
        barrier_status: dynamicAnalysis.barrierStatus,
        root_cause: dynamicAnalysis.rootCause,
        iogp_rule: isSIF ? 'Critical Safety Standard' : 'Workplace Housekeeping Standards',
        explainable_reasoning: dynamicAnalysis.explanation,
        recommended_controls: dynamicAnalysis.recommendations,
        corrective_actions: [
          'Log observation in routine facility maintenance register for supervisor review',
          'Verify area condition during regular shift safety inspections'
        ]
      };

      setAnalysisResult(finalResult);

      // AUTOMATICALLY PERSIST INTO CENTRAL SAFETY STORE & TOTAL RECORDS
      const currentRecords = getStoredTotalRecords();
      const nextRef = `REP-ID001-000${currentRecords.length + 1}`;
      const newRecordToSave = {
        id: Date.now(),
        report_reference: nextRef,
        report_name: finalResult.report_name,
        report_type: classifiedType === 'NEAR MISS' ? 'Near Miss' : classifiedType === 'UNSAFE ACT' ? 'Unsafe Act' : 'Unsafe Condition',
        description: text.slice(0, 100),
        location: loc,
        facility_unit: `${loc} Operating Bay`,
        report_date: reportDate,
        risk_level: isSIF ? 'Critical' : 'Low',
        sif_precursor_assessment: sifVal,
        ai_score: finalResult.risk_score,
        status: isSIF ? 'Action Required' : 'Under Review',
        identified_hazard: finalResult.hazard || 'Operational Hazard',
        energy_source: finalResult.energy_source,
        barrier_status: finalResult.barrier_status,
        root_cause: finalResult.root_cause,
        recommended_action: finalResult.recommended_controls[0] || 'Implement critical barrier control.',
        // Requirement 11: Store separate AI fields for human review compatibility
        ai_classification: classifiedType === 'NEAR MISS' ? 'Near Miss' : classifiedType === 'UNSAFE ACT' ? 'Unsafe Act' : 'Unsafe Condition',
        ai_sif_score: finalResult.risk_score,
        ai_confidence: finalResult.confidence,
        human_classification: null,
        human_sif_score: null,
        reviewer_feedback: null,
        review_status: 'Pending Review'
      };

      const centralSaved = addReportRecord(newRecordToSave);
      const persistResult = autoPersistToTotalRecords(newRecordToSave);
      const savedRef = centralSaved?.report?.report_reference || persistResult?.record?.report_reference || nextRef;
      const savedCount = centralSaved?.totalCount || persistResult?.totalCount || currentRecords.length + 1;
      setAutoSavedInfo({ reference: savedRef, totalCount: savedCount });
      setTotalStoredRecords(getStoredTotalRecords());

    }, 850);
  };

  const handleReset = () => {
    setDescription('');
    setLocation('Unit 1');
    setAnalysisResult(null);
    setAnalysisStep('');
    setAutoSavedInfo(null);
    setValidationError('');
  };

  const handleRunAnalysis = async () => {
    setValidationError('');
    let textToAnalyze = description.trim().slice(0, 100);
    let typeToUse = reportType;
    let unitToUse = location;

    // If user has not typed anything, use the available uploaded safety report data
    if (!textToAnalyze) {
      const selectedUploaded = AVAILABLE_UPLOADED_REPORTS[uploadedIndex % AVAILABLE_UPLOADED_REPORTS.length];
      textToAnalyze = selectedUploaded.text.slice(0, 100);
      typeToUse = selectedUploaded.type;
      unitToUse = selectedUploaded.location;
      
      setDescription(textToAnalyze);
      setReportType(typeToUse);
      setLocation(unitToUse);
      setUploadedIndex(prev => prev + 1);
    }

    setValidationError(null);

    await executeInference(textToAnalyze, typeToUse, unitToUse);
  };

  const isUnrelated = isUnrelatedIssue(description);
  const isNonSafety = isUnrelated || analysisResult?.is_unrelated || analysisResult?.risk_score === 0 || analysisResult?.report_name?.includes('Non-Safety') || analysisResult?.report_name?.includes('Enter Correct Issue');

  const allWeakSignals = generateAllWeakSignalsAnalysis(
    totalStoredRecords,
    analysisResult,
    description,
    location
  );

  // Weak signals detected in the CURRENT record (strictly empty if non-safety/unrelated input!)
  const detectedWeakSignals = isNonSafety ? [] : allWeakSignals.filter(s => s.isPresentInCurrent);

  const openWeakSignalsModal = () => {
    const match = detectedWeakSignals[0];
    if (match) {
      setSelectedWeakSignal(match);
      setShowWeakSignalsModal(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-slate-800 animate-in fade-in duration-200 select-none">
      
      {/* Header with Prominent, Big Letters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#EAE6E1]">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-orange-50 border-2 border-orange-200/80 text-[#FF5A36] flex items-center justify-center shadow-sm">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-heading text-slate-900 tracking-tight">
                AI SAFETY INTELLIGENCE ENGINE
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main 50/50 Grid: Form on Left Half, Result on Right Half */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
        
        {/* Left Half: Safety Observation Input Card */}
        <div className="lg:col-span-6 rounded-2xl bg-white border-2 border-[#EAE6E1] p-6 sm:p-7 flex flex-col justify-between shadow-xs space-y-6 text-slate-800">
          <div className="space-y-5">
            
            {/* Card Top Title & Reset/Ready Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5 font-heading tracking-wide">
                <FileText className="w-6 h-6 text-[#FF5A36]" />
                <span>SAFETY OBSERVATION INPUT</span>
              </h3>
              {(description || location !== 'Unit 1' || analysisResult) ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 text-xs sm:text-sm text-[#FF5A36] hover:text-orange-700 font-mono font-black transition-all cursor-pointer bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-xl border border-orange-200"
                  title="Clear inputs and reset inference"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESET INPUT</span>
                </button>
              ) : (
                <span className="text-xs sm:text-sm text-emerald-700 font-mono font-black flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE INPUT READY
                </span>
              )}
            </div>

            {/* Classification Type */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                  CLASSIFICATION TYPE / SIZE
                </label>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">Select Category</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: 'NEAR_MISS', label: 'NEAR MISS' },
                  { key: 'UNSAFE_ACT', label: 'UNSAFE ACT' },
                  { key: 'UNSAFE_CONDITION', label: 'UNSAFE CONDITION' }
                ].map((t) => {
                  const isActive = reportType === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setReportType(t.key)}
                      className={`py-3 px-2 text-center rounded-xl text-xs sm:text-sm font-black tracking-wide uppercase transition-all cursor-pointer border-2 ${
                        isActive 
                          ? 'bg-gradient-to-r from-orange-500 via-[#FF5A36] to-[#FFA133] text-white border-[#FF5A36] shadow-md scale-[1.02]' 
                          : 'bg-[#FAF8F5] text-slate-700 border-stone-200/90 hover:bg-orange-50/50 hover:border-orange-300 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Operating Unit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                  TARGET OPERATING UNIT
                </label>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].map((unitName) => {
                  const isActive = location === unitName;
                  return (
                    <button
                      key={unitName}
                      type="button"
                      onClick={() => {
                        setLocation(unitName);
                        if (validationError) setValidationError('');
                      }}
                      className={`py-3 px-2 text-center rounded-xl text-sm sm:text-base font-mono font-black uppercase transition-all cursor-pointer border-2 ${
                        isActive
                          ? 'bg-[#FF5A36] text-white border-[#FF5A36] shadow-md scale-[1.02]'
                          : 'bg-[#FAF8F5] text-slate-700 border-stone-200/90 hover:bg-stone-100 hover:text-slate-900'
                      }`}
                    >
                      {unitName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Field Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                  DETAILED FIELD DESCRIPTION &amp; BARRIER CONTEXT
                </label>
                <span className={`text-xs sm:text-sm font-mono font-black ${description.length >= 100 ? 'text-[#FF5A36]' : 'text-slate-500'}`}>
                  {description.length} / 100 CHARACTERS
                </span>
              </div>
              <textarea
                rows={5}
                maxLength={100}
                value={description}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 100);
                  setDescription(val);
                  if (validationError) setValidationError('');
                  if (analysisResult) setAnalysisResult(null);
                }}
                className="w-full p-4 rounded-xl bg-[#FAF8F5] border-2 border-stone-200 text-sm sm:text-base font-semibold text-slate-900 leading-relaxed focus:outline-none focus:bg-white focus:border-[#FF5A36] focus:ring-4 focus:ring-[#FF5A36]/10 placeholder:text-slate-400 placeholder:font-normal transition-all"
                placeholder="Describe safety incident (up to 100 characters max)..."
              />
            </div>
          </div>

          {/* Large Action Button with Validation Error Banner */}
          <div className="pt-2 space-y-3">
            {validationError && (
              <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs sm:text-sm font-semibold flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black uppercase tracking-wider text-rose-950 text-xs font-heading">
                    INPUT NOTICE
                  </div>
                  <p className="leading-relaxed">{validationError}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="w-full py-4 sm:py-5 px-6 rounded-xl font-black text-base sm:text-lg tracking-wider uppercase shadow-lg transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-[#FF6B4A] via-[#FF5A36] to-[#FFA133] hover:opacity-95 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="normal-case text-base sm:text-lg">{analysisStep || 'Running AI Safety Analysis...'}</span>
                </div>
              ) : (
                <>
                  <Cpu className="w-6 h-6 text-white" />
                  <span>RUN AI SAFETY ANALYSIS</span>
                  <ArrowRight className="w-6 h-6 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Half: Sequential SIF Report Layout or Photo Default */}
        <div className="lg:col-span-6 flex flex-col">
          {analysisResult ? (
            analysisResult.is_unrelated ? (
              /* Enter Correct Issue Card for Unrelated/Trivial Inputs */
              <div className="h-full rounded-2xl bg-white border-2 border-amber-300 p-5 sm:p-6 flex flex-col justify-between shadow-xs space-y-4 text-slate-800 animate-in fade-in duration-300">
                <div className="space-y-4">
                  {/* Top Status Header */}
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 sm:p-5 shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="w-13 h-13 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                        <AlertCircle className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-base sm:text-xl font-black text-amber-950 font-heading leading-tight">
                            ENTER CORRECT ISSUE
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase bg-amber-200 text-amber-900 border border-amber-300">
                            UNRELATED INPUT
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-amber-900 mt-1.5 leading-relaxed">
                          The entered description <span className="font-mono font-black text-amber-950 px-1.5 py-0.5 bg-amber-100 rounded border border-amber-200">"{description || 'nothing'}"</span> does not contain a recognized industrial safety hazard, equipment condition, or barrier failure.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Guidance on How to Enter a Valid Safety Observation */}
                  <div className="rounded-2xl border-2 border-stone-200 p-4 shadow-xs bg-white space-y-3">
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#FF5A36]" />
                      <span>REQUIRED SAFETY OBSERVATION SPECIFICS:</span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700 font-semibold">
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF5A36] font-black mt-0.5">&bull;</span>
                        <span><strong>Operating Bay or Equipment:</strong> Specify unit or asset (e.g., Gas Pipeline Flange, Electrical 415V Panel, LPG Cylinder).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF5A36] font-black mt-0.5">&bull;</span>
                        <span><strong>Active Energy or Hazard:</strong> State the physical condition (e.g., Flammable gas hissing, cable overheating, missing scaffolding deck, welding sparks).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#FF5A36] font-black mt-0.5">&bull;</span>
                        <span><strong>Barrier Status:</strong> Mention if seals degraded, alarm triggered, or safety permits were omitted.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Quick Sample Selector */}
                  <div className="p-4 rounded-xl bg-orange-50/80 border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                    <div>
                      <div className="font-bold text-orange-950 text-xs uppercase tracking-wide">
                        PREFER TO TEST A VERIFIED PLANT INCIDENT?
                      </div>
                      <p className="text-[11px] text-orange-800 mt-0.5">
                        Quickly populate an authentic field safety report to see SIF precursor intelligence in action.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = AVAILABLE_UPLOADED_REPORTS[uploadedIndex % AVAILABLE_UPLOADED_REPORTS.length];
                        setDescription(sample.text);
                        setReportType(sample.type);
                        setLocation(sample.location);
                        setUploadedIndex(prev => prev + 1);
                        setValidationError('');
                        setAnalysisResult(null);
                      }}
                      className="text-xs font-black uppercase tracking-wider text-white bg-[#FF5A36] hover:bg-orange-600 px-4 py-2.5 rounded-xl shrink-0 cursor-pointer transition-all shadow-xs"
                    >
                      Load Sample Issue
                    </button>
                  </div>
                </div>

                {/* Bottom Notice: Zero Weak Signals & NO Button */}
                <div className="pt-3 border-t border-stone-200">
                  <div className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-500">
                    <Radio className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-semibold">
                      Weak signal surveillance inactive &bull; No precursor patterns correlated with unrelated input.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* AI SIF Analysis Result Report in Sequential Lines */
              <div className="h-full rounded-2xl bg-white border-2 border-[#EAE6E1] p-5 sm:p-6 flex flex-col justify-between shadow-xs space-y-4 text-slate-800 animate-in fade-in duration-300">
                <div className="space-y-4">
                  
                  {/* Section 1: Report Details, Category & SIF Determination */}
                  <div className={`rounded-2xl border-2 p-4 sm:p-5 shadow-xs ${
                    analysisResult.sif_precursor === 'YES' || analysisResult.sif_precursor === 'SIF'
                      ? 'bg-rose-50/60 border-rose-200' 
                      : analysisResult.sif_precursor === 'INSUFFICIENT_INFORMATION'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-emerald-50/60 border-emerald-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        {analysisResult.sif_precursor === 'YES' || analysisResult.sif_precursor === 'SIF' ? (
                          <div className="w-13 h-13 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                            <ShieldAlert className="w-7 h-7" />
                          </div>
                        ) : analysisResult.sif_precursor === 'INSUFFICIENT_INFORMATION' ? (
                          <div className="w-13 h-13 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                            <AlertCircle className="w-7 h-7" />
                          </div>
                        ) : (
                          <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                            <ShieldCheck className="w-7 h-7" />
                          </div>
                        )}
                        <div>
                          {/* Report Name */}
                          <div className="text-base sm:text-lg font-black text-slate-900 font-heading leading-tight">
                            {analysisResult.report_name}
                          </div>

                          {/* Type, SIF status, and Confidence */}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Report Type Badge */}
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase bg-slate-800 text-white shadow-xs">
                              TYPE: {analysisResult.classification.replace('_', ' ')}
                            </span>

                            {/* SIF Determination */}
                            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase shadow-xs ${
                              analysisResult.sif_precursor === 'YES' || analysisResult.sif_precursor === 'SIF'
                                ? 'bg-rose-600 text-white'
                                : analysisResult.sif_precursor === 'INSUFFICIENT_INFORMATION'
                                ? 'bg-amber-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}>
                              {analysisResult.sif_precursor === 'YES' || analysisResult.sif_precursor === 'SIF'
                                ? 'CONFIRMED SIF PRECURSOR'
                                : analysisResult.sif_precursor === 'INSUFFICIENT_INFORMATION'
                                ? 'INSUFFICIENT INFORMATION'
                                : 'NON-SIF'}
                            </span>

                            {/* Dynamic AI Confidence Badge */}
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 shadow-xs">
                              CONFIDENCE: {typeof analysisResult.confidence === 'number' ? `${analysisResult.confidence}%` : (analysisResult.confidence || 'Not Available')}
                            </span>
                          </div>

                          {/* Dynamic AI Explanation */}
                          {analysisResult.explainable_reasoning && (
                            <p className="text-xs font-semibold text-slate-600 mt-2 leading-relaxed">
                              <span className="font-black text-slate-800 uppercase font-mono tracking-wide">AI EXPLANATION:</span> {analysisResult.explainable_reasoning}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Risk Score */}
                      <div className="flex items-center gap-3 shrink-0 bg-white/95 px-4 py-2 rounded-xl border border-stone-200 shadow-xs self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">RISK SCORE</div>
                          <div className={`text-xl sm:text-2xl font-black font-mono ${
                            analysisResult.risk_score >= 80 ? 'text-rose-600' : 'text-emerald-700'
                          }`}>
                            {analysisResult.risk_score} <span className="text-[11px] text-slate-400 font-normal">/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Root Cause Analysis Card */}
                  {analysisResult.root_cause && (
                    <div className="rounded-2xl border-2 border-stone-200 p-4 shadow-xs bg-white">
                      <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider font-mono shadow-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            ROOT CAUSE ANALYSIS
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed pt-0.5">
                          {analysisResult.root_cause}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Detected Hazards & Energy Vectors */}
                  <div className="rounded-2xl border-2 border-stone-200 p-4 shadow-xs bg-white">
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-2.5">
                      <div>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-100/80 border border-orange-300 text-[#FF5A36] text-xs font-black uppercase tracking-wider font-mono shadow-xs">
                          <Flame className="w-4 h-4 text-[#FF5A36]" />
                          DETECTED HAZARDS &amp; ENERGY VECTORS
                        </span>
                      </div>
                      <ul className="space-y-1.5 pt-1">
                        {analysisResult.detected_hazards.map((hz, i) => (
                          <li key={i} className="text-xs sm:text-sm font-bold text-slate-800 flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            <span className="leading-snug">{hz}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Section 3: How to Overcome */}
                  <div className="rounded-2xl border-2 border-stone-200 p-4 shadow-xs bg-white">
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-2.5">
                      <div>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-black uppercase tracking-wider font-mono shadow-xs">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          HOW TO OVERCOME: CRITICAL CONTROLS
                        </span>
                      </div>
                      <ul className="space-y-1.5 pt-1">
                        {analysisResult.recommended_controls.map((ctrl, i) => (
                          <li key={i} className="text-xs sm:text-sm text-slate-800 font-semibold flex items-start gap-2">
                            <span className="text-emerald-600 font-black mt-0.5 text-base">&bull;</span>
                            <span className="leading-snug">{ctrl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>

                {/* Action Buttons: Weak Signals Surveillance Section */}
                <div className="pt-3 border-t border-stone-200">
                  {detectedWeakSignals.length > 0 ? (
                    <button
                      type="button"
                      onClick={openWeakSignalsModal}
                      className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-orange-500 via-[#FF5A36] to-amber-500 hover:opacity-95 text-white shadow-md hover:scale-[1.005]"
                    >
                      <Radio className="w-4 h-4 text-amber-200 animate-pulse" />
                      <span>VIEW WEAK SIGNALS ({detectedWeakSignals.length} DETECTED IN THIS OBSERVATION)</span>
                    </button>
                  ) : (
                    <div className="w-full p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3 text-xs shadow-2xs">
                      <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-emerald-950 text-xs uppercase tracking-wide flex items-center gap-2">
                          <span>NO WEAK SIGNALS DETECTED</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-200 text-emerald-800 font-mono font-bold">
                            ISOLATED EVENT
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          No recurring pattern related to this observation was identified.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Photo Card on the Remaining Half when idle */
            <div className="relative h-full min-h-[480px] lg:min-h-[540px] rounded-2xl overflow-hidden border-2 border-[#EAE6E1] shadow-xs group">
              <img 
                src="/refinery-banner.jpg" 
                alt="Petrochemical Refinery Unit Operations" 
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
          )}
        </div>

      </div>

      {/* ALL WEAK SIGNALS FROM RECORDS MODAL - WEAK SIGNALS FORMAT */}
      {showWeakSignalsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-[#EAE6E1] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#FAF8F5] border-b border-[#EAE6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-50 border border-orange-200/60 text-[#FF5A36]">
                    <Radio className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
                    Weak Signals Surveillance {detectedWeakSignals.length > 0 ? `(${detectedWeakSignals.length} Detected in Observation)` : ''}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Synthesized cross-record patterns and barrier intelligence
                </p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowWeakSignalsModal(false)}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-[#EAE6E1] flex items-center justify-center transition-all cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Weak Signals Cards in Exact Weak Signals Format */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh] bg-[#FAF8F5]">
              {isNonSafety ? (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300/80 text-xs text-slate-700 flex items-start gap-3 shadow-2xs">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                      No Weak Signals Active in Current Record ("{analysisResult?.report_name || 'Non-Safety Observation'}")
                    </div>
                    <p className="text-slate-600 text-[11.5px] mt-0.5 leading-relaxed">
                      This input contains no operational hazard telemetry.
                    </p>
                  </div>
                </div>
              ) : detectedWeakSignals.length > 0 ? (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-950 flex items-start gap-3 shadow-2xs">
                  <div className="p-2 rounded-xl bg-orange-100 text-[#FF5A36] shrink-0">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="font-bold text-orange-950 text-xs uppercase tracking-wide flex items-center gap-2">
                      <span>{detectedWeakSignals.length} Active Weak Signal Pattern{detectedWeakSignals.length > 1 ? 's' : ''} Detected in Current Observation</span>
                    </div>
                    <p className="text-orange-900/90 text-[11.5px] mt-0.5 leading-relaxed">
                      AI identified direct precursor matches in this observation correlating with recurring barrier failure signals.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-3 shadow-2xs">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-emerald-950 text-xs uppercase tracking-wide">
                      Zero Weak Signal Precursors in Current Record (Isolated Event)
                    </div>
                    <p className="text-emerald-800 text-[11.5px] mt-0.5 leading-relaxed">
                      No recurring latent precursor patterns correlated with this observation.
                    </p>
                  </div>
                </div>
              )}

              {(detectedWeakSignals.length > 0 ? detectedWeakSignals : allWeakSignals).map((sig) => (
                <div 
                  key={sig.id}
                  className="rounded-2xl bg-white border border-[#EAE6E1] hover:border-slate-300 p-6 shadow-sm space-y-4 transition-all duration-300 text-slate-800"
                >
                  {/* Category & Identified By Records Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                        {sig.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {sig.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 font-mono shadow-2xs">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Identified by {sig.identifyingRecords?.length || 2} Records</span>
                      </span>
                    </div>
                  </div>

                  {/* Headline & Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {sig.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDossierReport({
                        id: sig.id,
                        report_reference: sig.code,
                        identified_hazard: sig.title,
                        statement: (!isNonSafety && sig.isPresentInCurrent) ? sig.presentRecordObservation : (sig.historicalMatches?.[0]?.excerpt || sig.precursorEscalation),
                        recommended_action: sig.systemicMitigation?.replace(/^[0-9.]+\s*/, '').split('\n')[0] || 'Conduct immediate physical audit and enforce strict barrier controls across active operational units.',
                        energy_source: sig.category,
                        sif_precursor_assessment: 'YES',
                        isSIF: true,
                        risk_level: sig.severity?.includes('Critical') ? 'Critical' : 'High',
                        location: location || 'Operating Unit',
                        report_type: 'Weak Signal Intelligence',
                        report_date: '2026-09-08',
                        identifyingRecords: sig.identifyingRecords
                      })}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 shrink-0 cursor-pointer flex items-center gap-1.5 transition-all self-start sm:self-auto"
                    >
                      <span>Examine Weak Signal Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600">
                Detected Precursors in Observation: <strong className="text-[#FF5A36]">{detectedWeakSignals.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowWeakSignalsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Close Surveillance
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Detailed Analysis Modal when clicking Examine Weak Signal Dossier */}
      {selectedDossierReport && (
        <FullAnalysisModal
          report={selectedDossierReport}
          onClose={() => setSelectedDossierReport(null)}
        />
      )}

    </div>
  );
}
