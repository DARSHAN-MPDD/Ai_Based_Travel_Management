const API_BASE = '/api';

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

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  return '₹' + parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

let sessionId = null;
let isSending = false;

document.addEventListener('DOMContentLoaded', function() {
  updateAuthUI();
  loadSessionId();

  document.getElementById('messageInput').addEventListener('keydown', handleKeyDown);
  document.getElementById('messageInput').addEventListener('input', updateCharCount);
  document.getElementById('chatForm').addEventListener('submit', handleSendMessage);
  document.getElementById('clearChatBtn').addEventListener('click', clearChat);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      Auth.logout();
    });
  }
});

function updateAuthUI() {
  const token = localStorage.getItem('token');
  const user = Auth.getCurrentUser();

  if (token) {
    if (user) {
      document.getElementById('userName').textContent = user.name || 'User';
    }
    document.getElementById('userMenu').style.display = 'block';
    document.getElementById('authButtons').style.display = 'none';
  } else {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('authButtons').style.display = 'block';
  }
}

function loadSessionId() {
  const stored = localStorage.getItem('chatbot_session_id');
  if (stored) {
    sessionId = stored;
  } else {
    sessionId = 'chat_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('chatbot_session_id', sessionId);
  }
}

function updateCharCount(e) {
  document.getElementById('charCount').textContent = e.target.value.length;
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!isSending) {
      document.getElementById('chatForm').dispatchEvent(new Event('submit'));
    }
  }
}

window.sendSuggestedMessage = function(text) {
  if (isSending) return;
  document.getElementById('messageInput').value = text;
  updateCharCount({ target: { value: text } });
  handleSendMessage({ preventDefault: () => {} });
};

