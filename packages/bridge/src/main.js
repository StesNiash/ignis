import { Plugin, TFile, TFolder, Menu } from "obsidian";
import {
  showFilePicker,
  addFileMenuItems,
  addFolderMenuItems,
} from "./file-actions.js";
import {
  patchSettingsModal,
  unpatchSettingsModal,
} from "./settings/inject.js";
import * as pluginRegistry from "./plugin-registry.js";
import { initStatusBar } from "./status-bar.js";
import { WorkspacePickerModal } from "./workspace-picker.js";
import { startDemoGuards, stopDemoGuards } from "./demo-guards.js";

let userPermissions = null;
let readOnlyObserver = null;

function hasPermission(perm) {
  if (!userPermissions) return false;
  return userPermissions.permissions.includes("*") || userPermissions.permissions.includes(perm);
}

function isReadOnly() {
  if (!userPermissions) return false;
  if (userPermissions.permissions.includes("*")) return false;
  return !userPermissions.permissions.includes("file:write")
    && !userPermissions.permissions.includes("file:create")
    && !userPermissions.permissions.includes("file:delete")
    && !userPermissions.permissions.includes("file:rename");
}

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      userPermissions = await res.json();
      window.__ignisUserRole = userPermissions.role;
      window.__ignisPermissions = userPermissions;
    }
  } catch {}
}

function makeAllEditorsReadOnly() {
  document.querySelectorAll(".cm-editor .cm-content").forEach((el) => {
    el.setAttribute("contenteditable", "false");
  });
}

function hideDangerousMenuItems() {
  if (!userPermissions?.hideMenuItems?.length) return;
  const hideSet = new Set(userPermissions.hideMenuItems);
  document.querySelectorAll(".menu-item").forEach((el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim();
    if (hideSet.has(text)) {
      el.style.display = "none";
    }
  });
}

function enforceReadOnly() {
  makeAllEditorsReadOnly();
  applyRibbonConfig();

  readOnlyObserver = new MutationObserver(() => {
    makeAllEditorsReadOnly();
    applyRibbonConfig();
    hideDangerousMenuItems();
  });

  readOnlyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function applyRibbonConfig() {
  if (!userPermissions?.ribbonHiddenPluginIds?.length) return;
  const ribbon = window.app?.workspace?.leftRibbon;
  if (!ribbon?.items) return;

  const hiddenSet = new Set(userPermissions.ribbonHiddenPluginIds);
  let changed = false;

  for (const item of ribbon.items) {
    const pluginId = item.id?.split(":")[0];
    const shouldHide = hiddenSet.has(pluginId);
    if (item.hidden !== shouldHide) {
      item.hidden = shouldHide;
      changed = true;
    }
  }

  if (changed && typeof ribbon.onChange === "function") {
    ribbon.onChange(false);
  }
}

function stopEnforceReadOnly() {
  if (readOnlyObserver) {
    readOnlyObserver.disconnect();
    readOnlyObserver = null;
  }
  document.querySelectorAll(".cm-editor .cm-content").forEach((el) => {
    el.setAttribute("contenteditable", "true");
  });
}

function showAdminDashboard() {
  if (window.IgnisUI?.AdminDashboard) {
    new window.IgnisUI.AdminDashboard({ target: document.body });
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  document.cookie = "token=;path=/;max-age=0";
  window.location.href = "/login";
}

class IgnisBridgePlugin extends Plugin {
  async onload() {
    if (!window.__ignis) {
      console.log("[ignis-bridge] Not running in Ignis - plugin is a no-op.");
      return;
    }

    console.log("[ignis-bridge] Plugin loaded");

    await pluginRegistry.refresh();
    patchSettingsModal(this);
    startDemoGuards();
    this._statusBarInterval = initStatusBar(this);
    await fetchCurrentUser();

    // Read-only enforcement: driven by permissions, not hardcoded role name
    if (isReadOnly()) {
      if (userPermissions.makeEditorsReadOnly) {
        enforceReadOnly();
      }
    } else {
      if (userPermissions.permissions.includes("file:write")) {
        this.addRibbonIcon("upload", "Upload file", () => {
          showFilePicker(this.app);
        });
      }
    }

    this.addCommand({
      id: "open-workspace-in-new-tab",
      name: "Open workspace in new tab",
      callback: () => {
        new WorkspacePickerModal(this.app).open();
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile) {
          addFileMenuItems(menu, file);
        } else if (file instanceof TFolder) {
          addFolderMenuItems(menu, file, this.app);
        }
      }),
    );

    if (userPermissions) {
      const username = userPermissions.role;
      this.addRibbonIcon("user", `Signed in as ${username}`, (evt) => {
        const menu = new Menu();

        menu.addItem((item) =>
          item
            .setTitle(`User: ${username}`)
            .setIcon("user")
            .setDisabled(true),
        );

        menu.addItem((item) =>
          item
            .setTitle(`Role: ${userPermissions.role || "unknown"}`)
            .setIcon("shield")
            .setDisabled(true),
        );

        menu.addItem((item) =>
          item
            .setTitle(`Permissions: ${(userPermissions.permissions || []).join(", ") || "none"}`)
            .setIcon("key")
            .setDisabled(true),
        );

        menu.addSeparator();

        if (hasPermission("admin:*")) {
          menu.addItem((item) =>
            item
              .setTitle("Admin Dashboard")
              .setIcon("settings")
              .onClick(() => showAdminDashboard()),
          );

          menu.addSeparator();
        }

        menu.addItem((item) =>
          item
            .setTitle("Logout")
            .setIcon("log-out")
            .onClick(() => logout()),
        );

        menu.showAtMouseEvent(evt);
      });
    }
  }

  onunload() {
    if (!window.__ignis) {
      return;
    }

    if (this._statusBarInterval) {
      clearInterval(this._statusBarInterval);
    }

    stopEnforceReadOnly();
    unpatchSettingsModal(this);
    stopDemoGuards();
    console.log("[ignis-bridge] Plugin unloaded");
  }
}

export default IgnisBridgePlugin;
