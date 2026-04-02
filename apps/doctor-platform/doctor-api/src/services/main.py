from .structured_extractor import extract_structured_fields
from .ai_fallback import ai_extract
from .post_processing_service import (
    is_bad_name, find_name,
    is_bad_dob, find_dob,
    is_bad_email, find_email,
    is_bad_phone, find_phone,
    clean_value
)
import re

def extract_structured_fields_dynamic(extracted_data):

    # ===============================
    # STEP 1: RUN OLD LOGIC FIRST
    # ===============================
    base_structured = extract_structured_fields(extracted_data)

    # flatten for easy override
    structured = {
        k: v if isinstance(v, dict) else {"value": v}
        for k, v in base_structured.items()
    }

    # ===============================
    # STEP 2: PREPARE LINES
    # ===============================
    lines = [
        item["text"].strip()
        for item in extracted_data
        if item.get("text") and item["text"].strip()
    ]

    # ===============================
    # STEP 3: CLEANERS
    # ===============================
    def clean_phone(text):
        if not text:
            return text
        text = re.sub(r"(?i)(phone|number|mobile|ph)\s*[:\-]?\s*", "", text)
        match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", text)
        return match.group() if match else text.strip()

    def clean_email(text):
        if not text:
            return text
        match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
        return match.group() if match else text.strip()

    # ===============================
    # STEP 4: SMART EXTRACTION (OVERRIDE ONLY CORE FIELDS)
    # ===============================
    candidates = {
        "name": [],
        "date_of_birth": [],
        "email": [],
        "phone_number": []
    }

    def looks_like_name(text):
        return (
            text
            and len(text.split()) >= 2
            and not re.search(r"\d", text)
            and not any(w in text.lower() for w in ["sex", "male", "female", "dob", "age"])
        )

    for i, line in enumerate(lines):

        # NAME
        if looks_like_name(line):
            score = 2
            if i < len(lines) * 0.2:
                score += 2
            candidates["name"].append((line, score))

        # DOB
        if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line):
            candidates["date_of_birth"].append((line, 3))

        # EMAIL
        if "@" in line:
            candidates["email"].append((line, 3))

        # PHONE
        if re.search(r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}", line):
            candidates["phone_number"].append((line, 3))

    # ===============================
    # STEP 5: APPLY BEST VALUES (SAFE OVERRIDE)
    # ===============================

    def is_valid_name(text):
        return (
            text
            and len(text.split()) >= 2
            and len(text.split()) <= 4
            and not re.search(r"\d", text)
            and not any(w in text.lower() for w in [
                "mrn", "dob", "age", "sex", "female", "male", "plan"
            ])
        )

    def is_valid_dob(text):
        if not text:
            return False

        # Reject timestamps
        if re.search(r"\d{1,2}:\d{2}", text):
            return False

        # Accept only clean date
        return bool(re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4}", text.strip()))

    def is_valid_email(text):
        return bool(re.fullmatch(
            r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
            text.strip()
        ))

    def is_valid_phone(text):
        return bool(re.fullmatch(
            r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}",
            text.strip()
        ))

    VALIDATORS = {
        "name": is_valid_name,
        "date_of_birth": is_valid_dob,
        "email": is_valid_email,
        "phone_number": is_valid_phone
    }

    for field, vals in candidates.items():
        if not vals:
            continue

        vals.sort(key=lambda x: x[1], reverse=True)

        for raw_val, _ in vals:

            cleaned = raw_val.strip()

            if field == "phone_number":
                cleaned = clean_phone(cleaned)

            if field == "email":
                cleaned = clean_email(cleaned)

            # ✅ VALIDATE BEFORE USING
            if not VALIDATORS[field](cleaned):
                continue

            # ✅ ONLY OVERRIDE IF:
            # - field missing OR
            # - existing value is bad
            existing = structured.get(field, {}).get("value")

            if not existing or not VALIDATORS[field](existing):
                structured[field] = {"value": cleaned}

            break  # take first valid candidate only

    # ===============================
    # STEP 6: AI FALLBACK (ONLY IF MISSING)
    # ===============================
    missing = [
        k for k in ["name", "date_of_birth", "email", "phone_number"]
        if k not in structured
    ]

    if missing:
        ai_data = ai_extract("\n".join(lines))
        for field in missing:
            if field in ai_data and ai_data[field]:
                structured[field] = {"value": clean_value(ai_data[field])}  
    
    return structured