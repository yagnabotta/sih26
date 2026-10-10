"""
Regression Test Suite: Rejection of Software Source Code, Technical Documentation,
and Programming Syntax in Safety Observation Pipelines.
"""

import pytest
from backend.app.ai_services.safety_validity import (
    classify_safety_observation_validity,
    is_code_or_technical_documentation
)

class TestCodeAndTechnicalDocRejection:

    def test_user_preprocessing_module_docstring_rejected(self):
        """User test case: Python module docstring containing safety terms must be rejected as UNRELATED INPUT."""
        docstring_text = '''Safety NLP Preprocessing Module
-------------------------------
Provides robust, explainable, and safety-aware text preprocessing for industrial
incident reports, near-misses, and unsafe acts/conditions.

Key Features:
- Strict preservation of critical safety negations (e.g. 'not', 'no', 'without', 'missing', 'failed')
- Normalization of safety compound terms (e.g. 'without helmet' -> 'without_helmet')
- PII masking (names, emails, phone numbers, employee IDs)
- Custom safety-aware tokenizer
- Leakage-controlled preprocessing for reproducible model training
"""'''
        is_code, reason = is_code_or_technical_documentation(docstring_text)
        assert is_code is True, "Expected is_code_or_technical_documentation to be True"
        
        validity = classify_safety_observation_validity(docstring_text)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"
        assert validity["confidence_score"] == 0.0

    def test_python_code_snippet_rejected(self):
        """Source code function definitions must be rejected."""
        code = "def monitor_gas_flange():\n    if pressure > 100:\n        return 'High Risk'\n    return 'OK'"
        validity = classify_safety_observation_validity(code)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"

    def test_javascript_code_snippet_rejected(self):
        """JS/TS variable declarations and functions must be rejected."""
        js_code = "const helmetStatus = false;\nif (!helmetStatus) { console.log('PPE missing'); }"
        validity = classify_safety_observation_validity(js_code)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"

    def test_json_payload_rejected(self):
        """JSON structured objects must be rejected."""
        json_str = '{"incident": "gas leak", "severity": "high", "unit": "Unit 1"}'
        validity = classify_safety_observation_validity(json_str)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"

    def test_sql_query_rejected(self):
        """SQL queries must be rejected."""
        sql_query = "SELECT * FROM safety_incidents WHERE hazard_type = 'FIRE' AND unit = 1;"
        validity = classify_safety_observation_validity(sql_query)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"

    def test_html_script_tag_rejected(self):
        """HTML / script tags must be rejected."""
        html_code = "<script>alert('Hazardous explosion detected');</script>"
        validity = classify_safety_observation_validity(html_code)
        assert validity["is_valid_safety_observation"] is False
        assert validity["is_unrelated"] is True
        assert validity["validation_category"] == "UNRELATED INPUT"

    def test_legitimate_safety_observations_never_falsely_rejected(self):
        """Legitimate operational safety observations must remain VALID."""
        legitimate_observations = [
            "At front door it is very slippery",
            "Water is leaking near the electrical panel",
            "Worker was not wearing helmet on scaffold",
            "Tools were left on the floor near walkway",
            "Loose electrical cable near walkway causing trip hazard",
            "Emergency exit is blocked by wooden pallets",
            "Forklift almost hit a pedestrian in bay 2",
            "Gas is leaking near compressor discharge flange",
            "The machine guard is missing on rotating belt",
            "Major explosion occurred near the crude oil storage tanks, blast wave damaged piping and multiple valves.",
            "Hydrocarbon fire erupted at the crude distillation column bottom, rapidly spreading to adjacent pipe racks."
        ]
        for obs in legitimate_observations:
            is_code, _ = is_code_or_technical_documentation(obs)
            assert is_code is False, f"False positive on legitimate observation: {obs}"
            validity = classify_safety_observation_validity(obs)
            assert validity["is_valid_safety_observation"] is True, f"Failed on observation: {obs}"
            assert validity["is_unrelated"] is False, f"Marked as unrelated: {obs}"
