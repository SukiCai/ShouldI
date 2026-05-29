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
exec hermes "$@"
