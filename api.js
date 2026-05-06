// Creatrix AI — API Connector
if (typeof CreatrixAPI === 'undefined') {
// ═══════════════════════════════════════════════
// CREATRIX AI — Frontend API Connector
// Save this as: api.js in your frontend folder
// ═══════════════════════════════════════════════

var API_URL = 'https://creatrix-backend-production.up.railway.app'; // ← Replace with your Railway URL

// ── TOKEN MANAGEMENT ──
var getAccessToken = () => localStorage.getItem('creatrix_access_token');
var getRefreshToken = () => localStorage.getItem('creatrix_refresh_token');
var setTokens = (access, refresh) => {
  localStorage.setItem('creatrix_access_token', access);
  if (refresh) localStorage.setItem('creatrix_refresh_token', refresh);
};
var clearTokens = () => {
  localStorage.removeItem('creatrix_access_token');
  localStorage.removeItem('creatrix_refresh_token');
  localStorage.removeItem('creatrix_user');
};

// ── SAVE/GET USER ──
var setUser = (user) => localStorage.setItem('creatrix_user', JSON.stringify(user));
var getUser = () => {
  try { return JSON.parse(localStorage.getItem('creatrix_user')); }
  catch { return null; }
};

// ── API REQUEST HELPER ──
var apiRequest = async (endpoint, method = 'GET', body = null, requireAuth = true) => {
  const headers = { 'Content-Type': 'application/json' };

  if (requireAuth) {
    const token = getAccessToken();
    if (!token) {
      window.location.href = 'creatrix-auth.html';
      return;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  let response = await fetch(`${API_URL}${endpoint}`, config);

  // If 401 — try refresh token
  if (response.status === 401 && requireAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      response = await fetch(`${API_URL}${endpoint}`, { ...config, headers });
    } else {
      clearTokens();
      window.location.href = 'creatrix-auth.html';
      return;
    }
  }

  return response.json();
};

// ── REFRESH TOKEN ──
var refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await res.json();
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ══════════════════════════════════════
// AUTH APIs
// ══════════════════════════════════════
var Auth = {

  signup: async (name, email, password) => {
    const data = await apiRequest('/api/auth/signup', 'POST', { name, email, password }, false);
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    }
    return data;
  },

  login: async (email, password) => {
    const data = await apiRequest('/api/auth/login', 'POST', { email, password }, false);
    if (data.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    }
    return data;
  },

  logout: async () => {
    await apiRequest('/api/auth/logout', 'POST', { refreshToken: getRefreshToken() });
    clearTokens();
    window.location.href = 'creatrix-auth.html';
  },

  me: async () => {
    return await apiRequest('/api/auth/me');
  },

  googleLogin: () => {
    window.location.href = `${API_URL}/api/auth/google`;
  },

  isLoggedIn: () => !!getAccessToken(),

  getUser
};

// ══════════════════════════════════════
// CREDITS APIs
// ══════════════════════════════════════
var Credits = {

  getBalance: async () => {
    return await apiRequest('/api/credits/balance');
  },

  getLogs: async () => {
    return await apiRequest('/api/credits/logs');
  }
};

// ══════════════════════════════════════
// PAYMENT APIs
// ══════════════════════════════════════
var Payment = {

  createOrder: async (packType) => {
    return await apiRequest('/api/payment/create-order', 'POST', { pack_type: packType });
  },

  verify: async (orderId, paymentId, signature, packType) => {
    return await apiRequest('/api/payment/verify', 'POST', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      pack_type: packType
    });
  },

  // Open Razorpay checkout
  openCheckout: async (packType, onSuccess) => {
    const order = await Payment.createOrder(packType);
    if (order.error) { alert(order.error); return; }

    const options = {
      key: order.key_id,
      amount: order.amount * 100,
      currency: 'INR',
      name: 'Creatrix AI',
      description: order.pack_name + ' — ' + order.credits + ' Credits',
      order_id: order.order_id,
      handler: async (response) => {
        const result = await Payment.verify(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
          packType
        );
        if (result.success && onSuccess) onSuccess(result);
        else alert('Payment verification failed');
      },
      theme: { color: '#784CFE' }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  },

  getHistory: async () => {
    return await apiRequest('/api/payment/history');
  }
};

// ══════════════════════════════════════
// GENERATE APIs
// ══════════════════════════════════════
var Generate = {

  image: async (prompt, influencerId = null) => {
    return await apiRequest('/api/generate/image', 'POST', { prompt, influencer_id: influencerId });
  },

  video: async (prompt, imageUrl, options = {}) => {
    return await apiRequest('/api/generate/video', 'POST', {
      prompt, image_url: imageUrl,
      model: options.model || 'wan_26',
      duration: options.duration || 5,
      hd: options.hd || false,
      influencer_id: options.influencerId || null
    });
  },

  lipsync: async (imageUrl, audioUrl, options = {}) => {
    return await apiRequest('/api/generate/lipsync', 'POST', {
      image_url: imageUrl, audio_url: audioUrl,
      hd: options.hd || false,
      influencer_id: options.influencerId || null
    });
  },

  motion: async (imageUrl, motionVideoUrl, prompt = '', options = {}) => {
    return await apiRequest('/api/generate/motion', 'POST', {
      image_url: imageUrl, motion_video_url: motionVideoUrl, prompt,
      hd: options.hd || false,
      influencer_id: options.influencerId || null
    });
  },

  ugc: async (imageUrl, brandName, productDesc, options = {}) => {
    return await apiRequest('/api/generate/ugc', 'POST', {
      image_url: imageUrl, brand_name: brandName, product_desc: productDesc,
      ugc_style: options.style || 'Review',
      tone: options.tone || 'Friendly',
      language: options.language || 'Hindi',
      hd: options.hd || false,
      influencer_id: options.influencerId || null
    });
  },

  // Poll job status until done
  waitForResult: async (jobId, onProgress = null) => {
    const maxAttempts = 120; // 10 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 5 sec interval
      const status = await apiRequest(`/api/generate/status/${jobId}`);
      if (onProgress) onProgress(status);
      if (status.status === 'done') return status;
      if (status.status === 'failed') throw new Error(status.error || 'Generation failed');
    }
    throw new Error('Generation timed out');
  }
};

