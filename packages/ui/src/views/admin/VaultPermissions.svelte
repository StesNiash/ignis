<script>
  import { Check, X } from "lucide-svelte";
  import Button from "../../components/input/Button.svelte";

  export let vaults = [];
  export let permissions = {};
  export let users = [];
  export let refresh = () => {};

  let selectedVault = null;
  let editing = false;
  let editEditors = [];
  let editReaders = [];
  let editError = "";
  let saved = false;

  const nonAdminUsers = users.filter((u) => u.role !== "admin");

  function selectVault(vault) {
    selectedVault = vault;
    editing = false;
    editError = "";
    saved = false;
  }

  function startEdit() {
    const perm = permissions[selectedVault.id];
    editEditors = perm?.editors ? [...perm.editors] : [];
    editReaders = perm?.readers ? [...perm.readers] : [];
    editing = true;
    editError = "";
    saved = false;
  }

  function toggleEditor(username) {
    if (editEditors.includes(username)) {
      editEditors = editEditors.filter((u) => u !== username);
    } else {
      editEditors = [...editEditors, username];
      editReaders = editReaders.filter((u) => u !== username);
    }
  }

  function toggleReader(username) {
    if (editReaders.includes(username)) {
      editReaders = editReaders.filter((u) => u !== username);
    } else {
      editReaders = [...editReaders, username];
      editEditors = editEditors.filter((u) => u !== username);
    }
  }

  async function savePermissions() {
    editError = "";
    try {
      const res = await fetch(`/api/admin/permissions/${encodeURIComponent(selectedVault.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editors: editEditors,
          readers: editReaders,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      editing = false;
      saved = true;
      refresh();
    } catch (e) {
      editError = e.message;
    }
  }

  function cancelEdit() {
    editing = false;
    editError = "";
  }

  function clearPermissions() {
    editEditors = [];
    editReaders = [];
  }

  function hasPermission(vaultId) {
    const perm = permissions[vaultId];
    return perm && (perm.editors?.length > 0 || perm.readers?.length > 0);
  }
</script>

<div class="perm-layout">
  <div class="vault-list">
    <h3>Vaults</h3>
    {#if vaults.length === 0}
      <div class="empty">No vaults</div>
    {:else}
      {#each vaults as vault (vault.id)}
        <button
          class="vault-item"
          class:active={selectedVault?.id === vault.id}
          on:click={() => selectVault(vault)}
        >
          <span>{vault.name}</span>
          {#if hasPermission(vault.id)}
            <span class="restricted-badge">restricted</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>

  <div class="perm-detail">
    {#if !selectedVault}
      <div class="empty">Select a vault to manage permissions</div>
    {:else}
      <div class="perm-header">
        <h3>{selectedVault.name}</h3>
        {#if !editing}
          <Button variant="ghost" size="small" on:click={startEdit}>Edit</Button>
        {/if}
      </div>

      {#if saved}
        <div class="success">Permissions saved</div>
      {/if}

      {#if editError}
        <div class="form-error">{editError}</div>
      {/if}

      <p class="perm-note">
        {#if !hasPermission(selectedVault.id) && !editing}
          No restrictions. All users have access based on their role.
        {:else}
          Only listed users have access to this vault.
          Admins always have full access.
        {/if}
      </p>

      {#if editing}
        <div class="perm-editor">
          {#if nonAdminUsers.length === 0}
            <div class="empty">No non-admin users to assign</div>
          {:else}
            <div class="perm-grid">
              <div class="perm-col">
                <h4>Editors</h4>
                <p class="col-desc">Can read and write</p>
                {#each nonAdminUsers as user (user.username)}
                  <label class="perm-check">
                    <input
                      type="checkbox"
                      checked={editEditors.includes(user.username)}
                      on:change={() => toggleEditor(user.username)}
                    />
                    <span>{user.username}</span>
                    <span class="user-role">{user.role}</span>
                  </label>
                {/each}
              </div>
              <div class="perm-col">
                <h4>Readers</h4>
                <p class="col-desc">Can only read</p>
                {#each nonAdminUsers as user (user.username)}
                  <label class="perm-check">
                    <input
                      type="checkbox"
                      checked={editReaders.includes(user.username)}
                      on:change={() => toggleReader(user.username)}
                    />
                    <span>{user.username}</span>
                    <span class="user-role">{user.role}</span>
                  </label>
                {/each}
              </div>
            </div>
          {/if}

          <div class="perm-actions">
            <Button variant="ghost-danger" size="small" on:click={clearPermissions}>
              Clear All
            </Button>
            <div class="perm-actions-right">
              <Button variant="ghost" size="small" on:click={cancelEdit}>
                <svelte:fragment slot="icon"><X size="0.875rem" /></svelte:fragment>
                Cancel
              </Button>
              <Button variant="primary" size="small" on:click={savePermissions}>
                <svelte:fragment slot="icon"><Check size="0.875rem" /></svelte:fragment>
                Save
              </Button>
            </div>
          </div>
        </div>
      {:else if hasPermission(selectedVault.id)}
        <div class="perm-grid">
          <div class="perm-col">
            <h4>Editors</h4>
            {#each (permissions[selectedVault.id]?.editors || []) as username}
              <div class="perm-entry">{username}</div>
            {:else}
              <div class="empty-sm">None</div>
            {/each}
          </div>
          <div class="perm-col">
            <h4>Readers</h4>
            {#each (permissions[selectedVault.id]?.readers || []) as username}
              <div class="perm-entry">{username}</div>
            {:else}
              <div class="empty-sm">None</div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .perm-layout {
    display: flex;
    gap: 1.5rem;
    min-height: 300px;
  }

  .vault-list {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .vault-list h3,
  .perm-detail h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .vault-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
  }

  .vault-item:hover { background: var(--background-modifier-hover); }
  .vault-item.active {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .restricted-badge {
    font-size: 0.625rem;
    text-transform: uppercase;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .perm-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .perm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .perm-header h3 {
    margin: 0;
    color: var(--text-normal);
    text-transform: none;
    font-size: 1rem;
  }

  .perm-note {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0.25rem 0 0.75rem 0;
  }

  .perm-grid {
    display: flex;
    gap: 1.5rem;
  }

  .perm-col {
    flex: 1;
  }

  .perm-col h4 {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    margin: 0 0 0.25rem 0;
  }

  .col-desc {
    font-size: 0.6875rem;
    color: var(--text-faint);
    margin: 0 0 0.5rem 0;
  }

  .perm-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 4px 0;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .perm-check input[type="checkbox"] {
    accent-color: var(--interactive-accent);
  }

  .user-role {
    font-size: 0.625rem;
    color: var(--text-faint);
    text-transform: uppercase;
  }

  .perm-entry {
    padding: 4px 0;
    font-size: 0.8125rem;
  }

  .perm-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .perm-actions-right {
    display: flex;
    gap: 0.25rem;
  }

  .empty {
    color: var(--text-muted);
    font-size: 0.8125rem;
    padding: 2rem 0;
    text-align: center;
  }

  .empty-sm {
    color: var(--text-faint);
    font-size: 0.75rem;
    font-style: italic;
  }

  .success {
    color: #34d399;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    padding: 4px 8px;
    background: rgba(52, 211, 153, 0.1);
    border-radius: 4px;
  }

  .form-error {
    color: var(--text-error);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    padding: 4px 8px;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
  }
</style>
