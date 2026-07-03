<script>
  import { createEventDispatcher } from "svelte";
  import { Shield, Plus, Trash2, Check, X, Eye, FolderKey, Ribbon, MenuSquare, Pen, PenSquare, Vault, SquarePen, FolderPlus, Trash } from "lucide-svelte";
  import Button from "../../components/input/Button.svelte";

  export let roles = [];
  export let refresh = () => {};
  export let onEditRole = () => {};

  const dispatch = createEventDispatcher();

  let showCreate = false;
  let createName = "";
  let createDisplayName = "";
  let createError = "";

  async function handleCreate() {
    createError = "";
    if (!createName.trim()) {
      createError = "Name required";
      return;
    }

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), displayName: createDisplayName || createName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      showCreate = false;
      createName = "";
      createDisplayName = "";
      refresh();
    } catch (e) {
      createError = e.message;
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Delete role "${name}"? Users assigned to this role will lose their permissions.`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  const ALL_PERMISSIONS = [
    { id: "file:read", label: "Read files", icon: Eye },
    { id: "file:write", label: "Edit files", icon: Pen },
    { id: "file:create", label: "Create files/folders", icon: FolderPlus },
    { id: "file:delete", label: "Delete files/folders", icon: Trash2 },
    { id: "file:rename", label: "Rename files", icon: PenSquare },
    { id: "vault:read", label: "Access vault", icon: Vault },
    { id: "vault:create", label: "Create vaults", icon: SquarePen },
    { id: "vault:delete", label: "Delete vaults", icon: Trash },
    { id: "admin:*", label: "Admin panel", icon: Shield },
  ];
</script>

<div class="role-list">
  <div class="list-header">
    <h3>Roles ({roles.length})</h3>
    <Button variant="ghost" on:click={() => (showCreate = !showCreate)}>
      <svelte:fragment slot="icon"><Plus size="0.875rem" /></svelte:fragment>
      New Role
    </Button>
  </div>

  {#if showCreate}
    <div class="create-form">
      <input type="text" placeholder="Role ID (alphanumeric)" bind:value={createName} />
      <input type="text" placeholder="Display name" bind:value={createDisplayName} />
      <div class="form-actions">
        <Button variant="ghost" size="small" on:click={() => { showCreate = false; createError = ""; }}>
          <svelte:fragment slot="icon"><X size="0.875rem" /></svelte:fragment>
        </Button>
        <Button variant="primary" size="small" on:click={handleCreate}>
          <svelte:fragment slot="icon"><Check size="0.875rem" /></svelte:fragment>
          Create
        </Button>
      </div>
      {#if createError}
        <div class="form-error">{createError}</div>
      {/if}
    </div>
  {/if}

  <div class="role-grid">
    {#each roles as role (role.name)}
      <div class="role-card" class:builtin={role.builtin}>
        <div class="role-header">
          <div class="role-name">
            <Shield size="1rem" />
            <span>{role.displayName}</span>
            <span class="role-id">({role.name})</span>
          </div>
          <div class="role-tags">
            <span class="perm-count">{role.permissions.length} perms</span>
            {#if role.fileAccess}
              <span class="fa-badge" title="File access rules: {role.fileAccess.type}">
                <FolderKey size="0.75rem" />
                {role.fileAccess.type}
              </span>
            {/if}
            {#if role.makeEditorsReadOnly}
              <span class="fa-badge ro" title="Editors are read-only">RO</span>
            {/if}
          </div>
        </div>

        <div class="role-perms">
          {#each ALL_PERMISSIONS as perm}
            {#if role.permissions.includes("*") || role.permissions.includes(perm.id)}
              <span class="perm-item active" class:inherited={role.permissions.includes("*") && perm.id !== "*"}>
                <svelte:component this={perm.icon} size="0.75rem" />
                {perm.label}
              </span>
            {/if}
          {/each}
        </div>

        <div class="role-footer">
          {#if role.fileAccess}
            <div class="fa-summary">
              <FolderKey size="0.75rem" />
              {role.fileAccess.type === "whitelist" ? "Only: " : "Blocked: "}
              {(role.fileAccess.paths || []).join(", ") || "none"}
              {#if role.fileAccess.tags?.length}
                | Tags: {(role.fileAccess.tags || []).join(", ")}
              {/if}
            </div>
          {/if}
          {#if role.ribbonHiddenPluginIds?.length}
            <div class="fa-summary">
              <Ribbon size="0.75rem" />
              Hidden ribbon: {role.ribbonHiddenPluginIds.join(", ")}
            </div>
          {/if}
          {#if role.hideMenuItems?.length}
            <div class="fa-summary">
              <MenuSquare size="0.75rem" />
              Hidden menu: {role.hideMenuItems.join(", ")}
            </div>
          {/if}

          <div class="role-actions">
            <Button variant="ghost" size="small" on:click={() => onEditRole(role)}>Edit</Button>
            {#if !role.builtin}
              <Button variant="ghost-danger" size="small" on:click={() => handleDelete(role.name)}>
                <svelte:fragment slot="icon"><Trash2 size="0.75rem" /></svelte:fragment>
              </Button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if roles.length === 0}
    <div class="empty">No roles configured</div>
  {/if}
</div>

<style>
  .role-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .list-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-normal);
  }

  .create-form {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.75rem;
    background: var(--background-primary-alt);
    border-radius: 8px;
  }

  .create-form input {
    padding: 6px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.8125rem;
    outline: none;
    width: 150px;
  }

  .form-actions {
    display: flex;
    gap: 0.25rem;
  }

  .form-error {
    width: 100%;
    color: var(--text-error);
    font-size: 0.75rem;
  }

  .role-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .role-card {
    background: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .role-card.builtin {
    border-style: dashed;
    opacity: 0.85;
  }

  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .role-name {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .role-id {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .role-tags {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .perm-count {
    font-size: 0.6875rem;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .fa-badge {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .fa-badge.ro {
    background: rgba(234, 179, 8, 0.15);
    color: #fcd34d;
  }

  .role-perms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .perm-item {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.6875rem;
    background: rgba(76, 175, 80, 0.15);
    color: #86efac;
  }

  .perm-item.inherited {
    background: rgba(168, 85, 247, 0.12);
    color: #c4b5fd;
  }

  .role-footer {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .fa-summary {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  .empty {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8125rem;
    padding: 2rem;
  }
</style>
