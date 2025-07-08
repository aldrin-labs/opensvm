# Contributing to Architecture Documentation

This guide provides instructions for maintaining and contributing to the OpenSVM architecture documentation.

## 📋 Documentation Structure

The architecture documentation is organized as follows:

```
docs/architecture/
├── README.md                    # Main architecture overview
├── system-overview.md           # High-level system architecture
├── components.md                # Component architecture details
├── data-flow.md                 # Data flow and integration patterns
├── deployment.md                # Infrastructure and deployment
├── performance.md               # Performance considerations
├── security.md                  # Security architecture
├── development-guidelines.md    # Development standards
├── adr/                        # Architecture Decision Records
│   ├── README.md
│   ├── 001-vector-database-selection.md
│   ├── 002-frontend-framework-choice.md
│   └── 003-testing-strategy.md
└── CONTRIBUTING.md             # This file
```

## 🎯 When to Update Documentation

### Required Updates
Documentation **must** be updated when:
- **New architectural decisions** are made
- **Major components** are added, modified, or removed
- **Integration patterns** change
- **Performance characteristics** are significantly altered
- **Security measures** are updated or added
- **Development guidelines** are modified

### Recommended Updates
Documentation **should** be updated when:
- **Minor components** are added or modified
- **API interfaces** change
- **Dependencies** are updated (major versions)
- **Development tools** are changed
- **Best practices** are identified

## 📝 How to Update Documentation

### 1. Making Changes

#### For Code Changes:
```bash
# 1. Create feature branch
git checkout -b feature/new-component

# 2. Make code changes
# ... develop your feature ...

# 3. Update relevant documentation
# - Update component architecture if adding/modifying components
# - Update system overview if changing system behavior
# - Create ADR if making architectural decisions

# 4. Include documentation in your commit
git add docs/architecture/
git commit -m "feat: add new transaction visualizer component

- Add TransactionVisualizer component
- Update component architecture documentation
- Add ADR for visualization library choice"
```

#### For Documentation-Only Changes:
```bash
# 1. Create documentation branch
git checkout -b docs/update-architecture

# 2. Update documentation files
# ... make your changes ...

# 3. Commit with appropriate message
git commit -m "docs: update component architecture

- Add missing component descriptions
- Update component relationship diagrams
- Fix broken internal links"
```

### 2. Creating Architecture Decision Records (ADRs)

When making significant architectural decisions:

1. **Create a new ADR file**:
   ```bash
   # Use the next sequential number
   cp docs/architecture/adr/000-template.md docs/architecture/adr/004-new-decision.md
   ```

2. **Fill in the ADR template**:
   ```markdown
   # ADR-004: [Your Decision Title]

   ## Status
   Proposed

   ## Context
   [Describe the problem and why a decision is needed]

   ## Decision
   [Describe the architectural decision made]

   ## Consequences
   ### Positive
   - [List positive outcomes]

   ### Negative
   - [List negative outcomes]

   ## Alternatives Considered
   - [Alternative 1]: [Why rejected]
   - [Alternative 2]: [Why rejected]

   ## References
   - [Link to relevant discussions]
   - [Link to related documentation]
   ```

3. **Update the ADR index**:
   ```markdown
   # In docs/architecture/adr/README.md
   - [ADR-004: New Decision](./004-new-decision.md)
   ```

### 3. Updating Component Documentation

When adding or modifying components:

1. **Update component architecture**:
   ```markdown
   # In docs/architecture/components.md
   
   #### NewComponent.tsx
   **Purpose**: [Component purpose]
   **Location**: `components/feature/`
   **Architecture Reference**: [Link to relevant system docs]
   
   ```typescript
   /**
    * [Component description]
    * @see docs/architecture/system-overview.md#relevant-section
    */
   interface NewComponentProps {
     // ...
   }
   ```
   
   **Key Features**:
   - [Feature 1]
   - [Feature 2]
   ```

2. **Add to component hierarchy**:
   ```markdown
   # Update the component hierarchy tree
   ```

3. **Document relationships**:
   ```markdown
   # Add to component relationships section
   ```

## 🔗 Linking Documentation to Code

### In-Code Documentation References

Add JSDoc comments to link code to architecture documentation:

```typescript
/**
 * Transaction visualization component using D3.js
 * 
 * @see docs/architecture/components.md#transaction-components
 * @see docs/architecture/adr/004-data-visualization-library.md
 */
export const TransactionFlowChart: React.FC<TransactionFlowChartProps> = ({
  transactionData,
  onNodeClick,
  layout = 'force'
}) => {
  // Implementation...
};
```

