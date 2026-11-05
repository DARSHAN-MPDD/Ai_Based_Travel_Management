document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;

  const user = Auth.getCurrentUser();
  if (user) {
    const el = document.getElementById('tmUserName');
    if (el) el.textContent = user.name || 'User';
  }

  document.getElementById('tmLogoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
  });

  const tmUserBtn = document.getElementById('tmUserBtn');
  const tmUserDropdown = document.getElementById('tmUserDropdown');
  if (tmUserBtn && tmUserDropdown) {
    tmUserBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tmUserDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      tmUserDropdown.classList.remove('show');
    });
  }

  const navToggle = document.getElementById('tmNavToggle');
  const navLinks = document.getElementById('tmNavLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('tm-nav-links-open');
    });
    navLinks.querySelectorAll('.tm-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('tm-nav-links-open');
      });
    });
  }

  document.getElementById('travel_date').min = new Date().toISOString().split('T')[0];

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('travel_date').value = today;

  await loadPackages();
  setupFormHandlers();
});

let selectedPackage = null;

// Render a package thumbnail using the shared destination image mapping.
// Falls back to the DB image_url, then to a stable stock photo on error.
function renderPackageImage(pkg) {
  const destName = pkg.destination_name || 'destination';
  const chain = DestinationImages ? DestinationImages.getImageChain(destName) : [];
  const primary = pkg.image_url || (chain.length ? chain[0] : 'https://images.unsplash.com/photo-1526525108745-5f7e7a9c1f7e?w=300&q=80');
  const fallbacks = chain.filter(url => url !== primary);
  const fb1 = fallbacks[0] || 'https://images.unsplash.com/photo-1526525108745-5f7e7a9c1f7e?w=300&q=80';
  const fb2 = fallbacks[1] || fb1;

  return `<img src="${primary}" alt="${escapeHtml(pkg.name)}" class="img-fluid rounded mt-2" style="max-height: 100px; object-fit: cover;" onerror="this.onerror=null;this.src='${fb1}';this.onerror=function(){this.src='${fb2}';}">`;
}

async function loadPackages() {
  const loading = document.getElementById('packagesLoading');
  const errorDiv = document.getElementById('packagesError');
  const list = document.getElementById('packagesList');

  loading.style.display = 'block';
  errorDiv.classList.add('d-none');

  try {
    const response = await Auth.apiRequest('/packages?limit=50&sort=price_asc');
    const packages = response.data || [];

    if (packages.length === 0) {
      list.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-box fa-3x text-muted mb-3"></i>
          <p class="text-muted">No packages available</p>
        </div>
      `;
      return;
    }

    list.innerHTML = packages.map(pkg => `
      <div class="package-option" data-package-id="${pkg.id}" data-price="${pkg.price_per_person}" data-max-travelers="${pkg.max_travelers}" data-duration="${pkg.duration_days}" data-destination="${escapeHtml(pkg.destination_name || '')}">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="package-name">${escapeHtml(pkg.name)}</span>
          <span class="badge bg-primary">${formatCurrency(pkg.price_per_person)}/person</span>
        </div>
        <div class="package-meta d-flex gap-3">
          <span><i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(pkg.destination_name)}</span>
          <span><i class="fas fa-clock me-1"></i>${pkg.duration_days} days</span>
          <span><i class="fas fa-users me-1"></i>Max ${pkg.max_travelers}</span>
        </div>
        ${renderPackageImage(pkg)}
      </div>
    `).join('');

    document.querySelectorAll('.package-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.package-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedPackage = {
          id: parseInt(option.dataset.packageId),
          name: option.querySelector('.package-name').textContent.trim(),
          destination: option.dataset.destination,
          price: parseFloat(option.dataset.price),
          maxTravelers: parseInt(option.dataset.maxTravelers),
          duration: parseInt(option.dataset.duration)
        };
        updateSummary();
        updateSubmitButton();
      });
    });
  } catch (error) {
    console.error('Failed to load packages:', error);
    errorDiv.textContent = error.message || 'Failed to load packages';
    errorDiv.classList.remove('d-none');
  } finally {
    loading.style.display = 'none';
  }
}

function setupFormHandlers() {
  const form = document.getElementById('bookForm');
  const errorAlert = document.getElementById('errorAlert');

  document.getElementById('travelers').addEventListener('change', updateSummary);
  document.getElementById('travelers').addEventListener('input', updateSummary);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.classList.add('d-none');

    if (!selectedPackage) {
      errorAlert.textContent = 'Please select a package';
      errorAlert.classList.remove('d-none');
      return;
    }

    const travelDate = document.getElementById('travel_date').value;
    const travelers = parseInt(document.getElementById('travelers').value);
    const specialRequests = document.getElementById('special_requests').value.trim();

    if (!travelDate) {
      errorAlert.textContent = 'Please select a travel date';
      errorAlert.classList.remove('d-none');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (travelDate < today) {
      errorAlert.textContent = 'Travel date must be in the future';
      errorAlert.classList.remove('d-none');
      return;
    }

    if (travelers < 1 || travelers > 20) {
      errorAlert.textContent = 'Travelers must be between 1 and 20';
      errorAlert.classList.remove('d-none');
      return;
    }

    if (travelers > selectedPackage.maxTravelers) {
      errorAlert.textContent = `This package supports up to ${selectedPackage.maxTravelers} travelers`;
      errorAlert.classList.remove('d-none');
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Booking...';

    try {
      const payload = {
        package_id: selectedPackage.id,
        travel_date: travelDate,
        travelers: travelers
      };

      if (specialRequests) {
        payload.special_requests = specialRequests;
      }

      const response = await Auth.apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (response.success && response.data) {
        displayBookingResult(response.data);
      } else {
        errorAlert.textContent = response.message || 'Failed to create booking';
        errorAlert.classList.remove('d-none');
      }
    } catch (error) {
      errorAlert.textContent = error.message || 'Failed to create booking';
      errorAlert.classList.remove('d-none');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-ticket-pen me-2"></i>Confirm Booking';
    }
  });
}

function updateSummary() {
  const summary = document.getElementById('selectedPackage');

  if (selectedPackage) {
    const travelers = parseInt(document.getElementById('travelers').value) || 1;
    const total = selectedPackage.price * travelers;

    summary.innerHTML = `
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted">Package:</span>
        <strong>${escapeHtml(selectedPackage.name)}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted">Price per person:</span>
        <strong>${formatCurrency(selectedPackage.price)}</strong>
      </div>
      <div class="d-flex justify-content-between mb-2">
        <span class="text-muted">Travelers:</span>
        <strong>${travelers}</strong>
      </div>
      <hr>
      <div class="d-flex justify-content-between">
        <span class="fw-bold">Total:</span>
        <strong class="text-primary fs-5">${formatCurrency(total)}</strong>
      </div>
    `;
  }
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = !selectedPackage;
}

function displayBookingResult(booking) {
  document.getElementById('resultBookingId').textContent = booking.booking_id;
  document.getElementById('resultPackage').textContent = booking.package_name;
  document.getElementById('resultDestination').textContent = booking.destination_name;
  document.getElementById('resultTravelers').textContent = booking.travelers;
  document.getElementById('resultTotal').textContent = formatCurrency(booking.total_amount);

  document.getElementById('bookingResult').style.display = 'block';
  document.getElementById('bookingForm').style.display = 'none';
  document.getElementById('errorAlert').classList.add('d-none');

  document.getElementById('bookingResult').scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
