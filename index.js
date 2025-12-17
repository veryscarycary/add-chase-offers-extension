const originalUrl = window.location.href;
let isRunning = false;
let delayTime = 1000; // Default to Fast (1 sec delay)
let currentCardIndex = 0;
let creditCards = [];
let isProcessingCard = false;

// Set up message port connection with popup
let popupPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup-connection') {
    popupPort = port;

    port.onDisconnect.addListener(() => {
      popupPort = null;
      isRunning = false;
    });

    // Listen for messages from popup
    port.onMessage.addListener((message) => {
      if (message.type === 'start') {
        if (!isRunning) {
          isRunning = true;
          startMultiCardProcess();
        }
      } else if (message.type === 'stop') {
        isRunning = false;
        isProcessingCard = false;
        sendStatus('⏹️ Stopped');
      } else if (message.type === 'speed-change') {
        delayTime = message.speed;
      }
    });
  }
});

// Helper function to send status updates to popup
function sendStatus(status) {
  if (popupPort) {
    popupPort.postMessage({ type: 'status', status });
  }
}

// Helper function to send progress updates to popup
function sendProgress(offersLeft, timeLeft) {
  if (popupPort) {
    popupPort.postMessage({
      type: 'progress',
      offersLeft: offersLeft,
      timeLeft: timeLeft
    });
  }
}

// Detect and get all credit cards
async function detectCreditCards() {
  try {
    // Find the credit card selector (traversing shadow roots)
    const selector = getElementByIdInShadowRoot('select-select-credit-card-account');
    if (!selector) {
      console.log('⚠️ Credit card selector not found');
      return [];
    }

    // Click to open the dropdown
    selector.click();

    // Wait for dropdown to open
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find all card options (traversing shadow roots)
    const cardOptions = querySelectorAllInShadowRoot(document, 'mds-select-option');
    const cards = [];

    cardOptions.forEach((option, index) => {
      const cardName = option.textContent?.trim() || `Card ${index + 1}`;
      cards.push({
        index: index,
        name: cardName,
        element: option
      });
    });

    // Close the dropdown by clicking outside or pressing escape
    if (cardOptions.length > 0) {
      document.body.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`📋 Found ${cards.length} credit card(s)`);
    return cards;
  } catch (error) {
    console.error('Error detecting credit cards:', error);
    return [];
  }
}

// Start the multi-card process
async function startMultiCardProcess() {
  if (!isRunning) return;

  // First, detect all credit cards
  creditCards = await detectCreditCards();

  if (creditCards.length === 0) {
    console.log('⚠️ No credit cards found. Running single-card mode...');
    // Fallback to original behavior
    clickAndReturn();
    return;
  }

  // Send cards list to popup
  if (popupPort) {
    popupPort.postMessage({
      type: 'cards-detected',
      cards: creditCards
    });
  }

  // Start processing the first card
  currentCardIndex = 0;
  await processCard(currentCardIndex);
}

