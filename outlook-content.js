// Enhanced Outlook OTP extractor with improved scanning

class OutlookOTPExtractor {
  constructor() {
    this.otpPattern = /\b\d{4,8}\b/g
    this.specificPatterns = [
      /verification code[:\s]*(\d{4,8})/i,
      /authentication code[:\s]*(\d{4,8})/i,
      /login code[:\s]*(\d{4,8})/i,
      /security code[:\s]*(\d{4,8})/i,
      /OTP[:\s]*(\d{4,8})/i,
      /one.time.password[:\s]*(\d{4,8})/i,
      /code[:\s]*(\d{4,8})/i,
      /passcode[:\s]*(\d{4,8})/i,
    ]
    this.autoScanInterval = null
    this.foundOTPs = new Map()
    this.waitingForNewOTP = false
    this.failedOTP = null
    this.intensiveScanInterval = null
    this.waitingStartTime = null
    this.lastScanTime = 0
    this.init()
  }

  init() {
    console.log("CLIC OTP Extractor: Initializing on Outlook Office...")

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.startMonitoring())
    } else {
      this.startMonitoring()
    }

    // Listen for messages
    window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "autoScanOTP" || request.action === "autoScanLatestOTP") {
        this.performLatestOTPScan()
        sendResponse({ success: true })
        return true
      } else if (request.action === "waitForNewOTP") {
        this.startWaitingForNewOTP(request.failedOTP)
        sendResponse({ success: true })
        return true
      }
    })
  }

  startMonitoring() {
    console.log("CLIC OTP Extractor: Monitoring for LATEST OTP codes...")

    // Initial scan with delay to ensure page is loaded
    setTimeout(() => this.scanForLatestOTP(), 1000)

    this.setupContinuousMonitoring()
    this.addEnhancedUI()

    // Force an immediate intensive scan
    setTimeout(() => this.performLatestOTPScan(), 2000)
  }

  startWaitingForNewOTP(failedOTP) {
    console.log("CLIC OTP Extractor: Starting to wait for new OTP after failure:", failedOTP)

    this.waitingForNewOTP = true
    this.failedOTP = failedOTP
    this.waitingStartTime = Date.now()

    // Update UI to show waiting state
    this.updateStatusForWaiting()

    // Start intensive scanning for new emails
    this.startIntensiveScanning()

    // Try to refresh inbox
    this.refreshInbox()
  }

  updateStatusForWaiting() {
    const indicator = document.getElementById("otpStatusIndicator")
    if (indicator) {
      indicator.textContent = "⏳ Waiting for New OTP..."
      indicator.style.background = "#FF9800"
    }

    this.showOTPNotification("Waiting for new OTP after login failure...", "warning")
  }

  startIntensiveScanning() {
    // Clear existing interval
    if (this.intensiveScanInterval) {
      clearInterval(this.intensiveScanInterval)
    }

    // Scan every 2 seconds when waiting for new OTP
    this.intensiveScanInterval = setInterval(() => {
      if (this.waitingForNewOTP) {
        this.scanForLatestOTP(true) // Force scan

        // Occasionally refresh inbox
        if (Math.random() < 0.1) {
          // 10% chance each scan
          this.refreshInbox()
        }
      } else {
        clearInterval(this.intensiveScanInterval)
      }
    }, 2000)
  }

  setupContinuousMonitoring() {
    // Monitor for DOM changes that might indicate new emails
    const observer = new MutationObserver((mutations) => {
      // Throttle to avoid too many scans
      const now = Date.now()
      if (now - this.lastScanTime > 1000) {
        // At most once per second
        this.lastScanTime = now
        this.scanForLatestOTP()
      }
    })

    const targets = [
      document.querySelector('[role="main"]'),
      document.querySelector(".ReadingPaneContent"),
      document.querySelector('[data-app-section="ReadingPane"]'),
      document.body,
    ].filter(Boolean)

    targets.forEach((target) => {
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    })

    // Regular scanning every 3 seconds
    this.autoScanInterval = setInterval(() => this.scanForLatestOTP(), 3000)
  }

  addEnhancedUI() {
    // Latest OTP scan button
    const scanButton = document.createElement("button")
    scanButton.textContent = "🔍 Scan Latest OTP"
    scanButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0078d4;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `

    scanButton.addEventListener("click", () => {
      this.performLatestOTPScan()
    })

    document.body.appendChild(scanButton)

    // Status indicator
    const indicator = document.createElement("div")
    indicator.id = "otpStatusIndicator"
    indicator.textContent = "🔍 Scanning for Latest OTP..."
    indicator.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      background: #0078d4;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `

    document.body.appendChild(indicator)

    // Debug button
    const debugButton = document.createElement("button")
    debugButton.textContent = "🐞 Debug OTP"
    debugButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 180px;
      background: #FF9800;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `

    debugButton.addEventListener("click", () => {
      this.debugOTPScan()
    })

    document.body.appendChild(debugButton)
  }

  debugOTPScan() {
    console.log("Running OTP debug scan...")

    const debugResults = {
      emailElements: 0,
      clicRelatedEmails: 0,
      otpCandidates: [],
      latestOTP: null,
      allText: [],
    }

    // Get all potential email elements
    const emailElements = this.getEmailElements()
    debugResults.emailElements = emailElements.length

    this.showOTPNotification(`Scanning ${emailElements.length} elements for OTP codes...`, "info")

    // Process each element
    for (const element of emailElements) {
      const content = element.textContent || element.innerText || ""
      if (content.trim()) {
        // Store first 100 chars of content for debugging
        if (debugResults.allText.length < 10) {
          debugResults.allText.push(content.substring(0, 100))
        }

        if (this.isClicRelatedEmail(content)) {
          debugResults.clicRelatedEmails++

          // Extract OTP
          const otp = this.extractOTP(content)
          if (otp) {
            const timestamp = this.extractTimestamp(element) || Date.now()
            debugResults.otpCandidates.push({
              otp,
              timestamp,
              timeString: new Date(timestamp).toLocaleTimeString(),
            })
          }
        }
      }
    }

    // Sort candidates by timestamp
    if (debugResults.otpCandidates.length > 0) {
      debugResults.otpCandidates.sort((a, b) => b.timestamp - a.timestamp)
      debugResults.latestOTP = debugResults.otpCandidates[0]
    }

    // Log debug results
    console.log("OTP Debug Results:", debugResults)

    // Show debug notification
    if (debugResults.latestOTP) {
      this.showOTPNotification(
        `Debug: Found ${debugResults.otpCandidates.length} OTPs. Latest: ${debugResults.latestOTP.otp} (${debugResults.latestOTP.timeString})`,
        "success",
      )

      // Force send this OTP
      this.handleLatestOTPFound({
        otp: debugResults.latestOTP.otp,
        timestamp: debugResults.latestOTP.timestamp,
        content: "Debug OTP extraction",
      })
    } else {
      this.showOTPNotification(
        `Debug: No OTPs found. Scanned ${debugResults.emailElements} elements, ${debugResults.clicRelatedEmails} CLIC-related.`,
        "warning",
      )
    }
  }

  scanForLatestOTP(forceScan = false) {
    // Get all potential email elements
    const emailElements = this.getEmailElements()
    const otpCandidates = []

    // Process each element
    for (const element of emailElements) {
      const emailData = this.extractEmailData(element)
      if (emailData && this.isClicRelatedEmail(emailData.content)) {
        const otp = this.extractOTP(emailData.content)
        if (otp) {
          // If waiting for new OTP, skip the failed one
          if (this.waitingForNewOTP && otp === this.failedOTP) {
            continue
          }

          otpCandidates.push({
            otp: otp,
            timestamp: emailData.timestamp,
            content: emailData.content,
            element: element,
          })
        }
      }
    }

    // If we found OTP candidates
    if (otpCandidates.length > 0) {
      // Sort by timestamp (newest first)
      otpCandidates.sort((a, b) => b.timestamp - a.timestamp)
      const latestOTP = otpCandidates[0]

      // If waiting for new OTP, ensure this is actually newer
      if (this.waitingForNewOTP && this.waitingStartTime) {
        // Check if this OTP is significantly newer than when we started waiting
        const timeSinceWaiting = Date.now() - this.waitingStartTime
        if (timeSinceWaiting < 30000 && !forceScan) {
          // Less than 30 seconds and not a forced scan
          console.log("OTP found but too soon after failure, continuing to wait...")
          return
        }
      }

      console.log("Latest OTP found:", latestOTP.otp, "Timestamp:", new Date(latestOTP.timestamp))

      // Check if this is a new OTP we haven't seen before or if it's a forced scan
      const otpKey = `${latestOTP.otp}-${latestOTP.timestamp}`
      if (!this.foundOTPs.has(otpKey) || forceScan) {
        if (!this.foundOTPs.has(otpKey)) {
          this.foundOTPs.set(otpKey, Date.now())
        }

        // If we were waiting for new OTP, reset the state
        if (this.waitingForNewOTP) {
          this.waitingForNewOTP = false
          this.failedOTP = null

          if (this.intensiveScanInterval) {
            clearInterval(this.intensiveScanInterval)
          }
        }

        this.handleLatestOTPFound(latestOTP)
        this.cleanupOldOTPs()
      }
    } else if (forceScan) {
      // If this was a forced scan and we found nothing, try refreshing
      this.refreshInbox()
    }
  }

  getEmailElements() {
    // More comprehensive selectors to find email content
    const selectors = [
      // Email list items
      '[role="listitem"]',
      ".ms-List-cell",
      "[data-selection-index]",

      // Reading pane content
      ".ReadingPaneContent",
      '[role="complementary"]',
      '[data-app-section="ReadingPane"]',

      // Email body content
      ".allowTextSelection",
      '[role="region"][aria-label*="Message body"]',
      '[role="document"]',

      // Conversation containers
      ".ConversationReadingPaneContainer",

      // General content areas
      '[role="main"] [role="group"]',
      ".ContentContainer",

      // Additional Outlook-specific selectors
      ".x_owaParaTag",
      ".x_owaContentWrapper",
      "[aria-label*='Message body']",
      "[aria-label*='Content']",
      ".elementToProof",
      ".rps_4499",
      ".rps_b6c3",
    ]

    // Get all elements matching our selectors
    const elements = []
    for (const selector of selectors) {
      try {
        elements.push(...document.querySelectorAll(selector))
      } catch (e) {
        // Some selectors might be invalid, ignore errors
      }
    }

    return elements
  }

  extractEmailData(element) {
    const content = element.textContent || element.innerText || ""
    if (!content.trim()) return null

    let timestamp = this.extractTimestamp(element)
    if (!timestamp) {
      timestamp = Date.now()
    }

    return {
      content: content,
      timestamp: timestamp,
    }
  }

  extractTimestamp(element) {
    const timeSelectors = [
      '[title*="202"]',
      '[aria-label*="202"]',
      "time",
      "[datetime]",
      '.ms-TooltipHost[title*="202"]',
      "[data-time]",
      '[title*="AM"]',
      '[title*="PM"]',
      '[aria-label*="AM"]',
      '[aria-label*="PM"]',
    ]

    let currentElement = element
    for (let i = 0; i < 5 && currentElement; i++) {
      for (const selector of timeSelectors) {
        try {
          const timeElement =
            currentElement.querySelector(selector) ||
            (currentElement.matches && currentElement.matches(selector) ? currentElement : null)

          if (timeElement) {
            const timeStr =
              timeElement.getAttribute("title") ||
              timeElement.getAttribute("aria-label") ||
              timeElement.getAttribute("datetime") ||
              timeElement.textContent

            const parsedTime = this.parseTimeString(timeStr)
            if (parsedTime) {
              return parsedTime
            }
          }
        } catch (e) {
          // Ignore errors in selector matching
        }
      }
      currentElement = currentElement.parentElement
    }

    const timeMatch = element.textContent.match(
      /(\d{1,2}:\d{2}\s*(AM|PM))|(\d{4}-\d{2}-\d{2})|(\w+\s+\d{1,2},?\s+\d{4})/i,
    )
    if (timeMatch) {
      const parsedTime = this.parseTimeString(timeMatch[0])
      if (parsedTime) {
        return parsedTime
      }
    }

    return null
  }

  parseTimeString(timeStr) {
    if (!timeStr) return null

    try {
      const date = new Date(timeStr)
      if (!isNaN(date.getTime())) {
        return date.getTime()
      }

      const relativeMatch = timeStr.match(/(\d+)\s*(minute|hour|second)s?\s*ago/i)
      if (relativeMatch) {
        const amount = Number.parseInt(relativeMatch[1])
        const unit = relativeMatch[2].toLowerCase()
        const now = Date.now()

        switch (unit) {
          case "second":
            return now - amount * 1000
          case "minute":
            return now - amount * 60 * 1000
          case "hour":
            return now - amount * 60 * 60 * 1000
        }
      }

      const timeOnlyMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (timeOnlyMatch) {
        const today = new Date()
        let hours = Number.parseInt(timeOnlyMatch[1])
        const minutes = Number.parseInt(timeOnlyMatch[2])
        const ampm = timeOnlyMatch[3].toUpperCase()

        if (ampm === "PM" && hours !== 12) hours += 12
        if (ampm === "AM" && hours === 12) hours = 0

        today.setHours(hours, minutes, 0, 0)
        return today.getTime()
      }
    } catch (error) {
      console.log("Error parsing time string:", timeStr, error)
    }

    return null
  }

  isClicRelatedEmail(text) {
    // Expanded keywords for better detection
    const clicKeywords = [
      "mmu",
      "multimedia university",
      "clic",
      "student portal",
      "authentication",
      "verification",
      "login",
      "access",
      "account",
      "security",
      "code",
      "otp",
      "one-time",
      "password",
      "verification code",
      "authentication code",
      "login code",
      "security code",
      "passcode",
    ]

    const lowerText = text.toLowerCase()
    return clicKeywords.some((keyword) => lowerText.includes(keyword))
  }

  extractOTP(text) {
    // Try specific patterns first
    for (const pattern of this.specificPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const extractedOTP = match[1].trim()
        console.log("OTP extracted using specific pattern:", extractedOTP)
        return extractedOTP
      }
    }

    // Context-aware extraction
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      const isOTPLine = [
        "code",
        "otp",
        "password",
        "verification",
        "authenticate",
        "login",
        "access",
        "security",
        "one-time",
      ].some((keyword) => lowerLine.includes(keyword))

      if (isOTPLine) {
        const numbers = line.match(this.otpPattern)
        if (numbers && numbers.length > 0) {
          const otpCandidates = numbers.filter((num) => num.length >= 4 && num.length <= 8 && !this.isLikelyNotOTP(num))
          if (otpCandidates.length > 0) {
            console.log("OTP extracted from OTP line:", otpCandidates[0])
            return otpCandidates[0].trim()
          }
        }
      }
    }

    // Last resort: look for standalone numbers that match OTP patterns
    const allNumbers = text.match(this.otpPattern)
    if (allNumbers) {
      // Filter for likely OTP codes (4-8 digits)
      const otpCandidates = allNumbers.filter((num) => num.length >= 4 && num.length <= 8 && !this.isLikelyNotOTP(num))
      if (otpCandidates.length > 0) {
        console.log("OTP extracted from all numbers:", otpCandidates[0])
        return otpCandidates[0].trim()
      }
    }

    return null
  }

  isLikelyNotOTP(number) {
    const excludePatterns = [
      /^(19|20)\d{2}$/,
      /^0+$/,
      /^1+$/,
      /^(123|1234|12345|123456)$/,
      /^(111|222|333|444|555|666|777|888|999|1111|2222|3333|4444|5555|6666|7777|8888|9999)$/,
    ]

    return excludePatterns.some((pattern) => pattern.test(number))
  }

  handleLatestOTPFound(otpData) {
    console.log("LATEST OTP found:", otpData.otp, "at", new Date(otpData.timestamp))

    // Ensure OTP is properly formatted
    const cleanOTP = String(otpData.otp).trim()
    console.log("Cleaned OTP:", cleanOTP, "Length:", cleanOTP.length)

    // Log each character for debugging
    console.log("OTP characters:", Array.from(cleanOTP).join(", "))

    const indicator = document.getElementById("otpStatusIndicator")
    if (indicator) {
      if (this.waitingForNewOTP) {
        indicator.textContent = `✅ New OTP Found: ${cleanOTP}`
        indicator.style.background = "#4CAF50"
      } else {
        indicator.textContent = `✅ Latest OTP: ${cleanOTP}`
        indicator.style.background = "#4CAF50"
      }
    }

    window.chrome.runtime.sendMessage(
      {
        action: "otpFound",
        otp: cleanOTP,
        context: otpData.content ? otpData.content.substring(0, 200) : "OTP extraction",
        timestamp: Date.now(),
        emailTimestamp: otpData.timestamp,
      },
      (response) => {
        if (response && response.success) {
          const message = this.waitingForNewOTP
            ? `✅ New OTP found after failure: ${cleanOTP}`
            : `✅ Latest OTP extracted: ${cleanOTP}`
          this.showOTPNotification(message, "success")
        }
      },
    )
  }

  performLatestOTPScan() {
    console.log("Performing intensive latest OTP scan...")

    const indicator = document.getElementById("otpStatusIndicator")
    if (indicator) {
      indicator.textContent = "🔍 Intensive Scanning..."
      indicator.style.background = "#0078d4"
    }

    this.showOTPNotification("Performing intensive scan for latest OTP...", "info")

    // Immediate scan
    this.scanForLatestOTP(true) // Force scan

    // Multiple scans with delays
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        this.scanForLatestOTP(true) // Force scan

        // Refresh inbox during the scan sequence
        if (i === 2) {
          this.refreshInbox()
        }
      }, i * 1000)
    }
  }

  refreshInbox() {
    const refreshSelectors = [
      '[aria-label*="Refresh" i]',
      '[title*="Refresh" i]',
      '.ms-Button[aria-label*="Refresh"]',
      '[data-testid*="refresh" i]',
      '[name*="refresh" i]',
      'button:has(svg[data-icon-name="Refresh"])',
    ]

    for (const selector of refreshSelectors) {
      try {
        const refreshBtn = document.querySelector(selector)
        if (refreshBtn) {
          console.log("Refreshing inbox for new emails...")
          refreshBtn.click()

          // Show notification
          this.showOTPNotification("Refreshing inbox for new emails...", "info")
          return
        }
      } catch (e) {
        // Some selectors might be invalid, ignore errors
      }
    }

    console.log("Could not find refresh button")
  }

  cleanupOldOTPs() {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000

    for (const [key, timestamp] of this.foundOTPs.entries()) {
      if (now - timestamp > maxAge) {
        this.foundOTPs.delete(key)
      }
    }
  }

  showOTPNotification(text, type = "info") {
    const colors = {
      success: "#4CAF50",
      warning: "#FF9800",
      info: "#2196F3",
      error: "#F44336",
    }

    const notification = document.createElement("div")
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      max-width: 300px;
    `
    notification.textContent = text

    document.body.appendChild(notification)

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 5000)
  }
}

// Initialize the enhanced OTP extractor
new OutlookOTPExtractor()
