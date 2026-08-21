"""Tests for the moderation service shared-secret auth and input caps."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from moderation_service.config import Settings, get_settings
from moderation_service.main import app

VALID_PAYLOAD = {
    "listingId": "lst_abc123",
    "sellerId": "usr_xyz789",
    "reason": "new_listing",
    "title": "Vintage leather jacket",
    "description": "Genuine leather, great condition",
}


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def set_internal_token(monkeypatch):
    monkeypatch.setenv("MODERATION_INTERNAL_TOKEN", "test-secret-token")


def test_healthz_is_open_without_token():
    client = TestClient(app)
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_listing_moderation_rejects_missing_token():
    client = TestClient(app)
    res = client.post("/moderations/listings", json=VALID_PAYLOAD)
    assert res.status_code == 401


def test_listing_moderation_rejects_wrong_token():
    client = TestClient(app)
    res = client.post(
        "/moderations/listings",
        json=VALID_PAYLOAD,
        headers={"X-Internal-Token": "wrong-secret"},
    )
    assert res.status_code == 401


def test_listing_moderation_allows_correct_token():
    client = TestClient(app)
    res = client.post(
        "/moderations/listings",
        json=VALID_PAYLOAD,
        headers={"X-Internal-Token": "test-secret-token"},
    )
    assert res.status_code == 200
    assert res.json()["listing_id"] == "lst_abc123"


def test_metrics_requires_token():
    client = TestClient(app)
    assert client.get("/metrics").status_code == 401
    res = client.get("/metrics", headers={"X-Internal-Token": "test-secret-token"})
    assert res.status_code == 200
    assert "processed_total" in res.json()


def test_endpoints_fail_closed_when_token_unconfigured(monkeypatch):
    monkeypatch.setattr(get_settings, "cache_clear", lambda: None)

    def _empty_settings():
        return Settings()

    monkeypatch.setattr("moderation_service.main.get_settings", _empty_settings)
    client = TestClient(app)
    assert (
        client.post(
            "/moderations/listings",
            json=VALID_PAYLOAD,
            headers={"X-Internal-Token": "test-secret-token"},
        ).status_code
        == 503
    )
    assert (
        client.get("/metrics", headers={"X-Internal-Token": "test-secret-token"}).status_code
        == 503
    )


def test_title_over_max_length_is_rejected():
    client = TestClient(app)
    payload = dict(VALID_PAYLOAD)
    payload["title"] = "x" * 201
    res = client.post(
        "/moderations/listings",
        json=payload,
        headers={"X-Internal-Token": "test-secret-token"},
    )
    assert res.status_code == 422


def test_description_over_max_length_is_rejected():
    client = TestClient(app)
    payload = dict(VALID_PAYLOAD)
    payload["description"] = "y" * 5001
    res = client.post(
        "/moderations/listings",
        json=payload,
        headers={"X-Internal-Token": "test-secret-token"},
    )
    assert res.status_code == 422