// Process offers for a specific card
async function processCard(cardIndex) {
  if (!isRunning || cardIndex >= creditCards.length) {
    // All cards processed
    isRunning = false;
    sendStatus('✅ All cards completed!');
    if (popupPort) {
      popupPort.postMessage({ type: 'completed' });
    }
    return;
  }

  isProcessingCard = true;
  const card = creditCards[cardIndex];

  console.log(`💳 Processing card ${cardIndex + 1}/${creditCards.length}: ${card.name}`);

  // Notify popup that we're processing this card
  if (popupPort) {
    popupPort.postMessage({
      type: 'card-processing',
      cardIndex: cardIndex
    });
  }

  // Click the credit card selector to open dropdown (traversing shadow roots)
  const selector = getElementByIdInShadowRoot('select-select-credit-card-account');
  if (selector) {
    selector.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Find and click the specific card option (traversing shadow roots)
  const cardOptions = querySelectorAllInShadowRoot(document, 'mds-select-option');
  if (cardOptions[cardIndex]) {
    cardOptions[cardIndex].click();
    console.log(`✅ Selected card: ${card.name}`);

    // Wait for the page to update with the selected card's offers
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Now process all offers for this card
  await clickAndReturnForCard(cardIndex);
}

// Process offers for the current card
function clickAndReturnForCard(cardIndex, attempts = 0) {
  if (!isRunning || !isProcessingCard) {
    sendStatus('⏹️ Stopped');
    return;
  }

  const buttons = querySelectorAllInShadowRoot(document, '[data-cy="commerce-tile-button"]');

  if (buttons.length > 0) {
    const offersLeft = buttons.length;
    const minTimeSec = ((offersLeft * (delayTime / 2)) / 1000).toFixed(0);
    const maxTimeSec = ((offersLeft * delayTime) / 1000).toFixed(0);

    sendProgress(`${offersLeft}`, `${minTimeSec}-${maxTimeSec} sec`);
    sendStatus(`✅ Processing card ${cardIndex + 1}...`);

    console.log(`📌 Clicking an offer... (${offersLeft} remaining for card ${cardIndex + 1})`);
    console.log(`⏳ Estimated time left: ${minTimeSec}-${maxTimeSec} seconds`);

    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    let backDelay = Math.floor(Math.random() * (delayTime / 2)) + delayTime;
    setTimeout(() => {
      console.log('🔄 Returning to original page...');
      window.location.href = originalUrl;

      let reloadDelay = Math.floor(Math.random() * (delayTime / 2)) + delayTime;
      setTimeout(() => {
        if (isRunning && isProcessingCard) {
          console.log('⏳ Waiting before next click...');
          clickAndReturnForCard(cardIndex);
        }
      }, reloadDelay);
    }, backDelay);
  } else {
    if (attempts < 3) {
      console.log(`⚠️ No buttons detected. Retrying (${attempts + 1}/3)...`);
      setTimeout(() => clickAndReturnForCard(cardIndex, attempts + 1), 2000);
    } else {
      // All offers for this card are done
      console.log(`✅ All offers added for card ${cardIndex + 1}!`);

      // Mark card as completed
      if (popupPort) {
        popupPort.postMessage({
          type: 'card-completed',
          cardIndex: cardIndex
        });
      }

      isProcessingCard = false;

      // Move to next card
      currentCardIndex++;
      if (currentCardIndex < creditCards.length && isRunning) {
        setTimeout(() => {
          processCard(currentCardIndex);
        }, 1000);
      } else {
        // All cards processed
        isRunning = false;
        sendStatus('✅ All cards completed!');
        if (popupPort) {
          popupPort.postMessage({ type: 'completed' });
        }
      }
    }
  }
}

// Original function for single-card mode (fallback)
function clickAndReturn(attempts = 0) {
  if (!isRunning) {
    sendStatus('⏹️ Stopped');
    return;
  }

  const buttons = querySelectorAllInShadowRoot(document, '[data-cy="commerce-tile-button"]');

  if (buttons.length > 0) {
    const offersLeft = buttons.length;
    const minTimeSec = ((offersLeft * (delayTime / 2)) / 1000).toFixed(0);
    const maxTimeSec = ((offersLeft * delayTime) / 1000).toFixed(0);

    sendProgress(`${offersLeft}`, `${minTimeSec}-${maxTimeSec} sec`);
    sendStatus('✅ Running...');

    console.log(`📌 Clicking an offer... (${offersLeft} remaining)`);
    console.log(`⏳ Estimated time left: ${minTimeSec}-${maxTimeSec} seconds`);

    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    let backDelay = Math.floor(Math.random() * (delayTime / 2)) + delayTime;
    setTimeout(() => {
      console.log('🔄 Returning to original page...');
      window.location.href = originalUrl;

      let reloadDelay = Math.floor(Math.random() * (delayTime / 2)) + delayTime;
      setTimeout(() => {
        if (isRunning) {
          console.log('⏳ Waiting before next click...');
          clickAndReturn();
        }
      }, reloadDelay);
    }, backDelay);
  } else {
    if (attempts < 3) {
      console.log(`⚠️ No buttons detected. Retrying (${attempts + 1}/3)...`);
      setTimeout(() => clickAndReturn(attempts + 1), 2000);
    } else {
      console.log('✅ All offers added! (or no more found)');
      isRunning = false;
      sendStatus('✅ Completed!');
      if (popupPort) {
        popupPort.postMessage({ type: 'completed' });
      }
    }
  }
}

console.log('🚀 Auto Add Offers script loaded! Use the extension popup to start.');