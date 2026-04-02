import re

def extract_from_labels(lines):
    structured = {}

    for line in lines:
        l = line.lower().strip()

        # ---------------- NAME ----------------
        if l.startswith("name"):
            val = re.sub(r"(?i)^name[:\s]*", "", line).strip()
            if val:
                structured["name"] = {"value": val}

        # ---------------- GENDER ----------------
        elif l.startswith("sex") or l.startswith("gender"):
            val = re.sub(r"(?i)^(sex|gender)[:\s]*", "", line).strip()
            structured["gender"] = {"value": val.capitalize()}

        # ---------------- DOB ----------------
        elif "date of birth" in l or l.startswith("dob"):
            match = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", line)
            if match:
                structured["date_of_birth"] = {"value": match.group()}

        # ---------------- AGE ----------------
        elif l.startswith("age"):
            match = re.search(r"\b\d{1,3}\b", line)
            if match:
                structured["age"] = {"value": match.group()}

        # ---------------- EMAIL ----------------
        elif "email" in l:
            match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", line)
            if match:
                structured["email"] = {"value": match.group()}

        # ---------------- PHONE ----------------
        elif "phone" in l:
            match = re.search(r"\b\d{10}\b", line)
            if match:
                structured["phone_number"] = {"value": match.group()}

    return structured


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def match_label(line: str, labels: list[str]) -> bool:
    norm_line = normalize(line)

    for label in labels:
        if normalize(label) in norm_line:
            return True

    return False

def clean_value(text):
    if not text:
        return text
    return re.sub(r"^(email|phone|phone number)\s*:?\s*", "", text, flags=re.I).strip()


def is_bad_name(text):
    return not text or any(w in text.lower() for w in ["care", "clinic", "hospital", "SEX", "Female", "recipient"])


def is_bad_dob(text):
    return ":" in text if text else True


def is_bad_email(text):
    return not re.fullmatch(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text or "")


def is_bad_phone(text):
    return not re.fullmatch(r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}", text or "")


def find_email(lines):
    for i, line in enumerate(lines):

        if match_label(line, ["email", "email address"]):

            match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", line)
            if match:
                return match.group()

            if i + 1 < len(lines):
                match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", lines[i + 1])
                if match:
                    return match.group()

    return None


def find_phone(lines):
    for l in lines:
        m = re.search(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", l)
        if m:
            return m.group()


def find_dob(lines):
    DOB_LABELS = [
        "date of birth",
        "dob",
        "birth date",
        "date of birth:",
        "dob:"
    ]

    for i, line in enumerate(lines):
        if match_label(line, DOB_LABELS):

            # ✅ inline
            match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", line)
            if match:
                return match.group()

            # ✅ next line
            if i + 1 < len(lines):
                match = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", lines[i + 1])
                if match:
                    return match.group()

    return None

def find_name(lines):
    print("Finding name from lines:ssssssssssssssssssssssssssssssssssssss")
    NAME_LABELS = [
        "name",
        "NAME",
        "Name",
        "patient name",
        "patient"
    ]

    for i, line in enumerate(lines):
        if match_label(line, NAME_LABELS):

            # inline
            if ":" in line:
                val = line.split(":", 1)[1].strip()
                if len(val.split()) >= 2:
                    return val

            # next line
            if i + 1 < len(lines):
                val = lines[i + 1].strip()
                if len(val.split()) >= 2 and not re.search(r"\d", val):
                    return val

    return None