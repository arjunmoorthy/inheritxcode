from uuid import UUID

from fastapi import status

from db.models import StaffProfile, StaffAssociation


def test_sso_provision_creates_staff(client, db_session, test_physician_uuid):
    # Ensure no staff exists initially
    assert db_session.query(StaffProfile).filter(StaffProfile.email_address == "dr.test@oncolife.com").first() is None

    response = client.post("/api/v1/auth/sso/provision", json={"role": "physician"})
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["created"] is True
    assert body["email"] == "dr.test@oncolife.com"
    assert body["staff_uuid"] == test_physician_uuid

    # Check DB record
    staff = db_session.query(StaffProfile).filter(StaffProfile.email_address == "dr.test@oncolife.com").first()
    assert staff is not None
    assert str(staff.staff_uuid) == test_physician_uuid


def test_sso_provision_idempotent(client, db_session):
    # First call
    response1 = client.post("/api/v1/auth/sso/provision", json={"role": "staff"})
    assert response1.status_code == status.HTTP_200_OK
    body1 = response1.json()
    assert body1["created"] is True

    # Second call should be idempotent
    response2 = client.post("/api/v1/auth/sso/provision", json={"role": "staff"})
    assert response2.status_code == status.HTTP_200_OK
    body2 = response2.json()
    assert body2["created"] is False


def test_sso_provision_creates_association_when_clinic_uuid_provided(client, db_session, random_uuid):
    # Provision user with a clinic UUID
    response = client.post("/api/v1/auth/sso/provision", json={"role": "physician", "clinic_uuid": random_uuid})
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["created"] is True

    # Find staff and association
    staff = db_session.query(StaffProfile).filter(StaffProfile.email_address == "dr.test@oncolife.com").first()
    assert staff is not None

    association = db_session.query(StaffAssociation).filter(StaffAssociation.staff_uuid == staff.staff_uuid).first()
    assert association is not None
    assert str(association.clinic_uuid) == random_uuid
