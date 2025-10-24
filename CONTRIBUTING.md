# Contributing to Bonk.fun Volume Bot

Thank you for your interest in contributing to the Bonk.fun Volume Bot! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

## 🤝 Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- Yarn package manager
- Git
- Basic understanding of TypeScript and Solana development

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/your-username/bonk-volume-bot.git
cd bonk-volume-bot
```

3. Add the upstream repository:
```bash
git remote add upstream https://github.com/NovusTechLLC/bonk-volume-bot.git
```

## 🛠️ Development Setup

### Installation

```bash
# Install dependencies
yarn install

# Copy environment configuration
cp env.example .env

# Build the project
yarn build
```

### Development Workflow

```bash
# Start development server with hot reload
yarn dev

# Run linting
yarn lint

# Fix linting issues
yarn lint:fix

# Run tests
yarn test

# Run tests with coverage
yarn test:coverage
```

## 📝 Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- **Bug Fixes**: Fix issues and improve stability
- **Feature Additions**: Add new functionality
- **Documentation**: Improve documentation and examples
- **Testing**: Add or improve test coverage
- **Performance**: Optimize performance and efficiency
- **Security**: Improve security measures

### Before Contributing

1. **Check Existing Issues**: Look for existing issues or discussions
2. **Create an Issue**: For significant changes, create an issue first
3. **Discuss Changes**: For major features, discuss the approach
4. **Follow Standards**: Ensure your code follows project standards

## 🔄 Pull Request Process

### Creating a Pull Request

1. **Create a Branch**:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

2. **Make Your Changes**:
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed
   - Follow the coding standards

3. **Test Your Changes**:
```bash
# Run all tests
yarn test

# Check linting
yarn lint

# Build the project
yarn build
```

4. **Commit Your Changes**:
```bash
git add .
git commit -m "feat: add new feature description"
# or
git commit -m "fix: resolve issue description"
```

5. **Push and Create PR**:
```bash
git push origin feature/your-feature-name
```

### Pull Request Template

When creating a pull request, please include:

- **Description**: Clear description of changes
- **Type**: Bug fix, feature, documentation, etc.
- **Testing**: How you tested the changes
- **Breaking Changes**: Any breaking changes
- **Related Issues**: Link to related issues

## 📏 Code Standards

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type unless absolutely necessary
- Use generic types appropriately

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Use meaningful variable and function names
- Write self-documenting code
- Add JSDoc comments for public APIs

### File Organization

```
src/
├── core/           # Core business logic
├── engines/        # Trading engines
├── managers/       # Resource managers
├── utils/          # Utility functions
├── types/          # Type definitions
├── test/           # Test files
└── index.ts        # Entry point
```

### Naming Conventions

- **Files**: Use PascalCase for classes, camelCase for utilities
- **Variables**: Use camelCase
- **Constants**: Use UPPER_SNAKE_CASE
- **Interfaces**: Use PascalCase with descriptive names
- **Enums**: Use PascalCase

## 🧪 Testing Requirements

### Test Coverage

- **Minimum Coverage**: 70% for all metrics
- **New Code**: Must have tests for new functionality
- **Bug Fixes**: Must include regression tests
- **Critical Paths**: Must have comprehensive test coverage

### Test Types

- **Unit Tests**: Test individual functions and methods
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows
- **Performance Tests**: Test performance characteristics

### Writing Tests

```typescript
// Example test structure
describe('TradingEngine', () => {
  describe('executeSession', () => {
    it('should execute trading session successfully', async () => {
      // Test implementation
    });

    it('should handle errors gracefully', async () => {
      // Error handling test
    });
  });
});
```

## 📚 Documentation

### Code Documentation

- **JSDoc Comments**: Document all public APIs
- **Inline Comments**: Explain complex logic
- **README Updates**: Update documentation for new features
- **API Documentation**: Keep API docs current

### Documentation Standards

```typescript
/**
 * Executes a trading session with the given configuration.
 * 
 * @param session - The trading session to execute
 * @returns Promise that resolves when the session is complete
 * @throws {BotError} When session execution fails
 */
async executeSession(session: TradingSession): Promise<void> {
  // Implementation
}
```

## 🔍 Review Process

### Code Review Checklist

- [ ] Code follows project standards
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance implications considered
- [ ] Security implications considered
- [ ] Error handling is appropriate

### Review Guidelines

- Be constructive and respectful
- Focus on the code, not the person
- Suggest improvements, don't just point out problems
- Ask questions if something is unclear
- Approve when you're confident in the changes

## 🐛 Bug Reports

### Reporting Bugs

When reporting bugs, please include:

1. **Clear Description**: What the bug is
2. **Steps to Reproduce**: How to reproduce the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, Node.js version, etc.
6. **Logs**: Relevant error logs or output

### Bug Report Template

```markdown
## Bug Description
Brief description of the bug.

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., Windows 10, macOS 12, Ubuntu 20.04]
- Node.js: [e.g., 18.17.0]
- Yarn: [e.g., 1.22.19]

## Additional Context
Any other relevant information.
```

## ✨ Feature Requests

### Requesting Features

When requesting features, please include:

1. **Clear Description**: What the feature should do
2. **Use Case**: Why this feature is needed
3. **Proposed Solution**: How you think it should work
4. **Alternatives**: Other approaches considered
5. **Additional Context**: Any other relevant information

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check the README and wiki
- **Code Comments**: Look at inline documentation

## 🎉 Recognition

Contributors will be recognized in:

- **CONTRIBUTORS.md**: List of all contributors
- **Release Notes**: Mentioned in release notes
- **GitHub**: Listed as contributors on GitHub

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to the Bonk.fun Volume Bot! 🚀
