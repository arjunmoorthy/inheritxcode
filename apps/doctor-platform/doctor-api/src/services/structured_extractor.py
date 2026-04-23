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
    
    def clean_phone(text):
        if not text:
            return text

        # remove words like "number", "phone", etc.
        text = re.sub(r"(?i)(phone|number|mobile|ph)\s*[:\-]?\s*", "", text)

        # extract only valid phone
        match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", text)
        return match.group() if match else text.strip()
    
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
        for i, line in enumerate(lower_lines):

            if "plan name" in line:

                # ❌ Ignore useless values
                if "no matching plan" in line:
                    return None

                # Inline valid plan
                if ":" in lines[i]:
                    val = lines[i].split(":", 1)[1].strip()

                    if len(val.split()) >= 2 and "mrn" not in val.lower():
                        return val

                # Below lines
                for j in range(1, 3):
                    if i + j >= len(lines):
                        break

                    candidate = lines[i + j].strip()

                    if (
                        len(candidate.split()) >= 2
                        and "mrn" not in candidate.lower()
                        and "name" not in candidate.lower()
                    ):
                        return candidate

        return None
    
    def extract_pathway():
        LABELS = [
            "start on pathway regimen",
            "pathway regimen",
            # "primary diagnosis",
            # "diagnosis"
        ]

        for i, line in enumerate(lower_lines):

            if any(label in line for label in LABELS):

                candidates = []

                # -------------------------------
                # 1️⃣ Extract from SAME LINE
                # -------------------------------
                same_line = lines[i]

                # Remove label part
                cleaned = re.sub(
                    r"(?i)(start on pathway regimen|pathway regimen|primary diagnosis|diagnosis)\s*[:\-]?\s*",
                    "",
                    same_line
                ).strip()

                if cleaned:
                    candidates.append(cleaned)

                # -------------------------------
                # 2️⃣ Extract from NEXT LINE
                # -------------------------------
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line:
                        candidates.append(next_line)

                # -------------------------------
                # 3️⃣ CLEAN + PICK TYPE
                # -------------------------------
                for text in candidates:

                    # Split words
                    words = text.split()

                    for word in words:
                        word_clean = re.sub(r"[^A-Za-z]", "", word)

                        # Only meaningful word (no codes like BOS307)
                        if (
                            word_clean
                            and len(word_clean) > 2
                            and not word_clean.isupper()  # avoids BOS
                        ):
                            return word_clean

        return None

    # def extract_past_medical_history():
    #     section = slice_section(lines, "past medical history")
    #     results = []

    #     for line in section:
    #         lower = line.lower()

    #         # STOP early
    #         if any(stop in lower for stop in [
    #             "social history",
    #             "family history",
    #             "labs",
    #             "imaging",
    #             "orders",
    #             "allergies"
    #         ]):
    #             break

    #         if len(line.split()) > 8:
    #             continue

    #         results.append(line.strip())

    #     return " ".join(results) if results else None

    # def extract_past_medical_history():
    #     results = []
    #     capture = False

    #     for line in lines:
    #         original = line.strip()
    #         lower = original.lower()

    #         # -----------------------------
    #         # 🎯 START
    #         # -----------------------------
    #         if "Past Medical History" in original:
    #             capture = True
    #             continue

    #         if not capture:
    #             continue

    #         # -----------------------------
    #         # 🛑 STOP
    #         # -----------------------------
    #         if any(stop in lower for stop in [
    #             "past surgical history",
    #             "social history",
    #             "family history",
    #             "allergies",
    #             "medications",
    #             "labs",
    #             "imaging",
    #             "orders"
    #         ]):
    #             break

    #         # -----------------------------
    #         # ❌ SKIP NOISE
    #         # -----------------------------
    #         if (
    #             not original
    #             or re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", original)
    #         ):
    #             continue

    #         # -----------------------------
    #         # ✅ HANDLE BULLETS (IMPORTANT)
    #         # -----------------------------
    #         clean = re.sub(r"^[•\-\*]\s*", "", original)

    #         # remove small OCR junk
    #         if len(clean.split()) <= 1:
    #             continue

    #         results.append(clean)

    #     # ✅ KEEP FORMAT (NOT SINGLE STRING)
    #     return results if results else None


    # def extract_past_medical_history():
    #     results = []
    #     capture = False

    #     for line in lines:
    #         original = line.strip()
    #         lower = original.lower()

    #         # START
    #         if "past medical history" in lower:
    #             capture = True
    #             continue

    #         if not capture:
    #             continue

    #         # STOP
    #         if "past surgical" in lower:
    #             break

    #         # ❌ SKIP HEADERS
    #         if any(x in lower for x in ["diagnosis", "date"]):
    #             continue

    #         # ❌ SKIP EMPTY / DATE
    #         if not original or re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", original):
    #             continue

    #         # ✅ HANDLE BULLETS
    #         if original.startswith("•"):
    #             clean = re.sub(r"^[•]\s*", "", original)
    #             results.append(clean)

    #     return results if results else None
    
    # def extract_past_surgical_history():
    #     results = []
    #     capture = False

    #     for line in lines:
    #         lower = line.lower().strip()

    #         # -----------------------------
    #         # 🎯 START
    #         # -----------------------------
    #         if "past surgical history" in lower:
    #             capture = True
    #             continue

    #         if not capture:
    #             continue

    #         # -----------------------------
    #         # 🛑 HARD STOP
    #         # -----------------------------
    #         if any(stop in lower for stop in [
    #             "social history",
    #             "family history",
    #             "allergies",
    #             "medications",
    #             "labs",
    #             "imaging",
    #             "orders"
    #         ]):
    #             break

    #         # -----------------------------
    #         # ❌ SKIP NOISE
    #         # -----------------------------
    #         if (
    #             not line.strip()
    #             or "performed by" in lower
    #             or re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", line)
    #             or len(line.split()) > 10
    #         ):
    #             continue

    #         # -----------------------------
    #         # ✅ CLEAN PROCEDURE
    #         # -----------------------------
    #         clean = re.sub(r"\b(N/A|Date|Procedure|Laterality)\b", "", line, flags=re.I)
    #         clean = re.sub(r"\s+", " ", clean).strip()

    #         results.append(clean)

    #     return " ".join(results) if results else None

    # -----------------------------------------------------
    # Safe Date Extractor (REAL DOB ONLY)
    # -----------------------------------------------------
    # def extract_dob():
    #     for line in lines:
    #         if any(b in line.lower() for b in DOB_BLACKLIST):
    #             continue

    #         match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
    #         if match:
    #             return match.group()

    #     return None

    # def extract_dob():
    #     for line in lines:

    #         if any(b in line.lower() for b in DOB_BLACKLIST):
    #             continue

    #         # Extract ONLY clean date (ignore time)
    #         match = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", line)
    #         if match:
    #             return match.group()

    #     return None


    def get_section_text(text, start_key, stop_keys):
        text_lower = text.lower()
        start = text_lower.find(start_key)

        if start == -1:
            return ""

        end = len(text)

        for stop in stop_keys:
            idx = text_lower.find(stop, start + 1)
            if idx != -1:
                end = min(end, idx)

        return text[start:end]
    
    def clean_medical_text(text):
        text = re.sub(r"past medical history[:]*", "", text, flags=re.I)
        text = re.sub(r"past surgical history[:]*", "", text, flags=re.I)

        # remove common junk words
        text = re.sub(r"\b(Diagnosis Date|Procedure|Laterality|Date)\b", "", text, flags=re.I)

        # remove timestamps & dates
        text = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", text)
        text = re.sub(r"\d{1,2}:\d{2}\s*(AM|PM)?", "", text, flags=re.I)

        # remove random numbers like 6/10
        text = re.sub(r"\b\d+/\d+\b", "", text)

        # normalize spaces
        text = re.sub(r"\s+", " ", text).strip()

        return text
    
    def extract_conditions(text):
        words = text.split()

        conditions = []
        current = []

        for word in words:
            # heuristic: new condition starts with capital letter
            if word[0].isupper() and current:
                conditions.append(" ".join(current))
                current = []

            current.append(word)

        if current:
            conditions.append(" ".join(current))

        return conditions

    def extract_past_medical_history(full_text):
        raw = get_section_text(
            full_text,
            "past medical history",
            ["past surgical history", "social history", "family history"]
        )

        cleaned = clean_medical_text(raw)

        conditions = extract_conditions(cleaned)

        return " | ".join(conditions) if conditions else None
    
    def extract_past_surgical_history(full_text):
        raw = get_section_text(
            full_text,
            "past surgical history",
            ["social history", "family history", "allergies"]
        )

        cleaned = clean_medical_text(raw)

        # split by keywords or capital chunks
        procedures = re.split(r"\b(?=[A-Z]{3,})", cleaned)

        procedures = [p.strip() for p in procedures if len(p.strip()) > 3]

        return " | ".join(procedures) if procedures else None

    def extract_dob():
        candidates = []

        for i, line in enumerate(lines):
            lower = line.lower()

            # -----------------------------------
            # 1️⃣ STRONG SIGNAL → contains DOB label
            # -----------------------------------
            if any(k in lower for k in ["dob", "date of birth", "d.o.b"]):
                match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
                if match:
                    candidates.append((match.group(), 10))

                # also check next line
                if i + 1 < len(lines):
                    match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", lines[i + 1])
                    if match:
                        candidates.append((match.group(), 9))

            # -----------------------------------
            # 2️⃣ MEDIUM SIGNAL → near NAME block
            # -----------------------------------
            if any(k in lower for k in ["name", "sex", "age"]):
                for j in range(1, 4):
                    if i + j < len(lines):
                        match = re.search(
                            r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
                            lines[i + j]
                        )
                        if match:
                            candidates.append((match.group(), 6))

            # -----------------------------------
            # 3️⃣ WEAK SIGNAL → generic dates
            # BUT filter OUT visit/printed dates
            # -----------------------------------
            if re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line):

                # ❌ HARD FILTERS (CRITICAL)
                if any(bad in lower for bad in [
                    "printed",
                    "office visit",
                    "encounter date",
                    "visit date",
                    "generated",
                    "signed",
                    "admission",
                    "discharge",
                    "printed at",
                    "office visit",
                    "planned",
                    "date of service"
                ]):
                    continue

                # ❌ ignore timestamps
                if re.search(r"\d{1,2}:\d{2}", line):
                    continue

                match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
                if match:
                    candidates.append((match.group(), 3))

        # -----------------------------------
        # 4️⃣ PICK BEST
        # -----------------------------------
        if not candidates:
            return None

        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]

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

            # Inline case:
            if line.startswith("name"):
                inline = re.sub(r"(?i)^name\s*:?", "", lines[i]).strip()
                if looks_like_name(inline):
                    candidates.append(inline)

        if not candidates:
            return None

        # Prefer shortest valid candidate (real names are short)
        candidates.sort(key=lambda x: len(x))
        return candidates[0]
    
    def normalize_name(name):
        if "," in name:
            parts = [p.strip() for p in name.split(",")]
            if len(parts) == 2:
                return f"{parts[1]} {parts[0]}"
        return name
    
    if "name" in structured:
        structured["name"]["value"] = normalize_name(structured["name"]["value"])

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
    # def extract_phone():
    #     phone_keywords = ["phone", "contact", "mobile", "tel"]

    #     # ✅ First pass: labeled lines
    #     for i, line in enumerate(lines):
    #         clean = line.lower()

    #         if "fax" in clean:
    #             continue

    #         if any(keyword in clean for keyword in phone_keywords):
    #             # Try same line
    #             match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", line)
    #             if match:
    #                 return match.group()

    #             # ✅ Try next line (handles broken OCR)
    #             if i + 1 < len(lines):
    #                 next_line = lines[i + 1]
    #                 match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", next_line)
    #                 if match:
    #                     return match.group()

    #     # 🔁 Fallback
    #     for line in lines:
    #         clean = line.lower()

    #         if any(x in clean for x in ["fax", "mrn", "date", "page"]):
    #             continue

    #         match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", line)
    #         if match:
    #             return match.group()

    #     return None

    def extract_phone():
        for i, line in enumerate(lines):
            clean = line.lower()

            # ❌ Skip fax lines
            if "fax" in clean:
                continue

            # ✅ Focus on "phone number" (your main format)
            if "phone number" in clean or "phone" in clean:
                # Same line
                match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", line)
                if match:
                    return match.group()

                # Next line (OCR split case)
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    match = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", next_line)
                    if match:
                        return match.group()

        return None
    
    def clean_oncologist(text):
        text = re.sub(r"\(.*?\)", "", text)  # remove (Physician)
        text = re.sub(r"\b(MD|DO|Dr\.?)\b", "", text, flags=re.I)
        return text.strip()
    
    def is_garbage(text):
        lower = text.lower()

        return (
            len(text.split()) > 6   # too long = not name
            or any(k in lower for k in [
                "snomed", "diagnosis", "plan", "history",
                "medications", "allergies", "labs", "imaging"
            ])
        )
    
    def extract_oncologist():
        for i, line in enumerate(lines):
            lower = line.lower().strip()

            # -----------------------------------
            # ONLY MATCH LABEL (not anywhere)
            # -----------------------------------
            if lower.startswith("oncologist"):

                # -----------------------------------
                # 1️⃣ INLINE VALUE
                # -----------------------------------
                val = re.sub(r"(?i)^Oncologist\s*[:\-]?\s*", "", line).strip()

                if val:
                    print("Found oncologist inline:", val)
                    return clean_oncologist(val)

                # -----------------------------------
                # 2️⃣ NEXT LINE (MOST COMMON CASE)
                # -----------------------------------
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()

                    if not is_garbage(next_line):
                        return clean_oncologist(next_line)

                # -----------------------------------
                # 3️⃣ SECOND NEXT LINE (RARE OCR BREAK)
                # -----------------------------------
                if i + 2 < len(lines):
                    next_line = lines[i + 2].strip()

                    if not is_garbage(next_line):
                        return clean_oncologist(next_line)

        return None
    def is_valid_oncologist(text):
        return (
            text
            and len(text.split()) >= 2
            and len(text.split()) <= 6
            and not re.search(r"\d", text)
            and not any(w in text.lower() for w in [
                "mrn", "dob", "age", "plan", "name"
            ])
        )
    
    def extract_mrn():
        for i, line in enumerate(lines):

            # normalize for matching
            normalized = re.sub(r"[.\s]", "", line.lower())

            # -----------------------------------
            # MATCH MRN LABEL (ANY FORMAT)
            # MRN / mrn / M.R.N / M R N
            # -----------------------------------
            if "mrn" in normalized:

                # -----------------------------------
                # 1️⃣ INLINE CASE
                # -----------------------------------
                match = re.search(r"\b\d{6,10}\b", line)
                print(match,'mrnmmmmmmmmmmmmmmmmmmmmmmm')
                if match:
                    return match.group()

                # -----------------------------------
                # 2️⃣ NEXT LINE
                # -----------------------------------
                if i + 1 < len(lines):
                    next_line = lines[i + 1]

                    match = re.search(r"\b\d{6,10}\b", next_line)
                    if match:
                        return match.group()

        return None
    
    mrn = extract_mrn()
    if mrn:
        structured["mrn"] = {"value": mrn}

    def extract_library_code():
        candidates = []

        for i, line in enumerate(lines):

            words = line.split()

            for word in words:

                # -----------------------------
                # CLEAN OCR NOISE
                # -----------------------------
                clean = word.strip()
                clean = re.sub(r"[^\w]", "", clean)

                if not clean:
                    continue

                clean = clean.upper()

                score = 0

                # -----------------------------
                # 🎯 1. STRICT MATCH (BEST CASE)
                # e.g. BOS307
                # -----------------------------
                if re.match(r"^[A-Z]{3}\d{3}$", clean):
                    score += 10  # highest priority

                # -----------------------------
                # 2. FLEXIBLE MATCH (fallback)
                # -----------------------------
                elif re.match(r"^[A-Z]{2,4}\d{2,4}$", clean):
                    score += 5

                else:
                    continue

                # -----------------------------
                # ❌ HARD FILTERS (VERY IMPORTANT)
                # -----------------------------
                if clean.startswith(("ICD", "CPT", "HCPCS")):
                    continue

                if any(x in line.lower() for x in [
                    "mrn", "dob", "phone", "fax", "zip", "date"
                ]):
                    score -= 5

                # avoid long numeric noise nearby
                if re.search(r"\d{7,}", line):
                    score -= 2

                candidates.append((clean, score))

        if not candidates:
            return None

        # -----------------------------
        # PICK BEST
        # -----------------------------
        candidates.sort(key=lambda x: x[1], reverse=True)

        return candidates[0][0]
    
    def extract_medications_after_code(library_code):
        medications = []
        seen = set()

        if not library_code:
            return []

        start_idx = None

        # -----------------------------
        # 1️⃣ FIND LIBRARY CODE LINE
        # -----------------------------
        for i, line in enumerate(lines):
            if library_code in line:
                start_idx = i
                break

        if start_idx is None:
            return []

        # -----------------------------
        # 2️⃣ SCAN BELOW
        # -----------------------------
        for line in lines[start_idx + 1:]:

            clean = line.strip()

            if not clean:
                break  # stop at empty

            lower = clean.lower()

            # -----------------------------
            # 🛑 STOP CONDITIONS
            # -----------------------------
            if any(x in lower for x in [
                "confirm dose",
                "pharmacy",
                "note",
                "warning",
                "plan",
                "diagnosis"
            ]):
                break

            # -----------------------------
            # ✅ VALID MEDICATION FILTER
            # -----------------------------
            # Rule: mostly words, may contain (), -, etc.
            if (
                len(clean.split()) <= 4
                and not re.search(r"\d{3,}", clean)  # avoid numbers
                and not any(x in lower for x in [
                    "bos", "cycle", "day"
                ])
            ):
                normalized = clean.strip()

                # remove duplicates
                if normalized not in seen:
                    seen.add(normalized)
                    medications.append(normalized)

            else:
                # If line looks too noisy → stop
                if len(clean.split()) > 6:
                    break

        return medications
    
    def extract_location():
        for i, line in enumerate(lower_lines):

            # -----------------------------------
            # 🎯 STEP 1: FIND "INITIAL CONSULT"
            # -----------------------------------
            if "initial consult" in line:

                # -----------------------------------
                # 🎯 STEP 2: LOOK BELOW (next 3–5 lines)
                # -----------------------------------
                for j in range(1, 6):
                    if i + j >= len(lines):
                        break

                    candidate = lines[i + j].strip()
                    lower_c = candidate.lower()

                    # -----------------------------------
                    # ❌ SKIP BAD LINES
                    # -----------------------------------
                    if (
                        not candidate
                        or re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", candidate)  # dates
                        or any(x in lower_c for x in [
                            "dx", "diagnosis", "reason", "referred",
                            "physician", "provider"
                        ])
                    ):
                        continue

                    # -----------------------------------
                    # ✅ STRONG LOCATION SIGNAL
                    # -----------------------------------
                    if any(x in lower_c for x in [
                        "cancer care",
                        "medical oncology",
                        "clinic",
                        "hospital",
                        "center"
                    ]):
                        return candidate

        return None
    
    location = extract_location()
    print(location,'locaaaaaaaaaaaaaaaaaa')
    if location:
        structured["location"] = {"value": location}
    
    drug_description = extract_medications_after_code(extract_library_code())
    print(drug_description, 'druggggggggggggggggggg')
    if drug_description:
        structured["drug_description"] = {"value": drug_description}

    library_code = extract_library_code()
    print(library_code,'llllllllllllllllllll')
    if library_code:
        structured["library_code"] = {"value": library_code}

    oncologist = extract_oncologist()
    print(oncologist,'fffffffffffffffffffff')
    if oncologist:
        print("Extracted oncologist:", oncologist)
        structured["oncologist"] = {"value": oncologist}
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
        structured["phone_number"] = {"value": clean_phone(phone)}

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
    
    diagnosis = extract_pathway()
    if diagnosis:
        structured["diagnosis"] = {"value": diagnosis}

    pathway = extract_pathway() 
    if pathway:
        structured["start_on_pathway_regimen"] = {"value": pathway}

    full_text = " ".join(lines)
    past_medical = extract_past_medical_history(full_text)
    if past_medical:
        structured["past_medical_history"] = {"value": past_medical}
        
    full_text = " ".join(lines)
    past_surgical = extract_past_surgical_history(full_text)
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


