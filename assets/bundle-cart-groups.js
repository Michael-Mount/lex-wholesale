(() => {
  let enhancementScheduled = false;

  function parsePositiveInteger(value) {
    const parsedValue = Number.parseInt(value ?? "", 10);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      return 0;
    }

    return parsedValue;
  }

  function scheduleEnhancement() {
    if (enhancementScheduled) {
      return;
    }

    enhancementScheduled = true;

    window.requestAnimationFrame(() => {
      enhancementScheduled = false;
      enhanceAllBundleContainers();
    });
  }

  function enhanceAllBundleContainers() {
    document
      .querySelectorAll("[data-bundle-group-container]")
      .forEach(enhanceBundleContainer);
  }

  function analyzeBundle(lines) {
    const expectedCounts = new Set();
    const expectedQuantities = new Set();
    const positions = new Set();

    lines.forEach((line) => {
      const expectedCount = parsePositiveInteger(
        line.dataset.bundleExpectedCount,
      );

      const expectedQuantity = parsePositiveInteger(
        line.dataset.bundleExpectedQuantity,
      );

      const position = parsePositiveInteger(line.dataset.bundlePosition);

      if (expectedCount > 0) {
        expectedCounts.add(expectedCount);
      }

      if (expectedQuantity > 0) {
        expectedQuantities.add(expectedQuantity);
      }

      if (position > 0) {
        positions.add(position);
      }
    });

    if (expectedCounts.size !== 1 || expectedQuantities.size !== 1) {
      return {
        state: "unknown",
        expectedCount: 0,
        expectedQuantity: 0,
        reason: "metadata",
      };
    }

    const expectedCount = Array.from(expectedCounts)[0];
    const expectedQuantity = Array.from(expectedQuantities)[0];

    const containsEveryPosition = Array.from(
      { length: expectedCount },
      (_, index) => index + 1,
    ).every((position) => positions.has(position));

    const quantitiesMatch = lines.every((line) => {
      const currentQuantity = parsePositiveInteger(
        line.dataset.bundleCurrentQuantity,
      );

      return currentQuantity === expectedQuantity;
    });

    const componentCountMatches =
      lines.length === expectedCount &&
      positions.size === expectedCount &&
      containsEveryPosition;

    if (componentCountMatches && quantitiesMatch) {
      return {
        state: "complete",
        expectedCount,
        expectedQuantity,
        reason: "",
      };
    }

    return {
      state: "incomplete",
      expectedCount,
      expectedQuantity,
      reason: componentCountMatches ? "quantity" : "components",
    };
  }

  function createElement(tagName, className, text = "") {
    const element = document.createElement(tagName);

    element.className = className;

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function createGroupHeader({ title, groupLabel, stateLabel, state }) {
    const header = createElement(
      "li",
      `bundle-cart-group__header ` + `bundle-cart-group__header--${state}`,
    );

    header.dataset.generatedBundleGroup = "true";

    const headingGroup = createElement(
      "div",
      "bundle-cart-group__heading-group",
    );

    const eyebrow = createElement(
      "p",
      "bundle-cart-group__eyebrow",
      groupLabel,
    );

    const heading = createElement("h2", "bundle-cart-group__title", title);

    const badge = createElement(
      "span",
      `bundle-cart-group__state ` + `bundle-cart-group__state--${state}`,
      stateLabel,
    );

    headingGroup.append(eyebrow, heading);
    header.append(headingGroup, badge);

    return header;
  }

  function createGroupStatus({
    analysis,
    actualCount,
    completeLabel,
    incompleteLabel,
    incompleteWarning,
    unknownWarning,
  }) {
    const status = createElement(
      "li",
      `bundle-cart-group__status ` +
        `bundle-cart-group__status--${analysis.state}`,
    );

    status.dataset.generatedBundleGroup = "true";
    status.setAttribute("role", "status");

    let message = "";

    if (analysis.state === "complete") {
      const productWord = analysis.expectedCount === 1 ? "product" : "products";

      message =
        `${completeLabel}: ` +
        `${analysis.expectedCount} of ` +
        `${analysis.expectedCount} required ${productWord}, ` +
        `quantity ${analysis.expectedQuantity} each.`;
    } else if (analysis.state === "unknown") {
      message = unknownWarning;
    } else if (analysis.reason === "quantity") {
      message =
        `${incompleteLabel}: Each component should have ` +
        `quantity ${analysis.expectedQuantity}. ` +
        incompleteWarning;
    } else {
      message =
        `${incompleteLabel}: ${actualCount} of ` +
        `${analysis.expectedCount} required products remain. ` +
        incompleteWarning;
    }

    status.textContent = message;

    return status;
  }

  function enhanceBundleContainer(container) {
    if (container.dataset.bundleGroupsEnhanced === "true") {
      return;
    }

    if (container.dataset.enableBundleGroups === "false") {
      container.dataset.bundleGroupsProcessed = "disabled";
      return;
    }

    const originalChildren = Array.from(container.children);
    const groups = new Map();

    originalChildren.forEach((child) => {
      if (!child.matches("[data-bundle-line]")) {
        return;
      }

      const bundleId = child.dataset.bundleId;

      if (!bundleId) {
        return;
      }

      if (!groups.has(bundleId)) {
        groups.set(bundleId, {
          id: bundleId,
          title: child.dataset.bundleTitle || "Complete collection",
          lines: [],
        });
      }

      groups.get(bundleId).lines.push(child);
    });

    if (groups.size === 0) {
      container.dataset.bundleGroupsEnhanced = "true";
      return;
    }

    groups.forEach((group) => {
      group.lines.sort((firstLine, secondLine) => {
        const firstPosition = parsePositiveInteger(
          firstLine.dataset.bundlePosition,
        );

        const secondPosition = parsePositiveInteger(
          secondLine.dataset.bundlePosition,
        );

        return firstPosition - secondPosition;
      });
    });

    const processedBundleIds = new Set();
    const enhancedChildren = [];

    const groupLabel =
      container.dataset.bundleGroupLabel || "Complete collection";

    const completeLabel =
      container.dataset.bundleCompleteLabel || "Complete set";

    const incompleteLabel =
      container.dataset.bundleIncompleteLabel || "Incomplete set";

    const incompleteWarning =
      container.dataset.bundleIncompleteWarning ||
      "The automatic collection discount may no longer apply.";

    const unknownWarning =
      container.dataset.bundleUnknownWarning ||
      "Remove and re-add this collection to refresh its bundle information.";

    originalChildren.forEach((child) => {
      if (!child.matches("[data-bundle-line]")) {
        enhancedChildren.push(child);
        return;
      }

      const bundleId = child.dataset.bundleId;

      if (!bundleId) {
        enhancedChildren.push(child);
        return;
      }

      if (processedBundleIds.has(bundleId)) {
        return;
      }

      processedBundleIds.add(bundleId);

      const group = groups.get(bundleId);
      const analysis = analyzeBundle(group.lines);

      const stateLabel =
        analysis.state === "complete"
          ? completeLabel
          : analysis.state === "incomplete"
            ? incompleteLabel
            : "Status unavailable";

      const header = createGroupHeader({
        title: group.title,
        groupLabel,
        stateLabel,
        state: analysis.state,
      });

      const status = createGroupStatus({
        analysis,
        actualCount: group.lines.length,
        completeLabel,
        incompleteLabel,
        incompleteWarning,
        unknownWarning,
      });

      group.lines.forEach((line, index) => {
        line.dataset.bundleGroupState = analysis.state;

        line.classList.add("bundle-cart-group__line");

        line.classList.toggle("bundle-cart-group__line--first", index === 0);

        line.classList.toggle(
          "bundle-cart-group__line--last",
          index === group.lines.length - 1,
        );
      });

      enhancedChildren.push(header, ...group.lines, status);
    });

    container.dataset.bundleGroupsEnhanced = "true";
    container.replaceChildren(...enhancedChildren);
  }

  document.addEventListener("DOMContentLoaded", scheduleEnhancement);

  document.addEventListener("cart:updated", scheduleEnhancement);

  const observer = new MutationObserver((mutations) => {
    const addedBundleContent = mutations.some((mutation) => {
      return Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof Element)) {
          return false;
        }

        return (
          node.matches("[data-bundle-group-container]") ||
          node.querySelector("[data-bundle-group-container]")
        );
      });
    });

    if (addedBundleContent) {
      scheduleEnhancement();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
