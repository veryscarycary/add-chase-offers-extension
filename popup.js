const chaseOffersUrl = 'https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub';

// Initialize tool panel and connect to content script
async function initializeToolPanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Show the tool panel
  document.getElementById('tool_panel').classList.add('active');
  document.getElementById('url_warning').style.display = 'none';
  document.getElementById('go_to_offers').style.display = 'none';
  
  // Initialize status display
  document.getElementById('status').textContent = '⏹️ Stopped';
  document.getElementById('progress').textContent = '--';
  document.getElementById('timeLeft').textContent = '--';
  
  // Initialize button states (Start enabled, Stop disabled)
  isToolRunning = false;
  updateButtonStates();
  
  // Inject the content scripts (helpers first, then main script)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['helpers.js', 'index.js']
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
            document.getElementById('progress').textContent = '0';
            document.getElementById('timeLeft').textContent = '0';
            updateButtonStates();
          } else if (message.type === 'cards-detected') {
            displayCards(message.cards);
          } else if (message.type === 'card-completed') {
            markCardCompleted(message.cardIndex);
          } else if (message.type === 'card-processing') {
            markCardProcessing(message.cardIndex);
          }
        });
        
        messagePort.onDisconnect.addListener(() => {
          messagePort = null;
          isToolRunning = false;
          updateButtonStates();
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
    document.getElementById('go_to_offers').style.display = 'block';
  }
}

// Check if current tab URL matches Chase offers URL
async function checkUrlAndUpdateUI() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const urlWarning = document.getElementById('url_warning');
  const goToOffers = document.getElementById('go_to_offers');
  const toolPanel = document.getElementById('tool_panel');
  
  if (tab && tab.url && tab.url.includes('secure.chase.com') && tab.url.includes('merchantOffers')) {
    // URL matches - hide go to offers button and warning, show tool panel directly
    urlWarning.style.display = 'none';
    goToOffers.style.display = 'none';
    toolPanel.classList.add('active');
    // Initialize tool panel automatically
    await initializeToolPanel();
  } else {
    // URL doesn't match - show go to offers button and warning, hide tool panel
    urlWarning.style.display = 'block';
    goToOffers.style.display = 'block';
    toolPanel.classList.remove('active');
  }
}

// Initialize on load
checkUrlAndUpdateUI();

// Go to offers button handler
document.getElementById('go_to_offers').addEventListener('click', () => {
  window.open(chaseOffersUrl, '_blank');
});

let isToolRunning = false;
let messagePort = null;

// Update button states based on running status
function updateButtonStates() {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  
  if (isToolRunning) {
    // Process is running - disable Start, enable Stop
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    // Process is stopped - enable Start, disable Stop
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

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
    updateButtonStates();
  }
});

// Stop button in tool panel
document.getElementById('stop-btn').addEventListener('click', () => {
  if (messagePort && isToolRunning) {
    messagePort.postMessage({ type: 'stop' });
    isToolRunning = false;
    updateButtonStates();
  }
});

// Display credit cards list
function displayCards(cards) {
  const cardsSection = document.getElementById('cards_section');
  const cardsList = document.getElementById('cards_list');
  
  if (cards && cards.length > 0) {
    cardsSection.style.display = 'block';
    cardsList.innerHTML = '';
    
    cards.forEach((card, index) => {
      const cardItem = document.createElement('li');
      cardItem.className = 'card-item';
      cardItem.id = `card-${index}`;
      cardItem.innerHTML = `
        <span class="card-checkmark pending">○</span>
        <span class="card-name">${card.name || `Card ${index + 1}`}</span>
      `;
      cardsList.appendChild(cardItem);
    });
  }
}

// Mark a card as completed
function markCardCompleted(cardIndex) {
  const cardItem = document.getElementById(`card-${cardIndex}`);
  if (cardItem) {
    const checkmark = cardItem.querySelector('.card-checkmark');
    checkmark.textContent = '✅';
    checkmark.classList.remove('pending', 'rotating');
    checkmark.classList.add('completed');
  }
}

// Mark a card as currently processing
function markCardProcessing(cardIndex) {
  const cardItem = document.getElementById(`card-${cardIndex}`);
  if (cardItem) {
    const checkmark = cardItem.querySelector('.card-checkmark');
    checkmark.textContent = '⟳';
    checkmark.classList.remove('completed');
    checkmark.classList.add('pending', 'rotating');
  }
}
