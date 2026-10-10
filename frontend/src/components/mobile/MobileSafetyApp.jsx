import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  AlertTriangle,
  Plus,
  Bell,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Camera,
  Mic,
  MicOff,
  Radio,
  Send,
  Sparkles,
  Lock,
  RotateCcw,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Flame,
  ChevronRight,
  X,
  Search,
  Activity,
  PhoneCall,
  Wrench,
  Maximize2,
  Minimize2,
  Check,
  LogOut,
  ArrowRight,
  ArrowLeft,
  Ambulance,
  KeyRound,
  Mail,
  Zap,
  Cpu,
  CheckSquare,
  Building2,
  Navigation,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import IncidentLocationModal from '../platform/maps/IncidentLocationModal';
import IncidentPostAnalysisMap from '../platform/maps/IncidentPostAnalysisMap';
import { 
  getStoreState, 
  autoPersistToTotalRecords,
  evaluateSIFPrecursor
} from '../../services/safetyStore';
import {
  CLASSIFICATION_CHECKLISTS,
  ALL_CHECKLIST_ITEMS,
  detectCategoryFromChecklist,
  detectCategoryFromExplanation,
  isUnrelatedIssue,
  calculateDynamicRiskScore,
  getDynamicRecommendations,
  getDynamicExplanation,
  getDynamicConfidence,
  deriveReportName
} from '../platform/AIAnalysisView';
import safetyTeamWelcome from '../../assets/safety_team_welcome.jpg';

// Department list for response tasks including Ambulance
const DEPARTMENTS = [
  { id: 'ALL', name: 'All Teams' },
  { id: 'AMBULANCE_MEDICAL', name: 'Ambulance 🚑', icon: '🚑', email: 'ambulance@safety.com', pass: 'med123', label: 'Ambulance / Medical' },
  { id: 'MECHANICAL', name: 'Mechanical ⚙️', icon: '⚙️', email: 'mechanical@safety.com', pass: 'mech123', label: 'Mechanical Team' },
  { id: 'ELECTRICAL', name: 'Electrical ⚡', icon: '⚡', email: 'electrical@safety.com', pass: 'elec123', label: 'Electrical Team' },
  { id: 'PROCESS_SAFETY', name: 'Process Safety 🏭', icon: '🏭', email: 'process@safety.com', pass: 'process123', label: 'Process Safety' },
  { id: 'RIGGING_LIFTING', name: 'Rigging 🏗️', icon: '🏗️', email: 'rigging@safety.com', pass: 'rig123', label: 'Rigging & Lifting' },
  { id: 'HAZMAT', name: 'Hazmat ☣️', icon: '☣️', email: 'hazmat@safety.com', pass: 'hazmat123', label: 'Hazmat Team' },
  { id: 'CIVIL_STRUCTURAL', name: 'Civil 🧱', icon: '🧱', email: 'civil@safety.com', pass: 'civil123', label: 'Civil & Structural' }
];

// Presets for the 3 Login Roles
const LOGIN_ROLES = [
  {
    id: 'WORKER',
    title: 'User / Worker',
    icon: '👷',
    badge: 'Field Reporter',
    desc: 'Voice reporting, hazard submission, near misses & emergency SOS',
    defaultEmail: 'worker@safety.com',
    defaultPass: 'worker123',
    defaultName: 'Liam Vance (Field Worker)'
  },
  {
    id: 'RESPONDER',
    title: 'Responder',
    icon: '🛠️',
    badge: 'Emergency & Technical Teams',
    desc: 'Ambulance, Mechanical, Electrical, Process, Rigging, Hazmat & Civil',
    defaultEmail: 'ambulance@safety.com',
    defaultPass: 'med123',
    defaultName: 'Dr. Sunita (Ambulance Lead)'
  },
  {
    id: 'ADMIN',
    title: 'Admin',
    icon: '🛡️',
    badge: 'Safety Officer / HSE',
    desc: 'SIF Precursor radar, task dispatch, triage & verification sign-off',
    defaultEmail: 'admin@safety.com',
    defaultPass: 'admin123',
    defaultName: 'Eleanor Vance (HSE Admin)'
  }
];

// Helper to determine AI energy vector, life-saving rules, and response dispatch
function extractAiIncidentDetails(text, category) {
  const combined = `${text || ''} ${category || ''}`.toLowerCase();
  
  let energyVector = 'Mechanical & Kinetic Vector';
  let lifeSavingRule = 'Work Authorization & Line of Fire';
  let recommendedAction = 'Immediate physical barrier enforcement, stop work authority, and supervisor review.';
  let dept = 'MECHANICAL';
  let deptLabel = 'Mechanical Team ⚙️';

  if (combined.includes('gas') || combined.includes('leak') || combined.includes('pipe') || combined.includes('flange') || combined.includes('pressure') || combined.includes('h2s')) {
    energyVector = 'High Pressure Chemical & Flammable Hydrocarbon';
    lifeSavingRule = 'Bypass Safety Controls & Energy Isolation (LOTO)';
    recommendedAction = 'Depressurize line, isolate upstream valves, verify LEL with gas detector, and deploy 50m exclusion zone.';
    dept = 'AMBULANCE_MEDICAL';
    deptLabel = 'Ambulance / Medical 🚑 & Process Safety';
  } else if (combined.includes('fire') || combined.includes('flame') || combined.includes('burn') || combined.includes('explosion') || combined.includes('smoke')) {
    energyVector = 'Thermal Energy & Flash Fire Vector';
    lifeSavingRule = 'Hot Work Controls & Emergency Response';
    recommendedAction = 'Activate emergency deluge system, evacuate sector, establish fire perimeter, and standby medical.';
    dept = 'AMBULANCE_MEDICAL';
    deptLabel = 'Ambulance / Medical 🚑';
  } else if (combined.includes('electric') || combined.includes('wire') || combined.includes('11kv') || combined.includes('415v') || combined.includes('arc') || combined.includes('breaker') || combined.includes('switch')) {
    energyVector = 'High Voltage Electrical (Arc Flash Hazard)';
    lifeSavingRule = 'Energy Isolation & Lockout/Tagout (LOTO)';
    recommendedAction = 'Lock out distribution board, verify zero energy state with multimeter, and inspect breaker.';
    dept = 'ELECTRICAL';
    deptLabel = 'Electrical Team ⚡';
  } else if (combined.includes('fall') || combined.includes('scaffold') || combined.includes('height') || combined.includes('ladder') || combined.includes('roof')) {
    energyVector = 'Gravitational Potential Energy (Work at Height)';
    lifeSavingRule = 'Work at Height (100% Tie-Off)';
    recommendedAction = 'Immediately suspend elevated work, inspect scaffold green tag, and verify dual-lanyard harness.';
    dept = 'CIVIL_STRUCTURAL';
    deptLabel = 'Civil & Structural 🧱';
  } else if (combined.includes('crane') || combined.includes('lift') || combined.includes('hoist') || combined.includes('sling') || combined.includes('rigging') || combined.includes('dropped')) {
    energyVector = 'Suspended Load Kinetic & Rigging Failure';
    lifeSavingRule = 'Line of Fire & Safe Mechanical Lifting';
    recommendedAction = 'Establish 1.5x drop radius barricade, inspect sling certification, and halt tandem crane lifts.';
    dept = 'RIGGING_LIFTING';
    deptLabel = 'Rigging & Lifting 🏗️';
  } else if (combined.includes('chemical') || combined.includes('acid') || combined.includes('toxic') || combined.includes('spill') || combined.includes('fume')) {
    energyVector = 'Corrosive Chemical & Acute Toxicity';
    lifeSavingRule = 'Hazardous Substances & Chemical Containment';
    recommendedAction = 'Deploy neutralizer absorbent, evacuate downwind sector, don Level B hazmat PPE, and notify dispatch.';
    dept = 'HAZMAT';
    deptLabel = 'Hazmat Team ☣️';
  }

  return { energyVector, lifeSavingRule, recommendedAction, dept, deptLabel };
}

const DEFAULT_USER_INCIDENTS = [
  {
    id: 101,
    report_number: 'REP-ID001-9821',
    report_name: 'Hydrocarbon Leak Near Flare Line',
    title: 'Hydrocarbon Leak: Unit 4 (Flare)',
    description: 'Pressurized gas venting observed with unusual hissing sound near isolation flange. Combustible gas detector triggered.',
    category: 'Hazard',
    report_type: 'Hazard',
    location: 'Unit 4',
    facility_unit: 'Unit 4 (Flare)',
    incidentLocation: {
      latitude: 12.9725,
      longitude: 77.5955,
      name: 'Unit 4 (Flare)',
      address: 'Unit 4 Flare Header & Knockout Drum, South Sector'
    },
    reported_by: 'Liam Vance (Field Worker)',
    severity: 'CRITICAL',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    status: 'Action Required',
    is_sif: true,
    risk_score: 94,
    energy_vector: 'Pressure & Flammable Hydrocarbon',
    life_saving_rule: 'Bypass of Safety Controls & Hot Work',
    barrier_status: 'CRITICAL BARRIER FAILED / MISSING',
    recommended_action: 'Depressurize header, cordon 50m exclusion boundary, verify LOTO and dispatch emergency mechanical response.',
    recommended_controls: [
      'Isolate upstream supply valve and depressurize affected line segment.',
      'Evacuate area and perform continuous atmospheric gas testing (0% LEL).',
      'Inspect flange gasket, valve seals, and fittings for degradation.',
      'Establish safety exclusion perimeter until re-pressurization tests pass.'
    ],
    reasoning: 'High-pressure flammable gas release in vicinity of ignition sources constitutes an unmitigated Life-Threatening SIF Precursor.',
    assigned_department: 'MECHANICAL',
    assigned_department_label: 'Mechanical & Piping',
    photo_attached: true,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
  },
  {
    id: 102,
    report_number: 'REP-ID001-8742',
    report_name: 'Missing Scaffolding Toe-Boards at High Elevation',
    title: 'Unsafe Condition: Unit 2 (FCC)',
    description: 'Scaffold platform at 18 meters missing toe-boards and mid-rail on western side. Heavy tools placed near open edge over active walkway.',
    category: 'Unsafe Condition',
    report_type: 'Unsafe Condition',
    location: 'Unit 2',
    facility_unit: 'Unit 2 (FCC)',
    incidentLocation: {
      latitude: 12.9710,
      longitude: 77.5940,
      name: 'Unit 2 (FCC)',
      address: 'Unit 2 FCC Reactor Column, Level 3 Scaffolding'
    },
    reported_by: 'Liam Vance (Field Worker)',
    severity: 'CRITICAL',
    risk_level: 'Critical',
    sif_precursor_assessment: 'YES',
    status: 'Action Required',
    is_sif: true,
    risk_score: 91,
    energy_vector: 'Gravity / Fall from Height',
    life_saving_rule: 'Working at Height',
    barrier_status: 'BARRIER DEGRADED / INCOMPLETE',
    recommended_action: 'Red-tag scaffolding immediately, stop work at height, install certified toe-boards and secondary tool lanyards.',
    recommended_controls: [
      'Ensure certified 100% tie-off with inspected harness and lanyard.',
      'Install top-rail, mid-rail, and toe-board fall protection barriers.',
      'Red-tag scaffold or ladder until certified inspection sign-off.',
      'Clear walkway of trip hazards and verify secure planking.'
    ],
    reasoning: 'Fall from 18m or dropped object impact from this elevation has lethal energy vector with direct SIF potential.',
    assigned_department: 'SAFETY',
    assigned_department_label: 'Safety Inspection Team',
    photo_attached: false,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 103,
    report_number: 'REP-ID001-6519',
    report_name: 'Improper Cable Routing in Control Corridor',
    title: 'Near Miss: Unit 1 (CDU)',
    description: 'Temporary 415V supply cable routed across walkway without rubber cable protector ramps. Worker tripped but avoided falling.',
    category: 'Near Miss',
    report_type: 'Near Miss',
    location: 'Unit 1',
    facility_unit: 'Unit 1 (CDU)',
    incidentLocation: {
      latitude: 12.9716,
      longitude: 77.5946,
      name: 'Unit 1 (CDU)',
      address: 'Unit 1 Crude Distillation Control Corridor'
    },
    reported_by: 'Liam Vance (Field Worker)',
    severity: 'MEDIUM',
    risk_level: 'Medium',
    sif_precursor_assessment: 'NO',
    status: 'Under Review',
    is_sif: false,
    risk_score: 48,
    energy_vector: 'Low-Voltage Electrical & Trip Hazard',
    life_saving_rule: 'Energy Isolation & Walkway Integrity',
    barrier_status: 'BARRIER TEMPORARILY COMPROMISED',
    recommended_action: 'Re-route cabling overhead through cable tray and install high-visibility heavy duty ramp protectors.',
    recommended_controls: [
      'De-energize electrical circuit and perform Lockout/Tagout (LOTO).',
      'Verify zero voltage using a calibrated test instrument before contact.',
      'Inspect enclosure, insulation, and conductors for thermal damage.',
      'Mandate qualified electrical PPE per NFPA 70E standards.'
    ],
    reasoning: 'Low kinetic energy trip incident without high-voltage arc hazard. Classified as controlled non-SIF operational observation.',
    assigned_department: 'ELECTRICAL',
    assigned_department_label: 'Electrical Maintenance',
    photo_attached: false,
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  }
];

