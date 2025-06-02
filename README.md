# 🤖 CLIC MMU Auto OTP

**Automatically extracts OTP codes from Outlook and fills them into CLIC MMU login for seamless authentication**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/sofeamza/otp-extractor/releases)

## 🎯 What it does

This Chrome extension automates the tedious OTP login process for CLIC MMU (Multimedia University's student portal). It:

- 🔍 **Automatically scans** your Outlook emails for the latest OTP codes
- 🚀 **Auto-fills** the OTP into CLIC MMU login page
- ⚡ **Instantly logs you in** without manual intervention
- 🔄 **Handles failures** by waiting for new OTP codes
- 🧹 **Cleans up** by automatically closing Outlook tabs after successful login

## 🎬 Demo

![CLIC Auto OTP Demo](demo.gif)

*Extension automatically extracting OTP from Outlook and logging into CLIC MMU*

## ✨ Features

### 🤖 **Fully Automated Workflow**
- Detects when you need to enter OTP on CLIC MMU
- Opens Outlook and scans for the latest verification code
- Fills the OTP and clicks login automatically
- Closes Outlook tabs after successful login

### 🔍 **Smart OTP Detection**
- Scans multiple email formats and layouts
- Prioritizes the most recent OTP codes
- Handles various OTP patterns (4-8 digits)
- Filters out expired or invalid codes

### 🛡️ **Failure Recovery**
- Detects login failures automatically
- Waits for new OTP codes when previous ones fail
- Provides visual feedback throughout the process
- Manual override options available

### ⚙️ **User Control**
- Toggle automation on/off
- Manual OTP extraction button
- Debug mode for troubleshooting
- Visual status indicators

## 🚀 Installation

### Method 1: Load Unpacked (Recommended for now)

1. **Download the extension**
   \`\`\`bash
   git clone https://github.com/sofeamza/otp-extractor.git
   cd clic-mmu-auto-otp
   \`\`\`

2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the downloaded folder
   - The extension should now appear in your extensions list

4. **Pin the extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "CLIC MMU Auto OTP" for easy access

### Method 2: Chrome Web Store (Coming Soon)
*We're working on getting this extension published to the Chrome Web Store for easier installation.*

## 📖 How to Use

### 🎯 **Automatic Mode (Default)**

1. **Navigate to CLIC MMU login page**
   \`\`\`
   https://clic.mmu.edu.my/psp/csprd/?cmd=login&languageCd=ENG&
   \`\`\`

2. **Enter your username and password**

3. **When OTP field appears:**
   - Extension automatically opens Outlook
   - Scans for the latest OTP code
   - Fills the code and logs you in
   - Closes Outlook tabs automatically

### 🔧 **Manual Mode**

1. **Click the extension icon** in your Chrome toolbar
2. **Use the control panel** to:
   - Toggle automation on/off
   - Manually trigger OTP scanning
   - Open Outlook or CLIC directly
   - View current OTP status

### 🐞 **Debug Mode**

If you encounter issues:
1. Click the extension icon
2. Use "Test Automation" to check functionality
3. Check browser console for detailed logs
4. Use manual fill buttons as backup

## ⚙️ Configuration

The extension works out of the box, but you can customize:

- **Auto OTP Detection**: Toggle automatic scanning
- **Auto Login**: Toggle automatic form submission
- **Manual Controls**: Use manual buttons when needed

## 🔧 Technical Details

### **Supported Websites**
- ✅ CLIC MMU (clic.mmu.edu.my)
- ✅ Outlook Office 365 (outlook.office.com)

### **OTP Patterns Detected**
- 4-8 digit verification codes
- Various email formats and layouts
- Context-aware extraction (looks for keywords like "verification", "code", "OTP")

### **Browser Compatibility**
- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- ❌ Firefox (different extension format)

## 🛠️ Development

### **Project Structure**
\`\`\`
clic-mmu-auto-otp/
├── manifest.json          # Extension configuration
├── background.js           # Service worker for automation logic
├── clic-content.js        # CLIC website integration
├── outlook-content.js     # Outlook email scanning
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Styling
└── icons/                 # Extension icons
\`\`\`

### **Key Components**

1. **Background Script** (`background.js`)
   - Manages automation workflow
   - Handles OTP storage and validation
   - Coordinates between CLIC and Outlook tabs

2. **Content Scripts**
   - `clic-content.js`: Detects OTP fields and handles form filling
   - `outlook-content.js`: Scans emails for OTP codes

3. **Popup Interface** (`popup.html/js`)
   - User controls and status display
   - Manual override options
   - Debug information

### **Building from Source**

\`\`\`bash
# Clone the repository
git clone https://github.com/sofeamza/otp-extractor.git
cd clic-mmu-auto-otp

# No build process needed - load directly in Chrome
# Go to chrome://extensions/ and load unpacked
\`\`\`

## 🐛 Troubleshooting

### **Common Issues**

**🔴 Extension not detecting OTP field**
- Ensure you're on the correct CLIC MMU login page
- Try refreshing the page
- Use the manual fill button in the extension popup

**🔴 OTP not found in Outlook**
- Check if you're logged into the correct Outlook account
- Ensure the OTP email has arrived
- Try the manual scan button

**🔴 Login still fails after OTP fill**
- The OTP might have expired - wait for a new one
- Check if the OTP was filled correctly
- Try manual entry as backup

### **Debug Steps**

1. **Check Extension Status**
   - Click extension icon to see current status
   - Look for error messages or warnings

2. **Browser Console**
   - Press F12 to open developer tools
   - Check console for error messages
   - Look for messages starting with "CLIC OTP" or "Auto OTP"

3. **Manual Override**
   - Use manual buttons in extension popup
   - Try disabling and re-enabling automation

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### **Reporting Issues**
- Use GitHub Issues to report bugs
- Include browser version and error messages
- Describe steps to reproduce the problem

### **Feature Requests**
- Suggest improvements via GitHub Issues
- Describe the use case and expected behavior

### **Code Contributions**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This extension is created for educational purposes and to improve user experience. It:
- Does not store or transmit any personal data
- Only works on specified websites (CLIC MMU and Outlook)
- Requires user consent and can be disabled at any time
- Is not affiliated with Multimedia University

**Use at your own discretion and ensure compliance with your institution's policies.**

## 🙏 Acknowledgments

- Thanks to MMU students who inspired this automation
- Built with Chrome Extension Manifest V3
- Uses modern web APIs for reliable functionality

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/sofeamza/otp-extractor/issues)
- 📧 **Contact**: sofeamza@gmail.com

---

**⭐ If this extension helps you, please give it a star on GitHub!**

Made with ❤️ for MMU students
\`\`\`

```text file="LICENSE"
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
