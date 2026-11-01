# WhatsApp ordering settings: admin save/validation + public catalog exposure
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}
RESTORE = {"india_per_kg": 250, "abroad_extra_per_kg": 450, "rounding": "round_up", "diwali_deadline": "2026-11-05",
           "whatsapp_enabled": False, "whatsapp_number": "",
           "whatsapp_message": "Namaskar AAICHELADOO! I would like to place an order."}


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    yield h
    requests.put(f"{API}/admin/settings", json=RESTORE, headers=h)


def test_settings_unauth_401():
    assert requests.put(f"{API}/admin/settings", json=RESTORE).status_code == 401


def test_get_settings_has_wa_fields(H):
    d = requests.get(f"{API}/admin/settings", headers=H).json()
    for k in ("whatsapp_enabled", "whatsapp_number", "whatsapp_message", "india_per_kg", "diwali_deadline"):
        assert k in d


def test_enable_without_number_400(H):
    r = requests.put(f"{API}/admin/settings", json={**RESTORE, "whatsapp_enabled": True, "whatsapp_number": ""}, headers=H)
    assert r.status_code == 400
    assert "WhatsApp number" in r.json()["detail"]


@pytest.mark.parametrize("num", ["98765abc10", "12345", "+919876543210", "1234567890123456"])
def test_invalid_number_422(H, num):
    r = requests.put(f"{API}/admin/settings", json={**RESTORE, "whatsapp_number": num}, headers=H)
    assert r.status_code == 422


def test_message_too_long_422(H):
    r = requests.put(f"{API}/admin/settings", json={**RESTORE, "whatsapp_message": "x" * 301}, headers=H)
    assert r.status_code == 422


def test_enable_save_and_public_catalog(H):
    payload = {**RESTORE, "india_per_kg": 260, "whatsapp_enabled": True, "whatsapp_number": "9876543210", "whatsapp_message": "TEST hi"}
    r = requests.put(f"{API}/admin/settings", json=payload, headers=H)
    assert r.status_code == 200
    d = r.json()
    assert d["whatsapp_enabled"] is True and d["whatsapp_number"] == "9876543210"
    assert d["india_per_kg"] == 260 and d["abroad_extra_per_kg"] == 450 and d["rounding"] == "round_up" and d["diwali_deadline"] == "2026-11-05"
    s = requests.get(f"{API}/catalog").json()["settings"]
    assert s["whatsapp_enabled"] is True and s["whatsapp_number"] == "9876543210" and s["whatsapp_message"] == "TEST hi"
    assert s["india_per_kg"] == 260


def test_country_code_number_ok(H):
    r = requests.put(f"{API}/admin/settings", json={**RESTORE, "whatsapp_enabled": True, "whatsapp_number": "447911123456"}, headers=H)
    assert r.status_code == 200 and r.json()["whatsapp_number"] == "447911123456"


def test_restore(H):
    r = requests.put(f"{API}/admin/settings", json=RESTORE, headers=H)
    assert r.status_code == 200
    s = requests.get(f"{API}/catalog").json()["settings"]
    for k, v in RESTORE.items():
        assert s[k] == v
