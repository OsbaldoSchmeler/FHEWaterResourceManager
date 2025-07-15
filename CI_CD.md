# 🚀 CI/CD Pipeline Documentation

## Continuous Integration and Continuous Deployment

This document outlines the automated CI/CD pipeline for the Water Resource Management Platform, including testing, code quality checks, and deployment workflows.

---

## 📋 Table of Contents

- [Pipeline Overview](#pipeline-overview)
- [Workflows](#workflows)
- [Code Quality](#code-quality)
- [Coverage Reporting](#coverage-reporting)
- [Setup Instructions](#setup-instructions)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Pipeline Overview

### Automation Triggers

The CI/CD pipeline automatically runs on:

✅ **Push Events**
- Pushes to `main` branch
- Pushes to `develop` branch

✅ **Pull Request Events**
- Pull requests targeting `main` branch
- Pull requests targeting `develop` branch

### Multi-Version Testing

Tests run on multiple Node.js versions:
- Node.js 18.x
- Node.js 20.x

---

## 🔄 Workflows

### 1. Main Test Workflow

**File**: `.github/workflows/test.yml`

#### Jobs

##### **Test Job**
Runs on Node.js 18.x and 20.x in parallel

**Steps**:
1. ✅ Checkout code
2. ✅ Setup Node.js (version matrix)
3. ✅ Install dependencies (`npm ci`)
4. ✅ Compile contracts
5. ✅ Run Solhint linter
6. ✅ Execute test suite
7. ✅ Generate coverage report
8. ✅ Upload coverage to Codecov
9. ✅ Archive test results

**Artifacts**:
- Test results for each Node version
- Coverage reports
- Gas usage reports

##### **Lint Job**
Code quality checks on Node.js 20.x

**Steps**:
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Run Solhint (Solidity linter)
5. ✅ Check code formatting (Prettier)

##### **Security Job**
Security audit on Node.js 20.x

**Steps**:
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Run `npm audit` for vulnerabilities
5. ✅ Check for known security issues
6. ✅ Upload audit results

##### **Build Job**
Build verification (runs after test and lint pass)

**Steps**:
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Compile contracts
5. ✅ Verify artifacts generated
6. ✅ Check contract sizes
7. ✅ Archive build artifacts

---

## 🔍 Code Quality

### Solhint Configuration

**File**: `.solhint.json`

#### Enabled Rules

**Naming Conventions**:
- ✅ `contract-name-camelcase` - Contract names in CamelCase
- ✅ `event-name-camelcase` - Event names in CamelCase
- ✅ `func-name-mixedcase` - Function names in mixedCase
- ✅ `modifier-name-mixedcase` - Modifier names in mixedCase

**Code Quality**:
- ✅ `func-visibility` - Explicit visibility modifiers
- ✅ `no-empty-blocks` - No empty code blocks
- ✅ `no-unused-vars` - No unused variables
- ✅ `reason-string` - Revert reasons required
- ✅ `max-line-length` - Max 120 characters per line

**Security**:
- ✅ `avoid-suicide` - No selfdestruct usage
- ✅ `avoid-throw` - Use revert/require instead
- ✅ `avoid-low-level-calls` - Avoid low-level calls
- ✅ `not-rely-on-time` - Time dependency warnings

**Best Practices**:
- ✅ `code-complexity` - Max cyclomatic complexity: 8
- ✅ `function-max-lines` - Max 50 lines per function
- ✅ `max-states-count` - Max 15 state variables
- ✅ `ordering` - Correct element ordering

### Prettier Configuration

**File**: `.prettierrc.json`

#### Solidity Formatting
- Print width: 120 characters
- Tab width: 4 spaces
- No tabs
- Double quotes
- Bracket spacing
- Explicit types

#### JavaScript/TypeScript Formatting
- Print width: 100 characters
- Tab width: 2 spaces
- No tabs
- Double quotes
- Trailing commas (ES5)
- Semicolons

### Running Linters Locally

```bash
# Run Solhint
npm run lint:sol

# Fix auto-fixable issues
npm run lint:sol:fix

# Check formatting
npm run format:check

# Auto-format code
npm run format
```

---

## 📊 Coverage Reporting

### Codecov Integration

**File**: `codecov.yml`

#### Coverage Targets

| Component | Target | Threshold |
|-----------|--------|-----------|
| Project | 90% | ±2% |
| Patch | 85% | ±5% |

#### Features

✅ **Automatic Uploads**
- Coverage reports uploaded after each test run
- Available for both Node.js 18.x and 20.x

✅ **Pull Request Comments**
- Coverage diff in PR comments
- Coverage visualization
- Flag-based reporting

✅ **Ignored Files**
- Test files (`test/**/*`)
- Scripts (`scripts/**/*`)
- Configuration files

#### Viewing Coverage

**Locally**:
```bash
# Generate coverage report
npm run coverage

# View HTML report
open coverage/index.html
```

**On Codecov**:
1. Visit https://codecov.io/
2. Navigate to your repository
3. View coverage reports and trends

---

## ⚙️ Setup Instructions

### GitHub Repository Setup

#### 1. Enable GitHub Actions

```bash
# Actions are enabled by default
# Verify in: Settings > Actions > General
```

#### 2. Configure Secrets

Navigate to: `Settings > Secrets and variables > Actions`

Add the following secrets:

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `CODECOV_TOKEN` | Codecov upload token | Yes |
| `PRIVATE_KEY` | Deployment private key | For deployment |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint | For deployment |
| `ETHERSCAN_API_KEY` | Etherscan API key | For verification |

#### 3. Set Up Codecov

1. Visit https://codecov.io/
2. Sign in with GitHub
3. Enable your repository
4. Copy the upload token
5. Add to GitHub secrets as `CODECOV_TOKEN`

#### 4. Branch Protection Rules

Recommended settings for `main` branch:

```
Settings > Branches > Add rule

Branch name pattern: main

✅ Require a pull request before merging
✅ Require status checks to pass before merging
   - Test on Node.js 18.x
   - Test on Node.js 20.x
   - Code Quality Checks
   - Build Verification
✅ Require branches to be up to date before merging
✅ Include administrators
```

---

## 🔄 Workflow Status

### Status Badges

Add to your README.md:

```markdown
![CI](https://github.com/your-username/your-repo/workflows/Continuous%20Integration/badge.svg)
[![codecov](https://codecov.io/gh/your-username/your-repo/branch/main/graph/badge.svg)](https://codecov.io/gh/your-username/your-repo)
```

### Viewing Workflow Runs

1. Navigate to repository on GitHub
2. Click "Actions" tab
3. Select a workflow run to view details
4. Check logs for each job

---

## 📦 Artifacts

### Generated Artifacts

The CI pipeline generates and stores the following artifacts:

| Artifact | Retention | Description |
|----------|-----------|-------------|
| `test-results-node-18.x` | 30 days | Test results for Node 18 |
| `test-results-node-20.x` | 30 days | Test results for Node 20 |
| `security-audit` | 30 days | NPM audit results |
| `build-artifacts` | 7 days | Compiled contracts |

### Accessing Artifacts

1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download desired artifact

---

## 🛠️ Local Development Workflow

### Before Committing

```bash
# 1. Run linter
npm run lint:sol

# 2. Check formatting
npm run format:check

# 3. Run tests
npm test

# 4. Generate coverage
npm run coverage

# 5. Compile contracts
npm run compile
```

### Pre-commit Checklist

- [ ] All tests passing
- [ ] No linting errors
- [ ] Code formatted
- [ ] Coverage maintained
- [ ] No security issues

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Tests Failing in CI but Pass Locally

**Solution**:
```bash
# Use same Node version as CI
nvm use 20

# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests
npm test
```

#### Issue 2: Codecov Upload Fails

**Solution**:
1. Check `CODECOV_TOKEN` is set correctly
2. Verify coverage file exists: `coverage/coverage-final.json`
3. Check Codecov status: https://status.codecov.io/

#### Issue 3: Linting Errors

**Solution**:
```bash
# Auto-fix issues
npm run lint:sol:fix

# Check specific file
npx solhint contracts/YourContract.sol
```

#### Issue 4: Formatting Errors

**Solution**:
```bash
# Auto-format all files
npm run format

# Check specific file
npx prettier --write contracts/YourContract.sol
```

### Getting Help

1. **Check workflow logs**: Detailed error messages in GitHub Actions
2. **Review documentation**: This file and tool-specific docs
3. **Test locally**: Reproduce issues in local environment
4. **GitHub Issues**: Report bugs or request features

---

## 📈 Continuous Improvement

### Monitoring

Track these metrics over time:
- ✅ Test pass rate
- ✅ Code coverage percentage
- ✅ Build success rate
- ✅ Security vulnerabilities
- ✅ Average build time

### Optimization

**Speed Improvements**:
- Cache `node_modules` (already implemented)
- Parallel job execution (already implemented)
- Selective test execution for PRs

**Quality Improvements**:
- Increase coverage targets gradually
- Add more linting rules progressively
- Implement automated security scanning

---

## 📚 Resources

### Official Documentation

- **GitHub Actions**: https://docs.github.com/actions
- **Hardhat**: https://hardhat.org/
- **Solhint**: https://github.com/protofire/solhint
- **Prettier**: https://prettier.io/
- **Codecov**: https://docs.codecov.com/

### Configuration Files

- `.github/workflows/test.yml` - Main CI workflow
- `.solhint.json` - Solidity linting rules
- `.prettierrc.json` - Code formatting rules
- `codecov.yml` - Coverage reporting config

---

## ✅ Pipeline Features Summary

### Automated Testing
✅ Multi-version testing (Node 18.x, 20.x)
✅ Comprehensive test suite execution
✅ Coverage report generation
✅ Gas usage tracking

### Code Quality
✅ Solidity linting (Solhint)
✅ Code formatting checks (Prettier)
✅ Style guide enforcement
✅ Best practices validation

### Security
✅ NPM dependency audit
✅ Vulnerability scanning
✅ Security issue reporting

### Integration
✅ Codecov integration
✅ Artifact archiving
✅ Status badges
✅ PR comments

### Workflow Optimization
✅ Parallel job execution
✅ Dependency caching
✅ Selective job triggers
✅ Build verification

---

## 🎯 Best Practices

### For Developers

1. **Run tests locally** before pushing
2. **Fix linting errors** immediately
3. **Maintain coverage** above thresholds
4. **Review CI logs** when builds fail
5. **Keep dependencies** up to date

### For Pull Requests

1. **Ensure all checks pass** before requesting review
2. **Address reviewer comments** promptly
3. **Update tests** for new features
4. **Document changes** in commit messages
5. **Squash commits** when merging

### For Maintainers

1. **Review workflow logs** regularly
2. **Update CI configuration** as needed
3. **Monitor coverage trends**
4. **Address security alerts** promptly
5. **Keep documentation** current

---

**CI/CD Version**: 1.0.0
**Last Updated**: October 2024
**Status**: ✅ Production Ready
**Maintained By**: Water Resource Management Team
