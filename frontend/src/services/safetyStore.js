// safetyStore.js - Centralized, Reactive Safety Data Engine
// Powers real-time sync across Dashboard, Bulk Upload, SIF Precursors, All Reports & Weak Signals

const STORAGE_REPORTS_KEY = 'safetyai_active_reports';
const STORAGE_PRECURSORS_KEY = 'safetyai_admin_precursors_data';
const STORAGE_WIPED_KEY = 'safetyai_data_wiped_fresh';
const STORAGE_WEAK_SIGNALS_KEY = 'safetyai_weak_signals_data';
const STORAGE_RESET_VERSION_KEY = 'safetyai_reset_version';
const CURRENT_RESET_VERSION = 'v12_zero_operational_data_sync';

// Perform clean slate reset on load if not on current reset version
try {
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem(STORAGE_RESET_VERSION_KEY) !== CURRENT_RESET_VERSION) {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_WEAK_SIGNALS_KEY, JSON.stringify([]));
      localStorage.setItem('SAFETY_TOTAL_REPORTS_V3', JSON.stringify([]));
      localStorage.setItem(STORAGE_WIPED_KEY, 'true');
      localStorage.setItem(STORAGE_RESET_VERSION_KEY, CURRENT_RESET_VERSION);
    }
  }
} catch (e) {}

// Subscribed components listeners
const listeners = new Set();

function notifySubscribers() {
  const data = getStoreState();
  listeners.forEach((listener) => {
    try {
      listener(data);
    } catch (err) {
      console.error('Error notifying safetyStore listener:', err);
    }
  });
}

// Get dynamic today's date formatted as YYYY-MM-DD
export function getTodayDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Operational unit normalization helper
// Accurately recognizes matching units (e.g. "Unit 01", "Unit 1", "Unit 1 - CDU", "Unit-01" -> "unit-1")
export function extractUnitKey(val) {
  if (!val) return '';
  const str = String(val).trim().toLowerCase();
  const unitMatch = str.match(/unit\s*[-_#]?\s*0*(\d+)/i);
  if (unitMatch) {
    return `unit-${parseInt(unitMatch[1], 10)}`;
  }
  return str.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Zero predefined operational records
export const DEFAULT_20_SAMPLE_RECORDS = [];


// Check if a report contains severe energy or SIF markers (deterministic, no random variance)
export function evaluateSIFPrecursor(text, hazard, reportType) {
  const clean = (text || '').trim().toLowerCase();
  const trivialGreetings = [
    'hi', 'hii', 'hiii', 'hello', 'hey', 'heyy', 'test', 'testing', 'asdf', 
    'qwerty', 'abc', 'none', 'ok', 'okay', 'nothing', 'nil', 'na', 'n/a', 
    'not applicable', 'no issue', 'no issues', 'no hazard', 'nothing to report',
    'all good', 'good', 'fine', 'clean', 'normal', 'blank', 'null', 'nothin'
  ];
  
  const combined = `${text || ''} ${hazard || ''} ${reportType || ''}`.toLowerCase();
  
  const highEnergyKeywords = [
    'high-pressure', 'high pressure', 'flange', 'blowout', 'explosion', 'vapor cloud',
    'crane', 'hoist', 'rigging', 'dropped', 'casing', 'suspended load', 'sling',
    'electrical', '11kv', '415v', 'arc flash', 'switchgear', 'loto', 'zero-energy',
    'fall', 'height', 'scaffold', 'harness', 'toxic', 'h2s', 'gas leak', 'leaking gas',
    'fire', 'flame', 'spark', 'welding', 'flash fire', 'confined space', 'oxygen',
    'steam', 'acid', 'chemical', 'pulley'
  ];

  const match = highEnergyKeywords.find((kw) => combined.includes(kw));

  // If trivial greeting, unrelated input, or very short string without safety context
  const isTrivial = trivialGreetings.includes(clean) || 
                    clean.startsWith('nothing') || 
                    clean.startsWith('no issue') || 
                    clean.startsWith('no hazard') || 
                    clean.startsWith('all good') ||
                    (clean.length < 6 && !match);

  if (isTrivial) {
    return {
      isSIF: false,
      matchedKeyword: 'None',
      riskScore: 0,
      isInsufficient: true
    };
  }

  let score = 45;
  if (match) {
    if (combined.includes('explosion') || combined.includes('asphyxiation') || combined.includes('blowout')) score = 97;
    else if (combined.includes('dropped') || combined.includes('casing') || combined.includes('sling')) score = 96;
    else if (combined.includes('11kv') || combined.includes('loto') || combined.includes('gas leak')) score = 95;
    else if (combined.includes('arc flash') || combined.includes('switchboard') || combined.includes('steam')) score = 94;
    else if (combined.includes('fall') || combined.includes('scaffold') || combined.includes('height')) score = 93;
    else if (combined.includes('fire') || combined.includes('welding') || combined.includes('acid')) score = 91;
    else score = 89;
  } else {
    if (combined.includes('hydraulic') || combined.includes('grating')) score = 65;
    else if (combined.includes('ladder') || combined.includes('shower')) score = 55;
    else score = 42;
  }

  return {
    isSIF: Boolean(match),
    matchedKeyword: match || 'None',
    riskScore: score,
    isInsufficient: false
  };
}


// Get state from localStorage - stable and persistent without dynamic data resets
export function getStoreState() {
  let reports = [];
  let precursors = [];

  const isWiped = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_WIPED_KEY) === 'true';
  if (isWiped) {
    return {
      reports: [],
      precursors: [],
      weakSignals: [],
      isWiped: true,
      totalCount: 0
    };
  }

  try {
    const rawReports = localStorage.getItem(STORAGE_REPORTS_KEY);
    if (rawReports) {
      reports = JSON.parse(rawReports);
    }
  } catch (e) {
    reports = [];
  }

  try {
    const rawPrecursors = localStorage.getItem(STORAGE_PRECURSORS_KEY);
    if (rawPrecursors) {
      precursors = JSON.parse(rawPrecursors);
    }
  } catch (e) {
    precursors = [];
  }

  return {
    reports: reports || [],
    precursors: precursors || [],
    weakSignals: getStoredWeakSignals(),
    isWiped: !reports || reports.length === 0,
    totalCount: reports ? reports.length : 0
  };
}

// Clear whole existing static and operational data (complete wipe for both Admin and User dashboards)
export async function clearAllSafetyData() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_WEAK_SIGNALS_KEY, JSON.stringify([]));
      localStorage.setItem('SAFETY_TOTAL_REPORTS_V3', JSON.stringify([]));
      localStorage.setItem('safetyai_admin_precursors_v2', JSON.stringify([]));
      localStorage.setItem('safetyai_admin_precursors_data', JSON.stringify([]));
      localStorage.setItem('safetyai_precursors_data', JSON.stringify([]));
      localStorage.setItem(STORAGE_WIPED_KEY, 'true');
    }
  } catch (e) {
    console.error('Failed to wipe data in localStorage:', e);
  }

  // Also wipe backend database records (safety_reports, ai_analyses, feedbacks, weak_signals)
  try {
    const { api } = await import('./api');
    if (api && typeof api.resetBaseline === 'function') {
      await api.resetBaseline();
    }
  } catch (e) {
    console.warn('Backend database reset call:', e);
  }

  notifySubscribers();
  return { success: true, message: 'All safety records, precursor findings, and operational data successfully removed across Admin and User views.' };
}

