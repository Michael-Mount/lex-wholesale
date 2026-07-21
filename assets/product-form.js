(() => {
  let activeVariantRequest = null;

  document.addEventListener("change", handleOptionChange);
  document.addEventListener("submit", handleProductSubmit);

  async function handleOptionChange(event) {
    const input = event.target.closest(
      "[data-product-options] input[data-option-value-id]",
    );

    if (!input) {
      return;
    }

    const section = input.closest("[data-product-section]");

    if (!section) {
      return;
    }

    const optionPicker = input.closest("[data-product-options]");
    const sectionId = section.dataset.sectionId;
    const defaultProductUrl = section.dataset.productUrl;
    const selectedProductUrl = input.dataset.productUrl;
    const productUrl = selectedProductUrl || defaultProductUrl;

    const selectedInputs = Array.from(
      optionPicker.querySelectorAll("input[data-option-value-id]:checked"),
    );

    const selectedOptionValueIds = selectedInputs.map(
      (selectedInput) => selectedInput.dataset.optionValueId,
    );

    if (!sectionId || !productUrl || selectedOptionValueIds.length === 0) {
      return;
    }

    if (activeVariantRequest) {
      activeVariantRequest.abort();
    }

    activeVariantRequest = new AbortController();

    section.classList.add("main-product--loading");
    section.setAttribute("aria-busy", "true");

    try {
      const sectionUrl = new URL(productUrl, window.location.origin);

      sectionUrl.searchParams.delete("variant");
      sectionUrl.searchParams.set("section_id", sectionId);
      sectionUrl.searchParams.set(
        "option_values",
        selectedOptionValueIds.join(","),
      );

      const response = await fetch(sectionUrl.toString(), {
        signal: activeVariantRequest.signal,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to update product: ${response.status}`);
      }

      const responseText = await response.text();

      const parsedDocument = new DOMParser().parseFromString(
        responseText,
        "text/html",
      );

      const updatedSection = parsedDocument.querySelector(
        "[data-product-section]",
      );

      if (!updatedSection) {
        throw new Error("The updated product section was not found.");
      }

      const focusedInputId = input.id;

      section.replaceWith(updatedSection);

      const browserUrl = new URL(productUrl, window.location.origin);

      browserUrl.searchParams.delete("variant");
      browserUrl.searchParams.set(
        "option_values",
        selectedOptionValueIds.join(","),
      );

      window.history.replaceState(
        {},
        "",
        `${browserUrl.pathname}${browserUrl.search}`,
      );

      document.getElementById(focusedInputId)?.focus();
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error(error);

      section.classList.remove("main-product--loading");
      section.removeAttribute("aria-busy");

      const status = section.querySelector("[data-product-status]");

      if (status) {
        status.textContent =
          "The selected options could not be updated. Please try again.";
      }
    } finally {
      activeVariantRequest = null;
    }
  }

  async function handleProductSubmit(event) {
    const form = event.target.closest(".main-product__form");

    if (!form) {
      return;
    }

    event.preventDefault();

    if (form.dataset.submitting === "true") {
      return;
    }

    const productSection = form.closest("[data-product-section]");
    const status = productSection?.querySelector("[data-product-status]");

    const submitButton = form.querySelector("[data-add-to-cart-button]");

    const submitText = submitButton?.querySelector("[data-add-to-cart-text]");

    const originalButtonText = submitText?.textContent ?? "";
    const originalDisabledState = submitButton?.disabled ?? false;

    const cartDrawer = document.querySelector("[data-cart-drawer]");

    const cartDrawerSectionId = cartDrawer?.dataset.sectionId;

    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");

    if (status) {
      status.textContent = "";
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (submitText) {
      submitText.textContent = "Adding…";
    }

    try {
      const formData = new FormData(form);

      if (cartDrawerSectionId) {
        formData.append("sections", cartDrawerSectionId);

        formData.append(
          "sections_url",
          `${window.location.pathname}${window.location.search}`,
        );
      }

      const cartRoot = window.Shopify?.routes?.root ?? "/";

      const response = await fetch(`${cartRoot}cart/add.js`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          responseData.description ||
            responseData.message ||
            "The product could not be added to the cart.",
        );
      }

      if (status) {
        status.textContent = "Added to cart.";
      }

      const updatedDrawerHtml = responseData.sections?.[cartDrawerSectionId];

      if (cartDrawerSectionId && updatedDrawerHtml) {
        document.dispatchEvent(
          new CustomEvent("cart:updated", {
            detail: {
              sectionId: cartDrawerSectionId,
              html: updatedDrawerHtml,
              open: true,
            },
          }),
        );
      }
    } catch (error) {
      console.error(error);

      if (status) {
        status.textContent =
          error instanceof Error
            ? error.message
            : "The product could not be added to the cart.";
      }
    } finally {
      form.dataset.submitting = "false";
      form.removeAttribute("aria-busy");

      if (submitButton) {
        submitButton.disabled = originalDisabledState;
      }

      if (submitText) {
        submitText.textContent = originalButtonText;
      }
    }
  }
})();