// ══════════════════════════════════════
// INFLUENCER APIs
// ══════════════════════════════════════
var Influencer = {

  create: async (name, niche, settings, avatarUrl = null) => {
    return await apiRequest('/api/influencer/create', 'POST', {
      name, niche, settings, avatar_url: avatarUrl
    });
  },

  list: async () => {
    return await apiRequest('/api/influencer/list');
  },

  delete: async (id) => {
    return await apiRequest(`/api/influencer/${id}`, 'DELETE');
  }
};

// ══════════════════════════════════════
// CREATIONS APIs
// ══════════════════════════════════════
var Creations = {

  list: async (type = null) => {
    const url = type ? `/api/creations/list?type=${type}` : '/api/creations/list';
    return await apiRequest(url);
  },

  delete: async (id) => {
    return await apiRequest(`/api/creations/${id}`, 'DELETE');
  }
};

// ══════════════════════════════════════
// MONETIZE APIs
// ══════════════════════════════════════
var Monetize = {

  makePremium: async (creationId, price) => {
    return await apiRequest('/api/monetize/make-premium', 'POST', {
      creation_id: creationId, price
    });
  },

  makeFree: async (creationId) => {
    return await apiRequest('/api/monetize/make-free', 'POST', { creation_id: creationId });
  },

  getCreatorPage: async (username) => {
    return await apiRequest(`/api/creator/${username}`, 'GET', null, false);
  },

  createUnlockOrder: async (creationId, buyerEmail = '') => {
    return await apiRequest('/api/monetize/create-unlock-order', 'POST', {
      creation_id: creationId, buyer_email: buyerEmail
    }, false);
  },

  // Open Razorpay for visitor unlock
  unlockContent: async (creationId, buyerEmail, onSuccess) => {
    const order = await Monetize.createUnlockOrder(creationId, buyerEmail);
    if (order.error) { alert(order.error); return; }

    const options = {
      key: order.key_id,
      amount: order.amount * 100,
      currency: 'INR',
      name: 'Unlock Content',
      description: 'Exclusive content unlock',
      order_id: order.order_id,
      handler: async (response) => {
        const result = await apiRequest('/api/monetize/verify-unlock', 'POST', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          creation_id: creationId,
          buyer_email: buyerEmail
        }, false);
        if (result.success && onSuccess) onSuccess(result);
        else alert('Payment failed');
      },
      theme: { color: '#FF3CAC' }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  },

  getEarnings: async () => {
    return await apiRequest('/api/monetize/earnings');
  },

  withdraw: async (amount, upiId = null, bankAccount = null, ifscCode = null) => {
    return await apiRequest('/api/monetize/withdraw', 'POST', {
      amount, upi_id: upiId, bank_account: bankAccount, ifsc_code: ifscCode
    });
  }
};

// ══════════════════════════════════════
// INIT — Run on every page load
// ══════════════════════════════════════
var CreatrixAPI = { Auth, Credits, Payment, Generate, Influencer, Creations, Monetize, apiRequest };

// Auto update credits display
const updateCreditsDisplay = async () => {
  if (!Auth.isLoggedIn()) return;
  const balance = await Credits.getBalance();
  if (balance.total !== undefined) {
    document.querySelectorAll('.cv, #currentCredits, #heroCredits').forEach(el => {
      el.textContent = balance.total;
    });
  }
};

// Check if logged in on protected pages
const requireLogin = () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'creatrix-auth.html';
  }
};

// Handle Google OAuth redirect
const handleGoogleCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  if (accessToken) {
    setTokens(accessToken, refreshToken);
    window.history.replaceState({}, '', window.location.pathname);
    window.location.href = 'creatrix-dashboard.html';
  }
};

// Run on load
handleGoogleCallback();

}
