from typing import Optional
from sqlalchemy.orm import Session
from ..models.safety_report import SafetyReport, AnalysisStatusEnum
from ..models.ai_analysis import AIAnalysis
from ..ai_services.ai_service import analyze_safety_report
from ..schemas.ai_analysis import AIAnalysisResponse

def execute_ai_analysis(db: Session, report: SafetyReport) -> AIAnalysis:
    """
    Executes AI analysis for a safety report and persists explainable structured results.
    """
    report.analysis_status = AnalysisStatusEnum.PROCESSING.value
    db.commit()

    try:
        # Run 10-step AI pipeline
        raw_result = analyze_safety_report(
            report_type=report.report_type,
            description=report.description,
            additional_context=report.additional_context
        )

        # Check if existing analysis exists for re-runs
        analysis = db.query(AIAnalysis).filter(AIAnalysis.report_id == report.id).first()
        if not analysis:
            analysis = AIAnalysis(
                report_id=report.id,
                organization_id=report.organization_id,
                analysis_context=raw_result["analysis_context"],
                classification=raw_result.get("classification"),
                sif_status=raw_result.get("sif_status"),
                root_cause=raw_result.get("root_cause"),
                identified_action=raw_result["identified_action"],
                identified_condition=raw_result["identified_condition"],
                identified_event=raw_result["identified_event"],
                identified_hazard=raw_result["identified_hazard"],
                safety_signals=raw_result["safety_signals"],
                energy_source=raw_result["energy_source"],
                exposure=raw_result["exposure"],
                barrier_information=raw_result["barrier_information"],
                potential_consequence=raw_result["potential_consequence"],
                sif_precursor_assessment=raw_result["sif_precursor_assessment"],
                explanation=raw_result["explanation"]
            )
            db.add(analysis)
        else:
            analysis.analysis_context = raw_result["analysis_context"]
            analysis.classification = raw_result.get("classification")
            analysis.sif_status = raw_result.get("sif_status")
            analysis.root_cause = raw_result.get("root_cause")
            analysis.identified_action = raw_result["identified_action"]
            analysis.identified_condition = raw_result["identified_condition"]
            analysis.identified_event = raw_result["identified_event"]
            analysis.identified_hazard = raw_result["identified_hazard"]
            analysis.safety_signals = raw_result["safety_signals"]
            analysis.energy_source = raw_result["energy_source"]
            analysis.exposure = raw_result["exposure"]
            analysis.barrier_information = raw_result["barrier_information"]
            analysis.potential_consequence = raw_result["potential_consequence"]
            analysis.sif_precursor_assessment = raw_result["sif_precursor_assessment"]
            analysis.explanation = raw_result["explanation"]

        report.analysis_status = AnalysisStatusEnum.COMPLETED.value
        db.commit()
        db.refresh(analysis)
        return analysis

    except Exception as e:
        report.analysis_status = AnalysisStatusEnum.FAILED.value
        db.commit()
        raise e

def get_organization_analyses(db: Session, org_id: str):
    """Retrieves all completed AI analyses for the organization."""
    return db.query(AIAnalysis).filter(AIAnalysis.organization_id == org_id).all()
