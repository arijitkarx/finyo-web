<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { accountsStore } from '$lib/stores';
  import type { Account } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let accounts: Account[] = [];
  let rawText = '';
  let accountId = '';
  let occurredAt = '';
  let isSaving = false;
  let error = '';
  let result = '';

  onMount(async () => {
    try {
      const loaded = await accountsStore.fetchAll();
      accounts = loaded.filter(a => a.isActive);
    } catch (fetchError) {
      console.error('Failed to load accounts', fetchError);
    }
  });

  async function submitSms() {
    if (!rawText.trim()) {
      error = 'Paste the SMS or notification text first';
      return;
    }

    isSaving = true;
    error = '';
    result = '';

    try {
      const data = await apiFetch<{ status: string; transaction?: unknown; transactionId?: number; eventId: number }>('/api/ingestion/events', {
        method: 'POST',
        body: JSON.stringify({
          source: 'sms',
          accountId: accountId || undefined,
          rawText: rawText.trim(),
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        }),
      });

      if (data.status === 'processed') {
        result = 'Processed — transaction created and classified.';
      } else if (data.status === 'duplicate') {
        result = 'Duplicate — this event or transaction was already seen.';
      } else {
        result = `Status: ${data.status}`;
      }

      dispatch('imported');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to process SMS';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Ingestion</p>
        <h2 class="text-2xl font-bold text-white">Import SMS</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      {#if result}
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{result}</div>
      {/if}
      <textarea
        class="input-field h-32 resize-none"
        bind:value={rawText}
        placeholder='e.g. "Rs 147 debited from A/c XX1234 via UPI-RAPIDO"'
      ></textarea>
      <select class="input-field" bind:value={accountId}>
        <option value="">Account (optional)</option>
        {#each accounts as account}
          <option value={account.id}>{account.name}{account.institution ? ` (${account.institution})` : ''}</option>
        {/each}
      </select>
      <input class="input-field" type="date" bind:value={occurredAt} placeholder="Occurred at" />
      <p class="text-xs text-slate-400">The server parses, dedupes, and classifies automatically. Unparseable SMS is rejected with 422.</p>
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitSms} disabled={isSaving}>{isSaving ? 'Processing...' : 'Import SMS'}</button>
      </div>
    </div>
  </div>
</div>
