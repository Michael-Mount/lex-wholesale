document.addEventListener("DOMContentLoaded", () => {
  const drawer = document.querySelector("[data-cart-drawer]");

  if (!(drawer instanceof HTMLDialogElement)) {
    console.warn("Cart drawer dialog was not found.");
    return;
  }

  function openDrawer(trigger) {
    try {
      if (!drawer.open) {
        drawer.showModal();
      }

      document.documentElement.classList.add("cart-drawer-open");

      const closeButton = drawer.querySelector("[data-cart-drawer-close]");

      if (closeButton instanceof HTMLElement) {
        closeButton.focus();
      }

      return true;
    } catch (error) {
      console.error("The cart drawer could not be opened.", error);

      // Allow the visitor to use the normal cart page instead.
      if (trigger instanceof HTMLAnchorElement) {
        window.location.href = trigger.href;
      }

      return false;
    }
  }

  function closeDrawer() {
    if (drawer.open) {
      drawer.close();
    }

    document.documentElement.classList.remove("cart-drawer-open");
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const openButton = target.closest("[data-cart-drawer-open]");

    if (openButton) {
      const opened = openDrawer(openButton);

      // Only cancel the /cart navigation when the drawer opened.
      if (opened) {
        event.preventDefault();
      }

      return;
    }

    const closeButton = target.closest("[data-cart-drawer-close]");

    if (closeButton) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    // Clicking the dialog backdrop closes it.
    if (target === drawer) {
      closeDrawer();
    }
  });

  drawer.addEventListener("cancel", () => {
    document.documentElement.classList.remove("cart-drawer-open");
  });

  drawer.addEventListener("close", () => {
    document.documentElement.classList.remove("cart-drawer-open");
  });
});
