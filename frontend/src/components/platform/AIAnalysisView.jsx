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
  Info,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Search,
  Building2
} from 'lucide-react';
import { api } from '../../services/api';
import FullAnalysisModal from './FullAnalysisModal';
import IncidentLocationModal from './maps/IncidentLocationModal';
import IncidentPostAnalysisMap from './maps/IncidentPostAnalysisMap';
import AdminNavigationModal from './maps/AdminNavigationModal';
import { useAuth } from '../../context/AuthContext';
import { 
  addReportRecord, 
  addWeakSignalToBoard, 
  getStoredWeakSignals, 
  subscribeSafetyStore,
  getTodayDateString,
  getStoreState,
  extractUnitKey,
  syncBackendReportsToStore
} from '../../services/safetyStore';
import { ALL_CHECKLIST_ITEMS, CLASSIFICATION_CHECKLISTS } from '../../data/safetyChecklistItems';

// Available uploaded safety report data from ingestion registry
const AVAILABLE_UPLOADED_REPORTS = [
  {
    ref: 'OIL-BATCH-01',
    name: 'Main Pipeline High-Pressure Gas Leakage',
    type: 'NEAR_MISS',
    location: 'Unit 1',
    text: 'High-pressure gas pipeline flange developed severe leakage. Gas alarm at 65% LEL near switch.',
    incidentLocation: {
      latitude: 12.9716,
      longitude: 77.5946,
      name: 'Crude Distillation Unit (CDU)',
      address: 'Crude Distillation Unit (Operating Sector, Primary Refining)'
    }
  },
  {
    ref: 'OIL-BATCH-02',
    name: 'Electrical Switchboard Fire and Smoke Outbreak',
    type: 'NEAR_MISS',
    location: 'Unit 2',
    text: 'Electrical fire erupted in distribution board due to overloaded breaker with open flames visible.',
    incidentLocation: {
      latitude: 12.9735,
      longitude: 77.5938,
      name: 'Electrical Substation 02 (415V Panel)',
      address: 'Electrical Substation 02, Utilities Sector'
    }
  },
  {
    ref: 'OIL-BATCH-03',
    name: 'Storage Shed LPG Gas Cylinder Valve Leakage',
    type: 'UNSAFE_CONDITION',
    location: 'Unit 3',
    text: 'Pressurized LPG cylinder valve found leaking flammable propane gas inside storage shed.',
    incidentLocation: {
      latitude: 12.9680,
      longitude: 77.5920,
      name: 'LPG Storage Farm & Cylinder Shed',
      address: 'LPG Storage Farm, Pressurized Vessels Sector'
    }
  },
  {
    ref: 'OIL-BATCH-04',
    name: 'Hot Work Welding Sparks Floor Flash Fire',
    type: 'UNSAFE_ACT',
    location: 'Unit 4',
    text: 'Welding sparks near solvent drum ignited oily rags on the floor causing an immediate flash fire.',
    incidentLocation: {
      latitude: 12.9705,
      longitude: 77.5932,
      name: 'Fabrication Workshop Bay 4',
      address: 'Fabrication Workshop Bay 4, Conversion Area'
    }
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
    const storeState = getStoreState();
    if (storeState?.reports && storeState.reports.length > 0) {
      return storeState.reports;
    }
    const raw = localStorage.getItem('SAFETY_TOTAL_REPORTS_V3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
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
  'excavat', 'trench', 'pit', 'housekeeping', 'clutter', 'obstruction', 'puddle',

  // Operational, Behavioral & Administrative Safety
  'machinery', 'machine', 'equipment', 'operation', 'operating', 'operate',
  'restrict', 'restricted', 'exclusion', 'unauthorized', 'entry', 'entering', 'zone',
  'procedure', 'sop', 'protocol', 'instruction', 'bypass', 'bypassing', 'override',
  'compliance', 'violation', 'non-compliance', 'line of fire', 'struck-by', 'proximity',
  'surface', 'floor', 'walkway', 'slippery', 'wet'
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

function isCodeOrTechnicalDocumentation(text) {
  if (!text || typeof text !== 'string') return false;
  const raw = text.trim();

  // 1. Docstrings and code blocks
  if (raw.includes('"""') || raw.includes("'''") || raw.includes('```')) return true;
  if (/<(?:script|div|span|p|html|body|table|form|button)\b/i.test(raw)) return true;

  // 2. Section underlines (e.g. Module\n-------)
  const underlineMatch = raw.match(/([A-Za-z0-9_\s]{3,})\n\s*([-=~_]{3,})\s*(?:\n|$)/);
  if (underlineMatch) {
    const header = underlineMatch[1].toLowerCase();
    if (/module|class|function|api|service|engine|package|preprocessing|pipeline|architecture|specification|sdk|model|nlp|component|algorithm/i.test(header)) {
      return true;
    }
  }

  // 3. Source code statements
  const codePatterns = [
    /^\s*(?:def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*|import\s+[a-zA-Z_]\w+|from\s+[a-zA-Z_]\w+\s+import|return\s+|raise\s+[a-zA-Z_]\w*Error)/m,
    /^\s*(?:const\s+[a-zA-Z_]\w*\s*=|let\s+[a-zA-Z_]\w*\s*=|var\s+[a-zA-Z_]\w*\s*=|function\s+[a-zA-Z_]\w*\s*\(|export\s+(?:default|const|let|var|function))/m,
    /^\s*(?:public\s+(?:class|static|void|int|String)|private\s+|protected\s+|#include\s+[<"]|std::|System\.out\.println)/m,
    /(?:console\.log\s*\(|print\s*\(["']|logger\.(?:info|debug|error|warning)\s*\()/,
    /['"][^'"]+['"]\s*->\s*['"][^'"]+['"]/,
    /(?:if\s+__name__\s*==\s*['"]__main__['"]|@classmethod|@staticmethod|@pytest\.|@router\.)/
  ];
  if (codePatterns.some(p => p.test(raw))) return true;

  // 4. Documentation headers
  if (/\b(?:Key Features:|Features:|Installation:|Usage Examples?:|API Reference:|Parameters:|Returns:|Arguments:|Kwargs:|Attributes:|Changelog:)\b/i.test(raw)) {
    return true;
  }

  // 5. Tech jargon cluster
  const techTerms = [
    /\btokenizer\b/i, /\btokenization\b/i, /\bpreprocessing module\b/i, /\bnlp preprocessing\b/i,
    /\bpii masking\b/i, /\bmodel training\b/i, /\breproducible model\b/i, /\bdata leakage\b/i,
    /\bhyperparameters?\b/i, /\bloss function\b/i, /\blearning rate\b/i, /\btrain[- ]test split\b/i,
    /\bregex\b/i, /\bregular expression\b/i, /\bapi endpoint\b/i, /\bjson payload\b/i,
    /\bdocstring\b/i, /\bunit tests?\b/i, /\bsource code\b/i, /\bcompound terms\b/i
  ];
  const techCount = techTerms.filter(p => p.test(raw)).length;
  if (techCount >= 2) return true;

  // 6. JSON structured payload
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return true;
    } catch (e) {}
  }

  // 7. SQL statements
  if (/^\s*(?:SELECT\s+.+\s+FROM|INSERT\s+INTO\s+\w+|UPDATE\s+\w+\s+SET|DELETE\s+FROM\s+\w+|CREATE\s+TABLE)\b/i.test(raw)) {
    return true;
  }

  return false;
}

function isUnrelatedIssue(text, checklist = []) {
  if (Array.isArray(checklist) && checklist.length > 0) {
    return false;
  }
  if (!text) return true;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length === 0) return true;
  if (cleaned.length < 4) return true;
  if (UNRELATED_TERMS.includes(cleaned)) return true;
  if (CONVERSATIONAL_PATTERNS.some(p => p.test(cleaned))) return true;
  if (isCodeOrTechnicalDocumentation(text)) return true;

  // NOTE: The backend's classify_safety_observation_validity() is the
  // authoritative safety-relevance gate. The frontend only filters
  // obviously unrelated conversational/trivial input above. All other
  // input is sent to the backend for proper semantic classification.
  return false;
}

function isTrivialInput(text, checklist = []) {
  return isUnrelatedIssue(text, checklist);
}

function deriveReportName(text, type, loc, checklist = []) {
  if (!text && Array.isArray(checklist) && checklist.length > 0) {
    return `${checklist.slice(0, 2).join(' & ')} Observation (${loc})`;
  }
  if (!text) return `Safety Observation (${loc})`;

  if (isUnrelatedIssue(text, checklist)) return 'Enter Correct Issue';
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

function calculateDynamicRiskScore(hazard, energy, exposure, barrierStatus, sifStatus, text, checklist) {
  if (isTrivialInput(text) && (!checklist || checklist.length === 0)) return 0;
  
  const tLow = (text || '').toLowerCase();
  const hLow = (hazard || '').toLowerCase();
  const eLow = (energy || '').toLowerCase();
  const exLow = (exposure || '').toLowerCase();
  const bNorm = (barrierStatus || '').toUpperCase();
  const checkListLower = Array.isArray(checklist) ? checklist.map(c => c.toLowerCase()) : [];
  const combText = `${tLow} ${hLow} ${checkListLower.join(' ')}`;

  // Negative context / Administrative safety checks (drills, toolbox talks, historical reviews)
  if (/toolbox talk|safety meeting|safety stand-down|safety standdown|lessons learned|historical case|past incident review|fire drill|mock drill|evacuation drill|emergency exercise|routine inspection of|monthly inspection of|inspection tags|classroom training|training presentation|demonstrated dry chemical|safety induction|training video|audit of flammable gas detectors|talk about fire prevention|safety talk/.test(combText)) {
    return 10;
  }

  // Controlled thermal operations (burn pit, single spark quenched immediately, minor rag scorch)
  if (/burn pit|controlled fire|fire training ground|flare pilot|pilot burner|extinguished within|extinguished in|extinguished immediately|quenched with|water cup|water bottle|rag scorch|paper trash can fire|put out in sec|put out in seconds|put out immediately|wiped out with co2|caught grease wiped out/.test(combText) && !/spreading|uncontained|shockwave|blast|major explosion|massive explosion/.test(combText)) {
    return 20;
  }

  // Minor contained spills (drip tray, 50ml, wiped with rag)
  if (/50ml|40ml|30ml|100ml|drip tray|drip pan|minor lube oil leak|minor oil leak|minor oil drip|little oil on floor in tray|caught in dedicated|wiped with rag|wiped with absorb|drop of diesel|wept 40ml|2 drops of/.test(combText) && !/explosion|blast|uncontained|fire|toxic cloud|chemical burn|acid spray|hydrofluoric/.test(combText)) {
    return 15;
  }

  // 1. Energy utility (0.0 - 1.0)
  let eU = 0.35;
  if (/high[- ]pressure|pressurized|hydraulic|pneumatic|blowout|psi|bar/.test(combText) || /pressure|pneumatic|hydraulic/.test(eLow)) {
    eU = 0.95;
  } else if (/electrical|arc flash|voltage|11kv|415v|switchgear/.test(combText) || /electrical/.test(eLow)) {
    eU = 0.95;
  } else if (/toxic|atmospheric|confined space|h2s|asphyxiat/.test(combText) || /toxic|atmospheric/.test(eLow)) {
    eU = 0.92;
  } else if (/suspended load|dropped object|fall from height|work at height|crane/.test(combText) || /gravity/.test(eLow)) {
    eU = 0.90;
  } else if (/thermal|fire|flame|explosion|flash fire/.test(combText) || /thermal/.test(eLow)) {
    eU = 0.88;
  } else if (/kinetic|mobile equipment|forklift|vehicle|machinery/.test(combText) || /kinetic/.test(eLow)) {
    eU = 0.70;
  } else if (/chemical|acid|corrosive/.test(combText) || eLow.includes('chemical')) {
    eU = 0.65;
  } else if (/slip|trip|housekeeping|puddle/.test(combText)) {
    eU = 0.10;
  }

  // 2. Exposure utility (0.0 - 1.0)
  let exU = 0.40;
  if (/not exposed|zero exposure|no personnel/.test(combText) || /not exposed/.test(exLow)) {
    exU = 0.0;
  } else if (/line[- ]of[- ]fire|under load|under suspended load|drop zone/.test(combText) || /line-of-fire/.test(exLow)) {
    exU = 0.95;
  } else if (/confined space|inside vessel|tank entry/.test(combText) || /confined space/.test(exLow)) {
    exU = 0.92;
  } else if (/touching live|live panel|direct physical/.test(combText)) {
    exU = 0.90;
  } else if (/slip|trip|walking|door/.test(combText)) {
    exU = 0.20;
  }

  // 3. Barrier effectiveness (0.0 - 1.0)
  let bEff = 0.45;
  if (/FULLY EFFECTIVE|INTACT|FUNCTIONING|PRESENT/.test(bNorm)) {
    bEff = 0.90;
  } else if (/FAILED|RUPTURE|BYPASSED|OVERRIDDEN/.test(bNorm)) {
    bEff = 0.00;
  } else if (/MISSING|NOT DEPLOYED/.test(bNorm) || /loto not followed|not locked out/.test(combText)) {
    bEff = 0.05;
  } else if (/COMPROMISED|DEGRADED/.test(bNorm)) {
    bEff = 0.40;
  }
  const bFail = Math.max(0, 1.0 - bEff);

  // 4. Hazard modifier (0.60 - 1.25)
  let hMod = 1.0;
  if (/loto|lockout|isolation|confined space/.test(combText)) {
    hMod = 1.15;
  } else if (/line[- ]of[- ]fire|high[- ]pressure|suspended load|electrical/.test(combText)) {
    hMod = 1.12;
  } else if (/fall|height|scaffold/.test(combText)) {
    hMod = 1.10;
  } else if (/slip|trip|housekeeping/.test(combText)) {
    hMod = 0.70;
  }

  // Gated likelihood
  const sifLikelihood = eU * exU * bFail;
  const modifiedLikelihood = Math.min(1.0, sifLikelihood * hMod);

  // Piecewise linear interpolation
  const anchors = [
    [0.00, 5.0],
    [0.04, 15.0],
    [0.12, 25.0],
    [0.25, 40.0],
    [0.45, 60.0],
    [0.65, 78.0],
    [0.80, 88.0],
    [1.00, 96.0]
  ];
  let continuousScore = 5.0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (modifiedLikelihood <= x1) {
      continuousScore = y0 + ((y1 - y0) / (x1 - x0)) * (modifiedLikelihood - x0);
      break;
    }
    if (i === anchors.length - 2) {
      continuousScore = y1;
    }
  }

  if (exU <= 0.01 || bFail <= 0.01) {
    continuousScore = Math.min(continuousScore, 10.0);
  }

  // Safety-critical floor overrides
  let overrideFloor = 0;
  if (/explosion|explotion|explod|explodid|exploding|exploded|blast|blasted|bleve|vce|detonation|fireball|shockwave/.test(combText) || /tube ruptured violently|furnace roof blown|boiler burst/.test(combText)) {
    overrideFloor = 94;
  } else if (/rapidly spreading|spreading fire|spreading to pipe|spreading across|growing fast|uncontrolled hydrocarbon fire|uncontained fire|jet fire|fire expanding|flames spreading|flames leaped/.test(combText) || (/fire|flames/.test(combText) && /cdu heater|pipe racks|piperack|tank farm|tank 304|bund fire/.test(combText))) {
    overrideFloor = 92;
  } else if (/h2s alarm triggered|85 ppm|100 ppm|320 ppm|hydrofluoric acid|50 liters of 70%|5000-liter hot caustic|acid sprayed directly onto/.test(combText)) {
    overrideFloor = 90;
  } else if (/loto|lockout|not locked out/.test(combText) && (eU >= 0.85 || /electrical|pressure/.test(combText)) && (exU >= 0.70 || /line of fire/.test(combText))) {
    overrideFloor = 88;
  } else if (/confined space|tank entry/.test(combText) && (/gas test|loto|bypassed/.test(combText) || bEff <= 0.40)) {
    overrideFloor = 86;
  } else if (/electrical|arc flash|11kv|415v/.test(combText) && (exU >= 0.70 || /touching|live/.test(combText)) && bEff <= 0.40) {
    overrideFloor = 86;
  } else if (/suspended load|crane lift/.test(combText) && /under load|drop zone|line of fire/.test(combText)) {
    overrideFloor = 84;
  } else if (/high[- ]pressure|hydraulic/.test(combText) && (exU >= 0.70 || /line of fire/.test(combText)) && bEff <= 0.40) {
    overrideFloor = 82;
  } else if (/work at height|fall from height/.test(combText) && /no harness|missing guardrail/.test(combText)) {
    overrideFloor = 84;
  }

  return Math.max(0, Math.min(100, Math.round(Math.max(continuousScore, overrideFloor))));
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

export function detectCategoryFromExplanation(text) {
  if (!text || !text.trim()) return null;
  const tLow = text.toLowerCase().trim();

  // 1. Near Miss Patterns (Unplanned close call, dropped item, energy release where injury narrowly avoided)
  const nearMissRegexes = [
    /\b(near\s*miss|almost\s*hit|nearly\s*struck|narrowly\s*missed|close\s*call|near\s*collision)\b/,
    /\b(dropped\s*object|fell\s*from\s*height|fell\s*and\s*missed|falling\s*tool|dropped\s*from)\b/,
    /\b(snapped|ruptured|burst|whipped|cable\s*broke|hose\s*whipped|wire\s*snapped)\b/,
    /\b(slipped\s*and\s*regained|caught\s*balance|stumbled\s*but|almost\s*fell)\b/,
    /\b(swerved|braked\s*suddenly|near\s*miss\s*with\s*vehicle)\b/,
    /\b(arc\s*flash\s*occurred|spark\s*burst|blast\s*occurred|explosion\s*occurred|fire\s*flash)\b/
  ];

  // 2. Unsafe Act Patterns (Worker action, behavior, rule violation, PPE omission)
  const unsafeActRegexes = [
    /\b(not\s*wearing|without\s*(wearing|ppe|harness|helmet|glasses|gloves)|failed\s*to\s*wear|improper\s*ppe|removed\s*ppe|missing\s*(?:safety\s*)?gear|no\s*safety\s*gear)\b/,
    /\b(procedure\s*not\s*followed|ptw\s*violation|permit\s*violation|without\s*permit|unauthorized\s*operation|no\s*ptw)\b/,
    /\b(bypassed|bypassing|interlock\s*disabled|tampered\s*with|overrode|defeated\s*safety)\b/,
    /\b(speeding|excessive\s*speed|driving\s*recklessly|cell\s*phone|phone\s*distraction|mobile\s*use)\b/,
    /\b(standing\s*under|walked\s*under\s*suspended|under\s*the\s*crane|under\s*load|line\s*of\s*fire)\b/,
    /\b(loto\s*not\s*followed|failed\s*to\s*isolate|did\s*not\s*de-energize|worked\s*on\s*live)\b/,
    /\b(removed\s*(machine\s*)?guard|wrong\s*tool|improvised\s*tool|unauthorized\s*access)\b/,
    /\b(smoking\s*in|horseplay|rushing|ignored\s*warning|ignored\s*alarm)\b/
  ];

  // 3. Unsafe Condition Patterns (Physical, mechanical, environmental workplace hazards)
  const unsafeConditionRegexes = [
    /\b(slippery\s*(surface|floor|ground|walkway)|oil\s*puddle|spill\s*on\s*floor|wet\s*floor|water\s*leak|puddle)\b/,
    /\b(uneven\s*(ground|surface|grating|floor)|pothole|damaged\s*grating|hole\s*in\s*floor|trip\s*hazard)\b/,
    /\b(damaged|broken|corroded|cracked|defective|leaking|faulty|malfunction)\s*(equipment|pump|pipe|valve|cable|wire|machine|flange|ladder|scaffold)\b/,
    /\b(missing\s*(guard|handrail|cover|barrier|grating|barricade|sign|signage))\b/,
    /\b(exposed\s*(wiring|wire|cable|conductor|voltage|busbar|live\s*part))\b/,
    /\b(blocked\s*(exit|door|egress|aisle|fire\s*door|extinguisher))\b/,
    /\b(poor\s*lighting|dark\s*(area|stairwell|hallway)|inadequate\s*illumination|dim\s*lighting)\b/,
    /\b(gas\s*leak|chemical\s*spill|corrosion|rust|high\s*pressure\s*hazard|high\s*temp|overheating)\b/,
    /\b(poor\s*housekeeping|clutter|debris\s*on\s*walkway|loose\s*tools)\b/
  ];

  const hasNM = nearMissRegexes.some(rx => rx.test(tLow));
  const hasAct = unsafeActRegexes.some(rx => rx.test(tLow));
  const hasCond = unsafeConditionRegexes.some(rx => rx.test(tLow));

  if (hasNM && !hasAct) {
    return {
      category: 'NEAR_MISS',
      label: 'NEAR MISS',
      rationale: 'Unplanned close-call event / potential incident narrowly avoided'
    };
  }
  if (hasAct) {
    return {
      category: 'UNSAFE_ACT',
      label: 'UNSAFE ACT',
      rationale: 'Worker behavior, procedural deviation, or PPE omission'
    };
  }
  if (hasCond) {
    return {
      category: 'UNSAFE_CONDITION',
      label: 'UNSAFE CONDITION',
      rationale: 'Hazardous physical condition, environmental defect, or damaged equipment'
    };
  }

  if (/\b(worker|operator|technician|employee|he|she|they)\b/.test(tLow) && /\b(did|was|not|walked|operated|rushed)\b/.test(tLow)) {
    return {
      category: 'UNSAFE_ACT',
      label: 'UNSAFE ACT',
      rationale: 'Worker action / operational activity context'
    };
  }

  return {
    category: 'UNSAFE_CONDITION',
    label: 'UNSAFE CONDITION',
    rationale: 'Physical workplace condition / environmental observation'
  };
}

export function detectCategoryFromChecklist(selectedLabels) {
  if (!Array.isArray(selectedLabels) || selectedLabels.length === 0) return null;
  const counts = { NEAR_MISS: 0, UNSAFE_ACT: 0, UNSAFE_CONDITION: 0 };
  selectedLabels.forEach(label => {
    const found = ALL_CHECKLIST_ITEMS.find(it => it.label === label);
    if (found) {
      counts[found.category] = (counts[found.category] || 0) + 1;
    }
  });

  let dominantCat = 'NEAR_MISS';
  let maxCount = -1;
  ['UNSAFE_ACT', 'UNSAFE_CONDITION', 'NEAR_MISS'].forEach(cat => {
    if (counts[cat] > maxCount) {
      maxCount = counts[cat];
      dominantCat = cat;
    }
  });

  const catLabels = {
    NEAR_MISS: 'NEAR MISS',
    UNSAFE_ACT: 'UNSAFE ACT',
    UNSAFE_CONDITION: 'UNSAFE CONDITION'
  };

  return {
    category: dominantCat,
    label: catLabels[dominantCat],
    counts
  };
}

export default function AIAnalysisView() {
  const { user } = useAuth();
  const isAdmin = Boolean(
    user?.is_admin || 
    user?.role === 'ADMINISTRATOR' || 
    user?.role_name === 'Administrator' || 
    (user?.email && user.email.toLowerCase().includes('admin'))
  );

  const [reportType, setReportType] = useState('NEAR_MISS');
  const [inputMode, setInputMode] = useState('DESCRIPTION'); // 'DESCRIPTION' | 'CHECKLIST' (mutually exclusive)
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState('ALL');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Unit 1');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [uploadedIndex, setUploadedIndex] = useState(0);

  // Interactive controls state: Checklist & Search
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState([]);

  // Auto-saved confirmation state
  const [autoSavedInfo, setAutoSavedInfo] = useState(null);

  // Weak Signals Modal State
  const [showWeakSignalsModal, setShowWeakSignalsModal] = useState(false);
  const [selectedWeakSignal, setSelectedWeakSignal] = useState(null);
  const [selectedDossierReport, setSelectedDossierReport] = useState(null);
  const [expandedHistoricalRecord, setExpandedHistoricalRecord] = useState(null);
  const [totalStoredRecords, setTotalStoredRecords] = useState(getStoredTotalRecords);

  // Separated Location States (Requirement 10 & 12)
  const [selectedIncidentLocation, setSelectedIncidentLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [adminLocation, setAdminLocation] = useState(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAdminNavModal, setShowAdminNavModal] = useState(false);

  // Handle Open Map Click with Browser Geolocation Permission (Requirement 2)
  const handleOpenMapClick = () => {
    setValidationError('');

    if (!navigator.geolocation) {
      setShowMapModal(true);
      return;
    }

    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequestingLocation(false);
        const uLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        // CRITICAL: User's location is ONLY context, NOT saved as incident location
        setUserLocation(uLoc);
        setShowMapModal(true);
      },
      (error) => {
        setIsRequestingLocation(false);
        // On permission denied / timeout / unavailable, still open map for manual selection
        setShowMapModal(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    // 1. Fetch persisted backend reports on mount so historical weak signals and total records are based on real DB data
    const syncBackendReports = async () => {
      try {
        const backendReports = await api.getReports();
        if (Array.isArray(backendReports) && backendReports.length > 0) {
          syncBackendReportsToStore(backendReports, [], false);
          setTotalStoredRecords(getStoredTotalRecords());
        }
      } catch (err) {
        console.warn('Backend reports sync on AIAnalysisView mount deferred:', err.message);
      }
    };
    syncBackendReports();

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

  const executeInference = async (textToAnalyze, typeToUse, unitToUse, checklistToUse) => {
    const text = (textToAnalyze !== undefined ? textToAnalyze : description).trim();
    const loc = unitToUse || location;
    const currentChecklist = checklistToUse !== undefined ? checklistToUse : selectedChecklist;
    const submittedObservation = [
      text,
      ...(currentChecklist || []).map((factor) => `- ${factor}`)
    ].filter(Boolean).join('\n');

    // REQUIRE incident location selection before running analysis (Requirement 15)
    if (!selectedIncidentLocation) {
      setValidationError('Please select an Incident Location using "Open Map" before running analysis.');
      setAnalysisResult(null);
      setIsAnalyzing(false);
      return;
    }

    // RULE: both checklist and description is not allowed!
    if (text && currentChecklist && currentChecklist.length > 0) {
      setValidationError('Simultaneous submission not allowed: Please provide EITHER a field description OR select checklist factors, but not both.');
      setAnalysisResult(null);
      setIsAnalyzing(false);
      return;
    }
    // Only reject when BOTH are empty.
    if (!text && (!currentChecklist || currentChecklist.length === 0)) {
      setValidationError('Please enter a safety observation or select at least one checklist factor.');
      setAnalysisResult(null);
      setIsAnalyzing(false);
      return;
    }

    // Reject when input exceeds 999,999 characters
    if (text && text.length > 999999) {
      setValidationError('Field explanation exceeds maximum limit of 999,999 characters.');
      setAnalysisResult(null);
      setIsAnalyzing(false);
      return;
    }

    // Respect manual category selection when text description is entered (do not assume!)
    let determinedCategory = typeToUse || reportType;
    if (!text && currentChecklist && currentChecklist.length > 0) {
      const autoCat = detectCategoryFromChecklist(currentChecklist);
      if (autoCat) determinedCategory = autoCat.category;
    }
    const rType = determinedCategory;

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

    const isUnrelated = isUnrelatedIssue(text, currentChecklist);
    const reportName = deriveReportName(text, rType, loc, currentChecklist);

    // UNRELATED / TRIVIAL INPUT INTERCEPT: Prompt user to enter a correct safety issue
    if (isUnrelated) {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisStep('');
        const isCodeInput = isCodeOrTechnicalDocumentation(text);
        const reasonMsg = isCodeInput
          ? 'Input appears to be software code, technical documentation, or programming syntax rather than an operational workplace safety observation. Please describe a safety hazard, unsafe condition, unsafe act, or near-miss observation.'
          : 'Enter Correct Issue: Please describe an active operational safety observation, equipment condition, or hazard.';
        setValidationError(reasonMsg);

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
          explainable_reasoning: reasonMsg,
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

    // Execute canonical backend AI analysis
    try {
      const backendResult = await api.executeAiAnalysis({
        report_text: text,
        description: text,
        report_name: reportName,
        report_type: rType === 'NEAR_MISS' ? 'Near Miss' : rType === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition',
        classification: rType === 'NEAR_MISS' ? 'Near Miss' : rType === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition',
        location: loc,
        operating_unit: loc,
        site: loc === 'Unit 1' ? 'Plant 01' : loc === 'Unit 2' ? 'Plant 02' : loc === 'Unit 3' ? 'Plant 03' : 'Plant 04',
        report_date: reportDate,
        incident_latitude: selectedIncidentLocation?.latitude,
        incident_longitude: selectedIncidentLocation?.longitude,
        incident_address: selectedIncidentLocation?.address,
        incident_location_name: selectedIncidentLocation?.name,
        checklist: currentChecklist,
        selected_checklist: currentChecklist,
        ...(currentChecklist.length > 0 ? { additional_context: `Safety Factors: ${currentChecklist.join(', ')}` } : {})
      });

      if (backendResult) {
        setTimeout(() => {
          setIsAnalyzing(false);
          setAnalysisStep('');

          if (backendResult.is_unrelated) {
            const reasonMsg = backendResult.explainable_reasoning || backendResult.explanation || backendResult.message || 'Enter Correct Issue: Please describe an active operational safety observation, equipment condition, or hazard.';
            setValidationError(reasonMsg);
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
              explainable_reasoning: reasonMsg,
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
            : typeof backendResult.risk_score === 'number'
            ? backendResult.risk_score
            : calculateDynamicRiskScore(backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, sifVal, text, currentChecklist);
          const confidence = backendResult.confidence !== undefined ? backendResult.confidence : getDynamicConfidence(backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, text);

          const rawHazards = Array.isArray(backendResult.detected_hazards) && backendResult.detected_hazards.length > 0
            ? backendResult.detected_hazards
            : [
                `Hazard: ${backendResult.hazard || 'Insufficient Information'}`,
                `Energy Vector: ${backendResult.energy_vector || 'Insufficient Information'}`,
                `Worker Exposure: ${backendResult.worker_exposure || 'Insufficient Information'}`,
                `Barrier Status: ${backendResult.barrier_status || 'Insufficient Information'}`
              ];

          const hazards = [...rawHazards];
          if (currentChecklist && currentChecklist.length > 0) {
            currentChecklist.forEach(factor => {
              const fWords = factor.toLowerCase().split(/\s+/).filter(w => !['not', 'followed', 'hazard', 'issue'].includes(w));
              const alreadyCovered = hazards.some(h => {
                const hl = h.toLowerCase();
                return hl.includes(factor.toLowerCase()) || (fWords.length > 0 && fWords.some(w => hl.includes(w)));
              });
              if (!alreadyCovered) {
                hazards.push(`Safety Factor: ${factor}`);
              }
            });
          }

          const recControls = Array.isArray(backendResult.recommended_controls) && backendResult.recommended_controls.length > 0
            ? backendResult.recommended_controls
            : getDynamicRecommendations(backendResult.hazard, text);

          const capaActions = Array.isArray(backendResult.corrective_actions) && backendResult.corrective_actions.length > 0
            ? backendResult.corrective_actions
            : [
                'Log observation in facility safety maintenance tracking register',
                'Verify area condition during routine safety inspections'
              ];

          const reasoning = backendResult.explanation || backendResult.explainable_reasoning || backendResult.why_identified?.summary || getDynamicExplanation(sifVal, backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, text);

          const finalResult = {
            report_name: backendResult.report_name || reportName,
            report_reference: backendResult.report_reference,
            description: backendResult.description || submittedObservation,
            is_duplicate: Boolean(backendResult.is_duplicate),
            sif_precursor: sifVal,
            confidence: confidence,
            risk_score: dynamicRiskScore,
            classification: rType,
            hazard: backendResult.hazard,
            detected_hazards: hazards,
            energy_source: backendResult.energy_vector || (isSIF ? 'High Potential Energy Vector' : 'Gravity / Kinetic'),
            barrier_status: backendResult.barrier_status || 'Insufficient Information',
            iogp_rule: backendResult.life_saving_rule || backendResult.iogp_rule || (isSIF ? 'Line of Fire (LSR-03)' : 'Workplace Housekeeping Standards'),
            explainable_reasoning: reasoning,
            recommended_controls: recControls,
            corrective_actions: capaActions,
            weak_signals: backendResult.weak_signals || [],
            weak_signal_detected: Boolean(backendResult.weak_signal_detected),
            weak_signal_id: backendResult.weak_signal_id,
            weak_signal_title: backendResult.weak_signal_title,
            weak_signal_reason: backendResult.weak_signal_reason,
            related_reports: backendResult.related_reports || [],
            escalation_path: backendResult.escalation_path,
            incident_latitude: backendResult.incident_latitude ?? selectedIncidentLocation?.latitude,
            incident_longitude: backendResult.incident_longitude ?? selectedIncidentLocation?.longitude,
            incident_address: backendResult.incident_address || selectedIncidentLocation?.address,
            incident_location_name: backendResult.incident_location_name || selectedIncidentLocation?.name,
            incidentLocation: selectedIncidentLocation
          };

          setAnalysisResult(finalResult);

          // AUTOMATICALLY PERSIST & SYNC INTO CENTRAL SAFETY STORE & TOTAL RECORDS
          const reportRecordToSync = {
            id: backendResult.report_id || Date.now(),
            report_reference: backendResult.report_reference,
            report_name: finalResult.report_name,
            report_type: rType === 'NEAR_MISS' ? 'Near Miss' : rType === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition',
            description: backendResult.description || submittedObservation,
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
            recommended_action: recControls[0] || 'Implement critical barrier control.',
            ai_classification: rType === 'NEAR_MISS' ? 'Near Miss' : rType === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition',
            ai_sif_score: dynamicRiskScore,
            ai_confidence: confidence,
            human_classification: null,
            human_sif_score: null,
            reviewer_feedback: null,
            review_status: 'Pending Review',
            created_at: backendResult.created_at || new Date().toISOString(),
            safety_factors: currentChecklist,
            incident_latitude: finalResult.incident_latitude,
            incident_longitude: finalResult.incident_longitude,
            incident_address: finalResult.incident_address,
            incident_location_name: finalResult.incident_location_name
          };

          syncBackendReportsToStore([reportRecordToSync], [], false);
          autoPersistToTotalRecords(reportRecordToSync);
          setAutoSavedInfo({ reference: backendResult.report_reference, totalCount: getStoredTotalRecords().length });
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
                  report_id: reportRecordToSync.report_reference || `REC-${reportRecordToSync.id}`,
                  report_type: reportRecordToSync.report_type,
                  date_submitted: reportRecordToSync.report_date,
                  short_description: reportRecordToSync.description,
                  unit: reportRecordToSync.location,
                  excerpt: backendResult.description || submittedObservation
                }]
              });
            });
          }

        }, 850);
        return;
      }
    } catch (err) {
      // Direct backend failure - clear mock fallback, display explicit validation/server error
      setIsAnalyzing(false);
      setAnalysisStep('');
      setValidationError(err.message || 'AI analysis request failed. Please check backend connection.');
      setAnalysisResult(null);
      return;
    }
  };

  const handleReset = () => {
    setDescription('');
    setLocation('Unit 1');
    setInputMode('DESCRIPTION');
    setChecklistCategoryFilter('ALL');
    setSelectedIncidentLocation(null);
    setAnalysisResult(null);
    setAnalysisStep('');
    setAutoSavedInfo(null);
    setValidationError('');
    setShowChecklist(false);
    setChecklistSearch('');
    setSelectedChecklist([]);
  };

  const toggleChecklistItem = (itemLabel) => {
    setSelectedChecklist((prev) => {
      const nextList = prev.includes(itemLabel)
        ? prev.filter((label) => label !== itemLabel)
        : [...prev, itemLabel];

      const autoCat = detectCategoryFromChecklist(nextList);
      if (autoCat) {
        setReportType(autoCat.category);
      }
      return nextList;
    });
    if (validationError) setValidationError('');
    if (analysisResult) setAnalysisResult(null);
  };

  const itemsToFilter = checklistCategoryFilter === 'ALL'
    ? ALL_CHECKLIST_ITEMS
    : ALL_CHECKLIST_ITEMS.filter((it) => it.category === checklistCategoryFilter);

  const searchLower = checklistSearch.trim().toLowerCase();

  const filteredChecklistOptions = itemsToFilter.filter((item) => {
    if (!searchLower) return true;
    return item.label.toLowerCase().includes(searchLower) || (item.keywords && item.keywords.some((kw) => kw.includes(searchLower)));
  });

  const handleRunAnalysis = async () => {
    const trimmedDescription = description.trim();

    // Check Incident Location requirement (Requirement 15)
    if (!selectedIncidentLocation) {
      setValidationError('Please select an Incident Location using "Open Map" before running analysis.');
      setAnalysisResult(null);
      return;
    }

    // RULE: both checklist and description is not allowed!
    if (trimmedDescription && selectedChecklist && selectedChecklist.length > 0) {
      setValidationError('Simultaneous submission not allowed: Please provide EITHER a field description OR select checklist factors, but not both.');
      setAnalysisResult(null);
      return;
    }
    if (!trimmedDescription && (!selectedChecklist || selectedChecklist.length === 0)) {
      setValidationError('Please enter a safety observation or select at least one checklist factor.');
      setAnalysisResult(null);
      return;
    }

    if (trimmedDescription && trimmedDescription.length > 999999) {
      setValidationError('Field explanation exceeds maximum limit of 999,999 characters.');
      setAnalysisResult(null);
      return;
    }

    setValidationError('');

    let typeToUse = reportType;
    if (!trimmedDescription && selectedChecklist.length > 0) {
      const autoCat = detectCategoryFromChecklist(selectedChecklist);
      if (autoCat) typeToUse = autoCat.category;
    }

    await executeInference(trimmedDescription, typeToUse, location, selectedChecklist);
  };

  const isUnrelated = isUnrelatedIssue(description, selectedChecklist);
  const isNonSafety = isUnrelated || analysisResult?.is_unrelated || analysisResult?.risk_score === 0 || analysisResult?.report_name?.includes('Non-Safety') || analysisResult?.report_name?.includes('Enter Correct Issue');

  // Dynamic Weak Signals from Backend DB (enforces >= 2 observations, strictly 0 for isolated/first event)
  const backendWeakSignals = (analysisResult?.weak_signals || []).map(ws => {
    const rawReports = (Array.isArray(ws.source_reports) && ws.source_reports.length > 0)
      ? ws.source_reports
      : (Array.isArray(ws.related_reports) ? ws.related_reports : []);

    const identifyingRecords = rawReports.length > 0
      ? rawReports.map((r, idx) => ({
          ref: r.report_id || r.report_reference || `REC-${r.id || idx+1}`,
          name: r.short_description || r.report_name || r.identified_hazard || 'Operational Safety Report',
          unit: r.unit || r.location || ws.unit || 'Operating Unit',
          date: r.date_submitted || r.report_date || '2026-09-08',
          role: idx === 0 ? 'Active Trigger Record' : 'Historical Correlated Record',
          excerpt: r.excerpt || r.description || r.short_description || ''
        }))
      : [
          {
            ref: analysisResult?.report_reference || 'Current Record',
            name: analysisResult?.report_name || 'Active Safety Report',
            unit: location || 'Operating Unit',
            date: new Date().toISOString().split('T')[0],
            role: 'Active Trigger Record',
            excerpt: analysisResult?.description || description || selectedChecklist.map((factor) => `- ${factor}`).join('\n')
          }
        ];

    return {
      id: ws.id || ws.signal_id,
      code: ws.signal_id || 'WS-001',
      category: ws.category || ws.detected_hazard || 'Process Safety Management',
      title: ws.title,
      severity: ws.risk_level || (ws.risk_score >= 80 ? 'Critical Risk' : 'High Risk'),
      isPresentInCurrent: true,
      identifyingRecords,
      presentRecordObservation: analysisResult?.description || description || selectedChecklist.map((factor) => `- ${factor}`).join('\n'),
      precursorEscalation: ws.escalation_path || `Potential escalation path: ${ws.detected_hazard || 'uncontrolled release'} leading to increased severity.`,
      systemicMitigation: ws.recommended_action || (ws.barrier_issue ? `1. Restore and verify critical barrier: ${ws.barrier_issue}.\n2. Conduct targeted inspection of ${ws.unit || 'affected area'}.\n3. Issue safety alert for recurring pattern.` : '1. Conduct targeted area walkdown.\n2. Verify operational controls.\n3. Track barrier degradation.'),
      why_identified: ws.reason || ws.detection_reason || `Recurring pattern identified based on ${ws.recurrence_count || identifyingRecords.length} related observations.`
    };
  });

  const detectedWeakSignals = isNonSafety ? [] : (analysisResult?.weak_signals !== undefined ? backendWeakSignals : []);
  const allWeakSignals = detectedWeakSignals;

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
              {(description || location !== 'Unit 1' || selectedChecklist.length > 0 || analysisResult) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 text-xs sm:text-sm text-[#FF5A36] hover:text-orange-700 font-mono font-black transition-all cursor-pointer bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-xl border border-orange-200"
                  title="Clear inputs and reset inference"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESET INPUT</span>
                </button>
              )}
            </div>

            {/* Classification Type */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                  CLASSIFICATION TYPE / SIZE
                </label>
                {inputMode === 'CHECKLIST' && selectedChecklist.length > 0 && detectCategoryFromChecklist(selectedChecklist) ? (
                  <span className="text-[11px] font-mono font-bold text-[#FF5A36] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-3 h-3 text-[#FF5A36]" />
                    Checklist Factor Category: <strong>{detectCategoryFromChecklist(selectedChecklist).label}</strong>
                  </span>
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">Select Category Manually</span>
                )}
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

            {/* Mutually Exclusive Mode Switcher */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                  INPUT METHOD <span className="text-[11px] font-normal text-slate-400 normal-case">(Select ONE — dual input not allowed)</span>
                </label>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {inputMode === 'DESCRIPTION' ? '✍️ Mode: Text Explanation' : '📋 Mode: Safety Checklists'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('DESCRIPTION');
                    setSelectedChecklist([]);
                    if (validationError) setValidationError('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-mono tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    inputMode === 'DESCRIPTION'
                      ? 'bg-white text-slate-900 border-stone-300 shadow-sm'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[#FF5A36]" />
                  <span>1. Detailed Explanation</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('CHECKLIST');
                    setDescription('');
                    setShowChecklist(true);
                    if (validationError) setValidationError('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-mono tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    inputMode === 'CHECKLIST'
                      ? 'bg-white text-slate-900 border-stone-300 shadow-sm'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  <CheckSquare className="w-4 h-4 text-[#FF5A36]" />
                  <span>2. Safety Checklists</span>
                  {selectedChecklist.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FF5A36] text-white">
                      {selectedChecklist.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Mode 1: Free-Text Detailed Explanation */}
            {inputMode === 'DESCRIPTION' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                    DETAILED FIELD EXPLANATION
                  </label>
                  <span className={`text-xs sm:text-sm font-mono font-black ${description.length >= 999999 ? 'text-[#FF5A36]' : 'text-slate-500'}`}>
                    {description.length} / 999999 CHARACTERS
                  </span>
                </div>
                <textarea
                  rows={5}
                  maxLength={999999}
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 999999);
                    setDescription(val);
                    if (validationError) setValidationError('');
                    if (analysisResult) setAnalysisResult(null);
                  }}
                  className="w-full p-4 rounded-xl bg-[#FAF8F5] border-2 border-stone-200 text-sm sm:text-base font-semibold text-slate-900 leading-relaxed focus:outline-none focus:bg-white focus:border-[#FF5A36] focus:ring-4 focus:ring-[#FF5A36]/10 placeholder:text-slate-400 placeholder:font-normal transition-all"
                  placeholder="Describe safety incident in detail..."
                />
                <p className="text-[11px] font-mono text-slate-400 italic">
                  * Note: Classification (Near Miss, Unsafe Act, or Unsafe Condition) is selected manually above. Checklists are locked in Explanation Mode.
                </p>
              </div>
            )}

            {/* Mode 2: Structured Safety Checklists */}
            {inputMode === 'CHECKLIST' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Description Locked Notice */}
                <div className="p-3.5 rounded-xl bg-stone-100/90 border border-dashed border-stone-300 text-xs font-mono text-slate-600 flex items-center justify-between">
                  <span>✍️ Field description is disabled in Checklist Mode ({selectedChecklist.length} selected).</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('DESCRIPTION');
                      setSelectedChecklist([]);
                    }}
                    className="text-[#FF5A36] hover:text-orange-700 font-bold underline cursor-pointer"
                  >
                    Switch to Explanation Mode
                  </button>
                </div>

                {/* Structured Checklists Panel */}
                <div 
                  id="safety-factors-checklist-panel"
                  className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border-2 border-stone-200 text-slate-800 space-y-3.5 shadow-xs"
                >
                  {/* Panel Top: Title & Classification indicator */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 font-heading">
                        Select Safety Issues (15 Options)
                      </span>
                      {selectedChecklist.length > 0 && detectCategoryFromChecklist(selectedChecklist) && (
                        <span className="text-[10px] font-mono font-bold text-[#FF5A36] uppercase px-2 py-0.5 bg-orange-100/80 rounded-md border border-orange-200">
                          Identified: {detectCategoryFromChecklist(selectedChecklist).label}
                        </span>
                      )}
                    </div>
                    {selectedChecklist.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedChecklist([])}
                        className="text-[11px] font-mono font-bold text-[#FF5A36] hover:text-orange-700 underline cursor-pointer"
                      >
                        Clear All ({selectedChecklist.length})
                      </button>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {[
                      { id: 'ALL', label: 'All Issues', count: ALL_CHECKLIST_ITEMS.length },
                      { id: 'NEAR_MISS', label: 'Near Miss', count: CLASSIFICATION_CHECKLISTS.NEAR_MISS.length },
                      { id: 'UNSAFE_ACT', label: 'Unsafe Act', count: CLASSIFICATION_CHECKLISTS.UNSAFE_ACT.length },
                      { id: 'UNSAFE_CONDITION', label: 'Unsafe Condition', count: CLASSIFICATION_CHECKLISTS.UNSAFE_CONDITION.length }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setChecklistCategoryFilter(tab.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer whitespace-nowrap border ${
                          checklistCategoryFilter === tab.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-stone-200 hover:bg-stone-50 hover:text-slate-900'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  {/* Search Bar Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={checklistSearch}
                      onChange={(e) => setChecklistSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                      }}
                      placeholder="Search safety issues (e.g. Gas Leak, Oil Spill)..."
                      className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-stone-200 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/20 transition-all placeholder:text-slate-400"
                    />
                    {checklistSearch && (
                      <button
                        type="button"
                        onClick={() => setChecklistSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Checklist Options Grid */}
                  <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-1">
                    {filteredChecklistOptions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredChecklistOptions.map((opt) => {
                          const isSelected = selectedChecklist.includes(opt.label);
                          return (
                            <label
                              key={`${opt.category}_${opt.id}`}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-orange-50/90 border-[#FF5A36] text-slate-900 shadow-2xs font-bold'
                                  : 'bg-white border-stone-200/90 text-slate-700 hover:bg-stone-50 hover:border-stone-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleChecklistItem(opt.label)}
                                className="sr-only"
                              />
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected 
                                  ? 'bg-[#FF5A36] border-[#FF5A36] text-white' 
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="flex-1 leading-snug">{opt.label}</span>
                              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${opt.badgeClass}`}>
                                {opt.categoryLabel}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs sm:text-sm font-semibold text-slate-400 bg-white rounded-lg border border-dashed border-stone-200">
                        No matching safety issues found
                      </div>
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>
                      Showing {filteredChecklistOptions.length} of {itemsToFilter.length} issues
                    </span>
                    <span className="font-bold text-slate-700">
                      {selectedChecklist.length} selected
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirmed Incident Location Display in the Form (Requirement 5) */}
          {selectedIncidentLocation && (
            <div className="p-3.5 rounded-2xl bg-orange-50/90 border-2 border-orange-300 shadow-2xs space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-wider text-orange-900 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>INCIDENT LOCATION</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenMapClick}
                  className="text-[11px] font-bold text-orange-700 hover:text-orange-950 underline cursor-pointer"
                >
                  Change Location
                </button>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-orange-200 font-bold text-xs text-orange-950 shadow-2xs shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-orange-600" />
                  {location || selectedIncidentLocation.unit || 'Unit 1'}
                </span>
                <span className="text-sm font-black text-slate-900 truncate">
                  {selectedIncidentLocation.address || selectedIncidentLocation.name || location || 'Unit 1'}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons: [ 📍 Open Map ]       [ RUN AI SAFETY ANALYSIS → ] */}
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

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <button
                type="button"
                onClick={handleOpenMapClick}
                disabled={isRequestingLocation || isAnalyzing}
                className={`sm:col-span-4 py-4 sm:py-5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase shadow-md transition-all flex items-center justify-center gap-2 border-2 cursor-pointer disabled:opacity-60 ${
                  selectedIncidentLocation
                    ? 'bg-orange-50 hover:bg-orange-100 text-orange-900 border-orange-300'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-[#FF5A36] hover:text-[#FF5A36]'
                }`}
              >
                <MapPin className="w-5 h-5 text-[#FF5A36] shrink-0" />
                <span>{isRequestingLocation ? 'Locating...' : selectedIncidentLocation ? 'Edit Map' : 'Open Map'}</span>
              </button>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="sm:col-span-8 py-4 sm:py-5 px-6 rounded-xl font-black text-sm sm:text-base tracking-wider uppercase shadow-lg transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-[#FF6B4A] via-[#FF5A36] to-[#FFA133] hover:opacity-95 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60"
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
                          {analysisResult.explainable_reasoning || (
                            <>The entered description <span className="font-mono font-black text-amber-950 px-1.5 py-0.5 bg-amber-100 rounded border border-amber-200">"{description && description.length > 70 ? `${description.slice(0, 70)}...` : (description || 'nothing')}"</span> does not contain a recognized industrial safety hazard, equipment condition, or barrier failure.</>
                          )}
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
                        if (sample.incidentLocation) {
                          setSelectedIncidentLocation(sample.incidentLocation);
                        }
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

                          {/* Type, SIF status, Reference, Duplicate, and Confidence */}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Report Reference Badge */}
                            {analysisResult.report_reference && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase bg-blue-700 text-white shadow-xs">
                                REF: {analysisResult.report_reference}
                              </span>
                            )}

                            {/* Reused Duplicate Badge */}
                            {analysisResult.is_duplicate && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tracking-wide uppercase bg-purple-700 text-white shadow-xs">
                                REUSED DUPLICATE
                              </span>
                            )}

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

                  {/* Incident Location Map with Risk-Colored Marker & Admin Navigation (Requirement 7 & 8) */}
                  <IncidentPostAnalysisMap
                    incidentLocation={analysisResult.incidentLocation || selectedIncidentLocation || {
                      latitude: analysisResult.incident_latitude || 12.9716,
                      longitude: analysisResult.incident_longitude || 77.5946,
                      name: analysisResult.incident_location_name || analysisResult.location || location || 'Unit 1',
                      address: analysisResult.incident_address || analysisResult.incident_location_name || analysisResult.location || location || 'Unit 1'
                    }}
                    riskScore={analysisResult.risk_score}
                    riskLevel={
                      analysisResult.risk_score > 66 ? 'High Risk' :
                      analysisResult.risk_score >= 33 ? 'Medium Risk' : 'Low Risk'
                    }
                    incidentType={analysisResult.classification || reportType}
                    reportName={analysisResult.report_name}
                    onNavigate={isAdmin ? () => setShowAdminNavModal(true) : undefined}
                    isAdmin={isAdmin}
                  />

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
                      <span>View Details</span>
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

      {/* Incident Location Selection Modal (Requirement 3) */}
      <IncidentLocationModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialLocation={selectedIncidentLocation}
        userLocation={userLocation}
        selectedUnit={location}
        onConfirm={(loc) => {
          setSelectedIncidentLocation(loc);
          if (loc.name && ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].includes(loc.name)) {
            setLocation(loc.name);
          }
          if (validationError) {
            setValidationError('');
          }
        }}
      />

      {/* Admin Incident Navigation Modal (Requirement 8 & 9) */}
      <AdminNavigationModal
        isOpen={showAdminNavModal}
        onClose={() => setShowAdminNavModal(false)}
        incidentLocation={analysisResult?.incidentLocation || selectedIncidentLocation || {
          latitude: analysisResult?.incident_latitude || 12.9716,
          longitude: analysisResult?.incident_longitude || 77.5946,
          name: analysisResult?.incident_location_name || analysisResult?.location || location || 'Unit 1',
          address: analysisResult?.incident_address || analysisResult?.location || location || 'Unit 1'
        }}
        riskScore={analysisResult?.risk_score || 50}
        riskLevel={
          (analysisResult?.risk_score || 50) > 66 ? 'High Risk' :
          (analysisResult?.risk_score || 50) >= 33 ? 'Medium Risk' : 'Low Risk'
        }
        incidentType={analysisResult?.classification || reportType}
      />

    </div>
  );
}
