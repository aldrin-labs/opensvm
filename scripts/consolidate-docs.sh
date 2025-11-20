#!/bin/bash

# Script to consolidate all markdown documentation into one file
# Excludes node_modules, .next, build, and .git directories

OUTPUT_FILE="CONSOLIDATED_DOCUMENTATION.md"

echo "# OpenSVM - Consolidated Documentation" > "$OUTPUT_FILE"
echo "Generated on: $(date)" >> "$OUTPUT_FILE"
echo "Total files processed: $(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./build/*" -not -path "./.git/*" | wc -l)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find all markdown files and process them
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./build/*" -not -path "./.git/*" | sort | while read -r file; do
    echo "Processing: $file"
    
    # Add file header
    echo "## File: $file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Add file content
    cat "$file" >> "$OUTPUT_FILE"
    
    # Add separator
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

echo "Documentation consolidated into: $OUTPUT_FILE"
echo "File size: $(du -h $OUTPUT_FILE | cut -f1)"
