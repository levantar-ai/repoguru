# Contributing to RepoGuru

Thank you for your interest in contributing to RepoGuru! This document provides guidelines and instructions for contributing.

## How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/my-feature`)
3. **Commit** your changes (`git commit -m 'feat: add my feature'`)
4. **Push** to your branch (`git push origin feature/my-feature`)
5. **Open** a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/repoguru.git
cd repoguru

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start development server            |
| `npm run build`        | Type-check and build for production |
| `npm run lint`         | Run ESLint                          |
| `npm run format`       | Format code with Prettier           |
| `npm run format:check` | Check formatting                    |
| `npm run test`         | Run tests                           |
| `npm run typecheck`    | Run TypeScript type checking        |

## Code Style

- We use **Prettier** for formatting and **ESLint** for linting
- Pre-commit hooks automatically format staged files
- Use TypeScript strict mode throughout
- Follow existing naming conventions and file organization

## Pull Request Process

1. Ensure your code compiles (`npm run build`)
2. Ensure linting passes (`npm run lint`)
3. Ensure formatting is correct (`npm run format:check`)
4. Ensure tests pass (`npm run test`)
5. Update documentation if applicable
6. Fill out the PR template completely

## Reporting Issues

- Use the [bug report template](https://github.com/repoguru/repoguru/issues/new?template=bug_report.yml) for bugs
- Use the [feature request template](https://github.com/repoguru/repoguru/issues/new?template=feature_request.yml) for new ideas

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
