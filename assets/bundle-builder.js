(() => {
  document.addEventListener("click", handleBundleSubmit);
  document.addEventListener("change", handleVariantChange);

  function getLocaleRoot() {
    return window.Shopify?.routes?.root ?? "/";
  }

  function createBundleId(handle) {
    const randomPart =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${handle}-${randomPart}`;
  }

  function setStatus(builder, message, isError = false) {
    const status = builder.querySelector("[data-bundle-status]");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.toggle("bundle-collection__status--error", isError);
  }

  function setSubmitting(builder, isSubmitting) {
    const button = builder.querySelector("[data-bundle-submit]");
    const buttonText = button?.querySelector("[data-bundle-submit-text]");

    if (!button) {
      return;
    }

    if (!button.dataset.originalText && buttonText) {
      button.dataset.originalText = buttonText.textContent.trim();
    }

    button.disabled = isSubmitting;

    if (buttonText) {
      buttonText.textContent = isSubmitting
        ? "Adding collection…"
        : button.dataset.originalText;
    }

    builder.classList.toggle("bundle-collection--loading", isSubmitting);

    if (isSubmitting) {
      builder.setAttribute("aria-busy", "true");
    } else {
      builder.removeAttribute("aria-busy");
    }
  }

  function getSelectedVariantElements(builder) {
    return Array.from(builder.querySelectorAll("[data-bundle-variant]"));
  }

  function buildCartItems(builder) {
    const variantElements = getSelectedVariantElements(builder);

    const bundleHandle = builder.dataset.bundleHandle ?? "collection";

    const bundleTitle = builder.dataset.bundleTitle ?? "Complete collection";

    const parsedQuantity = Number.parseInt(
      builder.dataset.bundleQuantity ?? "1",
      10,
    );

    const quantity =
      Number.isNaN(parsedQuantity) || parsedQuantity < 1 ? 1 : parsedQuantity;

    const bundleId = createBundleId(bundleHandle);

    return variantElements.map((element, index) => {
      const variantId = Number.parseInt(element.value, 10);
      const productTitle =
        element.dataset.productTitle ?? `Product ${index + 1}`;

      if (!Number.isInteger(variantId) || variantId <= 0) {
        throw new Error(`Choose an available option for ${productTitle}.`);
      }

      return {
        id: variantId,
        quantity,
        properties: {
          _bundle_id: bundleId,
          _bundle_handle: bundleHandle,
          _bundle_title: bundleTitle,
          _bundle_component_position: String(index + 1),
        },
      };
    });
  }

  function handleVariantChange(event) {
    const selector = event.target.closest("select[data-bundle-variant]");

    if (!selector) {
      return;
    }

    const selectedOption = selector.options[selector.selectedIndex];

    const productCard = selector.closest("[data-bundle-product]");

    const priceOutput = productCard?.querySelector(
      "[data-bundle-selected-price]",
    );

    if (!priceOutput || !selectedOption) {
      return;
    }

    /*
      We intentionally don't format the integer price in JavaScript yet.
      The option label already contains Shopify-formatted money.
      A later lesson can add a locale-aware money formatter.
    */
  }

  async function handleBundleSubmit(event) {
    const button = event.target.closest("[data-bundle-submit]");

    if (!button) {
      return;
    }

    const builder = button.closest("[data-bundle-builder]");

    if (!builder || button.disabled) {
      return;
    }

    setStatus(builder, "");
    setSubmitting(builder, true);

    try {
      const items = buildCartItems(builder);

      if (items.length === 0) {
        throw new Error(
          "This collection does not contain any bundle products.",
        );
      }

      const cartDrawer = document.querySelector("[data-cart-drawer]");

      const cartDrawerSectionId = cartDrawer?.dataset.sectionId ?? "";

      const payload = {
        items,
      };

      if (cartDrawerSectionId) {
        payload.sections = [cartDrawerSectionId];
        payload.sections_url = `${window.location.pathname}${window.location.search}`;
      }

      const response = await fetch(`${getLocaleRoot()}cart/add.js`, {
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
            "The collection could not be added to the cart.",
        );
      }

      setStatus(
        builder,
        `${items.length} collection products were added to your cart.`,
      );

      const drawerHtml = responseData.sections?.[cartDrawerSectionId];

      if (cartDrawerSectionId && drawerHtml) {
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: {
              sectionId: cartDrawerSectionId,
              html: drawerHtml,
              open: true,
            },
          }),
        );
      } else {
        window.location.assign(`${getLocaleRoot()}cart`);
      }
    } catch (error) {
      console.error(error);

      setStatus(
        builder,
        error instanceof Error
          ? error.message
          : "The collection could not be added to the cart.",
        true,
      );
    } finally {
      setSubmitting(builder, false);
    }
  }
})();
