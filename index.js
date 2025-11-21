const originalUrl = window.location.href;
let isRunning = false;
let delayTime = 1000; // Default to Fast (1 sec delay)

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
          clickAndReturn();
        }
      } else if (message.type === 'stop') {
        isRunning = false;
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

function clickAndReturn(attempts = 0) {
    if (!isRunning) {
        sendStatus('⏹️ Stopped');
        return;
    }

    const buttons = document.querySelectorAll('[data-cy="commerce-tile-button"]');

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