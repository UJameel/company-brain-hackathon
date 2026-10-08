import asyncio

from api import graph


def test_graph_shapes_cognee_payload(monkeypatch):
    async def fake_fetch(user_key, max_nodes):
        return {"nodes": [{"id": "n1", "label": "Atlas", "type": "Entity", "properties": {"node_set": ["source:slack"], "dataset": "alice-brain"}},
                          {"id": "n2", "label": "Priya", "type": "Entity", "properties": {}}],
                "edges": [{"source_node_id": "n1", "target_node_id": "n2", "relationship_name": "owned_by"}]}

    monkeypatch.setattr(graph, "fetch_raw", fake_fetch)
    g = asyncio.run(graph.graph_for("alice", 10))
    assert g["nodes"][0] == {"id": "n1", "label": "Atlas", "type": "Entity", "node_set": ["source:slack"], "dataset": "alice-brain"}
    assert g["nodes"][1]["node_set"] == [] and g["edges"][0] == {"source": "n1", "target": "n2", "label": "owned_by"}
