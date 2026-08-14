#!/usr/bin/env python3
"""
db_seed.py (Self-healing & Idempotent)
"""

import os
import sys
import requests

API_BASE = os.getenv("API_BASE_URL", "http://localhost:5138").rstrip("/")

ANNOTATORS_URL = f"{API_BASE}/api/annotators"
SURVEY_SUBMIT_URL = f"{API_BASE}/api/survey/submit"
SURVEY_STATUS_URL = f"{API_BASE}/api/survey/status"

SAMPLE_ANNOTATORS = [
    {
        "Name": "Alice Tester",
        "Email": "alice@example.com",
        "PasswordHash": "Password123!",
        "DateOfBirth": "1995-04-12",
        "Gender": "Female",
        "Nationality": "Egypt",
    },
    {
        "Name": "Bob Example",
        "Email": "bob@example.com",
        "PasswordHash": "Password123!",
        "DateOfBirth": "1988-10-25",
        "Gender": "Male",
        "Nationality": "Germany",
    },
    {
        "Name": "Charlie Demo",
        "Email": "charlie@example.com",
        "PasswordHash": "Password123!",
        "DateOfBirth": "2001-07-19",
        "Gender": "Non-binary",
        "Nationality": "United States",
    },
]

SAMPLE_SURVEYS = [
    {
        "HasDriverLicense": True,
        "PrimaryDrivingCountry": "Egypt",
        "DrivingFrequency": "Daily / Near Daily (5–7 days per week)",
        "DrivingScenarioNighttime": True,
        "DrivingScenarioSnowyWeather": False,
        "DrivingScenarioHeavyRain": True,
        "DrivingScenarioConstructionZone": True,
        "DrivingScenarioNone": False,
        "HasPriorDatasetAnnotationExperience": True,
        "HasAccidentsInLastFiveYears": False,
    },
    {
        "HasDriverLicense": True,
        "PrimaryDrivingCountry": "Germany",
        "DrivingFrequency": "Regular (2–4 days per week)",
        "DrivingScenarioNighttime": True,
        "DrivingScenarioSnowyWeather": True,
        "DrivingScenarioHeavyRain": False,
        "DrivingScenarioConstructionZone": False,
        "DrivingScenarioNone": False,
        "HasPriorDatasetAnnotationExperience": False,
        "HasAccidentsInLastFiveYears": True,
    },
]


def get_all_annotators():
    """Fetches all existing annotators from backend."""
    try:
        resp = requests.get(ANNOTATORS_URL, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return []


def create_or_find_annotator(annotator_data, existing_annotators):
    email = annotator_data["Email"].lower()
    
    # 1. Check if user already exists
    for existing in existing_annotators:
        existing_email = str(existing.get("email") or existing.get("Email") or "").lower()
        if existing_email == email:
            aid = existing.get("id") or existing.get("Id")
            return aid, "found_existing"

    # 2. Otherwise create user
    try:
        resp = requests.post(ANNOTATORS_URL, json=annotator_data, timeout=5)
        if resp.status_code in (200, 201):
            data = resp.json()
            aid = data.get("id") or data.get("Id")
            return aid, "created"
    except Exception as e:
        print(f"Error: {e}")

    return None, "failed"


def submit_survey(annotator_id, survey_payload):
    params = {"annotatorId": annotator_id}
    try:
        resp = requests.post(SURVEY_SUBMIT_URL, params=params, json=survey_payload, timeout=5)
        return resp
    except Exception:
        return None


def check_survey_status(annotator_id):
    params = {"annotatorId": annotator_id}
    try:
        resp = requests.get(SURVEY_STATUS_URL, params=params, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def main():
    print("=" * 60)
    print("🚀 Annotate Pro - Database Seeder & Sync")
    print(f"🌐 Target Backend: {API_BASE}")
    print("=" * 60)

    existing_annotators = get_all_annotators()

    # 1. Register or Find Annotators
    annotator_records = []
    print("\n[1/3] Syncing Annotators...")
    for annotator in SAMPLE_ANNOTATORS:
        aid, status = create_or_find_annotator(annotator, existing_annotators)
        if aid is not None:
            status_text = "Existing user found" if status == "found_existing" else "Newly created"
            print(f"  • {annotator['Name']} ({annotator['Email']}) -> ✅ ID: {aid} ({status_text})")
            annotator_records.append((aid, annotator))
        else:
            print(f"  • {annotator['Name']} ({annotator['Email']}) -> ❌ Could not find or create ID")

    # 2. Submit Surveys for Alice and Bob
    print("\n[2/3] Submitting Surveys for Alice & Bob...")
    for idx, (aid, annotator) in enumerate(annotator_records[:2]):
        survey = SAMPLE_SURVEYS[idx]
        print(f"  • Submitting survey for {annotator['Name']} (ID: {aid})...", end=" ")
        resp = submit_survey(aid, survey)
        if resp and resp.status_code == 200:
            print("✅ Success")
        elif resp and resp.status_code == 400:
            print("ℹ️ Already submitted earlier")
        else:
            print(f"⚠️ Status code: {resp.status_code if resp else 'No response'}")

    # 3. Print Final Status Summary
    print("\n[3/3] Final Status Summary:")
    print("-" * 60)
    print(f"{'ID':<6} | {'Name':<18} | {'Survey Completed':<18} | {'Workspace Status'}")
    print("-" * 60)

    for aid, annotator in annotator_records:
        status_data = check_survey_status(aid)
        has_completed = status_data.get("hasCompletedSurvey", False) if status_data else False
        workspace = "🟢 Unlocked" if has_completed else "🔒 Locked (Needs Survey)"
        print(f"{aid:<6} | {annotator['Name']:<18} | {str(has_completed):<18} | {workspace}")

    print("-" * 60)


if __name__ == "__main__":
    main()