// Ingest records from uploaded file (CSV / JSON) and analyze starting from today
export async function ingestBatchReports(rawRecords, replaceExisting = true) {
  const todayStr = getTodayDateString();
  const existingReports = replaceExisting ? [] : (getStoreState().reports || []);
  const existingPrecursors = replaceExisting ? [] : (getStoreState().precursors || []);

  const newReports = [];
  const newPrecursors = [];
  const startingCount = existingReports.length;

  rawRecords.forEach((row, idx) => {
    // Automatically generate reference ID in REP-ID001-XXXX format if not present in CSV
    const ref = row.Reference || row.reference || row.ref || `REP-ID001-${String(startingCount + idx + 1).padStart(4, '0')}`;
    const reportDate = row.Date || row.date || todayStr;
    const site = row.Site || row.site || row.location || 'Unit 1';
    const reportType = row['Report Type'] || row.report_type || row.type || 'Near Miss';
    // Gracefully handle descriptions (trim and limit to 999,999 chars without dropping records)
    const rawDesc = (row.Description || row.description || row.desc || row.Observation || row.observation || '').trim();
    const description = rawDesc.slice(0, 999999) || 'Safety observation reported for evaluation.';
    const hazard = row.Hazard || row.hazard || row.Risk || 'Operational Safety Finding';

    const evalResult = evaluateSIFPrecursor(description, hazard, reportType);
    const isSIF = evalResult.isSIF;
    const riskScore = evalResult.riskScore;

    // Normalizing Report model
    const reportItem = {
      id: Date.now() + idx,
      report_reference: ref,
      report_type: reportType,
      description: description,
      location: site,
      facility_unit: site,
      report_date: reportDate,
      risk_level: isSIF ? 'Critical' : 'Low',
      sif_precursor_assessment: isSIF ? 'YES' : 'NO',
      ai_score: riskScore,
      status: 'Under Review', // Initially Under Review
      identified_hazard: hazard,
      energy_source: isSIF ? 'High Energy Vector' : 'Low Mechanical Kinetic',
      barrier_status: isSIF ? 'CRITICAL BARRIER FAILED' : 'BARRIER ADEQUATE',
      recommended_action: isSIF ? 'Immediate physical barrier enforcement and audit.' : 'Routine housekeeping and shift review.',
      created_at: new Date().toISOString()
    };

    newReports.push(reportItem);

    // If classified as SIF, create a SIF Precursor item
    if (isSIF) {
      newPrecursors.push({
        id: reportItem.id,
        precursor_id: `PREC-${todayStr.slice(5).replace('-', '')}-${String(idx + 1).padStart(2, '0')}`,
        title: hazard || description.slice(0, 70),
        category: getCategoryFromHazard(hazard),
        unit: site,
        isSIF: true,
        risk_score: riskScore,
        status: 'Under Review', // Starts Under Review
        short_description: description,
        why_identified: `AI energy classification detected critical precursor potential in "${hazard}".`,
        detection_date: reportDate,
        engineering_mandate: `Immediate verification of critical barrier controls across ${site}.`,
        reviewer_notes: 'Uploaded via Bulk Ingestion. Awaiting human safety audit review.',
        reviewed_at: null,
        related_weak_signals_count: 1,
        related_reports_count: 1
      });
    }
  });

  const finalReports = [...newReports, ...existingReports];
  const finalPrecursors = [...newPrecursors, ...existingPrecursors];

  // Save to localStorage
  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(finalReports));
  localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(finalPrecursors));
  localStorage.removeItem(STORAGE_WIPED_KEY);

  // Sync to backend if possible
  try {
    const token = localStorage.getItem('safetyai_token');
    if (token && newReports.length > 0) {
      const payload = newReports.map(r => ({
        report_type: r.report_type.toUpperCase().replace(/[\s-]/g, '_'),
        description: r.description,
        location: r.location,
        report_date: r.report_date,
        additional_context: `Hazard: ${r.identified_hazard} | Uploaded Bulk Register`
      }));
      await fetch('/api/reports/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    }
  } catch (err) {
    console.warn('Backend batch sync deferred:', err);
  }

  notifySubscribers();
  return {
    reportsCount: finalReports.length,
    precursorsCount: finalPrecursors.length
  };
}

// Synchronize verified reports returned by FastAPI backend into reactive safetyStore
export function syncBackendReportsToStore(backendReports, originalRows = [], replaceExisting = false) {
  const todayStr = getTodayDateString();
  const existingReports = replaceExisting ? [] : (getStoreState().reports || []);
  const existingPrecursors = replaceExisting ? [] : (getStoreState().precursors || []);

  const newReports = [];
  const newPrecursors = [];

  backendReports.forEach((r, idx) => {
    const orig = originalRows[idx] || {};
    const isSIF = r.sif_precursor_assessment === 'YES';
    const hazard = r.identified_hazard || orig.Hazard || 'Operational Safety Observation';

    const reportItem = {
      id: r.id,
      report_reference: r.report_reference,
      report_type: r.report_type,
      description: r.description,
      location: r.location,
      facility_unit: r.location,
      report_date: r.report_date,
      risk_level: isSIF ? 'Critical' : 'Low',
      sif_precursor_assessment: isSIF ? 'YES' : 'NO',
      ai_score: isSIF ? 94 : 45,
      status: 'Under Review',
      identified_hazard: hazard,
      energy_source: isSIF ? 'High Energy Vector' : 'Low Mechanical Kinetic',
      barrier_status: isSIF ? 'CRITICAL BARRIER FAILED' : 'BARRIER ADEQUATE',
      recommended_action: isSIF ? 'Immediate physical barrier enforcement and audit.' : 'Routine housekeeping and shift review.',
      created_at: r.created_at || new Date().toISOString()
    };
    newReports.push(reportItem);

    if (isSIF) {
      newPrecursors.push({
        id: r.id,
        precursor_id: `PREC-${todayStr.slice(5).replace('-', '')}-${String(idx + 1).padStart(2, '0')}`,
        title: hazard || r.description.slice(0, 70),
        category: getCategoryFromHazard(hazard),
        unit: r.location,
        isSIF: true,
        risk_score: 94,
        status: 'Under Review',
        short_description: r.description,
        why_identified: `AI energy classification detected critical precursor potential in "${hazard}".`,
        detection_date: r.report_date,
        engineering_mandate: `Immediate verification of critical barrier controls across ${r.location}.`,
        reviewer_notes: 'Uploaded via Bulk Ingestion. Awaiting safety audit review.',
        reviewed_at: null,
        related_weak_signals_count: 1,
        related_reports_count: 1
      });
    }
  });

  // Deduplicate against existing reports: prefer newly added reports, preserve earlier ones
  const newReportIds = new Set(newReports.map(r => r.id).filter(Boolean));
  const newReportRefs = new Set(newReports.map(r => r.report_reference).filter(Boolean));
  const remainingExistingReports = existingReports.filter(
    r => (!r.id || !newReportIds.has(r.id)) && (!r.report_reference || !newReportRefs.has(r.report_reference))
  );

  const finalReports = [...newReports, ...remainingExistingReports];

  const newPrecursorIds = new Set(newPrecursors.map(p => p.id).filter(Boolean));
  const newPrecursorRefs = new Set(newPrecursors.map(p => p.precursor_id).filter(Boolean));
  const remainingExistingPrecursors = existingPrecursors.filter(
    p => (!p.id || !newPrecursorIds.has(p.id)) && (!p.precursor_id || !newPrecursorRefs.has(p.precursor_id))
  );

  const finalPrecursors = [...newPrecursors, ...remainingExistingPrecursors];

  try {
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(finalReports));
    localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(finalPrecursors));
    localStorage.removeItem(STORAGE_WIPED_KEY);
  } catch (e) {
    console.error('Failed to update localStorage in syncBackendReportsToStore:', e);
  }

  notifySubscribers();
  return {
    reportsCount: finalReports.length,
    precursorsCount: finalPrecursors.length
  };
}

