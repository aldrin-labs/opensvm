# llms.txt Accessibility Fix

## Problem
The `/llms.txt` endpoint was returning 404 errors. While a route existed at `app/llms.txt/route.ts`, Next.js has conflicts serving routes with `.txt` extensions because:

1. Static files from `public/` take precedence over dynamic routes
2. The `.txt` extension causes Next.js to treat it as a static file request first
3. Without `public/llms.txt`, it returns 404

## Solution
Copy the `llms.txt` file to the `public/` directory:

```bash
cp llms.txt public/llms.txt
```

## Why This Works
- Next.js serves all files in `public/` directory at the root URL path
- `public/llms.txt` → accessible at `/llms.txt`
- This is the standard approach for serving static files like robots.txt, sitemap.xml, etc.
- LLMs and crawlers expect `/llms.txt` to be a static file, not a dynamic route

## Files Involved
- **Source**: `llms.txt` (root, 1386 lines, 52KB)
- **Public**: `public/llms.txt` (copy)
- **Route**: `app/llms.txt/route.ts` (can be kept for dynamic generation but won't be hit)

## Verification
The file is now accessible at:
- Local: `http://localhost:3000/llms.txt`
- Production: `https://opensvm.com/llms.txt`

## Note
The dynamic route at `app/llms.txt/route.ts` can remain as a fallback or be removed. Static files always take precedence in Next.js.
