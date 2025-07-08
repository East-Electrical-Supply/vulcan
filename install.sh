#!/bin/bash                           
# Vulcan installation script          
# @author John L. Carveth, 2025-07-07 
# #################################### 

# Exit immediately
set -e

BINARY_NAME="vulcan"
INSTALL_DIR="/usr/local/bin"
DATA_DIR="/etc/vulcan"
SERVICE_NAME="vulcan"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (use sudo)"
  exit 1
fi

echo "Installing Vulcan - PDF Engine"

# Create vulcan user / group
if ! getent group vulcan >/dev/null; then
  groupadd --system vulcan
fi
if ! getent passwd vulcan >/dev/null; then
  useradd --system --gid vulcan --shell /bin/false --home-dir /etc/vulcan vulcan
fi

# Create data directory and cache directory
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/.cache"
chmod 755 "$DATA_DIR"
chmod 755 "$DATA_DIR/.cache"
chown -R vulcan:vulcan "$DATA_DIR"

# Compile the binary
deno task compile

# Copy binary to PATH
cp "out/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Download Chrome headless shell for Puppeteer
echo "Downloading Chrome headless shell..."
export PUPPETEER_CACHE_DIR="$DATA_DIR/.cache"
deno run --allow-net --allow-read --allow-write --allow-env --allow-run npm:puppeteer browsers install chrome-headless-shell
chown -R vulcan:vulcan "$DATA_DIR/.cache"

# Install the systemd service file
cp "$SERVICE_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"

# Reload the systemd daemon and enable service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "Installation complete."