// Helper to enforce Administrator role check on precursor governance actions
function checkAdminPrecursorPermission() {
  try {
    const raw = localStorage.getItem('safetyai_user');
    if (raw) {
      const u = JSON.parse(raw);
      const isNormal = u?.role === 'NORMAL_USER' || (u?.email && u.email.toLowerCase().includes('user'));
      const isAdmin = Boolean(
        u?.is_admin || 
        u?.role === 'ADMINISTRATOR' || 
        u?.role === 'CHIEF_HSE_AUDITOR' ||
        u?.role_name === 'Administrator' || 
        (u?.email && u.email.toLowerCase().includes('admin'))
      );
      if (isNormal || !isAdmin) {
        throw new Error('Action Restricted: Only Administrators can update precursor review status.');
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('Action Restricted')) {
      throw err;
    }
  }
}

// Update precursor status with ENFORCED LOCK RULE:
// "underview is changed to complete and complte cant be changes to nott completerd or under review"
export function updatePrecursorStatus(precursorId, newStatus) {
  checkAdminPrecursorPermission();

  const { precursors, reports } = getStoreState();
  const target = precursors.find(p => p.id === precursorId || p.precursor_id === precursorId);

  if (!target) {
    throw new Error('Precursor record not found.');
  }

  // STRICT LOCK: If already Complete, cannot be changed back to Incomplete, Under Review, or Pending!
  if (target.status === 'Complete' || target.status === 'Completed') {
    if (newStatus !== 'Complete' && newStatus !== 'Completed') {
      throw new Error('Finalized Record Locked: Records marked as Complete cannot be changed back to Incomplete, Under Review, or Pending.');
    }
    return target;
  }

  const updatedPrecursors = precursors.map((p) => {
    if (p.id === precursorId || p.precursor_id === precursorId) {
      return {
        ...p,
        status: newStatus,
        reviewed_at: new Date().toISOString()
      };
    }
    return p;
  });

  // Sync matching report in reports array
  const updatedReports = reports.map((r) => {
    if (r.id === target.id || r.report_reference === target.precursor_id || r.identified_hazard === target.title) {
      return {
        ...r,
        status: newStatus === 'Complete' ? 'Completed' : newStatus,
        reviewed_at: new Date().toISOString()
      };
    }
    return r;
  });

  localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(updatedPrecursors));
  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updatedReports));
  notifySubscribers();
  return updatedPrecursors.find(p => p.id === precursorId || p.precursor_id === precursorId);
}

