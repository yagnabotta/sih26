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
  ArrowDown,
  SlidersHorizontal,
  Info,
  Lock,
  MapPin,
  Play
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
  
  // Dossier Modal State
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [signalDetail, setSignalDetail] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('Under Review');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [hasNotesEdits, setHasNotesEdits] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewToast, setReviewToast] = useState(null);

  // Correlated Multi-Record Identification (Strictly based on actual signal source records)
  const activeRecords = useMemo(() => {
    if (!selectedSignal) return [];
    
    // Check if signal has explicit source_reports or signals
    const rawList = signalDetail?.source_reports || selectedSignal?.source_reports || signalDetail?.signals || selectedSignal?.signals || [];
    return rawList.map((rep, idx) => ({
      ref: rep.report_id || rep.report_reference || (rep.id ? `REP-${rep.id}` : `S${idx + 1}`),
      name: rep.pattern_identified || rep.short_description || rep.description || selectedSignal.title,
      unit: rep.unit || rep.facility_unit || rep.location || 'Operating Area',
      excerpt: rep.excerpt || rep.short_description || rep.description || 'Field observation logged.'
    }));
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
        setSummary(backendData.summary || {
          total_active_signals: backendData.weak_signals.length,
          high_risk_precursors: backendData.weak_signals.filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
          escalating_patterns: backendData.weak_signals.filter(s => s.risk_score && s.risk_score >= 80).length,
          average_confidence: backendData.weak_signals.length > 0 ? (backendData.summary?.average_confidence || 90.0) : 0,
          total_clusters: Array.isArray(backendData.emerging_clusters) ? backendData.emerging_clusters.length : 0
        });
        setSignals(backendData.weak_signals);
        if (Array.isArray(backendData.emerging_clusters)) {
          setClusters(backendData.emerging_clusters);
        } else {
          // Derive clusters from signals with cluster_detected ONLY if >= 2 signals
          const derived = backendData.weak_signals
            .filter(s => s.cluster_detected && ((s.signals && s.signals.length >= 2) || (s.source_reports && s.source_reports.length >= 2)))
            .map((sig, idx) => ({
              id: idx + 1,
              cluster_id: `CL-${String(idx + 1).padStart(2, '0')}`,
              cluster_title: `EMERGING ${(sig.combined_risk || 'HIGH').toUpperCase()}-RISK CLUSTER: ${sig.relationship || sig.title}`,
              title: sig.relationship || sig.title,
              relationship: sig.relationship || sig.title,
              signals: (sig.signals || (sig.source_reports || []).map((r, i) => ({
                signal_num: i + 1,
                report_id: r.report_id || `SIG-0${i+1}`,
                description: r.short_description || r.excerpt || r.description || '',
                individual_risk: r.individual_risk || 'MEDIUM',
                location: r.unit || r.location || 'Operating Area'
              }))),
              individual_risk_levels: sig.signals?.map((s, i) => `Signal ${i+1}: ${s.risk_level || s.individual_risk || 'MEDIUM'}`).join(', ') || 'Signal 1: MEDIUM, Signal 2: MEDIUM/HIGH',
              location: sig.location || (sig.source_reports?.[0]?.unit) || 'Operating Area',
              time_relationship: sig.time_relationship || 'Active operational window',
              correlation_score: sig.correlation_score || sig.risk_score || 85,
              potential_consequence: sig.potential_consequence || sig.potential_sif_precursor || 'Compound Hazard Escalation',
              combined_risk: (sig.combined_risk || 'HIGH').toUpperCase(),
              danger: sig.danger || 'Elevated compound risk identified by interaction of multiple hazard vectors.',
              root_cause: sig.root_cause || 'Concurrent breakdown or compromise of independent defensive barriers.',
              reason: sig.reason || sig.why_identified || 'Hazard interaction between co-located signals.',
              recommended_action: sig.recommended_action || sig.key_learnings || 'Immediately inspect and isolate affected area.',
              progression_steps: sig.progression_steps || []
            }));
          setClusters(derived);
        }
      } else {
        const stored = getStoredWeakSignals();
        setSignals(stored || []);
        setClusters([]);
        setSummary({
          total_active_signals: (stored || []).length,
          high_risk_precursors: (stored || []).filter(s => s.risk_level === 'High' || (s.risk_score && s.risk_score >= 90)).length,
          escalating_patterns: (stored || []).filter(s => s.risk_score && s.risk_score >= 80).length,
          average_confidence: (stored && stored.length > 0) ? 95.8 : 0,
          total_clusters: 0
        });
      }
    } catch (err) {
      console.error('Failed to load weak signals:', err);
      const stored = getStoredWeakSignals();
      setSignals(stored || []);
      setClusters([]);
      setSummary({
        total_active_signals: (stored || []).length,
        high_risk_precursors: 0,
        escalating_patterns: 0,
        average_confidence: 0,
        total_clusters: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const SCENARIOS = [
    {
      id: 'gas_heater',
      name: 'Case 1: Gas Leak + Heater (Ignition Source)',
      badge: 'FIRE / EXPLOSION',
      reports: [
        {
          report_id: 'REP-01',
          description: 'High-pressure gas pipeline flange suffered severe leakage with loud hissing in compressor room.',
          location: 'Unit 1 Operating Bay',
          report_type: 'Near Miss',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-02',
          description: 'Operating workshop heater detected running 3 meters from compressor room pipeline.',
          location: 'Unit 1 Operating Bay',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'oil_slip',
      name: 'Case 2: Hydraulic Oil Leak + Slip Exposure',
      badge: 'SLIP / FALL',
      reports: [
        {
          report_id: 'REP-03',
          description: 'Hydraulic oil leak observed pooling beneath pump coupling P-102 onto walkway.',
          location: 'Unit 2 Pump Bay',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-04',
          description: 'Worker slipped on oily floor near walkway, lost footing and suffered wrist strain.',
          location: 'Unit 2 Pump Bay',
          report_type: 'Near Miss',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'elec_proximity',
      name: 'Case 3: Damaged Cable + Worker Proximity',
      badge: 'ARC FLASH / SHOCK',
      reports: [
        {
          report_id: 'REP-05',
          description: 'Electrical power cable has damaged insulation exposing live copper conductor.',
          location: 'Substation Bay',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-06',
          description: 'Technician was working in close proximity to the exposed live conductor without protective insulation.',
          location: 'Substation Bay',
          report_type: 'Unsafe Act',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'fall_guardrail',
      name: 'Case 4: Worker at Height + Missing Guardrail',
      badge: 'FALL FROM HEIGHT',
      reports: [
        {
          report_id: 'REP-07',
          description: 'Worker observed working at height on elevated platform 6 meters above ground.',
          location: 'Platform 3 Elevated Deck',
          report_type: 'Unsafe Act',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-08',
          description: 'Perimeter guardrail was missing on the elevated work deck with no fall protection in place.',
          location: 'Platform 3 Elevated Deck',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'chemical_exposure',
      name: 'Case 5: Chemical Leak + Worker Exposure',
      badge: 'CHEMICAL INJURY',
      reports: [
        {
          report_id: 'REP-09',
          description: 'Chemical drum leaking acid solution onto the floor emitting caustic fumes.',
          location: 'Chemical Dosing Bay',
          report_type: 'Near Miss',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-10',
          description: 'Worker was directly exposed to chemical fumes without respiratory PPE.',
          location: 'Chemical Dosing Bay',
          report_type: 'Unsafe Act',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'gas_damaged_wiring',
      name: 'Case 6: Gas Leak + Damaged Wiring (Passive)',
      badge: 'LATENT / CONDITIONAL',
      reports: [
        {
          report_id: 'REP-11',
          description: 'Gas pipeline leaking methane vapor near workshop cable tray.',
          location: 'Unit 1 Compressor Area',
          report_type: 'Near Miss',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-12',
          description: 'Damaged electrical wiring present nearby with cracked insulation along the tray.',
          location: 'Unit 1 Compressor Area',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'unrelated',
      name: 'Case 7: Unrelated Observations (Independent)',
      badge: 'REJECTED (NO CLUSTER)',
      reports: [
        {
          report_id: 'REP-13',
          description: 'Slip hazard due to water puddle on warehouse floor.',
          location: 'Warehouse A',
          report_type: 'Unsafe Condition',
          report_date: '2026-09-08'
        },
        {
          report_id: 'REP-14',
          description: 'Minor vibration noticed on compressor C-101.',
          location: 'Unit 3 Compressor Room',
          report_type: 'Routine',
          report_date: '2026-09-08'
        }
      ]
    },
    {
      id: 'single_observation',
      name: 'Case 8: Single Safety Observation',
      badge: 'SINGLE PRECURSOR',
      reports: [
        {
          report_id: 'REP-15',
          description: 'Pressurized gas pipeline flange suffered severe leakage with loud hissing in compressor room.',
          location: 'Unit 1 Operating Bay',
          report_type: 'Near Miss',
          report_date: '2026-09-08'
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

  useEffect(() => {
    loadWeakSignals();

    // Reactive subscription to safetyStore so any status, field changes, or new weak signals reflect automatically
    const unsub = subscribeSafetyStore(() => {
      loadWeakSignals();
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

    const matchesRisk = riskFilter === 'ALL' || (sig.risk_level || '').toLowerCase() === riskFilter.toLowerCase();

    return matchesSearch && matchesRisk;
  });

  // Risk count helpers
  const highRiskCount = summary?.high_risk_count ?? signals.filter(s => s.risk_level === 'High').length;
  const medRiskCount = summary?.medium_risk_count ?? signals.filter(s => s.risk_level === 'Medium').length;
  const lowRiskCount = summary?.low_risk_count ?? signals.filter(s => s.risk_level === 'Low').length;

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

        <div className="flex items-center gap-3">
          <button
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
              onClick={() => setRiskFilter('High')}
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
              onClick={() => setRiskFilter('Medium')}
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
              onClick={() => setRiskFilter('Low')}
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

      {/* ================= 2.5 EMERGING RISK CLUSTERS (AI MULTI-SIGNAL INTERACTION ENGINE) ================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 text-rose-600 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-slate-900 tracking-tight flex items-center gap-2">
                <span>Emerging Risk Clusters</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {clusters.length} Active Hazard Combinations
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-report hazard interactions detected by AI Safety Engine where individually small or medium deviations compound into high-severity SIF consequences.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLiveTester(!showLiveTester)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A]" />
              <span>{showLiveTester ? 'Hide Correlation Sandbox' : 'Test Signal Correlation'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Interactive Signal Correlation Sandbox (Testing Multi-Report Dynamics) */}
        {showLiveTester && (
          <div className="p-5 rounded-2xl bg-[#FFF8F6] border-2 border-orange-200 space-y-4 shadow-sm animate-in fade-in duration-200 text-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-[#FF5A36]" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-heading uppercase tracking-wide">
                  Live Hazard Correlation Sandbox (Physics-Based API Verification)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-orange-700 bg-orange-100 px-2 py-0.5 rounded font-bold">
                POST /api/weak-signals/correlate-reports
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Test how the AI Correlation Engine evaluates multiple co-occurring observations. Select a predefined test scenario to verify that related hazards escalate into critical consequences while unrelated hazards remain isolated.
            </p>

            {/* Quick Test Scenario Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  disabled={testingScenario}
                  onClick={() => runCorrelationTest(sc)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                    activeScenarioName === sc.name
                      ? 'bg-white border-[#FF5A36] shadow-sm ring-2 ring-[#FF5A36]/20'
                      : 'bg-white border-stone-200 hover:border-orange-300 hover:bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-orange-600 uppercase">
                      {sc.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sc.reports.length} Reports
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 line-clamp-1">
                    {sc.name}
                  </div>
                </button>
              ))}
            </div>

            {/* Test Execution Output */}
            {testingScenario && (
              <div className="p-4 rounded-xl bg-white border border-stone-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#FF5A36]" />
                <span>Executing multi-signal correlation algorithm via backend engine...</span>
              </div>
            )}

            {sandboxError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                {sandboxError}
              </div>
            )}

            {sandboxResult && !testingScenario && (
              <div className="p-4 rounded-xl bg-white border-2 border-stone-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${sandboxResult.cluster_detected ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="font-bold text-xs text-slate-900">
                      Live Result: {sandboxResult.relationship}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      sandboxResult.cluster_detected ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      Cluster Detected: {String(sandboxResult.cluster_detected).toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white ${
                      sandboxResult.combined_risk === 'CRITICAL' ? 'bg-rose-600' : sandboxResult.combined_risk === 'HIGH' ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {sandboxResult.combined_risk}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10.5px] uppercase font-bold text-slate-400">Potential Consequence:</span>
                    <div className="font-bold text-slate-900">{sandboxResult.potential_consequence}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10.5px] uppercase font-bold text-slate-400">Correlation Score:</span>
                    <div className="font-mono font-extrabold text-orange-600">{sandboxResult.correlation_score}/100</div>
                  </div>
                </div>

                {(sandboxResult.danger || sandboxResult.root_cause) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {sandboxResult.danger && (
                      <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Identified Hazard / Danger:</span>
                        </span>
                        <p className="text-rose-950 leading-snug">{sandboxResult.danger}</p>
                      </div>
                    )}
                    {sandboxResult.root_cause && (
                      <div className="p-2.5 rounded-lg bg-orange-50/60 border border-orange-200 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-orange-800 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-orange-600" />
                          <span>Systemic Root Cause:</span>
                        </span>
                        <p className="text-orange-950 leading-snug">{sandboxResult.root_cause}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400">Reason / Hazard Interaction:</span>
                  <p className="text-slate-700 leading-relaxed">{sandboxResult.reason}</p>
                </div>

                {sandboxResult.recommended_action && (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 font-medium">
                    <strong className="text-emerald-800 mr-1.5 uppercase font-bold text-[10.5px]">Recommended Action:</strong>
                    <span>{sandboxResult.recommended_action}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cluster Cards Grid */}
        {clusters.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-xs text-slate-500 space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800 text-sm tracking-wide uppercase font-heading">
              NO EMERGING RISK SIGNALS YET
            </p>
            <p className="text-slate-500 max-w-lg mx-auto">
              Submit safety observations to allow the AI Safety Engine to identify relationships and emerging risk clusters.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {clusters.map((cluster) => (
              <div 
                key={cluster.id || cluster.cluster_id}
                className="rounded-2xl bg-white border-2 border-[#EAE6E1] hover:border-orange-300 p-5 sm:p-6 shadow-xs space-y-4 transition-all duration-300 text-slate-800"
              >
                {/* 1. Cluster Header: Title, Risk Badge, Location, Time Proximity, Correlation Score */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-stone-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${
                        cluster.combined_risk === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        EMERGING {cluster.combined_risk}-RISK CLUSTER
                      </span>
                      <span className="text-xs font-mono text-slate-600 font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {cluster.location}
                      </span>
                      {cluster.time_relationship && (
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {cluster.time_relationship}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-heading">
                      {cluster.relationship || cluster.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Correlation Score</div>
                      <div className="text-sm font-mono font-extrabold text-[#FF5A36]">
                        {cluster.correlation_score}/100
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCluster(cluster)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF5A36] hover:from-[#ff5934] hover:to-[#e64a27] text-white font-bold text-xs shadow-md shadow-orange-500/20 shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <span>Examine Cluster</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Related Safety Reports / Signals Breakdown with Individual Risk Levels */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-orange-600" />
                      Interacting Safety Signals ({cluster.signals?.length || 2} Connected Observations):
                    </span>
                    <span className="font-mono text-[10.5px] text-slate-500">
                      Individual Risk Levels
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(cluster.signals || []).map((sig, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <div className="p-3 rounded-xl bg-white border border-[#EAE6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-200 text-[#FF5A36] text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                              S{sig.signal_num || sIdx + 1}
                            </span>
                            <div>
                              <div className="font-mono text-[10.5px] text-slate-500 font-bold flex items-center gap-2">
                                <span>{sig.report_id}</span>
                                {sig.location && <span>• {sig.location}</span>}
                              </div>
                              <div className="text-xs text-slate-800 font-medium mt-0.5 leading-snug">
                                "{sig.description}"
                              </div>
                            </div>
                          </div>
                          <div className="self-end sm:self-center shrink-0">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                              sig.individual_risk === 'HIGH' || sig.individual_risk === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : sig.individual_risk === 'MEDIUM' || sig.individual_risk === 'MEDIUM/HIGH'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Risk: {sig.individual_risk}
                            </span>
                          </div>
                        </div>

                        {sIdx < (cluster.signals || []).length - 1 && (
                          <div className="flex items-center justify-center py-0.5">
                            <span className="w-5 h-5 rounded-full bg-stone-200 text-slate-600 text-xs font-black flex items-center justify-center shadow-2xs">
                              +
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* 3. Down-arrow indicating Escalation */}
                <div className="flex items-center justify-center py-0.5 text-slate-400">
                  <ArrowDown className="w-4 h-4 text-orange-500 animate-bounce" />
                </div>

                {/* 4. Compound Consequence & Escalated Risk Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 via-rose-50/60 to-orange-50/40 border-2 border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                      <Flame className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-rose-800">
                        Potential Combined Consequence
                      </div>
                      <div className="text-sm sm:text-base font-black text-rose-950 font-heading">
                        {cluster.potential_consequence}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Combined Escalated Risk</div>
                      <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black tracking-wider border shadow-2xs ${
                        cluster.combined_risk === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-500 text-white border-amber-600'
                      }`}>
                        {cluster.combined_risk}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Danger & Root Cause Callouts */}
                {(cluster.danger || cluster.root_cause) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {cluster.danger && (
                      <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-1">
                        <span className="text-[10.5px] uppercase font-bold text-rose-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Identified Hazard / Danger:</span>
                        </span>
                        <p className="text-rose-950 text-xs leading-relaxed">{cluster.danger}</p>
                      </div>
                    )}
                    {cluster.root_cause && (
                      <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200/80 space-y-1">
                        <span className="text-[10.5px] uppercase font-bold text-orange-800 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>Systemic Root Cause:</span>
                        </span>
                        <p className="text-orange-950 text-xs leading-relaxed">{cluster.root_cause}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Reason & Recommended Action */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Hazard Interaction Reason (Why Related):</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {cluster.reason}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Recommended Safety Action:</span>
                    </div>
                    <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                      {cluster.recommended_action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700 text-sm">No weak safety signals logged yet.</p>
            <p className="text-slate-400">Submit safety observations to begin tracking early precursors and latent hazards.</p>
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
                        signal.risk_level === 'High' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : signal.risk_level === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {signal.risk_level?.toUpperCase()} RISK
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
                      <span>Examine Weak Signal Dossier</span>
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

              {/* 5-Step Progression Timeline */}
              {selectedCluster.progression_steps && selectedCluster.progression_steps.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Chronological Hazard Progression Pathway (5 Stages)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {selectedCluster.progression_steps.map((st, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-white border border-[#EAE6E1] space-y-1 text-center shadow-2xs">
                        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase">{st.step}</div>
                        <div className={`text-[10px] font-extrabold ${
                          st.trend === 'Increasing' ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {st.trend}
                        </div>
                        <p className="text-[10.5px] text-slate-600 text-left pt-0.5 leading-snug line-clamp-3">
                          {st.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danger & Root Cause Callouts */}
              {(selectedCluster.danger || selectedCluster.root_cause) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedCluster.danger && (
                    <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
                      <span className="text-[11px] uppercase font-bold text-rose-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Identified Hazard / Danger:</span>
                      </span>
                      <p className="text-rose-950 text-xs leading-relaxed">{selectedCluster.danger}</p>
                    </div>
                  )}
                  {selectedCluster.root_cause && (
                    <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 space-y-1">
                      <span className="text-[11px] uppercase font-bold text-orange-800 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>Systemic Root Cause:</span>
                      </span>
                      <p className="text-orange-950 text-xs leading-relaxed">{selectedCluster.root_cause}</p>
                    </div>
                  )}
                </div>
              )}

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

              {/* Signal Progression Timeline */}
              {selectedSignal.progression_steps && selectedSignal.progression_steps.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Signal Progression Timeline
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Trend: <span className="text-amber-600 font-extrabold">{selectedSignal.trend}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {selectedSignal.progression_steps.map((step, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-white border border-[#EAE6E1] text-center space-y-1 shadow-2xs">
                        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase">{step.step}</div>
                        <div className={`text-[10px] font-extrabold ${
                          step.trend === 'Increasing' ? 'text-rose-600' : step.trend === 'Decreasing' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {step.trend}
                        </div>
                        <p className="text-[10px] text-slate-600 leading-tight line-clamp-3 text-left pt-0.5">
                          {step.status}
                        </p>
                      </div>
                    ))}
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
