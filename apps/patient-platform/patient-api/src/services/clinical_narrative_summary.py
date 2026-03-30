"""
First-person clinical narrative for a completed symptom check-in.

Produces flowing sentences (e.g. “You reported moderate nausea with medications,
you are taking compazine as prescribed”) rather than Q&A echo lines.

NAU-203 / VOM-204 / DIA-205 use spec-aligned wording; other symptoms use the same
voice with question-aware natural clauses from SymptomDef.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Set

from routers.chat.symptom_checker.constants import InputType, MEDS_DIARRHEA, MEDS_NAUSEA
from routers.chat.symptom_checker.symptom_definitions import Question, SymptomDef, get_symptom_by_id


def _severity_word(code: Optional[str]) -> str:
    if not code:
        return "mild"
    m = {
        "mild": "mild",
        "mod": "moderate",
        "moderate": "moderate",
        "sev": "severe",
        "severe": "severe",
    }
    return m.get(str(code).strip().lower(), str(code).strip().lower())


def _norm_input_type(q: Question) -> Any:
    it = q.input_type
    if isinstance(it, str):
        try:
            return InputType(it)
        except ValueError:
            return it
    return it


def _med_short_from_list(options: List[dict], value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    for row in options:
        if row.get("value") == value:
            lab = row.get("label") or ""
            if " (" in lab:
                return lab.split(" (", 1)[0].strip().lower()
            return (lab.strip() or str(value)).lower()
    return str(value).lower() if value else None


def _choice_label(q: Question, value: Any) -> Optional[str]:
    if value is None:
        return None
    for opt in q.options:
        if opt.value == value or str(opt.value) == str(value):
            return (opt.label or "").strip() or str(value)
    return str(value).strip() or None


def _intake_clause(intake: Optional[str], window_hours: int) -> Optional[str]:
    if not intake or intake == "normal":
        return None
    if window_hours == 12:
        mapping = {
            "reduced": "You are reporting reduced oral intake over 12 hours.",
            "difficulty": "You are reporting difficulty keeping food or fluids down over 12 hours.",
            "barely": "You are reporting that you can barely eat or drink anything over 12 hours.",
            "none": "You are reporting no oral intake over the last 12 hours.",
        }
    else:
        mapping = {
            "reduced": "You are reporting reduced oral intake over 24 hours.",
            "difficulty": "You are reporting difficulty keeping food or fluids down over 24 hours.",
            "barely": "You are reporting that you can barely eat or drink anything over 24 hours.",
            "none": "You are reporting no oral intake over the last 24 hours.",
        }
    return mapping.get(intake)


def _intake_clause_diarrhea_short(intake: Optional[str]) -> Optional[str]:
    """Diarrhea module: second intake line uses shorter wording in client example."""
    if not intake or intake == "normal":
        return None
    if intake == "reduced":
        return "You have reduced oral intake."
    return _intake_clause(intake, 24)


def _med_phrase_nausea(meds: str, a: Dict[str, Any]) -> str:
    if meds == "other":
        freq = (a.get("med_freq") or "").strip()
        if freq:
            return f"other anti-nausea medication as prescribed ({freq})"
        return "other anti-nausea medication as prescribed"
    short = _med_short_from_list(MEDS_NAUSEA, meds)
    return f"{short} as prescribed" if short else "medication as prescribed"


def _narrate_nau(a: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    sev = _severity_word(a.get("severity_post_meds") or a.get("severity_no_meds"))
    meds = a.get("meds")
    taking = meds and meds != "none"

    if taking:
        out.append(
            f"You reported {sev} nausea with medications, "
            f"you are taking {_med_phrase_nausea(meds, a)}."
        )
    else:
        out.append(
            f"You reported {sev} nausea, and you are not taking anti-nausea medication."
        )

    sent = _intake_clause(a.get("intake"), 24)
    if sent:
        out.append(sent)

    vc = a.get("vomiting_check")
    if vc is True:
        out.append("You reported vomiting.")

    if a.get("abd_pain") is True:
        out.append("You have abdominal pain or cramping.")
    elif a.get("abd_pain") is False:
        out.append("No abdominal pain.")

    if a.get("adl") is False:
        out.append("You cannot perform self care activities.")
    elif a.get("adl") is True:
        out.append("You can perform self care activities.")

    return out


def _narrate_vom(a: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    days = a.get("days")
    try:
        dnum = int(float(days)) if days is not None and days != "" else None
    except (TypeError, ValueError):
        dnum = None

    sev_phrase = _severity_word(a.get("severity_post_med")) if a.get("severity_post_med") else ""

    if dnum is not None and dnum >= 0:
        day_word = "day" if dnum == 1 else "days"
        if sev_phrase:
            out.append(
                f"You have had {dnum} {day_word} of vomiting, {sev_phrase} after medications."
            )
        else:
            out.append(f"You have had {dnum} {day_word} of vomiting.")
    elif sev_phrase:
        out.append(f"You reported vomiting, {sev_phrase} after medications.")

    sent = _intake_clause(a.get("intake"), 12)
    if sent:
        out.append(sent)

    # Frequency bucket (e.g. 3-5 times) — short clause when present without duplicating days line awkwardly
    vf = a.get("vom_freq")
    if vf and _choice_label_from_vom_freq(vf):
        lb = _choice_label_from_vom_freq(vf)
        out.append(f"You vomited {lb.lower()} in the last 24 hours.")

    if a.get("abd_pain") is True:
        out.append("You have abdominal pain or cramping.")
    elif a.get("abd_pain") is False:
        out.append("No abdominal pain.")

    if a.get("adl") is False:
        out.append("You cannot perform self care activities.")
    elif a.get("adl") is True:
        out.append("You can perform self care activities.")

    return out


def _choice_label_from_vom_freq(val: Any) -> Optional[str]:
    m = {
        "low": "1-2 times",
        "med": "3-5 times",
        "high": "more than 6 times",
    }
    return m.get(val)


def _narrate_dia(a: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    try:
        ddays = float(a.get("preface") or 0)
    except (TypeError, ValueError):
        ddays = 0
    trend = a.get("trend")
    worsening = trend == "bad" and ddays >= 3

    try:
        stools = float(a.get("stools") or 0)
    except (TypeError, ValueError):
        stools = 0

    s_word = "stool" if stools == 1 else "stools"
    if worsening and stools > 0:
        out.append(
            f"You have had worsening diarrhea with {int(stools)} loose {s_word} in the last 24 hours."
        )
    elif worsening:
        out.append("You have had worsening diarrhea.")
    elif stools > 0:
        out.append(
            f"You have had diarrhea with {int(stools)} loose {s_word} in the last 24 hours."
        )
    elif ddays > 0:
        dw = "day" if ddays == 1 else "days"
        base = f"You have had diarrhea for {int(ddays)} {dw}"
        if trend == "bad":
            base = "You have had worsening diarrhea" + (
                f" for {int(ddays)} {dw}." if ddays else "."
            )
        else:
            base += "."
        out.append(base)

    types = a.get("stool_type") or []
    if isinstance(types, str):
        types = [types]
    if "black" in types:
        out.append("Your stool is black.")
    if "blood" in types:
        out.append("Your stool has blood.")
    if "mucus" in types:
        out.append("You reported mucus in your stool.")

    if a.get("abd_pain") is True:
        sev = _severity_word(a.get("abd_pain_sev"))
        out.append(f"You have {sev} abdominal pain or cramping.")
    elif a.get("abd_pain") is False:
        out.append("No abdominal pain.")

    meds = a.get("meds")
    sev_d = a.get("severity_post_med") or a.get("severity_no_meds")
    if meds and meds != "none":
        short = _med_short_from_list(MEDS_DIARRHEA, meds)
        if meds == "other":
            freq = (a.get("med_freq") or "").strip()
            if sev_d:
                out.append(
                    "You are taking other antidiarrheal medication as prescribed"
                    + (f" ({freq})" if freq else "")
                    + f" and report the diarrhea as {_severity_word(sev_d)} after medication."
                )
            else:
                out.append(
                    "You are taking other antidiarrheal medication as prescribed"
                    + (f" ({freq})." if freq else ".")
                )
        elif short and sev_d:
            out.append(
                f"You are taking {short} as prescribed and report the diarrhea "
                f"as {_severity_word(sev_d)} after medication."
            )
        elif short:
            out.append(f"You are taking {short} as prescribed.")
    elif sev_d:
        out.append(
            f"You report diarrhea as {_severity_word(sev_d)} without antidiarrheal medication."
        )

    short_intake = _intake_clause_diarrhea_short(a.get("intake"))
    if short_intake:
        out.append(short_intake)

    if a.get("adl") is False:
        out.append("You cannot do daily activities.")
    elif a.get("adl") is True:
        out.append("You can do daily activities.")

    return out


def _yes_no_abd_pain(q: Question, val: bool) -> Optional[str]:
    qid, ql = q.id, q.text.lower()
    if "abd_pain" not in qid and not ("abdominal" in ql and ("pain" in ql or "cramping" in ql)):
        return None
    if "rate" in qid:
        return None
    if val:
        return "You have abdominal pain or cramping."
    return "No abdominal pain."


def _yes_no_adl(q: Question, val: bool) -> Optional[str]:
    ql = q.text.lower()
    if "adl" not in q.id and "daily" not in ql and "self care" not in ql:
        return None
    if "cough" in q.id:  # handled separately
        return None
    if "self care" in ql or "bathing" in ql or "dressing" in ql:
        if val:
            return "You can perform self care activities."
        return "You cannot perform self care activities."
    if "daily activities" in ql or "household" in ql:
        if val:
            return "You can do daily activities."
        return "You cannot do daily activities."
    return None


def _generic_natural_clause(symptom: SymptomDef, q: Question, val: Any, answers: Dict[str, Any]) -> Optional[str]:
    if val is None or val == "" or val == []:
        return None
    it = _norm_input_type(q)
    qid, ql = q.id, q.text.lower()
    sl = symptom.name.lower()

    if it == InputType.YES_NO and isinstance(val, bool):
        abd = _yes_no_abd_pain(q, val)
        if abd:
            return abd
        adl = _yes_no_adl(q, val)
        if adl:
            return adl
        if qid == "cough_adl_prevent":
            if val:
                return "Your cough prevents you from doing daily activities."
            return None
        if qid == "cough_chest_sob":
            if val:
                return "You reported chest pain or shortness of breath with your cough."
            return None
        # Low-value follow-ups: omit "no" for urine prompts to reduce noise
        if "urine" in ql and val is False:
            return None
        # Symptom-agnostic yes/no wording for all modules.
        # Keep positives; only include negatives for high-signal prompts.
        question_text = q.text.strip().rstrip("?")
        if len(question_text) > 110:
            question_text = question_text[:107] + "..."
        if val:
            return f"You reported that {question_text[0].lower() + question_text[1:]}."
        if any(k in ql for k in ("interfere", "daily activities", "self care", "vision", "fever", "shortness of breath")):
            return f"You reported that {question_text[0].lower() + question_text[1:]} is not present."
        return None

    if qid == "meds" and it == InputType.CHOICE:
        if val == "none":
            return f"You denied taking prescription medication for your {sl} in this assessment."
        lab = _choice_label(q, val)
        if lab:
            short = lab.split(" (", 1)[0].strip().lower()
            return f"You are taking {short} as prescribed."
        return None

    if qid == "intake" and it == InputType.CHOICE:
        win = 12 if "12" in q.text else 24
        if symptom.id == "DIA-205":
            return _intake_clause_diarrhea_short(val)
        return _intake_clause(val, win)

    if qid in (
        "severity",
        "cough_severity",
        "discomfort",
        "severity_post_med",
        "severity_post_meds",
        "severity_no_meds",
    ) or ("severity" in qid and "post" in qid):
        if it == InputType.CHOICE:
            return f"You reported {_severity_word(str(val))} {sl}."

    if qid == "abd_pain_sev" and it == InputType.CHOICE:
        return f"You reported {_severity_word(str(val))} abdominal pain."

    if qid in ("days", "preface") and it == InputType.CHOICE:
        lab = _choice_label(q, val)
        if lab:
            return f"You reported duration of {sl} as {lab.lower()}."

    if it == InputType.NUMBER:
        if "temp" in qid or qid == "cough_temp" or ("temperature" in ql and "oxygen" not in ql):
            return f"You reported a temperature of {val}."
        if "o2" in qid or "sat" in qid or "oxygen" in ql:
            return f"You reported oxygen saturation of {val}."
        if qid in ("days_bm", "days_gas"):
            day_word = "day" if float(val) == 1 else "days"
            if qid == "days_bm":
                return f"You have had no bowel movement for {int(float(val))} {day_word}."
            return f"You have had no gas passage for {int(float(val))} {day_word}."
        if qid in ("days", "preface"):
            day_word = "day" if float(val) == 1 else "days"
            return f"You have had {sl} for {int(float(val))} {day_word}."
        lab = q.text.strip().rstrip("?").lower()
        if "how many" in lab and "last 24 hours" in lab:
            return f"You reported {val} in the last 24 hours."
        return f"You reported a value of {val}."

    if it == InputType.CHOICE and qid == "mucus":
        lab = _choice_label(q, val)
        if lab:
            return f"You reported cough mucus as: {lab.lower()}."

    if it == InputType.MULTISELECT:
        lab = _choice_label_multiselect(q, val)
        if lab:
            if "dehydration" in ql:
                return f"You reported signs of dehydration: {lab}."
            if "where does it hurt" in ql or qid == "loc":
                return f"You reported pain locations: {lab}."
            if "stool" in ql or qid == "stool_type":
                parts: List[str] = []
                raw = val if isinstance(val, list) else [val]
                if "black" in raw:
                    parts.append("Your stool is black.")
                if "blood" in raw:
                    parts.append("Your stool has blood.")
                if "mucus" in raw:
                    parts.append("You reported mucus in your stool.")
                if "none" in raw and len(raw) == 1:
                    return None
                return " ".join(parts) if parts else None
            return f"You reported: {lab}."

    if it == InputType.TEXT and _coerce_str(val):
        vs = _coerce_str(val)
        if len(vs) > 200:
            vs = vs[:197] + "…"
        return f"You provided additional details: {vs}."

    if it == InputType.CHOICE:
        lab = _choice_label(q, val)
        if lab:
            shortq = q.text.strip().rstrip("?").lower()
            if "when did" in shortq or "how long" in shortq:
                return f"You reported this has been present for {lab.lower()}."
            if "where" in shortq and ("hurt" in shortq or "pain" in shortq):
                return f"You reported pain location as {lab.lower()}."
            return f"You reported {lab.lower()}."

    return None


def _choice_label_multiselect(q: Question, value: Any) -> Optional[str]:
    if not isinstance(value, list):
        value = [value]
    parts: List[str] = []
    for raw in value:
        if raw in (None, "", "none"):
            continue
        for opt in q.options:
            if opt.value == raw or str(opt.value) == str(raw):
                if opt.label:
                    parts.append(opt.label.strip())
                break
        else:
            parts.append(str(raw))
    if not parts:
        return None
    return ", ".join(parts)


def _coerce_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _iterate_questions(symptom: SymptomDef) -> List[Question]:
    seen: Set[str] = set()
    out: List[Question] = []
    for q in symptom.screening_questions + symptom.follow_up_questions:
        if q.id in seen:
            continue
        seen.add(q.id)
        out.append(q)
    return out


def _narrate_other_symptom(symptom: SymptomDef, answers: Dict[str, Any]) -> List[str]:
    lines: List[str] = []
    sl = symptom.name.lower()
    q_by_id = {q.id: q for q in _iterate_questions(symptom)}
    for q in _iterate_questions(symptom):
        if q.id not in answers:
            continue
        c = _generic_natural_clause(symptom, q, answers[q.id], answers)
        if c:
            lines.append(c)
    for key, val in sorted(answers.items()):
        if val is None or val == "" or val == []:
            continue
        if key in q_by_id:
            continue
        chunk = _coerce_str(val)
        if chunk is None:
            continue
        if isinstance(val, bool):
            # Skip generic yes/no leftovers to avoid noisy "yes regarding" style output.
            continue
        elif isinstance(val, list):
            chunk = ", ".join(str(x) for x in val if x not in (None, ""))
            if not chunk:
                continue
        lines.append(f"You noted {key.replace('_', ' ')}: {chunk}.")
    return lines


def _fallback_unknown(symptom_id: str, answers: Dict[str, Any], resolver: Callable[[str], str]) -> List[str]:
    name = resolver(symptom_id)
    label = name.strip() or symptom_id
    if not answers:
        return [f"You completed reporting for {label.lower()}."]
    out: List[str] = []
    for key, val in sorted(answers.items()):
        if val is None or val == "" or val == []:
            continue
        if isinstance(val, bool):
            chunk = "yes" if val else "no"
        elif isinstance(val, list):
            chunk = ", ".join(str(x) for x in val if x not in (None, ""))
            if not chunk:
                continue
        else:
            chunk = str(val).strip()
            if not chunk:
                continue
        out.append(f"You noted {key.replace('_', ' ')}: {chunk}.")
    return out


def _dedupe_preserve_order(lines: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for s in lines:
        t = s.strip()
        if not t:
            continue
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def build_clinical_narrative_summary(
    engine_state: Dict[str, Any],
    get_symptom_name: Callable[[str], str],
) -> str:
    symptom_answers: Dict[str, Dict[str, Any]] = engine_state.get("symptom_answers") or {}
    completed: List[str] = engine_state.get("completed_symptoms") or []
    selected: List[str] = engine_state.get("selected_symptoms") or []
    order = completed if completed else selected

    sentences: List[str] = []

    for sid in order:
        ans = symptom_answers.get(sid) or {}
        if sid == "NAU-203":
            sentences.extend(_narrate_nau(ans))
            continue
        if sid == "VOM-204":
            sentences.extend(_narrate_vom(ans))
            continue
        if sid == "DIA-205":
            sentences.extend(_narrate_dia(ans))
            continue

        symptom = get_symptom_by_id(sid)
        if symptom and not symptom.hidden:
            sentences.extend(_narrate_other_symptom(symptom, ans))
        elif symptom and symptom.hidden and ans:
            sentences.extend(_narrate_other_symptom(symptom, ans))
        else:
            sentences.extend(_fallback_unknown(sid, ans, get_symptom_name))

    notes = engine_state.get("personal_notes")
    if notes and str(notes).strip():
        sentences.append(f"Additional notes: {str(notes).strip()}")

    sentences = _dedupe_preserve_order(sentences)

    cleaned: List[str] = []
    for s in sentences:
        t = (s or "").strip()
        if not t:
            continue
        if not t.endswith("."):
            t += "."
        cleaned.append(t)

    return " ".join(cleaned) if cleaned else ""