// Edit full precursor record with lock rule enforcement
export function updatePrecursorDetails(precursorId, updatedFields) {
  checkAdminPrecursorPermission();

  const { precursors, reports } = getStoreState();
  const target = precursors.find(p => p.id === precursorId || p.precursor_id === precursorId);

  if (!target) {
    throw new Error('Precursor record not found.');
  }

  if ((target.status === 'Complete' || target.status === 'Completed') && updatedFields.status && updatedFields.status !== 'Complete' && updatedFields.status !== 'Completed') {
    throw new Error('Status is locked as Complete and cannot be reverted to Incomplete or Under Review.');
  }

  const updatedPrecursors = precursors.map((p) => {
    if (p.id === precursorId || p.precursor_id === precursorId) {
      return {
        ...p,
        ...updatedFields,
        status: (target.status === 'Complete' || target.status === 'Completed') ? 'Complete' : (updatedFields.status || target.status),
        updated_at: new Date().toISOString()
      };
    }
    return p;
  });

  const updatedReports = reports.map((r) => {
    if (r.id === target.id || r.report_reference === target.precursor_id || r.identified_hazard === target.title) {
      return {
        ...r,
        status: updatedFields.status === 'Complete' ? 'Completed' : (updatedFields.status || r.status),
        recommended_action: updatedFields.recommended_action || r.recommended_action,
        updated_at: new Date().toISOString()
      };
    }
    return r;
  });

  localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(updatedPrecursors));
  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updatedReports));
  notifySubscribers();
  return updatedPrecursors;
}

// Update report status with lock rule enforcement (accessible to authorized users and admins)
export function updateReportStatus(reportRefOrId, newStatus) {
  const { reports, precursors } = getStoreState();
  const targetReport = reports.find(r => r.id === reportRefOrId || r.report_reference === reportRefOrId);

  if (!targetReport) {
    throw new Error('Report record not found.');
  }

  const cleanStatus = newStatus === 'Complete' ? 'Completed' : newStatus;

  // Strict Lock Rule: if already Completed or Complete, cannot be reverted!
  if (targetReport.status === 'Completed' || targetReport.status === 'Complete') {
    if (cleanStatus !== 'Completed' && cleanStatus !== 'Complete') {
      throw new Error('Finalized Record Locked: Records marked as Completed cannot be changed back to Under Review or Pending.');
    }
    return targetReport;
  }

  const updatedReports = reports.map((r) => {
    if (r.id === reportRefOrId || r.report_reference === reportRefOrId) {
      return {
        ...r,
        status: cleanStatus,
        reviewed_at: new Date().toISOString()
      };
    }
    return r;
  });

  const precursorStatus = cleanStatus === 'Completed' ? 'Complete' : cleanStatus;
  const updatedPrecursors = precursors.map((p) => {
    if (p.id === targetReport.id || p.precursor_id === targetReport.report_reference || p.title === targetReport.identified_hazard) {
      return {
        ...p,
        status: precursorStatus,
        reviewed_at: new Date().toISOString()
      };
    }
    return p;
  });

  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updatedReports));
  localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(updatedPrecursors));
  notifySubscribers();

  return updatedReports.find(r => r.id === reportRefOrId || r.report_reference === reportRefOrId);
}

// Edit report details and automatically sync across entire platform
export function updateReportDetails(reportRefOrId, updatedFields) {
  const { reports, precursors } = getStoreState();
  const targetReport = reports.find(r => r.id === reportRefOrId || r.report_reference === reportRefOrId);

  if (!targetReport) {
    throw new Error('Report record not found.');
  }

  const isCurrentlyComplete = targetReport.status === 'Completed' || targetReport.status === 'Complete';
  if (isCurrentlyComplete && updatedFields.status && updatedFields.status !== 'Completed' && updatedFields.status !== 'Complete') {
    throw new Error('Status is locked as Completed and cannot be reverted.');
  }

  const updatedReports = reports.map((r) => {
    if (r.id === reportRefOrId || r.report_reference === reportRefOrId) {
      return {
        ...r,
        ...updatedFields,
        status: isCurrentlyComplete ? 'Completed' : (updatedFields.status || r.status),
        updated_at: new Date().toISOString()
      };
    }
    return r;
  });

  const updatedPrecursors = precursors.map((p) => {
    if (p.id === targetReport.id || p.precursor_id === targetReport.report_reference || p.title === targetReport.identified_hazard) {
      const syncStatus = updatedFields.status === 'Completed' ? 'Complete' : (updatedFields.status || p.status);
      return {
        ...p,
        status: isCurrentlyComplete ? 'Complete' : syncStatus,
        recommended_action: updatedFields.recommended_action || p.recommended_action,
        engineering_mandate: updatedFields.recommended_action || p.engineering_mandate,
        reviewer_notes: updatedFields.reviewer_notes || p.reviewer_notes,
        updated_at: new Date().toISOString()
      };
    }
    return p;
  });

  localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updatedReports));
  localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(updatedPrecursors));
  notifySubscribers();

  return updatedReports.find(r => r.id === reportRefOrId || r.report_reference === reportRefOrId);
}