### API Route Documentation

```typescript
/**
 * Solana RPC proxy endpoint
 * 
 * @see docs/architecture/system-overview.md#api-infrastructure
 * @see docs/architecture/data-flow.md#blockchain-integration
 */
export async function GET(request: NextRequest) {
  // Implementation...
}
```

### Utility Functions

```typescript
/**
 * Transaction parsing utilities
 * 
 * @see docs/architecture/system-overview.md#blockchain-integration-layer
 * @see docs/architecture/development-guidelines.md#utility-functions
 */
export class TransactionParser {
  // Implementation...
}
```

## ✅ Documentation Review Process

### Pull Request Checklist

When submitting a pull request:

- [ ] **Architecture documentation updated** for any architectural changes
- [ ] **Component documentation updated** for new/modified components
- [ ] **ADR created** for significant architectural decisions
- [ ] **Links verified** - all internal links work correctly
- [ ] **Code references added** - JSDoc comments link to relevant documentation
- [ ] **Examples updated** - code examples reflect current implementation
- [ ] **Diagrams updated** - Mermaid diagrams reflect current architecture

### Review Guidelines

When reviewing documentation:

1. **Accuracy**: Ensure documentation reflects current code state
2. **Completeness**: Check that all aspects are covered
3. **Clarity**: Verify that explanations are clear and understandable
4. **Consistency**: Ensure consistent style and formatting
5. **Links**: Verify all internal and external links work
6. **Examples**: Check that code examples are correct and current

## 📊 Documentation Quality Standards

### Writing Style
- **Clear and concise**: Avoid unnecessary jargon
- **Consistent terminology**: Use the same terms throughout
- **Active voice**: Prefer active over passive voice
- **Present tense**: Use present tense for current state
- **Specific examples**: Include concrete examples where helpful

### Formatting Standards
- **Consistent headers**: Use proper header hierarchy
- **Code blocks**: Use appropriate syntax highlighting
- **Lists**: Use consistent list formatting
- **Links**: Use descriptive link text
- **Diagrams**: Use Mermaid for architecture diagrams

### Code Examples
```typescript
// Good: Complete, runnable example
const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  onSort 
}) => {
  const [sortField, setSortField] = useState('timestamp');
  
  const handleSort = (field: string) => {
    setSortField(field);
    onSort(field, sortField === field ? 'desc' : 'asc');
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => handleSort('signature')}>Signature</th>
          <th onClick={() => handleSort('timestamp')}>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(tx => (
          <tr key={tx.signature}>
            <td>{tx.signature}</td>
            <td>{new Date(tx.timestamp).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

## 🚨 Common Pitfalls to Avoid

### Documentation Debt
- **Stale examples**: Code examples that don't match current implementation
- **Broken links**: Internal links that no longer work
- **Outdated diagrams**: Architecture diagrams that don't reflect current state
- **Missing ADRs**: Architectural decisions not documented

### Inconsistencies
- **Terminology**: Using different terms for the same concept
- **Formatting**: Inconsistent formatting across documents
- **Code style**: Examples that don't follow project conventions
- **Link patterns**: Inconsistent linking conventions

### Maintenance Issues
- **Orphaned documentation**: Documentation for removed features
- **Duplicate information**: Same information in multiple places
- **Version conflicts**: Documentation that conflicts with code

## 🔄 Regular Maintenance

### Monthly Reviews
- **Link validation**: Check all internal and external links
- **Content accuracy**: Verify documentation matches current code
- **Completeness**: Identify missing documentation
- **Consistency**: Check for consistent terminology and formatting

### Quarterly Updates
- **Architecture review**: Comprehensive architecture documentation review
- **ADR review**: Review and update ADR status
- **Style guide**: Update style guide based on new patterns
- **Tool updates**: Update tooling and documentation infrastructure

## 📚 Resources

### Documentation Tools
- **Mermaid**: For creating architecture diagrams
- **Markdown**: For documentation format
- **JSDoc**: For in-code documentation
- **Git**: For version control and collaboration

### References
- [Mermaid Documentation](https://mermaid.js.org/)
- [Markdown Guide](https://www.markdownguide.org/)
- [JSDoc Reference](https://jsdoc.app/)
- [ADR Templates](https://github.com/joelparkerhenderson/architecture_decision_record)

---

*This contributing guide is a living document. Please suggest improvements and updates as our documentation practices evolve.*