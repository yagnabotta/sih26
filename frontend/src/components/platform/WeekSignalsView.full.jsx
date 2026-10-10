import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  ShieldCheck,
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Flame, 
  Zap, 
  Layers, 
  AlertOctagon, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  FileText, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  X, 
  Check, 
  UserCheck, 
  MessageSquare, 
  Sparkles, 
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  HelpCircle,
  ArrowDown,
  SlidersHorizontal,
  Info,
  Lock,
  MapPin,
  Play,
  Trash2,
  Send,
  PlusCircle,
  ArrowRightCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { 
  getStoreState, 
  getStoredWeakSignals,
  updateReportStatus, 
  updateReportDetails, 
  updatePrecursorDetails, 
  subscribeSafetyStore 
} from '../../services/safetyStore';
import { useAuth } from '../../context/AuthContext';

export default function WeekSignalsView({ onNavigate }) {
  const { user } = useAuth() || {};

  const isAdmin = useMemo(() => {
    try {
      const raw = localStorage.getItem('safetyai_user');
      const u = raw ? JSON.parse(raw) : user;
      if (!u) return false;
      const isNormal = u?.role === 'NORMAL_USER' || 
                       u?.role_name === 'Normal User' || 
                       u?.is_admin === false ||
                       (u?.email && u.email.toLowerCase().includes('user'));
      if (isNormal) return false;
      return Boolean(
        u?.is_admin === true || 
        u?.role === 'ADMINISTRATOR' || 
        u?.role === 'CHIEF_HSE_AUDITOR' ||
        u?.role_name === 'Administrator' || 
        (u?.email && u.email.toLowerCase().includes('admin'))
      );
    } catch {
      return false;
    }
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [signals, setSignals] = useState([]);
  const [clusters, setClusters] = useState([]);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'High' | 'Medium' | 'Low'
  
  // Emerging Risk Cluster Modal State
  const [selectedCluster, setSelectedCluster] = useState(null);
  
  // Live Correlation Testing Sandbox State
  const [showLiveTester, setShowLiveTester] = useState(false);
  const [testingScenario, setTestingScenario] = useState(false);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxError, setSandboxError] = useState(null);
  const [activeScenarioName, setActiveScenarioName] = useState('');
  const [expandedClusterReports, setExpandedClusterReports] = useState({});
  const toggleExpandCluster = (cId) => {
    setExpandedClusterReports(prev => ({ ...prev, [cId]: !prev[cId] }));
  };
  
  // User Description Entry & Live Correlation Console State
  const [inputMode, setInputMode] = useState('single'); // 'single' | 'pairwise' | 'scenarios'
  const [userDesc, setUserDesc] = useState('');
  const [userLocation, setUserLocation] = useState('Crude Distillation Unit (CDU)');
  const [userReportType, setUserReportType] = useState('NEAR_MISS');
  const [pairDesc1, setPairDesc1] = useState('');
  const [pairLoc1, setPairLoc1] = useState('Crude Distillation Unit (CDU)');
  const [pairDesc2, setPairDesc2] = useState('');
  const [pairLoc2, setPairLoc2] = useState('Crude Distillation Unit (CDU)');
  const [analyzingUserDesc, setAnalyzingUserDesc] = useState(false);
  const [userAnalysisFeedback, setUserAnalysisFeedback] = useState(null);
  const [resettingSignals, setResettingSignals] = useState(false);
  
  // Dossier Modal State
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [signalDetail, setSignalDetail] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('Under Review');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [hasNotesEdits, setHasNotesEdits] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewToast, setReviewToast] = useState(null);

  // Correlated Multi-Record Identification (Rule: >= 2 Records)
  const activeRecords = useMemo(() => {
    if (!selectedSignal) return [];
    
    // Check if signal has explicit source_reports or identifyingRecords
    const rawList = selectedSignal?.source_reports || signalDetail?.source_reports || selectedSignal?.identifyingRecords || [];
    const fromDetail = rawList.map((rep, idx) => ({
      ref: rep.report_id || rep.report_reference || rep.ref || `REP-${idx + 1}`,
      name: rep.pattern_identified || rep.report_name || rep.short_description || rep.name || selectedSignal.title,
      unit: rep.unit || rep.facility_unit || rep.location || 'Operating Unit',
      excerpt: rep.excerpt || rep.short_description || rep.description || 'Precursor observation recorded in system.'
    }));

    if (fromDetail.length > 0) {
      return fromDetail;
    }

    return [{
      ref: selectedSignal.signal_id || 'WS-01',
      name: selectedSignal.title,
      unit: selectedSignal.location || 'Operating Unit',
      excerpt: selectedSignal.potential_sif_precursor || selectedSignal.description || 'Under active multi-report monitoring.'
    }];
  }, [selectedSignal, signalDetail]);

  // Load Weak Signals & Emerging Clusters from backend or local safetyStore
  const loadWeakSignals = async () => {
    try {
      setLoading(true);
      let backendData = null;
      try {
        backendData = await api.getWeakSignals();
      } catch (backendErr) {
        console.warn('Backend weak-signals API unreachable, falling back to local store:', backendErr);
      }

      if (backendData && Array.isArray(backendData.weak_signals)) {
        const sigs = backendData.weak_signals;
        const avgConf = sigs.length > 0 
          ? (sigs.reduce((sum, s) => sum + (s.risk_score || s.correlation_score || 80), 0) / sigs.length).toFixed(1) 
          : 0;
        setSummary(backendData.summary || {
          total_active_signals: sigs.length,
          high_risk_precursors: sigs.filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
          escalating_patterns: sigs.filter(s => s.risk_score && s.risk_score >= 80).length,
          average_confidence: avgConf
        });
        setSignals(backendData.weak_signals);
        if (Array.isArray(backendData.emerging_clusters) && backendData.emerging_clusters.length > 0) {
          setClusters(backendData.emerging_clusters);
        } else {
          // Derive clusters from signals with cluster_detected
          const derived = backendData.weak_signals
            .filter(s => s.cluster_detected && ((s.signals && s.signals.length >= 1) || (s.source_reports && s.source_reports.length >= 1)))
            .map((sig, idx) => ({
              id: idx + 1,
              cluster_id: `CL-${String(idx + 1).padStart(2, '0')}`,
              cluster_title: `EMERGING ${(sig.combined_risk || 'HIGH').toUpperCase()}-RISK CLUSTER: ${sig.relationship || sig.title}`,
              title: sig.relationship || sig.title,
              relationship: sig.relationship || sig.title,
              signals: (sig.signals || (sig.source_reports || []).map((r, i) => ({
                signal_num: i + 1,
                report_id: r.report_id || `SIG-0${i+1}`,
                description: r.short_description || r.excerpt || '',
                individual_risk: 'MEDIUM',
                location: r.unit || 'Operating Bay'
              }))),
              individual_risk_levels: sig.signals?.map((s, i) => `Signal ${i+1}: ${s.risk_level || 'MEDIUM'}`).join(', ') || 'Signal 1: MEDIUM, Signal 2: MEDIUM/HIGH',
              location: sig.location || (sig.source_reports?.[0]?.unit) || 'Unit 1 Operating Bay',
              time_relationship: 'Active operational window (within 48 hours)',
              correlation_score: sig.correlation_score || sig.risk_score || 92,
              potential_consequence: sig.potential_consequence || sig.potential_sif_precursor || 'Fire/Explosion',
              combined_risk: (sig.combined_risk || 'HIGH').toUpperCase(),
              reason: sig.reason || sig.why_identified || 'Hazard interaction between co-located signals.',
              recommended_action: sig.recommended_action || sig.key_learnings || 'Immediately inspect and isolate affected area.',
              progression_steps: sig.progression_steps || []
            }));
          setClusters(derived);
        }
      } else {
        const stored = getStoredWeakSignals();
        const avgConf = stored.length > 0 
          ? (stored.reduce((sum, s) => sum + (s.risk_score || s.correlation_score || 80), 0) / stored.length).toFixed(1) 
          : 0;
        setSignals(stored);
        setSummary({
          total_active_signals: stored.length,
          high_risk_precursors: stored.filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
          escalating_patterns: stored.filter(s => s.risk_score && s.risk_score >= 80).length,
          average_confidence: avgConf
        });
      }
    } catch (err) {
      console.error('Failed to load weak signals:', err);
      const stored = getStoredWeakSignals();
      const avgConf = stored.length > 0 
        ? (stored.reduce((sum, s) => sum + (s.risk_score || s.correlation_score || 80), 0) / stored.length).toFixed(1) 
        : 0;
      setSignals(stored);
      setSummary({
        total_active_signals: stored.length,
        high_risk_precursors: stored.filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
        escalating_patterns: stored.filter(s => s.risk_score && s.risk_score >= 80).length,
        average_confidence: avgConf
      });
    } finally {
      setLoading(false);
    }
  };

  const SCENARIOS = [
    {
      id: 'scenario_a_gas_fire',
      name: 'Scenario A: Gas Leak + Fire (Same Process Bay)',
      badge: 'PLAUSIBLE CORRELATION',
      description: 'Minor LPG fuel gas weep reported in CDU Unit Bay 2 alongside small flash fire. Shared physical bay indicates potential ignition escalation.',
      reports: [
        {
          report_id: 'REP-A01',
          description: 'Minor LPG fuel gas flange weep detected near furnace with trace gas hissing.',
          location: 'CDU Unit Bay 2',
          timestamp: '2026-05-10T08:00:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Low'
        },
        {
          report_id: 'REP-A02',
          description: 'Small flash spark igniting rag on structural beam near furnace line.',
          location: 'CDU Unit Bay 2',
          timestamp: '2026-05-10T11:30:00Z',
          report_type: 'Unsafe Condition',
          observed_severity: 'Low'
        }
      ]
    },
    {
      id: 'scenario_b_unrelated_fires',
      name: 'Scenario B: Two Unrelated Small Fires (Disconnected Sites)',
      badge: 'REJECT FALSE COMBINATION',
      description: 'Isolated electrical smolder in remote yard and small kitchen toaster wire char in admin building. Independent events must NOT be combined into a major fire.',
      reports: [
        {
          report_id: 'REP-B01',
          description: 'Minor electrical breaker charring in isolated perimeter substation yard.',
          location: 'Remote Perimeter Substation 4',
          timestamp: '2026-05-10T09:00:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Low'
        },
        {
          report_id: 'REP-B02',
          description: 'Small toaster wire smolder in administration canteen pantry.',
          location: 'Admin Building Kitchen',
          timestamp: '2026-05-10T14:15:00Z',
          report_type: 'Unsafe Condition',
          observed_severity: 'Low'
        }
      ]
    },
    {
      id: 'scenario_c1_shared_pipeline',
      name: 'Scenario C1: Gas Leaks on Shared Pipeline P-101',
      badge: 'CONFIRMED COMMON CAUSE',
      description: 'Two separate gas leak observations sharing documented fuel gas pipeline P-101. Evaluated as a common underlying integrity failure.',
      reports: [
        {
          report_id: 'REP-C01',
          description: 'Gas detector alarm sounded on common fuel gas pipeline P-101 near compressor suction flange.',
          location: 'Compressor Station Area',
          timestamp: '2026-05-10T07:30:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Moderate'
        },
        {
          report_id: 'REP-C02',
          description: 'Volatile hydrocarbon odor and pressure drop detected downstream along shared pipeline P-101 furnace header.',
          location: 'Pre-Heat Furnace Train',
          timestamp: '2026-05-10T10:15:00Z',
          report_type: 'Unsafe Condition',
          observed_severity: 'Moderate'
        }
      ]
    },
    {
      id: 'scenario_c2_disconnected_leaks',
      name: 'Scenario C2: Two Gas Leaks in Disconnected Units',
      badge: 'UNSUPPORTED RELATIONSHIP',
      description: 'Minor lab testing cylinder weep and remote forklift depot LPG valve hiss. No common supply or process connection.',
      reports: [
        {
          report_id: 'REP-C03',
          description: 'Minor natural gas seal weep on laboratory testing bench fixture.',
          location: 'Quality Control Lab',
          timestamp: '2026-05-10T08:00:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Low'
        },
        {
          report_id: 'REP-C04',
          description: 'Forklift LPG bottle relief valve brief hiss during tank swapping in remote logistics yard.',
          location: 'Logistics Yard South',
          timestamp: '2026-05-10T15:30:00Z',
          report_type: 'Unsafe Condition',
          observed_severity: 'Low'
        }
      ]
    },
    {
      id: 'scenario_d_guarding_nearmiss',
      name: 'Scenario D: Machine Guarding Condition + Near Miss',
      badge: 'RECURRING HAZARD PATTERN',
      description: 'Missing mesh guard on conveyor belt followed by operator sleeve nearly caught in moving rollers. Evidence of recurring mechanical entrapment threat.',
      reports: [
        {
          report_id: 'REP-D01',
          description: 'Unguarded conveyor belt drive pulley operating with missing protective wire mesh.',
          location: 'Packaging & Bagging Unit 3',
          timestamp: '2026-05-09T16:00:00Z',
          report_type: 'Unsafe Condition',
          observed_severity: 'Moderate'
        },
        {
          report_id: 'REP-D02',
          description: 'Operator sleeve nearly caught in moving drive rollers of packaging line conveyor during shift handover.',
          location: 'Packaging & Bagging Unit 3',
          timestamp: '2026-05-10T13:45:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Moderate'
        }
      ]
    },
    {
      id: 'scenario_e_missing_metadata',
      name: 'Scenario E: Incomplete Records (Missing Timestamps / Locations)',
      badge: 'UNCERTAIN - REQUIRES VERIFICATION',
      description: 'Reports lack verified operational timestamps and specific unit locations. Flagged as uncertain requiring field verification without guessing.',
      reports: [
        {
          report_id: 'REP-E01',
          description: 'Trace gas smell noticed near pipe rack.',
          location: '',
          timestamp: '',
          report_type: 'Observation',
          observed_severity: 'Low'
        },
        {
          report_id: 'REP-E02',
          description: 'Small spark observed during maintenance.',
          location: 'Unspecified Area',
          timestamp: '',
          report_type: 'Unsafe Condition',
          observed_severity: 'Low'
        }
      ]
    },
    {
      id: 'scenario_f_active_controls',
      name: 'Scenario F: Compound Hazards with Verified Safety Controls',
      badge: 'CONTROLS MITIGATED',
      description: 'LPG gas weep near hot work, but positive mechanical LOTO isolation, continuous LEL gas sniffing, and deluge protection are active.',
      reports: [
        {
          report_id: 'REP-F01',
          description: 'Minor LPG fuel gas flange weep with continuous LEL monitoring active and automatic deluge barrier primed.',
          location: 'Hydrocracker Unit 1',
          timestamp: '2026-05-10T08:30:00Z',
          report_type: 'Near Miss',
          observed_severity: 'Moderate'
        },
        {
          report_id: 'REP-F02',
          description: 'Permitted hot work welding ongoing under verified Lockout/Tagout (LOTO), ESD interlock, and active fire watch containment.',
          location: 'Hydrocracker Unit 1',
          timestamp: '2026-05-10T11:00:00Z',
          report_type: 'Unsafe Act',
          observed_severity: 'Moderate'
        }
      ]
    }
  ];

  const runCorrelationTest = async (scenario) => {
    try {
      setTestingScenario(true);
      setSandboxError(null);
      setActiveScenarioName(scenario.name);
      const res = await api.correlateReports(scenario.reports);
      setSandboxResult(res);
    } catch (err) {
      console.error('Correlation sandbox error:', err);
      setSandboxError(err.message || 'Failed to execute correlation test.');
    } finally {
      setTestingScenario(false);
    }
  };

  const handleAnalyzeUserDescription = async (e) => {
    e?.preventDefault();
    if (!userDesc.trim()) return;
    try {
      setAnalyzingUserDesc(true);
      setUserAnalysisFeedback(null);
      const res = await api.analyzeDescriptionForWeakSignal({
        description: userDesc.trim(),
        location: userLocation.trim() || 'Unit 1',
        report_type: userReportType
      });
      if (!res.success && res.is_unrelated) {
        setUserAnalysisFeedback({
          type: 'warning',
          title: 'Unrelated Input Intercepted',
          message: res.message
        });
      } else if (res.weak_signal_detected) {
        setUserAnalysisFeedback({
          type: 'success',
          title: 'Compound Hazard Cluster Detected!',
          message: `Correlated: ${res.weak_signal_title || 'Emerging Weak Signal'}. Escalation Path: ${res.escalation_path || 'Interacting hazard pattern identified.'}`,
          report_ref: res.report_reference
        });
        setUserDesc('');
      } else {
        setUserAnalysisFeedback({
          type: 'info',
          title: 'Observation Registered (Awaiting Second Corroborating Signal)',
          message: `Observation registered as ${res.report_reference}. Currently 1 isolated observation in ${userLocation}. In accordance with industrial safety rules, a compound hazard cluster requires >= 2 corroborating observations in this unit or hazard family to establish an escalation pattern.`,
          report_ref: res.report_reference
        });
        setUserDesc('');
      }
      if (res.emerging_clusters) {
        setClusters(res.emerging_clusters);
      }
      if (res.weak_signals) {
        setSignals(res.weak_signals);
      }
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      setUserAnalysisFeedback({
        type: 'error',
        title: 'Analysis Failed',
        message: err.message || 'Error communicating with analysis service.'
      });
    } finally {
      setAnalyzingUserDesc(false);
    }
  };

  const handleCorrelateTwoDescriptions = async (e) => {
    e?.preventDefault();
    if (!pairDesc1.trim() || !pairDesc2.trim()) return;
    try {
      setAnalyzingUserDesc(true);
      setUserAnalysisFeedback(null);
      const res = await api.correlateDescriptions({
        description_1: pairDesc1.trim(),
        location_1: pairLoc1.trim() || 'Unit 1',
        description_2: pairDesc2.trim(),
        location_2: pairLoc2.trim() || 'Unit 1'
      });
      if (res.cluster_detected || res.is_correlated) {
        setUserAnalysisFeedback({
          type: 'success',
          title: 'Compound Hazard Cluster Formed!',
          message: `${res.correlation_result?.pattern_name || res.correlation_result?.relationship || 'Cluster detected'}. Both observations recorded (${res.report_1_ref}, ${res.report_2_ref}) and added to the cluster board.`
        });
        setPairDesc1('');
        setPairDesc2('');
      } else {
        setUserAnalysisFeedback({
          type: 'info',
          title: 'Evaluated as Separate Incidents (No Additive Escalation)',
          message: res.correlation_result?.reason || 'Observations do not share physical mechanisms or common escalation pathways. Recorded as separate reports.'
        });
      }
      if (res.emerging_clusters) {
        setClusters(res.emerging_clusters);
      }
      if (res.weak_signals) {
        setSignals(res.weak_signals);
      }
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      setUserAnalysisFeedback({
        type: 'error',
        title: 'Correlation Failed',
        message: err.message || 'Error correlating descriptions.'
      });
    } finally {
      setAnalyzingUserDesc(false);
    }
  };

  const handleResetAllSignals = async () => {
    if (!window.confirm('Clear all active weak signals and return to a clean zero-signal state?')) return;
    try {
      setResettingSignals(true);
      await api.resetWeakSignals();
      setSignals([]);
      setClusters([]);
      setSummary({
        total_active_signals: 0,
        high_risk_precursors: 0,
        escalating_patterns: 0,
        average_confidence: 0,
        high_risk_count: 0,
        medium_risk_count: 0,
        low_risk_count: 0,
        total_clusters: 0
      });
      setUserAnalysisFeedback({
        type: 'success',
        title: 'Signals Cleared',
        message: 'All weak signals wiped. Ready for new user-submitted observations.'
      });
    } catch (err) {
      alert('Failed to reset: ' + err.message);
    } finally {
      setResettingSignals(false);
    }
  };

  useEffect(() => {
    loadWeakSignals();

    // Reactive subscription to safetyStore so any status, field changes, or new weak signals reflect automatically
    const unsub = subscribeSafetyStore((newState) => {
      const stored = getStoredWeakSignals();
      if (stored && stored.length > 0) {
        setSignals(stored);
        setSummary({
          total_active_signals: stored.length,
          high_risk_precursors: stored.filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
          escalating_patterns: stored.filter(s => s.risk_score && s.risk_score >= 80).length,
          average_confidence: 95.8
        });
      }
    });

    return unsub;
  }, []);

  // Open Dossier Modal & Fetch Deep Detail
  const handleOpenDossier = async (signal) => {
    setSelectedSignal(signal);
    setReviewToast(null);
    const initialStatus = signal.review_status === 'Complete' ? 'Completed' : (signal.review_status || 'Under Review');
    setCurrentStatus(initialStatus);
    setReviewerNotes(signal.reviewer_notes || '');
    setHasNotesEdits(false);
    
    try {
      setLoadingDetail(true);
      const detail = await api.getWeakSignalById(signal.signal_id);
      if (detail) {
        setSignalDetail(detail);
        if (detail.review_status) {
          setCurrentStatus(detail.review_status === 'Complete' ? 'Completed' : detail.review_status);
        }
        setReviewerNotes(detail.reviewer_notes || '');
      } else {
        setSignalDetail(signal);
      }
    } catch (err) {
      console.error('Failed to fetch signal detail:', err);
      setSignalDetail(signal);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDossier = () => {
    setSelectedSignal(null);
    setSignalDetail(null);
    setReviewToast(null);
    setHasNotesEdits(false);
  };

  const isLocked = currentStatus === 'Completed' || currentStatus === 'Complete';

  // Submit human review decision in modal
  const handleReviewAction = async (status) => {
    if (!selectedSignal) return;

    // Strict Lock Enforcement: once Completed, cannot be reverted
    if (isLocked && status !== 'Completed' && status !== 'Complete') {
      setReviewToast({
        type: 'error',
        text: 'Finalized Record Locked: Records marked as Completed cannot be reverted back to Under Review or Pending.'
      });
      setTimeout(() => setReviewToast(null), 4000);
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewToast(null);

      // 1. Sync directly to reactive safetyStore
      const { reports, precursors } = getStoreState();
      const matchingReport = (reports || []).find(r => 
        r.report_reference === selectedSignal.signal_id ||
        r.id === selectedSignal.signal_id ||
        (r.identified_hazard && selectedSignal.title && r.identified_hazard.toLowerCase() === selectedSignal.title.toLowerCase()) ||
        (r.description && selectedSignal.description && r.description.toLowerCase().includes(selectedSignal.description.toLowerCase().slice(0, 30)))
      );

      if (matchingReport) {
        try {
          updateReportStatus(matchingReport.report_reference || matchingReport.id, status);
        } catch (e) {
          console.warn('Safety store sync error:', e);
        }
      }

      // Also check precursor items
      const matchingPrecursor = (precursors || []).find(p => 
        p.id === selectedSignal.signal_id ||
        p.precursor_id === selectedSignal.signal_id ||
        (p.title && selectedSignal.title && p.title.toLowerCase() === selectedSignal.title.toLowerCase())
      );
      if (matchingPrecursor) {
        try {
          updatePrecursorDetails(matchingPrecursor.id || matchingPrecursor.precursor_id, {
            status: status === 'Completed' ? 'Complete' : status,
            reviewer_notes: reviewerNotes
          });
        } catch (e) {
          console.warn('Precursor sync error:', e);
        }
      }

      // 2. Persist to backend database
      const res = await api.submitWeakSignalReview(selectedSignal.signal_id, status, reviewerNotes);
      if (res && res.weak_signal) {
        setSignalDetail(res.weak_signal);
      }

      setCurrentStatus(status);
      setReviewToast({
        type: 'success',
        text: `Weak signal status updated to "${status}" and automatically synced across all platform views.`
      });

      // Update list in place
      setSignals(prev => prev.map(s => 
        s.signal_id === selectedSignal.signal_id ? { ...s, review_status: status, reviewer_notes: reviewerNotes } : s
      ));
      
      // Refresh summary
      try {
        const freshData = await api.getWeakSignals();
        if (freshData?.summary) setSummary(freshData.summary);
      } catch {}
    } catch (err) {
      console.error('Failed to submit review:', err);
      // Even if backend call fails, update local state
      setCurrentStatus(status);
      setSignals(prev => prev.map(s => 
        s.signal_id === selectedSignal.signal_id ? { ...s, review_status: status, reviewer_notes: reviewerNotes } : s
      ));
      setReviewToast({ 
        type: 'success', 
        text: `Weak signal status updated to "${status}" and synced locally.` 
      });
    } finally {
      setSubmittingReview(false);
      setTimeout(() => setReviewToast(null), 4000);
    }
  };

  // Save edited reviewer notes / directives
  const handleSaveNotes = async () => {
    if (!selectedSignal) return;
    try {
      setSubmittingReview(true);
      setReviewToast(null);

      // Sync to safetyStore
      const { reports } = getStoreState();
      const matchingReport = (reports || []).find(r => 
        r.report_reference === selectedSignal.signal_id ||
        r.id === selectedSignal.signal_id ||
        (r.identified_hazard && selectedSignal.title && r.identified_hazard.toLowerCase() === selectedSignal.title.toLowerCase())
      );

      if (matchingReport) {
        try {
          updateReportDetails(matchingReport.report_reference || matchingReport.id, {
            recommended_action: reviewerNotes,
            status: currentStatus
          });
        } catch (e) {
          console.warn('Safety store note sync:', e);
        }
      }

      // Backend sync
      await api.submitWeakSignalReview(selectedSignal.signal_id, currentStatus, reviewerNotes);

      setSignals(prev => prev.map(s => 
        s.signal_id === selectedSignal.signal_id ? { ...s, reviewer_notes: reviewerNotes } : s
      ));
      setHasNotesEdits(false);
      setReviewToast({
        type: 'success',
        text: 'Directives & audit notes saved and automatically synced across all views.'
      });
    } catch (err) {
      console.error('Failed to save notes:', err);
      setHasNotesEdits(false);
      setReviewToast({
        type: 'success',
        text: 'Directives saved and synchronized locally.'
      });
    } finally {
      setSubmittingReview(false);
      setTimeout(() => setReviewToast(null), 4000);
    }
  };

  // Standardized Risk Categorizer for Weak Signals
  const getRiskCategory = (sig) => {
    if (!sig) return 'Low';
    const lvl = (sig.risk_classification || sig.risk_level || sig.combined_risk || '').toLowerCase();
    const score = Number(sig.risk_score || sig.correlation_score || 0);

    if (lvl === 'critical' || lvl === 'high' || score >= 80) {
      return 'High';
    }
    if (lvl === 'medium' || lvl === 'moderate' || (score >= 50 && score < 80)) {
      return 'Medium';
    }
    return 'Low';
  };

  const getConfidenceBadge = (confidence) => {
    const conf = (confidence || 'CONFIRMED').toUpperCase();
    if (conf === 'CONFIRMED') {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500',
        label: 'CONFIRMED EVIDENCE'
      };
    }
    if (conf === 'PLAUSIBLE') {
      return {
        bg: 'bg-sky-50 text-sky-800 border-sky-300',
        dot: 'bg-sky-500',
        label: 'PLAUSIBLE CORRELATION'
      };
    }
    if (conf === 'UNCERTAIN') {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-300',
        dot: 'bg-amber-500',
        label: 'UNCERTAIN (NEEDS VERIFICATION)'
      };
    }
    return {
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      dot: 'bg-slate-400',
      label: 'UNSUPPORTED RELATIONSHIP'
    };
  };

  const getRiskClassificationStyle = (risk) => {
    const r = (risk || 'MODERATE').toUpperCase();
    if (r === 'CRITICAL') {
      return 'bg-rose-600 text-white border-rose-700 shadow-sm';
    }
    if (r === 'HIGH') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (r === 'MODERATE' || r === 'MEDIUM') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  // Filtered weak signals based on search query, risk level, and trend
  const filteredSignals = signals.filter(sig => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      (sig.title || '').toLowerCase().includes(query) ||
      (sig.category || '').toLowerCase().includes(query) ||
      (sig.description || '').toLowerCase().includes(query) ||
      (sig.signal_id || '').toLowerCase().includes(query) ||
      (sig.energy_source || '').toLowerCase().includes(query) ||
      (sig.potential_sif_precursor || '').toLowerCase().includes(query);

    const cat = getRiskCategory(sig);
    const matchesRisk = riskFilter === 'ALL' || cat === riskFilter;

    return matchesSearch && matchesRisk;
  });

  // Risk count helpers dynamically synchronized with actual signals array
  const highRiskCount = signals.filter(s => getRiskCategory(s) === 'High').length;
  const medRiskCount = signals.filter(s => getRiskCategory(s) === 'Medium').length;
  const lowRiskCount = signals.filter(s => getRiskCategory(s) === 'Low').length;

  // Overcome action guidance based on weak signal pattern
  const getOvercomeDetails = (signal) => {
    if (!signal) return null;
    const title = (signal.title || '').toLowerCase();
    const cat = (signal.category || '').toLowerCase();
    const id = signal.signal_id;

    if (id === 'WS-01' || title.includes('gas') || title.includes('flange') || title.includes('leakage') || cat.includes('gas') || cat.includes('fire')) {
      return {
        title: "Mitigation Protocol: Flammable Gas Leakage & Joint Degradation",
        primaryAction: "Immediate mechanical flange retorquing, continuous nitrogen purging, and high-spec spiral-wound gasket replacement.",
        steps: [
          { step: "1. Rapid Isolation & Purge", desc: "Depressurize the affected manifold segment, isolate upstream feeds via ESD valves, and nitrogen-purge before joint breakout." },
          { step: "2. Precision Bolt Retorquing", desc: "Use calibrated hydraulic torque wrenches adhering strictly to ASME bolt-load tension charts and install high-temp spiral-wound metallic gaskets." },
          { step: "3. Acoustic & Thermal Audit", desc: "Deploy continuous ultrasonic acoustic leak detection and daily thermal imaging camera walkdowns to identify micro-weeping before pressure buildup." }
        ],
        verificationCheck: "Mandatory zero-leakage acoustic sniff verification at 100% operating pressure prior to re-commissioning."
      };
    }

    if (id === 'WS-02' || title.includes('electrical') || title.includes('switchgear') || title.includes('loto') || cat.includes('electrical')) {
      return {
        title: "Mitigation Protocol: Electrical Arc Flash & Live Entry Hazards",
        primaryAction: "Enforce strict zero-energy state verification and dual-padlock Lock-Out/Tag-Out (LOTO) for all electrical enclosures.",
        steps: [
          { step: "1. Mandatory Positive Isolation", desc: "Trip breaker, rack out switchgear to test position, and apply registered individual lock and red danger tag." },
          { step: "2. Calibrated Test-Before-Touch", desc: "Verify live-line tester on known live source, verify zero-voltage across all 3 phases and neutral, then re-verify tester." },
          { step: "3. Arc-Flash Boundary & PPE", desc: "Erect 3-meter arc-flash boundary barriers and mandate NFPA 70E Category 4 arc-rated suits during enclosure cover removal." }
        ],
        verificationCheck: "Mandatory two-person verification sign-off by a certified electrical safety auditor before work starts."
      };
    }

    if (id === 'WS-03' || title.includes('confined') || title.includes('vessel') || cat.includes('confined')) {
      return {
        title: "Mitigation Protocol: Confined Space & Toxic Atmospheric Hazards",
        primaryAction: "Establish mandatory 4-gas atmospheric testing certification and dedicated external standby personnel with rescue hoists.",
        steps: [
          { step: "1. Multi-Level Atmospheric Testing", desc: "Test top, middle, and floor levels for O2 (19.5-23.5%), LEL (<5%), H2S (<10ppm), and CO (<25ppm) 15 minutes before entry." },
          { step: "2. Positive Forced Ventilation", desc: "Maintain continuous forced-air mechanical ventilation throughout occupancy; exhaust vapors away from personnel." },
          { step: "3. Dedicated Standby & Lifeline", desc: "Station a trained standby attendant outside the hatch equipped with emergency retrieval winch and radio at all times." }
        ],
        verificationCheck: "Entry permit automatically invalidates if work stops for >30 minutes; re-testing required."
      };
    }

    if (id === 'WS-04' || title.includes('fall') || title.includes('height') || title.includes('scaffold') || cat.includes('height')) {
      return {
        title: "Mitigation Protocol: Working at Height & Fall Potential",
        primaryAction: "Enforce 100% dual-lanyard tie-off and certified edge-protection toe-boards on all elevated work decks.",
        steps: [
          { step: "1. Certified Scaffold Tagging", desc: "Ensure green inspection tags signed within 7 days by competent scaffold erector before mounting platform." },
          { step: "2. Continuous Fall Arrest Anchorages", desc: "Mandate shock-absorbing dual lanyards attached to certified 5,000-lb overhead anchor points or horizontal lifelines." },
          { step: "3. Perimeter Barricades & Toe-boards", desc: "Install 42-inch top guardrails, mid-rails, and 4-inch toe-boards with safety mesh to prevent dropped objects." }
        ],
        verificationCheck: "Daily pre-shift harness and lanyard physical inspection logged in field safety app."
      };
    }

    return {
      title: "Mitigation Protocol: Barrier Enforcement & Precursor Elimination",
      primaryAction: signal.key_learnings || "Enforce primary physical barriers, verify operational procedures, and conduct supervisory audits.",
      steps: [
        { step: "1. Primary Barrier Enforcement", desc: "Inspect and restore degraded physical controls, shields, or interlocks to original safety specification." },
        { step: "2. Operational Procedure Re-alignment", desc: "Conduct immediate tailgate safety briefings with all shift technicians on identified procedural drift." },
        { step: "3. Supervisory Field Verification", desc: "Schedule mandatory leadership walkdowns within 24 hours to confirm barrier effectiveness in the field." }
      ],
      verificationCheck: "Track corrective action closure with documented photo evidence before closing observation item."
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto text-slate-800 animate-in fade-in duration-200">
      
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200/60 text-[#FF5A36]">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 tracking-tight">
              Weak Signals Intelligence
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-4xl">
            Detect emerging weak signals from submitted safety reports and show how multiple minor observations may contribute to a potential SIF precursor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetAllSignals}
            disabled={resettingSignals || (signals.length === 0 && clusters.length === 0)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-700 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all weak signals and clusters to reset to zero"
          >
            <Trash2 className={`w-3.5 h-3.5 text-rose-600 ${resettingSignals ? 'animate-spin' : ''}`} />
            <span>{resettingSignals ? 'Resetting...' : 'Clear All Signals'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadWeakSignals()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#EAE6E1] hover:border-slate-300 text-xs font-semibold text-slate-700 hover:bg-stone-50 transition-all shadow-xs cursor-pointer"
            title="Refresh weak signals from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ================= 1.5 KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hazard Clusters</span>
            <span className="p-1.5 rounded-lg bg-orange-50 text-[#FF5A36]"><Layers className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">{clusters.length}</div>
          <div className="text-[11px] text-slate-500">Multi-Signal Precursor Chains</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">High / Critical</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><AlertOctagon className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-rose-700 font-heading">
            {clusters.filter(c => (c.combined_risk || c.risk_classification || '').toUpperCase() === 'HIGH' || (c.combined_risk || c.risk_classification || '').toUpperCase() === 'CRITICAL').length}
          </div>
          <div className="text-[11px] text-slate-500">Requires Active Intervention</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Correlation Logic</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-1 font-heading">Multi-Factor Physics</div>
          <div className="text-[11px] text-emerald-700 font-medium">Non-Additive • Evidence-Based</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Discrete Reports</span>
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700"><FileText className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">{signals.length}</div>
          <div className="text-[11px] text-slate-500">Field Safety Observations</div>
        </div>
      </div>

      {/* ================= 1.6 DYNAMIC OBSERVATION ENTRY & CORRELATION CONSOLE ================= */}
      <div className="rounded-2xl bg-white border border-[#EAE6E1] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-orange-100 text-[#FF5A36]">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold font-heading text-slate-900">
                Dynamic Incident Precursor &amp; Correlation Console
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit real-time incident descriptions to detect emerging weak signals. Hazard clusters are generated strictly on-demand after user input.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl gap-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setInputMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                inputMode === 'single'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Observation
            </button>
            <button
              type="button"
              onClick={() => setInputMode('pairwise')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                inputMode === 'pairwise'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pairwise Correlation
            </button>
            <button
              type="button"
              onClick={() => setInputMode('scenarios')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                inputMode === 'scenarios'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reference Scenarios
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER IF ANY */}
        {userAnalysisFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
            userAnalysisFeedback.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : userAnalysisFeedback.type === 'warning'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : userAnalysisFeedback.type === 'error'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : 'bg-sky-50/80 border-sky-200 text-sky-950'
          }`}>
            <div className="shrink-0 mt-0.5">
              {userAnalysisFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {userAnalysisFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {userAnalysisFeedback.type === 'error' && <XCircle className="w-4 h-4 text-rose-600" />}
              {userAnalysisFeedback.type === 'info' && <Info className="w-4 h-4 text-sky-600" />}
            </div>
            <div className="flex-1 text-xs space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>{userAnalysisFeedback.title}</span>
                {userAnalysisFeedback.report_ref && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/70 border border-current">
                    {userAnalysisFeedback.report_ref}
                  </span>
                )}
              </div>
              <p className="leading-relaxed opacity-90">{userAnalysisFeedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setUserAnalysisFeedback(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODE 1: SINGLE OBSERVATION ENTRY */}
        {inputMode === 'single' && (
          <form onSubmit={handleAnalyzeUserDescription} className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Operating Unit / Location:
                </label>
                <input
                  type="text"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  placeholder="e.g. Crude Distillation Unit (CDU), Unit Bay 2"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F6] border border-stone-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5A36] focus:bg-white transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observation Type:
                </label>
                <select
                  value={userReportType}
                  onChange={(e) => setUserReportType(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F6] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#FF5A36] focus:bg-white transition-all shadow-2xs"
                >
                  <option value="NEAR_MISS">Near Miss</option>
                  <option value="UNSAFE_CONDITION">Unsafe Condition</option>
                  <option value="UNSAFE_ACT">Unsafe Act</option>
                  <option value="OBSERVATION">General Safety Observation</option>
                  <option value="EQUIPMENT_FAULT">Equipment Degradation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Field Incident / Hazard Narrative:
              </label>
              <textarea
                rows={3}
                value={userDesc}
                onChange={(e) => setUserDesc(e.target.value)}
                placeholder="Enter description, e.g.: 'Operator noticed combustible oily rags and wooden pallets stored within 2 feet of active high-temperature piping flange with minor oil weeping in CDU Unit Bay 2.'"
                className="w-full p-3.5 text-xs rounded-xl bg-[#FAF9F6] border border-stone-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5A36] focus:bg-white transition-all shadow-2xs leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-500 italic">
                * Rule Engine compares submitted text against existing unit records. If a physical or cross-hazard interaction is detected, a compound cluster is created dynamically.
              </span>

              <button
                type="submit"
                disabled={analyzingUserDesc || !userDesc.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end sm:self-auto shrink-0"
              >
                {analyzingUserDesc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing &amp; Correlating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit &amp; Correlate Precursors</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: DIRECT PAIRWISE CORRELATION */}
        {inputMode === 'pairwise' && (
          <form onSubmit={handleCorrelateTwoDescriptions} className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Report 1 */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Observation #1 (Precursor / Condition)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Signal A</span>
                </div>
                <input
                  type="text"
                  value={pairLoc1}
                  onChange={(e) => setPairLoc1(e.target.value)}
                  placeholder="Unit / Location (e.g. Hydrocracker Unit 1)"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white border border-stone-200 text-slate-800 focus:outline-none focus:border-[#FF5A36]"
                />
                <textarea
                  rows={3}
                  value={pairDesc1}
                  onChange={(e) => setPairDesc1(e.target.value)}
                  placeholder="e.g. Minor hydrocarbon gas flange weeping detected near transfer pipe rack."
                  className="w-full p-2.5 text-xs rounded-lg bg-white border border-stone-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5A36] leading-relaxed"
                />
              </div>

              {/* Report 2 */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Observation #2 (Co-Located Factor / Ignition)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Signal B</span>
                </div>
                <input
                  type="text"
                  value={pairLoc2}
                  onChange={(e) => setPairLoc2(e.target.value)}
                  placeholder="Unit / Location (e.g. Hydrocracker Unit 1)"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white border border-stone-200 text-slate-800 focus:outline-none focus:border-[#FF5A36]"
                />
                <textarea
                  rows={3}
                  value={pairDesc2}
                  onChange={(e) => setPairDesc2(e.target.value)}
                  placeholder="e.g. Hot work welding ongoing in adjacent bay with grinding sparks traveling toward pipe rack."
                  className="w-full p-2.5 text-xs rounded-lg bg-white border border-stone-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5A36] leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-500 italic">
                * Evaluates non-additive cross-hazard interaction. Non-correlated reports remain isolated incidents.
              </span>

              <button
                type="submit"
                disabled={analyzingUserDesc || !pairDesc1.trim() || !pairDesc2.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end sm:self-auto shrink-0"
              >
                {analyzingUserDesc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating Interactions...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Evaluate Pairwise Correlation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: REFERENCE BENCHMARK SCENARIOS */}
        {inputMode === 'scenarios' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => runCorrelationTest(sc)}
                  disabled={testingScenario}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    activeScenarioName === sc.name
                      ? 'border-[#FF5A36] bg-orange-50/50 shadow-2xs'
                      : 'border-stone-200 hover:border-slate-300 bg-[#FAF9F6] hover:bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-stone-200 text-slate-700">
                        {sc.badge}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sc.reports.length} Reports
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 leading-snug">
                      {sc.name}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#FF5A36] pt-1">
                    <Play className="w-3 h-3 fill-[#FF5A36]" />
                    <span>Run Verification</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Sandbox Evaluation Output */}
            {testingScenario && (
              <div className="p-8 text-center bg-[#FAF9F6] rounded-xl border border-stone-200 text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#FF5A36]" />
                <span>Evaluating spatial connections, common causes, controls, and escalation pathways...</span>
              </div>
            )}

            {sandboxError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 font-medium">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{sandboxError}</span>
              </div>
            )}

            {sandboxResult && !testingScenario && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#FFFDF9] to-white border-2 border-stone-200 shadow-sm space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg border ${getConfidenceBadge(sandboxResult.confidence_level).bg}`}>
                        {getConfidenceBadge(sandboxResult.confidence_level).label}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg border ${getRiskClassificationStyle(sandboxResult.risk_classification)}`}>
                        {sandboxResult.risk_classification?.toUpperCase()} RISK
                      </span>
                      {sandboxResult.is_correlated === false ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          SEPARATE INCIDENTS (NO ESCALATION)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          COMPOUND HAZARD PRECURSOR
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-heading">
                      {sandboxResult.pattern_name || sandboxResult.relationship || 'Correlation Evaluation Result'}
                    </h3>
                  </div>

                  <div className="text-right font-mono text-xs text-slate-500">
                    Confidence Score: <span className="font-bold text-slate-800">{sandboxResult.correlation_score || 25}/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Shared Hazard / Escalation Pathway:
                    </span>
                    <p className="font-semibold text-slate-900 leading-relaxed">
                      {sandboxResult.shared_hazard_or_pathway || 'No compound pathway supported by evidence.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Evidence Supporting Evaluation:
                    </span>
                    <p className="text-slate-800 leading-relaxed">
                      {sandboxResult.evidence_summary || sandboxResult.reason}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-rose-800 block">
                      Potential Credible Consequence:
                    </span>
                    <p className="font-medium text-rose-950">
                      {sandboxResult.potential_consequence || 'Localized event; separate mitigation.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      Recommended Preventive Actions:
                    </span>
                    <p className="font-medium text-emerald-950">
                      {sandboxResult.recommended_preventive_actions || sandboxResult.recommended_action}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= 1.7 EMERGING MULTI-SIGNAL RISK CLUSTERS ================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold font-heading text-slate-900 tracking-tight">
                Emerging Multi-Signal Hazard Clusters ({clusters.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Correlated safety precursor patterns identified through physical, spatial, and cross-hazard interactions. Not based on additive counts.
            </p>
          </div>

          <span className="text-xs font-mono text-slate-400 self-start sm:self-auto">
            API RP 754 &amp; OSHA 1910 Correlated
          </span>
        </div>

        {clusters.length === 0 ? (
          <div className="p-8 sm:p-10 text-center bg-white rounded-2xl border-2 border-dashed border-stone-200 space-y-3 animate-in fade-in duration-200">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF5A36]">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-lg mx-auto">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                Zero Predefined Clusters — Awaiting User Submissions
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Compound hazard precursor clusters are only generated when actual incident descriptions are entered by users. No mock or predefined weak signals are displayed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => setInputMode('single')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] text-white font-bold text-xs shadow-sm hover:from-[#ff5934] hover:to-[#e64a27] cursor-pointer flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Enter New Observation</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('pairwise')}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Test Pairwise Correlation</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {clusters.map((cluster, cIdx) => {
              const clusterKey = cluster.cluster_id || `cluster-${cIdx}`;
              const isExpanded = expandedClusterReports[clusterKey];
              const confStyle = getConfidenceBadge(cluster.confidence_level);
              const riskStyle = getRiskClassificationStyle(cluster.risk_classification || cluster.combined_risk);
              const contributing = cluster.contributing_reports || cluster.signals || [];

              return (
                <div
                  key={clusterKey}
                  className="rounded-2xl bg-white border border-[#EAE6E1] hover:border-orange-300 p-5 sm:p-6 shadow-sm space-y-4 transition-all"
                >
                  {/* Top Bar: IDs, Badges, Title & View Modal */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-stone-100 text-slate-800 border border-stone-200">
                          {cluster.cluster_id || `CL-${cIdx + 1}`}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${riskStyle}`}>
                          {(cluster.risk_classification || cluster.combined_risk || 'MODERATE').toUpperCase()} RISK
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${confStyle.bg}`}>
                          {confStyle.label}
                        </span>
                        <span className="text-xs font-mono text-slate-500 bg-[#FAF9F6] px-2 py-0.5 rounded border border-stone-200">
                          {contributing.length || 2} Correlated Reports
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-heading">
                        {cluster.pattern_name || cluster.title || cluster.relationship}
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cluster.location || (cluster.locations && cluster.locations.join(', ')) || 'Industrial Facility'}</span>
                        </span>
                        {cluster.time_relationship && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cluster.time_relationship}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedCluster(cluster)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Investigate Cascade</span>
                      </button>
                    </div>
                  </div>

                  {/* Core Section 7 Requirements: Pathway, Evidence, Consequence, Action */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Shared Underlying Hazard or Escalation Pathway */}
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-stone-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Shared Underlying Hazard / Escalation Pathway
                      </span>
                      <p className="font-semibold text-slate-800 leading-relaxed">
                        {cluster.shared_hazard_or_pathway || cluster.potential_consequence || 'Co-occurring precursor interaction.'}
                      </p>
                    </div>

                    {/* Evidence Supporting Correlation */}
                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-stone-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Evidence Supporting Correlation
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {cluster.evidence_summary || cluster.reason || 'Signals interact through shared physical proximity or common process systems.'}
                      </p>
                    </div>
                  </div>

                  {/* Missing information warning if uncertain */}
                  {cluster.missing_information && cluster.missing_information.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Missing Information / Uncertainty:</span>
                        <span className="ml-1 text-amber-800">
                          {cluster.missing_information.join('; ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Consequence & Recommended Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-rose-800 block">
                        Potential Consequence (Distinct from Observed Severity)
                      </span>
                      <p className="font-semibold text-rose-950">
                        {cluster.potential_consequence || 'Escalation to significant process event.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        Recommended Preventive Actions
                      </span>
                      <p className="font-semibold text-emerald-950">
                        {cluster.recommended_preventive_actions || cluster.recommended_action || 'Inspect area and enforce barriers.'}
                      </p>
                    </div>
                  </div>

                  {/* Individual Reports Inspector (Section 7: allow users to inspect individual reports) */}
                  <div className="pt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => toggleExpandCluster(clusterKey)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>{isExpanded ? 'Hide Contributing Reports' : `Inspect Contributing Reports (${contributing.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 animate-in fade-in duration-150">
                        {contributing.map((rep, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-3 rounded-xl bg-[#FAF9F6] border border-stone-200 text-xs space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="font-bold text-[#FF5A36]">
                                {rep.report_id || `SIG-0${rIdx + 1}`}
                              </span>
                              <span className="text-slate-500">
                                {rep.unit || rep.location || cluster.location}
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium leading-relaxed">
                              "{rep.excerpt || rep.short_description || rep.description}"
                            </p>
                            {rep.date_submitted && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Date: {rep.date_submitted}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= 2. PROMINENT SEARCH BAR & RISK FILTERS ================= */}
      <div className="rounded-2xl bg-white border border-[#EAE6E1] p-4 sm:p-5 shadow-xs space-y-4">
        
        {/* Main Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search weak signals by pattern, title, category, energy vector, or ID..."
            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl bg-[#FAF9F6] border border-stone-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5A36] focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls: Risk Level & Trend */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-1 border-t border-stone-100 text-xs">
          
          {/* Risk Level Filters: High, Medium, Low */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Risk Level:
            </span>

            {/* All Risks */}
            <button
              type="button"
              onClick={() => setRiskFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                riskFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
              }`}
            >
              <span>All Risks</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                riskFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {signals.length}
              </span>
            </button>

            {/* High Risk */}
            <button
              type="button"
              onClick={() => setRiskFilter(prev => prev === 'High' ? 'ALL' : 'High')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                riskFilter === 'High'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>High Risk</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                riskFilter === 'High' ? 'bg-white/20 text-white' : 'bg-white text-rose-700'
              }`}>
                {highRiskCount}
              </span>
            </button>

            {/* Medium Risk */}
            <button
              type="button"
              onClick={() => setRiskFilter(prev => prev === 'Medium' ? 'ALL' : 'Medium')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                riskFilter === 'Medium'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Medium Risk</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                riskFilter === 'Medium' ? 'bg-white/20 text-white' : 'bg-white text-amber-800'
              }`}>
                {medRiskCount}
              </span>
            </button>

            {/* Low Risk */}
            <button
              type="button"
              onClick={() => setRiskFilter(prev => prev === 'Low' ? 'ALL' : 'Low')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                riskFilter === 'Low'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Low Risk</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                riskFilter === 'Low' ? 'bg-white/20 text-white' : 'bg-white text-emerald-700'
              }`}>
                {lowRiskCount}
              </span>
            </button>
          </div>

          {/* Results Counter */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-[11px] font-mono text-slate-400">
              Showing {filteredSignals.length} of {signals.length}
            </span>
          </div>

        </div>

      </div>

      {/* ================= 3. INDIVIDUAL WEAK SIGNALS SECTION ================= */}
      <div className="space-y-4 pt-4 border-t border-stone-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-heading text-slate-900 tracking-tight">
              Individual Weak Signals &amp; Latent Observations
            </h2>
            <p className="text-xs text-slate-500">
              Discrete field safety observations flagged for early precursor monitoring.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Showing {filteredSignals.length} records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-3">
            <RefreshCw className="w-6 h-6 text-[#FF5A36] animate-spin mx-auto" />
            <p>Querying dynamic weak signal clusters and neural assessments from backend...</p>
          </div>
        ) : signals.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-stone-200 text-xs text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF5A36] flex items-center justify-center mx-auto border border-orange-200">
              <Activity className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800 text-base">No Emerging Weak Signals Detected</p>
            <p className="text-slate-500 max-w-md mx-auto text-xs">
              Weak signals emerge automatically from operational data when repeated anomalies, recurring minor observations, or barrier degradations are detected across reports.
            </p>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/bulk-upload')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF5A36] hover:bg-[#e64a27] text-white text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <span>Submit or Upload Operational Reports</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700 text-sm">No weak signals found matching the selected risk or search filters.</p>
            <p className="text-slate-400">Try adjusting your search criteria or reset filters to "All Risks".</p>
            <button
              onClick={() => { setSearchQuery(''); setRiskFilter('ALL'); }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSignals.map((signal) => (
              <div 
                key={signal.id || signal.signal_id}
                className="rounded-2xl bg-white border border-[#EAE6E1] hover:border-orange-300 p-5 sm:p-6 shadow-sm space-y-3.5 transition-all duration-300 text-slate-800"
              >
                {/* Headline, Badges, Score & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        {signal.signal_id} • {signal.category}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                        getRiskCategory(signal) === 'High' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : getRiskCategory(signal) === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {(signal.risk_level || getRiskCategory(signal)).toUpperCase()} RISK
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Detected: {signal.first_detected_date}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-heading">
                      {signal.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-slate-700">
                      Score: {signal.risk_score}/100
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenDossier(signal)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contextual Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Energy Vector</div>
                    <div className="font-semibold text-slate-800 mt-0.5 truncate">{signal.energy_source || 'Mechanical/Chemical Energy'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Barrier Status</div>
                    <div className="font-semibold text-rose-700 mt-0.5 truncate">{signal.barrier_status || 'Barrier Degraded'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Potential Precursor</div>
                    <div className="font-semibold text-slate-800 mt-0.5 truncate">{signal.potential_sif_precursor || 'Escalation towards SIF'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= 3.5 CLUSTER DETAILED INVESTIGATION MODAL ================= */}
      {selectedCluster && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200 text-left select-none">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#EAE6E1] overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-rose-50/70 via-[#FAF8F5] to-white border-b border-[#EAE6E1] flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black px-3 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                    {selectedCluster.cluster_id || 'CL-01'} • EMERGING RISK CLUSTER
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                    selectedCluster.combined_risk === 'CRITICAL'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    COMBINED RISK: {selectedCluster.combined_risk}
                  </span>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCluster.location}
                  </span>
                  {selectedCluster.time_relationship && (
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {selectedCluster.time_relationship}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
                  {selectedCluster.relationship || selectedCluster.title}
                </h2>
                <p className="text-xs text-slate-500">
                  Physics-Based Cross-Hazard Interaction • Correlation Score: <strong className="text-rose-600 font-mono">{selectedCluster.correlation_score}/100</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCluster(null)}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-[#EAE6E1] transition-colors cursor-pointer shadow-2xs"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs bg-white">
              
              {/* CORE REQUIREMENT: VISUAL CASCADE */}
              {/* Signal 1 -> Signal 2 [-> Signal 3] -> Hazard Interaction -> Potential Consequence -> Combined Risk */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#FFF8F6] to-white border-2 border-orange-200/80 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-orange-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 font-heading">
                    <Layers className="w-4 h-4 text-[#FF5A36]" />
                    Hazard Escalation Chain: Signal Interaction Cascade
                  </span>
                  <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    Rule-Based Safety Physics
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Connected Input Signals */}
                  {(selectedCluster.signals || []).map((sig, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <div className="p-3.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#FF5A36] text-[11px] font-mono font-black flex items-center justify-center shrink-0">
                            S{sig.signal_num || sIdx + 1}
                          </span>
                          <div>
                            <div className="font-mono text-[10px] text-slate-400 font-bold">
                              {sig.report_id} • {sig.location || selectedCluster.location}
                            </div>
                            <div className="text-xs font-bold text-slate-900">
                              "{sig.description}"
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${
                          sig.individual_risk === 'HIGH' || sig.individual_risk === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          Risk: {sig.individual_risk}
                        </span>
                      </div>

                      <div className="flex justify-center text-orange-500 py-0.5">
                        <ArrowDown className="w-4 h-4 animate-pulse" />
                      </div>
                    </React.Fragment>
                  ))}

                  {/* Hazard Interaction Block */}
                  <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 font-black text-xs">
                        ⚡
                      </div>
                      <div>
                        <div className="text-[10px] font-mono font-black uppercase text-amber-800">
                          Active Hazard Interaction
                        </div>
                        <div className="text-xs sm:text-sm font-black text-amber-950 font-heading">
                          {selectedCluster.relationship}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                      Co-Occurring Vectors
                    </span>
                  </div>

                  <div className="flex justify-center text-rose-500 py-0.5">
                    <ArrowDown className="w-4 h-4 animate-pulse" />
                  </div>

                  {/* Potential Consequence Block */}
                  <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0">
                        <Flame className="w-4 h-4 text-rose-700" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono font-black uppercase text-rose-800">
                          Potential Escalated Consequence
                        </div>
                        <div className="text-xs sm:text-sm font-black text-rose-950 font-heading">
                          {selectedCluster.potential_consequence}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300 shrink-0">
                      Catastrophic SIF
                    </span>
                  </div>

                  <div className="flex justify-center text-rose-600 py-0.5">
                    <ArrowDown className="w-4 h-4 animate-bounce" />
                  </div>

                  {/* Combined Risk Block */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 font-black">
                        <AlertOctagon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-rose-200 font-black">
                          Escalated Combined Risk Level
                        </div>
                        <div className="text-base sm:text-lg font-black tracking-tight font-heading">
                          {selectedCluster.combined_risk} RISK (Score: {selectedCluster.correlation_score}/100)
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-white text-rose-700 text-xs font-black font-mono shadow-xs shrink-0">
                      CRITICAL SIF PRECURSOR
                    </span>
                  </div>

                </div>
              </div>



              {/* Mechanism Explanation & Mitigation Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Safety Interaction Mechanism (Why Related)</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedCluster.reason}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Recommended Safety Action &amp; Directives</span>
                  </div>
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    {selectedCluster.recommended_action}
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#EAE6E1] flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">Signal Correlation Engine • API RP 754 &amp; OSHA 1910 Compliant</span>
              <button
                type="button"
                onClick={() => setSelectedCluster(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-xs transition-colors cursor-pointer text-xs"
              >
                Close Investigation
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= 4. EXAMINE WEAK SIGNAL DOSSIER MODAL ================= */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200 text-left select-none">
          
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#EAE6E1] overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-[#FFF8F6] via-[#FAF8F5] to-white border-b border-[#EAE6E1] text-slate-900 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                    {selectedSignal.signal_id} • {selectedSignal.category}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                    selectedSignal.risk_level === 'High' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : selectedSignal.risk_level === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {selectedSignal.risk_level?.toUpperCase()} RISK
                  </span>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1.5 ml-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>First Detected: {selectedSignal.first_detected_date}</span>
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-heading">
                  Weak Signal Dossier &amp; Precursor Relationship
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedSignal.source} • AI/NLP Multi-Report Pattern Analysis
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseDossier}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-[#EAE6E1] transition-colors cursor-pointer shadow-2xs"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs bg-white">
              
              {/* Toast message */}
              {reviewToast && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  reviewToast.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {reviewToast.text}
                </div>
              )}

              {/* SIF Assessment Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 via-rose-50/70 to-orange-50/50 border border-rose-200/80 flex items-center justify-between gap-4 text-rose-950 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                      Potential SIF Precursor Pattern Identified
                    </div>
                    <div className="text-xs mt-0.5 text-rose-950 font-bold">
                      {selectedSignal.potential_sif_precursor}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs font-mono font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs">
                    Risk Score: {selectedSignal.risk_score || 75}/100
                  </span>
                </div>
              </div>

              {/* Weak Signal → Precursor Relationship Flow */}
              {selectedSignal.connected_signals && selectedSignal.connected_signals.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-3 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Weak Signal → Potential Precursor Relationship Chain
                  </span>
                  
                  <div className="space-y-2">
                    {selectedSignal.connected_signals.map((step, idx) => {
                      const isLast = idx === selectedSignal.connected_signals.length - 1;
                      return (
                        <React.Fragment key={idx}>
                          <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                            isLast
                              ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-2xs'
                              : 'bg-white border-[#EAE6E1] text-slate-800 font-medium shadow-2xs'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                                isLast ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {isLast ? '!' : idx + 1}
                              </span>
                              <span>{step}</span>
                            </div>
                            {isLast && (
                              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-300">
                                Precursor Threat
                              </span>
                            )}
                          </div>

                          {!isLast && (
                            <div className="flex justify-center py-0.5 text-slate-400">
                              <ArrowDown className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}



              {/* Correlated Identifying Records Breakdown (Rule: >= 2 Records) */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-800 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-[#FF5A36] shrink-0" />
                    <span>IDENTIFIED ACROSS {activeRecords.length} RECORDS (RULE: ≥2 RECORDS):</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Multi-Record Audit</span>
                </div>

                {loadingDetail ? (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-[#FF5A36]" />
                    Loading linked records...
                  </div>
                ) : activeRecords.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeRecords.map((rep, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between font-mono text-[11px] font-bold">
                          <span className={rep.ref === 'Current Analyzed Record' ? 'text-[#FF5A36] font-bold' : 'text-[#FF5A36]'}>
                            {rep.ref}
                          </span>
                          <span className="text-slate-500 font-normal text-[11px] truncate max-w-[160px] text-right">
                            {rep.unit || 'Operating Unit'}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">
                          {rep.name}
                        </div>
                        <div className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                          {rep.excerpt}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs bg-white border border-[#EAE6E1] rounded-lg">
                    No individual source reports linked directly to this signal ID.
                  </div>
                )}
              </div>

              {/* HOW TO OVERCOME: Mitigation & Corrective Action Protocol */}
              {(() => {
                const overcome = getOvercomeDetails(selectedSignal);
                if (!overcome) return null;
                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#F0FDF4] border-2 border-emerald-300 space-y-3.5 shadow-xs animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-950 font-heading">
                            HOW TO OVERCOME THIS WEAK SIGNAL
                          </h4>
                          <p className="text-[11px] text-emerald-800 font-medium">
                            {overcome.title}
                          </p>
                        </div>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        Prescribed Safeguards
                      </span>
                    </div>

                    {/* Primary Action Mandate */}
                    <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs text-slate-800 leading-relaxed shadow-2xs">
                      <strong className="text-emerald-800 font-bold uppercase tracking-wide mr-1.5">
                        Primary Action Mandate:
                      </strong>
                      <span>{overcome.primaryAction}</span>
                    </div>

                    {/* 3 Step Action Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {overcome.steps.map((st, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1 shadow-2xs">
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{st.step}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                            {st.desc}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Verification Standard */}
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center gap-2 text-[11px] text-emerald-900 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-bold">Verification Standard:</span>
                      <span className="text-emerald-800">{overcome.verificationCheck}</span>
                    </div>
                  </div>
                );
              })()}

              {/* ================= 6. REVIEW STATUS & GOVERNANCE ================= */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EAE6E1] space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EAE6E1]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#FF5A36] flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-heading">
                        Signal Review &amp; Precursor Audit Status
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Governance lifecycle status across All Reports, SIF Precursors &amp; Dashboard
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Current Status:</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      (currentStatus === 'Completed' || currentStatus === 'Complete')
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : (currentStatus === 'Under Review' || currentStatus === 'Under-Review')
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    }`}>
                      {(currentStatus === 'Completed' || currentStatus === 'Complete') ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Complete (Locked)</span>
                        </>
                      ) : (currentStatus === 'Under Review' || currentStatus === 'Under-Review') ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Under Review</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-indigo-700" />
                          <span>Incomplete</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {isAdmin ? (
                  <>
                    {/* Status notification toast */}
                    {reviewToast && (
                      <div className={`p-3 rounded-xl border text-xs font-semibold animate-in fade-in ${
                        reviewToast.type === 'success' 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                          : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}>
                        {reviewToast.text}
                      </div>
                    )}

                    {/* Interactive Status Radio Selection */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                        Update Review Status (Shows Completed, Under Review, or Pending):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {[
                          { id: 'Under Review', label: 'Under Review', color: 'border-amber-400 text-amber-900 bg-amber-50/60' },
                          { id: 'Pending', label: 'Pending', color: 'border-indigo-400 text-indigo-900 bg-indigo-50/60' },
                          { id: 'Completed', label: 'Completed', color: 'border-emerald-400 text-emerald-900 bg-emerald-50/60' },
                        ].map((opt) => {
                          const isSelected = (currentStatus === opt.id) || (opt.id === 'Completed' && currentStatus === 'Complete');
                          const disabled = isLocked && !isSelected;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={disabled || submittingReview}
                              onClick={() => handleReviewAction(opt.id)}
                              className={`p-3 rounded-xl border-2 text-left font-bold text-xs transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                                isSelected 
                                  ? `${opt.color} border-current shadow-xs scale-[1.02]` 
                                  : disabled
                                    ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {isLocked && (
                        <p className="text-[10.5px] text-slate-500 italic mt-1">
                          * Record marked as Completed is finalized and locked according to safety compliance protocol.
                        </p>
                      )}
                    </div>

                    {/* Editable Notes / Recommended Action */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Reviewer Audit Notes &amp; Corrective Directives:
                        </label>
                        {hasNotesEdits && (
                          <span className="text-[10.5px] font-bold text-[#FF5A36] animate-pulse">
                            Unsaved Changes
                          </span>
                        )}
                      </div>
                      <textarea
                        value={reviewerNotes}
                        onChange={(e) => {
                          setReviewerNotes(e.target.value);
                          setHasNotesEdits(true);
                        }}
                        rows={2}
                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF5A36]/30 focus:border-[#FF5A36] font-medium leading-relaxed"
                        placeholder="Document engineering safeguards, barrier verification details, or human review directives..."
                      />
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10.5px] text-slate-400">
                          Edits automatically sync live across Weak Signals, SIF Precursors, All Reports &amp; Dashboard.
                        </span>
                        <button
                          type="button"
                          disabled={submittingReview}
                          onClick={handleSaveNotes}
                          className="px-4 py-2 rounded-xl bg-[#FF5A36] hover:bg-[#e04b29] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                        >
                          {submittingReview ? 'Saving...' : 'Save & Apply Changes'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Standard User View: Read-only status & audit notes */
                  <div className="space-y-3.5">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-[#FAF8F5] border border-slate-200/80 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Verification Lifecycle Status
                        </span>
                        <span className="text-[10.5px] font-medium text-slate-400 flex items-center gap-1">
                          Field Operator View
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-2 shadow-2xs w-fit ${
                          currentStatus === 'Completed' || currentStatus === 'Complete'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : currentStatus === 'Under Review' || currentStatus === 'Under-Review'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-indigo-50 text-indigo-900 border-indigo-300'
                        }`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            currentStatus === 'Completed' || currentStatus === 'Complete'
                              ? 'bg-emerald-600'
                              : currentStatus === 'Under Review' || currentStatus === 'Under-Review'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-indigo-600'
                          }`} />
                          <span>
                            {currentStatus === 'Completed' || currentStatus === 'Complete'
                              ? 'Complete'
                              : currentStatus === 'Under Review' || currentStatus === 'Under-Review'
                                ? 'Under Review'
                                : 'Incomplete'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {currentStatus === 'Completed' || currentStatus === 'Complete'
                            ? 'Signal verification audit completed and locked according to safety compliance protocol.'
                            : currentStatus === 'Under Review' || currentStatus === 'Under-Review'
                              ? 'Active review in progress by HSE governance team.'
                              : 'Signal audit incomplete or pending administrative sign-off.'}
                        </p>
                      </div>
                    </div>

                    {/* Read-Only Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                        Reviewer Audit Notes &amp; Corrective Directives:
                      </label>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-medium leading-relaxed shadow-2xs">
                        {reviewerNotes || 'Standard housekeeping and shift barrier monitoring.'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 italic pt-0.5">
                      <span>* Status updates and audit directive editing are restricted to HSE Administrators.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#EAE6E1] flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px] text-slate-500">Signal ID: {selectedSignal.signal_id} • API RP 754 Compliant</span>
              <button
                type="button"
                onClick={handleCloseDossier}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-xs transition-colors cursor-pointer text-xs"
              >
                Close Dossier
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