// Compute dashboard intelligence dynamically from active reports
export function getDashboardMetrics() {
  const { reports, precursors, isWiped } = getStoreState();
  
  if (isWiped || reports.length === 0) {
    return {
      isEmpty: true,
      totalReports: 0,
      sifPrecursorsCount: 0,
      awaitingReviewCount: 0,
      completedCount: 0,
      hazardCategories: [],
      classificationDonut: [
        { name: 'SIF Precursors', value: 0, color: '#FF5A36' },
        { name: 'Non-SIF Routine', value: 0, color: '#10B981' },
        { name: 'Near-Miss Events', value: 0, color: '#F59E0B' }
      ],
      strongReports: [],
      weakSignals: []
    };
  }

  const sifCount = reports.filter(r => r.sif_precursor_assessment === 'YES' || r.risk_level === 'Critical').length;
  const nonSifCount = reports.filter(r => r.sif_precursor_assessment === 'NO' && r.report_type !== 'Near Miss').length;
  const nearMissCount = reports.filter(r => (r.report_type || '').toLowerCase().includes('near miss')).length;

  const completedCount = precursors.filter(p => p.status === 'Complete').length;
  const awaitingReviewCount = Math.max(0, precursors.length - completedCount);

  // Dynamic Hazard Categories aggregation
  const hazardCounts = {};
  reports.forEach(r => {
    const h = r.identified_hazard || 'General Hazard';
    const category = categorizeHazard(h);
    hazardCounts[category] = (hazardCounts[category] || 0) + 1;
  });

  const hazardCategories = Object.entries(hazardCounts).map(([cat, count]) => ({
    category: cat,
    count: count,
    percentage: Math.round((count / reports.length) * 100),
    isTop: count === Math.max(...Object.values(hazardCounts))
  }));

  // Classification distribution for donut chart
  const classificationDonut = [
    { name: 'SIF Precursors', value: sifCount, color: '#FF5A36' },
    { name: 'Non-SIF Observations', value: nonSifCount, color: '#10B981' },
    { name: 'Near-Miss Incidents', value: nearMissCount, color: '#F59E0B' }
  ];

  // Strong SIF reports (top 2 highest score)
  const strongReports = reports
    .filter(r => r.sif_precursor_assessment === 'YES' || r.ai_score >= 80)
    .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
    .slice(0, 2);

  // Weak signals (non-SIF or subtle observations)
  const weakSignals = reports
    .filter(r => r.sif_precursor_assessment === 'NO' || r.ai_score < 70)
    .slice(0, 3);

  return {
    isEmpty: false,
    totalReports: reports.length,
    sifPrecursorsCount: sifCount,
    awaitingReviewCount: awaitingReviewCount,
    completedCount: completedCount,
    hazardCategories,
    classificationDonut,
    strongReports,
    weakSignals
  };
}

// Helper categorizers
function categorizeHazard(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('gas') || t.includes('explosion') || t.includes('flange') || t.includes('blowout')) return 'Pressure & Flammable Gas';
  if (t.includes('crane') || t.includes('rigging') || t.includes('load') || t.includes('hoist')) return 'Lifting & Suspended Load';
  if (t.includes('electric') || t.includes('loto') || t.includes('substation') || t.includes('arc')) return 'Electrical Energy & LOTO';
  if (t.includes('fall') || t.includes('height') || t.includes('scaffold')) return 'Working at Height';
  if (t.includes('weld') || t.includes('hot work') || t.includes('fire') || t.includes('spark')) return 'Hot Work & Ignition';
  return 'Mechanical & Process Safety';
}

function getCategoryFromHazard(hazard) {
  const h = (hazard || '').toLowerCase();
  if (h.includes('lift') || h.includes('crane') || h.includes('load')) return 'Lifting Operations & Rigging';
  if (h.includes('gas') || h.includes('pressure') || h.includes('flange')) return 'Pressurized Hydrocarbons & Gas';
  if (h.includes('electric') || h.includes('loto')) return 'Hazardous Energy & LOTO';
  if (h.includes('weld') || h.includes('fire') || h.includes('hot')) return 'Hot Work & Fire Prevention';
  if (h.includes('height') || h.includes('fall')) return 'Working at Height';
  return 'Process Safety Management';
}

