<script lang="ts">
  import AccountForm from './AccountForm.svelte';
  import { accountsStore } from '$lib/stores';
  import type { Account } from '$lib/types';
  import { onMount } from 'svelte';

  let accounts: Account[] = [];
  let loading = true;
  let error = '';
  let showModal = false;

  const unsubscribe = accountsStore.subscribe(value => {
    accounts = value;
  });

  onMount(() => {
    loadAccounts();
    return unsubscribe;
  });

  async function loadAccounts() {
    loading = true;
    error = '';
    try {
      await accountsStore.fetchAll();
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : 'Unable to load accounts';
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    showModal = false;
    await loadAccounts();
  }

  async function deleteAccount(account: Account) {
    if (!confirm(`Delete account "${account.name}"? This does not delete its transactions.`)) {
      return;
    }

    await accountsStore.remove(account.id);
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Accounts</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Your accounts</h1>
      <p class="mt-2 text-sm text-slate-400">Bank, cash, wallet, and card accounts used to record transactions.</p>
    </div>
    <button class="btn-primary" on:click={() => (showModal = true)}>+ Add Account</button>
  </div>

  {#if error}
    <div class="card border-rose-500/20 bg-rose-500/10 text-rose-100">{error}</div>
  {/if}

  {#if loading}
    <div class="card">Loading accounts...</div>
  {:else if accounts.length === 0}
    <div class="card py-16 text-center text-slate-300">
      <p class="text-lg font-medium text-white">No accounts yet.</p>
      <p class="mt-2 text-sm text-slate-400">Add an account to start linking transactions to it.</p>
    </div>
  {:else}
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {#each accounts as account}
        <article class="card space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl">
                🏦
              </div>
              <div>
                <h2 class="text-xl font-bold text-white">{account.name}</h2>
                <p class="text-xs text-slate-400">{account.institution || 'No institution'} · {account.accountType}</p>
              </div>
            </div>
            <span class={'badge ' + (account.isActive ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400')}>
              {account.isActive ? 'active' : 'inactive'}
            </span>
          </div>
          <div class="flex items-end justify-between">
            <div>
              <p class="text-xs text-slate-400">Current balance</p>
              <p class="text-2xl font-black text-white">{account.currency} {formatMoney(account.currentBalance)}</p>
            </div>
            <div class="flex gap-2">
              <button
                class="btn-sm border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                type="button"
                on:click={() => accountsStore.updateItem(account.id, { isActive: !account.isActive })}
              >
                {account.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn-sm bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" type="button" on:click={() => deleteAccount(account)}>Delete</button>
            </div>
          </div>
          <p class="text-xs text-slate-400">Source: {account.sourceType} · Last updated: {account.lastBalanceUpdatedAt ? new Date(account.lastBalanceUpdatedAt).toLocaleDateString('en-IN') : 'never'}</p>
        </article>
      {/each}
    </div>
  {/if}

  {#if showModal}
    <AccountForm on:close={() => (showModal = false)} on:save={handleSave} />
  {/if}
</section>
