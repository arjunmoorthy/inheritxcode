import re

# =========================================================
# MAIN FUNCTION
# =========================================================
def extract_structured_fields(extracted_data: list[dict]) -> dict:
    structured = {}

    # -----------------------------------------------------
    # Normalize OCR lines
    # -----------------------------------------------------
    lines = [
        item["text"].strip()
        for item in extracted_data
        if item.get("text") and item["text"].strip()
    ]

    lower_lines = [line.lower() for line in lines]

    def is_footer_line(line: str) -> bool:
        c = line.lower()
        return (
            "printed at" in c
            or "page" in c
            or re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", c)
            or re.search(r"\b\d{1,2}:\d{2}\b", c)
        )

    # =====================================================
    # GLOBAL VALIDATION RULES (CRITICAL FOR MULTI-FORMAT)
    # =====================================================

    NAME_BLACKLIST = [
        "patient history",
        "patient characteristics",
        "progress notes",
        "assessment",
        "plan",
        "history",
        "age",
        "menarche",
        "birth",
        "stage",
        "ajcc",
        "cancer"
    ]

    DOB_BLACKLIST = [
        "printed at",
        "office visit",
        "planned",
        "date of service"
    ]

    STOP_WORDS = [
        # general section breakers
        "assessment",
        "plan",
        "progress notes",
        "problem list",
        "diagnosis",

        # oncology sections
        "cancer staging",
        "ajcc",
        "oncology history",
        "oncology treatment",
        "treatment summary",
        "line of treatment",
        "treatment goal",
        "current cycle",
        "planned no of cycles",

        # social / screening sections
        "social drivers of health",
        "tobacco use",
        "alcohol use",
        "financial resource strain",
        "food insecurity",
        "transportation needs",
        "physical activity",
        "stress",
        "social connections",
        "intimate partner violence",
        "housing stability",
        "utilities",
        "depression:",
    ]

    def slice_section(lines, start_label):
        start_idx = None

        # find section start
        for i, line in enumerate(lines):
            if start_label in line.lower():
                start_idx = i + 1
                break

        if start_idx is None:
            return []

        section = []

        for line in lines[start_idx:]:
            clean = line.strip()
            lower = clean.lower()

            # 🛑 STOP if next major section starts
            if (
                lower.startswith("social drivers") or
                lower.startswith("oncology history") or
                lower.startswith("oncology treatment") or
                lower.startswith("assessment") or
                lower.startswith("plan") or
                lower.startswith("progress notes") or
                lower.startswith("problem list")
            ):
                break

            # ignore footers
            if "printed at" in lower:
                continue

            section.append(clean)

        return section

    # -----------------------------------------------------
    # Validators
    # -----------------------------------------------------
    def looks_like_name(text: str) -> bool:
        text = text.strip()

        if not text:
            return False

        # Reject blacklisted phrases
        if any(b in text.lower() for b in NAME_BLACKLIST):
            return False

        # Reject long sentences
        if len(text.split()) > 4:
            return False

        # Reject digits
        if re.search(r"\d", text):
            return False

        # Allow letters, dot, space
        if not re.match(r"^[A-Za-z.\s'-]+$", text):
            return False

        # Must have at least first + last
        if len(text.split()) < 2:
            return False

        # At least one capitalized word
        if not any(word[0].isupper() for word in text.split()):
            return False

        return True
    
    def is_stop_line(line: str) -> bool:
        return any(stop in line.lower() for stop in STOP_WORDS)
    
    def extract_after_label(label: str, max_lookahead: int = 2):
        """
        Handles:
        - Label: value
        - Label -> value (next line)
        """
        label = label.lower()

        for i, line in enumerate(lower_lines):
            if label in line:

                # Inline: "BMI: 23.5"
                if ":" in lines[i]:
                    val = lines[i].split(":", 1)[1].strip()
                    if val:
                        return val

                # Below label
                for j in range(1, max_lookahead + 1):
                    if i + j < len(lines):
                        candidate = lines[i + j].strip()
                        if candidate and not is_footer_line(candidate):
                            return candidate

        return None
    
    def extract_bmi():
        for i, line in enumerate(lower_lines):

            if "bmi" in line or "body mass index" in line:

                # 1️⃣ Inline: "BMI: 23.4"
                match = re.search(r"\b\d{1,2}(\.\d{1,2})?\b", lines[i])
                if match:
                    return match.group()

                # 2️⃣ Below line
                if i + 1 < len(lines):
                    match = re.search(
                        r"\b\d{1,2}(\.\d{1,2})?\b",
                        lines[i + 1]
                    )
                    if match:
                        return match.group()

        return None
    
    def extract_start_end_date(label):
        for i, line in enumerate(lower_lines):
            if label in line:

                # Inline
                match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", lines[i])
                if match:
                    return match.group()

                # Below
                if i + 1 < len(lines):
                    match = re.search(
                        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", lines[i + 1]
                    )
                    if match:
                        return match.group()
        return None
    
    def extract_plan_name():
        PLAN_LABELS = [
            "plan name",
            "treatment plan",
            "regimen",
            "therapy plan"
        ]

        for i, line in enumerate(lower_lines):
            if any(label in line for label in PLAN_LABELS):

                # 1️⃣ Inline case
                if ":" in lines[i]:
                    val = lines[i].split(":", 1)[1].strip()
                    if len(val.split()) >= 2:
                        return val

                # 2️⃣ Below label (MOST COMMON)
                collected = []
                for j in range(1, 4):
                    if i + j >= len(lines):
                        break

                    candidate = lines[i + j].strip()

                    if is_stop_line(candidate):
                        break

                    if len(candidate.split()) <= 12:
                        collected.append(candidate)

                if collected:
                    return " ".join(collected)

        return None
    
    def extract_pathway():
        for i, line in enumerate(lower_lines):
            if "start on pathway regimen" in line:
                parts = []

                # Same line
                if "-" in lines[i]:
                    parts.append(lines[i].split("-", 1)[1].strip())

                # Next line
                if i + 1 < len(lines):
                    parts.append(lines[i + 1].strip())

                result = " ".join(parts).strip()
                return result if len(result) > 5 else None

        return None
    
    def extract_past_medical_history():
        section = slice_section(lines, "past medical history")
        results = []

        for line in section:
            lower = line.lower()

            if is_footer_line(line):
                continue
            if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", line):
                continue
            if len(line.split()) > 10:
                continue

            results.append(line.strip())

        return " ".join(results) if results else None
    
    def extract_past_surgical_history():
        section = slice_section(lines, "past surgical history")
        results = []

        for line in section:
            lower = line.lower()

            if is_footer_line(line):
                continue
            if "performed by" in lower:
                continue
            if len(line.split()) > 12:
                continue

            results.append(line.strip())

        return " ".join(results) if results else None

    # -----------------------------------------------------
    # Safe Date Extractor (REAL DOB ONLY)
    # -----------------------------------------------------
    def extract_dob():
        for line in lines:
            if any(b in line.lower() for b in DOB_BLACKLIST):
                continue

            match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
            if match:
                return match.group()

        return None

    # -----------------------------------------------------
    # SAFE NAME EXTRACTION (WORKS FOR BOTH FORMATS)
    # -----------------------------------------------------
    def extract_name():
        candidates = []

        for i, line in enumerate(lower_lines):

            # Match exact labels only
            if re.match(r"^\s*(name|patient name)\s*:?\s*$", line):

                # Check ABOVE
                if i - 1 >= 0:
                    above = lines[i - 1].strip()
                    if looks_like_name(above):
                        candidates.append(above)

                # Check BELOW
                if i + 1 < len(lines):
                    below = lines[i + 1].strip()
                    if looks_like_name(below):
                        candidates.append(below)

            # Inline case: "Name: Julie Smith"
            if line.startswith("name"):
                inline = re.sub(r"(?i)^name\s*:?", "", lines[i]).strip()
                if looks_like_name(inline):
                    candidates.append(inline)

        if not candidates:
            return None

        # Prefer shortest valid candidate (real names are short)
        candidates.sort(key=lambda x: len(x))
        return candidates[0]

    # -----------------------------------------------------
    # SAFE AGE EXTRACTION
    # -----------------------------------------------------
    def extract_age():
        for i, line in enumerate(lower_lines):

            # Exact label
            if line.strip() in ("age", "age:"):

                # Value ABOVE
                if i - 1 >= 0 and lines[i - 1].strip().isdigit():
                    age = int(lines[i - 1].strip())
                    if 0 < age <= 120:
                        return str(age)

                # Value BELOW
                if i + 1 < len(lines) and lines[i + 1].strip().isdigit():
                    age = int(lines[i + 1].strip())
                    if 0 < age <= 120:
                        return str(age)

            # Inline Age: 61
            if line.startswith("age"):
                match = re.search(r"\b(\d{1,3})\b", lines[i])
                if match:
                    age = int(match.group())
                    if 0 < age <= 120:
                        return str(age)

        return None

    # -----------------------------------------------------
    # Gender
    # -----------------------------------------------------
    # def extract_gender():
    #     for line in lower_lines:
    #         if line.strip() == "female":
    #             return "Female"
    #         if line.strip() == "male":
    #             return "Male"
    #     return None

    def extract_gender():
        for i, line in enumerate(lower_lines):
            clean = line.strip()

            # -----------------------------
            # 1️⃣ Exact standalone cases
            # -----------------------------
            if clean == "female":
                return "Female"
            if clean == "male":
                return "Male"

            # -----------------------------
            # 2️⃣ Inline labels
            # -----------------------------
            if "gender" in clean or "sex" in clean:
                match = re.search(r"\b(female|male)\b", clean)
                if match:
                    return match.group(1).capitalize()

            # -----------------------------
            # 3️⃣ Abbreviations (F / M)
            # -----------------------------
            if clean in ("f", "m"):
                return "Female" if clean == "f" else "Male"

            # -----------------------------
            # 4️⃣ Mixed lines (Female, Age 66)
            # -----------------------------
            match = re.search(r"\b(female|male)\b", clean)
            if match:
                # Avoid false positives like "female relative"
                if "relative" not in clean and "history" not in clean:
                    return match.group(1).capitalize()

        return None

    # -----------------------------------------------------
    # Email
    # -----------------------------------------------------
    def extract_email():
        for line in lines:
            match = re.search(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", line
            )
            if match:
                return match.group()
        return None

    # -----------------------------------------------------
    # Phone
    # -----------------------------------------------------
    def extract_phone():
        for line in lines:
            match = re.search(
                r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", line
            )
            if match:
                return match.group()
        return None

    # =====================================================
    # FIELD EXTRACTION
    # =====================================================

    name = extract_name()
    if name:
        structured["name"] = {"value": name}

    dob = extract_dob()
    if dob:
        structured["date_of_birth"] = {"value": dob}

    age = extract_age()
    if age:
        structured["age"] = {"value": age}

    gender = extract_gender()
    if gender:
        structured["gender"] = {"value": gender}

    email = extract_email()
    if email:
        structured["email"] = {"value": email}

    phone = extract_phone()
    if phone:
        structured["phone_number"] = {"value": phone}

    bmi = extract_bmi()
    if bmi:
        structured["bmi"] = {"value": bmi}

    start_date = extract_start_end_date("start date")
    if start_date:
        structured["start_date"] = {"value": start_date}

    end_date = extract_start_end_date("end date")
    if end_date:
        structured["end_date"] = {"value": end_date}

    plan_name = extract_plan_name()
    if plan_name:
        structured["plan_name"] = {"value": plan_name}

    pathway = extract_pathway() 
    if pathway:
        structured["start_on_pathway_regimen"] = {"value": pathway}

    past_medical = extract_past_medical_history()
    if past_medical:
        structured["past_medical_history"] = {"value": past_medical}

    past_surgical = extract_past_surgical_history()
    if past_surgical:
        structured["past_surgical_history"] = {"value": past_surgical}

    return structured


# =========================================================
# FLATTEN FUNCTION
# =========================================================
def flatten_structured_data(structured: dict) -> dict:
    flattened = {}

    for key, val in structured.items():
        if isinstance(val, dict) and "value" in val:
            flattened[key] = val["value"]
        else:
            flattened[key] = val

    return flattened