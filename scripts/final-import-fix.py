#!/usr/bin/env python3
"""
Final comprehensive import fixer
"""

import os
import re
from pathlib import Path

ROOT = Path('/home/larp/aldrin/opensvm')

FIXES = [
    # Relative imports from app/api
    (r"from ['\"]\.\.\/\.\.\/\.\.\/lib\/solana-connection-server['\"]", "from '@/lib/solana/solana-connection-server'"),
    (r"from ['\"]\.\.\/\.\.\/\.\.\/\.\.\/lib\/auth-server['\"]", "from '@/lib/api-auth/auth-server'"),
    (r"from ['\"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/qdrant['\"]", "from '@/lib/search/qdrant'"),
    (r"from ['\"]\.\.\/\.\.\/\.\.\/\.\.\/lib\/qdrant-search-suggestions['\"]", "from '@/lib/search/qdrant-search-suggestions'"),
    
    # Absolute imports
    (r"from ['\"]@/lib/program-metadata-cache['\"]", "from '@/lib/solana/program-metadata-cache'"),
]

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        for pattern, replacement in FIXES:
            content = re.sub(pattern, replacement, content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error: {filepath}: {e}")
        return False

def main():
    fixed = 0
    for ext in ['*.ts', '*.tsx']:
        for filepath in ROOT.rglob(ext):
            if 'node_modules' in str(filepath) or '.next' in str(filepath):
                continue
            if fix_file(filepath):
                print(f"✓ {filepath.relative_to(ROOT)}")
                fixed += 1
    
    print(f"\n✨ Fixed {fixed} files")

if __name__ == '__main__':
    main()
