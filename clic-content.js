// Auto CLIC content script with enhanced OTP filling

class AutoClicOTPHelper {
  constructor() {
    this.otpInput = null
    this.loginButton = null
    this.automationEnabled = true
    this.lastFilledOTP = null
    this.isMonitoringForFailure = false
    this.failureCheckTimeout = null
    this.successCheckInterval = null
    this.loginStartTime = null
    this.otpRequestDelay = 3000 // 3 seconds delay before requesting OTP
    this.init()
  }

  init() {
    console.log("Auto CLIC OTP Helper: Initializing...")

    // Get automation state
    chrome.runtime.sendMessage({ action: "getAutomationState" }, (response) => {
      if (response) {
        this.automationEnabled = response.isEnabled
      }
    })

    // Wait for page to load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupHelper())
    } else {
      this.setupHelper()
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "autoFillOTP") {
        console.log("RECEIVED OTP MESSAGE:", request.otp)
        this.autoFillAndLogin(request.otp, request.isRetry)
        sendResponse({ success: true })
        return true
      } else if (request.action === "checkLoginStatus") {
        const status = this.checkLoginSuccess()
        sendResponse({ success: status.success, redirected: status.redirected })
        return true
      }
    })
  }

  setupHelper() {
    console.log("🔍 Setting up CLIC helper...")

    // Find OTP input and login button
    this.findOTPInput()
    this.findLoginButton()

    console.log("Found OTP input:", !!this.otpInput)
    console.log("Found login button:", !!this.loginButton)

    if (this.otpInput && this.automationEnabled) {
      // Auto-detect when OTP input becomes visible/required
      this.monitorOTPInput()

      // Add a manual fill button
      this.addManualFillButton()
    }

    // Monitor for dynamic content changes
    this.observePageChanges()

    // Monitor for login failures
    this.setupFailureDetection()

    // Check if we're already on a post-login page
    this.checkInitialLoginState()

    // Add debug info to page
    this.addDebugInfo()
  }

  addDebugInfo() {
    const debugDiv = document.createElement("div")
    debugDiv.id = "clicDebugInfo"
    debugDiv.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
    `

    const updateDebugInfo = () => {
      const otpInputInfo = this.otpInput
        ? {
            tag: this.otpInput.tagName,
            type: this.otpInput.type,
            name: this.otpInput.name,
            id: this.otpInput.id,
            placeholder: this.otpInput.placeholder,
            value: this.otpInput.value,
            visible: this.isVisible(this.otpInput),
          }
        : "Not found"

      debugDiv.innerHTML = `
        <div><strong>CLIC OTP Debug</strong></div>
        <div>URL: ${window.location.href}</div>
        <div>OTP Input: ${JSON.stringify(otpInputInfo, null, 2)}</div>
        <div>Login Button: ${this.loginButton ? "Found" : "Not found"}</div>
        <div>Last OTP: ${this.lastFilledOTP || "None"}</div>
      `
    }

    updateDebugInfo()
    setInterval(updateDebugInfo, 2000)

    document.body.appendChild(debugDiv)
      debugDiv.style.display = "none"
  }

  checkInitialLoginState() {
    // If we're already on what looks like a post-login page
    if (this.isLikelyLoggedIn()) {
      console.log("Auto CLIC: Already appears to be logged in")
      this.notifyLoginSuccess()
    }
  }

  isLikelyLoggedIn() {
    // Check for common indicators of being logged in
    const notLoginPage = !window.location.href.includes("login") && !window.location.href.includes("signin")
    const hasUserMenu = !!document.querySelector(
      '[aria-label*="user" i], [class*="user" i], [id*="user" i], [class*="account" i], [id*="account" i]',
    )
    const noLoginForm = !document.querySelector('form[action*="login" i], form[action*="auth" i]')
    Array.from(document.querySelectorAll('a[href*="logout" i], button')).find(el =>
      /logout|sign out/i.test(el.textContent)
    )
    const hasDashboard = !!document.querySelector(
      '[class*="dashboard" i], [id*="dashboard" i], [class*="home" i], [id*="home" i]',
    )

    const hasLogoutButton = !!Array.from(document.querySelectorAll('a[href*="logout" i], button')).find(el =>
        /logout|sign out/i.test(el.textContent)
      )


    // If several indicators suggest we're logged in
    return (
      (notLoginPage && (hasUserMenu || hasLogoutButton || hasDashboard)) ||
      (notLoginPage && noLoginForm) ||
      hasLogoutButton
    )
  }

  setupFailureDetection() {
    // Monitor for error messages that indicate OTP failure
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          this.checkForLoginFailure()
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Also check for URL changes that might indicate failure or success
    let lastUrl = window.location.href
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        this.checkForLoginFailure()
        this.checkLoginSuccess()
      }
    }, 1000)
  }

  checkForLoginFailure() {
    if (!this.isMonitoringForFailure || !this.lastFilledOTP) return

    // Look for error messages
    const errorSelectors = [
      ".error",
      ".alert-danger",
      ".alert-error",
      '[class*="error" i]',
      '[class*="invalid" i]',
      '[class*="fail" i]',
      '[id*="error" i]',
      '[role="alert"]',
    ]

    let foundError = false
    for (const selector of errorSelectors) {
      const errorElements = document.querySelectorAll(selector)
      for (const element of errorElements) {
        const text = element.textContent.toLowerCase()
        if (
          text.includes("invalid") ||
          text.includes("incorrect") ||
          text.includes("wrong") ||
          text.includes("expired") ||
          text.includes("error") ||
          text.includes("fail")
        ) {
          foundError = true
          break
        }
      }
      if (foundError) break
    }

    // Check if OTP input is still visible (might indicate failure)
    const otpStillVisible = this.otpInput && this.isVisible(this.otpInput) && this.otpInput.value === this.lastFilledOTP

    // Check if we're still on the same page (successful login usually redirects)
    const stillOnLoginPage =
      window.location.href.includes("login") || document.querySelector('input[type="password"]') || this.otpInput

    if (
      foundError ||
      (otpStillVisible && stillOnLoginPage && this.loginStartTime && Date.now() - this.loginStartTime > 8000)
    ) {
      console.log("Auto CLIC: Login failure detected for OTP:", this.lastFilledOTP)
      this.handleLoginFailure()
    }
  }

  checkLoginSuccess() {
    // If we're not monitoring for login status
    if (!this.loginStartTime) {
      return { success: false, redirected: false }
    }

    // Check if enough time has passed since login attempt
    const timeSinceLogin = Date.now() - this.loginStartTime
    if (timeSinceLogin < 2000) {
      return { success: false, redirected: false }
    }

    // Check for URL change indicating success
    const notOnLoginPage = !window.location.href.includes("login") && !window.location.href.includes("signin")

    // Check for common success indicators
    const hasUserMenu = !!document.querySelector(
      '[aria-label*="user" i], [class*="user" i], [id*="user" i], [class*="account" i], [id*="account" i]',
    )
    const noLoginForm = !document.querySelector('form[action*="login" i], form[action*="auth" i]')
    const hasLogoutButton = !!document.querySelector(
      'a[href*="logout" i], button:contains("logout"), button:contains("sign out")',
    )
    const hasDashboard = !!document.querySelector(
      '[class*="dashboard" i], [id*="dashboard" i], [class*="home" i], [id*="home" i]',
    )
    const noOtpInput = !this.otpInput || !this.isVisible(this.otpInput)

    // If several indicators suggest we're logged in
    const success =
      (notOnLoginPage && (hasUserMenu || hasLogoutButton || hasDashboard || noLoginForm)) ||
      hasLogoutButton ||
      (notOnLoginPage && noOtpInput && timeSinceLogin > 3000) // Give more time for page to load

    if (success) {
      console.log("Auto CLIC: Login success detected!")
      this.notifyLoginSuccess()
      return { success: true, redirected: notOnLoginPage }
    }

    return { success: false, redirected: notOnLoginPage }
  }

  notifyLoginSuccess() {
    // Clear monitoring state
    this.isMonitoringForFailure = false
    this.loginStartTime = null

    if (this.successCheckInterval) {
      clearInterval(this.successCheckInterval)
      this.successCheckInterval = null
    }

    if (this.failureCheckTimeout) {
      clearTimeout(this.failureCheckTimeout)
      this.failureCheckTimeout = null
    }

    console.log("Auto CLIC: Login success detected, notifying background script...")

    // Immediately notify background script about successful login - NO SUCCESS MESSAGES
    chrome.runtime.sendMessage(
      {
        action: "loginSuccess",
        otp: this.lastFilledOTP,
        timestamp: Date.now(),
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log("Error notifying login success:", chrome.runtime.lastError)
          // Try again after a short delay
          setTimeout(() => {
            chrome.runtime.sendMessage({
              action: "loginSuccess",
              otp: this.lastFilledOTP,
              timestamp: Date.now(),
            })
          }, 1000)
        } else {
          console.log("Auto CLIC: Successfully notified background script of login success")
        }
      },
    )

    // Clear the last filled OTP
    this.lastFilledOTP = null

    // Remove any waiting message
    const waitingMessage = document.getElementById("waitingForNewOTP")
    if (waitingMessage) {
      waitingMessage.remove()
    }

    // Force another notification attempt after delay (backup)
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "forceCleanup",
        reason: "delayed_cleanup",
      })
    }, 2000)
  }

  handleLoginFailure() {
    if (!this.lastFilledOTP) return

    this.isMonitoringForFailure = false
    this.loginStartTime = null

    // Clear monitoring intervals
    if (this.successCheckInterval) {
      clearInterval(this.successCheckInterval)
      this.successCheckInterval = null
    }

    // Clear the failed OTP from input
    if (this.otpInput) {
      this.otpInput.value = ""
    }

    console.log(`Auto CLIC: OTP ${this.lastFilledOTP} failed. Fetching latest OTP...`)

    // Notify background script about the failure
    chrome.runtime.sendMessage({
      action: "otpFailed",
      failedOTP: this.lastFilledOTP,
    })

    // Clear the last filled OTP
    this.lastFilledOTP = null

    // Show waiting message
    this.showWaitingForNewOTPMessage()
  }

  showWaitingForNewOTPMessage() {
    const waitingMessage = document.createElement("div")
    waitingMessage.id = "waitingForNewOTP"
    waitingMessage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #FF9800;
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      max-width: 400px;
    `
    waitingMessage.innerHTML = `
      <div>Fetching Latest OTP</div>
      <div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">
        Previous OTP failed. Getting fresh code from Outlook...
      </div>
    `

    // Remove any existing waiting message
    const existing = document.getElementById("waitingForNewOTP")
    if (existing) {
      existing.remove()
    }

    document.body.appendChild(waitingMessage)
  }

  findOTPInput() {
    console.log("🔍 Searching for OTP input field...")

    // CLIC-specific selectors first
    const clicSelectors = [
      'input[name*="DERIVED_2FA_2FA_VER_NBR"]',
      'input[id*="DERIVED_2FA_2FA_VER_NBR"]',
      'input[name*="2FA_VER_NBR"]',
      'input[id*="2FA_VER_NBR"]',
      'input[name*="verification"]',
      'input[name*="otp"]',
      'input[name*="code"]',
    ]

    // Try CLIC-specific selectors first
    for (const selector of clicSelectors) {
      console.log("Trying CLIC selector:", selector)
      const inputs = document.querySelectorAll(selector)
      for (const input of inputs) {
        console.log("Found potential CLIC input:", input)
        if (this.isVisible(input)) {
          this.otpInput = input
          console.log("Found CLIC OTP input field:", input)
          return
        }
      }
    }

    // General OTP selectors
    const generalSelectors = [
      'input[name*="otp" i]',
      'input[name*="code" i]',
      'input[name*="verification" i]',
      'input[id*="otp" i]',
      'input[id*="code" i]',
      'input[id*="verification" i]',
      'input[placeholder*="code" i]',
      'input[placeholder*="otp" i]',
      'input[type="text"][maxlength="6"]',
      'input[type="text"][maxlength="8"]',
      'input[type="password"][maxlength="6"]',
      'input[type="password"][maxlength="8"]',
    ]

    for (const selector of generalSelectors) {
      console.log("Trying general selector:", selector)
      const inputs = document.querySelectorAll(selector)
      for (const input of inputs) {
        console.log("Found potential input:", input)
        if (this.isVisible(input)) {
          this.otpInput = input
          console.log("Found OTP input field:", input)
          return
        }
      }
    }

    // If still not found, try a more aggressive approach
    console.log("Trying aggressive search...")
    const allInputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="number"]')
    console.log("Found", allInputs.length, "total inputs")

    for (const input of allInputs) {
      console.log("Checking input:", {
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        type: input.type,
        visible: this.isVisible(input),
      })

      if (
        (this.isVisible(input) && input.maxLength >= 4 && input.maxLength <= 8) ||
        input.placeholder.toLowerCase().includes("code") ||
        input.name.toLowerCase().includes("code") ||
        input.name.toLowerCase().includes("otp") ||
        input.name.toLowerCase().includes("verification")
      ) {
        this.otpInput = input
        console.log("✅ Found potential OTP input field (fallback):", input)
        return
      }
    }

    console.log("No OTP input field found")
  }

  findLoginButton() {
    console.log("Searching for login button...")

    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Login")',
      'button:contains("Sign In")',
      'button:contains("Submit")',
      'button:contains("Verify")',
      ".login-button",
      "#login-button",
      '[id*="login" i]',
      '[id*="submit" i]',
      '[id*="verify" i]',
    ]

    for (const selector of selectors) {
      try {
        console.log("Trying button selector:", selector)
        const buttons = document.querySelectorAll(selector)
        for (const button of buttons) {
          console.log("Found potential button:", button)
          if (this.isVisible(button)) {
            this.loginButton = button
            console.log("✅ Found login button:", button)
            return
          }
        }
      } catch (e) {
        // Some selectors might not be valid, ignore errors
      }
    }

    // If no specific button found, look for any submit button near the OTP input
    if (!this.loginButton && this.otpInput) {
      console.log("Looking for submit button in form...")
      const form = this.otpInput.closest("form")
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]')
        if (submitBtn) {
          this.loginButton = submitBtn
          console.log("✅ Found submit button in form:", submitBtn)
        }
      }

      // Look for buttons near the input
      if (!this.loginButton) {
        console.log("Looking for nearby buttons...")
        const parent = this.otpInput.parentElement
        if (parent) {
          const nearbyButtons = parent.querySelectorAll("button")
          for (const btn of nearbyButtons) {
            if (this.isVisible(btn)) {
              this.loginButton = btn
              console.log("✅ Found nearby button:", btn)
              break
            }
          }
        }
      }
    }

    if (!this.loginButton) {
      console.log("No login button found")
    }
  }

  addManualFillButton() {
    if (!this.otpInput) return

    const fillButton = document.createElement("button")
    fillButton.textContent = "Fill OTP"
    fillButton.style.cssText = `
      margin-left: 8px;
      padding: 8px 16px;
      background: #FF4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
    `

    fillButton.addEventListener("click", (e) => {
      e.preventDefault()
      console.log("🔥 Manual fill button clicked!")
      this.requestLatestOTP()
    })

    // Insert button next to the input field
    if (this.otpInput.parentNode) {
      this.otpInput.parentNode.insertBefore(fillButton, this.otpInput.nextSibling)
    }
  }

  monitorOTPInput() {
    if (!this.otpInput) return

    console.log("Monitoring OTP input...")

    // Check if OTP input is focused or becomes visible
    const observer = new MutationObserver(() => {
      if (this.isVisible(this.otpInput) && !this.otpInput.value) {
        this.requestOTPAutomatically()
      }
    })

    observer.observe(this.otpInput.parentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
      subtree: true,
    })

    // Also check when input gets focus
    this.otpInput.addEventListener("focus", () => {
      console.log("OTP input focused!")
      if (!this.otpInput.value) {
        this.requestOTPAutomatically()
      }
    })

    // Check immediately if input is already visible and empty
    if (this.isVisible(this.otpInput) && !this.otpInput.value) {
      setTimeout(() => this.requestOTPAutomatically(), 1000)
    }
  }

  requestOTPAutomatically() {
    if (!this.automationEnabled) return

    console.log("Auto-requesting OTP with 3-second delay...")

    // Show countdown message
    this.showCountdownMessage()

    // Wait 3 seconds before requesting OTP
    setTimeout(() => {
      console.log("⏰ 3-second delay completed, requesting OTP...")
      chrome.runtime.sendMessage({ action: "needOTP" })
    }, this.otpRequestDelay)
  }

  showCountdownMessage() {
    const countdownDiv = document.createElement("div")
    countdownDiv.id = "otpCountdown"
    countdownDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2196F3;
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

    let countdown = 3
    countdownDiv.textContent = `Fetching OTP in ${countdown} seconds...`
    document.body.appendChild(countdownDiv)

    const countdownInterval = setInterval(() => {
      countdown--
      if (countdown > 0) {
        countdownDiv.textContent = `Fetching OTP in ${countdown} seconds...`
      } else {
        countdownDiv.textContent = "Fetching OTP now..."
        setTimeout(() => {
          if (countdownDiv.parentNode) {
            countdownDiv.parentNode.removeChild(countdownDiv)
          }
        }, 1000)
        clearInterval(countdownInterval)
      }
    }, 1000)
  }

  requestLatestOTP() {
    console.log("👆 Manually requesting latest OTP...")
    chrome.runtime.sendMessage({ action: "needOTP" })
  }

  autoFillAndLogin(otp, isRetry = false) {
    console.log("AUTO-FILLING OTP:", otp, "Is retry:", isRetry)

    // Remove waiting message if it exists
    const waitingMessage = document.getElementById("waitingForNewOTP")
    if (waitingMessage) {
      waitingMessage.remove()
    }

    // Force re-scan for elements
    console.log("Re-scanning for elements...")
    this.findOTPInput()
    this.findLoginButton()

    // Debug: Log what we found
    console.log("OTP Input found:", !!this.otpInput, this.otpInput)
    console.log("Login Button found:", !!this.loginButton, this.loginButton)

    if (!this.otpInput) {
      console.log("❌ NO OTP INPUT FOUND! Trying aggressive search...")
      this.findOTPInputAggressive()
    }

    if (this.otpInput) {
      console.log("✅ OTP input available, proceeding with fill...")

      // Ensure the input is visible and interactable
      if (!this.isVisible(this.otpInput)) {
        console.log("⚠️ OTP input not visible, trying to make it visible...")

        // Try to scroll to the input
        this.otpInput.scrollIntoView({ behavior: "smooth", block: "center" })

        // Try to show parent elements
        let parent = this.otpInput.parentElement
        while (parent && parent !== document.body) {
          if (parent.style.display === "none") {
            parent.style.display = "block"
          }
          if (parent.style.visibility === "hidden") {
            parent.style.visibility = "visible"
          }
          parent = parent.parentElement
        }

        // Wait a bit for visibility changes to take effect
        setTimeout(() => this.fillOTPInput(otp, isRetry), 500)
        return
      }

      this.fillOTPInput(otp, isRetry)
    } else {
      console.log("❌ CRITICAL: No OTP input field found after all attempts!")
      this.showDebugInfo()
    }
  }

  fillOTPInput(otp, isRetry) {
    console.log("FILLING OTP INPUT WITH:", otp)

    // Verify OTP is a valid string before proceeding
    if (!otp || typeof otp !== "string") {
      console.error("❌ Invalid OTP received:", otp)
      return
    }

    // Log each character of the OTP for debugging
    console.log("🔍 OTP characters:", Array.from(otp).join(", "))

    // Highlight the input field
    this.otpInput.style.border = "3px solid red"
    this.otpInput.style.backgroundColor = "yellow"

    // Clear any existing value first
    this.otpInput.value = ""

    // Force focus to ensure the input is active
    this.otpInput.focus()
    console.log("🎯 Input focused")

    // Wait a moment for focus to take effect
    setTimeout(() => {
      console.log("🔥 Setting OTP value...")

      // DIRECT STRING ASSIGNMENT - most reliable method
      // Convert to string explicitly to ensure proper handling
      const otpString = String(otp).trim()
      this.otpInput.value = otpString
      console.log("✅ Direct value set to:", this.otpInput.value)

      // Trigger ALL possible events
      const events = [
        new Event("input", { bubbles: true }),
        new Event("change", { bubbles: true }),
        new Event("keyup", { bubbles: true }),
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: otpString }),
      ]

      events.forEach((event, index) => {
        this.otpInput.dispatchEvent(event)
        console.log(`✅ Event ${index + 1} dispatched:`, event.type)
      })

      // Store the last filled OTP
      this.lastFilledOTP = otpString

      // Verify the value was set
      setTimeout(() => {
        console.log("🔍 Verifying OTP was set...")
        console.log("Expected:", otpString)
        console.log("Actual:", this.otpInput.value)

        if (this.otpInput.value === otpString) {
          console.log("✅ OTP SUCCESSFULLY FILLED AND VERIFIED!")

          // Remove highlighting
          this.otpInput.style.border = ""
          this.otpInput.style.backgroundColor = ""

          // Proceed with login immediately - no success messages
          this.proceedWithLogin(isRetry)
        } else {
          console.log("❌ OTP FILLING FAILED - value not set correctly")
          console.log(`Expected: "${otpString}", Got: "${this.otpInput.value}"`)

          // Try alternative filling method
          this.tryAlternativeFilling(otpString, isRetry)
        }
      }, 1000) // Longer delay for verification
    }, 500) // Longer delay for focus
  }

  tryAlternativeFilling(otp, isRetry) {
    console.log("🔄 Trying alternative OTP filling method...")
    console.log("🔍 OTP to fill character by character:", otp)

    // Ensure otp is a string
    const otpString = String(otp).trim()

    // Try typing character by character
    this.otpInput.focus()
    this.otpInput.value = ""

    // Use a more reliable character-by-character approach
    const fillCharByChar = () => {
      // Clear the input first
      this.otpInput.value = ""

      // Log the characters we're about to type
      console.log("⌨️ Will type these characters:", Array.from(otpString).join(", "))

      // Type each character with a delay between them
      let currentValue = ""

      for (let i = 0; i < otpString.length; i++) {
        setTimeout(() => {
          const char = otpString[i]
          currentValue += char
          console.log(`⌨️ Typing character ${i + 1}: '${char}', Current value: '${currentValue}'`)

          // Set the value directly for this character
          this.otpInput.value = currentValue

          // Dispatch events
          this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))

          // If this is the last character, verify and proceed
          if (i === otpString.length - 1) {
            setTimeout(() => {
              console.log("⌨️ Finished typing all characters")
              console.log("Expected:", otpString)
              console.log("Actual:", this.otpInput.value)

              if (this.otpInput.value === otpString) {
                console.log("✅ Alternative filling successful!")
                this.proceedWithLogin(isRetry)
              } else {
                console.log("❌ Alternative filling also failed")
                console.log(`Expected: "${otpString}", Got: "${this.otpInput.value}"`)

                // Last resort: try clipboard method
                this.tryClipboardMethod(otpString, isRetry)
              }
            }, 500)
          }
        }, i * 200) // 200ms delay between characters
      }
    }

    // Execute the character-by-character filling
    fillCharByChar()
  }

  tryClipboardMethod(otp, isRetry) {
    console.log("🔄 Trying clipboard method as last resort...")

    // Create a visible input field for the user
    const helpDiv = document.createElement("div")
    helpDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      text-align: center;
      max-width: 400px;
    `

    helpDiv.innerHTML = `
      <h3>OTP Auto-Fill Issue</h3>
      <p>We're having trouble automatically filling the OTP.</p>
      <p>Your OTP code is: <strong style="font-size: 24px; color: #4CAF50;">${otp}</strong></p>
      <p>Please copy this code and paste it manually, or click the button below:</p>
      <button id="manualFillBtn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Fill OTP for me</button>
      <p style="font-size: 12px; margin-top: 10px;">Click anywhere outside this box to dismiss</p>
    `

    document.body.appendChild(helpDiv)

    // Add click handler for the manual fill button
    document.getElementById("manualFillBtn").addEventListener("click", () => {
      this.otpInput.value = otp
      this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))
      this.otpInput.dispatchEvent(new Event("change", { bubbles: true }))
      helpDiv.remove()
      this.lastFilledOTP = otp
      this.proceedWithLogin(isRetry)
    })

    // Close when clicking outside
    helpDiv.addEventListener("click", (e) => {
      if (e.target === helpDiv) {
        helpDiv.remove()
      }
    })

    // Also try to use the clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(otp)
        .then(() => {
          console.log("✅ OTP copied to clipboard for easy pasting")
        })
        .catch((err) => {
          console.error("❌ Could not copy to clipboard:", err)
        })
    }
  }

  proceedWithLogin(isRetry) {
    console.log("Proceeding with login...")

    // Auto-click login button after a short delay
    if (this.loginButton) {
      chrome.runtime.sendMessage({ action: "getAutomationState" }, (response) => {
        if (response && response.autoLoginEnabled) {
          console.log("Auto-clicking login button...")

          // Highlight the button
          this.loginButton.style.border = "3px solid green"

          // Set login start time to track success/failure
          this.loginStartTime = Date.now()

          // Click the login button immediately
          this.loginButton.click()
          console.log("Login button clicked!")

          // Start monitoring for failure
          this.isMonitoringForFailure = true

          // Set a timeout to check for failure
          this.failureCheckTimeout = setTimeout(() => {
            this.checkForLoginFailure()
          }, 8000) // Check after 8 seconds

          // Start interval to check for success
          this.successCheckInterval = setInterval(() => {
            const status = this.checkLoginSuccess()

            // If we've been checking for too long without success or failure
            if (Date.now() - this.loginStartTime > 30000) {
              // 30 seconds timeout
              clearInterval(this.successCheckInterval)
              this.successCheckInterval = null
            }
          }, 1000) // Check every second
        }
      })
    } else {
      console.log("❌ No login button found")
    }
  }

  findOTPInputAggressive() {
    console.log("🔍 AGGRESSIVE OTP INPUT SEARCH...")

    // Try all possible input elements
    const allInputs = document.querySelectorAll("input")
    console.log("🔍 Found", allInputs.length, "total input elements")

    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i]
      const inputInfo = {
        index: i,
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        className: input.className,
        visible: this.isVisible(input),
        value: input.value,
      }

      console.log("🔍 Input", i, ":", inputInfo)

      // Check if this could be an OTP input
      if (this.couldBeOTPInput(input)) {
        console.log("🎯 This input could be OTP input!")
        this.otpInput = input
        return
      }
    }

    console.log("❌ No suitable OTP input found in aggressive search")
  }

  couldBeOTPInput(input) {
    if (!input) return false

    const text = (input.name + " " + input.id + " " + input.placeholder + " " + input.className).toLowerCase()

    // Check for OTP-related keywords
    const otpKeywords = ["otp", "code", "verification", "auth", "token", "pin", "2fa", "ver_nbr"]
    const hasOTPKeyword = otpKeywords.some((keyword) => text.includes(keyword))

    // Check input characteristics
    const isTextOrPassword = input.type === "text" || input.type === "password" || input.type === "number"
    const hasReasonableLength = !input.maxLength || (input.maxLength >= 4 && input.maxLength <= 10)
    const isVisible = this.isVisible(input)

    const couldBe = (hasOTPKeyword || hasReasonableLength) && isTextOrPassword && isVisible

    if (couldBe) {
      console.log("🎯 Potential OTP input found:", {
        hasOTPKeyword,
        hasReasonableLength,
        isTextOrPassword,
        isVisible,
        text,
      })
    }

    return couldBe
  }

  showDebugInfo() {
    console.log("🐞 === CLIC DEBUG INFO ===")
    console.log("Current URL:", window.location.href)
    console.log("Page title:", document.title)
    console.log("All inputs:", document.querySelectorAll("input").length)
    console.log("All buttons:", document.querySelectorAll("button").length)
    console.log("All forms:", document.querySelectorAll("form").length)

    // Log all inputs with details
    const allInputs = document.querySelectorAll("input")
    allInputs.forEach((input, index) => {
      console.log(`Input ${index}:`, {
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        className: input.className,
        visible: this.isVisible(input),
      })
    })
  }

  isVisible(element) {
    if (!element) return false

    try {
      const style = window.getComputedStyle(element)
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        element.offsetWidth > 0 &&
        element.offsetHeight > 0

      return isVisible
    } catch (e) {
      return false
    }
  }

  observePageChanges() {
    const observer = new MutationObserver(() => {
      if (!this.otpInput || !this.isVisible(this.otpInput)) {
        this.findOTPInput()
        if (this.otpInput) {
          this.monitorOTPInput()

          // If we have a stored OTP, try to fill it
          if (this.lastFilledOTP) {
            setTimeout(() => {
              this.autoFillAndLogin(this.lastFilledOTP)
            }, 500)
          }
        }
      }

      if (!this.loginButton || !this.isVisible(this.loginButton)) {
        this.findLoginButton()
      }

      // Check for login success on significant DOM changes
      if (this.loginStartTime) {
        this.checkLoginSuccess()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

// Initialize the auto CLIC helper
console.log("🚀 Initializing Auto CLIC OTP Helper...")
new AutoClicOTPHelper()