async function handleSendMessage(e) {
  e.preventDefault();

  if (isSending) return;

  const input = document.getElementById('messageInput');
  const message = input.value.trim();

  if (!message) return;

  isSending = true;
  toggleSendButton(false);

  try {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    addMessage('user', message);

    document.getElementById('messageInput').value = '';
    document.getElementById('charCount').textContent = '0';

    showTypingIndicator(true);

    const response = await fetch(`${API_BASE}/chatbot/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: message,
        session_id: sessionId
      })
    });

    const data = await response.json();

    showTypingIndicator(false);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send message');
    }

    const reply = data.data.reply || 'I\'m not sure how to respond to that.';
    const suggestions = data.data.suggestions || [];

    addMessage('bot', reply, {
      suggestions: suggestions,
      data: data.data.data || null
    });

    hideError();
  } catch (error) {
    showTypingIndicator(false);
    showError(error.message || 'Failed to send message');
  } finally {
    isSending = false;
    toggleSendButton(true);
  }
}

function addMessage(role, content, options = {}) {
  const container = document.getElementById('messagesContainer');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let html = `
    <div class="message ${role}-message mb-3">
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-time small text-muted mt-1">${time}</div>
  `;

  if (options.suggestions && options.suggestions.length > 0) {
    html += '<div class="mt-2 d-flex flex-wrap gap-1">';
    options.suggestions.forEach(s => {
      const safeSuggestion = escapeHtml(s);
      html += `<div class="suggestion-chip" onclick="sendSuggestedMessage('${safeSuggestion}')">${escapeHtml(s)}</div>`;
    });
    html += '</div>';
  }

  if (options.data && (options.data.results || options.data.destination || options.data.summary)) {
    html += renderDataCards(options.data, role);
  }

  html += '</div>';

  container.innerHTML += html;
  container.scrollTop = container.scrollHeight;
}

function renderDataCards(data, role) {
  let html = '<div class="mt-3 data-cards">';

  if (data.destination) {
    const d = data.destination;
    const image = d.image_url
      ? `<img src="${escapeHtml(d.image_url)}" alt="${escapeHtml(d.name)}" class="destination-card-img">`
      : `<div class="destination-card-img-placeholder d-flex align-items-center justify-content-center"><i class="fas fa-image fa-2x text-muted"></i></div>`;
    html += `
      <div class="card destination-card mb-2">
        <div class="row g-0">
          <div class="col-4">${image}</div>
          <div class="col-8">
            <div class="card-body p-2">
              <h6 class="card-title mb-1">${escapeHtml(d.name)}</h6>
              <p class="card-text small text-muted mb-1">${escapeHtml(d.location || '')}</p>
              <p class="card-text small mb-0">${escapeHtml(d.category || '')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (data.results && data.results.length > 0) {
    html += '<div class="row g-2">';
    data.results.slice(0, 5).forEach(item => {
      const isPackage = item.price_per_person !== undefined;
      const title = escapeHtml(item.name || '');
      const subtitle = escapeHtml(item.destination_name || item.location || '');
      const badge = isPackage
        ? `<span class="badge bg-info text-dark">${formatCurrency(item.price_per_person)}</span>`
        : `<span class="badge bg-primary">${escapeHtml(item.category || '')}</span>`;
      const cost = isPackage
        ? `<div class="small text-muted">${item.duration_days || '?'} days</div>`
        : `<div class="small text-muted">${escapeHtml(item.location || '')}</div>`;

      html += `
        <div class="col-12">
          <div class="card h-100 shadow-sm">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-0">${title}</h6>
                  <p class="text-muted small mb-0">${escapeHtml(subtitle)}</p>
                </div>
                ${badge}
              </div>
              ${cost}
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  if (data.summary) {
    const s = data.summary;
    html += `
      <div class="card bg-light mb-2">
        <div class="card-body p-2 text-center">
          <h6 class="mb-1">Rating Summary</h6>
          <div class="d-flex align-items-center justify-content-center gap-2">
            <strong>${s.average_rating.toFixed(1)}</strong>
            <div class="text-warning">${renderStarsHtml(Math.round(s.average_rating))}</div>
            <span class="text-muted small">${s.total_reviews} review${s.total_reviews !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
  }

  if (data.itinerary) {
    const it = data.itinerary;
    html += `
      <div class="card itinerary-card mb-2">
        <div class="card-header bg-primary text-white py-1">
          <h6 class="mb-0">Itinerary Preview: ${escapeHtml(it.destination?.name || 'Destination')}</h6>
        </div>
        <div class="card-body p-2">
          <div class="small mb-1">Total cost: <strong>${formatCurrency(it.total_estimated_cost || 0)}</strong> | Budget: ${escapeHtml(it.budget_status || 'N/A')}</div>
          ${it.days && it.days.length > 0 ? `<div class="small text-muted">${escapeHtml(it.days[0].morning_activity || 'N/A')}</div>` : ''}
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

function renderStarsHtml(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rating ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  }
  return html;
}

function showTypingIndicator(show) {
  const indicator = document.getElementById('typingIndicator');
  const container = document.getElementById('messagesContainer');
  if (show) {
    indicator.style.display = 'flex';
    container.scrollTop = container.scrollHeight;
  } else {
    indicator.style.display = 'none';
  }
}

function toggleSendButton(enabled) {
  const btn = document.getElementById('sendButton');
  const spinner = document.getElementById('sendSpinner');
  const text = document.querySelector('.btn-text');

  btn.disabled = !enabled;
  if (enabled) {
    spinner.classList.add('d-none');
    text.style.display = 'inline';
  } else {
    spinner.classList.remove('d-none');
    text.style.display = 'none';
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorAlert');
  const errorText = document.getElementById('errorMessage');
  errorText.textContent = message;
  errorDiv.classList.remove('d-none');

  setTimeout(() => {
    errorDiv.classList.add('d-none');
  }, 5000);
}

function hideError() {
  document.getElementById('errorAlert').classList.add('d-none');
}

function clearChat() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  const welcomeMsg = `
    <div class="message bot-message">
      <div class="message-content">
        Hi! I'm your AI Travel Assistant. I can help you find destinations, plan itineraries, check bookings, and more. How can I assist you today?
      </div>
      <div class="message-time small text-muted mt-1">Just now</div>
    </div>
  `;
  container.innerHTML = welcomeMsg;

  sessionId = 'chat_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  localStorage.setItem('chatbot_session_id', sessionId);
}

document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = `
    .star { cursor: pointer; font-size: 1.4rem; color: #ced4ca; transition: color 0.2s; }
    .star.fas { color: #ffc107; }
    .star:hover, .star:hover ~ .star { color: #fd7e14; }
    .rating-input .stars i.far:hover { color: #ffc107; }
  `;
  document.head.appendChild(style);
});
