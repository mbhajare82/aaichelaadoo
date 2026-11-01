# WhatsApp order tracking: public POST /api/whatsapp-orders + admin list/patch with stock adjustments
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}
RESTORE = {"india_per_kg": 250, "abroad_extra_per_kg": 450, "rounding": "round_up", "diwali_deadline": "2026-11-05",
           "whatsapp_enabled": False, "whatsapp_number": "",
           "whatsapp_message": "Namaskar AAICHELADOO! I would like to place an order."}
BESAN = "83a621b6-e02c-48d2-be56-4723bd580476"
POHA = "de86746c-d1a0-498b-93c0-2ff70df0fa5a"
MINI = "6ef47a37-54f0-4ee8-a223-168b7a312fa4"
CART = [{"kind": "product", "id": BESAN, "grams": 500, "qty": 1}, {"kind": "combo", "id": MINI, "qty": 1}]


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    yield h
    requests.put(f"{API}/admin/settings", json=RESTORE, headers=h)


def stock(H, pid):
    return next(p for p in requests.get(f"{API}/admin/products", headers=H).json() if p["id"] == pid)["stock_grams"]


def test_disabled_post_400(H):
    requests.put(f"{API}/admin/settings", json=RESTORE, headers=H)
    r = requests.post(f"{API}/whatsapp-orders", json={"items": CART, "destination": "india"})
    assert r.status_code == 400 and "WhatsApp" in r.json()["detail"]


def test_admin_unauth_401():
    assert requests.get(f"{API}/admin/whatsapp-orders").status_code == 401
    assert requests.patch(f"{API}/admin/whatsapp-orders/WAXXXXXX", json={"status": "confirmed"}).status_code == 401


class TestFlow:
    wid = None

    def test_enable(self, H):
        r = requests.put(f"{API}/admin/settings", json={**RESTORE, "whatsapp_enabled": True, "whatsapp_number": "9876543210"}, headers=H)
        assert r.status_code == 200

    def test_empty_items_422(self, H):
        assert requests.post(f"{API}/whatsapp-orders", json={"items": []}).status_code == 422

    def test_out_of_stock_400(self, H):
        r = requests.post(f"{API}/whatsapp-orders", json={"items": [{"kind": "product", "id": BESAN, "grams": 1000, "qty": 11}]})
        assert r.status_code == 400 and "out of stock" in r.json()["detail"]

    def test_bad_pack_400(self, H):
        r = requests.post(f"{API}/whatsapp-orders", json={"items": [{"kind": "product", "id": BESAN, "grams": 300, "qty": 1}]})
        assert r.status_code == 400

    def test_create_and_list(self, H):
        r = requests.post(f"{API}/whatsapp-orders", json={"items": CART, "destination": "india"})
        assert r.status_code == 200
        wid = r.json()["id"]
        assert wid.startswith("WA") and len(wid) == 8
        TestFlow.wid = wid
        o = next(x for x in requests.get(f"{API}/admin/whatsapp-orders", headers=H).json() if x["id"] == wid)
        assert o["status"] == "new" and o["subtotal"] == 949 and o["weight_g"] == 1000
        assert o["delivery_fee"] == 250 and o["total"] == 1199 and len(o["lines"]) == 2
        assert "stock_need" not in o and "_id" not in o

    def test_abroad_totals(self, H):
        r = requests.post(f"{API}/whatsapp-orders", json={"items": CART, "destination": "abroad"})
        wid = r.json()["id"]
        o = next(x for x in requests.get(f"{API}/admin/whatsapp-orders", headers=H).json() if x["id"] == wid)
        assert o["delivery_fee"] == 700 and o["total"] == 1649 and o["destination"] == "abroad"

    def test_edit_details(self, H):
        r = requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"customer_name": "TEST_Asha", "customer_phone": "9000000001", "note": "TEST note"}, headers=H)
        assert r.status_code == 200
        o = next(x for x in requests.get(f"{API}/admin/whatsapp-orders", headers=H).json() if x["id"] == self.wid)
        assert o["customer_name"] == "TEST_Asha" and o["customer_phone"] == "9000000001" and o["note"] == "TEST note" and o["status"] == "new"

    def test_confirm_deducts(self, H):
        b0, p0 = stock(H, BESAN), stock(H, POHA)
        assert requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "confirmed"}, headers=H).status_code == 200
        assert stock(H, BESAN) == b0 - 750 and stock(H, POHA) == p0 - 250
        # repeat confirm and delivered: no double deduction
        requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "confirmed"}, headers=H)
        requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "delivered"}, headers=H)
        assert stock(H, BESAN) == b0 - 750 and stock(H, POHA) == p0 - 250

    def test_cancel_restores(self, H):
        requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "cancelled"}, headers=H)
        assert stock(H, BESAN) == 10000 and stock(H, POHA) == 10000
        requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "cancelled"}, headers=H)
        assert stock(H, BESAN) == 10000
        o = next(x for x in requests.get(f"{API}/admin/whatsapp-orders", headers=H).json() if x["id"] == self.wid)
        assert o["status"] == "cancelled" and o["stock_deducted"] is False

    def test_invalid_status_422(self, H):
        assert requests.patch(f"{API}/admin/whatsapp-orders/{self.wid}", json={"status": "paid"}, headers=H).status_code == 422

    def test_unknown_404(self, H):
        assert requests.patch(f"{API}/admin/whatsapp-orders/WANOPE00", json={"status": "confirmed"}, headers=H).status_code == 404
