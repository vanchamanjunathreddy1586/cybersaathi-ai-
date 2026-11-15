import { evaluateUrlHeuristics } from './heuristics.js'

function renderResult(result, targetUrl) {
  const hostElem = document.getElementById('site-hostname')
  const pillElem = document.getElementById('verdict-pill')
  const scoreText = document.getElementById('risk-score-text')
  const scoreBar = document.getElementById('score-bar')
  const indicatorsList = document.getElementById('indicators-list')
  const recText = document.getElementById('recommendation-text')

  try {
    const parsed = new URL(targetUrl)
    hostElem.textContent = parsed.hostname
  } catch {
    hostElem.textContent = targetUrl
  }

  scoreText.textContent = `${result.riskScore} / 100`
  scoreBar.style.width = `${result.riskScore}%`

  pillElem.className = 'verdict-pill'
  if (result.verdict === 'Likely Safe') {
    pillElem.classList.add('safe')
    pillElem.textContent = 'SAFE'
    scoreBar.style.background = '#10b981'
  } else if (result.verdict === 'Suspicious') {
    pillElem.classList.add('suspicious')
    pillElem.textContent = 'SUSPICIOUS'
    scoreBar.style.background = '#f59e0b'
  } else {
    pillElem.classList.add('scam')
    pillElem.textContent = 'MALICIOUS'
    scoreBar.style.background = '#ef4444'
  }

  indicatorsList.innerHTML = ''
  if (result.indicators && result.indicators.length > 0) {
    result.indicators.forEach((ind) => {
      const item = document.createElement('div')
      item.className = 'indicator-item'
      item.textContent = `⚠️ ${ind}`
      indicatorsList.appendChild(item)
    })
  }

  recText.textContent = result.recommendation || ''
}

// Check active browser tab
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0]
    if (activeTab && activeTab.url && activeTab.url.startsWith('http')) {
      const result = evaluateUrlHeuristics(activeTab.url)
      renderResult(result, activeTab.url)
    } else {
      document.getElementById('site-hostname').textContent = 'Browser Internal Page'
      document.getElementById('recommendation-text').textContent = 'Local or extension page. Real-time scanning inactive.'
    }
  })
}

// Manual URL check button
const btnCheck = document.getElementById('btn-check')
const urlInput = document.getElementById('url-input')

btnCheck?.addEventListener('click', () => {
  const url = urlInput.value.trim()
  if (!url) return

  let testUrl = url
  if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
    testUrl = `https://${testUrl}`
  }

  const result = evaluateUrlHeuristics(testUrl)
  renderResult(result, testUrl)
})

urlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnCheck?.click()
  }
})
