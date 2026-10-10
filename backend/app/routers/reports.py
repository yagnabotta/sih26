import re
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.safety_report import SafetyReport
from ..models.ai_analysis import AIAnalysis
from ..models.feedback import Feedback
from ..schemas.safety_report import SafetyReportCreate, SafetyReportListItem, SafetyReportDetail
from ..schemas.ai_analysis import AIAnalysisResponse
from ..dependencies import get_current_user
from ..services.report_service import (
    create_report, 
    get_organization_reports, 
    get_report_by_id,
    find_duplicate_report
)
from ..services.analysis_service import execute_ai_analysis
from ..services.historical_pattern_service import detect_and_update_weak_signals

router = APIRouter(prefix="/api/reports", tags=["Safety Reports"])

def extract_unit_key(val: str) -> str:
    if not val:
        return ""
    s = str(val).strip().lower()
    m = re.search(r'unit\s*[-_#]?\s*0*(\d+)', s, re.IGNORECASE)
    if m:
        return f"unit-{int(m.group(1))}"
    s = re.sub(r'[-_]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

@router.post("", response_model=SafetyReportDetail, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: SafetyReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits an industrial safety report under the authenticated user's organization
    and executes the real modular AI/NLP SIF analysis pipeline.
    """
    if not payload.description or len(payload.description.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please describe the safety observation in detail."
        )
    if len(payload.description) > 999999:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Field description exceeds maximum allowed length of 999,999 characters."
        )
    if not payload.location or len(payload.location.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid location or operational area."
        )

    # 1. Create Report in DB
    report = create_report(db, payload, current_user)

    # 2. Run AI Analysis Pipeline
    try:
        execute_ai_analysis(db, report)
    except Exception as e:
        # If analysis fails, report status is set to FAILED
        pass

    db.refresh(report)
    return report

@router.get("", response_model=List[SafetyReportListItem])
def list_reports(
    search: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    analysis_status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists safety reports strictly isolated to the authenticated organization and filtered by user role."""
    return get_organization_reports(
        db=db,
        org_id=current_user.organization_id,
        search=search,
        report_type=report_type,
        analysis_status=analysis_status,
        user=current_user
    )

@router.get("/map-incidents", response_model=List[SafetyReportListItem])
def list_map_incidents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns incident reports with geo-coordinates.
    - If Worker: only returns their own submitted incident locations.
    - If Admin: returns incident locations submitted by their 10 allocated workers.
    """
    all_reports = get_organization_reports(
        db=db,
        org_id=current_user.organization_id,
        user=current_user
    )
    # Filter to reports with valid coordinates
    return [r for r in all_reports if r.incident_latitude is not None and r.incident_longitude is not None]

@router.get("/{report_id}", response_model=SafetyReportDetail)
def get_report_details(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves full details and AI analysis for a report belonging to the organization."""
    report = get_report_by_id(db, report_id, current_user.organization_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Safety report not found or access denied."
        )
    return report

@router.post("/{report_id}/analyze", response_model=AIAnalysisResponse)
def trigger_analysis(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers or re-executes AI analysis on an existing organization report."""
    report = get_report_by_id(db, report_id, current_user.organization_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Safety report not found or access denied."
        )
    
    analysis = execute_ai_analysis(db, report)
    return analysis

@router.get("/{report_id}/analysis", response_model=AIAnalysisResponse)
def get_report_analysis(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves AI analysis for a specific report."""
    report = get_report_by_id(db, report_id, current_user.organization_id)
    if not report or not report.ai_analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI analysis not found for this report."
        )
    return report.ai_analysis

@router.post("/reset")
def reset_organization_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Admin role guard
    is_admin = (
        current_user.role in ["ADMINISTRATOR", "CHIEF_HSE_AUDITOR"] or 
        "admin" in current_user.email.lower()
    )
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action restricted: Only Administrators can reset or clear static organization data."
        )
    
    org_id = current_user.organization_id
    
    db.query(Feedback).filter(Feedback.organization_id == org_id).delete(synchronize_session=False)
    db.query(AIAnalysis).filter(AIAnalysis.organization_id == org_id).delete(synchronize_session=False)
    deleted_count = db.query(SafetyReport).filter(SafetyReport.organization_id == org_id).delete(synchronize_session=False)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Successfully cleared all {deleted_count} reports and related data. Organization data reset.",
        "deleted_count": deleted_count
    }

