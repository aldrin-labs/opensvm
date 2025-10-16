# Qdrant Cache Fixes

This document explains the fixes applied to resolve Qdrant cache-related errors.

## Issues Fixed

### 1. Missing Discriminator Index Error
**Error:** `Bad request: Index required but not found for "discriminator" of one of the following types: [keyword]`

**Root Cause:** The `discriminator` field was being used in filtering operations but no index was created for it in the Qdrant collection.

**Fix:** Added `discriminator` to the list of fields that get indexed during collection initialization.

**Files Changed:**
- `lib/transaction-analysis-cache.ts` - Added `discriminator` to the indexes array

### 2. Invalid Point ID Error  
**Error:** `Format error in JSON body: value instruction_definition_ComputeBudget111111111111111111111111111111_ComputeBudget111111111111111111111111111111_3b1H8Rq1T3d1__ is not a valid point ID`

**Root Cause:** Qdrant point IDs must be either unsigned integers or valid UUIDs. The application was generating long string IDs by concatenating cache type, program ID, and discriminator values, resulting in invalid point IDs.

**Fix:** 
1. Added a `generatePointId()` method that converts long string identifiers into valid UUID-format point IDs using a hash-based approach
2. Updated all cache insertion methods to use the new point ID generation

**Files Changed:**
- `lib/transaction-analysis-cache.ts` - Added `generatePointId()` method and updated all cache insertion operations

## Scripts Added

### `scripts/fix-qdrant-cache.js`
Node.js script to fix existing Qdrant collections:
- Recreates the transaction analysis cache collection
- Ensures all necessary indexes are created
- Cleans up any existing invalid point IDs

### Usage
```bash
npm run fix-qdrant
```

## Technical Details

### Point ID Generation
The new `generatePointId()` method:
1. Creates a hash from the original string identifier
2. Converts the hash to a UUID-like format with proper structure
3. Ensures consistent IDs for the same input (deterministic)
4. Generates valid UUIDs that Qdrant accepts

### Index Requirements
The following fields now have indexes created:
- `cacheType` - For filtering by cache entry type
- `signature` - For transaction-specific lookups
- `programId` - For program-specific filters
- `discriminator` - For instruction discriminator filters (**NEW**)
- `expiresAt` - For TTL-based cleanup

## Recovery Steps

If you encounter these errors:

1. **Run the fix script:**
   ```bash
   npm run fix-qdrant
   ```

2. **Restart your application** to ensure the new code is loaded

3. **Monitor logs** for any remaining errors

4. **Cache will rebuild automatically** as transactions are processed

## Prevention

These fixes ensure:
- All necessary indexes are created during collection initialization
- Point IDs are always valid UUID format
- Consistent behavior across all cache operations
- Better error handling and logging

The changes are backward compatible and will automatically handle both new and existing cache operations.
