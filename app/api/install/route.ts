import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Inline installer script that installs osvm-cli from GitHub.
// This is what will be executed when users run: curl https://osvm.ai | sh
const INSTALL_SCRIPT = `#!/usr/bin/env sh
set -e

REPO_URL="https://github.com/openSVM/osvm-cli.git"
INSTALL_DIR="$HOME/.osvm-cli"
BIN_NAME="osvm"

printf "Installing osvm-cli from %s\\n" "$REPO_URL"

# Check dependencies
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required but not installed." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
  echo "Error: either node or bun is required but neither is installed." >&2
  exit 1
fi

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
  printf "Updating existing osvm-cli in %s...\\n" "$INSTALL_DIR"
  (cd "$INSTALL_DIR" && git pull --ff-only)
else
  printf "Cloning osvm-cli into %s...\\n" "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install dependencies (prefer bun if available)
if command -v bun >/dev/null 2>&1; then
  printf "Installing dependencies with bun...\\n"
  bun install
else
  printf "Installing dependencies with npm...\\n"
  npm install
fi

# Build if package.json defines it
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  if node -e "const pkg=require('./package.json');process.exit(pkg.scripts && pkg.scripts.build?0:1)"; then
    printf "Building osvm-cli...\\n"
    if command -v bun >/dev/null 2>&1; then
      bun run build
    else
      npm run build
    fi
  fi
fi

# Create shim in ~/.local/bin if possible
TARGET_DIR="$HOME/.local/bin"
mkdir -p "$TARGET_DIR"

# Prefer package's bin if defined, otherwise default to node index
if [ -f package.json ]; then
  CLI_BIN=$(node -e "const pkg=require('./package.json');const bin=pkg.bin; if (typeof bin==='string') console.log(bin); else if (bin && bin['$BIN_NAME']) console.log(bin['$BIN_NAME']);" 2>/dev/null || true)
else
  CLI_BIN=""
fi

if [ -n "$CLI_BIN" ] && [ -f "$INSTALL_DIR/$CLI_BIN" ]; then
  cat >"$TARGET_DIR/$BIN_NAME" <<EOF
#!/usr/bin/env sh
node "$INSTALL_DIR/$CLI_BIN" "$@"
EOF
  chmod +x "$TARGET_DIR/$BIN_NAME"
else
  cat >"$TARGET_DIR/$BIN_NAME" <<EOF
#!/usr/bin/env sh
node "$INSTALL_DIR/index.js" "$@"
EOF
  chmod +x "$TARGET_DIR/$BIN_NAME"
fi

printf "osvm-cli installed to %s.\\n" "$TARGET_DIR/$BIN_NAME"

case :"$PATH": in
  *:"$TARGET_DIR":*) ;;
  *)
    printf "\\nNOTE: %s is not in your PATH. Add this to your shell profile:\\n" "$TARGET_DIR"
    printf '  export PATH="$HOME/.local/bin:$PATH"\\n'
    ;;
esac
`;

export async function GET() {
  return new NextResponse(INSTALL_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-sh; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
