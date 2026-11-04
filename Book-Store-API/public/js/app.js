import { api, ApiError } from './api.js';

const COVER_TONES = ['#7457b8', '#2f4b7c', '#a24a7a', '#b2602f', '#3d6b4f', '#4a4a6a', '#9a3b3b'];
const LOW_STOCK_LIMIT = 5;

const $ = (selector) => document.querySelector(selector);

const dom = {
  pageTitle: $('#pageTitle'),
  hero: $('#hero'),
  stats: $('#stats'),
  statBooks: $('#statBooks'),
  statCategories: $('#statCategories'),
  statStock: $('#statStock'),
  statLow: $('#statLow'),
  summary: $('#resultSummary'),
  rows: $('#rows'),
  pageInfo: $('#pageInfo'),
  prevBtn: $('#prevBtn'),
  nextBtn: $('#nextBtn'),
  search: $('#search'),
  category: $('#category'),
  pageSize: $('#pageSize'),
  addBtn: $('#addBookBtn'),
  bookDialog: $('#bookDialog'),
  bookDialogTitle: $('#bookDialogTitle'),
  bookForm: $('#bookForm'),
  formCategory: $('#formCategory'),
  formError: $('#formError'),
  saveBtn: $('#saveBtn'),
  cover: $('#coverImage'),
  coverPreview: $('#coverPreview'),
  detailDialog: $('#detailDialog'),
  detailBody: $('#detailBody'),
  confirmDialog: $('#confirmDialog'),
  confirmText: $('#confirmText'),
  confirmDelete: $('#confirmDelete'),
  toasts: $('#toasts')
};