export default function MobileSafetyApp() {
  // Screen Mode: 'welcome' (Splash Onboarding) | 'login' (Role & Auth) | 'app' (Main Dashboard)
  const [screenMode, setScreenMode] = useState('welcome');
  const [loginStep, setLoginStep] = useState(1); // 1: Choose Role | 2: Username & Password

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('WORKER'); // 'WORKER' | 'RESPONDER' | 'ADMIN'
  const [selectedResponderDept, setSelectedResponderDept] = useState('AMBULANCE_MEDICAL');
  const [emailInput, setEmailInput] = useState('worker@safety.com');
  const [passwordInput, setPasswordInput] = useState('worker123');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Navigation tabs in main app: 'home' | 'incidents' | 'alerts' | 'more'
  const [activeTab, setActiveTab] = useState('home');
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  // Report Modal State (Full AI Safety Intelligence input features from website)
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState('NEAR_MISS'); // 'NEAR_MISS' | 'UNSAFE_ACT' | 'UNSAFE_CONDITION'
  const [operatingUnit, setOperatingUnit] = useState('Unit 1'); // 'Unit 1' | 'Unit 2' | 'Unit 3' | 'Unit 4'
  const [facilityLocation, setFacilityLocation] = useState('Unit 1 – Main Processing Area');
  const [inputMode, setInputMode] = useState('DESCRIPTION'); // 'DESCRIPTION' | 'CHECKLIST' (mutually exclusive)
  const [descriptionInput, setDescriptionInput] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState([]);
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState('ALL');
  const [checklistSearch, setChecklistSearch] = useState('');
  const [validationError, setValidationError] = useState('');
  const [analysisStepText, setAnalysisStepText] = useState('');
  
  // Voice Recording & Multilingual Translation
  const [selectedLanguage, setSelectedLanguage] = useState('te'); // 'te' | 'hi' | 'en'
  const [noiseIsolation, setNoiseIsolation] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [translatedEnglish, setTranslatedEnglish] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [photoAttached, setPhotoAttached] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [aiAnalysisModalData, setAiAnalysisModalData] = useState(null);

  // Voice Based Search State & References
  const [showVoiceSearchModal, setShowVoiceSearchModal] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [voiceSearchSeconds, setVoiceSearchSeconds] = useState(0);
  const [voiceSearchLang, setVoiceSearchLang] = useState('en');
  const [voiceSearchNoiseFilter, setVoiceSearchNoiseFilter] = useState(true);
  const voiceSearchRecRef = useRef(null);
  const voiceSearchTimerRef = useRef(null);

  // Incident Map Location State
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedIncidentLocation, setSelectedIncidentLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // User Reported Incidents & Location Viewer State
  const [reportedIncidents, setReportedIncidents] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('safetyai_active_reports') || '[]');
      if (stored && Array.isArray(stored) && stored.length > 0) return stored;
    } catch (e) {}
    return DEFAULT_USER_INCIDENTS;
  });
  const [locationViewIncident, setLocationViewIncident] = useState(null);
  const [incidentFilter, setIncidentFilter] = useState('ALL'); // 'ALL' | 'SIF' | 'CONTROLLED'
  const [incidentsViewMode, setIncidentsViewMode] = useState('REPORTS'); // 'REPORTS' | 'TASKS'

  // Response Tasks & Overview Metrics
  const [tasks, setTasks] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTaskModal, setSelectedTaskModal] = useState(null);
  const [workNotes, setWorkNotes] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // SOS Emergency State
  const [sosCountdown, setSosCountdown] = useState(null);
  const [sosDispatched, setSosDispatched] = useState(false);

  // Analytics Overview Counts (Actual Incident Data - No Hardcoded Values)
  const [analyticsOverview, setAnalyticsOverview] = useState({
    totalIncidents: 0,
    pending: 0,
    sif: 0,
    nonSif: 0
  });

  // Recent Alert Banner Data
  const [latestAlert, setLatestAlert] = useState({
    title: 'Unsafe Condition Reported',
    subtitle: 'PPE violation at Plant 2',
    time: '2 min ago',
    type: 'warning'
  });

  const recordingTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch real analytics overview metrics directly from backend intelligence APIs
  const fetchAnalyticsData = async () => {
    try {
      // 1. Primary: query backend dashboard endpoint (scoped to current organization/system)
      const data = await api.getDashboardData();
      if (data && typeof data.total_reports === 'number') {
        const total = data.total_reports || 0;
        const sif = data.potential_sif_findings ?? data.total_sif_precursors ?? 0;
        const nonSif = Math.max(0, total - sif);
        const pending = data.awaiting_review !== undefined ? data.awaiting_review : 0;
        setAnalyticsOverview({
          totalIncidents: total,
          pending: pending,
          sif: sif,
          nonSif: nonSif
        });
        return;
      }
    } catch (e) {
      // Gracefully continue to secondary report lists
    }

    try {
      // 2. Secondary fallback: calculate from backend reports list
      const reports = await api.getReports();
      if (Array.isArray(reports)) {
        const total = reports.length;
        const sif = reports.filter(r => r.sif_precursor_assessment === 'YES').length;
        const nonSif = Math.max(0, total - sif);
        const pending = reports.filter(r =>
          r.analysis_status === 'PENDING' ||
          r.status === 'Open' ||
          r.status === 'In Progress' ||
          r.status === 'Verification Pending' ||
          !r.has_feedback
        ).length;
        setAnalyticsOverview({
          totalIncidents: total,
          pending: pending,
          sif: sif,
          nonSif: nonSif
        });
        return;
      }
    } catch (e) {}

    try {
      // 3. Fallback: local store / safetyStore state
      const storeState = getStoreState();
      const localReports = storeState.reports || [];
      const total = localReports.length;
      const sif = localReports.filter(r => r.sif_precursor_assessment === 'YES' || r.risk_level === 'Critical').length;
      const nonSif = Math.max(0, total - sif);
      const pending = localReports.filter(r => r.analysis_status === 'PENDING' || r.status === 'Open').length;
      setAnalyticsOverview({
        totalIncidents: total,
        pending: pending,
        sif: sif,
        nonSif: nonSif
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      fetchAnalyticsData();
      const interval = setInterval(() => {
        fetchTasks();
        fetchAnalyticsData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedDept, currentUser]);

  const fetchTasks = async () => {
    try {
      const res = await api.getResponseTasks(selectedDept === 'ALL' ? null : selectedDept);
      if (res && Array.isArray(res)) {
        setTasks(res);
      }
    } catch (e) {
      console.warn('API fetchTasks fallback:', e);
    }
  };

  // Switch Role in Login Screen & auto-update credentials
  const handleSelectRoleField = (roleId) => {
    setSelectedRole(roleId);
    setLoginError(null);
    if (roleId === 'WORKER') {
      setEmailInput('worker@safety.com');
      setPasswordInput('worker123');
    } else if (roleId === 'ADMIN') {
      setEmailInput('admin@safety.com');
      setPasswordInput('admin123');
    } else if (roleId === 'RESPONDER') {
      const deptObj = DEPARTMENTS.find(d => d.id === selectedResponderDept) || DEPARTMENTS[1];
      setEmailInput(deptObj.email || 'ambulance@safety.com');
      setPasswordInput(deptObj.pass || 'med123');
    }
  };

  const handleSelectResponderDept = (deptId) => {
    setSelectedResponderDept(deptId);
    setLoginError(null);
    const deptObj = DEPARTMENTS.find(d => d.id === deptId);
    if (deptObj && deptObj.email) {
      setEmailInput(deptObj.email);
      setPasswordInput(deptObj.pass);
    }
  };

  // Perform Login
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await api.login('id001', emailInput, passwordInput);
      if (res && res.user) {
        if (res.access_token) {
          try {
            localStorage.setItem('safetyai_token', res.access_token);
            localStorage.setItem('safetyai_user', JSON.stringify(res.user));
          } catch (e) {}
        }
        setCurrentUser(res.user);
        setScreenMode('app');
        setActiveTab('home');
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      const cleanEmail = emailInput.trim().toLowerCase();
      const roleObj = LOGIN_ROLES.find(r => r.id === selectedRole);
      
      let userObj = {
        email: cleanEmail,
        full_name: roleObj?.defaultName || 'Safety User',
        role: selectedRole,
        role_name: selectedRole === 'ADMIN' ? 'Safety Administrator' : selectedRole === 'RESPONDER' ? 'Response Specialist' : 'Field Worker',
        is_admin: selectedRole === 'ADMIN',
        department: selectedRole === 'RESPONDER' ? selectedResponderDept : 'FIELD_OPS'
      };

      if (cleanEmail.includes('ambulance')) {
        userObj.full_name = 'Dr. Sunita (Ambulance Lead)';
        userObj.department = 'AMBULANCE_MEDICAL';
      } else if (cleanEmail.includes('mech')) {
        userObj.full_name = 'Marcus Sterling (Mechanical Lead)';
        userObj.department = 'MECHANICAL';
      } else if (cleanEmail.includes('admin')) {
        userObj.full_name = 'Eleanor Vance (HSE Admin)';
        userObj.role = 'ADMIN';
        userObj.is_admin = true;
      }

      setCurrentUser(userObj);
      setScreenMode('app');
      setActiveTab('home');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    setScreenMode('welcome');
    setLoginStep(1);
    setEmailInput('worker@safety.com');
    setPasswordInput('worker123');
    setSelectedRole('WORKER');
  };

  // Open report modal with specific category preset
  const openReportWithCategory = (cat) => {
    const mapped = (cat === 'Near Miss' || cat === 'NEAR_MISS') ? 'NEAR_MISS' : (cat === 'Unsafe Act' || cat === 'UNSAFE_ACT') ? 'UNSAFE_ACT' : 'UNSAFE_CONDITION';
    setReportCategory(mapped);
    setDescriptionInput('');
    setSelectedChecklist([]);
    setInputMode('DESCRIPTION');
    setSpokenTranscript('');
    setTranslatedEnglish('');
    setPhotoAttached(false);
    setValidationError('');
    setAnalysisStepText('');
    setShowReportModal(true);
  };

  const handleResetReportInput = () => {
    setDescriptionInput('');
    setSelectedChecklist([]);
    setSpokenTranscript('');
    setTranslatedEnglish('');
    setPhotoAttached(false);
    setValidationError('');
    setAnalysisStepText('');
    setOperatingUnit('Unit 1');
    setFacilityLocation('Unit 1 – Main Processing Area');
    setSelectedIncidentLocation(null);
    setInputMode('DESCRIPTION');
    setChecklistCategoryFilter('ALL');
    setChecklistSearch('');
  };

  const toggleChecklistItem = (itemLabel) => {
    setSelectedChecklist((prev) => {
      const nextList = prev.includes(itemLabel)
        ? prev.filter((label) => label !== itemLabel)
        : [...prev, itemLabel];

      const autoCat = detectCategoryFromChecklist(nextList);
      if (autoCat) {
        setReportCategory(autoCat.category);
      }
      return nextList;
    });
    if (validationError) setValidationError('');
  };

  const SAMPLE_PRESETS = [
    {
      title: 'Work at Height (8m unclipped)',
      type: 'UNSAFE_ACT',
      unit: 'Unit 4',
      loc: 'Pipe Rack Scaffolding Bay 4',
      desc: 'Contractor working on scaffolding platform at 8 meters elevation without clipping twin lanyards to static lifeline. Scaffolding mid-rail was temporarily unbolted for material passage.'
    },
    {
      title: 'Bypassed Safety ESD Interlock',
      type: 'UNSAFE_CONDITION',
      unit: 'Unit 2',
      loc: 'CPF Compressor Station Train 2',
      desc: 'High-pressure emergency shutdown (ESD) interlock switch on discharge scrubber was bridged with copper jumper wire without bypass permit or MOC.'
    },
    {
      title: 'Suspended Crane Load Near-Miss',
      type: 'NEAR_MISS',
      unit: 'Unit 1',
      loc: 'Bay 2 Heavy Fabrication Shop',
      desc: 'Worker operating overhead bridge crane in Bay 2 with worn wire rope. A 2-ton steel beam slipped during transport and swung into pedestrian walkway where two workers were walking.'
    }
  ];

  const handleApplyPreset = (p) => {
    setInputMode('DESCRIPTION');
    setSelectedChecklist([]);
    setReportCategory(p.type);
    setOperatingUnit(p.unit);
    setFacilityLocation(p.loc);
    setSelectedIncidentLocation({
      latitude: p.unit === 'Unit 2' ? 12.9730 : p.unit === 'Unit 3' ? 12.9700 : p.unit === 'Unit 4' ? 12.9690 : 12.9716,
      longitude: p.unit === 'Unit 2' ? 77.5960 : p.unit === 'Unit 3' ? 77.5930 : p.unit === 'Unit 4' ? 77.5910 : 77.5946,
      name: p.loc,
      address: p.loc,
      unit: p.unit
    });
    setDescriptionInput(p.desc);
    setValidationError('');
  };

  // Map Location Trigger with Geolocation Context
  const handleOpenMapClick = () => {
    if (validationError) setValidationError('');

    if (!navigator.geolocation) {
      setShowMapModal(true);
      return;
    }

    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequestingLocation(false);
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setShowMapModal(true);
      },
      () => {
        setIsRequestingLocation(false);
        setShowMapModal(true);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleConfirmLocation = (loc) => {
    setSelectedIncidentLocation(loc);
    if (loc?.unit) {
      setOperatingUnit(loc.unit);
    } else if (loc?.name && ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].includes(loc.name)) {
      setOperatingUnit(loc.name);
    }
    if (loc?.address || loc?.name) {
      setFacilityLocation(loc.address || loc.name);
    }
    if (validationError) setValidationError('');
  };

  // Voice Recording Control
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    setSpokenTranscript('');
    setTranslatedEnglish('');

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      simulateVoice();
      return;
    }

    try {
      const rec = new SpeechRec();
      recognitionRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = selectedLanguage === 'te' ? 'te-IN' : selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';

      rec.onresult = (evt) => {
        let text = '';
        for (let i = 0; i < evt.results.length; i++) {
          text += evt.results[i][0].transcript;
        }
        setSpokenTranscript(text);
        if (text) {
          setDescriptionInput(text);
        }
      };

      rec.onerror = () => {
        if (!spokenTranscript) simulateVoice();
      };

      rec.start();
    } catch (e) {
      simulateVoice();
    }
  };

  const simulateVoice = () => {
    const samples = {
      te: 'ప్లాంట్ 2 వద్ద గ్యాస్ పైప్‌లైన్ ఫ్లాంజ్ లీక్ అవుతోంది, ప్రెజర్ గేజ్ వేగంగా పెరుగుతోంది మరియు కార్మికులు పిపిఇ లేకుండా పని చేస్తున్నారు.',
      hi: 'प्लांट 2 के कंप्रेशर लाइन में भारी गैस रिसाव देखा गया है और स्पार्क का खतरा है।',
      en: 'Gas leak observed at pipeline flange in Plant 2 with workers lacking required PPE.'
    };
    setTimeout(() => {
      const txt = samples[selectedLanguage] || samples.en;
      setSpokenTranscript(txt);
      setDescriptionInput(txt);
    }, 1500);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    translateSpokenText(spokenTranscript || descriptionInput || (selectedLanguage === 'te' 
      ? 'ప్లాంట్ 2 వద్ద గ్యాస్ పైప్‌లైన్ ఫ్లాంజ్ లీక్ అవుతోంది.' 
      : 'प्लांट 2 में गैस रिसाव देखा गया है।'));
  };

  const translateSpokenText = async (txt) => {
    if (!txt) return;
    setIsTranslating(true);
    try {
      const res = await api.translateVoice({
        audio_text: txt,
        source_language: selectedLanguage,
        target_language: 'en'
      });
      if (res && res.translated_text) {
        setTranslatedEnglish(res.translated_text);
        setDescriptionInput(res.translated_text);
      } else {
        fallbackTranslate(txt);
      }
    } catch (e) {
      fallbackTranslate(txt);
    } finally {
      setIsTranslating(false);
    }
  };

  const fallbackTranslate = (txt) => {
    if (selectedLanguage === 'te') {
      const tr = 'Gas pipeline flange is leaking at Plant 2, pressure gauge rising rapidly with PPE safety non-compliance.';
      setTranslatedEnglish(tr);
      setDescriptionInput(tr);
    } else if (selectedLanguage === 'hi') {
      const tr = 'Heavy gas leak detected at compressor line in Plant 2 with severe spark ignition hazard.';
      setTranslatedEnglish(tr);
      setDescriptionInput(tr);
    } else {
      setTranslatedEnglish(txt);
      setDescriptionInput(txt);
    }
  };

  // Voice Based Search Handlers
  const startVoiceSearch = (lang = voiceSearchLang) => {
    setIsVoiceSearching(true);
    setVoiceSearchSeconds(0);
    if (voiceSearchTimerRef.current) clearInterval(voiceSearchTimerRef.current);
    voiceSearchTimerRef.current = setInterval(() => {
      setVoiceSearchSeconds(prev => prev + 1);
    }, 1000);

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      simulateVoiceSearch(lang);
      return;
    }

    try {
      if (voiceSearchRecRef.current) {
        try { voiceSearchRecRef.current.abort(); } catch (e) {}
      }
      const rec = new SpeechRec();
      voiceSearchRecRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-US';

      rec.onresult = (evt) => {
        let text = '';
        for (let i = 0; i < evt.results.length; i++) {
          text += evt.results[i][0].transcript;
        }
        if (text) {
          setVoiceSearchQuery(text);
        }
      };

      rec.onerror = () => {
        simulateVoiceSearch(lang);
      };

      rec.onend = () => {
        setIsVoiceSearching(false);
        if (voiceSearchTimerRef.current) clearInterval(voiceSearchTimerRef.current);
      };

      rec.start();
    } catch (e) {
      simulateVoiceSearch(lang);
    }
  };

  const stopVoiceSearch = () => {
    setIsVoiceSearching(false);
    if (voiceSearchTimerRef.current) clearInterval(voiceSearchTimerRef.current);
    if (voiceSearchRecRef.current) {
      try { voiceSearchRecRef.current.stop(); } catch (e) {}
    }
  };

  const toggleVoiceSearch = () => {
    if (isVoiceSearching) {
      stopVoiceSearch();
    } else {
      startVoiceSearch();
    }
  };

  const simulateVoiceSearch = (lang) => {
    const samples = {
      te: 'పైప్‌లైన్ గ్యాస్ లీక్ ప్లాంట్ 1',
      hi: 'गैस रिसाव और आग का खतरा प्लांट 1',
      en: 'Gas leak pipeline high pressure Unit 1'
    };
    setTimeout(() => {
      const sample = samples[lang] || samples.en;
      setVoiceSearchQuery(sample);
      setIsVoiceSearching(false);
      if (voiceSearchTimerRef.current) clearInterval(voiceSearchTimerRef.current);
    }, 1200);
  };

  const openVoiceSearchModal = () => {
    setShowVoiceSearchModal(true);
    setTimeout(() => {
      startVoiceSearch();
    }, 250);
  };

  const closeVoiceSearchModal = () => {
    stopVoiceSearch();
    setShowVoiceSearchModal(false);
  };

  const handleReportFromVoiceSearch = (text) => {
    closeVoiceSearchModal();
    setDescriptionInput(text || voiceSearchQuery);
    setInputMode('DESCRIPTION');
    setShowReportModal(true);
  };

  const searchResults = React.useMemo(() => {
    const q = (voiceSearchQuery || '').trim().toLowerCase();
    if (!q) {
      return {
        tasks: tasks.slice(0, 4),
        checklists: (ALL_CHECKLIST_ITEMS || []).slice(0, 4)
      };
    }

    const matchedTasks = tasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.department && t.department.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q)) ||
      (t.hazard && t.hazard.toLowerCase().includes(q)) ||
      (t.id && String(t.id).includes(q))
    );

    const matchedChecklists = (ALL_CHECKLIST_ITEMS || []).filter(item =>
      (item.label && item.label.toLowerCase().includes(q)) ||
      (item.keywords && item.keywords.some(k => q.includes(k) || k.includes(q)))
    );

    return {
      tasks: matchedTasks,
      checklists: matchedChecklists
    };
  }, [voiceSearchQuery, tasks]);

  // Submit Safety Observation & Execute Full AI Analysis Pipeline (Website Parity)
  const handleSaveReport = async () => {
    setValidationError('');
    const rawText = (descriptionInput || translatedEnglish || spokenTranscript || '').trim();

    // Mutual exclusivity & input validation
    if (inputMode === 'DESCRIPTION') {
      if (!rawText || rawText.length < 4) {
        setValidationError('Please describe the safety observation with at least 4 characters, or switch to Safety Checklists.');
        return;
      }
      if (isUnrelatedIssue(rawText, [])) {
        setValidationError('Enter Correct Issue: Please describe an active operational safety observation, equipment condition, or hazard.');
        return;
      }
    } else {
      if (!selectedChecklist || selectedChecklist.length === 0) {
        setValidationError('Please select at least one safety factor from the checklists.');
        return;
      }
    }

    setIsSubmitting(true);
    setAnalysisStepText('Phase 1/4: Ingesting report telemetry & parsing energy vectors...');

    const step2Timer = setTimeout(() => {
      setAnalysisStepText('Phase 2/4: Screening IOGP Life-Saving Rules & barrier failure states...');
    }, 400);

    const step3Timer = setTimeout(() => {
      setAnalysisStepText('Phase 3/4: Correlating multi-signal interaction & detecting weak signals...');
    }, 850);

    const step4Timer = setTimeout(() => {
      setAnalysisStepText('Phase 4/4: Computing neural risk score & SIF precursor determination...');
    }, 1300);

    try {
      let finalCategory = reportCategory;
      if (inputMode === 'CHECKLIST' && selectedChecklist.length > 0) {
        const autoCat = detectCategoryFromChecklist(selectedChecklist);
        if (autoCat) finalCategory = autoCat.category;
      }

      const activeText = inputMode === 'DESCRIPTION'
        ? rawText
        : selectedChecklist.map(factor => `- ${factor}`).join('\n');

      const humanCategoryLabel = finalCategory === 'NEAR_MISS' ? 'Near Miss' : finalCategory === 'UNSAFE_ACT' ? 'Unsafe Act' : 'Unsafe Condition';
      const locDisplay = `${operatingUnit} – ${facilityLocation}`;
      const reportTitle = deriveReportName(inputMode === 'DESCRIPTION' ? rawText : '', finalCategory, operatingUnit, selectedChecklist);

      const incidentLocObj = selectedIncidentLocation || {
        latitude: operatingUnit === 'Unit 2' ? 12.9730 : operatingUnit === 'Unit 3' ? 12.9700 : operatingUnit === 'Unit 4' ? 12.9690 : 12.9716,
        longitude: operatingUnit === 'Unit 2' ? 77.5960 : operatingUnit === 'Unit 3' ? 77.5930 : operatingUnit === 'Unit 4' ? 77.5910 : 77.5946,
        name: facilityLocation || operatingUnit,
        address: facilityLocation || operatingUnit,
        unit: operatingUnit
      };

      // Attempt canonical backend AI analysis
      let backendResult = null;
      try {
        backendResult = await api.executeAiAnalysis({
          report_text: activeText,
          description: activeText,
          report_name: reportTitle,
          report_type: humanCategoryLabel,
          classification: humanCategoryLabel,
          location: operatingUnit,
          operating_unit: operatingUnit,
          site: operatingUnit === 'Unit 1' ? 'Plant 01' : operatingUnit === 'Unit 2' ? 'Plant 02' : operatingUnit === 'Unit 3' ? 'Plant 03' : 'Plant 04',
          incidentLocation: incidentLocObj,
          incident_latitude: incidentLocObj.latitude,
          incident_longitude: incidentLocObj.longitude,
          incident_location_name: incidentLocObj.name,
          incident_address: incidentLocObj.address,
          report_date: new Date().toISOString().split('T')[0],
          ...(selectedChecklist.length > 0 ? { additional_context: `Safety Factors: ${selectedChecklist.join(', ')}` } : {})
        });
      } catch (err) {
        console.warn('Backend executeAiAnalysis fallback to local engine:', err);
      }

      let isSIF = false;
      let dynamicRiskScore = 45;
      let energyVector = '';
      let lifeSavingRule = '';
      let recommendedAction = '';
      let barrierStatus = '';
      let reasoning = '';
      let refId = '';

      if (backendResult) {
        const detStatus = (backendResult.determination_status || '').toLowerCase();
        const sifVal = backendResult.sif_precursor || (detStatus.includes('sif') && !detStatus.includes('no sif') && !detStatus.includes('not a sif') ? 'YES' : 'NO');
        isSIF = sifVal === 'YES';
        dynamicRiskScore = typeof backendResult.sif_potential_score === 'number'
          ? backendResult.sif_potential_score
          : typeof backendResult.risk_score === 'number'
          ? backendResult.risk_score
          : calculateDynamicRiskScore(backendResult.hazard, backendResult.energy_vector, backendResult.worker_exposure, backendResult.barrier_status, sifVal, activeText, selectedChecklist);
        energyVector = backendResult.energy_vector || (isSIF ? 'High Energy Vector' : 'Low Mechanical Kinetic');
        lifeSavingRule = backendResult.life_saving_rule || backendResult.iogp_rule || (isSIF ? 'Line of Fire (LSR-03)' : 'Workplace Housekeeping Standards');
        recommendedAction = (backendResult.recommended_controls && backendResult.recommended_controls[0]) || (backendResult.corrective_actions && backendResult.corrective_actions[0]) || 'Implement immediate barrier restoration and audit.';
        barrierStatus = backendResult.barrier_status || (isSIF ? 'CRITICAL BARRIER FAILED' : 'BARRIER ADEQUATE');
        reasoning = backendResult.explanation || backendResult.explainable_reasoning || getDynamicExplanation(sifVal, backendResult.hazard, energyVector, 'Personnel in operational zone', barrierStatus, activeText);
        refId = backendResult.report_reference || `REP-ID001-${Math.floor(1000 + Math.random() * 9000)}`;
      } else {
        const evalResult = evaluateSIFPrecursor(activeText, humanCategoryLabel, humanCategoryLabel);
        isSIF = evalResult.isSIF;
        dynamicRiskScore = evalResult.riskScore || (isSIF ? 88 : 35);
        const details = extractAiIncidentDetails(activeText, humanCategoryLabel);
        energyVector = details.energyVector;
        lifeSavingRule = details.lifeSavingRule;
        recommendedAction = details.recommendedAction;
        barrierStatus = isSIF ? 'CRITICAL BARRIER FAILED / MISSING' : 'BARRIER ADEQUATE';
        reasoning = getDynamicExplanation(isSIF ? 'YES' : 'NO', details.lifeSavingRule, energyVector, 'Field Personnel Exposed', barrierStatus, activeText);
        refId = `REP-ID001-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const details = extractAiIncidentDetails(activeText, humanCategoryLabel);

      const newRecord = {
        id: Date.now(),
        report_number: refId,
        report_reference: refId,
        report_name: reportTitle,
        title: `${humanCategoryLabel}: ${locDisplay}`,
        description: activeText,
        category: humanCategoryLabel,
        report_type: humanCategoryLabel,
        location: operatingUnit,
        facility_unit: locDisplay,
        incidentLocation: incidentLocObj,
        incident_latitude: incidentLocObj.latitude,
        incident_longitude: incidentLocObj.longitude,
        incident_address: incidentLocObj.address,
        reported_by: currentUser?.full_name || 'Liam Vance (Field Worker)',
        severity: isSIF ? 'CRITICAL' : 'MEDIUM',
        risk_level: isSIF ? 'Critical' : 'Low',
        sif_precursor_assessment: isSIF ? 'YES' : 'NO',
        status: isSIF ? 'Action Required' : 'Under Review',
        is_sif: isSIF,
        risk_score: dynamicRiskScore,
        ai_score: dynamicRiskScore,
        energy_vector: energyVector,
        energy_source: energyVector,
        life_saving_rule: lifeSavingRule,
        barrier_status: barrierStatus,
        recommended_action: details.recommendedAction || recommendedAction,
        recommended_controls: (backendResult && backendResult.recommended_controls && Array.isArray(backendResult.recommended_controls) && backendResult.recommended_controls.length > 0)
          ? backendResult.recommended_controls
          : getDynamicRecommendations(humanCategoryLabel, activeText),
        reasoning: reasoning,
        assigned_department: details.dept,
        assigned_department_label: details.deptLabel,
        safety_factors: selectedChecklist,
        photo_attached: photoAttached,
        created_at: new Date().toISOString()
      };

      // 1. Persist to backend database
      try {
        await api.createReport({
          title: newRecord.title,
          description: newRecord.description,
          category: humanCategoryLabel,
          facility_id: operatingUnit === 'Unit 1' ? 1 : operatingUnit === 'Unit 2' ? 2 : operatingUnit === 'Unit 3' ? 3 : 4,
          location: locDisplay,
          reported_by: newRecord.reported_by,
          severity: newRecord.severity,
          source: 'MOBILE_APP',
          status: 'ANALYZED'
        });
      } catch (err) {
        console.warn('API fallback:', err);
      }

      // 2. Persist to central safety records (SAFETY_TOTAL_REPORTS_V3) and local storage
      autoPersistToTotalRecords([newRecord]);
      try {
        const stored = JSON.parse(localStorage.getItem('safetyai_active_reports') || '[]');
        localStorage.setItem('safetyai_active_reports', JSON.stringify([newRecord, ...stored]));
      } catch (e) {}
      setReportedIncidents(prev => [newRecord, ...prev]);

      // 3. Increment Analytics Overview metrics and sync with backend
      setAnalyticsOverview(prev => ({
        ...prev,
        totalIncidents: prev.totalIncidents + 1,
        pending: prev.pending + 1,
        sif: isSIF ? prev.sif + 1 : prev.sif,
        nonSif: isSIF ? prev.nonSif : prev.nonSif + 1
      }));
      fetchAnalyticsData();

      // 4. Dispatch a real response task into active tasks radar
      const newTask = {
        id: Date.now(),
        title: `Response: ${lifeSavingRule}`,
        description: `${activeText.slice(0, 80)}... — Action: ${recommendedAction}`,
        department: details.dept,
        priority: isSIF ? 'CRITICAL' : 'HIGH',
        status: 'ASSIGNED',
        claimed_by: null,
        created_at: 'Just now',
        location: locDisplay
      };
      setTasks(prev => [newTask, ...prev]);

      // 5. Update latest alert
      setLatestAlert({
        title: `${humanCategoryLabel} Analyzed (${isSIF ? 'High SIF Precursor' : 'Standard Observation'})`,
        subtitle: `${activeText.slice(0, 40)}...`,
        time: 'Just now',
        type: isSIF ? 'error' : 'warning'
      });

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      clearTimeout(step4Timer);

      // 6. Close reporting modal and open AI Analysis Results modal
      setShowReportModal(false);
      handleResetReportInput();
      setAiAnalysisModalData(newRecord);

    } catch (err) {
      alert('Error submitting report: ' + err.message);
    } finally {
      setIsSubmitting(false);
      setAnalysisStepText('');
    }
  };

  // Atomic Claim Task
  const handleClaimTask = async (taskId) => {
    try {
      await api.acceptResponseTask(taskId);
      setActionNotice({ type: 'success', text: `Task #${taskId} claimed exclusively!` });
      await fetchTasks();
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Already claimed by another responder.' });
    } finally {
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  // Submit Verification Work
  const handleSubmitVerification = async (taskId) => {
    if (!workNotes.trim()) {
      alert('Please enter work notes.');
      return;
    }
    try {
      await api.submitTaskVerification(taskId, {
        work_notes: workNotes,
        evidence_notes: 'Visual verification completed via mobile camera',
        evidence_file_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'
      });
      setActionNotice({ type: 'success', text: 'Submitted for Safety Officer verification!' });
      setSelectedTaskModal(null);
      setWorkNotes('');
      await fetchTasks();
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Submission failed.' });
    }
  };

  // Admin Approve / Rework
  const handleVerifyTask = async (taskId, decision) => {
    if (decision === 'REWORK' && !reworkReason.trim()) {
      alert('Please enter rework instructions.');
      return;
    }
    try {
      await api.verifyResponseTask(taskId, {
        decision: decision,
        rework_reason: reworkReason || null
      });
      setActionNotice({ 
        type: 'success', 
        text: decision === 'APPROVE' ? 'Task Approved & Closed!' : 'Rework requested.' 
      });
      setSelectedTaskModal(null);
      setShowReworkInput(false);
      setReworkReason('');
      await fetchTasks();
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Action failed.' });
    }
  };

  // SOS Countdown
  const triggerSos = () => {
    setSosCountdown(3);
    const interval = setInterval(() => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setSosDispatched(true);
          try {
            api.triggerEmergencySos({
              facility_id: 1,
              location: facilityLocation,
              sos_type: 'CRITICAL_LIFE_SAFETY_ALERT'
            });
          } catch (e) {}
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-800 flex flex-col items-center justify-start p-0 sm:py-6 font-sans select-none">
      
      {/* Top Desktop Controls */}
      <header className="hidden sm:flex w-full max-w-[410px] items-center justify-between pb-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SafetyPulse AI Mobile</span>
        </div>
        <button
          onClick={() => setIsPhoneFrame(!isPhoneFrame)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          <span>{isPhoneFrame ? 'Full Width' : 'Phone Frame'}</span>
        </button>
      </header>

      {/* MOBILE DEVICE SHELL */}
      <main className={`w-full ${isPhoneFrame ? 'sm:max-w-[400px] sm:rounded-[46px] sm:border-[9px] sm:border-slate-900 sm:shadow-2xl sm:shadow-slate-400/50' : 'max-w-xl sm:rounded-2xl'} min-h-screen sm:min-h-[820px] bg-[#F8FAFC] flex flex-col relative overflow-hidden transition-all duration-200`}>
        
        {/* ============================================================ */}
        {/* 1. WELCOME ONBOARDING SPLASH SCREEN (CLEAN WHITE AESTHETIC) */}
        {/* ============================================================ */}
        {screenMode === 'welcome' && (
          <div className="flex-1 bg-white text-slate-900 flex flex-col justify-between px-6 py-4 animate-fadeIn relative overflow-hidden">
            

            {/* HERO VISUAL CONTAINER (MALE & FEMALE SAFETY TEAM) */}
            <div className="my-auto py-1 flex flex-col items-center text-center z-10">
              
              <div className="relative w-full max-w-[280px] aspect-[4/4.2] rounded-3xl overflow-hidden shadow-md shadow-slate-200/60 border border-slate-100 group bg-white">
                <img 
                  src={safetyTeamWelcome} 
                  alt="Industrial Safety Team (Male and Female)" 
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Floating Safety Badge */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-100 shadow-sm flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-900 block leading-tight">Field Safety Team</span>
                      <span className="text-[9px] text-slate-500 font-medium">Ready for Response</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ONLINE
                  </span>
                </div>
              </div>

              {/* Title & Tagline */}
              <div className="mt-3.5 space-y-1">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                  SafetyPulse
                </h1>
              </div>

            </div>

            {/* BOTTOM ACTION BUTTONS */}
            <div className="space-y-2 z-10 pb-1">
              
              {/* PRIMARY CTA: GET STARTED (ROYAL BLUE PILL) */}
              <button
                onClick={() => {
                  setScreenMode('login');
                  setLoginStep(1);
                }}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Get Started / Sign In</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* 2. TWO-STEP LOGIN WORKFLOW (STEP 1: ROLE | STEP 2: AUTH)    */}
        {/* ============================================================ */}
        {screenMode === 'login' && (
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col justify-between animate-fadeIn custom-scrollbar">
            
            {loginStep === 1 ? (
              /* -------------------------------------------------------- */
              /* STEP 1: CHOOSE ROLE TYPE                                 */
              /* -------------------------------------------------------- */
              <div className="flex-1 flex flex-col justify-between space-y-4">
                
                <div className="space-y-3.5">
                  {/* Top Navigation & Back Button */}
                  <div className="flex items-center pt-1">
                    <button
                      onClick={() => setScreenMode('welcome')}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Welcome Screen</span>
                    </button>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Choose Login Type
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select your operational role to access your safety console
                    </p>
                  </div>

                  {/* THREE INTERACTIVE ROLE FIELD CARDS */}
                  <div className="space-y-2.5">
                    {LOGIN_ROLES.map(role => {
                      const isSelected = selectedRole === role.id;
                      return (
                        <div
                          key={role.id}
                          onClick={() => handleSelectRoleField(role.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 border-blue-600 shadow-sm ring-2 ring-blue-600/10'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{role.icon}</span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-slate-900">{role.title}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    {role.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                  {role.desc}
                                </p>
                              </div>
                            </div>

                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>

                          {/* If Responder selected: show 7 Department Chips including Ambulance */}
                          {isSelected && role.id === 'RESPONDER' && (
                            <div className="mt-3 pt-2.5 border-t border-blue-200/60 space-y-1.5 animate-fadeIn">
                              <label className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                                Select Your Department:
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {DEPARTMENTS.filter(d => d.id !== 'ALL').map(dept => (
                                  <button
                                    type="button"
                                    key={dept.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectResponderDept(dept.id);
                                    }}
                                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                      selectedResponderDept === dept.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span>{dept.icon}</span>
                                    <span>{dept.label.split(' ')[0]}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Continue to Step 2 Button (Bottom Anchored) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setLoginStep(2)}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Continue to Sign In</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

              </div>
            ) : (
              /* -------------------------------------------------------- */
              /* STEP 2: USERNAME & PASSWORD CREDENTIALS                  */
              /* -------------------------------------------------------- */
              <div className="flex-1 flex flex-col justify-between space-y-4">
                
                <div className="space-y-3.5">
                  {/* Top Navigation & Back Button to Step 1 */}
                  <div className="flex items-center pt-1">
                    <button
                      onClick={() => setLoginStep(1)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Change Role</span>
                    </button>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      Sign In
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter your credentials to access the safety console
                    </p>
                  </div>

                  {/* ACTIVE ROLE SUMMARY CARD */}
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {selectedRole === 'WORKER' 
                          ? '👷' 
                          : selectedRole === 'ADMIN' 
                            ? '🛡️' 
                            : (DEPARTMENTS.find(d => d.id === selectedResponderDept)?.icon || '🛠️')}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-blue-900 block leading-tight">
                          {selectedRole === 'WORKER' 
                            ? 'User / Field Worker' 
                            : selectedRole === 'ADMIN' 
                              ? 'Safety Officer (Admin)' 
                              : `Responder · ${DEPARTMENTS.find(d => d.id === selectedResponderDept)?.label || 'Team'}`}
                        </span>
                        <span className="text-[10px] text-blue-700 font-medium">
                          Selected Role
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginStep(1)}
                      className="px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      Switch
                    </button>
                  </div>

                  {/* USERNAME & PASSWORD INPUT FORM */}
                  <form onSubmit={handleLoginSubmit} className="space-y-3 pt-1">
                    
                    {loginError && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>Username / Email</span>
                      </label>
                      <input
                        type="text"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        <span>Password</span>
                      </label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter password"
                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                        required
                      />
                    </div>

                    {/* 1-Tap Quick Fill Demo Pill */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedRole === 'WORKER') {
                            setEmailInput('worker@safety.com');
                            setPasswordInput('worker123');
                          } else if (selectedRole === 'ADMIN') {
                            setEmailInput('admin@safety.com');
                            setPasswordInput('admin123');
                          } else {
                            const dept = DEPARTMENTS.find(d => d.id === selectedResponderDept);
                            setEmailInput(dept?.email || 'ambulance@safety.com');
                            setPasswordInput(dept?.pass || 'med123');
                          }
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>⚡ Quick autofill default credentials</span>
                      </button>
                    </div>

                  </form>

                </div>

                {/* Big Blue Sign In Button (Bottom Anchored) */}
                <div className="pt-2">
                  <button
                    onClick={handleLoginSubmit}
                    disabled={isLoggingIn}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isLoggingIn ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to SafetyPulse</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}



        {/* ============================================================ */}
        {/* 3. AUTHENTICATED MAIN APPLICATION WEBSITE (PRESENT WEBSITE) */}
        {/* ============================================================ */}
        {screenMode === 'app' && currentUser && (
          <>
            {/* TOP HEADER: USER GREETING & LOGOUT BUTTON */}
            <section aria-label="App Navigation Header" className="bg-white px-5 pt-3.5 pb-3 border-b border-slate-100 shrink-0 z-30 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                {/* Minimalist App Logo Button (1-Tap Navigates to Dashboard) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  title="Return to Dashboard"
                  aria-label="Return to Dashboard"
                  className="flex items-center gap-2 px-1 py-0.5 rounded-xl hover:bg-slate-100 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-600 transition-colors">
                    <Activity className="w-4 h-4 text-white stroke-[2.5]" />
                  </div>
                  <span className="text-base font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                    SafetyPulse
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setActiveTab('alerts')}
                    aria-label="View notifications"
                    className="relative p-2 rounded-full hover:bg-slate-50 transition-colors"
                  >
                    <Bell className="w-5 h-5 text-slate-700" />
                    {tasks.filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED').length > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                        {tasks.filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED').length}
                      </span>
                    )}
                  </button>

                  {/* Sign Out Button to return to Welcome */}
                  <button
                    onClick={handleLogout}
                    title="Sign Out to Welcome"
                    aria-label="Sign Out"
                    className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dynamic User Greeting */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                    Welcome, {currentUser?.full_name?.split(' ')[0] || 'User'}
                  </h1>
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <span>Safety First, Always</span>
                    <span className="text-emerald-500 text-[10px]">●</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                    {currentUser?.role === 'ADMIN' ? '🛡️ Admin' : currentUser?.role === 'RESPONDER' ? '🛠️ Responder' : '👷 Worker'}
                  </span>
                </div>
              </div>
            </section>

            {/* NOTIFICATION TOAST */}
            {actionNotice && (
              <div className={`mx-4 mt-2 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border shadow-sm z-50 animate-fadeIn ${
                actionNotice.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{actionNotice.text}</span>
              </div>
            )}

            {/* SCROLLABLE MAIN BODY */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-24 space-y-5 custom-scrollbar">

              {/* TAB: HOME */}
              {activeTab === 'home' && (
                <div className="space-y-5 animate-fadeIn">
                  

                  {/* ANALYTICS OVERVIEW (2x2 GRID) */}
                  <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Analytics Overview
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                      
                      {/* CARD 1: Total Incidents */}
                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {analyticsOverview.totalIncidents}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Total Incidents
                        </div>
                      </div>

                      {/* CARD 2: Pending */}
                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {analyticsOverview.pending}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Pending
                        </div>
                      </div>

                      {/* CARD 3: SIF */}
                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {analyticsOverview.sif}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          SIF
                        </div>
                      </div>

                      {/* CARD 4: Non-SIF */}
                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {analyticsOverview.nonSif}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Non-SIF
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* QUICK ACTIONS */}
                  <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Quick Actions
                    </h2>

                    <button
                      onClick={() => openReportWithCategory('Unsafe Condition')}
                      className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                      <span>Report Incident</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      <button
                        onClick={() => openReportWithCategory('Near Miss')}
                        className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs hover:shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                          <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Near Miss
                        </span>
                      </button>

                      <button
                        onClick={() => openReportWithCategory('Hazard')}
                        className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs hover:shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Hazard
                        </span>
                      </button>

                      <button
                        onClick={() => openReportWithCategory('Observation')}
                        className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs hover:shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                          <ShieldAlert className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Observation
                        </span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB: INCIDENTS (USER REPORTED INCIDENTS & SIF PRECURSORS) */}
              {activeTab === 'incidents' && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Reported Incidents</span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        AI Analyzed SIF Precursor Records ({reportedIncidents.length})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const stored = JSON.parse(localStorage.getItem('safetyai_active_reports') || '[]');
                          if (stored && Array.isArray(stored) && stored.length > 0) {
                            setReportedIncidents(stored);
                          }
                        } catch (e) {}
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs shadow-2xs cursor-pointer"
                      title="Refresh Records"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Role Switcher if Responder */}
                  {currentUser?.role === 'RESPONDER' && (
                    <div className="p-1 rounded-xl bg-slate-100 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIncidentsViewMode('REPORTS')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          incidentsViewMode === 'REPORTS' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        📋 Incident Reports
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncidentsViewMode('TASKS')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          incidentsViewMode === 'TASKS' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        ⚡ Response Tasks ({tasks.length})
                      </button>
                    </div>
                  )}

                  {/* INCIDENTS VIEW: REPORTED INCIDENTS */}
                  {incidentsViewMode === 'REPORTS' ? (
                    <>
                      {/* Filter Chips: All | High SIF | Controlled */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                        {[
                          { id: 'ALL', label: `All Reports (${reportedIncidents.length})` },
                          { id: 'SIF', label: `🚨 High SIF (${reportedIncidents.filter(r => r.is_sif).length})` },
                          { id: 'CONTROLLED', label: `✅ Controlled (${reportedIncidents.filter(r => !r.is_sif).length})` }
                        ].map(chip => (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setIncidentFilter(chip.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                              incidentFilter === chip.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      {/* Incident Cards Feed */}
                      <div className="space-y-3">
                        {reportedIncidents
                          .filter(r => {
                            if (incidentFilter === 'SIF') return r.is_sif;
                            if (incidentFilter === 'CONTROLLED') return !r.is_sif;
                            return true;
                          })
                          .map(report => (
                            <div
                              key={report.id || report.report_number}
                              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3 hover:shadow-sm transition-all"
                            >
                              {/* Top Row: Main Name & SIF Score */}
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                                      {report.category || report.report_type || 'Near Miss'}
                                    </span>
                                  </div>
                                  {/* Main Name */}
                                  <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                                    {report.title || report.report_name}
                                  </h3>
                                </div>

                                {/* SIF Score Circular Indicator */}
                                <div className="shrink-0 flex flex-col items-center pl-2">
                                  <div className="relative w-12 h-12 flex items-center justify-center">
                                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                                      {/* Background track */}
                                      <circle
                                        cx="18"
                                        cy="18"
                                        r="15"
                                        fill="none"
                                        className="stroke-slate-100"
                                        strokeWidth="3"
                                      />
                                      {/* Dynamic progress circle */}
                                      <circle
                                        cx="18"
                                        cy="18"
                                        r="15"
                                        fill="none"
                                        stroke={report.is_sif ? '#e11d48' : '#059669'}
                                        strokeWidth="3"
                                        strokeDasharray="94.2"
                                        strokeDashoffset={94.2 - (94.2 * Math.min(100, Math.max(0, report.risk_score || 75))) / 100}
                                        strokeLinecap="round"
                                        className="transition-all duration-500"
                                      />
                                    </svg>
                                    {/* Center score in circle */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                      <span className={`text-[12px] font-black font-mono leading-none ${
                                        report.is_sif ? 'text-rose-600' : 'text-emerald-700'
                                      }`}>
                                        {report.risk_score || 75}
                                      </span>
                                      <span className="text-[7px] font-bold text-slate-400 leading-none mt-0.5">
                                        /100
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full uppercase tracking-tight ${
                                    report.is_sif ? 'text-rose-700 bg-rose-50 border border-rose-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                  }`}>
                                    {report.is_sif ? 'High SIF' : 'Controlled'}
                                  </span>
                                </div>
                              </div>

                              {/* Location & Metadata Row */}
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                <div className="flex items-center gap-1 truncate font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="truncate">
                                    {report.incidentLocation?.address || report.facility_unit || report.location || 'Unit 1'}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                                  {report.created_at ? new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                                </span>
                              </div>

                              {/* Two Action Buttons: View Details & View Location */}
                              <div className="pt-1 grid grid-cols-2 gap-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => setAiAnalysisModalData(report)}
                                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                  <span>View Details</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setLocationViewIncident(report)}
                                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer transition-all"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                  <span>View Location</span>
                                </button>
                              </div>

                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    /* RESPONDER TASKS VIEW (when toggled by Responder role) */
                    <div className="space-y-3">
                      {tasks.map(task => {
                        const isClaimed = task.status === 'ACCEPTED' || task.status === 'SUBMITTED_FOR_VERIFICATION' || task.status === 'VERIFIED';
                        const isVerified = task.status === 'VERIFIED';
                        const isPending = task.status === 'SUBMITTED_FOR_VERIFICATION';

                        return (
                          <div
                            key={task.id}
                            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-2.5 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono font-bold text-blue-600">#{task.id}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                    {task.department.replace('_', ' ')}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    task.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </div>
                                <h3 className="text-xs font-bold text-slate-900 mt-1">{task.title}</h3>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                isVerified ? 'bg-emerald-50 text-emerald-700' :
                                isPending ? 'bg-purple-50 text-purple-700' :
                                isClaimed ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {task.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                            <div className="pt-1 flex items-center gap-2">
                              {task.status === 'ASSIGNED' && (
                                <button
                                  onClick={() => handleClaimTask(task.id)}
                                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Claim Task 🔒</span>
                                </button>
                              )}
                              {(task.status === 'ACCEPTED' || task.status === 'REWORK_REQUESTED') && (
                                <button
                                  onClick={() => setSelectedTaskModal(task)}
                                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Submit Evidence 📸</span>
                                </button>
                              )}
                              {isPending && (
                                <div className="w-full flex items-center gap-2">
                                  <button
                                    onClick={() => handleVerifyTask(task.id, 'APPROVE')}
                                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTaskModal(task);
                                      setShowReworkInput(true);
                                    }}
                                    className="flex-1 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs"
                                  >
                                    Request Rework
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {/* TAB: ALERTS (Department Action Notifications) */}
              {activeTab === 'alerts' && (
                <div className="space-y-4 animate-fadeIn">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                        Department Action Alerts
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Live acceptance & response updates from dispatched departments
                      </p>
                    </div>
                    {tasks.filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED').length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
                        {tasks.filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED').length} Accepted
                      </span>
                    )}
                  </div>

                  {tasks.filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED').length > 0 ? (
                    <div className="space-y-2.5">
                      {tasks
                        .filter(t => t.status === 'ACCEPTED' || t.status === 'VERIFIED')
                        .map(task => (
                          <div
                            key={task.id}
                            className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                                ✅ ACCEPTED BY {task.department || 'DISPATCH'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{task.created_at || 'Recently'}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-900">{task.title}</div>
                            <div className="text-[11px] text-slate-600 leading-relaxed">{task.description}</div>
                            {task.location && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-blue-500" />
                                <span>{task.location}</span>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    /* Clean Empty State as Responder Platform is Not Yet Integrated */
                    <div className="py-14 px-6 rounded-2xl bg-white border border-slate-100 shadow-2xs text-center space-y-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <Bell className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-800">No Department Alerts Yet</h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                          When emergency response departments (Ambulance, Mechanical, Electrical) accept and action your submitted reports, confirmation alerts will appear here.
                        </p>
                      </div>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                          <span>Awaiting Responder Platform Integration</span>
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB: MORE / PROFILE / SETTINGS */}
              {activeTab === 'more' && (
                <div className="space-y-4 animate-fadeIn">
                  
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base">
                        {currentUser?.full_name ? currentUser.full_name[0] : 'U'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{currentUser?.full_name}</h3>
                        <p className="text-xs text-slate-500">{currentUser?.email}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Role: {currentUser?.role_name || currentUser?.role}</p>
                      </div>
                    </div>
                  </div>

                  {/* LOGOUT & SWITCH ROLE BUTTON */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Account Operations
                    </span>
                    <button
                      onClick={handleLogout}
                      className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out to Welcome Screen</span>
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* REPORT INCIDENT MODAL (EXACT WEBSITE FEATURES + MODERN MOBILE DESIGN) */}
            {showReportModal && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs z-50 flex flex-col justify-end animate-fadeIn">
                <div className="bg-white rounded-t-[32px] p-5 space-y-4 max-h-[94%] overflow-y-auto custom-scrollbar shadow-2xl">
                  
                  {/* Top Bar: Title & Reset Button */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF5A36] flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#FF5A36]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                          <span>SAFETY OBSERVATION INPUT</span>
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Explainable neural analysis &amp; SIF precursor intelligence
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(descriptionInput || selectedChecklist.length > 0 || operatingUnit !== 'Unit 1') && (
                        <button
                          type="button"
                          onClick={handleResetReportInput}
                          className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF5A36] text-[10px] font-bold font-mono flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>RESET</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowReportModal(false)}
                        className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Validation Error Banner */}
                  {validationError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* 1. CLASSIFICATION TYPE / SIZE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        CLASSIFICATION TYPE / SIZE
                      </label>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {inputMode === 'CHECKLIST' && selectedChecklist.length > 0 && detectCategoryFromChecklist(selectedChecklist)
                          ? `Identified: ${detectCategoryFromChecklist(selectedChecklist).label}`
                          : 'SELECT CATEGORY MANUALLY'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'NEAR_MISS', label: 'NEAR MISS' },
                        { key: 'UNSAFE_ACT', label: 'UNSAFE ACT' },
                        { key: 'UNSAFE_CONDITION', label: 'UNSAFE CONDITION' }
                      ].map(t => {
                        const isActive = reportCategory === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => {
                              setReportCategory(t.key);
                              if (validationError) setValidationError('');
                            }}
                            className={`py-2.5 px-1.5 text-center rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer border ${
                              isActive
                                ? 'bg-gradient-to-r from-orange-500 via-[#FF5A36] to-amber-500 text-white border-orange-500 shadow-sm shadow-orange-500/20 scale-[1.02]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-orange-50/40 hover:border-orange-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. INCIDENT LOCATION & PLANT MAP */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>INCIDENT LOCATION & UNIT</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenMapClick}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3 h-3 text-blue-600" />
                        <span>{selectedIncidentLocation ? 'Change Pin on Map' : 'Select on Map'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].map(u => {
                        const isActive = operatingUnit === u;
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => {
                              setOperatingUnit(u);
                              setFacilityLocation(`${u} – Main Operations`);
                              if (selectedIncidentLocation) {
                                setSelectedIncidentLocation(prev => ({
                                  ...prev,
                                  unit: u
                                }));
                              }
                              if (validationError) setValidationError('');
                            }}
                            className={`py-2 text-center rounded-xl text-xs font-mono font-black uppercase transition-all cursor-pointer border ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {u}
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive Plant Map Location Card & Trigger */}
                    <div 
                      onClick={handleOpenMapClick}
                      className="p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          selectedIncidentLocation ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-black uppercase px-1.5 py-0.2 rounded bg-white border border-blue-200 text-blue-800">
                              {operatingUnit}
                            </span>
                            <span className="text-[11px] font-bold text-slate-900 truncate max-w-[170px]">
                              {selectedIncidentLocation?.name || facilityLocation}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1">
                            {selectedIncidentLocation?.address || 'Tap to pinpoint exact equipment coordinates on satellite map'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-2xs inline-flex items-center gap-1">
                          <span>{isRequestingLocation ? 'Locating...' : selectedIncidentLocation ? 'Edit Map' : 'Open Map'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. INPUT METHOD (MUTUALLY EXCLUSIVE) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        INPUT METHOD <span className="font-normal text-slate-400 normal-case">(Select ONE — dual input not allowed)</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {inputMode === 'DESCRIPTION' ? '✍️ Mode: Text Explanation' : '📋 Mode: Safety Checklists'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('DESCRIPTION');
                          setSelectedChecklist([]);
                          if (validationError) setValidationError('');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold font-mono tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          inputMode === 'DESCRIPTION'
                            ? 'bg-white text-slate-900 border-slate-300 shadow-xs'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FF5A36]" />
                        <span>1. Detailed Explanation</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('CHECKLIST');
                          setDescriptionInput('');
                          setSpokenTranscript('');
                          setTranslatedEnglish('');
                          if (validationError) setValidationError('');
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold font-mono tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                          inputMode === 'CHECKLIST'
                            ? 'bg-white text-slate-900 border-slate-300 shadow-xs'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                        }`}
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-[#FF5A36]" />
                        <span>2. Safety Checklists</span>
                        {selectedChecklist.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FF5A36] text-white">
                            {selectedChecklist.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 4A. MODE 1: DETAILED FIELD EXPLANATION */}
                  {inputMode === 'DESCRIPTION' && (
                    <div className="space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                          DETAILED FIELD EXPLANATION
                        </label>
                        <span className={`text-[11px] font-mono font-bold ${
                          descriptionInput.length >= 240 ? 'text-[#FF5A36]' : 'text-slate-500'
                        }`}>
                          {descriptionInput.length} / 250 CHARACTERS
                        </span>
                      </div>

                      <textarea
                        rows={4}
                        maxLength={250}
                        value={descriptionInput}
                        onChange={(e) => {
                          setDescriptionInput(e.target.value.slice(0, 250));
                          if (validationError) setValidationError('');
                        }}
                        className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 leading-relaxed focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 transition-all"
                        placeholder="Describe safety incident in detail..."
                      />

                      {/* Live Indic Detection & Instant Translation Chip */}
                      {descriptionInput && /[\u0c00-\u0c7f\u0900-\u097f]/.test(descriptionInput) && (
                        <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-[11px] text-orange-950 font-medium flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>
                              <strong>{/[\u0c00-\u0c7f]/.test(descriptionInput) ? 'Telugu (తెలుగు)' : 'Hindi (हिंदी)'}</strong> safety report detected
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await api.translateVoice({
                                  audio_text: descriptionInput,
                                  source_language: /[\u0c00-\u0c7f]/.test(descriptionInput) ? 'te' : 'hi',
                                  target_language: 'en'
                                });
                                if (res?.translated_text) {
                                  setDescriptionInput(res.translated_text);
                                }
                              } catch (e) {}
                            }}
                            className="px-2 py-0.5 rounded-lg bg-orange-500 text-white font-mono font-bold text-[10px] cursor-pointer"
                          >
                            Translate Now →
                          </button>
                        </div>
                      )}





                    </div>
                  )}

                  {/* 4B. MODE 2: STRUCTURED SAFETY CHECKLISTS */}
                  {inputMode === 'CHECKLIST' && (
                    <div className="space-y-3 animate-fadeIn">
                      {/* Description Locked Notice */}
                      <div className="p-2.5 rounded-xl bg-slate-100 border border-dashed border-slate-300 text-[11px] font-mono text-slate-600 flex items-center justify-between">
                        <span>✍️ Field description disabled ({selectedChecklist.length} selected).</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInputMode('DESCRIPTION');
                            setSelectedChecklist([]);
                          }}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          Switch to Explanation
                        </button>
                      </div>

                      {/* Checklist Search & Filter Tabs */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={checklistSearch}
                            onChange={(e) => setChecklistSearch(e.target.value)}
                            placeholder="Search factors (e.g., fall, gas, loto)..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                          />
                        </div>

                        {/* Category filter tabs */}
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                          {[
                            { id: 'ALL', label: 'All', count: ALL_CHECKLIST_ITEMS.length },
                            { id: 'NEAR_MISS', label: 'Near Miss', count: CLASSIFICATION_CHECKLISTS.NEAR_MISS.length },
                            { id: 'UNSAFE_ACT', label: 'Unsafe Act', count: CLASSIFICATION_CHECKLISTS.UNSAFE_ACT.length },
                            { id: 'UNSAFE_CONDITION', label: 'Condition', count: CLASSIFICATION_CHECKLISTS.UNSAFE_CONDITION.length }
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setChecklistCategoryFilter(tab.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all whitespace-nowrap border ${
                                checklistCategoryFilter === tab.id
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {tab.label} ({tab.count})
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Checklist Options Chips */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200 custom-scrollbar">
                        {ALL_CHECKLIST_ITEMS
                          .filter(item => checklistCategoryFilter === 'ALL' || item.category === checklistCategoryFilter)
                          .filter(item => {
                            if (!checklistSearch.trim()) return true;
                            const q = checklistSearch.toLowerCase();
                            return item.label.toLowerCase().includes(q) || (item.keywords && item.keywords.some(k => k.includes(q)));
                          })
                          .map(item => {
                            const isChecked = selectedChecklist.includes(item.label);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleChecklistItem(item.label)}
                                className={`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                    isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && '✓'}
                                  </div>
                                  <span>{item.label}</span>
                                </div>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                  item.category === 'NEAR_MISS' ? 'bg-orange-100 text-orange-700' :
                                  item.category === 'UNSAFE_ACT' ? 'bg-purple-100 text-purple-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {item.categoryLabel}
                                </span>
                              </button>
                            );
                          })}
                      </div>

                      {selectedChecklist.length > 0 && (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-[11px] font-bold text-slate-600">
                            {selectedChecklist.length} factors selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedChecklist([])}
                            className="text-[11px] text-[#FF5A36] font-bold underline"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. SUBMIT & RUN AI ANALYSIS BUTTON */}
                  <div className="pt-2">
                    <button
                      onClick={handleSaveReport}
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="truncate">{analysisStepText || 'Analyzing SIF Precursors & Storing...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Run AI Analysis &amp; Store Record</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* FULL AI SIF ANALYSIS RESULT MODAL */}
            {aiAnalysisModalData && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs z-50 flex flex-col justify-end animate-fadeIn">
                <div className="bg-white rounded-t-[32px] p-5 space-y-3.5 max-h-[92%] overflow-y-auto custom-scrollbar shadow-2xl">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
                        <Sparkles className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase block">
                          AI Precursor Intelligence
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          Analysis & Triage Report
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setAiAnalysisModalData(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* SIF Status Banner */}
                  <div className={`p-4 rounded-2xl border ${
                    aiAnalysisModalData.is_sif 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full ${
                        aiAnalysisModalData.is_sif ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                      }`}>
                        {aiAnalysisModalData.is_sif ? '🚨 CRITICAL SIF PRECURSOR DETECTED' : '✅ CONTROLLED HAZARD'}
                      </span>
                      {/* Score in Circle */}
                      <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" className="stroke-black/10" strokeWidth="3" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke={aiAnalysisModalData.is_sif ? '#e11d48' : '#059669'}
                            strokeWidth="3"
                            strokeDasharray="94.2"
                            strokeDashoffset={94.2 - (94.2 * Math.min(100, Math.max(0, aiAnalysisModalData.risk_score || 75))) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[11px] font-black font-mono leading-none">
                            {aiAnalysisModalData.risk_score || 75}
                          </span>
                          <span className="text-[6.5px] font-bold opacity-60 leading-none mt-0.5">
                            /100
                          </span>
                        </div>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {aiAnalysisModalData.title}
                    </h4>
                    {aiAnalysisModalData.description && (
                      <div className="mt-2.5 p-3 rounded-xl bg-white/90 border border-slate-200/80 text-xs text-slate-700 leading-relaxed shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Reported Incident Description
                        </span>
                        <p className="italic font-medium text-slate-800 whitespace-pre-wrap">
                          "{aiAnalysisModalData.description}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* AI Breakdown Cards */}
                  <div className="space-y-2 text-xs">
                    
                    {/* Energy Vector */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" /> Detected Energy Vector
                      </span>
                      <p className="font-bold text-slate-800">{aiAnalysisModalData.energy_vector}</p>
                    </div>

                    {/* Life-Saving Rule */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-500" /> IOGP Life-Saving Rule
                      </span>
                      <p className="font-bold text-slate-800">{aiAnalysisModalData.life_saving_rule}</p>
                    </div>

                    {/* AI Precursor Reasoning & Barrier Status */}
                    {(aiAnalysisModalData.reasoning || aiAnalysisModalData.barrier_status) && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500" /> AI Precursor Reasoning
                          </span>
                          {aiAnalysisModalData.barrier_status && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                              aiAnalysisModalData.is_sif ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {aiAnalysisModalData.barrier_status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-700 leading-relaxed">
                          {aiAnalysisModalData.reasoning || 'System identified precursor pattern requiring immediate barrier audit.'}
                        </p>
                      </div>
                    )}

                    {/* How to Overcome: Critical Controls (Matching Website AI Output) */}
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 font-mono">
                          HOW TO OVERCOME: CRITICAL CONTROLS
                        </span>
                      </div>
                      <ul className="space-y-1.5 pt-0.5">
                        {((Array.isArray(aiAnalysisModalData.recommended_controls) && aiAnalysisModalData.recommended_controls.length > 0)
                          ? aiAnalysisModalData.recommended_controls
                          : getDynamicRecommendations(aiAnalysisModalData.category, aiAnalysisModalData.description || '')
                        ).map((ctrl, i) => (
                          <li key={i} className="text-xs text-slate-800 font-medium flex items-start gap-2">
                            <span className="text-emerald-600 font-black mt-0.5 text-sm leading-none">&bull;</span>
                            <span className="leading-snug">{ctrl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Emergency Responder Protocol & Dispatched Team */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1 font-mono">
                          <Radio className="w-3 h-3 text-amber-600" /> Responder Protocol &amp; Dispatch
                        </span>
                        <span className="text-[9px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full font-mono">
                          {aiAnalysisModalData.assigned_department_label || 'DISPATCHED'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200/60">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Responder Action ({aiAnalysisModalData.assigned_department_label}):
                        </span>
                        <p className="font-semibold text-slate-900 leading-relaxed text-xs">
                          {aiAnalysisModalData.recommended_action}
                        </p>
                      </div>
                    </div>



                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-2">
                    <button
                      onClick={() => setAiAnalysisModalData(null)}
                      className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-800 font-bold text-xs cursor-pointer transition-all"
                    >
                      Done / Return to Dashboard
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* INCIDENT MAP LOCATION MODAL */}
            {locationViewIncident && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs z-50 flex flex-col justify-end animate-fadeIn">
                <div className="bg-white rounded-t-[32px] p-5 space-y-3.5 max-h-[92%] overflow-y-auto custom-scrollbar shadow-2xl">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase block">
                          Incident Map Location
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {locationViewIncident.title || locationViewIncident.report_name}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocationViewIncident(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Location Info Banner */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Facility Unit & Address
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {locationViewIncident.incidentLocation?.address || locationViewIncident.facility_unit || locationViewIncident.location}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        locationViewIncident.is_sif ? 'bg-rose-100 text-rose-700 font-mono' : 'bg-emerald-100 text-emerald-700 font-mono'
                      }`}>
                        SIF: {locationViewIncident.risk_score || 75}/100
                      </span>
                    </div>
                  </div>

                  {/* Plant Site Map & Sector Pin */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" /> Interactive Site Location & Exclusion Zone
                    </span>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                      <IncidentPostAnalysisMap
                        incidentLocation={locationViewIncident.incidentLocation || {
                          latitude: locationViewIncident.incident_latitude || 12.9716,
                          longitude: locationViewIncident.incident_longitude || 77.5946,
                          name: locationViewIncident.facility_unit || locationViewIncident.location || 'Unit 1',
                          address: locationViewIncident.incident_address || locationViewIncident.facility_unit || locationViewIncident.location || 'Unit 1'
                        }}
                        riskScore={locationViewIncident.risk_score || 75}
                        riskLevel={locationViewIncident.is_sif ? 'High Risk' : 'Medium Risk'}
                        incidentType={locationViewIncident.category || locationViewIncident.report_type || 'Near Miss'}
                        reportName={locationViewIncident.title || locationViewIncident.report_name}
                      />
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const inc = locationViewIncident;
                        setLocationViewIncident(null);
                        setAiAnalysisModalData(inc);
                      }}
                      className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>View Full AI Analysis Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationViewIncident(null)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Close Map View
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* SUBMIT EVIDENCE / REWORK MODAL DRAWER */}
            {selectedTaskModal && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex flex-col justify-end animate-fadeIn">
                <div className="bg-white rounded-t-[32px] p-5 space-y-3.5 max-h-[90%] overflow-y-auto custom-scrollbar shadow-2xl">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-blue-600">Task #{selectedTaskModal.id}</span>
                      <h3 className="text-xs font-bold text-slate-900">{selectedTaskModal.title}</h3>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTaskModal(null);
                        setShowReworkInput(false);
                      }}
                      className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Task Map Location Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" /> Incident Location & Plant Sector
                    </span>
                    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                      <IncidentPostAnalysisMap
                        incidentLocation={selectedTaskModal.incidentLocation || {
                          latitude: selectedTaskModal.department === 'ELECTRICAL' ? 12.9730 : selectedTaskModal.department === 'FIRE_SAFETY' ? 12.9716 : 12.9700,
                          longitude: selectedTaskModal.department === 'ELECTRICAL' ? 77.5960 : selectedTaskModal.department === 'FIRE_SAFETY' ? 77.5946 : 77.5930,
                          name: selectedTaskModal.location || selectedTaskModal.department || 'Plant Sector',
                          address: selectedTaskModal.location || `${selectedTaskModal.department} Operational Bay`
                        }}
                        riskScore={selectedTaskModal.priority === 'CRITICAL' ? 88 : 45}
                        riskLevel={selectedTaskModal.priority === 'CRITICAL' ? 'High Risk' : 'Medium Risk'}
                        incidentType="Dispatched Response"
                        reportName={selectedTaskModal.title}
                      />
                    </div>
                  </div>

                  {showReworkInput ? (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-rose-600">
                        Rework Feedback Instructions (Required):
                      </label>
                      <textarea
                        value={reworkReason}
                        onChange={(e) => setReworkReason(e.target.value)}
                        placeholder="Specify why work was rejected..."
                        rows={3}
                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        onClick={() => handleVerifyTask(selectedTaskModal.id, 'REWORK')}
                        className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
                      >
                        Confirm Rework Request
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Corrective Action Notes *
                        </label>
                        <textarea
                          value={workNotes}
                          onChange={(e) => setWorkNotes(e.target.value)}
                          placeholder="Describe what was repaired or isolated..."
                          rows={3}
                          className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <button
                        onClick={() => handleSubmitVerification(selectedTaskModal.id)}
                        className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs"
                      >
                        Submit for Verification Sign-Off
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* 6. VOICE BASED SEARCH & INTELLIGENCE MODAL */}
            {showVoiceSearchModal && (
              <div className="fixed inset-0 sm:absolute bg-black/60 backdrop-blur-xs z-50 flex flex-col justify-end sm:justify-center p-0 sm:p-3 animate-fadeIn">
                <div className="bg-white rounded-t-[32px] sm:rounded-3xl max-h-[92vh] sm:max-h-[720px] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-slideUp">
                  
                  {/* Top Sheet Grab Handle & Header */}
                  <div className="p-4 pb-2 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/30">
                        <Mic className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                          Voice Safety Search
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[9px] font-mono font-bold">AI</span>
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Speak in Telugu, Hindi, or English to search incidents & hazards
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={closeVoiceSearchModal}
                      className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
                      aria-label="Close Voice Search"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    
                    {/* Multilingual Selector & Noise Filter */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'en', label: 'English' },
                          { id: 'te', label: 'తెలుగు' },
                          { id: 'hi', label: 'हिंदी' }
                        ].map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              setVoiceSearchLang(l.id);
                              if (isVoiceSearching) {
                                stopVoiceSearch();
                                setTimeout(() => startVoiceSearch(l.id), 200);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              voiceSearchLang === l.id
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setVoiceSearchNoiseFilter(!voiceSearchNoiseFilter)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          voiceSearchNoiseFilter ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {voiceSearchNoiseFilter ? 'Noise Filter ON' : 'Raw Audio'}
                      </button>
                    </div>

                    {/* Microphone Visualizer & Tap Control */}
                    <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50/70 to-indigo-50/40 border border-blue-100/80 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                      
                      {/* Pulse rings when listening */}
                      <div className="relative flex items-center justify-center">
                        {isVoiceSearching && (
                          <>
                            <span className="absolute w-24 h-24 rounded-full bg-blue-500/20 animate-ping" />
                            <span className="absolute w-20 h-20 rounded-full bg-blue-500/30 animate-pulse" />
                          </>
                        )}
                        <button
                          type="button"
                          onClick={toggleVoiceSearch}
                          className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                            isVoiceSearching
                              ? 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-200 shadow-rose-500/30'
                              : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/30'
                          }`}
                        >
                          {isVoiceSearching ? (
                            <MicOff className="w-7 h-7 animate-pulse" />
                          ) : (
                            <Mic className="w-7 h-7" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 block">
                          {isVoiceSearching ? `Listening actively (${voiceSearchSeconds}s)...` : 'Tap Microphone to Speak'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {isVoiceSearching
                            ? 'Say keywords like "Gas leak Unit 1", "Pipeline pressure", or "Fire outbreak"'
                            : 'Supports Telugu, Hindi, & English voice input'}
                        </span>
                      </div>

                      {/* Live Waveform Bar Animation */}
                      {isVoiceSearching && (
                        <div className="flex items-center gap-1 h-4 pt-1">
                          {[35, 75, 45, 90, 60, 80, 50, 95, 40, 70].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                              className="w-1 bg-blue-600 rounded-full animate-bounce"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Search Input Box (Editable) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Recognized Query / Search Text:</span>
                        {voiceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setVoiceSearchQuery('')}
                            className="text-slate-400 hover:text-slate-600 text-[10px]"
                          >
                            Clear
                          </button>
                        )}
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={voiceSearchQuery}
                          onChange={(e) => setVoiceSearchQuery(e.target.value)}
                          placeholder="Spoken words appear here, or type search..."
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Quick Action: If observation text is present, offer to file report or analyze */}
                    {voiceSearchQuery.trim().length > 3 && (
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block">
                            Found a new hazard?
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            Log this spoken observation directly to safety records
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReportFromVoiceSearch(voiceSearchQuery)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Report Observation</span>
                        </button>
                      </div>
                    )}

                    {/* Results Count & Badges */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Matching Incidents & Tasks ({searchResults.tasks.length})</span>
                        {voiceSearchQuery && (
                          <span className="text-[10px] font-normal text-slate-500">
                            Filtering by "{voiceSearchQuery}"
                          </span>
                        )}
                      </div>

                      {searchResults.tasks.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          {voiceSearchQuery
                            ? `No active incident tasks found matching "${voiceSearchQuery}".`
                            : 'Speak or type above to find incidents.'}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                          {searchResults.tasks.map(task => (
                            <div
                              key={task.id}
                              onClick={() => {
                                closeVoiceSearchModal();
                                setSelectedTaskModal(task);
                              }}
                              className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex items-start justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold text-blue-600">
                                    #{task.id}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[9px] font-bold text-slate-600 uppercase">
                                    {task.department.replace('_', ' ')}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    task.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                  {task.title}
                                </h4>
                                <p className="text-[11px] text-slate-500 line-clamp-1">
                                  {task.description}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Matched Checklist Items */}
                    {searchResults.checklists && searchResults.checklists.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-slate-800 block">
                          Related Safety Factors ({searchResults.checklists.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {searchResults.checklists.slice(0, 6).map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                closeVoiceSearchModal();
                                openReportWithCategory(item.categoryLabel);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${item.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                            >
                              {item.label} →
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Footer Close */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      SafetyPulse Voice Engine v2.4
                    </span>
                    <button
                      type="button"
                      onClick={closeVoiceSearchModal}
                      className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* 7. INCIDENT LOCATION SELECTION MODAL (MAP PICKER) */}
            <IncidentLocationModal
              isOpen={showMapModal}
              onClose={() => setShowMapModal(false)}
              initialLocation={selectedIncidentLocation}
              userLocation={userLocation}
              selectedUnit={operatingUnit}
              onConfirm={handleConfirmLocation}
              isMobile={true}
            />

            {/* BOTTOM NAVIGATION BAR: DOCKED WHITE BAR WITH CENTER VOICE SEARCH BUTTON */}
            <nav aria-label="Main Navigation" className="h-18 bg-white border-t border-slate-100 px-4 flex items-center justify-between sticky bottom-0 z-40 shadow-lg shadow-slate-200/50">
              
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  activeTab === 'home' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Home className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[10px] mt-1 font-medium">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('incidents')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  activeTab === 'incidents' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[10px] mt-1 font-medium">Incidents</span>
              </button>

              {/* CENTER FLOATING VOICE SEARCH BUTTON (REPLACED '+' SYMBOL) */}
              <div className="flex flex-col items-center justify-center flex-1 -mt-5">
                <button
                  onClick={openVoiceSearchModal}
                  aria-label="Voice Based Search"
                  title="Voice Safety Search"
                  className="w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 transition-all border-4 border-white relative group cursor-pointer"
                >
                  <Mic className="w-6 h-6 stroke-[2.3] group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </button>
                <span className="text-[9px] font-bold text-blue-700 mt-0.5 tracking-tight">Voice Search</span>
              </div>

              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  activeTab === 'alerts' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Bell className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[10px] mt-1 font-medium">Alerts</span>
              </button>

              <button
                onClick={() => setActiveTab('more')}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  activeTab === 'more' ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <User className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[10px] mt-1 font-medium">Profile</span>
              </button>

            </nav>

          </>
        )}

      </main>

    </div>
  );
}
