#!/bin/bash

# Simulate a large RPC list that would exceed 4KB
LARGE_RPC_LIST='["'
for i in {1..200}; do
    LARGE_RPC_LIST+="263c9f53f4e4cdb897c0edc4a64cd007very_long_endpoint_id_${i}_with_lots_of_characters"
    if [ $i -lt 200 ]; then
        LARGE_RPC_LIST+='","'
    fi
done
LARGE_RPC_LIST+='"]'

export OPENSVM_RPC_LIST="$LARGE_RPC_LIST"
export OPENSVM_RPC_LIST_2='["another_very_long_endpoint_id_1","another_very_long_endpoint_id_2"]'

echo "Testing with large RPC lists that would exceed 4KB..."
node scripts/analyze-env-size.js
