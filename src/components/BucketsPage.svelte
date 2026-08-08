<script lang="ts">
  import BucketForm from './BucketForm.svelte';
  import AllocationForm from './AllocationForm.svelte';
  import { bucketBalancesStore, bucketsStore, fetchBucketBalance } from '$lib/stores';
  import type { Bucket, BucketAllocation } from '$lib/types';
  import { onMount } from 'svelte';

  let buckets: Bucket[] = [];
  let balances: Record<string, number> = {};
  let allocations: Record<string, BucketAllocation[]> = {};
  let loading = true;
  let error = '';
  let showCreateModal = false;
  let fundingBucket: Bucket | null = null;
  let spendingBucket: Bucket | null = null;
  let releaseBucket: Bucket | null = null;

  const unsubscribeBuckets = bucketsStore.subscribe(value => {
    buckets = value;
  });

  const unsubscribeBalances = bucketBalancesStore.subscribe(value => {
    balances = value;
  });

  onMount(() => {
    loadBuckets();
    return () => {
      unsubscribeBuckets();
      unsubscribeBalances();
    };
  });

  async function loadBuckets() {
    loading = true;
    error = '';
    try {
      const loaded = await bucketsStore.fetchAll();
      await Promise.all((loaded || []).map(bucket => fetchBucketBalance(bucket.id)));
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : 'Unable to load buckets';
    } finally {
      loading = false;
    }
  }

  async function handleCreated() {
    showCreateModal = false;
    await loadBuckets();
  }

  async function handleAllocation() {
    fundingBucket = null;
    spendingBucket = null;
    releaseBucket = null;
    await loadBuckets();
  }

  async function deleteBucket(bucket: Bucket) {
    if (!confirm(`Delete bucket "${bucket.name}"?`)) {
      return;
    }

    await bucketsStore.remove(bucket.id);
  }

  function progress(bucket: Bucket): number {
    const balance = balances[bucket.id] || 0;
    if (!bucket.targetAmount) {
      return balance > 0 ? 100 : 0;
    }
    return Math.min(Math.round((balance / bucket.targetAmount) * 100), 100);
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Buckets</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Envelope budgeting</h1>
      <p class="mt-2 text-sm text-slate-400">Bucket balances are derived from the allocation ledger — fund, spend, and release.</p>
    </div>
    <button class="btn-primary" on:click={() => (showCreateModal = true)}>+ New Bucket</button>
  </div>

  {#if error}
    <div class="card border-rose-500/20 bg-rose-500/10 text-rose-100">{error}</div>
  {/if}

  {#if loading}
    <div class="card">Loading buckets...</div>
  {:else if buckets.length === 0}
    <div class="card py-16 text-center text-slate-300">
      <p class="text-lg font-medium text-white">No buckets yet.</p>
      <p class="mt-2 text-sm text-slate-400">Create a bucket for a goal like Vacation or a sinking fund.</p>
    </div>
  {:else}
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {#each buckets as bucket}
        <article class="card space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{bucket.type}</p>
              <h2 class="text-xl font-bold text-white">{bucket.name}</h2>
            </div>
            <span class={'badge ' + (bucket.isActive ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400')}>
              {bucket.isActive ? 'active' : 'inactive'}
            </span>
          </div>

          <div class="rounded-2xl bg-slate-950/50 p-4">
            <div class="flex items-end justify-between">
              <div>
                <p class="text-xs text-slate-400">Balance</p>
                <p class="text-2xl font-black text-white">₹{(balances[bucket.id] || 0).toLocaleString('en-IN')}</p>
              </div>
              {#if bucket.targetAmount}
                <div class="text-right">
                  <p class="text-xs text-slate-400">Target</p>
                  <p class="text-lg font-bold text-slate-300">₹{bucket.targetAmount.toLocaleString('en-IN')}</p>
                </div>
              {/if}
            </div>
            {#if bucket.targetAmount}
              <div class="mt-3 h-2 rounded-full bg-slate-800">
                <div class="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style="width: {progress(bucket)}%"></div>
              </div>
              <p class="mt-1 text-xs text-slate-400">{progress(bucket)}% funded</p>
            {/if}
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="btn-sm flex-1 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" type="button" on:click={() => (fundingBucket = bucket)}>Fund</button>
            <button class="btn-sm flex-1 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" type="button" on:click={() => (spendingBucket = bucket)}>Spend</button>
            <button class="btn-sm flex-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={() => (releaseBucket = bucket)}>Release</button>
            <button class="btn-sm bg-slate-500/10 text-slate-300 hover:bg-slate-500/20" type="button" on:click={() => deleteBucket(bucket)}>Delete</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if showCreateModal}
    <BucketForm on:close={() => (showCreateModal = false)} on:save={handleCreated} />
  {/if}

  {#if fundingBucket}
    <AllocationForm bucket={fundingBucket} type="funding" on:close={() => (fundingBucket = null)} on:save={handleAllocation} />
  {/if}

  {#if spendingBucket}
    <AllocationForm bucket={spendingBucket} type="spending" on:close={() => (spendingBucket = null)} on:save={handleAllocation} />
  {/if}

  {#if releaseBucket}
    <AllocationForm bucket={releaseBucket} type="release" on:close={() => (releaseBucket = null)} on:save={handleAllocation} />
  {/if}
</section>
