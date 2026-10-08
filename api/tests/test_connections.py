from types import SimpleNamespace

from api import connections


def test_connections_add_links_to_discovered_systems(monkeypatch):
    class Actions:
        def get_authorization_link(self, connection_name, identifier):
            return SimpleNamespace(link=f"https://auth.example/{connection_name}")

    monkeypatch.setattr(connections, "_actions", lambda: Actions())
    monkeypatch.setattr(connections.config, "scalekit_configured", lambda: True)
    monkeypatch.setattr(connections.mnemosyne, "discover", lambda user_key: [
        {"connection": "slack", "provider": "slack", "status": "ACTIVE", "adapter": "known"},
        {"connection": "linear", "provider": "linear", "status": "PENDING", "adapter": "generic"},
    ])
    rows = connections.connections_for("alice")
    assert rows[0] == {"connection": "slack", "provider": "slack", "status": "ACTIVE", "adapter": "known", "link": None}
    assert rows[1]["link"] == "https://auth.example/linear"


def test_connections_empty_for_user_with_nothing(monkeypatch):
    monkeypatch.setattr(connections.config, "scalekit_configured", lambda: True)
    monkeypatch.setattr(connections, "_actions", lambda: None)
    monkeypatch.setattr(connections.mnemosyne, "discover", lambda user_key: [])
    assert connections.connections_for("bob") == []


def test_connections_without_scalekit_configured(monkeypatch):
    monkeypatch.setattr(connections.config, "scalekit_configured", lambda: False)
    assert connections.connections_for("alice") == []
