<script lang="ts">
  import { accountsStore } from '$lib/stores';
  import type { AccountType } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let name = '';
  let institution = '';
  let accountType: AccountType = 'bank';
  let currency = 'INR';
  let currentBalance = '';
  let isSaving = false;
  let error = '';

  const accountTypes: AccountType[] = ['bank', 'cash', 'wallet', 'card', 'investment', 'other'];

  async function submitAccount() {
    if (!name) {
      error = 'Please provide a name';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await accountsStore.create({
        name,
        institution: institution || undefined,
        accountType,
        currency,
        currentBalance: currentBalance ? Number(currentBalance) : undefined,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save account';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Account</p>
        <h2 class="text-2xl font-bold text-white">Add account</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      <input class="input-field" type="text" bind:value={name} placeholder="Name, e.g. HDFC" />
      <input class="input-field" type="text" bind:value={institution} placeholder="Institution, e.g. hdfc" />
      <div class="grid grid-cols-2 gap-3">
        <select class="input-field" bind:value={accountType}>
          {#each accountTypes as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
        <input class="input-field" type="text" bind:value={currency} placeholder="Currency, e.g. INR" />
      </div>
      <input class="input-field" type="number" step="0.01" bind:value={currentBalance} placeholder="Current balance (optional)" />
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitAccount} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save account'}</button>
      </div>
    </div>
  </div>
</div>
