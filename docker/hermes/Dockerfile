# syntax=docker/dockerfile:1.4
# Slim Hermes gateway image for ShouldI compose.
# Build context: ./hermes-agent-private (see compose.yaml).
FROM python:3.12-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl tini git gosu \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -u 10000 -m -d /opt/data hermes

WORKDIR /opt/hermes

# Install metadata first so dependency layers cache when only app code changes.
COPY pyproject.toml README.md cli-config.yaml.example .env.example ./

COPY *.py ./
COPY agent agent/
COPY tools tools/
COPY hermes_cli hermes_cli/
COPY gateway gateway/
COPY cron cron/
COPY plugins plugins/
COPY providers providers/
COPY skills skills/
COPY tui_gateway tui_gateway/
COPY docker docker/

# Curated subset of skills/ that ShouldI's Expert Skills catalog maps to
# (apps/api/src/harmence-experts.ts `skillName` fields). Kept in a separate
# path so per-user HERMES_HOME instances can point `skills.external_dirs` at
# just this shared set, not the full skills/ tree (which also has unrelated
# general-purpose Hermes skills like apple/gaming/devops/mcp/github).
RUN mkdir -p /opt/hermes/shared-skills \
  && for s in smart_talk intl-job-search intl-student-advisor stay-or-return \
              pm-career-expert salary-negotiation grad-school-advisor; do \
       cp -r "/opt/hermes/skills/$s" /opt/hermes/shared-skills/; \
     done

RUN --mount=type=cache,target=/root/.cache/pip \
  pip install --upgrade pip \
  && pip install -e .

COPY --from=entrypoint entrypoint.sh /shouldi-entrypoint.sh
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
