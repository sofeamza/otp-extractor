// Enhanced popup script with latest OTP tracking
document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status")
  const otpDisplayEl = document.getElementById("otpDisplay")
  const otpCodeEl = document.getElementById("otpCode")
  const timestampEl = document.getElementById("timestamp")
  const autoToggle = document.getElementById("autoToggle")
  const loginToggle = document.getElementById("loginToggle")
  const testBtn = document.getElementById("testBtn")
  const openOutlookBtn = document.getElementById("openOutlookBtn")
  const openClicBtn = document.getElementById("openClicBtn")
  const clearBtn = document.getElementById("clearBtn")

  let automationState = {
    isEnabled: true,
    autoLoginEnabled: true,
  }

  // Load current state
  loadAutomationState()
  checkOTPStatus()

  // Event listeners
  autoToggle.addEventListener("click", toggleAutomation)
  loginToggle.addEventListener("click", toggleAutoLogin)
  testBtn.addEventListener("click", testAutomation)
  openOutlookBtn.addEventListener("click", openOutlook)
  openClicBtn.addEventListener("click", openClic)
  clearBtn.addEventListener("click", clearOTP)

  function loadAutomationState() {
    window.chrome.runtime.sendMessage({ action: "getAutomationState" }, (response) => {
      if (response) {
        automationState = response
        updateToggleStates()
        updateStatus()
      }
    })
  }

  function updateToggleStates() {
    autoToggle.classList.toggle("active", automationState.isEnabled)
    loginToggle.classList.toggle("active", automationState.autoLoginEnabled)
  }

  function updateStatus() {
    if (automationState.isEnabled) {
      statusEl.className = "status active"
      statusEl.textContent = "🤖 Latest OTP Detection Active"
    } else {
      statusEl.className = "status inactive"
      statusEl.textContent = "⏸️ Automation Paused"
    }
  }

  function toggleAutomation() {
    automationState.isEnabled = !automationState.isEnabled
    saveAutomationState()
    updateToggleStates()
    updateStatus()
  }

  function toggleAutoLogin() {
    automationState.autoLoginEnabled = !automationState.autoLoginEnabled
    saveAutomationState()
    updateToggleStates()
  }

  function saveAutomationState() {
    window.chrome.runtime.sendMessage({
      action: "setAutomationState",
      state: automationState,
    })
  }

  function testAutomation() {
    testBtn.disabled = true
    testBtn.textContent = "Testing Latest OTP..."

    // Open CLIC in a new tab to test
    window.chrome.tabs.create({
      url: "https://clic.mmu.edu.my/psp/csprd/?cmd=login&languageCd=ENG&",
      active: true,
    })

    setTimeout(() => {
      testBtn.disabled = false
      testBtn.textContent = "Test Automation"
    }, 3000)
  }

  function checkOTPStatus() {
    window.chrome.runtime.sendMessage({ action: "getOTP" }, (response) => {
      if (response && response.valid && response.otp) {
        showOTPFound(response.otp, response.emailTimestamp)
      } else {
        hideOTP()
      }
    })
  }

  function showOTPFound(otp, emailTimestamp) {
    otpCodeEl.textContent = otp

    const extractTime = new Date().toLocaleTimeString()
    const emailTime = emailTimestamp ? new Date(emailTimestamp).toLocaleTimeString() : "Unknown"

    timestampEl.innerHTML = `
      <div>Latest OTP extracted at ${extractTime}</div>
      <div style="font-size: 10px; opacity: 0.8;">Email received: ${emailTime}</div>
    `

    otpDisplayEl.style.display = "block"
    clearBtn.style.display = "block"
  }

  function hideOTP() {
    otpDisplayEl.style.display = "none"
    clearBtn.style.display = "none"
  }

  function openOutlook() {
    window.chrome.tabs.create({
      url: "https://outlook.office.com/mail/",
      active: true,
    })
  }

  function openClic() {
    window.chrome.tabs.create({
      url: "https://clic.mmu.edu.my/psp/csprd/?cmd=login&languageCd=ENG&",
      active: true,
    })
  }

  function clearOTP() {
    window.chrome.runtime.sendMessage({ action: "clearOTP" }, (response) => {
      if (response && response.success) {
        hideOTP()
      }
    })
  }

  // Auto-refresh every 5 seconds to show latest OTP
  setInterval(checkOTPStatus, 5000)
})
