<script lang="ts">
  import AddTransaction from './AddTransaction.svelte';
  import ImportSmsModal from './ImportSmsModal.svelte';
  import { fetchDashboard, transactionsStore } from '$lib/stores';
  import type { Transaction } from '$lib/types';
  import { onMount } from 'svelte';

  let transactions: Transaction[] = [];
  let pagination = { page: 1, limit: 50, total: 0, totalPages: 1 };
  let loading = false;
  let showEditor = false;
  let showImport = false;
  let editingTransaction: Transaction | null = null;
  let openMenuId: number | null = null;

  let filters = {
    startDate: '',
    endDate: '',
    tags: '',
    type: 'all',
  };

  const unsubscribe = transactionsStore.subscribe(value => {
    transactions = value;
  });

  const unsubscribePagination = transactionsStore.pagination.subscribe(value => {
    pagination = value;
  });

  onMount(() => {
    loadTransactions(1);
    return () => {
      unsubscribe();
      unsubscribePagination();
    };
  });

  $: visibleTransactions = filters.type === 'all'
    ? transactions
    : transactions.filter(t => t.type === filters.type);

  async function loadTransactions(page = 1) {
    loading = true;
    try {
      const payload: Record<string, string | number | undefined> = {
        page,
        limit: 50,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        tags: filters.tags.trim() || undefined,
        match: 'all',
      };

      await transactionsStore.fetchTransactions(payload);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    loadTransactions(1);
  }

  function clearFilters() {
    filters = { startDate: '', endDate: '', tags: '', type: 'all' };
    loadTransactions(1);
  }

  function nextPage() {
    if (pagination.page < pagination.totalPages) {
      loadTransactions(pagination.page + 1);
    }
  }

  function prevPage() {
    if (pagination.page > 1) {
      loadTransactions(pagination.page - 1);
    }
  }

  const typeLabels: Record<string, string> = {
    expense: 'Expense',
    income: 'Income',
    transfer: 'Transfer',
    refund: 'Refund',
    adjustment: 'Adjustment',
  };

  function typeClass(type: string) {
    switch (type) {
      case 'expense':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-300';
      case 'income':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
      case 'transfer':
        return 'bg-sky-500/15 text-sky-600 dark:text-sky-300';
      case 'refund':
        return 'bg-violet-500/15 text-violet-600 dark:text-violet-300';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
    }
  }

  function amountColor(type: string) {
    switch (type) {
      case 'expense':
        return 'text-rose-500 dark:text-rose-300';
      case 'income':
      case 'refund':
        return 'text-emerald-500 dark:text-emerald-300';
      default:
        return 'text-sky-500 dark:text-sky-300';
    }
  }

  function amountSign(type: string) {
    return type === 'expense' ? '-' : '+';
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function openEditor(transaction: Transaction | null = null) {
    editingTransaction = transaction;
    showEditor = true;
    openMenuId = null;
  }

  async function handleSave() {
    showEditor = false;
    editingTransaction = null;
    openMenuId = null;
    await loadTransactions(pagination.page);
    await fetchDashboard();
  }

  function closeEditor() {
    showEditor = false;
    editingTransaction = null;
  }

  async function deleteTransaction(id: number) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    await transactionsStore.deleteTransaction(id);
    openMenuId = null;
    await loadTransactions(pagination.page);
    await fetchDashboard();
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Transactions</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Filtered ledger</h1>
      <p class="mt-2 text-sm text-slate-400">Slice the ledger by date, tags, and type — filtering happens on the server.</p>
    </div>
    <div class="flex flex-wrap gap-3">
      <button class="btn-secondary" on:click={() => (showImport = true)}>Import SMS</button>
      <button class="btn-primary" on:click={() => openEditor()}>+ Add Transaction</button>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <article class="card">
      <p class="text-sm text-slate-400">Transactions</p>
      <p class="mt-2 text-2xl font-black text-white sm:text-3xl">{pagination.total}</p>
      <p class="mt-2 text-sm text-slate-400">matching your filters</p>
    </article>
    <article class="card">
      <p class="text-sm text-slate-400">Expense total</p>
      <p class="mt-2 text-2xl font-black text-rose-400 sm:text-3xl">₹{formatMoney(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}</p>
      <p class="mt-2 text-sm text-slate-400">on this page</p>
    </article>
    <article class="card">
      <p class="text-sm text-slate-400">Income total</p>
      <p class="mt-2 text-2xl font-black text-emerald-400 sm:text-3xl">₹{formatMoney(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}</p>
      <p class="mt-2 text-sm text-slate-400">on this page</p>
    </article>
    <article class="card">
      <p class="text-sm text-slate-400">Page</p>
      <p class="mt-2 text-2xl font-black text-sky-400 sm:text-3xl">{pagination.page} / {pagination.totalPages || 1}</p>
      <p class="mt-2 text-sm text-slate-400">{pagination.total} total records</p>
    </article>
  </div>

  <div class="card space-y-4">
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-xl font-bold text-white">Filters</h2>
      <button class="btn-sm border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={clearFilters}>Reset</button>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <input class="input-field" type="date" bind:value={filters.startDate} />
      <input class="input-field" type="date" bind:value={filters.endDate} />
      <input class="input-field" type="text" placeholder="Tags, comma separated" bind:value={filters.tags} />
      <select class="input-field" bind:value={filters.type}>
        <option value="all">All types</option>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
        <option value="transfer">Transfer</option>
        <option value="refund">Refund</option>
        <option value="adjustment">Adjustment</option>
      </select>
    </div>
    <div class="flex justify-end">
      <button class="btn-primary" type="button" on:click={applyFilters} disabled={loading}>{loading ? 'Loading...' : 'Apply filters'}</button>
    </div>
  </div>

  {#if loading}
    <div class="card py-16 text-center text-slate-300">Loading transactions...</div>
  {:else if visibleTransactions.length === 0}
    <div class="card py-16 text-center text-slate-300">
      <p class="text-lg font-medium text-white">No transactions match the current filters.</p>
      <p class="mt-2 text-sm text-slate-400">Try clearing the filters or add a new transaction.</p>
    </div>
  {:else}
    <div class="overflow-hidden rounded-3xl border border-white/10 bg-white/90 shadow-2xl shadow-slate-950/30 backdrop-blur dark:bg-slate-900/85">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead class="bg-slate-100/80 dark:bg-slate-950/60">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Date</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Category</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Type</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Amount</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Mode</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Tags</th>
              <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            {#each visibleTransactions as transaction (transaction.id)}
              <tr class="relative bg-white/90 text-slate-900 transition hover:bg-slate-50 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800/80">
                <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">{formatDate(transaction.date || transaction.createdAt)}</td>
                <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                  {transaction.category || '—'}
                  {#if transaction.classificationStatus === 'needs_review'}
                    <span class="badge ml-2 bg-amber-500/15 text-amber-600 dark:text-amber-300">needs review</span>
                  {/if}
                </td>
                <td class="px-6 py-4 text-sm">
                  <span class={'badge ' + typeClass(transaction.type)}>{typeLabels[transaction.type] || transaction.type}</span>
                </td>
                <td class={'px-6 py-4 text-sm font-bold ' + amountColor(transaction.type)}>
                  {transaction.type === 'transfer' ? '' : amountSign(transaction.type)}₹{formatMoney(transaction.amount)}
                </td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{transaction.mode}</td>
                <td class="px-6 py-4 text-sm">
                  <div class="flex flex-wrap gap-2">
                    {#each transaction.tags || [] as tag}
                      <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200">{tag}</span>
                    {/each}
                  </div>
                </td>
                <td class="px-6 py-4 text-sm">
                  <div class="relative inline-block text-left">
                    <button
                      type="button"
                      class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-500 transition hover:border-indigo-500 hover:text-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      on:click={() => (openMenuId = openMenuId === transaction.id ? null : transaction.id)}
                    >
                      ⋯
                    </button>
                    {#if openMenuId === transaction.id}
                      <div class="absolute right-0 z-20 mt-3 w-72 rounded-3xl border border-white/10 bg-slate-950 p-4 text-slate-100 shadow-2xl shadow-slate-950/60">
                        <div class="space-y-3">
                          <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{transaction.type}</p>
                            <h3 class="mt-1 text-lg font-bold text-white">{transaction.category || 'Uncategorized'}</h3>
                            <p class="text-sm text-slate-400">{transaction.mode} · {formatDate(transaction.date || transaction.createdAt)}</p>
                          </div>
                          <div class="rounded-2xl bg-white/5 p-3 text-sm text-slate-300">
                            {transaction.notes || transaction.rawDescription || 'No notes available'}
                          </div>
                          <button class="btn-secondary w-full" type="button" on:click={() => openEditor(transaction)}>Edit transaction</button>
                          <button class="w-full rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20" type="button" on:click={() => deleteTransaction(transaction.id)}>
                            Delete transaction
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
        <button class="btn-sm border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" type="button" on:click={prevPage} disabled={pagination.page <= 1}>← Previous</button>
        <span class="text-sm text-slate-400">Page {pagination.page} of {pagination.totalPages || 1}</span>
        <button class="btn-sm border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" type="button" on:click={nextPage} disabled={pagination.page >= pagination.totalPages}>Next →</button>
      </div>
    </div>
  {/if}

  {#if showEditor}
    <AddTransaction mode={editingTransaction ? 'edit' : 'create'} transaction={editingTransaction} on:close={closeEditor} on:save={handleSave} />
  {/if}

  {#if showImport}
    <ImportSmsModal on:close={() => (showImport = false)} on:imported={handleSave} />
  {/if}
</section>
