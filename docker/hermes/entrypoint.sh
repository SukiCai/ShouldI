#!/bin/sh
set -e

HERMES_HOME="${HERMES_HOME:-/opt/data}"
INSTALL_DIR="/opt/hermes"

bootstrap_data_dir() {
  mkdir -p "${HERMES_HOME}/cron" \
    "${HERMES_HOME}/sessions" \
    "${HERMES_HOME}/logs" \
    "${HERMES_HOME}/memories" \
    "${HERMES_HOME}/skills" \
    "${HERMES_HOME}/workspace" \
    "${HERMES_HOME}/home"

  if [ ! -f "${HERMES_HOME}/.env" ] && [ -f "${INSTALL_DIR}/.env.example" ]; then
    cp "${INSTALL_DIR}/.env.example" "${HERMES_HOME}/.env"
  fi

  if [ ! -f "${HERMES_HOME}/config.yaml" ] && [ -f "${INSTALL_DIR}/cli-config.yaml.example" ]; then
    cp "${INSTALL_DIR}/cli-config.yaml.example" "${HERMES_HOME}/config.yaml"
    # Point this fresh home at ShouldI's shared Expert Skills (read-only;
    # skill creation always writes to HERMES_HOME/skills, never here) so a
    # brand-new HERMES_HOME isn't missing salary-negotiation/smart_talk/etc.
    # Uses ruamel.yaml (round-trip) so the example's comments survive.
    if [ -d "${INSTALL_DIR}/shared-skills" ]; then
      python3 - "${HERMES_HOME}/config.yaml" "${INSTALL_DIR}/shared-skills" <<'PY'
import sys
from ruamel.yaml import YAML

config_path, shared_dir = sys.argv[1], sys.argv[2]
yaml = YAML()
yaml.preserve_quotes = True
with open(config_path) as f:
    data = yaml.load(f) or {}
skills = data.setdefault("skills", {})
dirs = skills.get("external_dirs") or []
if shared_dir not in dirs:
    dirs.append(shared_dir)
skills["external_dirs"] = dirs
# cli-config.yaml.example doesn't set memory.provider at all, so without
# this the user_model plugin is never activated on a from-scratch fresh
# home (MemoryManager.providers ends up empty — no error, just silent
# no-op on every hook). Mirrors gateway/internal_rpc.py's per-user-home patch.
memory = data.setdefault("memory", {})
memory["provider"] = "user_model"
with open(config_path, "w") as f:
    yaml.dump(data, f)
PY
    fi
  fi

  if [ ! -f "${HERMES_HOME}/SOUL.md" ] && [ -f "${INSTALL_DIR}/docker/SOUL.md" ]; then
    cp "${INSTALL_DIR}/docker/SOUL.md" "${HERMES_HOME}/SOUL.md"
  fi
}

# Match upstream Hermes Docker: drop root before gateway touches $HERMES_HOME.
if [ "$(id -u)" = "0" ]; then
  if [ -n "${HERMES_UID:-}" ] && [ "${HERMES_UID}" != "$(id -u hermes)" ]; then
    usermod -u "${HERMES_UID}" hermes
  fi
  if [ -n "${HERMES_GID:-}" ] && [ "${HERMES_GID}" != "$(id -g hermes)" ]; then
    groupmod -o -g "${HERMES_GID}" hermes 2>/dev/null || true
  fi

  bootstrap_data_dir

  actual_uid="$(id -u hermes)"
  if [ "$(stat -c %u "${HERMES_HOME}" 2>/dev/null || echo 0)" != "${actual_uid}" ]; then
    chown -R hermes:hermes "${HERMES_HOME}" 2>/dev/null || \
      echo "Warning: chown ${HERMES_HOME} failed — set HERMES_UID/Hermes_GID to match the bind mount"
  fi

  exec gosu hermes "$0" "$@"
fi

bootstrap_data_dir

# Phase 6 internal RPC/exec service (per-user HERMES_HOME provisioning +
# per-turn subprocess). Additive: apps/api keeps the shared api_server on
# 8642 as a permanent fallback, so a crash here must not take the container
# down with it — hence background, not part of the exec'd foreground process.
python3 "${INSTALL_DIR}/gateway/internal_rpc.py" &

exec hermes "$@"
