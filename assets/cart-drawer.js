(() => {
  /*
    Cart drawer controller.

    Important:
    We preserve the existing <dialog> element when new section HTML arrives.
    Replacing an open dialog node can leave the browser's modal backdrop/top
    layer in an inconsistent state.
  */

  if (window.__lexCartDrawerInitialized) {
    return;
  }

  window.__lexCartDrawerInitialized = true;

  let lastCartTrigger = null;

  function getLocaleRoot() {
    return window.Shopify?.routes?.root ?? "/";
  }

  function getCartDrawer() {
    return document.querySelector("dialog[data-cart-drawer]");
  }

  function updateCartCount(count) {
    const parsedCount = Number(count);
    const safeCount = Number.isFinite(parsedCount) ? parsedCount : 0;

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = String(safeCount);
    });

    document.querySelectorAll("[data-cart-drawer-open]").forEach((trigger) => {
      const itemLabel = safeCount === 1 ? "item" : "items";

      trigger.setAttribute(
        "aria-label",
        `Open cart, ${safeCount} ${itemLabel}`,
      );
    });
  }

  async function fetchCart() {
    const response = await fetch(`${getLocaleRoot()}cart.js`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to load cart: ${response.status}`);
    }

    return response.json();
  }

  function parseDrawerFromHtml(html) {
    if (typeof html !== "string" || html.trim() === "") {
      return null;
    }

    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    return parsedDocument.querySelector("dialog[data-cart-drawer]");
  }

  function copyDrawerAttributes(currentDrawer, nextDrawer) {
    const attributesToKeep = new Set(["open"]);

    Array.from(currentDrawer.attributes).forEach((attribute) => {
      if (!attributesToKeep.has(attribute.name)) {
        currentDrawer.removeAttribute(attribute.name);
      }
    });

    Array.from(nextDrawer.attributes).forEach((attribute) => {
      if (attribute.name !== "open") {
        currentDrawer.setAttribute(attribute.name, attribute.value);
      }
    });
  }

  function updateCartDrawer(html) {
    const nextDrawer = parseDrawerFromHtml(html);
    let currentDrawer = getCartDrawer();

    if (!nextDrawer) {
      return currentDrawer;
    }

    /*
      Keep the currently connected dialog element. Only replace its attributes
      and children. This prevents a detached modal from leaving a backdrop in
      the browser's top layer.
    */
    if (currentDrawer) {
      if (currentDrawer.open) {
        currentDrawer.close();
      }

      document.documentElement.classList.remove("cart-drawer-open");

      copyDrawerAttributes(currentDrawer, nextDrawer);
      currentDrawer.replaceChildren(
        ...Array.from(nextDrawer.childNodes).map((node) =>
          document.importNode(node, true),
        ),
      );

      return currentDrawer;
    }

    currentDrawer = document.importNode(nextDrawer, true);
    document.body.append(currentDrawer);

    return currentDrawer;
  }

  function closeOtherCartDrawers(activeDrawer) {
    document
      .querySelectorAll("dialog[data-cart-drawer][open]")
      .forEach((drawer) => {
        if (drawer !== activeDrawer && drawer instanceof HTMLDialogElement) {
          drawer.close();
        }
      });
  }

  function openCartDrawer(drawer = getCartDrawer()) {
    if (!(drawer instanceof HTMLDialogElement)) {
      return;
    }

    closeOtherCartDrawers(drawer);

    if (!drawer.open) {
      try {
        drawer.showModal();
      } catch (error) {
        console.error("Unable to open the cart drawer.", error);

        /*
          Fail safely: do not leave the page locked behind a backdrop or
          cart-drawer-open class.
        */
        document.documentElement.classList.remove("cart-drawer-open");
        return;
      }
    }

    document.documentElement.classList.add("cart-drawer-open");

    window.requestAnimationFrame(() => {
      drawer.querySelector("[data-cart-drawer-close]")?.focus();
    });
  }

  function closeCartDrawer(drawer = getCartDrawer()) {
    if (drawer instanceof HTMLDialogElement && drawer.open) {
      drawer.close();
    }

    /*
      Remove this immediately instead of waiting for the dialog close event.
      This prevents a stale page-lock class from blocking interaction.
    */
    document.documentElement.classList.remove("cart-drawer-open");
  }

  function cleanupModalState() {
    const drawer = getCartDrawer();

    if (!(drawer instanceof HTMLDialogElement) || !drawer.open) {
      document.documentElement.classList.remove("cart-drawer-open");
    }
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const openTrigger = event.target.closest("[data-cart-drawer-open]");

    if (openTrigger) {
      const drawer = getCartDrawer();

      if (drawer instanceof HTMLDialogElement) {
        event.preventDefault();
        lastCartTrigger = openTrigger;
        openCartDrawer(drawer);
      }

      return;
    }

    const closeTrigger = event.target.closest("[data-cart-drawer-close]");

    if (closeTrigger) {
      event.preventDefault();
      closeCartDrawer(closeTrigger.closest("dialog[data-cart-drawer]"));
      return;
    }

    const drawer = event.target.closest("dialog[data-cart-drawer]");

    /*
      With a native <dialog>, a click on the backdrop is reported with the
      dialog itself as the event target.
    */
    if (drawer instanceof HTMLDialogElement && event.target === drawer) {
      closeCartDrawer(drawer);
    }
  });

  document.addEventListener(
    "close",
    (event) => {
      if (!(event.target instanceof HTMLDialogElement)) {
        return;
      }

      if (!event.target.matches("dialog[data-cart-drawer]")) {
        return;
      }

      document.documentElement.classList.remove("cart-drawer-open");

      if (lastCartTrigger instanceof HTMLElement) {
        lastCartTrigger.focus();
      }
    },
    true,
  );

  document.addEventListener("cart:updated", async (event) => {
    const detail = event.detail ?? {};
    let drawer = getCartDrawer();

    if (typeof detail.html === "string" && detail.html.trim() !== "") {
      drawer = updateCartDrawer(detail.html);
    }

    let cart = detail.cart ?? null;

    if (!cart) {
      try {
        cart = await fetchCart();
      } catch (error) {
        console.error(error);
      }
    }

    if (cart && typeof cart.item_count !== "undefined") {
      updateCartCount(cart.item_count);
    } else if (drawer?.dataset.cartCount) {
      updateCartCount(drawer.dataset.cartCount);
    }

    if (detail.open === true) {
      openCartDrawer(drawer);
    } else {
      cleanupModalState();
    }
  });

  /*
    Protect against browser back/forward cache restoring a stale modal class.
  */
  window.addEventListener("pageshow", cleanupModalState);

  document.addEventListener("DOMContentLoaded", cleanupModalState);
})();
