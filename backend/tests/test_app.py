"""App wiring: health check and static frontend serving."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_unknown_api_path_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not found"}


def test_spa_fallback_serves_index(client):
    r = client.get("/boards/123")
    assert r.status_code == 200
    assert "spa" in r.text


def test_static_asset_served(client):
    r = client.get("/assets/app.js")
    assert r.status_code == 200
    assert "console.log" in r.text


def test_path_traversal_returns_index(client):
    r = client.get("/..%2F..%2Fpyproject.toml")
    assert "spa" in r.text
