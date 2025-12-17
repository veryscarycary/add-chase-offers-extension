// Helper function to find element by selector, traversing shadow roots
function findElementInShadowRoot(root, selector) {
  // Try to find in the current root
  let element = root.querySelector ? root.querySelector(selector) : null;
  if (element) return element;

  // If not found, check all elements with shadow roots
  const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const el of allElements) {
    if (el.shadowRoot) {
      element = findElementInShadowRoot(el.shadowRoot, selector);
      if (element) return element;
    }
  }

  return null;
}

// Helper function to find element by ID, traversing shadow roots
function getElementByIdInShadowRoot(id) {
  // First try regular document
  let element = document.getElementById(id);
  if (element) return element;

  // Search through all shadow roots
  return findElementInShadowRoot(document, `#${id}`);
}

// Helper function to find all elements by selector, traversing shadow roots
function querySelectorAllInShadowRoot(root, selector) {
  const results = [];
  
  // Find in current root
  if (root.querySelectorAll) {
    const matches = root.querySelectorAll(selector);
    results.push(...Array.from(matches));
  }

  // Search in all shadow roots
  const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const el of allElements) {
    if (el.shadowRoot) {
      const shadowResults = querySelectorAllInShadowRoot(el.shadowRoot, selector);
      results.push(...shadowResults);
    }
  }

  return results;
}

