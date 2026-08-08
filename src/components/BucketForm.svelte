<script lang="ts">
  import { bucketsStore } from '$lib/stores';
  import type { BucketType } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let name = '';
  let type: BucketType = 'savings';
  let targetAmount = '';
  let isSaving = false;
  let error = '';

  const bucketTypes: BucketType[] = ['spending', 'sinking_fund', 'reserved', 'savings', 'earmarked'];

  async function submitBucket() {
    if (!name) {
      error = 'Please provide a name';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await bucketsStore.create({
        name,
        type,
        targetAmount: targetAmount ? Number(targetAmount) : undefined,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save bucket';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Bucket</p>
        <h2 class="text-2xl font-bold text-white">Create bucket</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      <input class="input-field" type="text" bind:value={name} placeholder="Name, e.g. Vacation" />
      <select class="input-field" bind:value={type}>
        {#each bucketTypes as bucketType}
          <option value={bucketType}>{bucketType.replace('_', ' ')}</option>
        {/each}
      </select>
      <input class="input-field" type="number" step="0.01" bind:value={targetAmount} placeholder="Target amount (optional)" />
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitBucket} disabled={isSaving}>{isSaving ? 'Saving...' : 'Create bucket'}</button>
      </div>
    </div>
  </div>
</div>
