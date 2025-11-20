#!/usr/bin/env python3
"""
Fix remaining lib/ imports after reorganization
"""

import os
import re
from pathlib import Path

# Import mapping: old path -> new path
IMPORT_MAP = {
    '@/lib/feed-cache': '@/lib/caching/feed-cache',
    '@/lib/program-registry': '@/lib/solana/program-registry',
    '@/lib/program-activity': '@/lib/solana/program-activity',
    '@/lib/solana-connection-client': '@/lib/solana/solana-connection-client',
    '@/lib/solana-connection-server': '@/lib/solana/solana-connection-server',
    '@/lib/logger': '@/lib/logging/logger',
    '@/lib/ai-service-client': '@/lib/ai/ai-service-client',
    '@/lib/graph-state-cache': '@/lib/caching/graph-state-cache',
    '@/lib/anomaly-patterns': '@/lib/analytics/anomaly-patterns',
    '@/lib/configurable-anomaly-patterns': '@/lib/analytics/configurable-anomaly-patterns',
    '@/lib/sse-manager': '@/lib/api/sse-manager',
    '@/lib/rate-limit': '@/lib/api/rate-limit',
    '@/lib/rate-limiter-tiers': '@/lib/api/rate-limiter-tiers',
    '@/lib/moralis-api': '@/lib/external-apis/moralis-api',
    '@/lib/transaction-constants': '@/lib/blockchain/transaction-constants',
    './solana-connection-client': './solana/solana-connection-client',  # Relative
    './opensvm-rpc': './solana/rpc/opensvm-rpc',  # Relative
    './rate-limit': './api/rate-limit',  # Relative
    './logger': './logging/logger',  # Relative
    './user-history-utils': './user/user-history-utils',  # Relative
    './user/user-history-utils': '../user/user-history-utils',  # From lib/utils to lib/user
}

def fix_imports_in_file(filepath):
    """Fix imports in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_made = False
        
        for old_path, new_path in IMPORT_MAP.items():
            # Match both single and double quotes
            patterns = [
                (f"from '{old_path}'", f"from '{new_path}'"),
                (f'from "{old_path}"', f'from "{new_path}"'),
            ]
            
            for old_pattern, new_pattern in patterns:
                if old_pattern in content:
                    content = content.replace(old_pattern, new_pattern)
                    changes_made = True
        
        if changes_made:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    root = Path('/home/larp/aldrin/opensvm')
    dirs_to_scan = ['app', 'components', 'lib', 'hooks', 'contexts', 'utils', 'types']
    
    total_files = 0
    fixed_files = 0
    
    for dir_name in dirs_to_scan:
        dir_path = root / dir_name
        if not dir_path.exists():
            continue
        
        for ext in ['*.ts', '*.tsx']:
            for filepath in dir_path.rglob(ext):
                total_files += 1
                if fix_imports_in_file(filepath):
                    fixed_files += 1
                    print(f"✓ Fixed: {filepath.relative_to(root)}")
    
    print(f"\n✨ Complete! Fixed {fixed_files}/{total_files} files")

if __name__ == '__main__':
    main()
