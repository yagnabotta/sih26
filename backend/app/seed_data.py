from datetime import datetime
from .database import SessionLocal
from .models.organization import Organization
from .models.user import User
from .models.emergency import (
    Responder,
    IncidentLocation,
    Incident,
    IncidentStatusHistory,
    EmergencyNotification,
    IncidentTypeEnum,
    SeverityEnum,
    IncidentStatusEnum,
    ResponderTypeEnum,
    ResponderAvailabilityEnum
)
from .services.auth_security import hash_password

def seed_sample_data():
    db = SessionLocal()
    try:
        # 1. Seed Default Emergency Organization
        org = db.query(Organization).filter(Organization.id == "org-emergency-01").first()
        if not org:
            org = Organization(
                id="org-emergency-01",
                name="City Emergency Operations Command",
                sector="Public Safety & Civil Protection"
            )
            db.add(org)
            db.commit()

        # 2. Seed Accounts for USER, RESPONDER, ADMIN with hashed passwords
        test_accounts = [
            {
                "email": "admin@emergency.com",
                "password": "AdminPassword123!",
                "full_name": "EOC Operations Director",
                "role": "ADMIN",
                "phone": "+91-98000-11111",
                "status": "ACTIVE"
            },
            {
                "email": "responder@emergency.com",
                "password": "ResponderPassword123!",
                "full_name": "Emergency Responder Captain",
                "role": "RESPONDER",
                "phone": "+91-98000-22222",
                "status": "ACTIVE"
            },
            {
                "email": "user@emergency.com",
                "password": "UserPassword123!",
                "full_name": "Citizen Reporter John Doe",
                "role": "USER",
                "phone": "+91-98000-33333",
                "status": "ACTIVE"
            },
            # Backward compatibility accounts
            {
                "email": "admin1@gmail.com",
                "password": "Admin1@123",
                "full_name": "Chief Safety Administrator",
                "role": "ADMIN",
                "phone": "+91-98000-44444",
                "status": "ACTIVE"
            },
            {
                "email": "user1@gmail.com",
                "password": "User1@123",
                "full_name": "Field Safety Operator",
                "role": "USER",
                "phone": "+91-98000-55555",
                "status": "ACTIVE"
            }
        ]

        for acc in test_accounts:
            existing = db.query(User).filter(User.email == acc["email"]).first()
            if not existing:
                u = User(
                    organization_id=org.id,
                    email=acc["email"],
                    password=hash_password(acc["password"]),
                    full_name=acc["full_name"],
                    role=acc["role"],
                    phone=acc["phone"],
                    status=acc["status"]
                )
                db.add(u)
                db.commit()
            else:
                # Ensure role and password hash are synced
                existing.role = acc["role"]
                existing.full_name = acc["full_name"]
                if not existing.password.startswith("pbkdf2:"):
                    existing.password = hash_password(acc["password"])
                db.commit()

        # 3. Seed Emergency Responders
        responder_count = db.query(Responder).count()
        if responder_count == 0:
            sample_responders = [
                Responder(
                    name="Apex Fire Station Engine 01",
                    responder_type=ResponderTypeEnum.FIRE_ENGINE.value,
                    contact="+91-98765-01001",
                    current_latitude=18.9220,
                    current_longitude=72.8347,
                    availability_status=ResponderAvailabilityEnum.AVAILABLE.value
                ),
                Responder(
                    name="Rapid Response Ambulance Unit 04",
                    responder_type=ResponderTypeEnum.AMBULANCE.value,
                    contact="+91-98765-01002",
                    current_latitude=18.9320,
                    current_longitude=72.8250,
                    availability_status=ResponderAvailabilityEnum.AVAILABLE.value
                ),
                Responder(
                    name="HazMat Emergency Containment Squad",
                    responder_type=ResponderTypeEnum.HAZMAT.value,
                    contact="+91-98765-01003",
                    current_latitude=18.9400,
                    current_longitude=72.8400,
                    availability_status=ResponderAvailabilityEnum.AVAILABLE.value
                ),
                Responder(
                    name="Industrial Security Patrol 02",
                    responder_type=ResponderTypeEnum.POLICE.value,
                    contact="+91-98765-01004",
                    current_latitude=18.9150,
                    current_longitude=72.8300,
                    availability_status=ResponderAvailabilityEnum.AVAILABLE.value
                )
            ]
            for r in sample_responders:
                db.add(r)
            db.commit()

        # 4. Seed Sample Emergency Incident
        incident_count = db.query(Incident).count()
        if incident_count == 0:
            sample_location = IncidentLocation(
                latitude=18.9256,
                longitude=72.8312,
                address="Sector 4 Cracker Plant, Refinery South Gate",
                city="Mumbai",
                state="Maharashtra",
                postal_code="400001",
                landmark="Near Compressor House 2"
            )
            db.add(sample_location)
            db.flush()

            sample_incident = Incident(
                incident_reference="INC-2026-0001",
                reported_by_id=None,
                incident_type=IncidentTypeEnum.GAS_LEAK.value,
                severity=SeverityEnum.HIGH.value,
                description="[DEV-TEST] Pressurized flange valve leaking flammable hydrocarbon vapor in Sector 4 Cracker Plant.",
                status=IncidentStatusEnum.REPORTED.value,
                incident_location_id=sample_location.id
            )
            db.add(sample_incident)
            db.flush()

            initial_history = IncidentStatusHistory(
                incident_id=sample_incident.id,
                old_status=None,
                new_status=IncidentStatusEnum.REPORTED.value,
                notes="Initial emergency report logged in testing registry."
            )
            db.add(initial_history)

            initial_notification = EmergencyNotification(
                incident_id=sample_incident.id,
                type="STATUS_UPDATE",
                title="Incident INC-2026-0001 Registered",
                message="[DEV-TEST] High severity Gas Leak reported at Sector 4 Cracker Plant.",
                status="UNREAD"
            )
            db.add(initial_notification)
            db.commit()

    except Exception as e:
        db.rollback()
        print("[Seed Data] Error seeding sample data:", e)
    finally:
        db.close()
