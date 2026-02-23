def split_name(full_name: str):
    if not full_name:
        return None, None

    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], None

    return parts[0], " ".join(parts[1:])