# import re
# import json

# # ================================
# # OPTIONAL: OPENAI SETUP
# # ================================
# USE_OPENAI = False  # 🔁 Turn ON when needed
# OPENAI_API_KEY = ""  # 🔑 Set your OpenAI API key here

# if USE_OPENAI:
#     from openai import OpenAI
#     client = OpenAI(api_key=OPENAI_API_KEY)


# # ================================
# # LABEL MAP (NEW)
# # ================================
# LABEL_MAP = {
#     "name": ["name", "NAME", "Name", "patient name", "pt name"],
#     "date_of_birth": ["dob", "date of birth", "Date of birth", "birth date"],
#     "age": ["age"],
#     "gender": ["gender", "sex"],
#     "email": ["email", "e-mail"],
#     "phone": ["phone", "mobile", "contact", "phone number"],
# }


# def match_label(line: str, field: str) -> bool:
#     return any(label in line.lower() for label in LABEL_MAP.get(field, []))


# def get_nearby_candidates(lines, index, window=3):
#     return [
#         lines[i].strip()
#         for i in range(index - window, index + window + 1)
#         if 0 <= i < len(lines)
#     ]


# # ================================
# # CLEANING (NEW)
# # ================================
# def clean_value(text: str) -> str:
#     text = re.sub(
#         r"^(email|e-mail|phone|phone number|ph|mob)\s*:?\s*",
#         "",
#         text,
#         flags=re.I
#     )
#     return text.strip()


