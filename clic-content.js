class AutoClicOTPHelper {
  constructor() {
    this.otpInput = null
    this.loginButton = null
    this.lastFilledOTP = null
    this.manualRequest = false
    this.init()
  }

  init() {
    console.log("Auto CLIC OTP Helper: Initializing...")

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupHelper())
    } else {
      this.setupHelper()
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "autoFillOTP") {
        this.autoFillAndLogin(request.otp)
        sendResponse({ success: true })
        return true
      }
    })
  }

  setupHelper() {
    console.log("🔍 Setting up CLIC helper...")

    // Find OTP input and login button
    this.findOTPInput()
    this.findLoginButton()

    console.log("🎯 Found OTP input:", !!this.otpInput)
    console.log("🎯 Found login button:", !!this.loginButton)

    if (this.otpInput) {
      // Auto-detect when OTP input becomes visible/required
      this.monitorOTPInput()

      // Add a manual fill button
      this.addManualFillButton()
    }

    // Monitor for dynamic content changes
    this.observePageChanges()

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
    `;
  };

  updateDebugInfo();
  setInterval(updateDebugInfo, 2000);

  document.body.appendChild(debugDiv);
  debugDiv.style.display = "none"; 
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
    const logoutLinks = Array.from(document.querySelectorAll('a[href*="logout" i], button'))
    const hasLogoutButton = logoutLinks.some(el =>
      /logout|sign out/i.test(el.textContent.trim())
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

    if (foundError || (otpStillVisible && stillOnLoginPage)) {
      console.log("Auto CLIC: Login failure detected for OTP:", this.lastFilledOTP)
      this.handleLoginFailure()
    }
  }

  checkLoginSuccess() {
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
      (notOnLoginPage && noOtpInput) // Give more time for page to load

    if (success) {
      console.log("Auto CLIC: Login success detected!")
      this.notifyLoginSuccess()
      return { success: true, redirected: notOnLoginPage }
    }

    return { success: false, redirected: notOnLoginPage }
  }

  notifyLoginSuccess() {
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
      <div>⏳ Fetching Latest OTP</div>
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
      console.log("🔍 Trying CLIC selector:", selector)
      const inputs = document.querySelectorAll(selector)
      for (const input of inputs) {
        console.log("🎯 Found potential CLIC input:", input)
        if (this.isVisible(input)) {
          this.otpInput = input
          console.log("✅ Found CLIC OTP input field:", input)
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
      console.log("🔍 Trying general selector:", selector)
      const inputs = document.querySelectorAll(selector)
      for (const input of inputs) {
        console.log("🎯 Found potential input:", input)
        if (this.isVisible(input)) {
          this.otpInput = input
          console.log("✅ Found OTP input field:", input)
          return
        }
      }
    }

    // If still not found, try a more aggressive approach
    console.log("🔍 Trying aggressive search...")
    const allInputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="number"]')
    console.log("🔍 Found", allInputs.length, "total inputs")

    for (const input of allInputs) {
      console.log("🔍 Checking input:", {
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

    console.log("❌ No OTP input field found")
  }

  findLoginButton() {
    console.log("🔍 Searching for login button...")

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
        console.log("🔍 Trying button selector:", selector)
        const buttons = document.querySelectorAll(selector)
        for (const button of buttons) {
          console.log("🎯 Found potential button:", button)
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
      console.log("🔍 Looking for submit button in form...")
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
        console.log("🔍 Looking for nearby buttons...")
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
      console.log("❌ No login button found")
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
      this.manualRequest = true // Mark as manual request
      chrome.runtime.sendMessage({ action: "needOTP", manual: true })
    })

    // Insert button next to the input field
    if (this.otpInput.parentNode) {
      this.otpInput.parentNode.insertBefore(fillButton, this.otpInput.nextSibling)
    }
  }

  monitorOTPInput() {
    if (!this.otpInput) return

    console.log("👀 Monitoring OTP input...")

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
      console.log("🎯 OTP input focused!")
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
    console.log("🤖 Auto-requesting OTP with 3-second delay...")

    // Show countdown message
    this.showCountdownMessage()

    // Wait 3 seconds before requesting OTP
    setTimeout(() => {
      console.log("⏰ 3-second delay completed, requesting OTP...")
      chrome.runtime.sendMessage({ action: "needOTP" })
    }, 3000)
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

  autoFillAndLogin(otp) {
    console.log("🔥 AUTO-FILLING OTP:", otp)

    // If manual request, focus this tab first
    if (this.manualRequest) {
      this.manualRequest = false
      window.focus()
      setTimeout(() => this.fillOTP(otp), 500)
    } else {
      this.fillOTP(otp)
    }
  }

  fillOTP(otp) {
    if (!this.otpInput) {
      this.findOTPInput()
    }

    if (this.otpInput) {
      // Clear and fill OTP
      this.otpInput.value = ""
      this.otpInput.focus()

      setTimeout(() => {
        this.otpInput.value = String(otp).trim()

        // Trigger events
        this.otpInput.dispatchEvent(new Event("input", { bubbles: true }))
        this.otpInput.dispatchEvent(new Event("change", { bubbles: true }))

        this.lastFilledOTP = otp

        // Auto-click login button
        if (this.loginButton) {
          setTimeout(() => {
            this.loginButton.click()
            this.checkLoginSuccess()
          }, 1000)
        }
      }, 500)
    }
  }

  checkLoginSuccess() {
    // Check for login success after 5 seconds
    setTimeout(() => {
      const notOnLoginPage = !window.location.href.includes("login")
      const noOtpInput = !this.otpInput || !this.isVisible(this.otpInput)

      if (notOnLoginPage || noOtpInput) {
        console.log("✅ Login success detected")
        chrome.runtime.sendMessage({
          action: "loginSuccess",
          otp: this.lastFilledOTP,
        })
      }
    }, 5000)
  }

  isVisible(element) {
    if (!element) return false
    const style = window.getComputedStyle(element)
    return (
      style.display !== "none" && style.visibility !== "hidden" && element.offsetWidth > 0 && element.offsetHeight > 0
    )
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
      this.checkLoginSuccess()
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
