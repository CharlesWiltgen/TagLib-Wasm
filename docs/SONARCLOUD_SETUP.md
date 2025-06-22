# SonarCloud Setup Guide

This guide explains how to set up and use SonarCloud for code quality analysis in the taglib-wasm project.

## Prerequisites

1. **SonarCloud Account**: Create an account at [sonarcloud.io](https://sonarcloud.io)
2. **GitHub Integration**: Connect your GitHub repository to SonarCloud
3. **Organization**: Create or join a SonarCloud organization

## Configuration Steps

### 1. Update Project Keys

Edit `sonar-project.properties` and update these values:

```properties
sonar.projectKey=your-github-username_taglib-wasm
sonar.organization=your-sonarcloud-organization
```

Also update the links section with your actual GitHub repository URL:

```properties
sonar.links.homepage=https://github.com/your-username/taglib-wasm
sonar.links.ci=https://github.com/your-username/taglib-wasm/actions
sonar.links.scm=https://github.com/your-username/taglib-wasm
sonar.links.issue=https://github.com/your-username/taglib-wasm/issues
```

### 2. Add GitHub Secrets

In your GitHub repository settings, add the following secret:

- `SONAR_TOKEN`: Your SonarCloud authentication token
  1. Go to SonarCloud → My Account → Security
  2. Generate a new token
  3. Add it as a GitHub secret

The `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 3. Enable Analysis

The SonarCloud analysis will run automatically on:

- Every push to the `main` branch
- Every pull request
- Manual workflow dispatch

## Running Analysis Locally

To generate coverage reports locally for inspection:

```bash
# Run tests with coverage and generate lcov report
npm run test:coverage:lcov

# The lcov report will be at coverage/lcov.info
```

## Understanding the Configuration

### File Structure

- `sonar-project.properties`: Main SonarCloud configuration
- `.github/workflows/sonarcloud.yml`: GitHub Actions workflow for automated analysis

### Key Configuration Options

1. **Source Files**: Configured to analyze TypeScript source files
   ```properties
   sonar.sources=src,index.ts,mod.ts,simple.ts,workers.ts
   ```

2. **Test Files**: Test files are properly identified
   ```properties
   sonar.tests=tests
   sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
   ```

3. **Exclusions**: Files excluded from analysis
   - Generated files (`dist/`, `build/`)
   - Dependencies (`node_modules/`)
   - External libraries (`lib/`)
   - Type definitions (`*.d.ts`)
   - Examples and scripts

4. **Coverage**: JavaScript/TypeScript coverage via lcov
   ```properties
   sonar.javascript.lcov.reportPaths=coverage/lcov.info
   sonar.typescript.lcov.reportPaths=coverage/lcov.info
   ```

## Viewing Results

After the analysis runs:

1. Go to your SonarCloud dashboard
2. Navigate to your project
3. View:
   - Code quality metrics
   - Coverage reports
   - Code smells and bugs
   - Security vulnerabilities
   - Technical debt

## Troubleshooting

### Coverage Not Showing

If coverage isn't appearing in SonarCloud:

1. Check that the lcov file is generated: `coverage/lcov.info`
2. Verify paths in the lcov file are relative
3. Ensure the coverage exclusions match your needs

### Analysis Failing

Common issues:

1. **Invalid project key**: Ensure it matches SonarCloud project
2. **Missing token**: Verify `SONAR_TOKEN` secret is set
3. **Build failures**: Check that `npm run build:wasm` succeeds

## Best Practices

1. **Regular Analysis**: Let the automated workflow run on all PRs
2. **Fix Issues Promptly**: Address code smells and bugs as they're found
3. **Monitor Coverage**: Aim to maintain or improve test coverage
4. **Quality Gates**: Configure quality gates in SonarCloud for your standards

## Additional Resources

- [SonarCloud Documentation](https://docs.sonarcloud.io/)
- [SonarCloud GitHub Action](https://github.com/SonarSource/sonarcloud-github-action)
- [TypeScript Analysis](https://docs.sonarcloud.io/digging-deeper/languages/javascript-typescript/)
