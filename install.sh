#!/usr/bin/env bash
# Structured Cards - one-line Obsidian vault installer (no dependencies beyond
# the system: needs curl OR wget for the release path; the source-build fallback
# additionally uses git + node + npm).
#
# One line install:
#   curl -fsSL https://raw.githubusercontent.com/alixxloo/structured-cards/main/install.sh | bash -s -- "/path/to/your/vault"
# Local install:
#   ./install.sh "/path/to/your/vault"
#
# Behavior: downloads main.js, manifest.json and styles.css from the latest
# GitHub Release into <VAULT>/.obsidian/plugins/structured-cards/, enables the
# plugin in <VAULT>/.obsidian/community-plugins.json when that file already
# exists (it is only written by Obsidian itself once community plugins are
# enabled), and falls back to building from source if the release is missing.

set -euo pipefail

REPO="alixxloo/structured-cards"
PLUGIN_ID="structured-cards"
BASE_URL="https://github.com/${REPO}/releases/latest/download"

# --- output helpers ---------------------------------------------------------
if [ -t 1 ] && [ -z "${SC_NO_COLOR:-}" ]; then
  C_INFO=$'\033[1;36m'; C_OK=$'\033[1;32m'; C_ERR=$'\033[1;31m'
  C_WARN=$'\033[1;33m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_INFO=""; C_OK=""; C_ERR=""; C_WARN=""; C_DIM=""; C_OFF=""
fi
info()  { printf '%s[INFO]%s  %s\n' "$C_INFO" "$C_OFF" "$1"; }
ok()    { printf '%s[ OK ]%s  %s\n' "$C_OK"   "$C_OFF" "$1"; }
warn()  { printf '%s[WARN]%s  %s\n' "$C_WARN" "$C_OFF" "$1"; }
err()   { printf '%s[FAIL]%s  %s\n' "$C_ERR" "$C_OFF" "$1" >&2; }

# Prompt only when there is a terminal attached. Under `curl | bash` stdin is
# the script stream itself, so an interactive read has to come from /dev/tty.
prompt_read() {
  if [ -t 0 ]; then
    read -r "$1"
  elif [ -r /dev/tty ] && [ -w /dev/tty ]; then
    printf '%s[INPUT]%s %s ' "$C_INFO" "$C_OFF" "Type your Obsidian vault path >/dev/tty" >&2
    read -r "$1" < /dev/tty
  else
    return 1
  fi
}

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

# --- resolve the vault ------------------------------------------------------
VAULT="${1:-}"
if [ -z "$VAULT" ] && [ -f ".obsidian/app.json" ]; then
  VAULT="$PWD"; ok "Vault detected from the current directory: $VAULT"
fi
if [ -z "$VAULT" ]; then
  info "Pass the vault as the first argument, for example:"
  info "  $0 \"/path/to/your/vault\""
  prompt_read VAULT || { err "No terminal available for a prompt - pass the vault path as an argument."; exit 1; }
fi
VAULT="${VAULT%/}"
if [ ! -d "$VAULT" ]; then
  err "Vault directory not found: $VAULT"
  exit 1
fi
PLUGIN_DIR="${VAULT}/.obsidian/plugins/${PLUGIN_ID}"
info "Installing ${PLUGIN_ID} into: ${PLUGIN_DIR}"
mkdir -p "$PLUGIN_DIR"

# --- download helpers -------------------------------------------------------
dl() { # dl <url> <dest>
  if cmd_exists curl; then
    curl -fsSL --retry 2 -o "$2" "$1"
  elif cmd_exists wget; then
    wget -q -O "$2" "$1"
  else
    return 96 # no downloader
  fi
}

TMPPLUGIN="$(mktemp -d)"
trap 'rm -rf "$TMPPLUGIN"' EXIT

SRC_RELEASE=0
for f in "main.js" "manifest.json" "styles.css"; do
  if dl "${BASE_URL}/${f}" "${TMPPLUGIN}/${f}" 2>/dev/null && [ -s "${TMPPLUGIN}/${f}" ]; then
    SRC_RELEASE=1
  else
    SRC_RELEASE=0
    warn "Release asset missing for ${f}; trying the source build fallback."
    break
  fi
done

