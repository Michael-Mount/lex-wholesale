(() => {
  if (window.__lexCartStateSyncInstalled) {
    return;
  }

  window.__lexCartStateSyncInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  let refreshTimer = null;

  function getLocaleRoot() {
    return window.Shopify?.routes?.root ?? "/";
  }

  function updateCartCount(count) {
    const parsedCount = Number(count);
    const safeCount = Number.isFinite(parsedCount) ? parsedCount : 0;

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = String(safeCount);
      element.hidden = false;
    });

    document.querySelectorAll("[data-cart-drawer-open]").forEach((link) => {
      const itemWord = safeCount === 1 ? "item" : "items";
      link.setAttribute("aria-label", `Open cart, ${safeCount} ${itemWord}`);
    });
  }

  async function refreshCartCount() {
    try {
      const response = await nativeFetch(`${getLocaleRoot()}cart.js`, {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        return;
      }

      const cart = await response.json();
      updateCartCount(cart.item_count);
    } catch (error) {
      console.error("Unable to refresh the cart count.", error);
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshCartCount, 0);
  }

  function getRequestDetails(input, init = {}) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

    const method =
      init.method ??
      (input instanceof Request ? input.method : "GET");

    return {
      url,
      method: String(method).toUpperCase(),
    };
  }

  function isCartMutation(input, init) {
    const { url, method } = getRequestDetails(input, init);

    if (method !== "POST") {
      return false;
    }

    return /\/cart\/(add|change|update|clear)\.js(?:\?|$)/.test(url);
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);

    if (response.ok && isCartMutation(args[0], args[1])) {
      scheduleRefresh();
    }

    return response;
  };

  document.addEventListener("cart:updated", (event) => {
    const cart = event.detail?.cart;

    if (cart && typeof cart.item_count !== "undefined") {
      updateCartCount(cart.item_count);
      return;
    }

    scheduleRefresh();
  });

  document.addEventListener("DOMContentLoaded", scheduleRefresh);
  window.addEventListener("pageshow", scheduleRefresh);
})();
