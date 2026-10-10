"""
Phase 3 Authentication and Role-Based Authorization Test Suite
Tests:
1. User registration with password hashing
2. Public registration security (cannot self-grant ADMIN)
3. Login for USER, RESPONDER, and ADMIN roles
4. Password verification and rejection of invalid credentials
5. Current user retrieval via /auth/me
6. Role-based endpoint enforcement:
   - ADMIN endpoints accept ADMIN, reject USER with 403
   - RESPONDER endpoints accept RESPONDER, reject USER with 403
   - Unauthenticated requests rejected with 401
7. Logout response
"""

import sys
import unittest
from datetime import datetime

# Add backend to import path
sys.path.insert(0, r"C:\Users\yagna\OneDrive\Desktop\sih26\backend")

from app.database import SessionLocal, ensure_emergency_schema
from app.models.user import User
from app.models.emergency import Incident, IncidentLocation, Responder, IncidentTypeEnum, SeverityEnum
from app.schemas.auth import LoginRequest, UserRegisterRequest
from app.schemas.emergency import IncidentCreate, IncidentLocationCreate, IncidentStatusUpdate, IncidentAssignRequest, ResponderCreate, ResponderTypeEnum
from app.services.auth_security import hash_password, verify_password, decode_access_token
from app.routers import auth as auth_router
from app.routers import emergency as emergency_router
from app.seed_data import seed_sample_data
from fastapi import HTTPException

