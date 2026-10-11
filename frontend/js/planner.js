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

  document.getElementById('start_date').min = new Date().toISOString().split('T')[0];

  await loadDestinations();
  loadRecentItineraries();
  setupFormHandlers();
});

const INTERESTS = [
  { id: 'nature', label: 'Nature', icon: 'fa-tree' },
  { id: 'adventure', label: 'Adventure', icon: 'fa-mountain' },
  { id: 'beach', label: 'Beach', icon: 'fa-umbrella-beach' },
  { id: 'history', label: 'History', icon: 'fa-landmark' },
  { id: 'culture', label: 'Culture', icon: 'fa-theater-masks' },
  { id: 'food', label: 'Food', icon: 'fa-utensils' },
  { id: 'photography', label: 'Photography', icon: 'fa-camera' },
  { id: 'shopping', label: 'Shopping', icon: 'fa-shopping-bag' }
];

async function loadDestinations() {
  try {
    const response = await Auth.apiRequest('/destinations?limit=50');
    const destinations = response.data || [];
    
    const select = document.getElementById('destination_id');
    select.innerHTML = '<option value="" disabled selected>Select a destination</option>';
    
    destinations.forEach(dest => {
      const option = document.createElement('option');
      option.value = dest.id;
      option.textContent = `${dest.name} (${dest.location}) - ${dest.category}`;
      option.dataset.category = dest.category;
      option.dataset.estimatedBudget = dest.estimated_budget;
      option.dataset.recommendedDuration = dest.recommended_duration;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      const selected = select.options[select.selectedIndex];
      if (selected.value) {
        const durationInput = document.getElementById('duration');
        const budgetInput = document.getElementById('budget');
        
        if (!durationInput.value || durationInput.value === '3') {
          durationInput.value = selected.dataset.recommendedDuration || 3;
        }
        if (!budgetInput.value || budgetInput.value === '20000') {
          budgetInput.value = selected.dataset.estimatedBudget || 20000;
        }
      }
    });
  } catch (error) {
    console.error('Failed to load destinations:', error);
    showError('Failed to load destinations. Please refresh the page.');
  }
}

function setupInterests() {
  const container = document.getElementById('interestsContainer');
  container.innerHTML = INTERESTS.map(interest => `
    <div class="interest-chip">
      <input type="checkbox" id="interest_${interest.id}" name="interests" value="${interest.id}">
      <label for="interest_${interest.id}">
        <i class="fas ${interest.icon}"></i>
        <span>${interest.label}</span>
      </label>
    </div>
  `).join('');
}

function setupFormHandlers() {
  setupInterests();

  document.getElementById('plannerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateItinerary();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('plannerForm').reset();
    document.getElementById('start_date').min = new Date().toISOString().split('T')[0];
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    document.querySelectorAll('#interestsContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
  });
}