# # ================================
# # VALIDATORS (NEW - CRITICAL)
# # ================================
# def is_valid_name(text):
#     if not text:
#         return False

#     text = text.strip()

#     # Reject org words
#     if any(word in text.lower() for word in ["care", "clinic", "hospital", "center"]):
#         return False

#     if not (2 <= len(text.split()) <= 3):
#         return False

#     if re.search(r"\d", text):
#         return False

#     return True


# def is_valid_dob(text):
#     if ":" in text:
#         return False
#     return bool(re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", text))


# def is_valid_email(text):
#     return bool(re.fullmatch(
#         r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
#         text.strip()
#     ))


# def is_valid_phone(text):
#     return bool(re.fullmatch(
#         r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}",
#         text.strip()
#     ))


# def is_valid_age(text):
#     if text.isdigit():
#         age = int(text)
#         return 0 < age <= 120
#     return False


# # ================================
# # HYBRID EXTRACTOR (NEW)
# # ================================
# def extract_field(lines, field, validator):
#     for i, line in enumerate(lines):
#         if match_label(line, field):

#             candidates = get_nearby_candidates(lines, i)

#             for c in candidates:
#                 cleaned = clean_value(c)

#                 if validator(cleaned):
#                     return cleaned, 5

#     return None, 0


# # ================================
# # AI FALLBACK
# # ================================
# def ai_extract(text: str):
#     if not USE_OPENAI:
#         return {}

