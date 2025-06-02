// Background script for handling automatic OTP workflow
let otpData = {
  code: null,
  timestamp: null,
  isValid: false,
  emailTimestamp: null,
  usedCodes: new Set(), // Track used OTP codes
}

let automationState = {
  isEnabled: true,
  outlookTabId: null,
  clicTabId: null,
  waitingForOTP: false,
  waitingForNewOTP: false, // New state for waiting for fresh OTP
  autoLoginEnabled: true,
  lastFailedOTP: null,
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "otpFound") {
    handleOTPFound(request, sender)
    sendResponse({ success: true })
    return true
  } else if (request.action === "getOTP") {
    const isExpired = otpData.timestamp && Date.now() - otpData.timestamp > 600000
    if (otpData.isValid && !isExpired) {
      sendResponse({ otp: otpData.code, valid: true, emailTimestamp: otpData.emailTimestamp })
    } else {
      sendResponse({ otp: null, valid: false })
    }
    return true
  } else if (request.action === "clearOTP") {
    otpData = { code: null, timestamp: null, isValid: false, emailTimestamp: null, usedCodes: new Set() }
    chrome.storage.local.remove("otpData")
    sendResponse({ success: true })
    return true
  } else if (request.action === "needOTP") {
    handleOTPRequest(sender)
    sendResponse({ success: true })
    return true
  } else if (request.action === "otpFailed") {
    handleOTPFailure(request, sender)
    sendResponse({ success: true })
    return true
  } else if (request.action === "loginSuccess") {
    handleLoginSuccess(request)
    sendResponse({ success: true })
    return true
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
})

function handleOTPFound(request, sender) {
  console.log("Auto OTP: OTP found:", request.otp, "Email timestamp:", request.emailTimestamp)

  // Ensure OTP is properly formatted
  const cleanOTP = String(request.otp).trim()
  console.log("Auto OTP: Cleaned OTP:", cleanOTP, "Length:", cleanOTP.length)
  console.log("Auto OTP: OTP characters:", Array.from(cleanOTP).join(", "))

  // Check if this OTP has already been used and failed
  if (otpData.usedCodes.has(cleanOTP)) {
    console.log("Auto OTP: Ignoring already used OTP:", cleanOTP)
    return
  }

  // Only update if this is a newer OTP (based on email timestamp)
  const newEmailTime = request.emailTimestamp || Date.now()

  // If we're waiting for a new OTP after a failure, ensure this is actually newer
  if (automationState.waitingForNewOTP) {
    if (automationState.lastFailedOTP === cleanOTP) {
      console.log("Auto OTP: Ignoring same failed OTP:", cleanOTP)
      return
    }
  }

  // Always update if we don't have an OTP yet, or if this is newer, or if we're waiting for a new one
  if (!otpData.emailTimestamp || newEmailTime > otpData.emailTimestamp || automationState.waitingForNewOTP) {
    console.log("Auto OTP: This is a fresh OTP, updating...")

    // Store OTP with timestamp
    otpData = {
      code: cleanOTP,
      timestamp: Date.now(),
      isValid: true,
      emailTimestamp: newEmailTime,
      usedCodes: otpData.usedCodes, // Preserve used codes
    }

    chrome.storage.local.set({ otpData })

    // Reset waiting states
    const wasWaitingForNewOTP = automationState.waitingForNewOTP
    automationState.waitingForNewOTP = false
    automationState.lastFailedOTP = null

    // If we're waiting for OTP and automation is enabled, fill it automatically
    if ((automationState.waitingForOTP || wasWaitingForNewOTP) && automationState.isEnabled) {
      automationState.waitingForOTP = false

      console.log("Auto OTP: Attempting to fill OTP in CLIC...")

      // Find CLIC tab and fill OTP
      chrome.tabs.query({ url: "https://clic.mmu.edu.my/*" }, (tabs) => {
        if (tabs.length > 0) {
          const clicTab = tabs[0]
          automationState.clicTabId = clicTab.id

          console.log("Auto OTP: Found CLIC tab, switching to it...")

          // Switch to CLIC tab first
          chrome.tabs.update(clicTab.id, { active: true }, () => {
            if (chrome.runtime.lastError) {
              console.log("Error switching to CLIC tab:", chrome.runtime.lastError)
              return
            }

            // Send OTP with retry mechanism
            const sendOTPWithRetry = (attempt = 1, maxAttempts = 3) => {
              const delay = attempt * 1000 // 1s, 2s, 3s

              setTimeout(() => {
                console.log(`Auto OTP: Sending OTP attempt ${attempt}/${maxAttempts}`)
                console.log(`Auto OTP: Sending OTP: "${cleanOTP}"`)

                chrome.tabs.sendMessage(
                  clicTab.id,
                  {
                    action: "autoFillOTP",
                    otp: cleanOTP,
                    isRetry: wasWaitingForNewOTP,
                    attempt: attempt,
                  },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      console.log(`Auto OTP: Error on attempt ${attempt}:`, chrome.runtime.lastError)

                      // Try again if we haven't reached max attempts
                      if (attempt < maxAttempts) {
                        console.log(`Auto OTP: Retrying... (${attempt + 1}/${maxAttempts})`)
                        sendOTPWithRetry(attempt + 1, maxAttempts)
                      } else {
                        console.log("Auto OTP: All attempts failed")
                      }
                    } else {
                      console.log(`Auto OTP: Successfully sent OTP on attempt ${attempt}`)
                    }
                  },
                )
              }, delay)
            }

            // Start the retry sequence
            sendOTPWithRetry()
          })
        } else {
          console.log("Auto OTP: No CLIC tab found")
          // Try to open CLIC if no tab exists
          chrome.tabs.create(
            {
              url: "https://clic.mmu.edu.my/psp/csprd/?cmd=login&languageCd=ENG&",
              active: true,
            },
            (newTab) => {
              automationState.clicTabId = newTab.id

              // Wait for the new tab to load then send OTP
              setTimeout(() => {
                chrome.tabs.sendMessage(newTab.id, {
                  action: "autoFillOTP",
                  otp: cleanOTP,
                  isRetry: wasWaitingForNewOTP,
                })
              }, 3000)
            },
          )
        }
      })
    }
  } else {
    console.log("Auto OTP: Ignoring older OTP. Current:", otpData.emailTimestamp, "New:", newEmailTime)
  }
}

