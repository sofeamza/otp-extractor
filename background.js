// Background script for handling automatic OTP workflow
let otpData = {
  code: null,
  timestamp: null,
  isValid: false,
}

let automationState = {
  isEnabled: true,
  outlookTabId: null,
  clicTabId: null,
  waitingForOTP: false,
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "otpFound") {
    handleOTPFound(request, sender)
  } else if (request.action === "getOTP") {
    const isExpired = otpData.timestamp && Date.now() - otpData.timestamp > 600000
    if (otpData.isValid && !isExpired) {
      sendResponse({ otp: otpData.code, valid: true })
    } else {
      sendResponse({ otp: null, valid: false })
    }
    return true
  } else if (request.action === "clearOTP") {
    otpData = { code: null, timestamp: null, isValid: false }
    chrome.storage.local.remove("otpData")
    sendResponse({ success: true })
    return true
  } else if (request.action === "needOTP") {
    handleOTPRequest(sender, request.manual)
  } else if (request.action === "otpFailed") {
    handleOTPFailure(request, sender)
  } else if (request.action === "loginSuccess") {
    handleLoginSuccess()
  } else if (request.action === "getAutomationState") {
    sendResponse(automationState)
    return true
  } else if (request.action === "setAutomationState") {
    automationState = { ...automationState, ...request.state }
    chrome.storage.local.set({ automationState })
    sendResponse({ success: true })
    return true
  } else if (request.action === "forceCleanup") {
    console.log("Auto OTP: Force cleanup requested:", request.reason)
    forceCloseOutlookTabs()
    sendResponse({ success: true })
    return true
  }

  sendResponse({ success: true })
})

function handleOTPFound(request, sender) {
  console.log("Auto OTP: OTP found:", request.otp)

  const cleanOTP = String(request.otp).trim()

  // Store OTP
  otpData = {
    code: cleanOTP,
    timestamp: Date.now(),
    isValid: true,
  }

  // If waiting for OTP, send it to CLIC
  if (automationState.waitingForOTP) {
    automationState.waitingForOTP = false

    chrome.tabs.query({ url: "https://clic.mmu.edu.my/*" }, (tabs) => {
      if (tabs.length > 0) {
        const clicTab = tabs[0]

        // Check if tab is still valid
        chrome.tabs.get(clicTab.id, (tab) => {
          if (chrome.runtime.lastError) {
            console.log("CLIC tab no longer exists, skipping OTP send")
            return
          }

          // Switch to CLIC tab and send OTP
          chrome.tabs.update(clicTab.id, { active: true }, () => {
            if (chrome.runtime.lastError) {
              console.log("Error switching to CLIC tab:", chrome.runtime.lastError)
              return
            }

            setTimeout(() => {
              chrome.tabs.sendMessage(
                clicTab.id,
                {
                  action: "autoFillOTP",
                  otp: cleanOTP,
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.log("Error sending OTP to CLIC:", chrome.runtime.lastError)
                  } else {
                    console.log("OTP successfully sent to CLIC")
                  }
                },
              )
            }, 1000)
          })
        })
      } else {
        console.log("No CLIC tab found")
      }
    })
  }
}

function handleOTPRequest(sender, isManual = false) {
  console.log("Auto OTP: OTP requested", isManual ? "(Manual)" : "(Auto)")

  automationState.waitingForOTP = true
  automationState.clicTabId = sender.tab.id

  // For manual requests or if no valid OTP, get fresh one
  if (isManual || !otpData.isValid || Date.now() - otpData.timestamp > 180000) {
    openOutlookForOTP()
  } else {
    // Use existing OTP - check if tab still exists first
    chrome.tabs.get(sender.tab.id, (tab) => {
      if (chrome.runtime.lastError) {
        console.log("CLIC tab no longer exists")
        return
      }

      chrome.tabs.sendMessage(
        sender.tab.id,
        {
          action: "autoFillOTP",
          otp: otpData.code,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error sending existing OTP:", chrome.runtime.lastError)
          }
        },
      )
    })
  }
}

