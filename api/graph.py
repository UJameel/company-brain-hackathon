"""The user's real Cognee graph, shaped for the web app's brain."""
from __future__ import annotations

from pantheon import cerberus


def _node_dict(n) -> dict:
    """Cognee's get_graph_data shape is (node_id, props); accept dicts too."""
    if isinstance(n, dict):
        return n
    node_id, props = n[0], (n[1] if len(n) > 1 and isinstance(n[1], dict) else {})
    label = props.get("name") or props.get("label") or (props.get("text") or "")[:40] or str(node_id)[:8]
    return {"id": node_id, "label": label, "type": props.get("type") or props.get("category") or "Node", "properties": props}


def _edge_dict(e) -> dict:
    if isinstance(e, dict):
        return e
    return {"source_node_id": e[0], "target_node_id": e[1], "relationship_name": e[2] if len(e) > 2 else ""}


async def fetch_raw(user_key: str, max_nodes: int) -> dict:
    """Cognee 1.6 internal visualize API. Isolated here so the shape can be stubbed."""
    import uuid

    from cognee.api.v1.visualize.visualize import fetch_visualization_data

    user = await cerberus.get_or_create_user(user_key)
    pairs = await cerberus.readable_dataset_ids(user_key)
    nodes: list[dict] = []
    edges: list[dict] = []
    for name, ds_id in pairs:
        graph_data, _events = await fetch_visualization_data(user=user, dataset=uuid.UUID(ds_id), full=True,
                                                             max_nodes=max_nodes, include_session_events=False)
        raw_nodes, raw_edges = graph_data if isinstance(graph_data, tuple) else (graph_data.get("nodes", []), graph_data.get("edges", []))
        for n in raw_nodes:
            d = _node_dict(n)
            d.setdefault("properties", {})["dataset"] = name
            nodes.append(d)
        edges.extend(_edge_dict(e) for e in raw_edges)
    return {"nodes": nodes[:max_nodes], "edges": edges}


async def graph_for(user_key: str, max_nodes: int = 600) -> dict:
    raw = await fetch_raw(user_key, max_nodes)
    nodes = [{
        "id": str(n.get("id")),
        "label": n.get("label") or n.get("name") or str(n.get("id"))[:8],
        "type": n.get("type") or "Node",
        "node_set": list((n.get("properties") or {}).get("node_set") or []),
        "dataset": (n.get("properties") or {}).get("dataset"),
    } for n in raw.get("nodes", [])]
    ids = {n["id"] for n in nodes}
    edges = [{"source": str(e.get("source_node_id") or e.get("source")), "target": str(e.get("target_node_id") or e.get("target")),
              "label": e.get("relationship_name") or e.get("label") or ""} for e in raw.get("edges", [])]
    edges = [e for e in edges if e["source"] in ids and e["target"] in ids]
    return {"nodes": nodes, "edges": edges}
