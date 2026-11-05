function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function renderStars(rating, interactive = false, starId = 'stars') {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      html += `<i class="fas fa-star text-warning"></i>`;
    } else {
      html += `<i class="far fa-star text-warning"></i>`;
    }
  }
  return html;
}

function getDestinationId() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));
  return isNaN(id) || id <= 0 ? null : id;
}

async function loadDestination(destId) {
  const loading = document.getElementById('destinationLoading');
  const errorDiv = document.getElementById('destinationError');
  const content = document.getElementById('destinationContent');

  try {
    const response = await fetch(`${API_BASE}/destinations/${destId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load destination');
    }

    const dest = data.data;
    document.getElementById('breadcrumbName').textContent = dest.name;
    document.getElementById('destTitle').textContent = dest.name;
    document.getElementById('destLocation').textContent = dest.location || 'Location not specified';
    document.getElementById('destDescription').textContent = dest.description || '';
    document.getElementById('destCategory').textContent = dest.category || 'N/A';
    document.getElementById('destBestTime').textContent = dest.best_time || 'N/A';
    document.getElementById('destDuration').textContent = dest.recommended_duration ? `${dest.recommended_duration} days` : 'N/A';
    document.getElementById('destBudget').textContent = dest.estimated_budget ? `₹${parseFloat(dest.estimated_budget).toFixed(2)}` : 'N/A';

    if (dest.image_url) {
      const img = document.getElementById('destImage');
      // Prefer the local destination photo; fall back to the DB image and
      // then to a stable stock photo if both fail to load.
      const localPrimary = DestinationImages.getPrimaryImage(dest.name);
      img.src = dest.image_url || localPrimary;
      img.alt = dest.name;
      img.onerror = function () {
        this.onerror = null;
        if (this.src !== localPrimary) {
          this.src = localPrimary;
        } else {
          this.src = 'https://images.unsplash.com/photo-1526525108745-5f7e7a9c1f7e?w=800&q=80';
          this.onerror = function () { this.style.display = 'none'; };
        }
      };
    } else {
      const img = document.getElementById('destImage');
      const localPrimary = DestinationImages.getPrimaryImage(dest.name);
      img.src = localPrimary;
      img.alt = dest.name;
      img.onerror = function () {
        this.onerror = null;
        this.src = 'https://images.unsplash.com/photo-1526525108745-5f7e7a9c1f7e?w=800&q=80';
        this.onerror = function () { this.style.display = 'none'; };
      };
    }

    // Populate the local destination gallery with the remaining photos.
    const galleryGrid = document.getElementById('destGalleryGrid');
    const gallerySection = document.getElementById('destGallery');
    if (galleryGrid && gallerySection && DestinationImages) {
      const gallery = DestinationImages.getGalleryImages(dest.name);
      if (gallery && gallery.length > 0) {
        galleryGrid.innerHTML = gallery.map((url, i) => `
          <div class="col-6 col-md-4 col-lg-3">
            <img src="${url}" alt="${escapeHtml(dest.name)} gallery ${i + 1}" class="img-fluid rounded shadow-sm w-100" style="height: 160px; object-fit: cover;" onerror="this.style.display='none';">
          </div>
        `).join('');
        gallerySection.style.display = 'block';
      }
    }

    if (dest.packages && dest.packages.length > 0) {
      const packagesSection = document.getElementById('packagesSection');
      const packagesList = document.getElementById('packagesList');
      packagesList.innerHTML = dest.packages.map(pkg => {
        // Prefer the local destination photo for package cards so every
        // package for a place uses the same image set as the Packages page.
        const localImg = DestinationImages.getPrimaryImage(pkg.destination_name || dest.name);
        const imgHtml = (pkg.image_url || localImg)
          ? `<img src="${pkg.image_url || localImg}" alt="${escapeHtml(pkg.name)}" class="card-img-top" style="height: 150px; object-fit: cover;" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#6a4c93,#9b5de5)';">`
          : '';
        return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm">
            ${imgHtml}
            <div class="card-body">
              <h6 class="card-title">${escapeHtml(pkg.name)}</h6>
              <p class="card-text text-muted small">${escapeHtml(pkg.description || '').substring(0, 80)}...</p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="fw-bold text-primary">₹${parseFloat(pkg.price_per_person).toFixed(2)}/person</span>
                <span class="badge bg-light text-dark">${pkg.duration_days} days</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
      packagesSection.style.display = 'block';
    }

    loading.style.display = 'none';
    errorDiv.style.display = 'none';
    content.style.display = 'block';
  } catch (error) {
    loading.style.display = 'none';
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

async function loadReviewSummary(destId) {
  const summaryDiv = document.getElementById('reviewSummary');

  try {
    const response = await fetch(`${API_BASE}/reviews/${destId}/summary`);
    const data = await response.json();

    if (!response.ok) {
      summaryDiv.innerHTML = `<p class="text-muted">Unable to load review summary.</p>`;
      return;
    }

    const summary = data.data;
    const total = summary.total_reviews;
    const avg = summary.average_rating;

    let distributionHtml = '';
    for (let i = 5; i >= 1; i--) {
      const count = summary.rating_distribution[i] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      distributionHtml += `
        <div class="d-flex align-items-center mb-1">
          <span class="badge bg-warning text-dark me-2">${i}</span>
          <div class="flex-grow-1">
            <div class="progress" style="height: 12px;">
              <div class="progress-bar bg-warning" role="progressbar" style="width: ${percentage}%;"></div>
            </div>
          </div>
          <span class="small text-muted ms-2">${count}</span>
        </div>
      `;
    }

    summaryDiv.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body py-3">
          <div class="row align-items-center g-3">
            <div class="col-md-auto text-center">
              <h2 class="display-5 fw-bold mb-0">${total > 0 ? avg.toFixed(1) : '0.0'}</h2>
              <div class="text-warning mb-1">${renderStars(total > 0 ? Math.round(avg) : 0)}</div>
              <span class="text-muted small">${total} review${total !== 1 ? 's' : ''}</span>
            </div>
            <div class="col">
              ${distributionHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    summaryDiv.innerHTML = `<p class="text-muted">Unable to load review summary.</p>`;
  }
}

let currentReviewPage = 1;
const REVIEW_LIMIT = 10;

async function loadReviews(destId, page = 1) {
  currentReviewPage = page;
  const listDiv = document.getElementById('reviewList');

  try {
    const response = await fetch(`${API_BASE}/reviews/${destId}?page=${page}&limit=${REVIEW_LIMIT}`);
    const data = await response.json();

    if (!response.ok) {
      listDiv.innerHTML = `<p class="text-muted">Unable to load reviews.</p>`;
      return;
    }

    const reviews = data.data;
    const pagination = data.pagination;

    if (reviews.length === 0) {
      listDiv.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-star fa-2x text-muted mb-3"></i>
          <p class="text-muted">No reviews yet. Be the first to write one!</p>
        </div>
      `;
      document.getElementById('reviewPagination').style.display = 'none';
      return;
    }

    const currentUser = Auth.getCurrentUser();
    const isAdmin = currentUser && currentUser.role === 'admin';

    listDiv.innerHTML = reviews.map(review => {
      const createdAt = formatDate(review.created_at);
      const canEdit = currentUser && review.user_id === currentUser.id;
      const canDelete = canEdit || isAdmin;
      const isOwner = canEdit;

      let actionButtons = '';
      if (canEdit) {
        actionButtons = `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary" onclick="editReview(${review.id})">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-outline-danger" onclick="deleteReview(${review.id})">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        `;
      } else if (isAdmin) {
        actionButtons = `
          <button class="btn btn-outline-danger btn-sm" onclick="deleteReview(${review.id})">
            <i class="fas fa-trash"></i> Delete
          </button>
        `;
      }

      return `
        <div class="review-card card shadow-sm mb-3" data-review-id="${review.id}">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="d-flex align-items-center gap-2">
                <div class="review-stars">${renderStars(review.rating)}</div>
                ${review.title ? `<strong class="ms-2">${escapeHtml(review.title)}</strong>` : ''}
              </div>
              <small class="text-muted">${createdAt}</small>
            </div>
            <p class="mb-2">${escapeHtml(review.comment)}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted small">
                <i class="fas fa-user me-1"></i>${escapeHtml(review.user_name)}
              </span>
              ${actionButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (pagination && pagination.totalPages > 1) {
      renderPagination(pagination);
    } else {
      document.getElementById('reviewPagination').style.display = 'none';
    }
  } catch (error) {
    listDiv.innerHTML = `<p class="text-muted">Unable to load reviews.</p>`;
  }
}

function renderPagination(pagination) {
  let html = '';
  const maxPages = 7;
  let start = Math.max(1, pagination.page - Math.floor(maxPages / 2));
  let end = Math.min(pagination.totalPages, start + maxPages - 1);

  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1);
  }

  const prevDisabled = pagination.page <= 1 ? 'disabled' : '';
  const nextDisabled = pagination.page >= pagination.totalPages ? 'disabled' : '';

  html += `<li class="page-item ${prevDisabled}"><a class="page-link" href="#" onclick="loadReviews(${pagination.destinationId || getDestinationId()}, ${pagination.page - 1})">Previous</a></li>`;

  if (start > 1) {
    html += `<li class="page-item"><a class="page-link" href="#" onclick="loadReviews(${getDestinationId()}, 1)">1</a></li>`;
    if (start > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
  }

  for (let i = start; i <= end; i++) {
    const active = i === pagination.page ? 'active' : '';
    html += `<li class="page-item ${active}"><a class="page-link" href="#" onclick="loadReviews(${getDestinationId()}, ${i})">${i}</a></li>`;
  }

  if (end < pagination.totalPages) {
    if (end < pagination.totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    html += `<li class="page-item"><a class="page-link" href="#" onclick="loadReviews(${getDestinationId()}, ${pagination.totalPages})">${pagination.totalPages}</a></li>`;
  }

  html += `<li class="page-item ${nextDisabled}"><a class="page-link" href="#" onclick="loadReviews(${getDestinationId()}, ${pagination.page + 1})">Next</a></li>`;

  document.getElementById('paginationControls').innerHTML = html;
  document.getElementById('reviewPagination').style.display = 'block';
}

function setupRatingStars(starContainerId, ratingInputId, labelId) {
  const stars = document.getElementById(starContainerId);
  stars.addEventListener('mouseover', function(e) {
    if (e.target.classList.contains('star')) {
      const value = parseInt(e.target.getAttribute('data-value'));
      highlightStars(stars, value);
      document.getElementById(labelId).textContent = ['Poor', 'Fair', 'Average', 'Good', 'Excellent'][value - 1];
    }
  });

  stars.addEventListener('mouseleave', function() {
    const currentValue = parseInt(document.getElementById(ratingInputId).value) || 0;
    highlightStars(stars, currentValue);
    document.getElementById(labelId).textContent = currentValue > 0 ? ['Poor', 'Fair', 'Average', 'Good', 'Excellent'][currentValue - 1] : 'Select rating';
  });

  stars.addEventListener('click', function(e) {
    if (e.target.classList.contains('star')) {
      const value = parseInt(e.target.getAttribute('data-value'));
      document.getElementById(ratingInputId).value = value;
      highlightStars(stars, value);
      document.getElementById(labelId).textContent = ['Poor', 'Fair', 'Average', 'Good', 'Excellent'][value - 1];
    }
  });
}

function highlightStars(container, value) {
  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < value) {
      star.classList.remove('far');
      star.classList.add('fas');
    } else {
      star.classList.remove('fas');
      star.classList.add('far');
    }
  });
}

let editingReviewId = null;

window.editReview = async function(reviewId) {
  const modalEl = document.getElementById('editReviewModal');
  const modal = new bootstrap.Modal(modalEl);

  try {
    const response = await fetch(`${API_BASE}/reviews/${getDestinationId()}`);
    const data = await response.json();
    const review = data.data.find(r => r.id === reviewId);

    if (!review) return;

    editingReviewId = reviewId;
    document.getElementById('editReviewId').value = reviewId;
    document.getElementById('editReviewTitle').value = review.title || '';
    document.getElementById('editReviewComment').value = review.comment || '';
    document.getElementById('editRatingValue').value = review.rating;
    highlightStars(document.getElementById('editRatingStars'), review.rating);

    modal.show();
  } catch (error) {
    alert('Unable to load review for editing.');
  }
};

window.deleteReview = async function(reviewId) {
  if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.message || 'Failed to delete review.');
      return;
    }

    const destId = getDestinationId();
    await loadReviews(destId, currentReviewPage);
    await loadReviewSummary(destId);
  } catch (error) {
    alert('Failed to delete review. Please try again.');
  }
};

