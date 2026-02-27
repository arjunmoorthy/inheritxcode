from passlib.context import CryptContext
import secrets
import string

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    print("🔐 HASHING PASSWORD VALUE:", repr(password))
    print("🔐 PASSWORD BYTE LENGTH:", len(password.encode("utf-8")))

    if not isinstance(password, str):
        raise TypeError("Password must be a string")

    byte_len = len(password.encode("utf-8"))
    if byte_len > 72:
        raise ValueError(
            f"Password too long for bcrypt: {byte_len} bytes"
        )

    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def generate_random_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))