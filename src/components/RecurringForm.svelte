<script lang="ts">
  import { bucketsStore, merchantsStore, recurringStore } from '$lib/stores';
  import type { Bucket, Frequency, Merchant } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let buckets: Bucket[] = [];
  let merchants: Merchant[] = [];

  let name = '';
  let amount = '';
  let frequency: Frequency = 'monthly';
  let nextDueDate = '';
  let bucketId = '';
  let autoFundAmount = '';
  let fundingFrequency: Frequency | null = null;
  let merchantId = '';
  let isSaving = false;
  let error = '';

  const frequencies: Frequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

  onMount(async () => {
    try {
      const [bcks, merch] = await Promise.all([bucketsStore.fetchAll(), merchantsStore.fetchAll()]);
      buckets = bcks;
      merchants = merch;
    } catch (fetchError) {
      console.error('Failed to load reference data', fetchError);
    }
  });

  async function submitPlan() {
    if (!name || !amount || !nextDueDate) {
      error = 'Please provide a name, amount, and next due date';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await recurringStore.create({
        name,
        amount: Number(amount),
        frequency,
        nextDueDate,
        bucketId: bucketId || undefined,
        autoFundAmount: autoFundAmount ? Number(autoFundAmount) : undefined,
        fundingFrequency: autoFundAmount ? fundingFrequency || frequency : undefined,
        merchantId: merchantId || undefined,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save plan';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Sinking fund</p>
        <h2 class="text-2xl font-bold text-white">Create recurring plan</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      <input class="input-field" type="text" bind:value={name} placeholder="Name, e.g. Mobile Recharge" />
      <div class="grid grid-cols-2 gap-3">
        <input class="input-field" type="number" step="0.01" bind:value={amount} placeholder="Amount" />
        <input class="input-field" type="date" bind:value={nextDueDate} placeholder="Next due date" />
      </div>
      <select class="input-field" bind:value={frequency}>
        {#each frequencies as item}
          <option value={item}>{item}</option>
        {/each}
      </select>
      <select class="input-field" bind:value={bucketId}>
        <option value="">Bucket (optional)</option>
        {#each buckets as bucket}
          <option value={bucket.id}>{bucket.name}</option>
        {/each}
      </select>
      <div class="grid grid-cols-2 gap-3">
        <input class="input-field" type="number" step="0.01" bind:value={autoFundAmount} placeholder="Auto-fund amount" />
        <select class="input-field" bind:value={fundingFrequency}>
          <option value={null}>Funding frequency</option>
          {#each frequencies as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
      </div>
      <select class="input-field" bind:value={merchantId}>
        <option value="">Merchant (optional)</option>
        {#each merchants as merchant}
          <option value={merchant.id}>{merchant.displayName || merchant.canonicalName}</option>
        {/each}
      </select>
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitPlan} disabled={isSaving}>{isSaving ? 'Saving...' : 'Create plan'}</button>
      </div>
    </div>
  </div>
</div>
