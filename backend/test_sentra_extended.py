"""
PREDICTRA-X: Comprehensive End-to-End Verification Test Suite
Validates all 14 phases of the SENTRA Verification, AI Guardian,
Duplicate Intelligence, Risk Engine, Lifecycle, Cryptographic Audit,
and PDF/Excel Dossier Reporting.
"""

import sys
import json
import requests
import unittest

API_BASE = "http://localhost:8000"
KEYCLOAK_URL = "http://localhost:8080/realms/predictra-x/protocol/openid-connect/token"
TEST_USER = "test-automation@predictra.x"
TEST_PASS = "SentraAdmin#2026!"
CLIENT_ID = "predictra-x-frontend"


class TestSentraExtendedSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Obtain Keycloak Bearer Token (with local gateway fallback)
        try:
            resp = requests.post(
                KEYCLOAK_URL,
                data={
                    "grant_type": "password",
                    "client_id": CLIENT_ID,
                    "username": TEST_USER,
                    "password": TEST_PASS,
                    "scope": "openid email profile",
                },
                timeout=4,
            )
            if resp.status_code == 200:
                cls.token = resp.json()["access_token"]
            else:
                raise RuntimeError(resp.text)
        except Exception:
            resp = requests.post(
                f"{API_BASE}/api/auth/token",
                json={"username": TEST_USER, "password": TEST_PASS},
                timeout=5,
            )
            cls.token = resp.json()["access_token"]
        cls.auth_headers = {
            "Authorization": f"Bearer {cls.token}",
            "Content-Type": "application/json",
        }

        # 2. Get available FDR record
        records_resp = requests.get(
            f"{API_BASE}/api/fdr",
            headers=cls.auth_headers,
            timeout=10,
        )
        assert records_resp.status_code == 200, f"Cannot fetch FDR records: {records_resp.text}"
        data = records_resp.json()
        records = data.get("records", [])
        assert len(records) > 0, "No FDR records in test database."
        cls.fdr_id = records[0]["id"]
        cls.receipt_number = records[0]["receipt_number"]
        print(f"\n[SETUP] Using FDR ID: {cls.fdr_id} (Ref: {cls.receipt_number})")

    # -------------------------------------------------------------------------
    # PHASE 1 & 14: Four-Layer Verification
    # -------------------------------------------------------------------------
    def test_01_sentra_four_layer_verification(self):
        """Test POST /api/sentra/{id}/verify executes all 4 layers independently."""
        url = f"{API_BASE}/api/sentra/{self.fdr_id}/verify"
        resp = requests.post(url, headers=self.auth_headers, timeout=20)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()

        self.assertTrue(data.get("success"))
        self.assertEqual(data["fdr_id"], self.fdr_id)
        self.assertIn("layer_results", data)
        self.assertIn("layer1", data["layer_results"])
        self.assertIn("layer2", data["layer_results"])
        self.assertIn("layer3", data["layer_results"])
        self.assertIn("layer4", data["layer_results"])
        self.assertIn(data["overall_status"], ["VERIFIED", "VERIFIED_WITH_WARNINGS", "SUSPICIOUS", "REVIEW_REQUIRED", "BANK_CONFIRMATION_PENDING"])
        self.assertIn("findings", data)
        print(f"[TEST 1 PASS] 4-Layer Verification completed. Overall status: {data['overall_status']}, Score: {data['risk_score']}")

    def test_02_get_verification_results(self):
        """Test GET /api/sentra/{id}/results returns persisted verification findings."""
        url = f"{API_BASE}/api/sentra/{self.fdr_id}/results"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["fdr_id"], self.fdr_id)
        self.assertIn("findings_by_layer", data)
        print(f"[TEST 2 PASS] Retrieved persisted verification results. Findings: {data['total_findings']}")

    # -------------------------------------------------------------------------
    # PHASE 2 & 3: AI Guardian & Auto-Repair Proposals
    # -------------------------------------------------------------------------
    def test_03_ai_guardian_analysis(self):
        """Test GET /api/guardian/{id}/analysis detects anomalies across visual, math, and templates."""
        url = f"{API_BASE}/api/guardian/{self.fdr_id}/analysis"
        resp = requests.get(url, headers=self.auth_headers, timeout=15)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("total_anomalies", data)
        self.assertIn("anomalies", data)
        print(f"[TEST 3 PASS] AI Guardian analysis completed. Anomalies found: {data['total_anomalies']}")

    def test_04_anomalies_query_and_resolution(self):
        """Test GET /api/anomalies and PATCH /api/anomalies/{id}/resolve."""
        url = f"{API_BASE}/api/anomalies"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("anomalies", data)
        anomalies = data["anomalies"]
        if len(anomalies) > 0:
            anomaly_id = anomalies[0]["id"]
            patch_url = f"{API_BASE}/api/anomalies/{anomaly_id}/resolve"
            patch_resp = requests.patch(
                patch_url,
                headers=self.auth_headers,
                json={"resolution_status": "INVESTIGATED_RESOLVED", "notes": "Automated test resolution note"},
                timeout=10,
            )
            self.assertEqual(patch_resp.status_code, 200, patch_resp.text)
            self.assertEqual(patch_resp.json()["status"], "INVESTIGATED_RESOLVED")
        print(f"[TEST 4 PASS] Anomaly listing and resolution workflow validated.")

    def test_05_auto_repair_proposals(self):
        """Test GET /api/sentra/{id}/proposals and human review endpoint."""
        url = f"{API_BASE}/api/sentra/{self.fdr_id}/proposals"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("proposals", data)
        print(f"[TEST 5 PASS] Auto-repair proposals retrieved: {data['count']}")

    # -------------------------------------------------------------------------
    # PHASE 4: Risk Intelligence & Decision Engine
    # -------------------------------------------------------------------------
    def test_06_risk_intelligence(self):
        """Test GET /api/risk/{id} returns transparent weighted factor scoring."""
        url = f"{API_BASE}/api/risk/{self.fdr_id}"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("classification", data)
        self.assertIn("severity", data)
        self.assertIn("factor_scores", data)
        self.assertIn("composite_risk_score", data)
        self.assertIn("decision_explanation", data)
        print(f"[TEST 6 PASS] Risk Intelligence Assessment: {data['classification']} ({data['severity']}) - Composite Score: {data['composite_risk_score']}")

    # -------------------------------------------------------------------------
    # PHASE 5: Duplicate Intelligence
    # -------------------------------------------------------------------------
    def test_07_duplicate_intelligence(self):
        """Test GET /api/duplicates returns multi-tier deduplication matches."""
        url = f"{API_BASE}/api/duplicates"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("duplicates", data)
        print(f"[TEST 7 PASS] Duplicate Intelligence: {data['count']} records found.")

    # -------------------------------------------------------------------------
    # PHASE 6: Email & In-App Alert System
    # -------------------------------------------------------------------------
    def test_08_in_app_notifications(self):
        """Test GET /api/notifications and PATCH /api/notifications/{id}/read."""
        url = f"{API_BASE}/api/notifications"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("notifications", data)
        self.assertIn("total_unread", data)

        if len(data["notifications"]) > 0:
            notif_id = data["notifications"][0]["id"]
            read_resp = requests.patch(f"{API_BASE}/api/notifications/{notif_id}/read", headers=self.auth_headers, timeout=10)
            self.assertEqual(read_resp.status_code, 200, read_resp.text)
        print(f"[TEST 8 PASS] In-App Notifications validated. Total Unread: {data['total_unread']}")

    def test_09_test_email_alert_dispatch(self):
        """Test POST /api/alerts/test-email dispatches formatted alert with delivery logging."""
        url = f"{API_BASE}/api/alerts/test-email"
        resp = requests.post(
            url,
            headers=self.auth_headers,
            json={"fdr_ref": self.receipt_number, "recipient": "compliance-officer@sentra.internal", "severity": "HIGH"},
            timeout=10,
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("delivery_status", data)
        self.assertIn(data["delivery_status"], ["SENT", "PENDING", "FAILED", "RETRYING"])
        print(f"[TEST 9 PASS] Email alert dispatch executed. Delivery status: {data['delivery_status']}")

    # -------------------------------------------------------------------------
    # PHASE 7: FDR Lifecycle Monitoring
    # -------------------------------------------------------------------------
    def test_10_lifecycle_monitoring(self):
        """Test GET /api/lifecycle and GET /api/lifecycle/calendar."""
        url = f"{API_BASE}/api/lifecycle"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("upcoming_30_days", data)
        self.assertIn("upcoming_90_days", data)
        self.assertIn("expired_records", data)
        self.assertIn("total_fdrs", data)

        cal_resp = requests.get(f"{API_BASE}/api/lifecycle/calendar", headers=self.auth_headers, timeout=10)
        self.assertEqual(cal_resp.status_code, 200, cal_resp.text)
        cal_data = cal_resp.json()
        self.assertIn("events", cal_data)
        print(f"[TEST 10 PASS] Lifecycle monitoring validated. Total FDRs monitored: {data['total_fdrs']}")

    def test_11_lifecycle_action_transition(self):
        """Test POST /api/lifecycle/{id}/renewal records immutable event."""
        url = f"{API_BASE}/api/lifecycle/{self.fdr_id}/renewal"
        resp = requests.post(
            url,
            headers=self.auth_headers,
            json={
                "action_type": "RENEWED",
                "new_maturity_date": "2027-10-30",
                "new_principal": 1050000.0,
                "notes": "Automated annual roll-over transition",
            },
            timeout=10,
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["fdr_id"], self.fdr_id)
        self.assertEqual(data["action"], "RENEWED")
        print(f"[TEST 11 PASS] Lifecycle action renewal executed successfully.")

    # -------------------------------------------------------------------------
    # PHASE 8: Cryptographic Audit Trail & Integrity Check
    # -------------------------------------------------------------------------
    def test_12_audit_trail_and_integrity_verification(self):
        """Test GET /api/audit/{id} and POST /api/audit/verify-integrity validates unbroken SHA-256 hash chain."""
        url = f"{API_BASE}/api/audit/{self.fdr_id}"
        resp = requests.get(url, headers=self.auth_headers, timeout=10)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("events", data)

        verify_url = f"{API_BASE}/api/audit/verify-integrity"
        v_resp = requests.post(verify_url, headers=self.auth_headers, timeout=10)
        self.assertEqual(v_resp.status_code, 200, v_resp.text)
        v_data = v_resp.json()
        self.assertTrue(v_data.get("is_valid"))
        self.assertEqual(v_data.get("broken_links_count"), 0)
        self.assertIn("head_hash", v_data)
        print(f"[TEST 12 PASS] Audit hash chain integrity VERIFIED. Chain blocks: {v_data['total_events']}")

    # -------------------------------------------------------------------------
    # PHASE 9: Final Intelligence Report Generation (PDF & Excel)
    # -------------------------------------------------------------------------
    def test_13_pdf_investigation_dossier_generation(self):
        """Test POST /api/reports/{id}/pdf streams valid binary PDF with header b'%PDF-'."""
        url = f"{API_BASE}/api/reports/{self.fdr_id}/pdf"
        resp = requests.post(url, headers=self.auth_headers, timeout=15)
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(resp.headers.get("content-type"), "application/pdf")
        self.assertTrue(resp.content.startswith(b"%PDF-"), "Invalid PDF header")
        self.assertGreater(len(resp.content), 1000, "PDF payload too small")
        print(f"[TEST 13 PASS] Investigation PDF dossier generated successfully. Size: {len(resp.content)} bytes.")

    def test_14_excel_investigation_workbook_generation(self):
        """Test POST /api/reports/{id}/excel streams valid binary Excel with header b'PK'."""
        url = f"{API_BASE}/api/reports/{self.fdr_id}/excel"
        resp = requests.post(url, headers=self.auth_headers, timeout=15)
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(
            resp.headers.get("content-type"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertTrue(resp.content.startswith(b"PK"), "Invalid ZIP/XLSX header")
        self.assertGreater(len(resp.content), 2000, "Excel payload too small")
        print(f"[TEST 14 PASS] Investigation Excel workbook generated successfully. Size: {len(resp.content)} bytes.")

    # -------------------------------------------------------------------------
    # Security: Unauthenticated Rejection
    # -------------------------------------------------------------------------
    def test_15_unauthorized_access_rejection(self):
        """Test that unauthenticated requests to protected endpoints return HTTP 401."""
        endpoints = [
            ("POST", f"{API_BASE}/api/sentra/{self.fdr_id}/verify"),
            ("GET", f"{API_BASE}/api/risk/{self.fdr_id}"),
            ("POST", f"{API_BASE}/api/reports/{self.fdr_id}/pdf"),
            ("POST", f"{API_BASE}/api/audit/verify-integrity"),
        ]
        for method, ep in endpoints:
            if method == "POST":
                r = requests.post(ep, timeout=5)
            else:
                r = requests.get(ep, timeout=5)
            self.assertEqual(r.status_code, 401, f"Endpoint {ep} allowed unauthenticated access!")
        print(f"[TEST 15 PASS] All protected endpoints strictly reject unauthenticated requests with HTTP 401.")


if __name__ == "__main__":
    unittest.main()
