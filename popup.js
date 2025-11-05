document.getElementById('go_to_offers').addEventListener('click', () => {
  const chaseOffersUrl = 'https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offerCategoriesPage?offerCategoryName=ALL';
  window.open(chaseOffersUrl, '_blank');
});

document.getElementById('start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['index.js']
  });
});
