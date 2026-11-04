export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError('Failed to fetch. Make sure the backend and MongoDB are running.', 0);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new ApiError(payload.message || 'Something went wrong', response.status, payload.errors || []);
  }
  return payload;
}

export const api = {
  categories: () => request('/api/categories'),
  list: (params) => request(`/api/books?${new URLSearchParams(params)}`),
  create: (formData) => request('/api/books', { method: 'POST', body: formData }),
  update: (id, formData) => request(`/api/books/${id}`, { method: 'PUT', body: formData }),
  remove: (id) => request(`/api/books/${id}`, { method: 'DELETE' })
};