function handleLoginSuccess(request) {
  console.log("Auto OTP: ✅ LOGIN SUCCESS! OTP:", request.otp)

  // Clear waiting states immediately
  automationState.waitingForOTP = false
  automationState.waitingForNewOTP = false
  automationState.lastFailedOTP = null

  // Clear OTP data
  otpData = { code: null, timestamp: null, isValid: false, emailTimestamp: null, usedCodes: new Set() }
  chrome.storage.local.remove("otpData")

  console.log("Auto OTP: 🔄 Silently closing Outlook tabs...")

  // Immediate cleanup attempt - SILENT
  closeAllOutlookTabs()

  // Backup cleanup after delay
  setTimeout(() => {
    console.log("Auto OTP: 🔄 Backup cleanup attempt...")
    closeAllOutlookTabs()
  }, 1000)

  // Final cleanup attempt
  setTimeout(() => {
    console.log("Auto OTP: 🔄 Final cleanup attempt...")
    closeAllOutlookTabs()
  }, 3000)

  // Reset automation state
  setTimeout(() => {
    automationState = {
      isEnabled: true,
      outlookTabId: null,
      clicTabId: null,
      waitingForOTP: false,
      waitingForNewOTP: false,
      autoLoginEnabled: true,
      lastFailedOTP: null,
    }
    chrome.storage.local.set({ automationState })
    console.log("Auto OTP: ✅ Automation state reset for next use")
  }, 2000)
}

