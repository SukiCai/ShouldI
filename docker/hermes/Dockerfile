# Slim Hermes gateway image for ShouldI compose (build from repo root).
# Full upstream image: hermes-agent-private/Dockerfile (nousresearch/hermes-agent).
FROM python:3.12-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl tini git gosu \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -u 10000 -m -d /opt/data hermes

WORKDIR /opt/hermes

COPY hermes-agent-private/ .

RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -e .

COPY docker/hermes/entrypoint.sh /shouldi-entrypoint.sh
RUN chmod +x /shouldi-entrypoint.sh \
  && mkdir -p /opt/data \
  && chown -R hermes:hermes /opt/data

ENV HERMES_HOME=/opt/data \
  PYTHONUNBUFFERED=1 \
  API_SERVER_ENABLED=true \
  API_SERVER_HOST=0.0.0.0 \
  API_SERVER_PORT=8642

EXPOSE 8642

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${API_SERVER_PORT:-8642}/health" >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/shouldi-entrypoint.sh"]
CMD ["gateway", "run"]