#     prompt = f"""
#     Extract:
#     Name, Date of Birth, Age, Gender, Phone Number, Email

#     Return JSON only.

#     Text:
#     {text}
#     """

#     response = client.chat.completions.create(
#         model="gpt-5-mini",
#         messages=[
#             {"role": "system", "content": "You extract structured medical data."},
#             {"role": "user", "content": prompt}
#         ],
#         temperature=0
#     )

#     try:
#         return json.loads(response.choices[0].message.content)
#     except:
#         return {}


# # ================================
# # ORIGINAL LOGIC (UNCHANGED)
# # ================================
# def extract_email_old(lines):
#     for line in lines:
#         match = re.search(
#             r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
#             line
#         )
#         if match:
#             return match.group()
#     return None


# def extract_phone_old(lines):
#     for line in lines:
#         match = re.search(
#             r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",
#             line
#         )
#         if match:
#             return match.group()
#     return None


# def extract_dob_old(lines):
#     for line in lines:
#         if ":" in line:
#             continue
#         match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
#         if match:
#             return match.group()
#     return None


# # ================================
# # MAIN FUNCTION (FINAL)
# # ================================
# def extract_structured_fields(extracted_data: list[dict]) -> dict:

#     structured = {}
#     confidence = {}

#     lines = [
#         item["text"].strip()
#         for item in extracted_data
#         if item.get("text") and item["text"].strip()
#     ]

