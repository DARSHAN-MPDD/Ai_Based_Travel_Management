const CANCELABLE_STATUSES = ['PENDING', 'CONFIRMED'];

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;

  const user = Auth.getCurrentUser();
  if (user) {
    document.getElementById('userName').textContent = user.name || 'User';
  }

  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
  });

  await loadBookings(1);
});

async function loadBookings(page = 1) {
  const container = document.getElementById('bookingsContainer');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const bookingsList = document.getElementById('bookingsList');
  const errorState = document.getElementById('errorState');
  const paginationNav = document.getElementById('paginationNav');

  loadingState.style.display = 'block';
  emptyState.style.display = 'none';
  bookingsList.style.display = 'none';
  errorState.classList.add('d-none');
  paginationNav.style.display = 'none';

  try {
    const response = await Auth.apiRequest(`/bookings?page=${page}&limit=10`);

    loadingState.style.display = 'none';

    if (!response.data || response.data.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    bookingsList.style.display = 'block';
    bookingsList.innerHTML = response.data.map(booking => {
      const canCancel = CANCELABLE_STATUSES.includes(booking.status);
      const statusClass = getStatusClass(booking.status);
      const statusIcon = getStatusIcon(booking.status);
      const isRefunded = booking.payment_status === 'refunded';

      return `
        <div class="card booking-card mb-3" data-booking-id="${booking.id}" data-booking-ref="${booking.booking_id}" data-status="${booking.status}">
          <div class="card-body">
            <div class="row g-3 align-items-center">
              <div class="col-md-6">
                <div class="d-flex align-items-center gap-3">
                  <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                    <i class="fas fa-map-marker-alt fa-lg text-primary"></i>
                  </div>
                  <div>
                    <h6 class="mb-1 fw-semibold">${escapeHtml(booking.destination_name || 'Unknown')}</h6>
                    <p class="text-muted small mb-0">${escapeHtml(booking.package_name || '')} • ${booking.duration_days || ''} days</p>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="text-center">
                  <div class="text-muted small">Travel Date</div>
                  <div class="fw-medium">${formatDate(booking.travel_date)}</div>
                </div>
              </div>
              <div class="col-md-1">
                <div class="text-center">
                  <div class="text-muted small">Travelers</div>
                  <div class="fw-medium">${booking.travelers}</div>
                </div>
              </div>
              <div class="col-md-1">
                <div class="text-center">
                  <div class="text-muted small">Total</div>
                  <div class="fw-medium">${formatCurrency(booking.total_amount)}</div>
                </div>
              </div>
              <div class="col-md-1">
                <div class="text-center">
                  <span class="badge ${statusClass}">
                    <i class="${statusIcon} me-1"></i>${booking.status}
                  </span>
                </div>
              </div>
            </div>

            <div class="row g-3 mt-2 pt-2" style="border-top: 1px solid #e9ecef;">
              <div class="col-12 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <span class="text-muted small">Ref: ${escapeHtml(booking.booking_id)}</span>
                  <span class="text-muted small ms-3">Payment: ${escapeHtml(booking.payment_status)}</span>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary view-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-eye me-1"></i>Details
                  </button>
                  ${canCancel ? `<button class="btn btn-sm btn-outline-danger cancel-booking-btn" data-id="${booking.id}" data-ref="${booking.booking_id}">
                    <i class="fas fa-times me-1"></i>Cancel
                  </button>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (response.pagination && response.pagination.totalPages > 1) {
      paginationNav.style.display = 'block';
      renderPagination(response.pagination);
    }

    document.querySelectorAll('.view-booking-btn').forEach(btn => {
      btn.addEventListener('click', () => showBookingDetail(btn.dataset.id));
    });

    document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmCancel(btn.dataset.id, btn.dataset.ref));
    });
  } catch (error) {
    console.error('Failed to load bookings:', error);
    loadingState.style.display = 'none';
    errorState.classList.remove('d-none');
    document.getElementById('errorMessage').textContent = error.message || 'Failed to load bookings. Please try again.';
  }
}