// React hook / subscribe helper
export function subscribeSafetyStore(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// 4 Verified Industrial Weak Signals Dated Dynamically
export const DEFAULT_WEAK_SIGNALS = [
  {
    id: 1,
    signal_id: 'WS-01',
    title: 'Flammable Gas Flange Hissing & Micro-Leakage',
    category: 'Gas Containment & Leak Prevention',
    risk_level: 'High',
    risk_score: 92,
    first_detected_date: getTodayDateString(-5),
    source: 'Multi-Report Acoustic & Atmospheric Telemetry',
    potential_sif_precursor: 'Unconfined Flammable Vapor Cloud Explosion (VCE)',
    connected_signals: [
      'Acoustic micro-seep detected on high-pressure flange joint',
      'Gas detector telemetry flags intermittent hydrocarbon vapor (15% LEL)',
      'Plume migration toward non-classified utility substation switchgear',
      'Atmospheric concentration reaches Lower Explosive Limit (LEL)',
      'Potential SIF Precursor: Vapor Cloud Explosion & Flash Fire Event'
    ],
    progression_steps: [
      { step: 'Initial Weep', trend: 'Increasing', status: 'Audible hissing noted at main flange gasket' },
      { step: 'Vapor Expansion', trend: 'Increasing', status: 'Portable detector reads 18% LEL within 2m radius' },
      { step: 'Atmospheric Accumulation', trend: 'Stable', status: 'Gas accumulates under pipe rack awning' },
      { step: 'Ignition Proximity', trend: 'Increasing', status: 'Vapor plume drifts toward active switchgear panel' },
      { step: 'Critical Precursor', trend: 'Increasing', status: 'Direct catastrophic flash fire and explosion risk' }
    ],
    source_reports: [
      { report_id: 'REP-ID001-0001', report_type: 'Near Miss', date_submitted: getTodayDateString(-2), short_description: 'High-pressure gas pipeline flange suffered severe leakage with loud hissing near switchboard.' },
      { report_id: 'REP-ID001-0003', report_type: 'Unsafe Condition', date_submitted: getTodayDateString(-4), short_description: 'Pressurized LPG cylinder valve found leaking propane gas with strong odor near workshop heater.' }
    ],
    review_status: 'Under Review',
    reviewer_notes: 'Continuous gas monitoring deployed; mechanical retorquing scheduled.',
    key_learnings: 'Deploy ultrasonic acoustic sniff tests during line startup.',
    energy_source: 'Pressurized Hydrocarbon Gas (> 20 bar)',
    barrier_status: 'FLANGE GASKET DEGRADED',
    why_identified: 'Multiple independent reports documented pressurized gas leakage and audible hissing in vicinity of electrical ignition sources.'
  },
  {
    id: 2,
    signal_id: 'WS-02',
    title: 'Electrical Switchgear Terminal Lug Overheating & Arcing',
    category: 'Electrical Fire Safety & Prevention',
    risk_level: 'High',
    risk_score: 94,
    first_detected_date: getTodayDateString(-4),
    source: 'Infrared Thermography & Near-Miss Logs',
    potential_sif_precursor: '415V Arc Flash Explosion & Switchboard Fire',
    connected_signals: [
      'Loose cable termination lug creates high electrical resistance',
      'Terminal temperature elevates above 95°C causing insulation smoldering',
      'Micro-arcing degrades plastic terminal block and generates ozone odor',
      'Sustained phase-to-phase arc flash bridge forms across open cubicle',
      'Potential SIF Precursor: Arc Flash Blast, Shrapnel & Structural Substation Fire'
    ],
    progression_steps: [
      { step: 'Thermal Hotspot', trend: 'Increasing', status: 'IR thermography detected 92°C hotspot on 415V phase B lug' },
      { step: 'Insulation Charring', trend: 'Increasing', status: 'Acrid burning plastic odor noted outside MCC room' },
      { step: 'Micro-Arcing', trend: 'Increasing', status: 'Faint buzzing and visual scorch marks on busbar support' },
      { step: 'Phase Flashover Risk', trend: 'Stable', status: 'Air gap ionization approaching breakdown voltage' },
      { step: 'Arc Flash Precursor', trend: 'Increasing', status: 'Severe arc flash hazard threatening maintenance technicians' }
    ],
    source_reports: [
      { report_id: 'REP-ID001-0002', report_type: 'Near Miss', date_submitted: getTodayDateString(-1), short_description: 'Electrical fire erupted inside 415V switchboard panel due to overloaded circuit breaker.' },
      { report_id: 'REP-ID001-0006', report_type: 'Unsafe Act', date_submitted: getTodayDateString(-3), short_description: 'Electrician opened energized 11kV motor control cubicle without applying lockout padlock.' }
    ],
    review_status: 'Under Review',
    reviewer_notes: 'Panel isolated and thermal imaging survey initiated.',
    key_learnings: 'Mandate calibrated torque wrenches on all high-current busbar connections.',
    energy_source: 'Electrical Arc Energy & Hazardous Voltage (415V / 11kV)',
    barrier_status: 'CABLE INSULATION CHARRED',
    why_identified: 'Correlated reports of electrical panel overheating, breaker tripping, and LOTO compliance bypass.'
  },
  {
    id: 3,
    signal_id: 'WS-03',
    title: 'Hot Work Welding Sparks Near Unshielded Flammables',
    category: 'Hot Work & Fire Prevention',
    risk_level: 'Medium',
    risk_score: 86,
    first_detected_date: getTodayDateString(-6),
    source: 'Field Safety Walkdowns & Permit Audits',
    potential_sif_precursor: 'Combustible Solvent Flash Fire & Structural Bay Conflagration',
    connected_signals: [
      'Angle grinding and welding torch generate molten slag sparks (1200°C)',
      'Sparks project beyond 10-meter radius across fabrication floor',
      'Molten embers land on solvent-soaked cleaning rags and open chemical drum',
      'Vapor flash fire ignites and spreads toward bulk storage barrels',
      'Potential SIF Precursor: Fabrication Workshop Flame Engulfment'
    ],
    progression_steps: [
      { step: 'Spark Scatter', trend: 'Increasing', status: 'Grinding sparks observed travelling 8 meters across bay' },
      { step: 'Fire Blanket Deficit', trend: 'Stable', status: 'Spark containment screens omitted during structural welding' },
      { step: 'Solvent Proximity', trend: 'Increasing', status: 'Open degreaser solvent container left within 4 meters' },
      { step: 'Smoldering Smear', trend: 'Increasing', status: 'Oily rag showed localized charring prior to water dousing' },
      { step: 'Flash Fire Threat', trend: 'Increasing', status: 'Critical SIF precursor of full-scale workshop conflagration' }
    ],
    source_reports: [
      { report_id: 'REP-ID001-0004', report_type: 'Unsafe Act', date_submitted: getTodayDateString(-2), short_description: 'Angle grinding sparks near open solvent drum ignited oily rags causing an immediate flash fire.' },
      { report_id: 'REP-ID001-0010', report_type: 'Unsafe Act', date_submitted: getTodayDateString(-5), short_description: 'Cutting torch operated without flashback arrestor on oxygen cylinder line near maintenance bay.' }
    ],
    review_status: 'Under Review',
    reviewer_notes: 'Hot work permit stopped; fire blanket barricades reinstalled.',
    key_learnings: 'Enforce certified continuous Fire Watch on all grinding and welding tasks.',
    energy_source: 'Thermal Molten Slag & Chemical Solvent Flame',
    barrier_status: 'FIRE RETARDANT CURTAIN MISSING',
    why_identified: 'Repeated observations of hot work conducted near unshielded solvent residues without fire watch.'
  },
  {
    id: 4,
    signal_id: 'WS-04',
    title: 'Scaffold Plank Dislodgement & Fall Arrest Anchorage Defect',
    category: 'Working at Height & Fall Hazard',
    risk_level: 'High',
    risk_score: 90,
    first_detected_date: getTodayDateString(-7),
    source: 'Height Safety Audits & Scaffolding Inspections',
    potential_sif_precursor: 'Fatal Fall From Height (>9m) & Dropped Object Impact',
    connected_signals: [
      'Scaffold boards displaced or missing toe-boards at elevated deck',
      'Technicians work without certified 5,000-lb overhead anchor point',
      'Unsecured tools and heavy grating positioned near open floor edge',
      'Loss of footing leads to uncontrolled fall through open scaffold void',
      'Potential SIF Precursor: Fatal Elevated Fall or Fatal Struck-By Incident'
    ],
    progression_steps: [
      { step: 'Grating Shift', trend: 'Increasing', status: 'Walkway grating displaced leaving 1m opening on pump deck' },
      { step: 'Unanchored Work', trend: 'Increasing', status: 'Contractor observed at 9m elevation without dual lanyard tie-off' },
      { step: 'Missing Guardrails', trend: 'Stable', status: 'Intermediate guardrail unclamped for pipe spool rigging' },
      { step: 'Drop Hazard', trend: 'Increasing', status: 'Unsecured hand tools resting directly above transit walkway' },
      { step: 'Fatal Fall Precursor', trend: 'Increasing', status: 'Critical elevated fall potential requiring immediate stop-work' }
    ],
    source_reports: [
      { report_id: 'REP-ID001-0007', report_type: 'Unsafe Condition', date_submitted: getTodayDateString(-3), short_description: 'Scaffolding plank missing at 9m elevation on distillation column without harness anchor point.' },
      { report_id: 'REP-ID001-0012', report_type: 'Unsafe Condition', date_submitted: getTodayDateString(-4), short_description: 'Heavy steel walkway grating displaced leaving 1-meter open hole above pump deck.' }
    ],
    review_status: 'Under Review',
    reviewer_notes: 'Red lockout tag applied to scaffold access ladder.',
    key_learnings: 'Mandate daily scaffolding green-tag audits prior to shift start.',
    energy_source: 'Gravitational Potential Energy (9m Elevation)',
    barrier_status: 'PHYSICAL GUARDRAIL & ANCHORAGE FAILED',
    why_identified: 'Multiple reports of unanchored work at elevation combined with missing deck grating and missing toe-boards.'
  }
];

// Get stored weak signals from localStorage or initialize with verified defaults
export function getStoredWeakSignals() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_WIPED_KEY) === 'true') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_WEAK_SIGNALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

