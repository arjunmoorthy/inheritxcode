from db.models.conversation import SymptomDetail, SymptomTimeSeries
from core.logging import get_logger

logger = get_logger(__name__)


def save_symptom_analytics(db, patient_id, conversation_id, engine_state):
    """
    Persist symptom analytics to symptom_details and symptom_time_series.
    Uses keys from ConversationState.to_dict(): selected_symptoms, answers,
    triage_results, highest_triage_level (not severity/triage_level at top level).
    """
    selected_symptoms = engine_state.get("selected_symptoms", [])
    answers = engine_state.get("answers", {})
    triage_results = engine_state.get("triage_results", [])

    # State uses highest_triage_level, not triage_level
    triage_level = engine_state.get("triage_level") or engine_state.get("highest_triage_level", "none")
    # Build severity per symptom from triage_results (symptom_id -> level)
    severity_map = engine_state.get("severity", {})
    if not severity_map and triage_results:
        severity_map = {r["symptom_id"]: r.get("level") for r in triage_results if isinstance(r, dict) and r.get("symptom_id")}

    logger.info(
        "save_symptom_analytics: patient_id=%s conversation_id=%s selected_symptoms=%s triage_level=%s",
        patient_id, conversation_id, selected_symptoms, triage_level,
    )

    if not selected_symptoms:
        logger.warning("save_symptom_analytics: no selected_symptoms, skipping symptom_details insert")
    else:
        # 1️⃣ store symptom details
        for symptom in selected_symptoms:
            symptom_detail = SymptomDetail(
                patient_id=patient_id,
                conversation_id=conversation_id,
                symptom_id=symptom,
                severity=severity_map.get(symptom) if isinstance(severity_map.get(symptom), str) else None,
                triage_level=triage_level if isinstance(triage_level, str) else str(triage_level),
                answers_json=answers or None,
            )
            db.add(symptom_detail)

    # 2️⃣ store numeric metrics from answers
    if selected_symptoms and answers:
        for key, value in answers.items():
            if isinstance(value, (int, float)):
                metric_row = SymptomTimeSeries(
                    patient_id=patient_id,
                    conversation_id=conversation_id,
                    symptom_id=selected_symptoms[0],
                    metric_name=key,
                    metric_value=float(value),
                )
                db.add(metric_row)

    db.commit()
    logger.info("save_symptom_analytics: committed %d symptom_details, metrics from answers", len(selected_symptoms))