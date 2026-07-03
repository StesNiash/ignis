<script>
  import { createEventDispatcher } from "svelte";
  import {
    Shield, Check, X, Eye, FolderKey, Ribbon, MenuSquare,
    Pen, Trash2, Plus, Vault, SquarePen, FolderPlus,
  } from "lucide-svelte";
  import Button from "../../components/input/Button.svelte";

  export let role = null;
  export let onSave = () => {};
  export let onClose = () => {};

  const dispatch = createEventDispatcher();

  let displayName = "";
  let permissions = [];
  let fileAccessType = "";
  let fileAccessPaths = "";
  let fileAccessTags = "";
  let fileAccessExcludePaths = "";
  let fileAccessExcludeTags = "";
  let ribbonHiddenPluginIds = "";
  let hideMenuItems = "";
  let hideInaccessible = false;
  let saving = false;
  let error = "";
  let lastRoleName = null;

  function loadRole() {
    if (!role) return;
    if (lastRoleName === role.name) return;
    lastRoleName = role.name;
    displayName = role.displayName || role.name;
    permissions = [...(role.permissions || [])];
    fileAccessType = role.fileAccess?.type || "";
    fileAccessPaths = (role.fileAccess?.paths || []).join(", ");
    fileAccessTags = (role.fileAccess?.tags || []).join(", ");
    fileAccessExcludePaths = (role.fileAccess?.excludePaths || []).join(", ");
    fileAccessExcludeTags = (role.fileAccess?.excludeTags || []).join(", ");
    ribbonHiddenPluginIds = (role.ribbonHiddenPluginIds || []).join(", ");
    hideMenuItems = (role.hideMenuItems || []).join(", ");
    hideInaccessible = role.fileAccess?.hideInaccessible !== undefined
      ? !!role.fileAccess.hideInaccessible
      : !!(role.fileAccess?.type && ((role.fileAccess?.paths?.length > 0) || (role.fileAccess?.tags?.length > 0)));
  }

  loadRole();
  $: if (role) loadRole();

  function togglePermission(perm) {
    if (permissions.includes(perm)) {
      permissions = permissions.filter((p) => p !== perm);
    } else {
      permissions = [...permissions, perm];
    }
  }

  function hasPerm(perm) {
    return permissions.includes("*") || permissions.includes(perm);
  }

  $: areReadOnly = permissions.includes("file:read")
    && !permissions.includes("*")
    && !permissions.includes("file:write")
    && !permissions.includes("file:create")
    && !permissions.includes("file:delete")
    && !permissions.includes("file:rename");

  $: allSet = permissions.includes("*");

  async function handleSave() {
    saving = true;
    error = "";

    const body = {
      displayName: displayName.trim() || role.name,
      permissions: permissions.includes("*") ? ["*"] : permissions,
      ribbonHiddenPluginIds: ribbonHiddenPluginIds.split(",").map((s) => s.trim()).filter(Boolean),
      hideMenuItems: hideMenuItems.split(",").map((s) => s.trim()).filter(Boolean),
    };

    if (fileAccessType) {
      body.fileAccess = {
        type: fileAccessType,
        paths: fileAccessPaths.split(",").map((s) => s.trim()).filter(Boolean),
        tags: fileAccessTags.split(",").map((s) => s.trim()).filter(Boolean),
        excludePaths: fileAccessExcludePaths.split(",").map((s) => s.trim()).filter(Boolean),
        excludeTags: fileAccessExcludeTags.split(",").map((s) => s.trim()).filter(Boolean),
        hideInaccessible,
      };
    } else {
      body.fileAccess = null;
    }

    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(role.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onSave();
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  const ALL_PERMISSIONS = [
    { id: "file:read", label: "Read files", icon: Eye, section: "Files" },
    { id: "file:write", label: "Edit files", icon: Pen, section: "Files" },
    { id: "file:create", label: "Create files/folders", icon: Plus, section: "Files" },
    { id: "file:delete", label: "Delete files/folders", icon: Trash2, section: "Files" },
    { id: "file:rename", label: "Rename files", icon: Pen, section: "Files" },
    { id: "vault:read", label: "Access vault", icon: Vault, section: "Vaults" },
    { id: "vault:create", label: "Create vaults", icon: SquarePen, section: "Vaults" },
    { id: "vault:delete", label: "Delete vaults", icon: Trash2, section: "Vaults" },
    { id: "admin:*", label: "Admin panel access", icon: Shield, section: "Admin" },
  ];

  const sections = ["Files", "Vaults", "Admin"];

  let activeSection = "Files";
</script>

<div class="role-editor">
  <div class="editor-header">
    <Shield size="1.125rem" />
    <span>Edit Role: {role?.displayName || role?.name}</span>
    <span class="role-id">{role?.builtin ? "(built-in)" : ""}</span>
  </div>

  <div class="editor-body">
    <label>
      Display name
      <input type="text" bind:value={displayName} disabled={role?.builtin} />
    </label>

    <div class="section-label">Permissions</div>

    <div class="perm-presets">
      <label class="perm-check">
        <input
          type="checkbox"
          checked={areReadOnly}
          on:change={() => {
            if (!areReadOnly) {
              const other = permissions.filter((p) => !p.startsWith("file:") && p !== "vault:read");
              permissions = [...other, "file:read", "vault:read"];
            }
          }}
        />
        <Shield size="0.875rem" />
        <strong>Read-only</strong> — view files, no editing
      </label>

      <label class="perm-check">
        <input
          type="checkbox"
          checked={allSet}
          on:change={() => {
            permissions = allSet ? [] : ["*"];
          }}
        />
        <Shield size="0.875rem" />
        <strong>All permissions</strong> — super-admin
      </label>
    </div>

    <div class="perm-sections">
      {#each sections as section}
        <button
          class="section-tab"
          class:active={activeSection === section}
          on:click={() => (activeSection = section)}
        >
          {section}
        </button>
      {/each}
    </div>

    <div class="perm-checks">
      {#if activeSection === "Files" && !allSet}
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("file:read")} on:change={() => togglePermission("file:read")} />
          <Eye size="0.875rem" />
          Read files — view content
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("file:write")} on:change={() => togglePermission("file:write")} />
          <Pen size="0.875rem" />
          Edit files — modify content
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("file:create")} on:change={() => togglePermission("file:create")} />
          <Plus size="0.875rem" />
          Create — new files/folders
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("file:delete")} on:change={() => togglePermission("file:delete")} />
          <Trash2 size="0.875rem" />
          Delete — remove files/folders
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("file:rename")} on:change={() => togglePermission("file:rename")} />
          <Pen size="0.875rem" />
          Rename — rename files/folders
        </label>
      {:else if activeSection === "Vaults"}
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("vault:read")} on:change={() => togglePermission("vault:read")} disabled={allSet} />
          <Vault size="0.875rem" />
          Vault access — enter vault
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("vault:create")} on:change={() => togglePermission("vault:create")} disabled={allSet} />
          <Plus size="0.875rem" />
          Create vaults
        </label>
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("vault:delete")} on:change={() => togglePermission("vault:delete")} disabled={allSet} />
          <Trash2 size="0.875rem" />
          Delete vaults
        </label>
      {:else if activeSection === "Admin"}
        <label class="perm-check">
          <input type="checkbox" checked={allSet || permissions.includes("admin:*")} on:change={() => togglePermission("admin:*")} disabled={allSet} />
          <Shield size="0.875rem" />
          Admin panel — manage users/roles/vaults
        </label>
      {/if}
    </div>

    <div class="section-label"><FolderKey size="0.875rem" /> File Access Rules</div>
    <div class="fa-config">
      <select bind:value={fileAccessType}>
        <option value="">No restrictions (all files)</option>
        <option value="whitelist">Whitelist — only allowed</option>
        <option value="blacklist">Blacklist — block specific</option>
      </select>

      {#if fileAccessType}
        <label>
          Paths (comma-separated globs, e.g. "public/**, docs/*.md")
          <input type="text" bind:value={fileAccessPaths} placeholder="public/**" />
        </label>
        <label>
          Tags (comma-separated)
          <input type="text" bind:value={fileAccessTags} placeholder="private, draft" />
        </label>
        <label>
          Exclude paths (override above)
          <input type="text" bind:value={fileAccessExcludePaths} placeholder="public/admin/**" />
        </label>
        <label>
          Exclude tags
          <input type="text" bind:value={fileAccessExcludeTags} placeholder="secret" />
        </label>
        <label class="perm-check">
          <input type="checkbox" bind:checked={hideInaccessible} />
          Hide inaccessible files in file explorer (recommended)
        </label>
      {/if}
    </div>

    <div class="section-label"><Ribbon size="0.875rem" /> Ribbon — Hidden Plugin IDs</div>
    <label>
      Plugin IDs (comma-separated)
      <input type="text" bind:value={ribbonHiddenPluginIds} placeholder="daily-notes, templates, bases" />
    </label>

    <div class="section-label"><MenuSquare size="0.875rem" /> Context Menu — Hidden Items</div>
    <label>
      Menu item labels (comma-separated, English text)
      <input type="text" bind:value={hideMenuItems} placeholder="Delete, Rename, Make a copy" />
    </label>

  </div>

  {#if error}
    <div class="form-error">{error}</div>
  {/if}

  <div class="editor-footer">
    <Button variant="ghost" on:click={onClose}>
      <svelte:fragment slot="icon"><X size="0.875rem" /></svelte:fragment>
      Cancel
    </Button>
    <Button variant="primary" on:click={handleSave} disabled={saving}>
      <svelte:fragment slot="icon"><Check size="0.875rem" /></svelte:fragment>
      {saving ? "Saving..." : "Save"}
    </Button>
  </div>
</div>

<style>
  .role-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    margin-bottom: 0.75rem;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .role-id {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .editor-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  label input:not([type="checkbox"]),
  select {
    padding: 6px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.8125rem;
    outline: none;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .perm-sections {
    display: flex;
    gap: 0.25rem;
  }

  .section-tab {
    padding: 4px 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .section-tab.active {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  .perm-checks {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
    background: var(--background-primary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }

  .perm-check {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-normal);
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }

  .perm-presets {
    display: flex;
    gap: 1.5rem;
    padding: 0.5rem;
    background: var(--background-primary);
    border-radius: 6px;
    border: 1px dashed var(--text-accent);
    margin-bottom: 0.5rem;
  }

  .fa-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-error {
    color: var(--text-error);
    font-size: 0.75rem;
    background: rgba(255, 0, 0, 0.08);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
