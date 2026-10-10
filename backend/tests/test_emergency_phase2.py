"""
Phase 2 Backend Foundation Test Suite
Tests emergency models, schemas, service layer, and router handlers.
Runs without requiring external packages like httpx.
"""

import sys
import unittest
from datetime import datetime

# Add backend to import path
sys.path.insert(0, r"C:\Users\yagna\OneDrive\Desktop\sih26\backend")

from app.database import Base, engine, SessionLocal, ensure_emergency_schema
from app.models.emergency import (
    Incident,
    IncidentLocation,
    Responder,
    ResponderAssignment,
    EmergencyNotification,
    IncidentStatusHistory,
    IncidentTypeEnum,
    SeverityEnum,
    IncidentStatusEnum,
    ResponderTypeEnum,
    ResponderAvailabilityEnum,
    AssignmentStatusEnum
)
from app.schemas.emergency import (
    IncidentCreate,
    IncidentLocationCreate,
    IncidentStatusUpdate,
    IncidentAssignRequest,
    ResponderCreate
)
from app.services import emergency_service
from pydantic import ValidationError

class TestEmergencyPhase2(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Ensure schema is initialized before running tests."""
        ensure_emergency_schema()

    def setUp(self):
        """Create a fresh database session for each test."""
        self.db = SessionLocal()

    def tearDown(self):
        """Clean up database session."""
        self.db.close()

    def test_01_database_tables_initialized(self):
        """Verify all 6 emergency tables exist in SQLite metadata."""
        table_names = Base.metadata.tables.keys()
        required_tables = [
            "incident_locations",
            "incidents",
            "responders",
            "responder_assignments",
            "emergency_notifications",
            "incident_status_history"
        ]
        for tbl in required_tables:
            self.assertIn(tbl, table_names, f"Table {tbl} must be present in database metadata.")
        print("  [PASS] test_01_database_tables_initialized")

    def test_02_create_and_read_incident(self):
        """Verify creating an emergency incident with confirmed location and reading it back."""
        loc_data = IncidentLocationCreate(
            latitude=19.0760,
            longitude=72.8777,
            address="Terminal 2 Cargo Gate 5, International Airport Area",
            city="Mumbai",
            state="Maharashtra",
            postal_code="400099"
        )
        incident_data = IncidentCreate(
            incident_type=IncidentTypeEnum.FIRE,
            severity=SeverityEnum.CRITICAL,
            description="Electrical transformer short-circuit with active flames near fuel storage.",
            location=loc_data
        )

        incident = emergency_service.create_incident(self.db, incident_data)
        self.assertIsNotNone(incident.id)
        self.assertTrue(incident.incident_reference.startswith("INC-"))
        self.assertEqual(incident.status, IncidentStatusEnum.REPORTED.value)
        self.assertEqual(incident.severity, "CRITICAL")
        self.assertEqual(incident.location.address, "Terminal 2 Cargo Gate 5, International Airport Area")
        self.assertAlmostEqual(incident.location.latitude, 19.0760)

        # Read back
        fetched = emergency_service.get_incident_by_id(self.db, incident.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.incident_reference, incident.incident_reference)
        print("  [PASS] test_02_create_and_read_incident")

    def test_03_invalid_incident_validation(self):
        """Verify backend Pydantic validation rejects invalid inputs (coordinates, severity, length)."""
        # Invalid Latitude (> 90)
        with self.assertRaises(ValidationError):
            IncidentLocationCreate(
                latitude=195.0,  # Invalid
                longitude=72.8,
                address="Invalid Lat Test"
            )

        # Invalid Severity
        with self.assertRaises(ValidationError):
            IncidentCreate(
                incident_type=IncidentTypeEnum.FIRE,
                severity="SUPER_MEGA_CRITICAL",  # Invalid enum value
                description="Test description with enough length",
                location=IncidentLocationCreate(
                    latitude=18.9,
                    longitude=72.8,
                    address="Test Address"
                )
            )

        # Description too short (< 5 chars)
        with self.assertRaises(ValidationError):
            IncidentCreate(
                incident_type=IncidentTypeEnum.MEDICAL,
                severity=SeverityEnum.LOW,
                description="help",  # Too short (< 5 chars)
                location=IncidentLocationCreate(
                    latitude=18.9,
                    longitude=72.8,
                    address="Test Address"
                )
            )
        print("  [PASS] test_03_invalid_incident_validation")

    def test_04_create_and_query_responders(self):
        """Verify registering responders and querying fleet by availability and type."""
        resp_data = ResponderCreate(
            name="Unit Test Alpha Ambulance",
            responder_type=ResponderTypeEnum.AMBULANCE,
            contact="+91-99999-00001",
            current_latitude=19.0800,
            current_longitude=72.8800,
            availability_status=ResponderAvailabilityEnum.AVAILABLE
        )
        responder = emergency_service.create_responder(self.db, resp_data)
        self.assertIsNotNone(responder.id)

        all_resp = emergency_service.get_responders(self.db, availability="AVAILABLE")
        self.assertTrue(len(all_resp) >= 1)
        self.assertTrue(any(r.name == "Unit Test Alpha Ambulance" for r in all_resp))
        print("  [PASS] test_04_create_and_query_responders")

    def test_05_nearby_responder_proximity(self):
        """Verify proximity algorithm correctly sorts responders by distance to incident location."""
        # Incident target coordinates
        target_lat = 19.0760
        target_lon = 72.8777

        nearby = emergency_service.get_nearby_responders(
            self.db,
            latitude=target_lat,
            longitude=target_lon,
            radius_km=100.0
        )
        self.assertTrue(len(nearby) >= 1)
        # Check that list is sorted ascending by distance_km
        distances = [item["distance_km"] for item in nearby]
        self.assertEqual(distances, sorted(distances), "Nearby responders must be ordered by distance ascending.")
        for r in nearby:
            self.assertIn("distance_km", r)
            self.assertIn("estimated_travel_time_mins", r)
            self.assertTrue(r["distance_km"] <= 100.0)
        print("  [PASS] test_05_nearby_responder_proximity")

    def test_06_incident_assignment_and_status_progression(self):
        """Verify assigning responder, status updates, and history audit trail."""
        # 1. Create Incident
        loc = IncidentLocationCreate(
            latitude=18.9500,
            longitude=72.8500,
            address="Dockyard Workshop 3"
        )
        inc_data = IncidentCreate(
            incident_type=IncidentTypeEnum.INDUSTRIAL_ACCIDENT,
            severity=SeverityEnum.MEDIUM,
            description="Worker trapped under collapsed staging beam in dockyard workshop.",
            location=loc
        )
        incident = emergency_service.create_incident(self.db, inc_data)

        # 2. Get an available responder
        responders = emergency_service.get_responders(self.db, availability="AVAILABLE")
        self.assertTrue(len(responders) > 0)
        responder = responders[0]

        # 3. Assign responder
        assigned_inc = emergency_service.assign_responder_to_incident(self.db, incident, responder)
        self.assertEqual(assigned_inc.status, IncidentStatusEnum.ASSIGNED.value)
        self.assertEqual(assigned_inc.assigned_responder_id, responder.id)
        self.assertEqual(responder.availability_status, ResponderAvailabilityEnum.BUSY.value)

        # 4. Progress status: ASSIGNED -> EN_ROUTE -> ARRIVED -> RESOLVED
        updated_inc = emergency_service.update_incident_status(
            self.db,
            assigned_inc,
            new_status=IncidentStatusEnum.EN_ROUTE.value,
            notes="Unit departing base with emergency siren active."
        )
        self.assertEqual(updated_inc.status, "EN_ROUTE")

        resolved_inc = emergency_service.update_incident_status(
            self.db,
            updated_inc,
            new_status=IncidentStatusEnum.RESOLVED.value,
            notes="Worker safely extracted and transported to medical room. Incident resolved."
        )
        self.assertEqual(resolved_inc.status, "RESOLVED")

        # Responder should be freed back to AVAILABLE
        self.assertEqual(responder.availability_status, ResponderAvailabilityEnum.AVAILABLE.value)

        # 5. Check Audit History Timeline
        history = emergency_service.get_incident_history(self.db, incident.id)
        self.assertTrue(len(history) >= 3, "History should record REPORTED, ASSIGNED, EN_ROUTE, RESOLVED transitions.")
        history_statuses = [h.new_status for h in history]
        self.assertIn("RESOLVED", history_statuses)
        self.assertIn("EN_ROUTE", history_statuses)
        self.assertIn("ASSIGNED", history_statuses)
        self.assertIn("REPORTED", history_statuses)
        print("  [PASS] test_06_incident_assignment_and_status_progression")

if __name__ == "__main__":
    print("\n=======================================================")
    print("RUNNING PHASE 2 BACKEND FOUNDATION TESTS")
    print("=======================================================\n")
    unittest.main()
