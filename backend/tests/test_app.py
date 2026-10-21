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


def test_assets_are_gzipped_and_cached_for_a_year(client, dist):
    (dist / "assets" / "big.js").write_text("console.log('hello');\n" * 200)
    r = client.get("/assets/big.js", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip"
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert "hello" in r.text


def test_index_is_revalidated(client):
    assert client.get("/").headers["cache-control"] == "no-cache"


def test_api_responses_are_not_compressed(client):
    r = client.get("/api/health", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in r.headers