function closeAllOutlookTabs() {
  // Close tracked Outlook tab first
  if (automationState.outlookTabId) {
    console.log("Auto OTP: 🗑️ Closing tracked Outlook tab:", automationState.outlookTabId)
    chrome.tabs.remove(automationState.outlookTabId, () => {
      if (chrome.runtime.lastError) {
        console.log("Error closing tracked Outlook tab:", chrome.runtime.lastError)
      } else {
        console.log("Auto OTP: ✅ Tracked Outlook tab closed")
      }
    })
    automationState.outlookTabId = null
  }

  // Find and close ALL Outlook tabs SILENTLY
  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      console.log("Auto OTP: 🗑️ Silently closing", tabs.length, "Outlook tabs")

      tabs.forEach((tab, index) => {
        setTimeout(() => {
          chrome.tabs.remove(tab.id, () => {
            if (chrome.runtime.lastError) {
              console.log(`❌ Error closing Outlook tab ${tab.id}:`, chrome.runtime.lastError)
            } else {
              console.log(`✅ Silently closed Outlook tab ${tab.id}`)
            }

            // Log completion when all tabs are processed
            if (index === tabs.length - 1) {
              setTimeout(() => {
                console.log("Auto OTP: 🎉 ALL OUTLOOK TABS CLOSED SILENTLY!")
              }, 200)
            }
          })
        }, index * 200) // 200ms delay between each tab
      })
    } else {
      console.log("Auto OTP: ℹ️ No Outlook tabs found to close")
    }
  })
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

function handleOTPFailure(request, sender) {
  console.log("Auto OTP: OTP failed:", request.failedOTP, "- Fetching latest OTP...")

  // Mark this OTP as used and failed
  if (request.failedOTP) {
    otpData.usedCodes.add(request.failedOTP)
    automationState.lastFailedOTP = request.failedOTP
  }

  // Set state to wait for new OTP
  automationState.waitingForNewOTP = true
  automationState.waitingForOTP = true

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

function handleOTPRequest(sender) {
  console.log("Auto OTP: OTP requested from CLIC")

  if (!automationState.isEnabled) return

  automationState.waitingForOTP = true
  automationState.clicTabId = sender.tab.id

  // Check if we already have a valid and recent OTP (within last 3 minutes)
  const isExpired = otpData.timestamp && Date.now() - otpData.timestamp > 180000 // 3 minutes
  if (otpData.isValid && !isExpired && !otpData.usedCodes.has(otpData.code)) {
    // Use existing OTP
    setTimeout(() => {
      try {
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
      } catch (error) {
        console.log("Could not send existing OTP:", error)
      }
    }, 500)
    return
  }

  // Clear old OTP and get fresh one
  otpData = { code: null, timestamp: null, isValid: false, emailTimestamp: null, usedCodes: otpData.usedCodes }

  // Open Outlook to get latest OTP
  openOutlookForOTP()
}

function openOutlookForOTP() {
  console.log("Auto OTP: Opening Outlook to fetch latest OTP")

  // Check if Outlook is already open
  chrome.tabs.query({ url: "https://outlook.office.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      // Outlook already open, switch to it and trigger scan
      const outlookTab = tabs[0]
      automationState.outlookTabId = outlookTab.id

      chrome.tabs.update(outlookTab.id, { active: true })

      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(
            outlookTab.id,
            {
              action: "autoScanLatestOTP",
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log("Error triggering scan:", chrome.runtime.lastError)
              }
            },
          )
        } catch (error) {
          console.log("Could not trigger auto scan:", error)
        }
      }, 1000) // Shorter delay
    } else {
      // Open new Outlook tab
      chrome.tabs.create(
        {
          url: "https://outlook.office.com/mail/",
          active: true,
        },
        (tab) => {
          automationState.outlookTabId = tab.id

          // Wait for tab to load then trigger scan
          setTimeout(() => {
            try {
              chrome.tabs.sendMessage(
                tab.id,
                {
                  action: "autoScanLatestOTP",
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.log("Error triggering scan on new tab:", chrome.runtime.lastError)
                  }
                },
              )
            } catch (error) {
              console.log("Could not trigger auto scan on new tab:", error)
            }
          }, 3000)
        },
      )
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
    otpData = { code: null, timestamp: null, isValid: false, emailTimestamp: null, usedCodes: new Set() }
    chrome.storage.local.remove("otpData")
  }
}, 60000)