@router.post("/batch")
def batch_upload_reports(
    payload: List[SafetyReportCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Batch ingests safety reports, skips duplicate records before database insertion
    and AI analysis, and returns verified records.
    """
    seen_in_batch = set()
    results = []
    new_count = 0
    duplicate_count = 0
    analyzed_count = 0
    failed_count = 0
    weak_signals_count = 0

    for item in payload:
        try:
            norm_type = item.report_type.upper().replace("-", "_").replace(" ", "_")
            if norm_type not in ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"]:
                norm_type = "UNSAFE_CONDITION"

            item_date = item.report_date.strip() if item.report_date and item.report_date.strip() else datetime.utcnow().strftime("%Y-%m-%d")
            batch_key = (
                item_date,
                " ".join(item.location.strip().lower().split()),
                norm_type,
                " ".join(item.description.strip().lower().split())
            )

            # Intra-batch duplicate check
            if batch_key in seen_in_batch:
                duplicate_count += 1
                continue
            seen_in_batch.add(batch_key)

            # Database duplicate check against authenticated organization
            existing = find_duplicate_report(db, current_user.organization_id, item)
            if existing:
                duplicate_count += 1
                results.append({
                    "id": existing.id,
                    "report_reference": existing.report_reference,
                    "location": existing.location,
                    "report_type": existing.report_type,
                    "description": existing.description,
                    "report_date": existing.report_date,
                    "analysis_status": existing.analysis_status,
                    "sif_precursor_assessment": existing.ai_analysis.sif_precursor_assessment if existing.ai_analysis else "NO",
                    "identified_hazard": existing.ai_analysis.identified_hazard if existing.ai_analysis else "Pending Assessment",
                    "is_duplicate": True
                })
                continue

            # Genuinely new report: create, analyze, and correlate
            report = create_report(db, item, current_user)
            analysis = None
            try:
                analysis = execute_ai_analysis(db, report)
                analyzed_count += 1
            except Exception:
                failed_count += 1

            db.refresh(report)
            new_count += 1

            # Historical pattern comparison & Weak signal detection
            if analysis:
                try:
                    ws_res = detect_and_update_weak_signals(
                        db=db,
                        org_id=current_user.organization_id,
                        current_report=report,
                        raw_nlp_result={
                            "identified_hazard": analysis.identified_hazard,
                            "energy_source": analysis.energy_source,
                            "barrier_information": analysis.barrier_information,
                            "identified_action": analysis.identified_action
                        }
                    )
                    if ws_res.get("weak_signal_detected"):
                        weak_signals_count += 1
                except Exception:
                    pass

            results.append({
                "id": report.id,
                "report_reference": report.report_reference,
                "location": report.location,
                "report_type": report.report_type,
                "description": report.description,
                "report_date": report.report_date,
                "analysis_status": report.analysis_status,
                "sif_precursor_assessment": report.ai_analysis.sif_precursor_assessment if report.ai_analysis else "NO",
                "identified_hazard": report.ai_analysis.identified_hazard if report.ai_analysis else "Pending Assessment",
                "is_duplicate": False
            })
        except Exception:
            failed_count += 1
            continue

    return {
        "status": "success",
        "records_received": len(payload),
        "records_created": new_count,
        "records_analyzed": analyzed_count,
        "records_failed": failed_count,
        "weak_signals_detected": weak_signals_count,
        "ingested_count": new_count,
        "new_count": new_count,
        "duplicate_count": duplicate_count,
        "total_processed": len(payload),
        "reports": results
    }

@router.post("/bulk-upload")
async def bulk_upload_reports_alias(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unified Bulk Ingestion Endpoint.
    Accepts both JSON array payload and multipart/form-data CSV file uploads.
    Sequentially ingests records, executes AI analysis, and detects weak signals.
    """
    content_type = request.headers.get("content-type", "")
    reports_list = []

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = None
        for field in form.values():
            if hasattr(field, "filename") and field.filename:
                uploaded_file = field
                break
        
        if not uploaded_file:
            raise HTTPException(status_code=400, detail="No file found in multipart upload.")
        
        contents = await uploaded_file.read()
        text_data = contents.decode("utf-8", errors="replace")
        csv_reader = csv.DictReader(io.StringIO(text_data))
        
        for row in csv_reader:
            # Map common column headers flexibly
            desc = row.get("description") or row.get("Description") or row.get("incident_description") or ""
            loc = row.get("location") or row.get("Site") or row.get("site") or "General Facility"
            rtype = row.get("report_type") or row.get("Report Type") or row.get("type") or "UNSAFE_CONDITION"
            rdate = row.get("incident_date") or row.get("report_date") or row.get("Date") or ""
            
            if desc.strip():
                reports_list.append(SafetyReportCreate(
                    description=desc.strip(),
                    location=loc.strip(),
                    report_type=rtype.strip(),
                    report_date=rdate.strip() if rdate.strip() else None
                ))
    else:
        body = await request.json()
        if isinstance(body, list):
            for item in body:
                reports_list.append(SafetyReportCreate(**item))
        elif isinstance(body, dict) and "reports" in body:
            for item in body["reports"]:
                reports_list.append(SafetyReportCreate(**item))
        else:
            raise HTTPException(status_code=400, detail="Expected a JSON array of reports.")

    return batch_upload_reports(reports_list, current_user, db)


