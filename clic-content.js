// Auto CLIC content script with success detection

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
        console.log("Received autoFillOTP message with OTP:", request.otp)
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
    // Find OTP input and login button
    this.findOTPInput()
    this.findLoginButton()

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
    const hasLogoutButton = !!Array.from(document.querySelectorAll("a, button")).find(el =>
      /logout|sign out/i.test(el.textContent)
    )

    const hasDashboard = !!document.querySelector(
      '[class*="dashboard" i], [id*="dashboard" i], [class*="home" i], [id*="home" i]',
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
      (otpStillVisible && stillOnLoginPage && this.loginStartTime && Date.now() - this.loginStartTime > 5000)
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
      console.log(
        "Auto CLIC: Success indicators - notOnLoginPage:",
        notOnLoginPage,
        "hasUserMenu:",
        hasUserMenu,
        "hasLogoutButton:",
        hasLogoutButton,
        "hasDashboard:",
        hasDashboard,
        "noLoginForm:",
        noLoginForm,
        "noOtpInput:",
        noOtpInput,
      )
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

    // Show success message
    this.showMessage("✅ Login successful! Closing Outlook...", "success")

    console.log("Auto CLIC: Login success detected, notifying background script...")

    // Immediately notify background script about successful login
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

    // Show final completion message after a delay
    setTimeout(() => {
      this.showMessage("🎉 Automation complete! Outlook should be closed.", "success")
    }, 3000)

    // Force another notification attempt after delay (backup)
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "forceCleanup",
        reason: "delayed_cleanup",
      })
    }, 5000)
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

    this.showMessage(`OTP ${this.lastFilledOTP} failed. Waiting for new OTP...`, "warning")

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
      <div>⏳ Waiting for New OTP</div>
      <div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">
        Previous OTP failed. Checking Outlook for fresh code...
      </div>
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
        This message will disappear when a new OTP is found.
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
    const selectors = [
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

    for (const selector of selectors) {
      const inputs = document.querySelectorAll(selector)
      for (const input of inputs) {
        if (this.isVisible(input)) {
          this.otpInput = input
          console.log("Auto CLIC: Found OTP input field", input)
          return
        }
      }
    }

    // If still not found, try a more aggressive approach
    const allInputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="number"]')
    for (const input of allInputs) {
      if (
        (this.isVisible(input) && input.maxLength >= 4 && input.maxLength <= 8) ||
        input.placeholder.toLowerCase().includes("code") ||
        input.name.toLowerCase().includes("code")
      ) {
        this.otpInput = input
        console.log("Auto CLIC: Found potential OTP input field (fallback)", input)
        return
      }
    }
  }

  findLoginButton() {
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
        const buttons = document.querySelectorAll(selector)
        for (const button of buttons) {
          if (this.isVisible(button)) {
            this.loginButton = button
            console.log("Auto CLIC: Found login button", button)
            return
          }
        }
      } catch (e) {
        // Some selectors might not be valid, ignore errors
      }
    }

    // If no specific button found, look for any submit button near the OTP input
    if (!this.loginButton && this.otpInput) {
      const form = this.otpInput.closest("form")
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]')
        if (submitBtn) {
          this.loginButton = submitBtn
          console.log("Auto CLIC: Found submit button in form", submitBtn)
        }
      }

      // Look for buttons near the input
      if (!this.loginButton) {
        const parent = this.otpInput.parentElement
        if (parent) {
          const nearbyButtons = parent.querySelectorAll("button")
          for (const btn of nearbyButtons) {
            if (this.isVisible(btn)) {
              this.loginButton = btn
              console.log("Auto CLIC: Found nearby button", btn)
              break
            }
          }
        }
      }
    }
  }

  addManualFillButton() {
    if (!this.otpInput) return

    const fillButton = document.createElement("button")
    fillButton.textContent = "Fill Latest OTP"
    fillButton.style.cssText = `
      margin-left: 8px;
      padding: 6px 12px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `

    fillButton.addEventListener("click", (e) => {
      e.preventDefault()
      this.requestLatestOTP()
    })

    // Insert button next to the input field
    if (this.otpInput.parentNode) {
      this.otpInput.parentNode.insertBefore(fillButton, this.otpInput.nextSibling)
    }
  }

  monitorOTPInput() {
    if (!this.otpInput) return

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

    console.log("Auto CLIC: Requesting latest OTP automatically...")
    this.showMessage("Automatically fetching latest OTP from Outlook...", "info")

    chrome.runtime.sendMessage({ action: "needOTP" })
  }

  requestLatestOTP() {
    console.log("Auto CLIC: Manually requesting latest OTP...")
    this.showMessage("Fetching latest OTP from Outlook...", "info")

    chrome.runtime.sendMessage({ action: "needOTP" })
  }

  autoFillAndLogin(otp, isRetry = false) {
    console.log("Auto CLIC: Auto-filling latest OTP:", otp, "Is retry:", isRetry)

    // Remove waiting message if it exists
    const waitingMessage = document.getElementById("waitingForNewOTP")
    if (waitingMessage) {
      waitingMessage.remove()
    }

    // Force re-scan for elements
    console.log("Auto CLIC: Re-scanning for OTP input and login button...")
    this.findOTPInput()
    this.findLoginButton()

    // Debug: Log what we found
    console.log("Auto CLIC: OTP Input found:", !!this.otpInput, this.otpInput)
    console.log("Auto CLIC: Login Button found:", !!this.loginButton, this.loginButton)

    if (this.otpInput) {
      // Ensure the input is visible and interactable
      if (!this.isVisible(this.otpInput)) {
        console.log("Auto CLIC: OTP input not visible, trying to make it visible...")

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
      console.log("Auto CLIC: No OTP input field found, trying alternative search...")

      // Try more aggressive search
      this.findOTPInputAggressive()

      if (this.otpInput) {
        console.log("Auto CLIC: Found OTP input with aggressive search")
        this.fillOTPInput(otp, isRetry)
      } else {
        console.log("Auto CLIC: Still no OTP input field found")
        this.showMessage("Could not find OTP input field. Please refresh and try again.", "error")

        // Show debug info
        this.showDebugInfo()
      }
    }
  }

  fillOTPInput(otp, isRetry) {
    console.log("Auto CLIC: Filling OTP input with:", otp)

    // Clear any existing value first
    this.otpInput.value = ""

    // Force focus to ensure the input is active
    this.otpInput.focus()

    // Wait a moment for focus to take effect
    setTimeout(() => {
      // Fill OTP using multiple methods to ensure it works
      this.otpInput.value = otp

      // Trigger various events to ensure the value is recognized
      this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))
      this.otpInput.dispatchEvent(new Event("change", { bubbles: true }))
      this.otpInput.dispatchEvent(new Event("keyup", { bubbles: true }))
      this.otpInput.dispatchEvent(new Event("blur", { bubbles: true }))

      // Also try setting the value property directly
      if (Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
        if (descriptor && descriptor.set) {
          descriptor.set.call(this.otpInput, otp)
        }
      }

      // Try React-style value setting
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(this.otpInput, otp)
        this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))
      }

      // Store the last filled OTP
      this.lastFilledOTP = otp

      // Verify the value was set
      setTimeout(() => {
        if (this.otpInput.value === otp) {
          console.log("Auto CLIC: OTP successfully filled and verified")
          const message = isRetry ? `New OTP filled after failure: ${otp}` : `Latest OTP auto-filled: ${otp}`
          this.showMessage(message, "success")

          // Proceed with login
          this.proceedWithLogin(isRetry)
        } else {
          console.log("Auto CLIC: OTP filling failed, value not set correctly")
          console.log("Expected:", otp, "Actual:", this.otpInput.value)
          this.showMessage("OTP filling failed. Trying alternative method...", "warning")

          // Try alternative filling method
          this.tryAlternativeFilling(otp, isRetry)
        }
      }, 500)
    }, 200)
  }

  tryAlternativeFilling(otp, isRetry) {
    console.log("Auto CLIC: Trying alternative OTP filling method...")

    // Try typing character by character
    this.otpInput.focus()
    this.otpInput.value = ""

    let index = 0
    const typeChar = () => {
      if (index < otp.length) {
        const char = otp[index]

        // Simulate key events
        const keydownEvent = new KeyboardEvent("keydown", { key: char, bubbles: true })
        const keypressEvent = new KeyboardEvent("keypress", { key: char, bubbles: true })
        const keyupEvent = new KeyboardEvent("keyup", { key: char, bubbles: true })

        this.otpInput.dispatchEvent(keydownEvent)
        this.otpInput.dispatchEvent(keypressEvent)

        // Set the value incrementally
        this.otpInput.value += char
        this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))

        this.otpInput.dispatchEvent(keyupEvent)

        index++
        setTimeout(typeChar, 100) // 100ms delay between characters
      } else {
        // Finished typing
        this.otpInput.dispatchEvent(new Event("change", { bubbles: true }))

        setTimeout(() => {
          if (this.otpInput.value === otp) {
            console.log("Auto CLIC: Alternative filling successful")
            this.showMessage(`OTP filled using alternative method: ${otp}`, "success")
            this.proceedWithLogin(isRetry)
          } else {
            console.log("Auto CLIC: Alternative filling also failed")
            this.showMessage("All OTP filling methods failed. Please fill manually.", "error")
          }
        }, 500)
      }
    }

    typeChar()
  }

  proceedWithLogin(isRetry) {
    // Auto-click login button after a short delay
    if (this.loginButton) {
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "getAutomationState" }, (response) => {
          if (response && response.autoLoginEnabled) {
            console.log("Auto CLIC: Auto-clicking login button...")

            // Set login start time to track success/failure
            this.loginStartTime = Date.now()

            // Click the login button
            this.loginButton.click()

            const loginMessage = isRetry
              ? "Retrying login with new OTP..."
              : "Automatically logging in with latest OTP..."
            this.showMessage(loginMessage, "success")

            // Start monitoring for failure
            this.isMonitoringForFailure = true

            // Set a timeout to check for failure
            this.failureCheckTimeout = setTimeout(() => {
              this.checkForLoginFailure()
            }, 5000) // Check after 5 seconds

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
      }, 1500)
    } else {
      console.log("Auto CLIC: No login button found")
      this.showMessage("OTP filled, but no login button found. Please click submit manually.", "warning")
    }
  }

  findOTPInputAggressive() {
    console.log("Auto CLIC: Performing aggressive OTP input search...")

    // Try all possible input elements
    const allInputs = document.querySelectorAll("input")
    console.log("Auto CLIC: Found", allInputs.length, "input elements")

    for (const input of allInputs) {
      const inputInfo = {
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        className: input.className,
        visible: this.isVisible(input),
      }

      console.log("Auto CLIC: Checking input:", inputInfo)

      // Check if this could be an OTP input
      if (this.couldBeOTPInput(input)) {
        console.log("Auto CLIC: This input could be OTP input")
        this.otpInput = input
        return
      }
    }

    console.log("Auto CLIC: No suitable OTP input found in aggressive search")
  }

  couldBeOTPInput(input) {
    if (!input) return false

    const text = (input.name + " " + input.id + " " + input.placeholder + " " + input.className).toLowerCase()

    // Check for OTP-related keywords
    const otpKeywords = ["otp", "code", "verification", "auth", "token", "pin"]
    const hasOTPKeyword = otpKeywords.some((keyword) => text.includes(keyword))

    // Check input characteristics
    const isTextOrPassword = input.type === "text" || input.type === "password" || input.type === "number"
    const hasReasonableLength = !input.maxLength || (input.maxLength >= 4 && input.maxLength <= 10)
    const isVisible = this.isVisible(input)

    return (hasOTPKeyword || hasReasonableLength) && isTextOrPassword && isVisible
  }

  showDebugInfo() {
    console.log("Auto CLIC: === DEBUG INFO ===")
    console.log("Current URL:", window.location.href)
    console.log("Page title:", document.title)
    console.log("All inputs:", document.querySelectorAll("input").length)
    console.log("All buttons:", document.querySelectorAll("button").length)
    console.log("All forms:", document.querySelectorAll("form").length)

    // Show a debug notification
    this.showMessage("Debug: Check console for detailed information about page elements", "info")
  }

  isVisible(element) {
    if (!element) return false

    try {
      const style = window.getComputedStyle(element)
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        element.offsetWidth > 0 &&
        element.offsetHeight > 0
      )
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

  showMessage(text, type = "info") {
    const colors = {
      success: "#4CAF50",
      warning: "#FF9800",
      info: "#2196F3",
      error: "#F44336",
    }

    const message = document.createElement("div")
    message.style.cssText = `
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
      max-width: 300px;
    `
    message.textContent = text

    document.body.appendChild(message)

    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message)
      }
    }, 5000)
  }
}

// Initialize the auto CLIC helper
new AutoClicOTPHelper()
