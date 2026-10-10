import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  HelpCircle, 
  FileText, 
  Cpu, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  MapPin,
  RefreshCw,
  Layers,
  Flame,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  Bookmark,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import IncidentPostAnalysisMap from './maps/IncidentPostAnalysisMap';
import AdminNavigationModal from './maps/AdminNavigationModal';

export default function ReportDetailsView({ reportId, onBack }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdminNavModal, setShowAdminNavModal] = useState(false);
  
  // Feedback state
  const [feedbackStatus, setFeedbackStatus] = useState('CORRECT');
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (reportId) {
      loadReportDetails();
    }
  }, [reportId]);

  const loadReportDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReportById(reportId);
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load safety report details');
    } finally {
      setLoading(false);
    }
  };

  const handleReAnalyze = async () => {
    setLoading(true);
    try {
      await api.triggerAnalysis(reportId);
      await loadReportDetails();
    } catch (err) {
      setError(err.message || 'Re-analysis failed');
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      await api.submitFeedback(reportId, feedbackStatus, feedbackText);
      setFeedbackSuccess(true);
      setFeedbackText('');
      setTimeout(() => setFeedbackSuccess(false), 4000);
      await loadReportDetails();
    } catch (err) {
      alert(err.message || 'Feedback submission failed');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center max-w-4xl mx-auto">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span className="text-xs text-slate-500 font-mono">
          Loading safety report dossier & AI precursor diagnostics...
        </span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 space-y-4 max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 cursor-pointer font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to safety reports audit</span>
        </button>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error || 'Safety report not found or access denied.'}
        </div>
      </div>
    );
  }

  const analysis = report.ai_analysis;
  const isSifYes = analysis?.sif_precursor_assessment === 'YES';

  // Life-saving rule inference based on report content
  const descLower = (report.description || '').toLowerCase();
  let lsrInfo = {
    code: 'LSR-01',
    name: 'Energy Isolation (LOTO)',
    tagline: 'Verify isolation and zero energy before starting work',
    status: 'COMPROMISED',
    controls: ['Physical lock applied at breaker', 'Zero energy try-step performed', 'Isolation certificate approved']
  };

  if (descLower.includes('height') || descLower.includes('scaffold') || descLower.includes('fall') || descLower.includes('harness') || descLower.includes('ladder')) {
    lsrInfo = {
      code: 'LSR-02',
      name: 'Work at Height',
      tagline: 'Protect yourself against a fall when working at height',
      status: isSifYes ? 'VIOLATION / COMPROMISED' : 'VERIFICATION REQUIRED',
      controls: ['100% tie-off using approved double lanyard harness above 1.8m', 'Inspected and certified scaffolding with green tag', 'Toe-boards and mid-rails secured on working decks']
    };
  } else if (descLower.includes('crane') || descLower.includes('lift') || descLower.includes('rigging') || descLower.includes('sling') || descLower.includes('suspended')) {
    lsrInfo = {
      code: 'LSR-03',
      name: 'Safe Mechanical Lifting',
      tagline: 'Plan lifting operations and control the lift zone',
      status: isSifYes ? 'VIOLATION / COMPROMISED' : 'VERIFICATION REQUIRED',
      controls: ['Exclusion barricade established beneath suspended load', 'Certified lifting gear with valid inspection color code', 'Designated banksman directing crane movement']
    };
  } else if (descLower.includes('confined') || descLower.includes('tank') || descLower.includes('vessel') || descLower.includes('gas') || descLower.includes('h2s')) {
    lsrInfo = {
      code: 'LSR-05',
      name: 'Confined Space Entry',
      tagline: 'Obtain authorization before entering a confined space',
      status: isSifYes ? 'VIOLATION / COMPROMISED' : 'VERIFICATION REQUIRED',
      controls: ['Continuous atmospheric gas monitoring calibrated for multi-gas', 'Dedicated standby hole-watch stationed outside entry', 'Emergency extraction tripod and rescue plan ready']
    };
  } else if (descLower.includes('interlock') || descLower.includes('bypass') || descLower.includes('override') || descLower.includes('guard')) {
    lsrInfo = {
      code: 'LSR-06',
      name: 'Bypassing Safety Controls',
      tagline: 'Obtain authorization before overriding or disabling safety controls',
      status: 'VIOLATION / COMPROMISED',
      controls: ['Formal Management of Change (MOC) and bypass certificate', 'Compensatory human controls manned continuously', 'Warning signage on bypassed safety circuit']
    };
  } else if (descLower.includes('vehicle') || descLower.includes('forklift') || descLower.includes('truck') || descLower.includes('pedestrian')) {
    lsrInfo = {
      code: 'LSR-08',
      name: 'Driving & Mobile Plant',
      tagline: 'Follow road safety rules and maintain pedestrian segregation',
      status: isSifYes ? 'VIOLATION / COMPROMISED' : 'VERIFICATION REQUIRED',
      controls: ['Physical pedestrian walkways separated with bollards', 'Beacon lamp and reverse alarm operational', 'Designated marshaller during vehicle reversing']
    };
  }

  // Barrier Failure classification
  const barrierStatus = analysis?.barrier_information || 'BARRIER_UNKNOWN';
  let barrierHierarchy = 'Engineering Defense (Physical Barrier)';
  let barrierFailureMode = 'Intact or standard condition';
  if (barrierStatus === 'BARRIER_FAILED') {
    barrierFailureMode = 'Physical breakdown, material rupture, or mechanical interlock failure';
  } else if (barrierStatus === 'BARRIER_MISSING') {
    barrierFailureMode = 'Uninstalled, bypassed, omitted by procedure, or non-provided';
  } else if (barrierStatus === 'BARRIER_PRESENT') {
    barrierFailureMode = 'Barrier was in place; mitigative control reduced injury severity';
  }

  const riskScore = analysis?.risk_score || (isSifYes ? 85 : 25);
  const riskLevel = riskScore > 66 ? 'High Risk' : riskScore >= 33 ? 'Medium Risk' : 'Low Risk';
  const incidentLocation = {
    latitude: report.incident_latitude || 12.9716,
    longitude: report.incident_longitude || 77.5946,
    name: report.incident_location_name || report.location || 'Industrial Unit',
    address: report.incident_address || `${report.incident_location_name || report.location} Operating Area`
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6 bg-[#F8FAFC]">
      
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Safety Reports Audit</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReAnalyze}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Re-run AI Analysis</span>
          </button>
        </div>
      </div>

      {/* ================= 1. REPORT UNDERSTANDING SECTION ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        
        {/* Header Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold font-mono text-orange-600">
                {report.report_reference}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 font-mono">
                {report.report_type.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-4">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {report.location}
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {report.report_date}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 block font-semibold">
              SIF Precursor Verdict
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-black font-mono inline-block mt-0.5 ${
              isSifYes ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {analysis?.sif_precursor_assessment || 'PENDING'}
            </span>
          </div>
        </div>

        {/* Narrative Description */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            Original Safety Observation Narrative
          </h3>
          <p className="text-xs text-slate-800 bg-slate-50/80 p-4 rounded-xl border border-slate-200 leading-relaxed">
            {report.description}
          </p>
        </div>

        {/* Incident Location Map & Admin Navigation (Requirement 8) */}
        <div className="pt-2">
          <IncidentPostAnalysisMap
            incidentLocation={incidentLocation}
            riskScore={riskScore}
            riskLevel={riskLevel}
            incidentType={report.report_type?.replace('_', ' ') || 'Incident'}
            reportName={report.report_reference}
            onNavigate={() => setShowAdminNavModal(true)}
            isAdmin={true}
          />
        </div>

        {/* Structured Understanding Grid */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-700 font-heading">
            Structured Understanding Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Identified Action</span>
              <span className="font-bold text-slate-900 block">
                {analysis?.identified_action || 'Operational Task Execution'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Physical Condition</span>
              <span className="font-bold text-slate-900 block">
                {analysis?.identified_condition || 'Substandard Field State'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Energy Vector</span>
              <span className="font-bold text-slate-900 block truncate" title={analysis?.energy_source || 'Mechanical/Gravity'}>
                {analysis?.energy_source || 'High-Energy Potential'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">Shift / Environment</span>
              <span className="font-medium text-slate-700 block truncate">
                {report.additional_context || 'Standard Operational Conditions'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= 2. BARRIER FAILURE ANALYSIS ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Barrier Failure & Defense Diagnostics
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Hierarchy of Controls & Physical Barrier Integrity Assessment
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono ${
            barrierStatus === 'BARRIER_FAILED' ? 'bg-rose-100 text-rose-800' :
            barrierStatus === 'BARRIER_MISSING' ? 'bg-amber-100 text-amber-800' :
            'bg-emerald-100 text-emerald-800'
          }`}>
            {barrierStatus.replace('BARRIER_', '')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Defense Classification</span>
            <span className="font-bold text-slate-900 block">{barrierHierarchy}</span>
            <span className="text-[11px] text-slate-500 block">Primary hard safeguard</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Failure Mechanism</span>
            <span className="font-bold text-slate-900 block">{barrierFailureMode}</span>
            <span className="text-[11px] text-slate-500 block">Identified from report description</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Pre-event vs Mitigative</span>
            <span className="font-bold text-slate-900 block">
              {isSifYes ? 'Pre-event Barrier Collapsed' : 'Mitigative Safeguards Maintained'}
            </span>
            <span className="text-[11px] text-slate-500 block">Potential consequence barrier chain</span>
          </div>
        </div>
      </div>

      {/* ================= 3. LIFE-SAVING RULE MAPPING ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Life-Saving Rule (LSR) Protocol Mapping
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Standard IOGP / OSHA 9 Life-Saving Rules Framework
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
            {lsrInfo.code}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-orange-50/40 border border-orange-200/80 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 font-heading">
                {lsrInfo.name}
              </h4>
              <p className="text-xs text-slate-600 italic mt-0.5">
                "{lsrInfo.tagline}"
              </p>
            </div>
            <span className={`self-start sm:self-center px-2.5 py-1 rounded text-[10px] font-black font-mono ${
              lsrInfo.status.includes('VIOLATION') || lsrInfo.status.includes('COMPROMISED')
                ? 'bg-rose-600 text-white'
                : 'bg-amber-500 text-white'
            }`}>
              {lsrInfo.status}
            </span>
          </div>

          <div className="pt-2 border-t border-orange-200/60">
            <span className="text-[11px] font-bold font-mono text-slate-700 block mb-1.5">
              Mandatory Controls Mandated by Rule:
            </span>
            <ul className="space-y-1 text-xs text-slate-700">
              {lsrInfo.controls.map((ctrl, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                  <span>{ctrl}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ================= 4. EXPLAINABLE AI: WHY AI IDENTIFIED THIS ================= */}
      <div className={`rounded-2xl border p-6 sm:p-8 space-y-5 shadow-xs ${
        isSifYes ? 'bg-orange-50/30 border-orange-200' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-slate-900 font-heading">
              Explainable AI: Why AI Identified This Precursor
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
            Transparent Audit Trail
          </span>
        </div>

        {/* Narrative Explanation */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed shadow-2xs font-sans">
          {analysis?.explanation || 'No detailed reasoning provided.'}
        </div>

        {/* Causal Chain Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-mono text-orange-600 font-bold">
              <span>01.</span>
              <span>ENERGY VECTOR</span>
            </div>
            <p className="text-slate-700 font-medium">
              {analysis?.energy_source || 'Gravitational / Kinetic Energy'} was actively present in the work envelope.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-mono text-rose-600 font-bold">
              <span>02.</span>
              <span>DEFENSE COMPROMISE</span>
            </div>
            <p className="text-slate-700 font-medium">
              Physical barriers were {barrierStatus.replace('BARRIER_', '').toLowerCase()} during task execution.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-mono text-purple-600 font-bold">
              <span>03.</span>
              <span>CONSEQUENCE</span>
            </div>
            <p className="text-slate-700 font-medium">
              {analysis?.potential_consequence || 'Potential irreversible personnel injury if uncontrolled.'}
            </p>
          </div>
        </div>

        {/* Highlighted Safety Signals */}
        {analysis?.safety_signals && analysis.safety_signals.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider block">
              Grounded Safety Signals Identified in Text:
            </span>
            <div className="flex flex-wrap gap-2">
              {analysis.safety_signals.map((sig, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-100/70 border border-orange-200 text-orange-900 text-xs font-medium">
                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                  <span>{sig}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= 5. HSE SPECIALIST VALIDATION & AUDIT FEEDBACK ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900 font-heading">
              HSE Specialist Validation & Audit Review
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Human-in-the-Loop Governance
          </span>
        </div>

        {feedbackSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>HSE validation feedback recorded successfully and persisted to organization database.</span>
          </div>
        )}

        <form onSubmit={handleFeedbackSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              HSE Officer Assessment Verdict:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'CORRECT', label: 'Validate AI Assessment (Agree)', desc: 'Precursor rating and barrier status match field findings' },
                { id: 'PARTIALLY_CORRECT', label: 'Partially Correct', desc: 'Precursor flagged correctly but barrier details require tweak' },
                { id: 'INCORRECT', label: 'Challenge AI Assessment', desc: 'Precursor status should be downgraded or upgraded' },
              ].map((fb) => (
                <button
                  type="button"
                  key={fb.id}
                  onClick={() => setFeedbackStatus(fb.id)}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    feedbackStatus === fb.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold">{fb.label}</div>
                  <div className={`text-[10px] mt-1 ${feedbackStatus === fb.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {fb.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              HSE Officer Investigation Notes / Corrective Actions:
            </label>
            <textarea
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter validation rationale, corrective work orders raised, or field verification notes..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={submittingFeedback}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-all shadow-xs disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submittingFeedback ? 'Saving Review...' : 'Submit HSE Validation'}</span>
          </button>
        </form>

        {/* Previous Feedback Log */}
        {report.feedbacks && report.feedbacks.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 font-heading">
              Logged Validation History ({report.feedbacks.length})
            </h4>
            <div className="space-y-2">
              {report.feedbacks.map((fb, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px]">
                      {fb.feedback_status}
                    </span>
                    <p className="text-slate-600 mt-1">
                      {fb.feedback_text || 'No additional note provided'}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Admin Navigation Modal */}
      <AdminNavigationModal
        isOpen={showAdminNavModal}
        onClose={() => setShowAdminNavModal(false)}
        incidentLocation={incidentLocation}
        riskScore={riskScore}
        riskLevel={riskLevel}
        incidentType={report.report_type?.replace('_', ' ') || 'Incident'}
      />

    </div>
  );
}
