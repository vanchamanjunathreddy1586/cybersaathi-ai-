import { evaluateUrlHeuristics } from './heuristics.js'

const cache = new Map()

// Update badge based on heuristic evaluation
function updateBadge(tabId, result) {
  if (!chrome.action) return

  if (result.verdict === 'Likely Malicious') {
    chrome.action.setBadgeText({ tabId, text: '!' })
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' })
  } else if (result.verdict === 'Suspicious') {
    chrome.action.setBadgeText({ tabId, text: '?' })
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' })
  } else {
    chrome.action.setBadgeText({ tabId, text: '' })
  }
}

// Listen to tab URL updates
chrome.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    let result = cache.get(tab.url)
    if (!result) {
      result = evaluateUrlHeuristics(tab.url)
      cache.set(tab.url, result)
      if (cache.size > 200) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }
    }

    updateBadge(tabId, result)

    // Notify user immediately if high-confidence malicious impersonation
    if (result.verdict === 'Likely Malicious' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'CyberSaathi AI — High Risk Site Alert',
        message: `Warning: ${result.hostname} exhibits characteristics of fake banking or deceptive phishing.`,
        priority: 2,
      })
    }
  }
})

// Message handler for Popup UI
chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_URL') {
    const result = evaluateUrlHeuristics(message.url)
    sendResponse({ success: true, result })
    return true
  }

  if (message.type === 'GET_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]
      if (!activeTab || !activeTab.url || !activeTab.url.startsWith('http')) {
        sendResponse({ success: false, reason: 'NOT_HTTP_TAB' })
        return
      }

      let result = cache.get(activeTab.url)
      if (!result) {
        result = evaluateUrlHeuristics(activeTab.url)
        cache.set(activeTab.url, result)
      }
      sendResponse({ success: true, tabUrl: activeTab.url, result })
    })
    return true
  }
})
