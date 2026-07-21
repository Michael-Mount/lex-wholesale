(() => {
  if (customElements.get("predictive-search")) {
    return;
  }

  class PredictiveSearch extends HTMLElement {
    constructor() {
      super();

      this.abortController = null;
      this.debounceTimer = null;
      this.activeOptionIndex = -1;
    }

    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');

      this.resultsContainer = this.querySelector(
        "[data-predictive-search-results]",
      );

      this.enabled = this.dataset.predictiveSearchEnabled !== "false";

      this.endpoint = this.dataset.predictiveSearchUrl;

      if (
        !this.input ||
        !this.resultsContainer ||
        !this.enabled ||
        !this.endpoint
      ) {
        return;
      }

      this.input.addEventListener("input", this.handleInput.bind(this));

      this.input.addEventListener("keydown", this.handleKeydown.bind(this));

      document.addEventListener("click", this.handleDocumentClick.bind(this));
    }

    handleInput() {
      window.clearTimeout(this.debounceTimer);

      const searchTerm = this.input.value.trim();

      if (searchTerm.length < 2) {
        this.close();
        return;
      }

      this.debounceTimer = window.setTimeout(() => {
        this.fetchResults(searchTerm);
      }, 250);
    }

    async fetchResults(searchTerm) {
      if (this.abortController) {
        this.abortController.abort();
      }

      this.abortController = new AbortController();

      this.resultsContainer.setAttribute("aria-busy", "true");

      try {
        const requestUrl = new URL(this.endpoint, window.location.origin);

        requestUrl.searchParams.set("q", searchTerm);
        requestUrl.searchParams.set("section_id", "predictive-search");

        requestUrl.searchParams.set(
          "resources[type]",
          "query,product,collection,page,article",
        );

        requestUrl.searchParams.set("resources[limit]", "8");

        requestUrl.searchParams.set("resources[limit_scope]", "each");

        requestUrl.searchParams.set(
          "resources[options][unavailable_products]",
          "last",
        );

        const response = await fetch(requestUrl.toString(), {
          signal: this.abortController.signal,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          throw new Error(`Predictive search failed: ${response.status}`);
        }

        const responseText = await response.text();

        const parsedDocument = new DOMParser().parseFromString(
          responseText,
          "text/html",
        );

        const sectionWrapper = parsedDocument.querySelector(
          "#shopify-section-predictive-search",
        );

        if (!sectionWrapper) {
          throw new Error("Predictive search section was not found.");
        }

        this.resultsContainer.innerHTML = sectionWrapper.innerHTML;

        this.activeOptionIndex = -1;

        this.open();
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error(error);
        this.close();
      } finally {
        this.resultsContainer.removeAttribute("aria-busy");
      }
    }

    getOptions() {
      return Array.from(
        this.resultsContainer.querySelectorAll(
          '[role="option"] a, a[role="option"]',
        ),
      );
    }

    handleKeydown(event) {
      if (event.key === "Escape") {
        this.close();
        this.input.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      const options = this.getOptions();

      if (options.length === 0) {
        return;
      }

      event.preventDefault();

      const direction = event.key === "ArrowDown" ? 1 : -1;

      this.activeOptionIndex += direction;

      if (this.activeOptionIndex >= options.length) {
        this.activeOptionIndex = 0;
      }

      if (this.activeOptionIndex < 0) {
        this.activeOptionIndex = options.length - 1;
      }

      options[this.activeOptionIndex].focus();
    }

    handleDocumentClick(event) {
      if (!this.contains(event.target)) {
        this.close();
      }
    }

    open() {
      this.resultsContainer.hidden = false;

      this.input.setAttribute("aria-expanded", "true");
    }

    close() {
      if (this.abortController) {
        this.abortController.abort();
      }

      this.resultsContainer.hidden = true;
      this.resultsContainer.innerHTML = "";

      this.input.setAttribute("aria-expanded", "false");

      this.activeOptionIndex = -1;
    }
  }

  customElements.define("predictive-search", PredictiveSearch);
})();
