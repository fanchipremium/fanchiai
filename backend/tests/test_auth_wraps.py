"""FANCHI - auth (/api/auth/me, /api/auth/logout) + My Wraps (/api/wraps) + auto-save tests."""
import base64
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

SESSION_TOKEN = "test_session_fanchi"
USER_ID = "test-user-fanchi"
CAR_IMAGE_PATH = "/tmp/car.jpg"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_headers():
    return {"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def car_b64():
    with open(CAR_IMAGE_PATH, "rb") as f:
        return base64.b64encode(f.read()).decode()


@pytest.fixture(scope="session")
def first_product(api):
    r = api.get(f"{BASE_URL}/api/catalog", timeout=30)
    return r.json()["products"][0]


# --- /api/auth/me ---
class TestAuthMe:
    def test_me_unauthenticated_401(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401, r.text[:300]

    def test_me_invalid_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer totally-bogus-token"}, timeout=30)
        assert r.status_code == 401, r.text[:300]

    def test_me_with_bearer_token(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["user_id"] == USER_ID
        assert data["email"] == "fanchi.test@example.com"
        assert data["name"] == "FANCHI Tester"
        assert "_id" not in data

    def test_me_with_cookie(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         cookies={"session_token": SESSION_TOKEN}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["user_id"] == USER_ID


# --- /api/auth/session validation ---
class TestAuthSession:
    def test_session_missing_id_400(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={}, timeout=30)
        assert r.status_code == 400, r.text[:300]

    def test_session_invalid_id_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          headers={"X-Session-ID": "invalid-session-id-xyz"}, timeout=40)
        assert r.status_code in (401, 502), r.text[:300]


# --- /api/wraps auth gating ---
class TestWraps:
    def test_wraps_unauthenticated_401(self):
        r = requests.get(f"{BASE_URL}/api/wraps", timeout=30)
        assert r.status_code == 401, r.text[:300]

    def test_wraps_with_token_returns_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/wraps", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data.get("wraps"), list)


# --- Auto-save on authenticated generation (real Gemini call, slow) ---
class TestAutoSave:
    def test_generate_authenticated_autosaves_wrap(self, auth_headers, car_b64, first_product):
        before = requests.get(f"{BASE_URL}/api/wraps", headers=auth_headers, timeout=30).json()["wraps"]
        r = requests.post(f"{BASE_URL}/api/generate-wrap", headers=auth_headers,
                          json={"image_base64": car_b64, "product": first_product}, timeout=240)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        assert r.json()["image"].startswith("data:image")

        after = requests.get(f"{BASE_URL}/api/wraps", headers=auth_headers, timeout=60).json()["wraps"]
        assert len(after) == len(before) + 1, f"before={len(before)} after={len(after)}"
        w = after[0]
        assert w["product"]["id"] == first_product["id"]
        assert w["wrapped_image"].startswith("data:image")
        assert w["original_image"].startswith("data:image")
        assert "wrap_id" in w and "created_at" in w
        assert "_id" not in w

    def test_generate_anonymous_does_not_save(self, api, auth_headers, car_b64, first_product):
        before = requests.get(f"{BASE_URL}/api/wraps", headers=auth_headers, timeout=30).json()["wraps"]
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": car_b64, "product": first_product}, timeout=240)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        after = requests.get(f"{BASE_URL}/api/wraps", headers=auth_headers, timeout=60).json()["wraps"]
        assert len(after) == len(before), "anonymous generation must not be saved to a user gallery"