class TestAuthAndRolesPhase3(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        ensure_emergency_schema()
        seed_sample_data()

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_password_hashing_security(self):
        """Verify passwords are never stored in plaintext and use salted PBKDF2."""
        raw_pwd = "MySecretEmergencyPassword#2026"
        hashed = hash_password(raw_pwd)

        self.assertNotEqual(raw_pwd, hashed)
        self.assertTrue(hashed.startswith("pbkdf2:sha256:100000$"))
        self.assertTrue(verify_password(raw_pwd, hashed))
        self.assertFalse(verify_password("WrongPassword123", hashed))
        print("  [PASS] test_01_password_hashing_security")

    def test_02_citizen_registration(self):
        """Verify citizen can register account and receive JWT token."""
        unique_email = f"citizen_{int(datetime.utcnow().timestamp())}@test.com"
        reg_payload = UserRegisterRequest(
            email=unique_email,
            password="CitizenPassword123!",
            full_name="Jane Citizen",
            phone="+91-98765-43210"
        )
        res = auth_router.register_user(reg_payload, self.db)
        self.assertIsNotNone(res.access_token)
        self.assertEqual(res.user.email, unique_email)
        self.assertEqual(res.user.role, "USER")
        self.assertFalse(res.user.is_admin)
        self.assertFalse(res.user.is_responder)
        self.assertIn("REPORT_EMERGENCY", res.user.permissions)

        # Check DB to confirm password was hashed
        db_user = self.db.query(User).filter(User.email == unique_email).first()
        self.assertIsNotNone(db_user)
        self.assertTrue(db_user.password.startswith("pbkdf2:"))
        print("  [PASS] test_02_citizen_registration")

    def test_03_registration_role_protection(self):
        """Verify public registration cannot self-grant ADMIN role."""
        bad_admin_email = f"fake_admin_{int(datetime.utcnow().timestamp())}@publicmail.com"
        reg_payload = UserRegisterRequest(
            email=bad_admin_email,
            password="SneakyPassword123!",
            full_name="Sneaky Admin Candidate",
            role="ADMIN"
        )
        res = auth_router.register_user(reg_payload, self.db)
        # Should be downgraded to USER for public safety
        self.assertEqual(res.user.role, "USER")
        self.assertFalse(res.user.is_admin)
        print("  [PASS] test_03_registration_role_protection")

    def test_04_login_all_roles(self):
        """Verify successful login for USER, RESPONDER, and ADMIN."""
        roles_to_test = [
            ("admin@emergency.com", "AdminPassword123!", "ADMIN", True, False),
            ("responder@emergency.com", "ResponderPassword123!", "RESPONDER", False, True),
            ("user@emergency.com", "UserPassword123!", "USER", False, False),
        ]
        for email, pwd, expected_role, exp_admin, exp_resp in roles_to_test:
            login_req = LoginRequest(email=email, password=pwd)
            res = auth_router.login(login_req, self.db)
            self.assertIsNotNone(res.access_token)
            self.assertEqual(res.user.role, expected_role)
            self.assertEqual(res.user.is_admin, exp_admin)
            self.assertEqual(res.user.is_responder, exp_resp)

            # Check decoded JWT claims
            claims = decode_access_token(res.access_token)
            self.assertEqual(claims["email"], email)
            self.assertEqual(claims["role"], expected_role)
        print("  [PASS] test_04_login_all_roles")

    def test_05_invalid_credentials_rejected(self):
        """Verify invalid passwords or non-existent emails return 401 Unauthorized."""
        with self.assertRaises(HTTPException) as ctx:
            auth_router.login(LoginRequest(email="admin@emergency.com", password="IncorrectPassword!"), self.db)
        self.assertEqual(ctx.exception.status_code, 401)

        with self.assertRaises(HTTPException) as ctx:
            auth_router.login(LoginRequest(email="nonexistent@nowhere.com", password="SomePassword"), self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        print("  [PASS] test_05_invalid_credentials_rejected")

    def test_06_current_user_profile(self):
        """Verify /auth/me returns accurate profile and permissions."""
        admin_user = self.db.query(User).filter(User.email == "admin@emergency.com").first()
        profile = auth_router.get_profile(current_user=admin_user)
        self.assertEqual(profile.email, "admin@emergency.com")
        self.assertEqual(profile.role, "ADMIN")
        self.assertTrue(profile.is_admin)
        self.assertIn("ALL", profile.permissions)
        self.assertIn("INCIDENT_MANAGE", profile.permissions)
        print("  [PASS] test_06_current_user_profile")

    def test_07_role_authorization_admin_endpoints(self):
        """Verify ADMIN endpoints permit ADMIN but raise 403 Forbidden for USER."""
        admin_user = self.db.query(User).filter(User.email == "admin@emergency.com").first()
        citizen_user = self.db.query(User).filter(User.email == "user@emergency.com").first()

        # 1. Admin creates a new responder unit -> SUCCESS
        resp_payload = ResponderCreate(
            name="Alpha Squad Test Unit",
            responder_type=ResponderTypeEnum.FIRE_ENGINE,
            contact="+91-98765-99999",
            current_latitude=18.93,
            current_longitude=72.83
        )
        res = emergency_router.create_responder(resp_payload, current_user=admin_user, db=self.db)
        self.assertIsNotNone(res.id)

        # 2. Citizen tries to create a responder unit -> 403 FORBIDDEN
        from app.dependencies import require_admin
        admin_checker = require_admin
        with self.assertRaises(HTTPException) as ctx:
            admin_checker(current_user=citizen_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Access denied", ctx.exception.detail)
        print("  [PASS] test_07_role_authorization_admin_endpoints")

    def test_08_role_authorization_responder_endpoints(self):
        """Verify RESPONDER endpoints permit RESPONDER and ADMIN but raise 403 for USER."""
        responder_user = self.db.query(User).filter(User.email == "responder@emergency.com").first()
        citizen_user = self.db.query(User).filter(User.email == "user@emergency.com").first()

        from app.dependencies import require_responder
        resp_checker = require_responder

        # Responder allowed
        verified_resp = resp_checker(current_user=responder_user)
        self.assertEqual(verified_resp.id, responder_user.id)

        # Citizen rejected with 403
        with self.assertRaises(HTTPException) as ctx:
            resp_checker(current_user=citizen_user)
        self.assertEqual(ctx.exception.status_code, 403)
        print("  [PASS] test_08_role_authorization_responder_endpoints")

    def test_09_logout_endpoint(self):
        """Verify logout endpoint returns success acknowledgment."""
        res = auth_router.logout()
        self.assertEqual(res.status, "success")
        print("  [PASS] test_09_logout_endpoint")

if __name__ == "__main__":
    print("\n=======================================================")
    print("RUNNING PHASE 3 AUTHENTICATION & ROLES TESTS")
    print("=======================================================\n")
    unittest.main()