window.editReviewSubmit = async function() {
  const reviewId = document.getElementById('editReviewId').value;
  const rating = document.getElementById('editRatingValue').value;
  const title = document.getElementById('editReviewTitle').value.trim();
  const comment = document.getElementById('editReviewComment').value.trim();
  const submitBtn = document.getElementById('editReviewSubmitBtn');
  const spinner = document.getElementById('editReviewSpinner');
  const btnText = submitBtn.querySelector('.me-2') || submitBtn.childNodes[0];

  if (!rating || rating < 1 || rating > 5) {
    alert('Please select a rating between 1 and 5.');
    return;
  }

  if (!comment || comment.length === 0) {
    document.getElementById('editFormError').textContent = 'Comment is required.';
    document.getElementById('editFormError').style.display = 'block';
    return;
  }

  if (comment.length > 2000) {
    document.getElementById('editFormError').textContent = 'Comment must not exceed 2000 characters.';
    document.getElementById('editFormError').style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rating: parseInt(rating), title: title || null, comment })
    });
    const data = await response.json();

    if (!response.ok) {
      document.getElementById('editFormError').textContent = data.message || 'Failed to update review.';
      document.getElementById('editFormError').style.display = 'block';
      return;
    }

    const modalEl = document.getElementById('editReviewModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    const destId = getDestinationId();
    await loadReviews(destId, currentReviewPage);
    await loadReviewSummary(destId);
  } catch (error) {
    document.getElementById('editFormError').textContent = 'Failed to update review. Please try again.';
    document.getElementById('editFormError').style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
};

