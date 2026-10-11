document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  
  const user = Auth.getCurrentUser();
  if (user) {
    document.getElementById('userDisplayName').textContent = user.name?.split(' ')[0] || 'Traveler';
    document.getElementById('userName').textContent = user.name || 'User';
  }
  
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
  });
  
  loadDashboardStats();
  loadRecentActivity();
});

async function loadDashboardStats() {
  try {
    const data = await Auth.apiRequest('/bookings');
    const bookings = data.data || [];
    
    document.getElementById('statTrips').textContent = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING').length;
    document.getElementById('statDestinations').textContent = new Set(bookings.map(b => b.destination_id)).size;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadRecentActivity() {
  try {
    const data = await Auth.apiRequest('/bookings');
    const bookings = data.data || [];
    const container = document.getElementById('recentActivity');
    
    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-history fa-3x text-muted mb-3"></i>
          <p class="text-muted">No recent activity yet</p>
          <a href="ai-planner.html" class="btn btn-primary btn-sm mt-2">Plan Your First Trip</a>
        </div>
      `;
      return;
    }
    
    const recent = bookings.slice(0, 5);
    container.innerHTML = recent.map(booking => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas fa-${booking.status === 'CONFIRMED' ? 'check-circle text-success' : booking.status === 'PENDING' ? 'clock text-warning' : 'times-circle text-danger'}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">Booking ${booking.booking_id}</div>
          <div class="activity-time">${new Date(booking.created_at).toLocaleDateString()} • ${booking.status}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load activity:', error);
  }
}