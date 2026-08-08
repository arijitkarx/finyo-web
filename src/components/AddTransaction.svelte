<script lang="ts">
  import { accountsStore, bucketsStore, categoriesStore, merchantsStore, transactionsStore } from '$lib/stores';
  import type { Account, Bucket, Category, Merchant, Transaction, TransactionType } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  export let transaction: Partial<Transaction> | null = null;
  export let mode: 'create' | 'edit' = 'create';

  let accounts: Account[] = [];
  let categories: Category[] = [];
  let buckets: Bucket[] = [];
  let merchants: Merchant[] = [];

  let formData = {
    amount: '',
    type: 'expense' as TransactionType,
    direction: 'debit',
    categoryId: '',
    accountId: '',
    bucketId: '',
    merchantId: '',
    mode: 'UPI',
    notes: '',
    tags: '',
    createdAt: '',
    fromAccountId: '',
    toAccountId: '',
  };

  let isSubmitting = false;
  let error = '';

  const modes = ['UPI', 'Card', 'Cash', 'Bank Transfer', 'Wallet'];

  $: isTransfer = formData.type === 'transfer';

  $: if (transaction && transaction.id) {
    formData = {
      amount: transaction.amount?.toString() ?? '',
      type: transaction.type ?? 'expense',
      direction: transaction.direction ?? (transaction.type === 'income' ? 'credit' : 'debit'),
      categoryId: transaction.categoryId ?? '',
      accountId: transaction.accountId ?? '',
      bucketId: transaction.bucketId ?? '',
      merchantId: transaction.merchantId ?? '',
      mode: transaction.mode ?? 'UPI',
      notes: transaction.notes ?? '',
      tags: Array.isArray(transaction.tags) ? transaction.tags.join(', ') : '',
      createdAt: transaction.date ? transaction.date.slice(0, 10) : '',
      fromAccountId: '',
      toAccountId: '',
    };
  }

  onMount(async () => {
    try {
      const [acc, cats, bcks, merch] = await Promise.all([
        accountsStore.fetchAll(),
        categoriesStore.fetchAll(),
        bucketsStore.fetchAll(),
        merchantsStore.fetchAll(),
      ]);
      accounts = acc.filter(a => a.isActive);
      categories = cats;
      buckets = bcks.filter(b => b.isActive);
      merchants = merch;
    } catch (fetchError) {
      console.error('Failed to load reference data:', fetchError);
    }
  });

  function handleTypeChange() {
    formData.direction = formData.type === 'income' || formData.type === 'refund' ? 'credit' : 'debit';
  }

  async function handleSubmit() {
    if (isTransfer) {
      if (!formData.fromAccountId || !formData.toAccountId || !formData.amount) {
        error = 'Please provide both accounts and an amount for the transfer';
        return;
      }

      if (formData.fromAccountId === formData.toAccountId) {
        error = 'From and to accounts must be different';
        return;
      }

      isSubmitting = true;
      error = '';
      try {
        await transactionsStore.transfer({
          fromAccountId: formData.fromAccountId,
          toAccountId: formData.toAccountId,
          amount: parseFloat(formData.amount),
          occurredAt: formData.createdAt ? new Date(formData.createdAt).toISOString() : undefined,
          notes: formData.notes || undefined,
        });
        dispatch('save');
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to create transfer';
      } finally {
        isSubmitting = false;
      }
      return;
    }

    if (!formData.amount) {
      error = 'Please enter an amount';
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      const payload: Record<string, unknown> = {
        amount: parseFloat(formData.amount),
        type: formData.type,
        direction: formData.direction,
        mode: formData.mode || 'UPI',
        source: 'manual',
        notes: formData.notes || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        categoryId: formData.categoryId || undefined,
        accountId: formData.accountId || undefined,
        bucketId: formData.bucketId || undefined,
        merchantId: formData.merchantId || undefined,
        createdAt: formData.createdAt ? new Date(formData.createdAt).toISOString() : undefined,
      };

      if (mode === 'edit' && transaction?.id) {
        await transactionsStore.updateTransaction(transaction.id, payload);
      } else {
        await transactionsStore.addTransaction(payload);
      }

      dispatch('save');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save transaction';
    } finally {
      isSubmitting = false;
    }
  }

  function closeModal() {
    dispatch('close');
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="surface relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Transactions</p>
        <h2 id="modal-title" class="text-2xl font-bold text-white">{mode === 'edit' ? 'Edit Transaction' : 'Add Transaction'}</h2>
      </div>
      <button on:click={closeModal} class="text-2xl text-slate-400 hover:text-white" aria-label="Close modal">×</button>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}

      <!-- Type -->
      <fieldset>
        <legend class="mb-2 block text-sm font-medium text-slate-300">Type</legend>
        <div class="flex flex-wrap gap-3">
          {#each ['expense', 'income', 'transfer', 'refund', 'adjustment'] as type}
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input type="radio" name="type" value={type} bind:group={formData.type} on:change={handleTypeChange} />
              <span class="capitalize">{type}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- Transfer accounts -->
      {#if isTransfer}
        <div>
          <label for="fromAccountId" class="mb-1 block text-sm font-medium text-slate-300">From account *</label>
          <select id="fromAccountId" class="input-field" bind:value={formData.fromAccountId}>
            <option value="">Select account</option>
            {#each accounts as account}
              <option value={account.id}>{account.name}{account.institution ? ` (${account.institution})` : ''}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="toAccountId" class="mb-1 block text-sm font-medium text-slate-300">To account *</label>
          <select id="toAccountId" class="input-field" bind:value={formData.toAccountId}>
            <option value="">Select account</option>
            {#each accounts as account}
              <option value={account.id}>{account.name}{account.institution ? ` (${account.institution})` : ''}</option>
            {/each}
          </select>
        </div>
      {:else}
        <!-- Direction -->
        <fieldset>
          <legend class="mb-2 block text-sm font-medium text-slate-300">Direction</legend>
          <div class="flex gap-4">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input type="radio" name="direction" value="debit" bind:group={formData.direction} />
              Debit
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input type="radio" name="direction" value="credit" bind:group={formData.direction} />
              Credit
            </label>
          </div>
        </fieldset>
      {/if}

      <!-- Amount -->
      <div>
        <label for="amount" class="mb-1 block text-sm font-medium text-slate-300">Amount *</label>
        <input id="amount" type="number" step="0.01" bind:value={formData.amount} placeholder="0.00" class="input-field" />
      </div>

      <!-- Date -->
      <div>
        <label for="createdAt" class="mb-1 block text-sm font-medium text-slate-300">Date</label>
        <input id="createdAt" type="date" bind:value={formData.createdAt} class="input-field" />
      </div>

      <!-- Category -->
      <div>
        <label for="categoryId" class="mb-1 block text-sm font-medium text-slate-300">Category</label>
        <select id="categoryId" class="input-field" bind:value={formData.categoryId}>
          <option value="">Auto-classify</option>
          {#each categories as category}
            <option value={category.id}>{category.isSystem ? category.name : `${category.name} (mine)`}</option>
          {/each}
        </select>
      </div>

      <!-- Account -->
      <div>
        <label for="accountId" class="mb-1 block text-sm font-medium text-slate-300">Account</label>
        <select id="accountId" class="input-field" bind:value={formData.accountId}>
          <option value="">None</option>
          {#each accounts as account}
            <option value={account.id}>{account.name}{account.institution ? ` (${account.institution})` : ''}</option>
          {/each}
        </select>
      </div>

      <!-- Merchant -->
      <div>
        <label for="merchantId" class="mb-1 block text-sm font-medium text-slate-300">Merchant</label>
        <select id="merchantId" class="input-field" bind:value={formData.merchantId}>
          <option value="">None</option>
          {#each merchants as merchant}
            <option value={merchant.id}>{merchant.displayName || merchant.canonicalName}</option>
          {/each}
        </select>
      </div>

      <!-- Bucket -->
      <div>
        <label for="bucketId" class="mb-1 block text-sm font-medium text-slate-300">Bucket</label>
        <select id="bucketId" class="input-field" bind:value={formData.bucketId}>
          <option value="">None</option>
          {#each buckets as bucket}
            <option value={bucket.id}>{bucket.name}</option>
          {/each}
        </select>
      </div>

      <!-- Mode -->
      <div>
        <label for="mode" class="mb-1 block text-sm font-medium text-slate-300">Payment Mode</label>
        <input id="mode" list="mode-options" class="input-field" bind:value={formData.mode} placeholder="UPI, Card, Cash..." />
        <datalist id="mode-options">
          {#each modes as item}
            <option value={item}></option>
          {/each}
        </datalist>
      </div>

      <!-- Notes -->
      <div>
        <label for="notes" class="mb-1 block text-sm font-medium text-slate-300">Notes</label>
        <textarea id="notes" bind:value={formData.notes} placeholder="Add a note..." class="input-field h-20 resize-none"></textarea>
      </div>

      <!-- Tags -->
      <div>
        <label for="tags" class="mb-1 block text-sm font-medium text-slate-300">Tags</label>
        <input id="tags" type="text" bind:value={formData.tags} placeholder="e.g., lunch, office (comma separated)" class="input-field" />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="button" class="btn-secondary flex-1" on:click={closeModal} disabled={isSubmitting}>Cancel</button>
        <button type="submit" class="btn-primary flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update' : isTransfer ? 'Transfer' : 'Save'}
        </button>
      </div>
    </form>
  </div>
</div>
