# ESLint Configuration Documentation

## Overview

This document explains the current ESLint configuration and the rationale behind disabled rules in `eslint.config.mjs`.

## Configuration Strategy

The project uses ESLint 9.x with flat config format for improved maintainability and performance. The configuration extends Next.js core web vitals and TypeScript recommended rules while selectively disabling certain rules during the migration phase.

## Disabled Rules and Rationale

### Next.js Specific Rules

- **`@next/next/no-img-element: "off"`**
  - **Reason**: Project uses `<img>` tags for external content and dynamic image sources
  - **Migration Plan**: Gradual conversion to Next.js `<Image>` component where appropriate

- **`@next/next/no-page-custom-font: "off"`**
  - **Reason**: Custom font loading optimization requires specific implementation
  - **Migration Plan**: Implement Next.js font optimization in future iteration

### React Rules

- **`react/no-unescaped-entities: "off"`**
  - **Reason**: Common in documentation and content-heavy components
  - **Migration Plan**: Use proper entity encoding where necessary

- **`react/jsx-key: "off"`**
  - **Reason**: Legacy components need gradual migration to add keys
  - **Migration Plan**: Add keys to array-rendered components incrementally

- **`react/display-name: "warn"`** *(Changed from "off" to "warn")*
  - **Improvement**: Now warns instead of being completely disabled
  - **Benefit**: Helps with debugging React DevTools

### TypeScript Rules

- **`@typescript-eslint/no-explicit-any: "warn"`** *(Changed from "off" to "warn")*
  - **Improvement**: Now warns instead of being completely disabled
  - **Benefit**: Gradual migration away from `any` types
  - **Migration Plan**: Replace `any` with proper types incrementally

- **`@typescript-eslint/no-unused-vars: "warn"`** *(Changed from "off" to "warn")*
  - **Improvement**: Now warns instead of being completely disabled
  - **Benefit**: Helps identify dead code and unused imports
  - **Migration Plan**: Clean up unused variables as warnings are addressed

- **`@typescript-eslint/ban-ts-comment: "off"`**
  - **Reason**: Some `@ts-ignore` comments necessary for third-party library compatibility
  - **Migration Plan**: Review and minimize usage

- **`@typescript-eslint/no-empty-interface: "off"`**
  - **Reason**: Placeholder interfaces for future extension
  - **Migration Plan**: Add properties or convert to types as needed

- **`@typescript-eslint/no-empty-object-type: "off"`**
  - **Reason**: Legacy type definitions that serve as placeholders
  - **Migration Plan**: Define proper object structures

### JavaScript Modernization Rules

- **`prefer-const: "off"`**
  - **Reason**: Large codebase requires gradual migration
  - **Migration Plan**: Use automated fixes to convert `let` to `const` where appropriate

- **`prefer-rest-params: "off"`**
  - **Reason**: Legacy function patterns in existing code
  - **Migration Plan**: Modernize function signatures incrementally

- **`prefer-spread: "off"`**
  - **Reason**: Legacy array manipulation patterns
  - **Migration Plan**: Update to modern spread operator usage

## Incremental Improvement Plan

### Phase 1 (Current) - Critical Rules as Warnings
- ✅ Enable `react/display-name` as warning
- ✅ Enable `@typescript-eslint/no-explicit-any` as warning  
- ✅ Enable `@typescript-eslint/no-unused-vars` as warning

### Phase 2 - Address High-Impact Rules
- Enable `react/jsx-key` as warning
- Enable `prefer-const` as warning
- Create automated fix scripts for common patterns

### Phase 3 - Full Rule Enablement
- Systematically enable remaining rules
- Use `eslint --fix` to automate corrections
- Manual review for complex cases

## Maintenance Guidelines

1. **Regular Audits**: Review disabled rules quarterly
2. **Incremental Fixes**: Use `eslint --fix` for automated corrections
3. **Documentation**: Update this document when rules are enabled/disabled
4. **Testing**: Ensure rule changes don't break build or functionality

## Tools and Commands

```bash
# Check current lint status
npm run lint

# Fix automatically correctable issues
npx eslint . --fix

# Check specific rule impact
npx eslint . --rule "@typescript-eslint/no-explicit-any: error"
```

## Related Documentation

- [Dependency Upgrade Guidelines](./dependency-upgrade-guidelines.md)
- [Dependency Audit Report](./dependency-audit-2025.md)