(() => {
  let requestInFlight = false;

  document.addEventListener("click", handleCartClick);
  document.addEventListener("change", handleQuantityChange);

  function getMainCart() {
    return document.querySelector("[data-main-cart]");
  }

  function getCartDrawer() {
    return document.querySelector("[data-cart-drawer]");
  }

  function getLocaleRoot() {
    return window.Shopify?.routes?.root ?? "/";
  }

  function getSectionContext() {
    const mainCart = getMainCart();
    const cartDrawer = getCartDrawer();

    return {
      mainCart,
      mainCartSectionId: mainCart?.dataset.sectionId ?? "",
      cartDrawerSectionId: cartDrawer?.dataset.sectionId ?? "",
    };
  }

  function getRequestedSectionIds(context) {
    return [context.mainCartSectionId, context.cartDrawerSectionId].filter(
      Boolean,
    );
  }

  function setCartBusy(isBusy) {
    const mainCart = getMainCart();

    if (!mainCart) {
      return;
    }

    mainCart.classList.toggle("main-cart--loading", isBusy);

    if (isBusy) {
      mainCart.setAttribute("aria-busy", "true");
    } else {
      mainCart.removeAttribute("aria-busy");
    }

    mainCart.querySelectorAll("[data-cart-control]").forEach((control) => {
      control.disabled = isBusy;
    });
  }

  function setCartStatus(message, isError = false) {
    const status = getMainCart()?.querySelector("[data-cart-status]");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.toggle("main-cart__status--error", isError);
  }

  function updateHeaderCount(itemCount) {
    const safeCount = Number.isFinite(itemCount) ? itemCount : 0;

    document.querySelectorAll("[data-cart-count]").forEach((countElement) => {
      countElement.textContent = String(safeCount);
    });

    document.querySelectorAll("[data-cart-drawer-open]").forEach((trigger) => {
      trigger.setAttribute(
        "aria-label",
        `Open cart, ${safeCount} ${safeCount === 1 ? "item" : "items"}`,
      );
    });
  }

  async function requestCart(endpoint, payload) {
    const response = await fetch(`${getLocaleRoot()}cart/${endpoint}.js`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        responseData.description ||
          responseData.message ||
          "The cart could not be updated.",
      );
    }

    return responseData;
  }

  function replaceMainCartSection(sectionId, html) {
    if (!sectionId || !html) {
      return false;
    }

    const wrapperId = `shopify-section-${sectionId}`;
    const currentWrapper = document.getElementById(wrapperId);

    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    const updatedWrapper = parsedDocument.getElementById(wrapperId);

    if (!currentWrapper || !updatedWrapper) {
      return false;
    }

    currentWrapper.replaceWith(updatedWrapper);

    return true;
  }

  function updateRenderedSections(
    responseData,
    context,
    {
      openDrawer = false,
      focusSelector = "",
      successMessage = "Cart updated.",
    } = {},
  ) {
    const mainCartHtml = responseData.sections?.[context.mainCartSectionId];

    const drawerHtml = responseData.sections?.[context.cartDrawerSectionId];

    const replacedMainCart = replaceMainCartSection(
      context.mainCartSectionId,
      mainCartHtml,
    );

    if (!replacedMainCart) {
      window.location.reload();
      return;
    }

    if (context.cartDrawerSectionId && drawerHtml) {
      document.dispatchEvent(
        new CustomEvent("cart:updated", {
          detail: {
            sectionId: context.cartDrawerSectionId,
            html: drawerHtml,
            open: openDrawer,
          },
        }),
      );
    } else {
      updateHeaderCount(responseData.item_count ?? 0);
    }

    setCartStatus(successMessage);

    if (focusSelector) {
      window.requestAnimationFrame(() => {
        document.querySelector(focusSelector)?.focus();
      });
    }
  }

  function handleCartClick(event) {
    const quantityButton = event.target.closest("[data-cart-quantity-adjust]");

    if (quantityButton) {
      event.preventDefault();

      const line = quantityButton.closest("[data-cart-line]");
      const input = line?.querySelector("[data-cart-quantity-input]");

      if (!line || !input) {
        return;
      }

      const currentQuantity = Number.parseInt(input.value, 10) || 0;

      const direction = quantityButton.dataset.cartQuantityAdjust;

      const nextQuantity =
        direction === "increase"
          ? currentQuantity + 1
          : Math.max(0, currentQuantity - 1);

      updateLineQuantity(line, nextQuantity);
      return;
    }

    const removeLink = event.target.closest("[data-cart-remove]");

    if (removeLink) {
      const line = removeLink.closest("[data-cart-line]");

      if (!line?.dataset.lineKey) {
        return;
      }

      event.preventDefault();
      updateLineQuantity(line, 0, true);
      return;
    }

    const saveNoteButton = event.target.closest("[data-cart-note-save]");

    if (saveNoteButton) {
      event.preventDefault();

      const note = getMainCart()?.querySelector("[data-cart-note]");

      if (!note) {
        return;
      }

      updateCartNote(note.value);
    }
  }

  function handleQuantityChange(event) {
    const input = event.target.closest("[data-cart-quantity-input]");

    if (!input) {
      return;
    }

    const line = input.closest("[data-cart-line]");

    if (!line?.dataset.lineKey) {
      return;
    }

    const parsedQuantity = Number.parseInt(input.value, 10);

    const nextQuantity = Number.isNaN(parsedQuantity)
      ? 0
      : Math.max(0, parsedQuantity);

    updateLineQuantity(line, nextQuantity);
  }

  async function updateLineQuantity(line, quantity, isRemoval = false) {
    if (requestInFlight) {
      return;
    }

    const lineKey = line.dataset.lineKey;
    const lineIndex = line.dataset.cartLineIndex;

    if (!lineKey) {
      return;
    }

    const context = getSectionContext();
    const sectionIds = getRequestedSectionIds(context);

    if (!context.mainCartSectionId) {
      return;
    }

    requestInFlight = true;
    setCartBusy(true);
    setCartStatus(isRemoval ? "Removing product…" : "Updating cart…");

    try {
      const responseData = await requestCart("change", {
        id: lineKey,
        quantity,
        sections: sectionIds,
        sections_url: `${window.location.pathname}${window.location.search}`,
      });

      const focusSelector =
        quantity > 0 && lineIndex
          ? `[data-cart-line-index="${lineIndex}"] ` +
            `[data-cart-quantity-input]`
          : "[data-cart-status]";

      updateRenderedSections(responseData, context, {
        focusSelector,
        successMessage:
          quantity === 0
            ? "Product removed from cart."
            : "Cart quantity updated.",
      });
    } catch (error) {
      console.error(error);

      setCartStatus(
        error instanceof Error
          ? error.message
          : "The cart could not be updated.",
        true,
      );
    } finally {
      requestInFlight = false;
      setCartBusy(false);
    }
  }

  async function updateCartNote(note) {
    if (requestInFlight) {
      return;
    }

    const context = getSectionContext();
    const sectionIds = getRequestedSectionIds(context);

    if (!context.mainCartSectionId) {
      return;
    }

    requestInFlight = true;
    setCartBusy(true);
    setCartStatus("Saving order note…");

    try {
      const responseData = await requestCart("update", {
        note,
        sections: sectionIds,
        sections_url: `${window.location.pathname}${window.location.search}`,
      });

      updateRenderedSections(responseData, context, {
        focusSelector: "[data-cart-note]",
        successMessage: "Order note saved.",
      });
    } catch (error) {
      console.error(error);

      setCartStatus(
        error instanceof Error
          ? error.message
          : "The order note could not be saved.",
        true,
      );
    } finally {
      requestInFlight = false;
      setCartBusy(false);
    }
  }
})();
