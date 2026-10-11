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

  const urlParams = new URLSearchParams(window.location.search);
  const itineraryId = urlParams.get('id');

  if (itineraryId) {
    await loadItineraryDetail(itineraryId);
  } else {
    await loadItineraries(1);
  }
});

async function loadItineraries(page = 1) {
  const container = document.getElementById('itinerariesContainer');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const itinerariesList = document.getElementById('itinerariesList');
  const paginationNav = document.getElementById('paginationNav');

  loadingState.style.display = 'block';
  emptyState.style.display = 'none';
  itinerariesList.style.display = 'none';
  paginationNav.style.display = 'none';

  try {
    const response = await Auth.apiRequest(`/itinerary?page=${page}&limit=10`);
    
    loadingState.style.display = 'none';

    if (!response.data || response.data.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    itinerariesList.style.display = 'block';
    itinerariesList.innerHTML = response.data.map(itinerary => `
      <div class="itinerary-card" data-id="${itinerary.itinerary_id}">
        <div class="itinerary-card-header">
          <div class="itinerary-destination">
            <i class="fas fa-map-marker-alt me-1 text-primary"></i>
            <strong>${itinerary.destination.name}</strong>
            <span class="text-muted ms-2">${itinerary.destination.location}</span>
          </div>
          <div class="itinerary-category-badge">${itinerary.destination.category}</div>
        </div>
        <div class="itinerary-card-body">
          <div class="row g-2 mb-3">
            <div class="col-6 col-md-3">
              <div class="itinerary-stat">
                <div class="itinerary-stat-value">${itinerary.duration}</div>
                <div class="itinerary-stat-label">Days</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="itinerary-stat">
                <div class="itinerary-stat-value">${itinerary.travelers}</div>
                <div class="itinerary-stat-label">Travelers</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="itinerary-stat">
                <div class="itinerary-stat-value">${formatCurrency(itinerary.budget)}</div>
                <div class="itinerary-stat-label">Budget</div>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="itinerary-stat">
                <div class="itinerary-stat-value">${formatCurrency(itinerary.total_estimated_cost)}</div>
                <div class="itinerary-stat-label">Est. Cost</div>
              </div>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">Created: ${formatDate(itinerary.created_at)}</small>
            <div>
              <button class="btn btn-sm btn-outline-primary view-itinerary-btn" data-id="${itinerary.itinerary_id}">
                <i class="fas fa-eye me-1"></i>View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.view-itinerary-btn').forEach(btn => {
      btn.addEventListener('click', () => loadItineraryDetail(btn.dataset.id));
    });

    if (response.pagination && response.pagination.totalPages > 1) {
      paginationNav.style.display = 'block';
      renderPagination(response.pagination);
    }
  } catch (error) {
    console.error('Failed to load itineraries:', error);
    loadingState.style.display = 'none';
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Failed to load itineraries. Please try again.
      </div>
    `;
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
      loadItineraries(parseInt(link.dataset.page));
    });
  });
}

