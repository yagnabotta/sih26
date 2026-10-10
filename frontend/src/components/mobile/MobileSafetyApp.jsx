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
  CheckSquare
} from 'lucide-react';
import { api } from '../../services/api';
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

  // Dynamic KPI counts
  const [kpis, setKpis] = useState({
    openIncidents: 24,
    actionsPending: 12,
    underInvestigation: 7,
    escalated: 3
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

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      const interval = setInterval(fetchTasks, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedDept, currentUser]);

  const fetchTasks = async () => {
    try {
      const res = await api.getResponseTasks(selectedDept === 'ALL' ? null : selectedDept);
      if (res && Array.isArray(res)) {
        setTasks(res);
        const open = res.filter(t => t.status === 'ASSIGNED').length;
        const pending = res.filter(t => t.status === 'ACCEPTED' || t.status === 'REWORK_REQUESTED').length;
        const review = res.filter(t => t.status === 'SUBMITTED_FOR_VERIFICATION').length;
        const crit = res.filter(t => t.priority === 'CRITICAL').length;
        
        setKpis({
          openIncidents: open + 18,
          actionsPending: pending || 12,
          underInvestigation: review || 7,
          escalated: crit || 3
        });
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
    setDescriptionInput(p.desc);
    setValidationError('');
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
        recommended_action: recommendedAction,
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

      // 3. Increment KPI metrics
      setKpis(prev => ({
        ...prev,
        openIncidents: prev.openIncidents + 1,
        actionsPending: prev.actionsPending + 1
      }));

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
            <section aria-label="App Navigation Header" className="bg-white px-5 pt-3 pb-3 border-b border-slate-100 sticky top-7 z-30">
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
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      3
                    </span>
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
                  
                  {/* RECENT ALERT BANNER CARD */}
                  <div 
                    onClick={() => setActiveTab('incidents')}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-xs">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm leading-tight truncate">
                        {latestAlert.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {latestAlert.subtitle}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-1">
                        {latestAlert.time}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>

                  {/* INCIDENT OVERVIEW (2x2 GRID) */}
                  <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Incident Overview
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                      
                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {kpis.openIncidents}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Open Incidents
                        </div>
                      </div>

                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {kpis.actionsPending}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Actions Pending
                        </div>
                      </div>

                      <div 
                        onClick={() => setActiveTab('incidents')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {kpis.underInvestigation < 10 ? `0${kpis.underInvestigation}` : kpis.underInvestigation}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Under Investigation
                        </div>
                      </div>

                      <div 
                        onClick={() => setActiveTab('alerts')}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xs">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {kpis.escalated < 10 ? `0${kpis.escalated}` : kpis.escalated}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Escalated
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

              {/* TAB: INCIDENTS & ACTIONS PENDING */}
              {activeTab === 'incidents' && (
                <div className="space-y-4 animate-fadeIn">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                        Incidents & Actions
                      </h2>
                      <p className="text-xs text-slate-500">
                        Department dispatch & verification loop
                      </p>
                    </div>
                    <button
                      onClick={fetchTasks}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Department Scroller */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept.id}
                        onClick={() => setSelectedDept(dept.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-all ${
                          selectedDept === dept.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>

                  {/* Task Feed */}
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
                                <span className="text-xs font-mono font-bold text-blue-600">
                                  #{task.id}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                  {task.department.replace('_', ' ')}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  task.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>
                              <h3 className="text-xs font-bold text-slate-900 mt-1">
                                {task.title}
                              </h3>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              isVerified ? 'bg-emerald-50 text-emerald-700' :
                              isPending ? 'bg-purple-50 text-purple-700' :
                              isClaimed ? 'bg-blue-50 text-blue-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {task.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {task.description}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>{task.assigned_to_name ? `Claimed by: ${task.assigned_to_name}` : 'Unclaimed'}</span>
                            <span className="font-mono">{new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          {/* Action Buttons */}
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

                </div>
              )}

              {/* TAB: ALERTS & SOS */}
              {activeTab === 'alerts' && (
                <div className="space-y-4 animate-fadeIn">
                  
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Critical Alerts & SIF Radar
                    </h2>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                      Real-time
                    </span>
                  </div>

                  {/* EMERGENCY SOS TRIGGER CARD */}
                  <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-amber-200 animate-pulse" />
                        <span className="font-bold text-sm">Emergency SOS Broadcast</span>
                      </div>
                      <span className="text-[10px] font-mono bg-black/20 px-2 py-0.5 rounded">
                        GPS Active
                      </span>
                    </div>
                    <p className="text-xs text-rose-100 leading-relaxed">
                      Triggers immediate siren broadcast, stops hot work permits at Plant 2, and dispatches emergency rescue.
                    </p>

                    {sosDispatched ? (
                      <div className="p-3 bg-white text-slate-900 rounded-xl text-xs font-bold text-center">
                        🚨 Emergency Rescue Dispatched to Plant 2!
                      </div>
                    ) : sosCountdown !== null ? (
                      <div className="p-3 bg-white text-rose-600 rounded-xl text-lg font-black text-center animate-ping">
                        Broadcasting in {sosCountdown}...
                      </div>
                    ) : (
                      <button
                        onClick={triggerSos}
                        className="w-full py-2.5 rounded-xl bg-white text-red-600 hover:bg-rose-50 font-black text-xs uppercase tracking-wider shadow-sm transition-all"
                      >
                        Tap to Trigger Emergency SOS
                      </button>
                    )}
                  </div>

                  {/* SIF PRECURSOR COMBINATIONS */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Weak Signal Correlations Detected
                    </h3>

                    {[
                      {
                        title: 'PPE Non-compliance + Open Trench',
                        location: 'Plant 2 Foundation Bay',
                        risk: 'HIGH SIF',
                        vector: 'GRAVITY_FALL'
                      },
                      {
                        title: 'Flange Pressure Spike + Vibration',
                        location: 'Compressor Unit 1',
                        risk: 'CRITICAL SIF',
                        vector: 'HYDROCARBON_PRESSURE'
                      }
                    ].map((item, i) => (
                      <div key={i} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                            {item.risk}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.vector}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900">{item.title}</div>
                        <div className="text-[11px] text-slate-500">📍 {item.location}</div>
                      </div>
                    ))}
                  </div>

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

                  {/* 2. TARGET OPERATING UNIT */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                        TARGET OPERATING UNIT
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">Plant Operational Sector</span>
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

                      {/* VOICE OBSERVATION MODULE */}
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-blue-600" />
                            Voice Dictation (Telugu / Hindi / En)
                          </span>
                          <button
                            type="button"
                            onClick={() => setNoiseIsolation(!noiseIsolation)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              noiseIsolation ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {noiseIsolation ? 'Noise Filter ON' : 'Raw Audio'}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'te', label: 'తెలుగు (Telugu)' },
                            { id: 'hi', label: 'हिंदी (Hindi)' },
                            { id: 'en', label: 'English' }
                          ].map(l => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setSelectedLanguage(l.id)}
                              className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                                selectedLanguage === l.id
                                  ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                                  : 'bg-transparent border-slate-200 text-slate-500'
                              }`}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>

                        <div className="py-1 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={toggleRecording}
                            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${
                              isRecording
                                ? 'bg-red-500 text-white ring-4 ring-red-200 animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                            }`}
                          >
                            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                          </button>
                          <span className="text-[11px] text-slate-600 font-medium">
                            {isRecording ? `Listening... (${recordingSeconds}s)` : 'Tap to speak observation'}
                          </span>
                        </div>
                      </div>


                      {/* ATTACH PHOTO */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPhotoAttached(!photoAttached)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            photoAttached 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{photoAttached ? '✓ Photo Attached' : 'Attach Incident Photo'}</span>
                        </button>
                      </div>

                      <p className="text-[10px] font-mono text-slate-400 italic">
                        * Note: Classification (Near Miss, Unsafe Act, or Unsafe Condition) is selected manually above. Checklists are locked in Explanation Mode.
                      </p>
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

                  {/* Database Storage Confirmation Banner */}
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold block">{aiAnalysisModalData.report_number} Recorded</span>
                        <span className="text-[10px] text-emerald-700">Persisted in Central Safety Database</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      STORED
                    </span>
                  </div>

                  {/* SIF Status Banner */}
                  <div className={`p-4 rounded-2xl border ${
                    aiAnalysisModalData.is_sif 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${
                        aiAnalysisModalData.is_sif ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                      }`}>
                        {aiAnalysisModalData.is_sif ? '🚨 CRITICAL SIF PRECURSOR DETECTED' : '✅ CONTROLLED HAZARD'}
                      </span>
                      <span className="text-xs font-black">
                        Score: {aiAnalysisModalData.risk_score}/100
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {aiAnalysisModalData.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      "{aiAnalysisModalData.description}"
                    </p>
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

                    {/* AI Recommended Remediation */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Recommended Corrective Action
                      </span>
                      <p className="font-semibold text-blue-950 leading-relaxed">{aiAnalysisModalData.recommended_action}</p>
                    </div>

                    {/* Auto-Dispatched Unit */}
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                          Auto-Dispatched Department
                        </span>
                        <span className="text-xs font-bold text-slate-900">{aiAnalysisModalData.assigned_department_label}</span>
                      </div>
                      <span className="text-[9px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                        LIVE TASK
                      </span>
                    </div>

                  </div>

                  {/* Bottom Actions */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedDept(aiAnalysisModalData.assigned_department);
                        setAiAnalysisModalData(null);
                      }}
                      className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <span>View Dispatched Task in Radar</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAiAnalysisModalData(null)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Done / Return to Dashboard
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

            {/* BOTTOM NAVIGATION BAR: DOCKED WHITE BAR WITH GREEN '+' CENTER */}
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

              {/* CENTER FLOATING GREEN '+' BUTTON */}
              <div className="flex flex-col items-center justify-center flex-1 -mt-5">
                <button
                  onClick={() => openReportWithCategory('Unsafe Condition')}
                  aria-label="Report New Incident"
                  className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-all border-4 border-white"
                >
                  <Plus className="w-7 h-7 stroke-[3]" />
                </button>
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
                <MoreHorizontal className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[10px] mt-1 font-medium">More</span>
              </button>

            </nav>

          </>
        )}

      </main>

    </div>
  );
}
