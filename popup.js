const chaseOffersUrl = 'https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offerCategoriesPage?offerCategoryName=ALL';

// Check if current tab URL matches Chase offers URL
async function checkUrlAndUpdateButton() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const startBtn = document.getElementById('start');
  const urlWarning = document.getElementById('url_warning');
  
  if (tab && tab.url && tab.url.includes('secure.chase.com') && tab.url.includes('merchantOffers')) {
    startBtn.disabled = false;
    urlWarning.style.display = 'none';
  } else {
    startBtn.disabled = true;
    urlWarning.style.display = 'block';
  }
}

// Initialize on load
checkUrlAndUpdateButton();

document.getElementById('go_to_offers').addEventListener('click', () => {
  window.open(chaseOffersUrl, '_blank');
});

let isToolRunning = false;
let messagePort = null;

document.getElementById('start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Show the tool panel
  document.getElementById('tool_panel').classList.add('active');
  document.getElementById('start').style.display = 'none';
  document.getElementById('url_warning').style.display = 'none';
  
  // Initialize status display
  document.getElementById('status').textContent = '⏹️ Stopped';
  document.getElementById('progress').textContent = '--';
  document.getElementById('timeLeft').textContent = '--';
  
  // Inject the content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['index.js']
    });
    
    // Small delay to ensure script is ready, then connect
    setTimeout(() => {
      try {
        // Connect to the content script
        messagePort = chrome.tabs.connect(tab.id, { name: 'popup-connection' });
        
        messagePort.onMessage.addListener((message) => {
          if (message.type === 'status') {
            document.getElementById('status').textContent = message.status;
          } else if (message.type === 'progress') {
            document.getElementById('progress').textContent = message.offersLeft;
            document.getElementById('timeLeft').textContent = message.timeLeft;
          } else if (message.type === 'completed') {
            isToolRunning = false;
            document.getElementById('status').textContent = '✅ Completed!';
          }
        });
        
        messagePort.onDisconnect.addListener(() => {
          messagePort = null;
          isToolRunning = false;
        });
      } catch (connectError) {
        console.error('Error connecting to content script:', connectError);
        alert('Error connecting to tool. Please try again.');
      }
    }, 100);
  } catch (error) {
    console.error('Error injecting script:', error);
    alert('Error starting tool. Please make sure you are on the Chase offers page.');
    // Reset UI on error
    document.getElementById('tool_panel').classList.remove('active');
    document.getElementById('start').style.display = 'block';
  }
});

// Speed control
document.getElementById('speed-control').addEventListener('change', (event) => {
  if (messagePort) {
    messagePort.postMessage({
      type: 'speed-change',
      speed: parseInt(event.target.value)
    });
  }
});

// Start button in tool panel
document.getElementById('start-btn').addEventListener('click', () => {
  if (messagePort && !isToolRunning) {
    messagePort.postMessage({ type: 'start' });
    isToolRunning = true;
  }
});

// Stop button in tool panel
document.getElementById('stop-btn').addEventListener('click', () => {
  if (messagePort && isToolRunning) {
    messagePort.postMessage({ type: 'stop' });
    isToolRunning = false;
  }
});
