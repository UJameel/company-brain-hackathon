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
from cognee.modules.users.permissions.methods import (
    authorized_give_permission_on_datasets,
    authorized_revoke_permission_on_datasets,
)


_db_ready = False


async def _ensure_db() -> None:
    # Cognee's user/permission tables are created lazily by the high-level API. Calling the
    # user methods directly first (as the hackathon README does) hits "no such table: principals".
    global _db_ready
    if not _db_ready:
        from cognee.infrastructure.databases.relational import create_db_and_tables

        await create_db_and_tables()
        _db_ready = True


async def get_or_create_user(user_key: str):
    await _ensure_db()
    email = config.USERS[user_key]
    return await get_user_by_email(email) or await create_user(email, config.COGNEE_PASSWORD)


async def readable_datasets(user_key: str) -> list[str]:
    return [name for name, _ in await readable_dataset_ids(user_key)]


async def readable_dataset_ids(user_key: str) -> list[tuple[str, str]]:
    """(name, id) for every dataset this user may read, owned or shared. Cognee resolves
    dataset *names* only among datasets the caller owns, so shared datasets must be
    addressed by id at recall time."""
    user = await get_or_create_user(user_key)
    datasets = await get_authorized_existing_datasets(None, "read", user)
    return sorted((d.name, str(d.id)) for d in datasets)


async def scope(user_key: str) -> dict:
    """Everything Athena needs to know before recalling: what this user may read,
    and what exists that they may not."""
    state = config.load_state()
    known = state.get("datasets", {})  # dataset name -> {"owner": user_key, "sources": [...]}
    pairs = await readable_dataset_ids(user_key)
    readable = [n for n, _ in pairs]
    # A dataset is worth flagging as hidden only if it holds something (a channel, a repo,
    # a source) that none of the user's readable datasets hold. Alice is not told that
    # Bob's subset of her own knowledge is "hidden" from her.
    have: set[str] = set()
    for name in readable:
        have.update(known.get(name, {}).get("tags", []))
    hidden = {}
    for name, meta in known.items():
        if name in readable:
            continue
        extra = sorted(set(meta.get("tags", [])) - have)
        if extra:
            hidden[name] = {**meta, "extra": extra}
    shared_in = [n for n in readable if known.get(n, {}).get("owner") not in (None, user_key)]
    return {"user": user_key, "identifier": config.USERS[user_key], "readable": readable,
            "readable_ids": [i for _, i in pairs], "hidden": hidden, "shared_in": shared_in}


async def grants() -> list[dict]:
    """Live shares, derived from Cognee (the source of truth), not from the state file."""
    known = config.load_state().get("datasets", {})
    out = []
    for user_key in config.USERS:
        for name in await readable_datasets(user_key):
            owner = known.get(name, {}).get("owner")
            if owner and owner != user_key:
                out.append({"owner": owner, "grantee": user_key, "dataset": name, "permission": "read"})
    return out


async def grant(owner_key: str, grantee_key: str, dataset_name: str | None = None, permission: str = "read") -> str:
    """The owner shares a dataset with another user. This is the live 'grant' beat
    in the demo: isolation -> grant -> the answer changes."""
    owner = await get_or_create_user(owner_key)
    grantee = await get_or_create_user(grantee_key)
    dataset_name = dataset_name or config.dataset_for(owner_key)
    (ds,) = await get_authorized_existing_datasets([dataset_name], "share", owner)
    await authorized_give_permission_on_datasets(grantee.id, [ds.id], permission, owner.id)
    return f"{owner_key} granted {permission} on {dataset_name} to {grantee_key}"


async def revoke(owner_key: str, grantee_key: str, dataset_name: str | None = None, permission: str = "read") -> str:
    owner = await get_or_create_user(owner_key)
    grantee = await get_or_create_user(grantee_key)
    dataset_name = dataset_name or config.dataset_for(owner_key)
    (ds,) = await get_authorized_existing_datasets([dataset_name], "share", owner)
    await authorized_revoke_permission_on_datasets(grantee.id, [ds.id], permission, owner.id)
    return f"{owner_key} revoked {permission} on {dataset_name} from {grantee_key}"
