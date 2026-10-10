from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..dependencies import get_current_user
from ..services.weak_signal_service import (
    get_weak_signals_for_organization,
    get_weak_signal_by_id,
    update_weak_signal_review,
    evaluate_custom_reports_correlation,
    analyze_user_description_and_correlate,
    correlate_two_user_descriptions,
    clear_all_weak_signals_for_org
)

router = APIRouter(prefix="/api/weak-signals", tags=["Weak Signals Intelligence"])

class WeakSignalReviewRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    decision: Optional[str] = None  # Confirmed, Not Relevant / Incorrect, Relevant but Low Importance
    reviewer: Optional[str] = None


class CorrelateReportsRequest(BaseModel):
    reports: List[Dict[str, Any]]


class AnalyzeDescriptionRequest(BaseModel):
    description: str
    location: Optional[str] = "Unit 1"
    report_type: Optional[str] = "NEAR_MISS"


class CorrelateDescriptionsRequest(BaseModel):
    description_1: str
    location_1: Optional[str] = "Unit 1"
    description_2: str
    location_2: Optional[str] = "Unit 1"


@router.get("")
def list_weak_signals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns AI-correlated weak signals and KPI summary strictly isolated
    to the authenticated user's organization.
    """
    return get_weak_signals_for_organization(db, current_user.organization_id)


@router.delete("/reset")
def reset_weak_signals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clears all weak signals and clusters for the organization, returning
    the view to an authentic zero-state awaiting real user descriptions.
    """
    return clear_all_weak_signals_for_org(db, current_user.organization_id)


@router.post("/analyze-description")
def analyze_description_and_detect_weak_signal(
    payload: AnalyzeDescriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Takes an actual user-entered incident description, saves the report,
    and runs real-time weak signal correlation against legitimate database records.
    """
    if not payload.description or not payload.description.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Incident description cannot be empty."
        )
    return analyze_user_description_and_correlate(
        db=db,
        current_user=current_user,
        description=payload.description,
        location=payload.location or "Unit 1",
        report_type=payload.report_type or "NEAR_MISS"
    )


@router.post("/correlate-descriptions")
def correlate_two_descriptions(
    payload: CorrelateDescriptionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Evaluates two user-submitted incident descriptions, analyzes their physical
    interaction, saves both reports, and creates an Emerging Multi-Signal Hazard Cluster if correlated.
    """
    if not payload.description_1 or not payload.description_1.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Description for Incident 1 cannot be empty."
        )
    if not payload.description_2 or not payload.description_2.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Description for Incident 2 cannot be empty."
        )
    return correlate_two_user_descriptions(
        db=db,
        current_user=current_user,
        description_1=payload.description_1,
        location_1=payload.location_1 or "Unit 1",
        description_2=payload.description_2,
        location_2=payload.location_2 or "Unit 1"
    )


@router.get("/{signal_id}")
def get_weak_signal_details(
    signal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full forensic dossier for a specific weak signal including
    correlated multi-record identification, progression timeline, and mitigation protocol.
    """
    signal = get_weak_signal_by_id(db, current_user.organization_id, signal_id)
    if not signal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weak signal '{signal_id}' not found."
        )
    return signal


@router.post("/{signal_id}/review")
def review_weak_signal(
    signal_id: str,
    payload: WeakSignalReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persists auditor review status, human classification decision, and directives in the database
    with strict completion locking enforcement.
    """
    try:
        reviewer_name = payload.reviewer or (current_user.email if current_user else "Auditor")
        return update_weak_signal_review(
            db=db,
            org_id=current_user.organization_id,
            signal_id=signal_id,
            status=payload.status,
            notes=payload.notes,
            decision=payload.decision,
            reviewer=reviewer_name
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/correlate")
def run_correlation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers on-demand multi-report signal correlation across all analyzed reports.
    """
    return get_weak_signals_for_organization(db, current_user.organization_id)


@router.post("/correlate-reports")
def correlate_arbitrary_reports(
    payload: CorrelateReportsRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates a specific arbitrary list of safety reports (e.g. 2 or more reports)
    and determines whether they form an interacting compound hazard or SIF precursor.
    """
    return evaluate_custom_reports_correlation(payload.reports)

