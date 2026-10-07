# Pantheon API image. Adapted from cognee's official image: uv on Python 3.12, the Ladybug
# JSON extension baked in (its runtime install fails for a non-root user), non-root uid 1000.
# The ingested Cognee state is copied in as a pristine snapshot; the server restores it into
# /app/state on first boot and on /reset.
FROM ghcr.io/ladybugdb/extension-repo@sha256:180c83fb190e9d6ef8d324850b192db26794ab7cb866a38813a45365f14bd46d AS ladybug-extensions
# Same reshuffle cognee's Dockerfile does: v*/linux_*/json/libjson.lbug_extension -> /bundle/v*/linux_*/libjson.lbug_extension
RUN set -e; for f in v*/linux_*/json/libjson.lbug_extension; do \
      d="/bundle/${f%/json/libjson.lbug_extension}"; mkdir -p "$d" && cp "$f" "$d/libjson.lbug_extension"; \
    done

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
ENV PYTHONUNBUFFERED=1 UV_SYSTEM_PYTHON=1 HOME=/app \
    HF_HUB_OFFLINE=1 TOKENIZERS_PARALLELISM=false ENABLE_BACKEND_ACCESS_CONTROL=true \
    SYSTEM_ROOT_DIRECTORY=/app/state/system DATA_ROOT_DIRECTORY=/app/state/data \
    PRISTINE_STATE_DIR=/app/state-pristine LIVE_STATE_DIR=/app/state PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends curl libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/requirements.txt api/requirements.txt
RUN uv pip install -r api/requirements.txt
COPY --from=ladybug-extensions /bundle/ /app/cognee_db_workers/ladybug_extensions/
COPY pantheon pantheon
COPY api api
COPY evals evals
COPY sample_data sample_data
COPY build-state /app/state-pristine
RUN cp /app/state-pristine/pantheon_state.json /app/.pantheon_state.json \
 && useradd -u 1000 -m -d /app -s /bin/bash cognee 2>/dev/null || true \
 && mkdir -p /app/state && chown -R 1000:1000 /app
USER 1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8080/health || exit 1
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]
