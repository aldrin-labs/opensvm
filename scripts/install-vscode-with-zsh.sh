#!/bin/bash

echo "=== VSCode + Zsh Installation Guide ==="
echo ""

# Detect the host system
if command -v apt &> /dev/null; then
    echo "Detected Debian/Ubuntu system"
    echo "Run these commands on your HOST system (not in VSCode terminal):"
    echo ""
    echo "1. Install zsh if not already installed:"
    echo "   sudo apt update && sudo apt install zsh"
    echo ""
    echo "2. Install VSCode from Microsoft repository:"
    echo "   wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg"
    echo "   sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/"
    echo "   sudo sh -c 'echo \"deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main\" > /etc/apt/sources.list.d/vscode.list'"
    echo "   sudo apt update && sudo apt install code"
    echo ""
elif command -v dnf &> /dev/null; then
    echo "Detected Fedora system"
    echo "Run these commands on your HOST system (not in VSCode terminal):"
    echo ""
    echo "1. Install zsh if not already installed:"
    echo "   sudo dnf install zsh"
    echo ""
    echo "2. Install VSCode:"
    echo "   sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc"
    echo "   sudo sh -c 'echo -e \"[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc\" > /etc/yum.repos.d/vscode.repo'"
    echo "   sudo dnf check-update && sudo dnf install code"
    echo ""
elif command -v pacman &> /dev/null; then
    echo "Detected Arch Linux system"
    echo "Run these commands on your HOST system (not in VSCode terminal):"
    echo ""
    echo "1. Install zsh if not already installed:"
    echo "   sudo pacman -S zsh"
    echo ""
    echo "2. Install VSCode:"
    echo "   sudo pacman -S code"
    echo ""
else
    echo "Could not detect package manager. Please:"
    echo "1. Install zsh using your system's package manager"
    echo "2. Install VSCode from https://code.visualstudio.com/download"
fi

echo "3. Set zsh as your default shell:"
echo "   chsh -s \$(which zsh)"
echo ""
echo "4. Close this Flatpak VSCode and open the newly installed system VSCode"
echo ""
echo "5. In the new VSCode, open terminal - it should now use zsh!"

echo ""
echo "=== Alternative: Quick Fix for Current Session ==="
echo "If you want to use zsh in the current Flatpak VSCode terminal:"
echo "Just type 'bash' in the terminal, then type 'exec zsh' if zsh is available on host"