#     # ============================
#     # STEP 1: TRY OLD LOGIC FIRST
#     # ============================
#     email_old = extract_email_old(lines)
#     phone_old = extract_phone_old(lines)
#     dob_old = extract_dob_old(lines)

#     if email_old:
#         structured["email"] = {"value": email_old}
#         confidence["email"] = 3

#     if phone_old:
#         structured["phone_number"] = {"value": phone_old}
#         confidence["phone_number"] = 3

#     if dob_old:
#         structured["date_of_birth"] = {"value": dob_old}
#         confidence["date_of_birth"] = 3

#     # ============================
#     # STEP 2: HYBRID IMPROVEMENT
#     # ============================
#     name, s = extract_field(lines, "name", is_valid_name)
#     if name:
#         structured["name"] = {"value": name}
#         confidence["name"] = s

#     email, s = extract_field(lines, "email", is_valid_email)
#     if email:
#         structured["email"] = {"value": email}
#         confidence["email"] = s

#     phone, s = extract_field(lines, "phone", is_valid_phone)
#     if phone:
#         structured["phone_number"] = {"value": phone}
#         confidence["phone_number"] = s

#     age, s = extract_field(lines, "age", is_valid_age)
#     if age:
#         structured["age"] = {"value": age}
#         confidence["age"] = s

#     # ============================
#     # STEP 3: AI FALLBACK
#     # ============================
#     avg_conf = sum(confidence.values()) / len(confidence) if confidence else 0

#     if avg_conf < 3:
#         print("⚠️ AI fallback triggered")

#         ai_data = ai_extract("\n".join(lines))

#         for k, v in ai_data.items():
#             if k not in structured and v:
#                 structured[k] = {"value": v}

#     return structured


# # ================================
# # FLATTEN FUNCTION
# # ================================
# def flatten_structured_data(structured: dict) -> dict:
#     return {
#         k: v["value"] if isinstance(v, dict) and "value" in v else v
#         for k, v in structured.items()
#     }