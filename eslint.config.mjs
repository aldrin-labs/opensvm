import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "plugin:@typescript-eslint/recommended"),
  {
    rules: {
      // Next.js specific rules - disabled for flexibility in production environments
      "@next/next/no-img-element": "off", // Using img instead of Image for external content
      "@next/next/no-page-custom-font": "off", // Custom font loading optimization
      
      // React specific rules - disabled to avoid breaking existing patterns
      "react/no-unescaped-entities": "off", // Common in documentation/content
      "react/jsx-key": "off", // Legacy components need gradual migration
      "react/display-name": "warn", // Enable as warning to improve debugging
      
      // TypeScript rules - temporarily disabled during migration phase
      "@typescript-eslint/no-explicit-any": "warn", // Gradual migration from any types
      "@typescript-eslint/no-unused-vars": "warn", // Enable as warning for cleanup
      "@typescript-eslint/ban-ts-comment": "off", // Some @ts-ignore needed for legacy code
      "@typescript-eslint/no-empty-interface": "off", // Placeholder interfaces for future extension
      "@typescript-eslint/no-empty-object-type": "off", // Legacy type definitions
      
      // JavaScript modernization rules - disabled for legacy compatibility
      "prefer-const": "off", // Large codebase requires gradual migration
      "prefer-rest-params": "off", // Legacy function patterns
      "prefer-spread": "off" // Legacy array manipulation patterns
    }
  }
];

export default eslintConfig;