async function loadItineraryDetail(itineraryId) {
  const modal = new bootstrap.Modal(document.getElementById('itineraryDetailModal'));
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = 'Loading...';
  modalBody.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Loading itinerary details...</p>
    </div>
  `;
  modal.show();

  try {
    const response = await Auth.apiRequest(`/itinerary/${itineraryId}`);

    if (response.success && response.data) {
      const data = response.data;
      modalTitle.innerHTML = `
        <i class="fas fa-map-marker-alt me-1 text-primary"></i>
        ${data.destination.name} - ${data.duration} Days
      `;

      modalBody.innerHTML = `
        <div class="itinerary-detail">
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <div class="detail-stat">
                <div class="detail-stat-value">${data.duration}</div>
                <div class="detail-stat-label">Duration</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="detail-stat">
                <div class="detail-stat-value">${data.number_of_travelers}</div>
                <div class="detail-stat-label">Travelers</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="detail-stat">
                <div class="detail-stat-value">${formatCurrency(data.budget)}</div>
                <div class="detail-stat-label">Budget</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="detail-stat">
                <div class="detail-stat-value ${getBudgetStatusClass(data.budget_status)}">${formatCurrency(data.total_estimated_cost)}</div>
                <div class="detail-stat-label">Est. Total</div>
              </div>
            </div>
          </div>

          <div class="budget-status mb-4 p-3 rounded">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="mb-0"><i class="fas fa-chart-pie me-1"></i>Budget Analysis</h6>
              <span class="badge ${getBudgetStatusClass(data.budget_status)}">${formatBudgetStatus(data.budget_status)}</span>
            </div>
            <div class="row g-2">
              ${Object.entries(data.budget_breakdown).map(([key, value]) => `
                <div class="col-6 col-md-4 col-lg-2">
                  <div class="budget-category-card">
                    <i class="fas ${getCategoryIcon(key)}"></i>
                    <div class="budget-category-label">${formatCategoryName(key)}</div>
                    <div class="budget-category-value">${formatCurrency(value)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            ${data.budget_difference !== undefined && data.budget_difference !== 0 ? `
              <div class="mt-3 p-2 rounded ${data.budget_difference >= 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}">
                ${data.budget_difference >= 0 
                  ? `<i class="fas fa-check-circle me-1"></i>Remaining budget: ${formatCurrency(data.budget_difference)}`
                  : `<i class="fas fa-exclamation-circle me-1"></i>Over budget by: ${formatCurrency(Math.abs(data.budget_difference))}`
                }
              </div>
            ` : ''}
            ${data.suggestions && data.suggestions.length > 0 ? `
              <div class="mt-3">
                <h6><i class="fas fa-lightbulb me-1 text-warning"></i>Cost-Saving Suggestions</h6>
                <ul class="mb-0">
                  ${data.suggestions.map(s => `
                    <li class="suggestion-item">
                      <span class="suggestion-category">${s.category}</span>
                      <span class="suggestion-text">${s.suggestion}</span>
                      <span class="suggestion-savings">${formatCurrency(s.potential_savings)}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <div class="itinerary-days">
            <h5 class="mb-3"><i class="fas fa-calendar-alt me-1"></i>Day-by-Day Plan</h5>
            ${data.days.map(day => `
              <div class="day-card mb-3">
                <div class="day-header d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="mb-1"><i class="fas fa-calendar-day me-1"></i>${day.day_title}</h6>
                    <small class="text-muted">Day ${day.day_number}</small>
                  </div>
                  <span class="day-cost-badge">${formatCurrency(day.estimated_cost)}</span>
                </div>
                <div class="day-activities">
                  <div class="activity-slot mb-2">
                    <span class="activity-time morning"><i class="fas fa-sun me-1"></i>Morning</span>
                    <span class="activity-text ms-2">${day.morning_activity || 'Free time'}</span>
                  </div>
                  <div class="activity-slot mb-2">
                    <span class="activity-time afternoon"><i class="fas fa-cloud-sun me-1"></i>Afternoon</span>
                    <span class="activity-text ms-2">${day.afternoon_activity || 'Free time'}</span>
                  </div>
                  <div class="activity-slot mb-2">
                    <span class="activity-time evening"><i class="fas fa-moon me-1"></i>Evening</span>
                    <span class="activity-text ms-2">${day.evening_activity || 'Free time'}</span>
                  </div>
                </div>
                ${day.notes ? `<div class="day-notes mt-2 p-2 bg-light rounded"><i class="fas fa-lightbulb me-1 text-warning"></i>${day.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>

          ${data.assumptions && data.assumptions.length > 0 ? `
            <div class="assumptions mt-4 p-3 bg-light rounded">
              <h6><i class="fas fa-info-circle me-1 text-info"></i>Budget Assumptions</h6>
              <ul class="small text-muted mb-0">
                ${data.assumptions.map(a => `<li>${a}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      modalTitle.textContent = 'Error';
      modalBody.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          ${response.message || 'Failed to load itinerary details'}
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load itinerary detail:', error);
    modalTitle.textContent = 'Error';
    modalBody.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Failed to load itinerary details. Please try again.
      </div>
    `;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBudgetStatus(status) {
  const labels = {
    'within_budget': 'Within Budget',
    'near_budget': 'Near Budget',
    'over_budget': 'Over Budget'
  };
  return labels[status] || status;
}

function getBudgetStatusClass(status) {
  const classes = {
    'within_budget': 'bg-success',
    'near_budget': 'bg-warning text-dark',
    'over_budget': 'bg-danger'
  };
  return classes[status] || 'bg-secondary';
}

function getCategoryIcon(category) {
  const icons = {
    'transportation': 'fa-bus',
    'accommodation': 'fa-hotel',
    'food': 'fa-utensils',
    'activities': 'fa-ticket-alt',
    'miscellaneous': 'fa-ellipsis-h'
  };
  return icons[category] || 'fa-tag';
}

function formatCategoryName(category) {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
}