function handleLoginSuccess() {
  console.log("Auto OTP: ✅ LOGIN SUCCESS!")

  // Clear OTP data
  otpData = { code: null, timestamp: null, isValid: false }
  automationState.waitingForOTP = false

  // Close Outlook tabs
  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.remove(tab.id)
    })
  })
}

function handleOTPFailure(request, sender) {
  console.log("Auto OTP: OTP failed:", request.failedOTP, "- Fetching latest OTP...")

  // Invalidate current OTP
  otpData.isValid = false

  console.log("Auto OTP: Now fetching latest OTP code...")

  // Immediately try to get latest OTP from Outlook
  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      const outlookTab = tabs[0]

      // Switch to Outlook to check for new emails
      chrome.tabs.update(outlookTab.id, { active: true })

      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(
            outlookTab.id,
            {
              action: "waitForNewOTP",
              failedOTP: request.failedOTP,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log("Error triggering scan:", chrome.runtime.lastError)
              }
            },
          )
        } catch (error) {
          console.log("Could not notify Outlook about failed OTP:", error)
        }
      }, 500) // Shorter delay for faster retry
    } else {
      // Open Outlook if not already open
      openOutlookForOTP()
    }
  })
}

function openOutlookForOTP() {
  console.log("Auto OTP: Opening Outlook for OTP")

  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      // Use existing Outlook tab
      const outlookTab = tabs[0]

      // Check if tab still exists
      chrome.tabs.get(outlookTab.id, (tab) => {
        if (chrome.runtime.lastError) {
          console.log("Outlook tab no longer exists, creating new one")
          createNewOutlookTab()
          return
        }

        chrome.tabs.update(outlookTab.id, { active: true }, () => {
          if (chrome.runtime.lastError) {
            console.log("Error switching to Outlook tab:", chrome.runtime.lastError)
            return
          }

          setTimeout(() => {
            chrome.tabs.sendMessage(
              outlookTab.id,
              {
                action: "autoScanLatestOTP",
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log("Error sending scan message:", chrome.runtime.lastError)
                }
              },
            )
          }, 1000)
        })
      })
    } else {
      createNewOutlookTab()
    }
  })
}

function createNewOutlookTab() {
  // Open new Outlook tab
  chrome.tabs.create(
    {
      url: "https://outlook.office.com/mail/",
      active: true,
    },
    (tab) => {
      if (chrome.runtime.lastError) {
        console.log("Error creating Outlook tab:", chrome.runtime.lastError)
        return
      }

      setTimeout(() => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "autoScanLatestOTP",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log("Error sending scan message to new tab:", chrome.runtime.lastError)
            }
          },
        )
      }, 3000)
    },
  )
}

function forceCloseOutlookTabs() {
  console.log("Auto OTP: Force closing all Outlook tabs...")

  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      console.log("Auto OTP: Force closing", tabs.length, "Outlook tabs")

      tabs.forEach((tab, index) => {
        setTimeout(() => {
          chrome.tabs.remove(tab.id, () => {
            if (chrome.runtime.lastError) {
              console.log(`Error force closing Outlook tab ${tab.id}:`, chrome.runtime.lastError)
            } else {
              console.log(`Auto OTP: Force closed Outlook tab ${tab.id}`)
            }
          })
        }, index * 100) // Faster staggering
      })
    } else {
      console.log("Auto OTP: No Outlook tabs found to force close")
    }
  })
}

// Load automation state on startup
chrome.storage.local.get(["automationState"], (result) => {
  if (result.automationState) {
    automationState = { ...automationState, ...result.automationState }
  }
})

// Clean up expired OTP data periodically
setInterval(() => {
  if (otpData.timestamp && Date.now() - otpData.timestamp > 600000) {
    otpData = { code: null, timestamp: null, isValid: false }
    chrome.storage.local.remove("otpData")
  }
}, 60000)