const state = { page: 1, totalPages: 1, total: 0, editingId: null, deletingId: null, books: [] };

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-IN');

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function toast(message, type = 'success') {
  const node = el('div', { class: `toast${type === 'error' ? ' toast--error' : ''}`, text: message });
  dom.toasts.append(node);
  setTimeout(() => node.remove(), 3500);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function toneFor(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_TONES[hash % COVER_TONES.length];
}

function coverUrl(book) {
  return book.coverImage ? `/uploads/${encodeURIComponent(book.coverImage)}` : '';
}

function thumbNode(book) {
  if (book.coverImage) {
    return el('div', { class: 'thumb' }, el('img', { src: coverUrl(book), alt: `Cover of ${book.title}`, loading: 'lazy' }));
  }
  return el('div', { class: 'thumb thumb--empty', style: `background:${toneFor(book.title)}`, 'aria-hidden': 'true', text: book.title.trim().charAt(0).toUpperCase() });
}

function stockPill(stock) {
  if (stock <= 0) return el('span', { class: 'pill pill--out', text: 'Out of stock' });
  if (stock <= LOW_STOCK_LIMIT) return el('span', { class: 'pill pill--low', text: `${stock} left` });
  return el('span', { class: 'pill pill--ok', text: `${stock} in stock` });
}

function stateRow(content) {
  return el('tr', {}, el('td', { class: 'state-cell', colspan: '6' }, content));
}

function bookRow(book) {
  return el('tr', {}, [
    el('td', {}, el('div', { class: 'book-cell' }, [
      thumbNode(book),
      el('div', {}, [el('strong', { text: book.title }), el('span', { text: book.author })])
    ])),
    el('td', { class: 'mono', text: book.isbn }),
    el('td', {}, el('span', { class: 'pill', text: book.category })),
    el('td', { class: 'price', text: money.format(book.price) }),
    el('td', {}, stockPill(book.stock)),
    el('td', {}, el('div', { class: 'row-actions' }, [
      el('button', { class: 'link-btn', type: 'button', text: 'View', onclick: () => openDetail(book) }),
      el('button', { class: 'link-btn', type: 'button', text: 'Edit', onclick: () => openForm(book) }),
      el('button', { class: 'link-btn link-btn--danger', type: 'button', text: 'Delete', onclick: () => askDelete(book) })
    ]))
  ]);
}

function renderLoading() {
  const rows = Array.from({ length: 5 }, () => el('tr', {}, el('td', { colspan: '6' }, el('div', { class: 'skeleton-line' }))));
  dom.rows.replaceChildren(...rows);
}

function hasFilters() {
  return Boolean(dom.search.value.trim() || dom.category.value);
}

function renderBooks() {
  if (state.books.length === 0) {
    dom.rows.replaceChildren(stateRow(hasFilters() ? 'No books match your search.' : 'No books yet. Use “Add New Book” to create the first one.'));
  } else {
    dom.rows.replaceChildren(...state.books.map(bookRow));
  }
  dom.summary.textContent = state.total === 1 ? '1 book' : `${number.format(state.total)} books`;
  dom.pageInfo.textContent = `Page ${state.page} of ${Math.max(1, state.totalPages)}`;
  dom.prevBtn.disabled = state.page <= 1;
  dom.nextBtn.disabled = state.page >= state.totalPages;
}

async function loadBooks() {
  renderLoading();
  const params = { page: state.page, limit: dom.pageSize.value, sortBy: 'createdAt', order: 'desc' };
  if (dom.search.value.trim()) params.search = dom.search.value.trim();
  if (dom.category.value) params.category = dom.category.value;

  try {
    const result = await api.list(params);
    if (result.totalPages > 0 && state.page > result.totalPages) {
      state.page = result.totalPages;
      return loadBooks();
    }
    state.books = result.data;
    state.total = result.total;
    state.totalPages = result.totalPages;
    renderBooks();
  } catch (err) {
    dom.rows.replaceChildren(stateRow(err.message));
    dom.summary.textContent = 'Unable to load';
    dom.pageInfo.textContent = 'Page 1';
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
  }
}

async function loadStats() {
  try {
    const categories = new Set();
    let page = 1;
    let totalPages = 1;
    let total = 0;
    let stock = 0;
    let low = 0;

    do {
      const result = await api.list({ page, limit: 100 });
      result.data.forEach((book) => {
        categories.add(book.category);
        stock += book.stock;
        if (book.stock <= LOW_STOCK_LIMIT) low += 1;
      });
      total = result.total;
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);

    dom.statBooks.textContent = number.format(total);
    dom.statCategories.textContent = number.format(categories.size);
    dom.statStock.textContent = number.format(stock);
    dom.statLow.textContent = number.format(low);
  } catch {
    [dom.statBooks, dom.statCategories, dom.statStock, dom.statLow].forEach((node) => { node.textContent = '—'; });
  }
}

function refresh() {
  return Promise.all([loadBooks(), loadStats()]);
}

function applyFilters() {
  state.page = 1;
  loadBooks();
}

function goTo(page) {
  state.page = page;
  loadBooks();
}

function showView() {
  const view = location.hash === '#books' ? 'books' : 'overview';
  const overview = view === 'overview';
  dom.pageTitle.textContent = overview ? 'Overview' : 'All Books';
  dom.hero.hidden = !overview;
  dom.stats.hidden = !overview;
  document.querySelectorAll('.nav__item').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function openDetail(book) {
  const cover = book.coverImage
    ? el('img', { src: coverUrl(book), alt: `Cover of ${book.title}` })
    : el('div', { class: 'thumb--empty', style: `background:${toneFor(book.title)}`, text: book.title.trim().charAt(0).toUpperCase() });

  const info = el('div', { class: 'detail__info' }, [
    el('span', { class: 'pill', text: book.category }),
    el('h3', { text: book.title }),
    el('span', { class: 'muted', text: `by ${book.author}` }),
    el('span', { class: 'detail__price', text: money.format(book.price) }),
    el('dl', { class: 'facts' }, [
      el('dt', { text: 'ISBN' }), el('dd', { text: book.isbn }),
      el('dt', { text: 'Stock' }), el('dd', { text: book.stock > 0 ? `${book.stock} available` : 'Out of stock' }),
      el('dt', { text: 'Added' }), el('dd', { text: new Date(book.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) })
    ]),
    book.description ? el('p', { class: 'detail__desc', text: book.description }) : null,
    book.tags && book.tags.length ? el('div', { class: 'tags' }, book.tags.map((tag) => el('span', { class: 'tag', text: tag }))) : null
  ]);

  dom.detailBody.replaceChildren(el('div', { class: 'detail__cover' }, cover), info);
  dom.detailDialog.showModal();
}

function setCoverPreview(src) {
  if (src) dom.coverPreview.replaceChildren(el('img', { src, alt: 'Cover preview' }));
  else dom.coverPreview.replaceChildren(el('span', { text: 'No cover' }));
}

function clearFormErrors() {
  dom.formError.textContent = '';
  dom.bookForm.querySelectorAll('[data-error-for]').forEach((node) => { node.textContent = ''; });
  dom.bookForm.querySelectorAll('.invalid').forEach((node) => node.classList.remove('invalid'));
}

function showFieldError(field, message) {
  const target = dom.bookForm.querySelector(`[data-error-for="${field}"]`);
  const input = dom.bookForm.elements[field];
  if (target) target.textContent = message;
  else dom.formError.textContent = message;
  if (input && input.classList) input.classList.add('invalid');
}

function openForm(book = null) {
  state.editingId = book ? book._id : null;
  dom.bookForm.reset();
  clearFormErrors();
  dom.bookDialogTitle.textContent = book ? 'Edit Book' : 'Add New Book';
  dom.saveBtn.textContent = book ? 'Save changes' : 'Add book';

  if (book) {
    const form = dom.bookForm.elements;
    form.title.value = book.title;
    form.author.value = book.author;
    form.isbn.value = book.isbn;
    form.category.value = book.category;
    form.price.value = book.price;
    form.stock.value = book.stock;
    form.tags.value = (book.tags || []).join(', ');
    form.description.value = book.description || '';
  }
  setCoverPreview(book ? coverUrl(book) : '');
  dom.bookDialog.showModal();
}

function validateClient(form) {
  let valid = true;
  const rules = [
    ['title', (v) => v.length >= 2 && v.length <= 120, 'Title must be 2-120 characters'],
    ['author', (v) => v.length > 0, 'Author is required'],
    ['isbn', (v) => /^[0-9-]{10,17}$/.test(v), 'ISBN must be 10-17 digits (hyphen allowed)'],
    ['category', (v) => v.length > 0, 'Choose a category'],
    ['price', (v) => v !== '' && Number(v) >= 0, 'Enter a price of 0 or more'],
    ['stock', (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), 'Stock must be a whole number of 0 or more']
  ];
  for (const [name, test, message] of rules) {
    if (!test(form.elements[name].value.trim())) {
      showFieldError(name, message);
      valid = false;
    }
  }
  return valid;
}

async function submitForm(event) {
  event.preventDefault();
  clearFormErrors();
  if (!validateClient(dom.bookForm)) return;

  const editing = Boolean(state.editingId);
  const data = new FormData();
  for (const name of ['title', 'author', 'isbn', 'category', 'price', 'stock', 'tags', 'description']) {
    const value = dom.bookForm.elements[name].value.trim();
    if (value !== '' || editing) data.append(name, value);
  }
  if (editing && !data.get('stock')) data.set('stock', '0');
  if (dom.cover.files[0]) data.append('coverImage', dom.cover.files[0]);

  dom.saveBtn.disabled = true;
  try {
    if (editing) await api.update(state.editingId, data);
    else await api.create(data);
    dom.bookDialog.close();
    toast(editing ? 'Book updated' : 'Book added');
    if (!editing) {
      state.page = 1;
    }
    await refresh();
  } catch (err) {
    if (err instanceof ApiError && err.errors.length) {
      err.errors.forEach(({ field, message }) => showFieldError(field, message));
    } else if (err instanceof ApiError && err.status === 409) {
      showFieldError('isbn', err.message);
    } else {
      dom.formError.textContent = err.message;
    }
  } finally {
    dom.saveBtn.disabled = false;
  }
}

function askDelete(book) {
  state.deletingId = book._id;
  dom.confirmText.textContent = `“${book.title}” will be removed from the catalog. This cannot be undone.`;
  dom.confirmDialog.showModal();
}

async function confirmDelete() {
  dom.confirmDelete.disabled = true;
  try {
    await api.remove(state.deletingId);
    dom.confirmDialog.close();
    toast('Book deleted');
    await refresh();
  } catch (err) {
    dom.confirmDialog.close();
    toast(err.message, 'error');
  } finally {
    dom.confirmDelete.disabled = false;
  }
}

function onCoverChange() {
  const file = dom.cover.files[0];
  const errorNode = dom.bookForm.querySelector('[data-error-for="coverImage"]');
  errorNode.textContent = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    errorNode.textContent = 'File too large (max 2 MB)';
    dom.cover.value = '';
    return;
  }
  setCoverPreview(URL.createObjectURL(file));
}

function fillCategories(categories) {
  categories.forEach((name) => dom.category.append(el('option', { value: name, text: name })));
  dom.formCategory.append(el('option', { value: '', text: 'Select a category' }));
  categories.forEach((name) => dom.formCategory.append(el('option', { value: name, text: name })));
}

function bindEvents() {
  dom.addBtn.addEventListener('click', () => openForm());
  dom.bookForm.addEventListener('submit', submitForm);
  dom.cover.addEventListener('change', onCoverChange);
  dom.confirmDelete.addEventListener('click', confirmDelete);
  dom.prevBtn.addEventListener('click', () => goTo(state.page - 1));
  dom.nextBtn.addEventListener('click', () => goTo(state.page + 1));

  dom.search.addEventListener('input', debounce(applyFilters, 300));
  dom.category.addEventListener('change', applyFilters);
  dom.pageSize.addEventListener('change', applyFilters);
  $('#filterForm').addEventListener('submit', (event) => event.preventDefault());

  window.addEventListener('hashchange', showView);

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
    });
  });
}

async function init() {
  bindEvents();
  showView();
  try {
    const result = await api.categories();
    fillCategories(result.data);
  } catch {
    fillCategories(['Fiction', 'Non-Fiction', 'Education', 'Science', 'History', 'Technology', 'Other']);
  }
  refresh();
}

init();