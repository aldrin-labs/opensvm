#!/usr/bin/env node

/**
 * Performance Validation Script
 * 
 * This script validates the performance optimizations implemented
 * in the visualization components without requiring complex mocking.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Performance Optimizations...\n');

const checks = [];

// Check 1: Verify React.memo usage
function checkReactMemo() {
  const enhancedVisualizerPath = path.join(__dirname, '../components/EnhancedTransactionVisualizer.tsx');
  const networkChartsPath = path.join(__dirname, '../components/NetworkCharts.tsx');
  
  let passed = 0;
  let total = 2;
  
  if (fs.existsSync(enhancedVisualizerPath)) {
    const content = fs.readFileSync(enhancedVisualizerPath, 'utf8');
    if (content.includes('React.memo')) {
      console.log('✅ EnhancedTransactionVisualizer uses React.memo');
      passed++;
    } else {
      console.log('❌ EnhancedTransactionVisualizer missing React.memo');
    }
  }
  
  if (fs.existsSync(networkChartsPath)) {
    const content = fs.readFileSync(networkChartsPath, 'utf8');
    if (content.includes('React.memo')) {
      console.log('✅ NetworkCharts uses React.memo');
      passed++;
    } else {
      console.log('❌ NetworkCharts missing React.memo');
    }
  }
  
  return { passed, total, name: 'React.memo Usage' };
}

// Check 2: Verify cleanup patterns
function checkCleanupPatterns() {
  const enhancedVisualizerPath = path.join(__dirname, '../components/EnhancedTransactionVisualizer.tsx');
  const interactionHandlersPath = path.join(__dirname, '../components/transaction-graph/interaction-handlers.ts');
  
  let passed = 0;
  let total = 2;
  
  if (fs.existsSync(enhancedVisualizerPath)) {
    const content = fs.readFileSync(enhancedVisualizerPath, 'utf8');
    if ((content.includes('simulation.stop()') || content.includes('simulationRef.current.stop()')) && 
        content.includes('simulationRef.current = null')) {
      console.log('✅ EnhancedTransactionVisualizer has proper D3 cleanup');
      passed++;
    } else {
      console.log('❌ EnhancedTransactionVisualizer missing proper cleanup');
    }
  }
  
  if (fs.existsSync(interactionHandlersPath)) {
    const content = fs.readFileSync(interactionHandlersPath, 'utf8');
    if (content.includes('cy.off(') && content.includes('mouseover mouseout pan zoom')) {
      console.log('✅ Interaction handlers have proper event cleanup');
      passed++;
    } else {
      console.log('❌ Interaction handlers missing proper cleanup');
    }
  }
  
  return { passed, total, name: 'Cleanup Patterns' };
}

// Check 3: Verify throttling/debouncing
function checkPerformanceUtils() {
  const utilitiesPath = path.join(__dirname, '../lib/sacred/common/utilities.ts');
  const interactionHandlersPath = path.join(__dirname, '../components/transaction-graph/interaction-handlers.ts');
  
  let passed = 0;
  let total = 2;
  
  if (fs.existsSync(utilitiesPath)) {
    const content = fs.readFileSync(utilitiesPath, 'utf8');
    if (content.includes('export function throttle') && content.includes('export function debounce')) {
      console.log('✅ Throttle and debounce utilities available');
      passed++;
    } else {
      console.log('❌ Missing throttle or debounce utilities');
    }
  }
  
  if (fs.existsSync(interactionHandlersPath)) {
    const content = fs.readFileSync(interactionHandlersPath, 'utf8');
    if (content.includes('throttle(') && content.includes('debounce(')) {
      console.log('✅ Performance utilities are being used');
      passed++;
    } else {
      console.log('❌ Performance utilities not being used');
    }
  }
  
  return { passed, total, name: 'Performance Utilities' };
}

// Check 4: Verify memoization patterns
function checkMemoization() {
  const enhancedVisualizerPath = path.join(__dirname, '../components/EnhancedTransactionVisualizer.tsx');
  const networkChartsPath = path.join(__dirname, '../components/NetworkCharts.tsx');
  
  let passed = 0;
  let total = 2;
  
  if (fs.existsSync(enhancedVisualizerPath)) {
    const content = fs.readFileSync(enhancedVisualizerPath, 'utf8');
    if (content.includes('useCallback') && content.includes('useMemo')) {
      console.log('✅ EnhancedTransactionVisualizer uses memoization');
      passed++;
    } else {
      console.log('❌ EnhancedTransactionVisualizer missing memoization');
    }
  }
  
  if (fs.existsSync(networkChartsPath)) {
    const content = fs.readFileSync(networkChartsPath, 'utf8');
    if (content.includes('useCallback') && content.includes('useMemo')) {
      console.log('✅ NetworkCharts uses memoization');
      passed++;
    } else {
      console.log('❌ NetworkCharts missing memoization');
    }
  }
  
  return { passed, total, name: 'Memoization Patterns' };
}

// Check 5: Verify documentation
function checkDocumentation() {
  const docsPath = path.join(__dirname, '../docs/visualization-performance.md');
  
  let passed = 0;
  let total = 1;
  
  if (fs.existsSync(docsPath)) {
    const content = fs.readFileSync(docsPath, 'utf8');
    if (content.includes('Performance Optimization') && 
        content.includes('Memory Management') && 
        content.includes('Best Practices')) {
      console.log('✅ Performance documentation exists and is comprehensive');
      passed++;
    } else {
      console.log('❌ Performance documentation incomplete');
    }
  } else {
    console.log('❌ Performance documentation missing');
  }
  
  return { passed, total, name: 'Documentation' };
}

// Run all checks
const results = [
  checkReactMemo(),
  checkCleanupPatterns(), 
  checkPerformanceUtils(),
  checkMemoization(),
  checkDocumentation()
];

console.log('\n📊 Performance Optimization Summary:');
console.log('=====================================');

let totalPassed = 0;
let totalChecks = 0;

results.forEach(result => {
  totalPassed += result.passed;
  totalChecks += result.total;
  const percentage = Math.round((result.passed / result.total) * 100);
  console.log(`${result.name}: ${result.passed}/${result.total} (${percentage}%)`);
});

const overallPercentage = Math.round((totalPassed / totalChecks) * 100);
console.log(`\nOverall: ${totalPassed}/${totalChecks} (${overallPercentage}%)`);

if (overallPercentage >= 80) {
  console.log('\n🎉 Performance optimizations successfully implemented!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some performance optimizations may be missing.');
  process.exit(1);
}