// Add or correlate a detected weak signal to the Weak Signals Board
export function addWeakSignalToBoard(newSignal) {
  if (!newSignal || !newSignal.title) return null;
  const current = getStoredWeakSignals();

  // Check if a similar signal exists
  const existingIdx = current.findIndex(s => 
    (newSignal.signal_id && s.signal_id === newSignal.signal_id) ||
    (s.title && newSignal.title && s.title.toLowerCase().trim() === newSignal.title.toLowerCase().trim()) ||
    (s.category && newSignal.category && s.category.toLowerCase().trim() === newSignal.category.toLowerCase().trim())
  );

  let updatedSignals;
  let savedSignal;

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    const combinedReports = [...(newSignal.source_reports || [])];
    (existing.source_reports || []).forEach(r => {
      if (!combinedReports.some(cr => cr.report_id === r.report_id)) {
        combinedReports.push(r);
      }
    });

    savedSignal = {
      ...existing,
      ...newSignal,
      source_reports: combinedReports,
      risk_score: Math.max(existing.risk_score || 0, newSignal.risk_score || 0),
      risk_level: (newSignal.risk_score >= 90 || existing.risk_score >= 90) ? 'High' : (newSignal.risk_level || existing.risk_level)
    };
    updatedSignals = [...current];
    updatedSignals[existingIdx] = savedSignal;
  } else {
    const nextNum = current.length + 1;
    savedSignal = {
      id: Date.now(),
      signal_id: newSignal.signal_id || `WS-0${nextNum}`,
      title: newSignal.title,
      category: newSignal.category || 'Process Safety Management',
      risk_level: newSignal.risk_level || (newSignal.risk_score >= 90 ? 'High' : 'Medium'),
      risk_score: newSignal.risk_score || 88,
      first_detected_date: newSignal.first_detected_date || getTodayDateString(),
      source: newSignal.source || 'Live AI Observation Detection',
      potential_sif_precursor: newSignal.potential_sif_precursor || 'Escalating Industrial Barrier Failure',
      connected_signals: newSignal.connected_signals || [
        'Initial latent irregularity detected during operational shift',
        'Physical safety barrier degradation flagged by frontline observer',
        'Line-of-fire proximity to hazardous energy vector',
        'Potential SIF Precursor escalation without immediate intervention'
      ],
      progression_steps: newSignal.progression_steps || [
        { step: 'Detection', trend: 'Increasing', status: 'Identified during live AI analysis' },
        { step: 'Evaluation', trend: 'Increasing', status: 'Precursor pattern correlated against active records' },
        { step: 'Control', trend: 'Stable', status: 'Awaiting engineering barrier restoration' }
      ],
      source_reports: newSignal.source_reports || [],
      review_status: 'Under Review',
      reviewer_notes: newSignal.reviewer_notes || 'Detected via Live AI Analysis. Recommended for engineering inspection.',
      key_learnings: newSignal.key_learnings || 'Audit physical barriers and verify operational controls.',
      energy_source: newSignal.energy_source || 'Industrial Process Energy Vector',
      barrier_status: newSignal.barrier_status || 'BARRIER COMPROMISED'
    };
    updatedSignals = [savedSignal, ...current];
  }

  try {
    localStorage.setItem(STORAGE_WEAK_SIGNALS_KEY, JSON.stringify(updatedSignals));
  } catch (e) {
    console.error('Failed to save weak signal to storage:', e);
  }

  notifySubscribers();
  return savedSignal;
}