function renderPagination(pagination) {
  const { page, totalPages } = pagination;
  const list = document.getElementById('paginationList');
  let html = '';

  if (page > 1) {
    html += `<li class="page-item"><a class="page-link" href="#" data-page="${page - 1}">Previous</a></li>`;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    html += `<li class="page-item ${i === page ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
  }

  if (page < totalPages) {
    html += `<li class="page-item"><a class="page-link" href="#" data-page="${page + 1}">Next</a></li>`;
  }

  list.innerHTML = html;

  list.querySelectorAll('a.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      loadBookings(parseInt(link.dataset.page));
    });
  });
}

async function showBookingDetail(bookingId) {
  const modal = new bootstrap.Modal(document.getElementById('bookingDetailModal'));
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = 'Loading...';
  modalBody.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Loading booking details...</p>
    </div>
  `;
  modal.show();

  try {
    const response = await Auth.apiRequest(`/bookings/${bookingId}`);

    if (response.success && response.data) {
      const data = response.data;
      modalTitle.innerHTML = `<i class="fas fa-ticket-alt me-2"></i>${data.booking_id}`;

      const statusClass = getStatusClass(data.status);
      const statusIcon = getStatusIcon(data.status);

      let cancelSection = '';
      if (CANCELABLE_STATUSES.includes(data.status)) {
        cancelSection = `
          <div class="alert alert-warning mt-3">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>This booking can be cancelled.</strong>
              </div>
              <button class="btn btn-danger btn-sm" onclick="confirmCancel('${data.id}', '${data.booking_id}')">
                Cancel Booking
              </button>
            </div>
          </div>
        `;
      }

      modalBody.innerHTML = `
        <div class="booking-detail">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="badge ${statusClass} fs-6">
              <i class="${statusIcon} me-1"></i>${data.status}
            </span>
            <span class="text-muted small">Payment: ${escapeHtml(data.payment_status)}</span>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="border rounded p-3 text-center">
                <div class="text-muted small">Package</div>
                <div class="fw-medium">${escapeHtml(data.package_name || 'N/A')}</div>
              </div>
            </div>
            <div class="col-6">
              <div class="border rounded p-3 text-center">
                <div class="text-muted small">Destination</div>
                <div class="fw-medium">${escapeHtml(data.destination_name || 'N/A')}</div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="border rounded p-3 text-center">
                <div class="text-muted small">Travel Date</div>
                <div class="fw-medium">${formatDate(data.travel_date)}</div>
              </div>
            </div>
            <div class="col-6">
              <div class="border rounded p-3 text-center">
                <div class="text-muted small">Travelers</div>
                <div class="fw-medium">${data.travelers}</div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <div class="border rounded p-3 text-center">
                <div class="text-muted small">Total Amount</div>
                <div class="fw-medium">${formatCurrency(data.total_amount)}</div>
              </div>
              <div class="col-6">
                <div class="border rounded p-3 text-center">
                  <div class="text-muted small">Price per Person</div>
                  <div class="fw-medium">${formatCurrency(data.package_price_per_person)}</div>
                </div>
              </div>
            </div>

          ${data.special_requests ? `
            <div class="mb-3">
              <label class="form-label fw-semibold">Special Requests</label>
              <div class="border rounded p-3 bg-light">${escapeHtml(data.special_requests)}</div>
            </div>
          ` : ''}

          <div class="payment-notice">
            <div class="d-flex align-items-center gap-2">
              <i class="fas fa-info-circle"></i>
              <small><strong>Payment not processed.</strong> Payment processing is not yet implemented.</small>
            </div>
          </div>

          ${cancelSection}
        </div>
      `;
    } else {
      modalTitle.textContent = 'Error';
      modalBody.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          ${response.message || 'Failed to load booking details'}
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load booking detail:', error);
    modalTitle.textContent = 'Error';
    modalBody.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Failed to load booking details. Please try again.
      </div>
    `;
  }
}

function confirmCancel(bookingId, bookingRef) {
  if (confirm(`Are you sure you want to cancel booking ${bookingRef}?\n\nThis action cannot be undone.`)) {
    cancelBooking(bookingId);
  }
}

async function cancelBooking(bookingId) {
  const modal = bootstrap.Modal.getInstance(document.getElementById('bookingDetailModal'));
  if (modal) modal.hide();

  try {
    const response = await Auth.apiRequest(`/bookings/${bookingId}/cancel`, {
      method: 'PUT'
    });

    if (response.success) {
      loadBookings(1);
    } else {
      alert(response.message || 'Failed to cancel booking');
    }
  } catch (error) {
    console.error('Cancel booking error:', error);
    alert(error.message || 'Failed to cancel booking. Please try again.');
  }
}

function getStatusClass(status) {
  const classes = {
    PENDING: 'bg-warning bg-opacity-10 text-warning',
    CONFIRMED: 'bg-success bg-opacity-10 text-success',
    CANCELLED: 'bg-danger bg-opacity-10 text-danger',
    COMPLETED: 'bg-info bg-opacity-10 text-info'
  };
  return classes[status] || 'bg-secondary bg-opacity-10 text-secondary';
}

function getStatusIcon(status) {
  const icons = {
    PENDING: 'fas fa-clock',
    CONFIRMED: 'fas fa-check-circle',
    CANCELLED: 'fas fa-times-circle',
    COMPLETED: 'fas fa-flag-checkered'
  };
  return icons[status] || 'fas fa-question-circle';
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