async function generateItinerary() {
  const form = document.getElementById('plannerForm');
  const generateBtn = document.getElementById('generateBtn');
  const loadingContainer = document.getElementById('loadingContainer');
  const errorContainer = document.getElementById('errorContainer');
  const resultContainer = document.getElementById('resultContainer');

  const selectedInterests = Array.from(
    document.querySelectorAll('#interestsContainer input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const payload = {
    destination_id: parseInt(document.getElementById('destination_id').value),
    duration: parseInt(document.getElementById('duration').value),
    budget: parseFloat(document.getElementById('budget').value),
    travelers: parseInt(document.getElementById('travelers').value),
    interests: selectedInterests,
    travel_type: document.getElementById('travel_type').value || null,
    start_date: document.getElementById('start_date').value || null
  };

  if (!payload.destination_id) {
    showError('Please select a destination');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
  loadingContainer.style.display = 'block';
  errorContainer.style.display = 'none';
  resultContainer.style.display = 'none';

  try {
    const response = await Auth.apiRequest('/itinerary', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    loadingContainer.style.display = 'none';
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Itinerary';

    if (response.success && response.data) {
      displayItinerary(response.data);
      resultContainer.style.display = 'block';
      resultContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
      showError(response.message || 'Failed to generate itinerary');
    }
  } catch (error) {
    loadingContainer.style.display = 'none';
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Itinerary';
    showError(error.message || 'Failed to generate itinerary. Please try again.');
  }
}

function displayItinerary(data) {
  document.getElementById('summaryDestination').textContent = data.destination.name;
  document.getElementById('summaryDuration').textContent = `${data.duration} days`;
  document.getElementById('summaryTravelers').textContent = data.number_of_travelers;
  document.getElementById('summaryBudget').textContent = formatCurrency(data.budget);

  const budgetStatusContainer = document.getElementById('budgetStatusContainer');
  const budgetStatusBadge = document.getElementById('budgetStatusBadge');
  
  budgetStatusBadge.textContent = formatBudgetStatus(data.budget_status);
  budgetStatusBadge.className = `badge ${getBudgetStatusClass(data.budget_status)}`;

  const breakdownContainer = document.getElementById('budgetBreakdown');
  breakdownContainer.innerHTML = '';
  
  const breakdown = data.budget_breakdown;
  const categories = [
    { key: 'transportation', label: 'Transport', icon: 'fa-bus' },
    { key: 'accommodation', label: 'Accommodation', icon: 'fa-hotel' },
    { key: 'food', label: 'Food', icon: 'fa-utensils' },
    { key: 'activities', label: 'Activities', icon: 'fa-ticket-alt' },
    { key: 'miscellaneous', label: 'Miscellaneous', icon: 'fa-ellipsis-h' }
  ];

  categories.forEach(cat => {
    const value = breakdown[cat.key] || 0;
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-2';
    col.innerHTML = `
      <div class="budget-category-card">
        <i class="fas ${cat.icon}"></i>
        <div class="budget-category-label">${cat.label}</div>
        <div class="budget-category-value">${formatCurrency(value)}</div>
      </div>
    `;
    breakdownContainer.appendChild(col);
  });

  const totalRow = document.createElement('div');
  totalRow.className = 'col-12';
  totalRow.innerHTML = `
    <div class="budget-total">
      <span>Total Estimated Cost</span>
      <span>${formatCurrency(data.total_estimated_cost)}</span>
    </div>
  `;
  breakdownContainer.appendChild(totalRow);

  if (data.budget_difference !== undefined) {
    const diffRow = document.createElement('div');
    diffRow.className = 'col-12';
    const diffClass = data.budget_difference >= 0 ? 'text-success' : 'text-danger';
    const diffText = data.budget_difference >= 0 
      ? `Remaining: ${formatCurrency(data.budget_difference)}`
      : `Over Budget: ${formatCurrency(Math.abs(data.budget_difference))}`;
    diffRow.innerHTML = `<div class="budget-difference ${diffClass}">${diffText}</div>`;
    breakdownContainer.appendChild(diffRow);
  }

  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const suggestionsList = document.getElementById('suggestionsList');
  
  if (data.suggestions && data.suggestions.length > 0) {
    suggestionsContainer.style.display = 'block';
    suggestionsList.innerHTML = data.suggestions.map(s => `
      <li class="suggestion-item">
        <span class="suggestion-category">${s.category}</span>
        <span class="suggestion-text">${s.suggestion}</span>
        <span class="suggestion-savings">${formatCurrency(s.potential_savings)}</span>
      </li>
    `).join('');
  } else {
    suggestionsContainer.style.display = 'none';
  }

  const assumptionsContainer = document.createElement('div');
  assumptionsContainer.className = 'assumptions mt-3';
  assumptionsContainer.innerHTML = `
    <h6><i class="fas fa-info-circle me-1 text-info"></i>Budget Assumptions</h6>
    <ul class="small text-muted mb-0">
      ${data.assumptions.map(a => `<li>${a}</li>`).join('')}
    </ul>
  `;
  breakdownContainer.appendChild(assumptionsContainer);

  const daysContainer = document.getElementById('itineraryDays');
  daysContainer.innerHTML = data.days.map(day => `
    <div class="day-card">
      <div class="day-header">
        <h6 class="mb-1"><i class="fas fa-calendar-day me-1"></i>${day.day_title}</h6>
        <span class="day-number-badge">Day ${day.day_number}</span>
      </div>
      <div class="day-activities">
        <div class="activity-slot">
          <span class="activity-time morning"><i class="fas fa-sun me-1"></i>Morning</span>
          <span class="activity-text">${day.morning_activity || 'Free time'}</span>
        </div>
        <div class="activity-slot">
          <span class="activity-time afternoon"><i class="fas fa-cloud-sun me-1"></i>Afternoon</span>
          <span class="activity-text">${day.afternoon_activity || 'Free time'}</span>
        </div>
        <div class="activity-slot">
          <span class="activity-time evening"><i class="fas fa-moon me-1"></i>Evening</span>
          <span class="activity-text">${day.evening_activity || 'Free time'}</span>
        </div>
      </div>
      ${day.notes ? `<div class="day-notes"><i class="fas fa-lightbulb me-1 text-warning"></i>${day.notes}</div>` : ''}
      <div class="day-cost">
        <i class="fas fa-rupee-sign me-1"></i>Estimated Cost: ${formatCurrency(day.estimated_cost)}
      </div>
    </div>
  `).join('');

  const saveBtn = document.getElementById('saveItineraryBtn');
  saveBtn.style.display = 'inline-block';
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    
    try {
      const response = await Auth.apiRequest('/itinerary', {
        method: 'POST',
        body: JSON.stringify({
          destination_id: payload.destination_id,
          duration: payload.duration,
          budget: payload.budget,
          travelers: payload.travelers,
          interests: payload.interests,
          travel_type: payload.travel_type,
          start_date: payload.start_date
        })
      });
      
      if (response.success) {
        saveBtn.innerHTML = '<i class="fas fa-check me-1"></i>Saved!';
        saveBtn.classList.remove('btn-outline-primary');
        saveBtn.classList.add('btn-success');
        loadRecentItineraries();
      }
    } catch (error) {
      saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Itinerary';
      saveBtn.disabled = false;
      alert('Failed to save itinerary: ' + error.message);
    }
  };
}

async function loadRecentItineraries() {
  try {
    const response = await Auth.apiRequest('/itinerary?limit=5');
    const container = document.getElementById('recentItineraries');
    
    if (!response.data || response.data.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3">
          <i class="fas fa-route fa-2x text-muted mb-2"></i>
          <p class="text-muted small mb-2">No saved itineraries yet</p>
          <small class="text-muted">Create one using the planner</small>
        </div>
      `;
      return;
    }

    container.innerHTML = response.data.map(itinerary => `
      <a href="itinerary.html?id=${itinerary.itinerary_id}" class="recent-itinerary-item text-decoration-none">
        <div class="recent-itinerary-info">
          <div class="recent-itinerary-destination">${itinerary.destination.name}</div>
          <div class="recent-itinerary-meta">
            <span>${itinerary.duration} days</span>
            <span>${itinerary.travelers} traveler${itinerary.travelers > 1 ? 's' : ''}</span>
            <span>${formatCurrency(itinerary.budget)}</span>
          </div>
        </div>
        <div class="recent-itinerary-cost">
          ${formatCurrency(itinerary.total_estimated_cost)}
        </div>
      </a>
    `).join('');
  } catch (error) {
    console.error('Failed to load recent itineraries:', error);
    document.getElementById('recentItineraries').innerHTML = `
      <div class="text-center py-3">
        <p class="text-muted small mb-0">Unable to load recent itineraries</p>
      </div>
    `;
  }
}

function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorContainer.style.display = 'flex';
  errorContainer.scrollIntoView({ behavior: 'smooth' });
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

const payload = {};