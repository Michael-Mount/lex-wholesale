(() => {
  if (customElements.get("collection-add-all")) {
    return;
  }

  class CollectionAddAll extends HTMLElement {
    constructor() {
      super();

      this.isSubmitting = false;
      this.handleSubmit = this.handleSubmit.bind(this);
      this.handleVariantChange = this.handleVariantChange.bind(this);
    }

    connectedCallback() {
      this.submitButton = this.querySelector("[data-collection-submit]");
      this.statusElement = this.querySelector("[data-collection-status]");

      this.submitButton?.addEventListener("click", this.handleSubmit);
      this.addEventListener("change", this.handleVariantChange);
    }

    disconnectedCallback() {
      this.submitButton?.removeEventListener("click", this.handleSubmit);
      this.removeEventListener("change", this.handleVariantChange);
    }

    getLocaleRoot() {
      return window.Shopify?.routes?.root ?? "/";
    }

    getVariantElements() {
      return Array.from(this.querySelectorAll("[data-collection-variant]"));
    }

    parsePositiveInteger(value, fallback = 1) {
      const parsedValue = Number.parseInt(value ?? "", 10);

      if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        return fallback;
      }

      return parsedValue;
    }

    createBundleId() {
      const handle = this.dataset.collectionHandle || "collection";
      const uniqueValue =
        typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      return `${handle}-${uniqueValue}`;
    }

    setStatus(message, isError = false) {
      if (!this.statusElement) {
        return;
      }

      this.statusElement.textContent = message;
      this.statusElement.classList.toggle(
        "main-collection__status--error",
        isError,
      );
    }

    setSubmitting(isSubmitting) {
      this.isSubmitting = isSubmitting;

      if (!this.submitButton) {
        return;
      }

      const textElement = this.submitButton.querySelector(
        "[data-collection-submit-text]",
      );

      if (!this.submitButton.dataset.originalText && textElement) {
        this.submitButton.dataset.originalText = textElement.textContent.trim();
      }

      this.submitButton.disabled = isSubmitting;
      this.classList.toggle("collection-add-all--loading", isSubmitting);

      if (isSubmitting) {
        this.setAttribute("aria-busy", "true");
      } else {
        this.removeAttribute("aria-busy");
      }

      if (textElement) {
        textElement.textContent = isSubmitting
          ? this.dataset.addingMessage || "Adding complete collection…"
          : this.submitButton.dataset.originalText;
      }
    }

    buildItems() {
      const variantElements = this.getVariantElements();
      const expectedProductCount = this.parsePositiveInteger(
        this.dataset.productCount,
        0,
      );

      if (variantElements.length === 0) {
        throw new Error(
          "No purchasable products were found in this collection.",
        );
      }

      if (
        expectedProductCount > 0 &&
        variantElements.length !== expectedProductCount
      ) {
        throw new Error(
          "Every product must have an available selected variant before the collection can be added.",
        );
      }

      const quantity = this.parsePositiveInteger(
        this.dataset.quantityPerProduct,
        1,
      );

      const bundleId = this.createBundleId();
      const bundleHandle = this.dataset.collectionHandle || "collection";
      const bundleTitle = this.dataset.collectionTitle || "Complete collection";
      const componentCount = variantElements.length;

      return variantElements.map((element, index) => {
        const variantId = Number.parseInt(element.value, 10);
        const productTitle =
          element.dataset.productTitle || `Product ${index + 1}`;

        if (!Number.isInteger(variantId) || variantId < 1) {
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
            _bundle_component_count: String(componentCount),
            _bundle_quantity_per_product: String(quantity),
            _bundle_schema_version: "1",
          },
        };
      });
    }

    getCartDrawerDetails() {
      const drawer = document.querySelector("[data-cart-drawer]");

      if (!drawer) {
        return {
          sectionId: "",
          drawer: null,
        };
      }

      return {
        sectionId: drawer.dataset.sectionId || "",
        drawer,
      };
    }

    updateSelectedPrice(selector) {
      const selectedOption =
        selector instanceof HTMLSelectElement
          ? selector.options[selector.selectedIndex]
          : selector;

      if (!selectedOption) {
        return;
      }

      const productCard = selector.closest("[data-collection-product]");

      if (!productCard) {
        return;
      }

      const currentPrice = productCard.querySelector(
        "[data-collection-current-price]",
      );

      const comparePrice = productCard.querySelector(
        "[data-collection-compare-price]",
      );

      if (currentPrice && selectedOption.dataset.priceText) {
        currentPrice.textContent = selectedOption.dataset.priceText;
      }

      if (!comparePrice) {
        return;
      }

      const priceCents = Number.parseInt(
        selectedOption.dataset.priceCents || "0",
        10,
      );

      const compareAtCents = Number.parseInt(
        selectedOption.dataset.compareAtCents || "0",
        10,
      );

      const isOnSale =
        Number.isInteger(compareAtCents) &&
        Number.isInteger(priceCents) &&
        compareAtCents > priceCents;

      comparePrice.hidden = !isOnSale;
      comparePrice.textContent = isOnSale
        ? selectedOption.dataset.compareAtText || ""
        : "";
    }

    handleVariantChange(event) {
      if (!(event.target instanceof HTMLSelectElement)) {
        return;
      }

      if (!event.target.matches("[data-collection-variant]")) {
        return;
      }

      this.updateSelectedPrice(event.target);
      this.setStatus("");
    }

    async handleSubmit() {
      if (
        this.isSubmitting ||
        !this.submitButton ||
        this.submitButton.disabled
      ) {
        return;
      }

      this.setStatus("");
      this.setSubmitting(true);

      try {
        const items = this.buildItems();
        const { sectionId } = this.getCartDrawerDetails();

        const payload = {
          items,
        };

        if (sectionId) {
          payload.sections = [sectionId];
          payload.sections_url = `${window.location.pathname}${window.location.search}`;
        }

        const response = await fetch(`${this.getLocaleRoot()}cart/add.js`, {
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
              this.dataset.errorMessage ||
              "The complete collection could not be added.",
          );
        }

        this.setStatus(
          this.dataset.addedMessage ||
            "The complete collection was added to your cart.",
        );

        const renderedDrawer =
          sectionId && responseData.sections
            ? responseData.sections[sectionId]
            : "";

        if (sectionId && renderedDrawer) {
          document.dispatchEvent(
            new CustomEvent("cart:updated", {
              detail: {
                sectionId,
                html: renderedDrawer,
                open: true,
              },
            }),
          );
        } else {
          window.location.assign(`${this.getLocaleRoot()}cart`);
        }
      } catch (error) {
        console.error(error);

        this.setStatus(
          error instanceof Error
            ? error.message
            : this.dataset.errorMessage ||
                "The complete collection could not be added.",
          true,
        );
      } finally {
        this.setSubmitting(false);
      }
    }
  }

  customElements.define("collection-add-all", CollectionAddAll);
})();