// Automatically persist an analyzed report record into the Central Safety Store
export function addReportRecord(reportData) {
  if (!reportData) return null;

  const { reports, precursors } = getStoreState();
  const todayStr = getTodayDateString();

  // Enforce 999,999 character limit on description
  const cleanDesc = (reportData.description || '').trim().slice(0, 999999);
  const nextRef = reportData.report_reference || `REP-${todayStr.replace(/-/g, '')}-${String(reports.length + 1).padStart(4, '0')}`;
  const isSIF = reportData.sif_precursor_assessment === 'YES' || reportData.isSIF === true;
  const riskScore = typeof reportData.ai_score === 'number' ? reportData.ai_score : (typeof reportData.risk_score === 'number' ? reportData.risk_score : (isSIF ? 90 : 0));

  const reportItem = {
    id: reportData.id || Date.now(),
    report_reference: nextRef,
    report_type: reportData.report_type || 'Near Miss',
    description: cleanDesc,
    location: reportData.location || 'Unit 1',
    facility_unit: reportData.facility_unit || `${reportData.location || 'Unit 1'} Operating Bay`,
    report_date: reportData.report_date || todayStr,
    risk_level: isSIF ? 'Critical' : (riskScore > 30 ? 'Medium' : 'Low'),
    sif_precursor_assessment: isSIF ? 'YES' : 'NO',
    ai_score: riskScore,
    status: reportData.status || 'Under Review',
    identified_hazard: reportData.identified_hazard || (isSIF ? 'High Energy Operational Precursor' : 'Routine Safety Finding'),
    energy_source: reportData.energy_source || (isSIF ? 'High Potential Energy Vector' : 'Zero / Low Kinetic Energy'),
    barrier_status: reportData.barrier_status || (isSIF ? 'CRITICAL BARRIER FAILED' : 'BARRIER INTACT / ADEQUATE'),
    recommended_action: reportData.recommended_action || (isSIF ? 'Immediate physical barrier enforcement and audit.' : 'Routine housekeeping and shift review.'),
    created_at: new Date().toISOString()
  };

  // Check if updating an existing report by reference or id
  const existingRefIndex = reports.findIndex(r => 
    (reportData.id && r.id === reportData.id) ||
    (reportData.report_reference && r.report_reference === reportData.report_reference)
  );

  let updatedReports;
  if (existingRefIndex >= 0) {
    updatedReports = [...reports];
    updatedReports[existingRefIndex] = { ...updatedReports[existingRefIndex], ...reportItem };
  } else {
    updatedReports = [reportItem, ...reports];
  }

  // If SIF, add to precursors
  let updatedPrecursors = [...precursors];
  if (isSIF) {
    const existingPrecursorIdx = precursors.findIndex(p => 
      p.id === reportItem.id || p.precursor_id === reportItem.report_reference || p.title === reportItem.identified_hazard
    );

    const precursorItem = {
      id: reportItem.id,
      precursor_id: `PREC-${todayStr.slice(5).replace('-', '')}-${String(precursors.length + 1).padStart(2, '0')}`,
      title: reportItem.identified_hazard || reportItem.description.slice(0, 70),
      category: getCategoryFromHazard(reportItem.identified_hazard),
      unit: reportItem.location,
      isSIF: true,
      risk_score: riskScore,
      status: 'Under Review',
      short_description: cleanDesc,
      why_identified: `AI analysis identified critical SIF precursor potential in "${reportItem.identified_hazard}".`,
      detection_date: reportItem.report_date,
      engineering_mandate: `Immediate verification of critical barrier controls across ${reportItem.location}.`,
      reviewer_notes: 'Generated from live safety analysis. Awaiting human safety audit review.',
      reviewed_at: null,
      related_weak_signals_count: 1,
      related_reports_count: 1
    };

    if (existingPrecursorIdx >= 0) {
      updatedPrecursors[existingPrecursorIdx] = { ...updatedPrecursors[existingPrecursorIdx], ...precursorItem };
    } else {
      updatedPrecursors = [precursorItem, ...precursors];
    }
  }

  try {
    localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(updatedReports));
    localStorage.setItem(STORAGE_PRECURSORS_KEY, JSON.stringify(updatedPrecursors));
    localStorage.removeItem(STORAGE_WIPED_KEY);
  } catch (e) {
    console.error('Failed to persist new safety report:', e);
  }

  notifySubscribers();
  return { report: reportItem, totalCount: updatedReports.length };
}

export function getStoredTotalRecords() {
  try {
    const isWiped = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_WIPED_KEY) === 'true';
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

export function autoPersistToTotalRecords(newRecord) {
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
