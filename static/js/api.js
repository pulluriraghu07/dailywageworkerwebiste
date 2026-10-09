// DailyWork REST Client & Live Synchronization Hub

class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.lastNotifId = 0;
    this.pollTimer = null;
    this.listeners = {
      worker_registered: [],
      worker_applied: [],
      job_posted: [],
      worker_confirmed: [],
      any: []
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error occurred');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // --- AUTHENTICATION ---
  sendOtp(mobile) {
    return this.request('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile })
    });
  }

  verifyOtp(mobile, otp) {
    return this.request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp })
    });
  }

  adminLogin(mobile, password = null, otp = null) {
    return this.request('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password, otp })
    });
  }

  adminRegister(data) {
    return this.request('/api/auth/admin/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- WORKERS ---
  getWorkers(query = '', trade = '', status = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (trade) params.append('trade', trade);
    if (status) params.append('status', status);
    return this.request(`/api/workers?${params.toString()}`);
  }

  getWorker(workerId) {
    return this.request(`/api/workers/${workerId}`);
  }

  registerWorker(workerData) {
    return this.request('/api/workers', {
      method: 'POST',
      body: JSON.stringify(workerData)
    });
  }

  // --- JOBS ---
  getJobs(status = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return this.request(`/api/jobs?${params.toString()}`);
  }

  getJob(jobId) {
    return this.request(`/api/jobs/${jobId}`);
  }

  postJob(jobData) {
    return this.request('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
  }

  applyJob(jobId, workerId) {
    return this.request(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ worker_id: workerId })
    });
  }

  confirmWorker(jobId, workerId) {
    return this.request(`/api/jobs/${jobId}/workers/${workerId}/confirm`, {
      method: 'POST'
    });
  }

  // --- STATS ---
  getStats() {
    return this.request('/api/stats');
  }

  // --- NOTIFICATIONS & REAL-TIME POLL ---
  getNotifications(sinceId = 0, type = 'admin') {
    return this.request(`/api/notifications?since=${sinceId}&type=${type}`);
  }

  markNotificationRead(notifId) {
    return this.request(`/api/notifications/${notifId}/read`, {
      method: 'POST'
    });
  }

  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback);
    }
  }

  startLiveSync(role = 'admin') {
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Initial check
    this.pollNotifications(role);

    // Poll every 3.5 seconds for real-time responsiveness
    this.pollTimer = setInterval(() => {
      this.pollNotifications(role);
    }, 3500);
  }

  stopLiveSync() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollNotifications(role) {
    try {
      const notifs = await this.getNotifications(this.lastNotifId, role);
      if (Array.isArray(notifs) && notifs.length > 0) {
        // Find highest ID
        const maxId = Math.max(...notifs.map(n => n.id));
        if (this.lastNotifId > 0) {
          // Play sound chime for incoming events after initial load
          if (window.speechEngine) {
            window.speechEngine.playNotificationSound();
          }

          // Trigger notifications and toasts
          notifs.forEach(notif => {
            if (typeof showLiveAlert === 'function') {
              showLiveAlert(notif);
            }
            // Fire listeners
            if (this.listeners[notif.notif_type]) {
              this.listeners[notif.notif_type].forEach(cb => cb(notif));
            }
            this.listeners.any.forEach(cb => cb(notif));
          });
        }
        this.lastNotifId = maxId;
      }
    } catch (e) {
      // Silently catch polling failures when offline
    }
  }
}

// Global instance
window.api = new ApiClient();
