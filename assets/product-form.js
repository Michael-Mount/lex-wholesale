(() => {
  let activeRequest = null;

  document.addEventListener("change", async (event) => {
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

    if (activeRequest) {
      activeRequest.abort();
    }

    activeRequest = new AbortController();

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
        signal: activeRequest.signal,
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
        throw new Error("Updated product section was not found.");
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

      const updatedInput = document.getElementById(focusedInputId);

      updatedInput?.focus();
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
      activeRequest = null;
    }
  });
})();
