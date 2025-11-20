#!/bin/bash

# Package Manager Conflict Resolution Script
# This script standardizes the project on NPM by removing conflicting lock files
# and reinstalling dependencies cleanly.

echo "🔧 Starting package manager conflict resolution..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not available. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ NPM is not available. Please install NPM first."
    exit 1
fi

echo "✅ Node.js and NPM are available"

# Backup lock files if they don't exist already
echo "📦 Creating backups of existing lock files..."
if [ -f "yarn.lock" ] && [ ! -f "yarn.lock.backup" ]; then
    cp yarn.lock yarn.lock.backup
    echo "✅ yarn.lock backed up"
fi

if [ -f "bun.lock" ] && [ ! -f "bun.lock.backup" ]; then
    cp bun.lock bun.lock.backup
    echo "✅ bun.lock backed up"
fi

if [ -f "package-lock.json" ] && [ ! -f "package-lock.json.backup" ]; then
    cp package-lock.json package-lock.json.backup
    echo "✅ package-lock.json backed up"
fi

# Remove conflicting lock files (keep NPM as standard)
echo "🗑️  Removing conflicting lock files..."
if [ -f "yarn.lock" ]; then
    rm yarn.lock
    echo "✅ yarn.lock removed"
fi

if [ -f "bun.lock" ]; then
    rm bun.lock
    echo "✅ bun.lock removed"
fi

# Clean npm cache and node_modules
echo "🧹 Cleaning npm cache and node_modules..."
npm cache clean --force
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "✅ node_modules removed"
fi

# Remove existing package-lock.json to generate fresh one
if [ -f "package-lock.json" ]; then
    rm package-lock.json
    echo "✅ old package-lock.json removed"
fi

# Install dependencies with NPM
echo "📦 Installing dependencies with NPM..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Run tests to verify fix
echo "🧪 Running tests to verify the fix..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ All tests passed! Package manager conflicts resolved."
else
    echo "⚠️  Some tests still failing. Manual investigation may be needed."
    echo "📊 Running test summary..."
    npm test -- --verbose 2>&1 | grep -E "(PASS|FAIL|Tests:|Test Suites:)" | tail -10
fi

echo "🎉 Package manager standardization complete!"
echo "📝 Remember to:"
echo "   - Add yarn.lock and bun.lock to .gitignore"
echo "   - Update CI/CD to use npm only"
echo "   - Remove any remaining bun/yarn references in scripts"