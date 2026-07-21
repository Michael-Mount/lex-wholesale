(() => {
  let returnFocusElement = null;

  function getDrawer() {
    return document.querySelector("[data-cart-drawer]");
  }

  function updateCartTriggers(drawer = getDrawer()) {
    const parsedCount = Number.parseInt(drawer?.dataset.cartCount ?? "0", 10);

    const itemCount = Number.isNaN(parsedCount) ? 0 : parsedCount;

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = String(itemCount);
    });

    document.querySelectorAll("[data-cart-drawer-open]").forEach((trigger) => {
      trigger.setAttribute(
        "aria-label",
        `Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`,
      );
    });
  }

  function openDrawer(drawer = getDrawer(), focusReturnTarget = null) {
    if (!drawer || typeof drawer.showModal !== "function") {
      return false;
    }

    if (focusReturnTarget instanceof HTMLElement) {
      returnFocusElement = focusReturnTarget;
    } else if (document.activeElement instanceof HTMLElement) {
      returnFocusElement = document.activeElement;
    }

    if (!drawer.open) {
      drawer.showModal();
    }

    document.documentElement.classList.add("cart-drawer-open");

    return true;
  }

  function closeDrawer(drawer = getDrawer()) {
    if (!drawer?.open) {
      return;
    }

    drawer.close();
  }

  function replaceDrawerSection({ sectionId, html, open = false }) {
    if (!sectionId || !html) {
      return;
    }

    const wrapperId = `shopify-section-${sectionId}`;
    const currentWrapper = document.getElementById(wrapperId);

    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    const updatedWrapper = parsedDocument.getElementById(wrapperId);

    if (!currentWrapper || !updatedWrapper) {
      console.error("The updated cart drawer section was not found.");
      return;
    }

    const previousDrawer = currentWrapper.querySelector("[data-cart-drawer]");

    const wasOpen = Boolean(previousDrawer?.open);

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    currentWrapper.replaceWith(updatedWrapper);

    const updatedDrawer = getDrawer();

    updateCartTriggers(updatedDrawer);

    if (open || wasOpen) {
      openDrawer(updatedDrawer, previousFocus);
    }
  }

  document.addEventListener("cart:updated", (event) => {
    replaceDrawerSection(event.detail);
  });

  document.addEventListener("click", (event) => {
    const openTrigger = event.target.closest("[data-cart-drawer-open]");

    if (openTrigger) {
      const didOpen = openDrawer(getDrawer(), openTrigger);

      if (didOpen) {
        event.preventDefault();
      }

      return;
    }

    const closeTrigger = event.target.closest("[data-cart-drawer-close]");

    if (closeTrigger) {
      closeDrawer();
      return;
    }

    const drawer = getDrawer();

    if (drawer && event.target === drawer) {
      closeDrawer(drawer);
    }
  });

  document.addEventListener(
    "close",
    (event) => {
      if (!event.target.matches("[data-cart-drawer]")) {
        return;
      }

      document.documentElement.classList.remove("cart-drawer-open");

      if (
        returnFocusElement instanceof HTMLElement &&
        returnFocusElement.isConnected
      ) {
        returnFocusElement.focus();
      }

      returnFocusElement = null;
    },
    true,
  );

  document.addEventListener("DOMContentLoaded", () => {
    updateCartTriggers();
  });
})();
