# Product photo upload / serve tests (iteration 2)
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}


def _png_bytes(color=(200, 120, 30)):
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), color).save(buf, "PNG")
    return buf.getvalue()


def _jpg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (10, 200, 30)).save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created():
    ids = []
    yield ids
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    for pid in ids:
        requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=h)


# Upload auth guard
def test_upload_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/upload", files={"file": ("a.png", _png_bytes(), "image/png")})
    assert r.status_code == 401


# Non-image rejected
def test_upload_rejects_txt(auth):
    r = requests.post(f"{BASE_URL}/api/admin/upload", headers=auth,
                      files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400
    assert "JPG" in r.json()["detail"]


# Too-large rejected
def test_upload_rejects_large(auth):
    r = requests.post(f"{BASE_URL}/api/admin/upload", headers=auth,
                      files={"file": ("big.jpg", b"\xff" * (5 * 1024 * 1024 + 10), "image/jpeg")})
    assert r.status_code == 400


# Upload PNG + serve
def test_upload_png_and_serve(auth):
    data = _png_bytes()
    r = requests.post(f"{BASE_URL}/api/admin/upload", headers=auth, files={"file": ("p.png", data, "image/png")})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/files/") and url.endswith(".png")
    g = requests.get(f"{BASE_URL}{url}")
    assert g.status_code == 200
    assert g.headers["content-type"].startswith("image/png")
    assert g.content == data


# Missing file 404
def test_serve_missing_404():
    r = requests.get(f"{BASE_URL}/api/files/aaicheladau/products/does-not-exist.jpg")
    assert r.status_code == 404


# Create product with uploaded photo -> public catalog; edit photo
def test_product_with_photo_flow(auth, created):
    r = requests.post(f"{BASE_URL}/api/admin/upload", headers=auth, files={"file": ("p.jpg", _jpg_bytes(), "image/jpeg")})
    assert r.status_code == 200
    url1 = r.json()["url"]
    body = {"name": "TEST_API Photo Laddu", "category": "sweets", "description": "t", "image": url1,
            "price_per_kg": 500, "stock_grams": 3000, "active": True}
    c = requests.post(f"{BASE_URL}/api/admin/products", headers=auth, json=body)
    assert c.status_code == 200
    pid = c.json()["id"]
    created.append(pid)
    cat = requests.get(f"{BASE_URL}/api/catalog").json()
    p = next(x for x in cat["products"] if x["id"] == pid)
    assert p["image"] == url1
    r2 = requests.post(f"{BASE_URL}/api/admin/upload", headers=auth, files={"file": ("p2.png", _png_bytes((1, 2, 3)), "image/png")})
    url2 = r2.json()["url"]
    e = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=auth, json={**body, "image": url2})
    assert e.status_code == 200 and e.json()["image"] == url2
    cat = requests.get(f"{BASE_URL}/api/catalog").json()
    assert next(x for x in cat["products"] if x["id"] == pid)["image"] == url2
    assert requests.get(f"{BASE_URL}{url2}").status_code == 200


# Seeded images are static and reachable
def test_seeded_images_reachable():
    cat = requests.get(f"{BASE_URL}/api/catalog").json()
    seeded = [p for p in cat["products"] if not p["name"].startswith("TEST_")]
    assert len(seeded) == 11
    imgs = {p["image"] for p in seeded}
    assert len(imgs) == 11
    for img in imgs:
        g = requests.get(f"{BASE_URL}{img}")
        assert g.status_code == 200 and g.headers["content-type"].startswith("image/"), img
