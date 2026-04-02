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
    
    # def extract_past_medical_history():
    #     section = slice_section(lines, "past medical history")
    #     results = []

    #     for line in section:
    #         lower = line.lower()

    #         if is_footer_line(line):
    #             continue
    #         if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", line):
    #             continue
    #         if len(line.split()) > 10:
    #             continue

    #         results.append(line.strip())

    #     return " ".join(results) if results else None

    def extract_past_medical_history():
        section = slice_section(lines, "past medical history")
        results = []

        for line in section:
            lower = line.lower()

            # STOP early
            if any(stop in lower for stop in [
                "social history",
                "family history",
                "labs",
                "imaging",
                "orders",
                "allergies"
            ]):
                break

            if len(line.split()) > 8:
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
    def extract_phone():
        for line in lines:
            match = re.search(
                r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", line
            )
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
                match = re.search(r"\b\d{6,8}\b", line)
                if match:
                    return match.group()

                # -----------------------------------
                # 2️⃣ NEXT LINE
                # -----------------------------------
                if i + 1 < len(lines):
                    next_line = lines[i + 1]

                    match = re.search(r"\b\d{6,8}\b", next_line)
                    if match:
                        return match.group()

        return None
    
    mrn = extract_mrn()
    if mrn:
        structured["mrn"] = {"value": mrn}

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