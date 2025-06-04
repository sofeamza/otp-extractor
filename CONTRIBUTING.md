# Contributing to CLIC MMU Auto OTP

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to CLIC MMU Auto OTP. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Code Contribution](#code-contribution)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots if possible**
- **Include your browser version and operating system**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Code Contribution

#### Development Setup

1. Fork the repository
2. Clone your fork:  
   git clone https://github.com/sofeamza/otp-extractor.git  
   cd clic-mmu-auto-otp  
3. Load the extension in Chrome:  
   - Go to `chrome://extensions/`  
   - Enable "Developer mode"  
   - Click "Load unpacked" and select the project folder  

#### Making Changes

1. Create a new branch for your feature:  
   git checkout -b feature/your-feature-name  
2. Make your changes  
3. Test your changes thoroughly
4. Commit your changes:  
   git commit -m "Add your descriptive commit message"  
5. Push to your fork:  
   git push origin feature/your-feature-name  
6. Create a Pull Request

## Style Guidelines

### JavaScript Style Guide

- Use modern ES6+ syntax
- Use meaningful variable and function names
- Add comments for complex logic
- Follow existing code formatting
- Use console.log with descriptive prefixes for debugging

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### File Structure

- Keep files organized according to the existing structure
- Add new features in appropriate files
- Update manifest.json if adding new permissions or files

## Testing

Before submitting a pull request:

1. Test the extension on CLIC MMU login page
2. Test OTP detection with real Outlook emails
3. Test both automatic and manual modes
4. Verify error handling and edge cases
5. Check browser console for any errors

## Questions?

Feel free to open an issue with the "question" label if you have any questions about contributing!

Thank you for contributing! 🚀
