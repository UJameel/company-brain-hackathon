"""Cerberus (amygdala): the authorization gate.

Scalekit decides what a user may PULL (per-user connected accounts).
Cognee decides what a user may RECALL (per-user datasets, ENABLE_BACKEND_ACCESS_CONTROL).
Cerberus lines the two up: the Scalekit identifier is the Cognee user email, and
every recall is scoped to the datasets that user is authorized to read. It also
reports what the user can NOT see, so Athena can say so instead of guessing."""
from __future__ import annotations

from . import config  # noqa: F401  (sets ENABLE_BACKEND_ACCESS_CONTROL before cognee import)

from cognee.modules.data.methods import get_authorized_existing_datasets
from cognee.modules.users.methods import create_user, get_user_by_email
from cognee.modules.users.permissions.methods import authorized_give_permission_on_datasets


async def get_or_create_user(user_key: str):
    email = config.USERS[user_key]
    return await get_user_by_email(email) or await create_user(email, config.COGNEE_PASSWORD)


async def readable_datasets(user_key: str) -> list[str]:
    user = await get_or_create_user(user_key)
    datasets = await get_authorized_existing_datasets(None, "read", user)
    return sorted(d.name for d in datasets)


async def scope(user_key: str) -> dict:
    """Everything Athena needs to know before recalling: what this user may read,
    and what exists that they may not."""
    state = config.load_state()
    known = state.get("datasets", {})  # dataset name -> {"owner": user_key, "sources": [...]}
    readable = await readable_datasets(user_key)
    hidden = {name: meta for name, meta in known.items() if name not in readable}
    return {"user": user_key, "identifier": config.USERS[user_key], "readable": readable, "hidden": hidden}


async def grant(owner_key: str, grantee_key: str, dataset_name: str | None = None, permission: str = "read") -> str:
    """The owner shares a dataset with another user. This is the live 'grant' beat
    in the demo: isolation -> grant -> the answer changes."""
    owner = await get_or_create_user(owner_key)
    grantee = await get_or_create_user(grantee_key)
    dataset_name = dataset_name or config.dataset_for(owner_key)
    (ds,) = await get_authorized_existing_datasets([dataset_name], "share", owner)
    await authorized_give_permission_on_datasets(grantee.id, [ds.id], permission, owner.id)
    state = config.load_state()
    state.setdefault("grants", []).append({"owner": owner_key, "grantee": grantee_key, "dataset": dataset_name, "permission": permission})
    config.save_state(state)
    return f"{owner_key} granted {permission} on {dataset_name} to {grantee_key}"