async function submitReview() {
  const rating = document.getElementById('ratingValue').value;
  const title = document.getElementById('reviewTitle').value.trim();
  const comment = document.getElementById('reviewComment').value.trim();
  const submitBtn = document.getElementById('reviewSubmitBtn');
  const spinner = document.getElementById('reviewSpinner');
  const formError = document.getElementById('reviewFormError');
  const formSuccess = document.getElementById('reviewFormSuccess');

  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  if (!rating || rating < 1 || rating > 5) {
    formError.textContent = 'Please select a rating between 1 and 5.';
    formError.style.display = 'block';
    return;
  }

  if (!comment || comment.length === 0) {
    formError.textContent = 'Comment is required.';
    formError.style.display = 'block';
    return;
  }

  if (comment.length > 2000) {
    formError.textContent = 'Comment must not exceed 2000 characters.';
    formError.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    const data = await Auth.apiRequest(`/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        destination_id: getDestinationId(),
        rating: parseInt(rating),
        title: title || null,
        comment
      })
    });

    formSuccess.textContent = 'Review submitted successfully!';
    formSuccess.style.display = 'block';
    formError.style.display = 'none';

    document.getElementById('reviewForm').reset();
    document.getElementById('ratingValue').value = '';
    highlightStars(document.getElementById('ratingStars'), 0);
    document.getElementById('ratingLabel').textContent = 'Select rating';

    const destId = getDestinationId();
    await loadReviews(destId, 1);
    await loadReviewSummary(destId);
  } catch (error) {
    formError.textContent = error.message || 'Failed to submit review. Please try again.';
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
}

function updateAuthUI() {
  const user = Auth.getCurrentUser();
  const token = localStorage.getItem('token');
  const navLogin = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const tmNavLoginItem = document.getElementById('tmNavLoginItem');
  const tmNavRegisterItem = document.getElementById('tmNavRegisterItem');
  const tmUserMenu = document.getElementById('tmUserMenu');
  const tmUserName = document.getElementById('tmUserName');
  const tmLogoutBtn = document.getElementById('tmLogoutBtn');

  if (token) {
    if (user) {
      if (tmUserName) tmUserName.textContent = user.name || 'User';
    }
    if (navLogin) navLogin.style.display = 'none';
    if (navRegister) navRegister.style.display = 'none';
    if (tmNavLoginItem) tmNavLoginItem.style.display = 'none';
    if (tmNavRegisterItem) tmNavRegisterItem.style.display = 'none';
    if (tmUserMenu) tmUserMenu.style.display = 'block';

    const authMsg = document.getElementById('reviewAuthMessage');
    authMsg.textContent = `Logged in as ${user.name || 'User'}. You can submit reviews below.`;
    authMsg.style.display = 'block';

    document.getElementById('submitReviewSection').style.display = 'block';
  } else {
    if (navLogin) navLogin.style.display = 'inline-block';
    if (navRegister) navRegister.style.display = 'inline-block';
    if (tmNavLoginItem) tmNavLoginItem.style.display = 'flex';
    if (tmNavRegisterItem) tmNavRegisterItem.style.display = 'flex';
    if (tmUserMenu) tmUserMenu.style.display = 'none';

    const authMsg = document.getElementById('reviewAuthMessage');
    authMsg.textContent = 'You must be logged in to submit a review.';
    authMsg.style.display = 'block';
    authMsg.className = 'alert alert-warning';
    document.getElementById('submitReviewSection').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  updateAuthUI();

  const tmLogoutBtn = document.getElementById('tmLogoutBtn');
  if (tmLogoutBtn) {
    tmLogoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      Auth.logout();
    });
  }

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

  const destId = getDestinationId();
  if (!destId) {
    document.getElementById('destinationError').textContent = 'No destination ID specified.';
    document.getElementById('destinationError').style.display = 'block';
    return;
  }

  loadDestination(destId);
  loadReviewSummary(destId);
  loadReviews(destId, 1);

  setupRatingStars('ratingStars', 'ratingValue', 'ratingLabel');
  setupRatingStars('editRatingStars', 'editRatingValue', 'editRatingLabel');

  document.getElementById('reviewForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    submitReview();
  });

  document.getElementById('editReviewSubmitBtn')?.addEventListener('click', function(e) {
    e.preventDefault();
    editReviewSubmit();
  });
});
