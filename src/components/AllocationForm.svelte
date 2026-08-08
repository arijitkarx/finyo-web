<script lang="ts">
  import { addBucketAllocation } from '$lib/stores';
  import type { AllocationType, Bucket } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let bucket: Bucket;
  export let type: Exclude<AllocationType, 'transfer'> = 'funding';

  let amount = '';
  let occurredAt = '';
  let isSaving = false;
  let error = '';

  const labels: Record<string, string> = {
    funding: 'Fund bucket',
    spending: 'Spend from bucket',
    release: 'Release money',
    adjustment: 'Adjust balance',
  };

  async function submitAllocation() {
    if (!amount || Number(amount) <= 0) {
      error = 'Please provide an amount greater than zero';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await addBucketAllocation(bucket.id, {
        amount: Number(amount),
        allocationType: type,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save allocation';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Bucket · {bucket.name}</p>
        <h2 class="text-2xl font-bold text-white">{labels[type]}</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      <input class="input-field" type="number" step="0.01" bind:value={amount} placeholder="Amount" />
      <input class="input-field" type="date" bind:value={occurredAt} placeholder="Date" />
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitAllocation} disabled={isSaving}>{isSaving ? 'Saving...' : labels[type]}</button>
      </div>
    </div>
  </div>
</div>