# --- fallback: build from source --------------------------------------------
if [ "$SRC_RELEASE" -eq 0 ]; then
  warn "Falling back to building the latest source. This needs git, node and npm."
  if cmd_exists git && cmd_exists npm && cmd_exists node; then
    git clone --depth 1 "https://github.com/${REPO}.git" "${TMPPLUGIN}/src" >/dev/null 2>&1
    (cd "${TMPPLUGIN}/src" && { npm ci --silent 2>/dev/null || npm install --silent; } && npm run build --silent)
    for f in "main.js" "manifest.json" "styles.css"; do
      cp "${TMPPLUGIN}/src/${f}" "${TMPPLUGIN}/${f}"
    done
    SRC_RELEASE=1
    ok "Built from source."
  else
    err "No GitHub release assets found, and git/node/npm are unavailable to build from source."
    err "Install manually from https://github.com/${REPO}/releases or via the BRAT plugin."
    exit 2
  fi
fi

for f in "main.js" "manifest.json" "styles.css"; do
  cp "${TMPPLUGIN}/${f}" "${PLUGIN_DIR}/${f}"
done
if [ ! -s "${PLUGIN_DIR}/main.js" ]; then
  err "main.js ended up empty - aborting."
  exit 3
fi
ok "Plugin files downloaded into the vault."

# --- enable in community-plugins.json when the file already exists ----------
CONFIG="${VAULT}/.obsidian/community-plugins.json"
if [ ! -f "$CONFIG" ]; then
  warn "No community-plugins.json in this vault."
  warn "After Obsidian installs the files, open Obsidian Settings -> General ->"
  warn "Enable 'Community plugins', then enable 'Structured Cards'."
else
  ENABLED="unknown"
  if cmd_exists node; then
    cat > "${TMPPLUGIN}/enable.cjs" <<'NODE'
const fs = require("fs");
const [config, id] = process.argv.slice(2);
let list = [];
try { list = JSON.parse(fs.readFileSync(config, "utf8")); } catch (e) { console.log("parse-error"); process.exit(1); }
if (!Array.isArray(list)) { console.log("not-array"); process.exit(1); }
if (list.includes(id)) { console.log("already"); process.exit(0); }
list.push(id);
fs.writeFileSync(config, JSON.stringify(list, null, 2) + "\n", "utf8");
console.log("added");
NODE
    ENABLED="$(node "${TMPPLUGIN}/enable.cjs" "$CONFIG" "$PLUGIN_ID" || echo failed)"
  elif cmd_exists python3; then
    cat > "${TMPPLUGIN}/enable.py" <<'PYEOF'
import json, sys
config, plugin_id = sys.argv[1], sys.argv[2]
try:
    with open(config, "r", encoding="utf-8") as fh:
        data = json.load(fh)
except Exception:
    print("parse-error"); sys.exit(1)
if not isinstance(data, list):
    print("not-array"); sys.exit(1)
if plugin_id in data:
    print("already")
else:
    data.append(plugin_id)
    with open(config, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
    print("added")
PYEOF
    ENABLED="$(python3 "${TMPPLUGIN}/enable.py" "$CONFIG" "$PLUGIN_ID" 2>/dev/null || echo failed)"
  else
    ENABLED="no-tool"
  fi
  case "$ENABLED" in
    already)   ok "Already enabled in community-plugins.json." ;;
    added*)    ok "Enabled in community-plugins.json." ;;
    no-tool|*)
      warn "Could not rewrite community-plugins.json safely (needs node or python3)."
      if grep -q "\"${PLUGIN_ID}\"" "$CONFIG" 2>/dev/null; then
        ok "But ${PLUGIN_ID} is already listed there - nothing to do."
      else
        warn "Enable it manually: Obsidian Settings -> Community plugins -> Structured Cards."
      fi
      ;;
  esac
fi

# --- done -------------------------------------------------------------------
printf '\n'
ok "Installed '${PLUGIN_ID}' successfully."
info "Next steps:"
info "  1. Open Obsidian (this vault) / or reload with Ctrl+R on Windows,"
info "  2. Settings -> Community plugins -> enable 'Structured Cards'."
info "  3. In any note: Command palette -> 'Structured Cards: Insert field'."
printf '%sDocs & examples: %s%s%s\n' "$C_DIM" "$C_OFF" "$C_INFO" "https://github.com/${REPO}#readme${C_OFF}"
