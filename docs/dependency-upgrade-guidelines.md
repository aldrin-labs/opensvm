# Dependency Upgrade Guidelines

This document outlines best practices for managing and upgrading dependencies in the OpenSVM project.

## How to Audit Dependencies

### Manual Audit Process
1. **Run npm audit**: `npm audit` (requires successful installation)
2. **Check for deprecated packages**: Look for deprecation warnings during install
3. **Review security advisories**: Check npm security advisories for critical packages
4. **Analyze transitive dependencies**: Use `npm ls` to understand dependency tree

### Key Dependencies to Monitor
- **Build tools**: ESLint, TypeScript, Next.js
- **Security-critical**: Authentication, cryptography, and network libraries
- **Testing frameworks**: Jest, Playwright, testing libraries
- **Browser automation**: Puppeteer, browser-related packages

## Upgrade Best Practices

### Planning Upgrades
1. **Check breaking changes**: Review changelogs and migration guides
2. **Prioritize security**: Address vulnerabilities by severity (Critical > High > Medium)
3. **Group related updates**: Update related packages together (e.g., ESLint ecosystem)
4. **Test incrementally**: Upgrade one major dependency at a time

### Version Compatibility Strategy
- **Major versions**: Require careful planning and testing
- **Minor versions**: Usually safe but may include new features
- **Patch versions**: Should be applied promptly for security fixes

### Semantic Versioning Compliance
- Use `^` for minor/patch updates: `^1.2.3` allows `1.x.x`
- Use `~` for patch-only updates: `~1.2.3` allows `1.2.x`
- Pin exact versions for critical stability: `1.2.3`

## Common Upgrade Pitfalls

### Breaking Changes
- **ESLint**: Major versions often require config migrations
- **TypeScript**: Can introduce stricter type checking
- **Next.js**: May deprecate APIs or change behavior
- **Testing frameworks**: Test API changes

### Peer Dependency Conflicts
- Review and resolve peer dependency warnings
- Use `--legacy-peer-deps` flag when necessary
- Consider updating peer dependencies alongside main packages

### Transitive Dependency Issues
- Some vulnerabilities come from nested dependencies
- Use `npm audit fix` for automatic patches
- Override transitive dependencies when necessary

## GitHub Dependencies

### Current Issues
The project uses GitHub-hosted dependencies that cause installation conflicts:
- `@sendaifun/sonic-agent-kit`
- `solana-agent-kit`

### Solutions
1. **Pin to specific commits**: `github:user/repo#commit-hash`
2. **Publish to npm**: Preferred long-term solution
3. **Use npm alternatives**: Find equivalent packages on npm registry
4. **Make optional**: Use optional dependencies for non-critical packages

## Version Compatibility Notes

### Core Libraries

#### ESLint
- **8.x → 9.x**: Requires flat config migration
- **Config format**: New `eslint.config.mjs` replaces `.eslintrc.json`
- **Plugins**: May need updates for flat config compatibility

#### Next.js
- **13.x → 14.x → 15.x**: App Router stabilization
- **ESLint config**: Update `eslint-config-next` to match Next.js version
- **TypeScript**: Ensure compatibility with latest TS version

#### Puppeteer
- **19.x → 24.x**: Major API changes possible
- **Browser support**: Updated Chrome/Chromium versions
- **Installation**: May require browser downloads

#### Playwright
- **1.x**: Generally backward compatible within major version
- **Browser updates**: Includes latest browser versions
- **Test APIs**: Minor improvements and fixes

### Testing Framework
- **Jest**: Stable within major versions
- **@testing-library**: Regular updates with React compatibility
- **TypeScript**: Ensure test types remain compatible

## Automated Monitoring

### Recommended Tools
1. **Dependabot**: Automated PR creation for dependency updates
2. **npm audit**: Regular security scanning
3. **Snyk**: Advanced vulnerability scanning
4. **Renovate**: More sophisticated dependency management

### CI Integration
- Run `npm audit` in CI pipeline
- Fail builds on high/critical vulnerabilities
- Test dependency updates in isolated environments

## Migration Checklists

### Major Version Updates
- [ ] Read changelog and migration guide
- [ ] Check for breaking changes
- [ ] Update related dependencies
- [ ] Run full test suite
- [ ] Test in staging environment
- [ ] Update documentation

### Security Updates
- [ ] Identify vulnerability details
- [ ] Check if update fixes the issue
- [ ] Test minimal reproduction case
- [ ] Deploy and verify fix
- [ ] Run security scan validation

### Framework Updates (Next.js, React)
- [ ] Review deprecation warnings
- [ ] Update configuration files
- [ ] Test all application features
- [ ] Check performance impacts
- [ ] Update development documentation

## Emergency Procedures

### High-Severity Vulnerabilities
1. **Immediate assessment**: Understand the vulnerability impact
2. **Quick patch**: Apply patch versions if available
3. **Workaround**: Implement temporary mitigations
4. **Full update**: Plan comprehensive update when possible

### Broken Dependencies
1. **Rollback**: Revert to last working version
2. **Pin versions**: Prevent automatic updates
3. **Report issues**: File bug reports with maintainers
4. **Find alternatives**: Identify replacement packages

## Documentation Requirements

### After Each Update
- Update version numbers in README.md
- Document any breaking changes
- Update development setup instructions
- Note any new requirements or dependencies

### For Major Changes
- Create migration guides
- Update troubleshooting documentation
- Record lessons learned
- Share knowledge with team

## Success Metrics

- **Security**: Zero high/critical vulnerabilities
- **Maintenance**: Regular update schedule (monthly minor, weekly security)
- **Stability**: No breaking changes in production
- **Performance**: No regression in build times or runtime performance