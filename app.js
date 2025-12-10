// Telegram WebApp Initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Firebase Configuration - New Trimint Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAt9PRbvok0g5XL4187btrPvGx6VjfurJU",
  authDomain: "msc-by-shawon.firebaseapp.com",
  databaseURL: "https://msc-by-shawon-default-rtdb.firebaseio.com",
  projectId: "msc-by-shawon",
  storageBucket: "msc-by-shawon.firebasestorage.app",
  messagingSenderId: "432753389120",
  appId: "1:432753389120:web:dcbb46ca39408a405579a5",
  measurementId: "G-8LHGLJSSEE"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Global State
let userId = null;
let userName = null;
let userAvatar = null;
let userData = null;
let balanceListener = null;
let referralCount = 0;
let referralListener = null;
let totalReferralCommission = 0;
let coinsEarned = 0;
let profileSections = [];
let rankingListener = null;

// Farming State
let farmingActive = false;
let farmingStartTime = null;
let farmingEndTime = null;
let farmingTimer = null;
let farmingEarnings = 0;
let farmingInterval = null;

// TON Connect State
let tonConnectUI = null;
let tonWalletConnected = false;
let tonWalletAddress = null;

// Utility Functions
function now() {
  return Math.floor(Date.now() / 1000);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
}

function updateLoadingProgress(text) {
  const progressEl = document.getElementById('loadingProgress');
  if (progressEl) {
    progressEl.textContent = text;
  }
}

function notify(message, duration = 2500) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

function getTelegramUserData() {
  updateLoadingProgress('Getting Telegram user data...');
  
  const user = tg.initDataUnsafe?.user;
  
  if (user && user.id) {
    userId = user.id.toString();
    userName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
    
    if (user.photo_url) {
      userAvatar = user.photo_url;
    } else {
      userAvatar = "https://i.postimg.cc/3JQ85fth/IMG-20251018-022832-196.jpg?raw=true";
    }
    
    console.log('Telegram User ID:', userId);
    console.log('Telegram User Name:', userName);
    return true;
  }
  
  console.warn('Running outside Telegram environment - using test user');
  userId = 'test_' + Math.floor(10000 + Math.random() * 89999).toString();
  userName = 'Test User';
  userAvatar = "https://i.postimg.cc/3JQ85fth/IMG-20251018-022832-196.jpg?raw=true";
  return true;
}

// Initialize TON Connect
async function initializeTonConnect() {
  try {
    // Try to create manifest URL with proper fallback
    const manifestUrl = 'https://trimint.vercel.app/tonconnect-manifest.json';
    
    // Check if manifest is accessible
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Manifest not accessible: ${manifestResponse.status}`);
    }
    
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: manifestUrl,
      buttonRootId: null
    });
    
    // Set up event listeners
    setupTonConnectListeners();
    
    // Check if wallet was previously connected
    const savedWalletAddress = localStorage.getItem('tonWalletAddress');
    if (savedWalletAddress) {
      tonWalletConnected = true;
      tonWalletAddress = savedWalletAddress;
    }
    
    // Initialize UI if already connected
    if (tonConnectUI.connected) {
      const address = tonConnectUI.wallet.account.address;
      tonWalletConnected = true;
      tonWalletAddress = address;
      localStorage.setItem('tonWalletAddress', address);
    }
    
    console.log('TON Connect initialized successfully');
    
  } catch (error) {
    console.error('TonConnect initialization error:', error);
    notify(`Failed to initialize TON Connect: ${error.message}`, 5000);
  }
}

// Setup TON Connect Listeners
function setupTonConnectListeners() {
  // Listen for wallet connection status changes
  tonConnectUI.onStatusChange(wallet => {
    if (wallet) {
      const address = wallet.account.address;
      tonWalletConnected = true;
      tonWalletAddress = address;
      localStorage.setItem('tonWalletAddress', address);
      
      // Save to Firebase
      db.ref('users/' + userId).update({
        tonWallet: address
      });
      
      notify('TON wallet connected successfully!', 3000);
    } else {
      tonWalletConnected = false;
      tonWalletAddress = null;
      localStorage.removeItem('tonWalletAddress');
      
      // Remove from Firebase
      db.ref('users/' + userId).update({
        tonWallet: null
      });
      
      notify('TON wallet disconnected', 3000);
    }
    
    // Update UI if we're on profile page
    const activeTab = document.querySelector('.nav-btn.active');
    if (activeTab && activeTab.dataset.tab === 'profile') {
      renderProfile();
    }
  });
}

// Connect TON Wallet
async function connectTonWallet() {
  if (!tonConnectUI) {
    notify('TON Connect is not initialized yet', 3000);
    return;
  }
  
  try {
    await tonConnectUI.connectWallet();
  } catch (error) {
    console.error('Connection error:', error);
    notify('Failed to connect wallet. Please try again.', 3000);
  }
}

// Disconnect TON Wallet
async function disconnectTonWallet() {
  if (!tonConnectUI) {
    notify('TON Connect is not initialized yet', 3000);
    return;
  }
  
  try {
    await tonConnectUI.disconnect();
  } catch (error) {
    console.error('Disconnection error:', error);
    notify('Failed to disconnect wallet. Please try again.', 3000);
  }
}

// Copy TON Wallet Address
function copyTonAddress() {
  if (!tonWalletAddress) {
    notify('No wallet address to copy', 3000);
    return;
  }
  
  navigator.clipboard.writeText(tonWalletAddress).then(() => {
    notify('TON wallet address copied to clipboard!', 3000);
  }).catch(() => {
    notify('Failed to copy address', 3000);
  });
}

// Process Referral
function processReferral() {
  return new Promise((resolve) => {
    updateLoadingProgress('Processing referral...');
    
    const startParam = tg.initDataUnsafe?.start_param;
    console.log('Start Param:', startParam);
    
    if (startParam) {
      let referrerId = startParam;
      
      console.log('Referrer ID:', referrerId);
      console.log('Current User ID:', userId);
      
      if (referrerId && referrerId !== userId) {
        db.ref('users/' + userId + '/referredBy').once('value').then(snap => {
          if (!snap.exists()) {
            console.log('Processing new referral...');
            
            db.ref('users/' + referrerId).once('value').then(refSnap => {
              if (refSnap.exists()) {
                console.log('Referrer found in database');
                
                const referrerData = refSnap.val();
                const newBalance = (referrerData.balance || 0) + 5000;
                
                db.ref('users/' + referrerId).update({
                  balance: newBalance,
                  lastUpdated: now()
                }).then(() => {
                  console.log('Referrer balance updated to:', newBalance);
                });
                
                db.ref('users/' + userId).update({
                  referredBy: referrerId,
                  referredAt: now()
                }).then(() => {
                  console.log('Referral link saved for user');
                  
                  db.ref('admin/notifications').push({
                    type: 'new_referral',
                    referrerId: referrerId,
                    referrerName: referrerData.name || 'Unknown',
                    newUserId: userId,
                    newUserName: userName,
                    timestamp: now(),
                    reward: 5000
                  });
                  
                  notify('Welcome! Your referrer earned 5000 TRM!', 3000);
                  resolve();
                });
              } else {
                console.log('Referrer not found in database');
                resolve();
              }
            });
          } else {
            console.log('User was already referred by:', snap.val());
            resolve();
          }
        });
      } else {
        resolve();
      }
    } else {
      console.log('No referral parameter found');
      resolve();
    }
  });
}

function saveLastSeenData() {
  if (userData) {
    db.ref('users/' + userId).update({
      lastSeen: now(),
      lastBalance: coinsEarned,
      farmingActive: farmingActive,
      farmingStartTime: farmingStartTime,
      farmingEndTime: farmingEndTime
    });
  }
}

window.addEventListener('beforeunload', saveLastSeenData);
window.addEventListener('unload', saveLastSeenData);

setInterval(saveLastSeenData, 30000);

function setupReferralListener() {
  if (referralListener) {
    referralListener.off();
  }
  
  referralListener = db.ref('users')
    .orderByChild('referredBy')
    .equalTo(userId);
  
  referralListener.on('value', (snapshot) => {
    const count = snapshot.numChildren();
    referralCount = count;
    
    // Calculate total commission
    let totalCommission = 0;
    snapshot.forEach(child => {
      const referredUser = child.val();
      if (userData.referralCommissions && userData.referralCommissions[child.key]) {
        totalCommission += userData.referralCommissions[child.key];
      }
    });
    totalReferralCommission = totalCommission;
    
    const referralValueEl = document.querySelector('.referral-stat-value');
    const referralEarningsEl = document.querySelectorAll('.referral-stat-value')[1];
    
    if (referralValueEl) {
      referralValueEl.textContent = count;
    }
    if (referralEarningsEl) {
      // Show signup bonus + commission
      const signupBonus = count * 5000;
      referralEarningsEl.textContent = signupBonus + totalCommission;
    }
    
    console.log('Real-time referral count updated:', count);
    console.log('Total referral commission:', totalCommission);
  });
}

function setupBalanceListener() {
  if (balanceListener) {
    balanceListener.off();
  }
  
  balanceListener = db.ref('users/' + userId + '/balance');
  
  balanceListener.on('value', (snapshot) => {
    const newBalance = snapshot.val();
    if (newBalance !== null && newBalance !== coinsEarned) {
      console.log('Balance updated from Firebase:', newBalance);
      coinsEarned = newBalance;
      
      const balanceEl = document.getElementById('homeBalance');
      if (balanceEl) {
        balanceEl.textContent = coinsEarned.toFixed(3);
      }
    }
  });
}

function loadUserData() {
  updateLoadingProgress('Loading your data...');
  
  db.ref('users/' + userId).once('value').then(snap => {
    if (snap.exists()) {
      userData = snap.val();
      console.log('Existing user data loaded');
      
      // Load TON wallet address from Firebase
      if (userData.tonWallet) {
        tonWalletConnected = true;
        tonWalletAddress = userData.tonWallet;
        localStorage.setItem('tonWalletAddress', tonWalletAddress);
      }
      
      // Load farming state
      if (userData.farmingActive) {
        farmingActive = userData.farmingActive;
        farmingStartTime = userData.farmingStartTime;
        farmingEndTime = userData.farmingEndTime;
      }
    } else {
      userData = {
        balance: 0,
        avatar: userAvatar,
        name: userName,
        referrals: 0,
        ton: "",
        tonWallet: null,
        verifiedForMining: false,
        referralCommissions: {},
        totalReferralCommission: 0,
        lastSeen: now(),
        lastBalance: 0,
        farmingActive: false,
        farmingStartTime: null,
        farmingEndTime: null,
        createdAt: now()
      };
      db.ref('users/' + userId).set(userData);
      console.log('New user created');
    }
    
    if (userData.name !== userName || userData.avatar !== userAvatar) {
      db.ref('users/' + userId).update({
        name: userName,
        avatar: userAvatar
      });
      userData.name = userName;
      userData.avatar = userAvatar;
    }
    
    coinsEarned = userData.balance || 0;
    
    // Initialize referral commission tracking
    if (!userData.referralCommissions) {
      userData.referralCommissions = {};
    }
    if (!userData.totalReferralCommission) {
      userData.totalReferralCommission = 0;
    }
    totalReferralCommission = userData.totalReferralCommission;
    
    setupReferralListener();
    setupBalanceListener();
    
    // Initialize TON Connect
    initializeTonConnect();
    
    db.ref('users/' + userId).update({
      lastSeen: now(),
      lastBalance: coinsEarned,
      farmingActive: farmingActive,
      farmingStartTime: farmingStartTime,
      farmingEndTime: farmingEndTime
    });
    
    processReferral().then(() => {
      updateLoadingProgress('Starting app...');
      
      setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
      }, 1000);
      
      showTab('home');
    });
  });
}

function updateUserData(newData) {
  Object.assign(userData, newData);
  db.ref('users/' + userId).update(newData);
  
  if (newData.balance !== undefined) coinsEarned = newData.balance;
}

function showTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  if (tab === 'home') renderHome();
  if (tab === 'earn') renderEarn();
  if (tab === 'profile') renderProfile();
  if (tab === 'ranking') renderRanking();
}

// Farming Functions
function startFarming() {
  if (farmingActive) {
    notify('Farming is already active!');
    return;
  }
  
  if (!userData.verifiedForMining) {
    notify('Please verify for mining first!');
    return;
  }
  
  farmingActive = true;
  farmingStartTime = now();
  farmingEndTime = farmingStartTime + (12 * 60 * 60); // 12 hours
  farmingEarnings = 0;
  
  updateUserData({
    farmingActive: farmingActive,
    farmingStartTime: farmingStartTime,
    farmingEndTime: farmingEndTime
  });
  
  // Start farming interval (0.001 TRM per second)
  farmingInterval = setInterval(() => {
    if (farmingActive) {
      farmingEarnings += 0.001;
      coinsEarned += 0.001;
      
      updateUserData({ balance: coinsEarned });
      
      const balanceEl = document.getElementById('homeBalance');
      if (balanceEl) {
        balanceEl.textContent = coinsEarned.toFixed(3);
      }
      
      // Show farming animation
      showFarmingAnimation();
      
      // Update timer
      updateFarmingTimer();
      
      // Check if farming is complete
      if (now() >= farmingEndTime) {
        completeFarming();
      }
    }
  }, 1000);
  
  notify('Farming started! 0.001 TRM per second for 12 hours.', 3000);
  renderHome();
}

function completeFarming() {
  farmingActive = false;
  
  if (farmingInterval) {
    clearInterval(farmingInterval);
    farmingInterval = null;
  }
  
  updateUserData({
    farmingActive: false,
    farmingStartTime: null,
    farmingEndTime: null
  });
  
  notify(`Farming completed! You earned ${farmingEarnings.toFixed(3)} TRM!`, 5000);
  renderHome();
}

function claimFarmingRewards() {
  // Farming is already completed, just update UI
  farmingEarnings = 0;
  notify('Farming rewards claimed!', 3000);
  renderHome();
}

function showFarmingAnimation() {
  const indicator = document.getElementById('farmingIndicator');
  if (indicator) {
    indicator.textContent = '+0.001';
    indicator.classList.add('show');
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 1000);
  }
}

function updateFarmingTimer() {
  if (!farmingActive) return;
  
  const currentTime = now();
  const timeRemaining = Math.max(0, farmingEndTime - currentTime);
  
  const timerEl = document.getElementById('farmingTimer');
  if (timerEl) {
    timerEl.textContent = formatTime(timeRemaining);
  }
  
  const progressBar = document.getElementById('farmingProgress');
  if (progressBar) {
    const totalTime = farmingEndTime - farmingStartTime;
    const elapsed = currentTime - farmingStartTime;
    const progress = (elapsed / totalTime) * 100;
    progressBar.style.width = progress + '%';
  }
}

// Verification Functions
function showVerificationModal() {
  document.getElementById('verificationModal').style.display = 'flex';
}

function hideVerificationModal() {
  document.getElementById('verificationModal').style.display = 'none';
}

async function sendVerificationPayment() {
  if (!tonConnectUI || !tonConnectUI.connected) {
    notify('Please connect your TON wallet first!', 3000);
    return;
  }
  
  try {
    const amountNano = Math.floor(0.50 * 1e9); // 0.50 TON in nanotons
    
    const transaction = {
      messages: [
        {
          address: "UQACiEaN0Qt2TjpxBdJ7XZateCvEPjdA7qf5bMo5uCPLbSoh",
          amount: amountNano.toString()
        }
      ]
    };
    
    const sendBtn = document.getElementById('sendVerificationPayment');
    const originalText = sendBtn.textContent;
    sendBtn.innerHTML = '<span class="ton-loading"></span> Processing...';
    sendBtn.disabled = true;
    
    await tonConnectUI.sendTransaction(transaction);
    
    sendBtn.innerHTML = originalText;
    sendBtn.disabled = false;
    
    // Mark user as verified
    updateUserData({ verifiedForMining: true });
    
    notify('Verification successful! You can now start farming!', 4000);
    hideVerificationModal();
    
    // Update UI
    const activeTab = document.querySelector('.nav-btn.active');
    if (activeTab && activeTab.dataset.tab === 'earn') {
      renderEarn();
    }
    
  } catch (error) {
    const sendBtn = document.getElementById('sendVerificationPayment');
    sendBtn.innerHTML = 'Send Payment';
    sendBtn.disabled = false;
    
    notify('Payment failed: ' + error.message, 4000);
    console.error(error);
  }
}

function renderHome() {
  const isFarmingActive = farmingActive && now() < farmingEndTime;
  const isFarmingComplete = farmingEndTime && now() >= farmingEndTime && farmingEarnings > 0;
  
  let farmingHTML = '';
  
  if (isFarmingActive) {
    const timeRemaining = farmingEndTime - now();
    farmingHTML = `
      <div class="farming-status">
        <div class="farming-status-title">🌱 Farming Active</div>
        <div class="farming-timer" id="farmingTimer">${formatTime(timeRemaining)}</div>
        <div class="farming-rate">Earning: 0.001 TRM/second</div>
        <div class="farming-progress">
          <div class="farming-progress-bar" id="farmingProgress"></div>
        </div>
        <button class="btn-farming" disabled>Farming...</button>
      </div>
    `;
  } else if (isFarmingComplete) {
    farmingHTML = `
      <div class="farming-status">
        <div class="farming-status-title">🎉 Farming Complete!</div>
        <div class="farming-timer">Earned: ${farmingEarnings.toFixed(3)} TRM</div>
        <div class="farming-rate">Ready to start new session</div>
        <button class="btn-farming" id="claimFarmingBtn">Claim & Start New</button>
      </div>
    `;
  } else {
    farmingHTML = `
      <div class="farming-status">
        <div class="farming-status-title">💰 Start Farming</div>
        <div class="farming-timer">Earn 0.001 TRM per second</div>
        <div class="farming-rate">Duration: 12 hours</div>
        <button class="btn-farming" id="startFarmingBtn">Start Farming</button>
      </div>
    `;
  }
  
  const html = `
    <div class="home-main">
      <div class="balance-card">
        <div class="balance-label">Your Balance</div>
        <div class="balance-amount" id="homeBalance">${coinsEarned.toFixed(3)}</div>
        <div class="balance-currency">TRM</div>
      </div>
      
      <div class="coin-container">
        <div class="coin-glow"></div>
        <div class="coin-wrapper">
          <div class="coin-border"></div>
          <img src="https://i.postimg.cc/fTQktNmX/maincoin.png?raw=true" 
               class="coin-image" 
               alt="Trimint Coin" />
        </div>
        <div class="farming-indicator" id="farmingIndicator">+0.001</div>
      </div>
      
      ${farmingHTML}
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  // Add event listeners
  const startBtn = document.getElementById('startFarmingBtn');
  if (startBtn) {
    startBtn.addEventListener('click', startFarming);
  }
  
  const claimBtn = document.getElementById('claimFarmingBtn');
  if (claimBtn) {
    claimBtn.addEventListener('click', claimFarmingRewards);
  }
  
  // Update farming timer if active
  if (isFarmingActive) {
    updateFarmingTimer();
    if (farmingTimer) clearInterval(farmingTimer);
    farmingTimer = setInterval(() => {
      if (farmingActive && now() < farmingEndTime) {
        updateFarmingTimer();
      } else {
        clearInterval(farmingTimer);
        if (farmingActive) {
          completeFarming();
        }
      }
    }, 1000);
  }
}

function renderEarn() {
  const verificationTaskHTML = `
    <div class="task-card">
      <img src="https://i.postimg.cc/hGfM6qkT/verify.png?raw=true" class="task-image" alt="Verify for Mining" />
      <div class="task-info">
        <div class="task-name">Verify for Mining</div>
        <div class="task-reward">Enable 12-hour farming</div>
      </div>
      <button class="task-btn ${userData.verifiedForMining ? 'completed' : ''}" id="verifyTaskBtn">
        ${userData.verifiedForMining ? 'Verified' : 'Verify'}
      </button>
    </div>
  `;
  
  const html = `
    <div class="earn-main">
      <div class="section-header">
        <div class="section-title">Earn TRM</div>
      </div>
      
      ${verificationTaskHTML}
      
      <div class="ad-card">
        <div class="ad-title">Watch Advertisement</div>
        <div class="ad-reward">Earn 500 TRM per ad</div>
        <button class="btn-farming" id="showAdBtn">Watch Ad</button>
      </div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  // Add event listeners
  document.getElementById('verifyTaskBtn').addEventListener('click', () => {
    if (!userData.verifiedForMining) {
      showVerificationModal();
    }
  });
  
  document.getElementById('showAdBtn').addEventListener('click', () => {
    if (typeof show_10290264 === 'function') {
      show_10290264().then(() => {
        coinsEarned += 500;
        updateUserData({ balance: coinsEarned });
        notify('Earned 500 TRM for watching ad!');
      }).catch(() => {
        notify('Ad failed to load. Please try again.');
      });
    } else {
      notify('Ad service not available.');
    }
  });
}

function showReferralList() {
  const modal = document.getElementById('referralModal');
  const content = document.getElementById('referralListContent');
  
  db.ref('users')
    .orderByChild('referredBy')
    .equalTo(userId)
    .once('value')
    .then(snapshot => {
      if (snapshot.numChildren() === 0) {
        content.innerHTML = '<div class="referral-list-empty">You haven\'t referred anyone yet. Share your referral link to start earning!</div>';
      } else {
        let html = '';
        snapshot.forEach(child => {
          const referredUser = child.val();
          const referredUserId = child.key;
          
          const commissionFromUser = userData.referralCommissions && userData.referralCommissions[referredUserId] 
            ? userData.referralCommissions[referredUserId] 
            : 0;
          
          html += `
            <div class="referral-list-item">
              <img src="${referredUser.avatar || userAvatar}" class="referral-list-avatar" alt="${referredUser.name}" />
              <div class="referral-list-info">
                <div class="referral-list-name">${referredUser.name || 'Unknown'}</div>
                <div class="referral-list-id">ID: ${referredUserId}</div>
                <div class="referral-list-balance">${(referredUser.balance || 0).toFixed(3)} TRM</div>
                <div class="referral-commission">🤝 Commission: ${commissionFromUser.toFixed(3)} TRM</div>
              </div>
            </div>
          `;
        });
        content.innerHTML = html;
      }
      
      modal.style.display = 'flex';
    });
}

function renderProfile() {
  loadProfileSections().then(() => {
    let sectionsHTML = '';
    profileSections.forEach(section => {
      sectionsHTML += `
        <div class="section-link-card" onclick="window.open('${section.link}', '_blank')">
          <img src="${section.image}" class="section-link-image" alt="${section.name}" />
          <div class="section-link-title">${section.name}</div>
        </div>
      `;
    });
    
    const html = `
      <div class="profile-main">
        <div class="profile-header">
          <div class="avatar-container">
            <div class="avatar-glow"></div>
            <img src="${userData.avatar}" class="avatar-image" alt="Avatar" />
          </div>
          <div class="user-info-box">
            <div class="user-name">${userData.name}</div>
            <div class="user-id-row">
              <span class="user-id-label">ID:</span>
              <span class="user-id-value">${userId}</span>
              <img src="https://i.postimg.cc/W3CrXJsL/copy.gif?raw=true" 
                   class="copy-icon" 
                   id="copyUserId" 
                   alt="Copy" />
            </div>
          </div>
        </div>
        
        <div class="ton-wallet-card">
          <div class="ton-wallet-header">
            <div class="ton-wallet-icon">₮</div>
            <div>
              <div class="ton-wallet-title">TON Wallet Connection</div>
              <div class="ton-wallet-subtitle">Connect your wallet for verification</div>
            </div>
          </div>
          
          <div class="ton-error-message" id="tonErrorMessage"></div>
          
          <div class="ton-wallet-info" id="tonWalletInfo">
            <div class="ton-wallet-address-container">
              <div class="ton-wallet-address" id="tonWalletAddress">${tonWalletAddress || 'No wallet connected'}</div>
              <button class="ton-copy-button" onclick="copyTonAddress()">
                <img src="https://i.postimg.cc/hjcxqnWg/money-1.png" alt="Copy" class="ton-copy-icon">
                Copy Address
              </button>
            </div>
            <div class="ton-wallet-actions">
              <div class="ton-status-badge">
                <span class="ton-status-dot"></span>
                Connected for Verification
              </div>
              <button class="ton-disconnect-button" id="tonDisconnectButton">
                <img src="https://i.postimg.cc/CL3Rg0kN/disruption.png" alt="Disconnect" class="ton-button-icon">
                Disconnect
              </button>
            </div>
          </div>
          
          <button class="ton-connect-button" id="tonConnectButton">
            <img src="https://i.postimg.cc/QdZdzbZY/ton-1.png" alt="Connect" class="ton-button-icon">
            Connect TON Wallet
          </button>
          
          <div class="ton-airdrop-info">
            <span class="ton-airdrop-icon">💎</span>
            Connect your wallet to enable mining verification
          </div>
        </div>
        
        <div class="profile-card">
          <div class="card-title">Referral Program</div>
          <div class="referral-link-box">
            <span class="referral-link" id="referralLink">https://t.me/TrimintBot/mine?startapp=${userId}</span>
            <img src="https://i.postimg.cc/W3CrXJsL/copy.gif?raw=true" 
                 class="copy-icon" 
                 id="copyReferralLink" 
                 alt="Copy" />
          </div>
          <div class="referral-stats">
            <div class="referral-stat">
              <div class="referral-stat-label">Total Referrals</div>
              <div class="referral-stat-value">${referralCount}</div>
            </div>
            <div class="referral-stat">
              <div class="referral-stat-label">Total Earnings</div>
              <div class="referral-stat-value">${(referralCount * 5000 + totalReferralCommission).toFixed(3)}</div>
            </div>
          </div>
          <button class="btn-view-referrals" id="viewReferralsBtn">View My Referrals</button>
        </div>
        
        ${sectionsHTML}
      </div>
    `;
    
    document.getElementById('main-content').innerHTML = html;
    
    // Setup TON Wallet UI
    const tonWalletInfo = document.getElementById('tonWalletInfo');
    const tonConnectButton = document.getElementById('tonConnectButton');
    const tonDisconnectButton = document.getElementById('tonDisconnectButton');
    const tonWalletAddressEl = document.getElementById('tonWalletAddress');
    
    if (tonWalletConnected && tonWalletAddress) {
      tonWalletInfo.style.display = 'block';
      tonConnectButton.style.display = 'none';
      tonWalletAddressEl.textContent = tonWalletAddress;
    } else {
      tonWalletInfo.style.display = 'none';
      tonConnectButton.style.display = 'flex';
    }
    
    // Add event listeners for TON Connect
    tonConnectButton.addEventListener('click', connectTonWallet);
    tonDisconnectButton.addEventListener('click', disconnectTonWallet);
    
    document.getElementById('copyUserId').addEventListener('click', () => {
      navigator.clipboard.writeText(userId).then(() => {
        notify('User ID copied to clipboard!');
      });
    });
    
    document.getElementById('copyReferralLink').addEventListener('click', () => {
      const link = document.getElementById('referralLink').textContent;
      navigator.clipboard.writeText(link).then(() => {
        notify('Referral link copied to clipboard!');
      });
    });
    
    document.getElementById('viewReferralsBtn').addEventListener('click', () => {
      showReferralList();
    });
  });
}

function loadProfileSections() {
  return db.ref('profileSections').once('value').then(snap => {
    const sections = snap.val() || {};
    profileSections = [];
    
    Object.keys(sections).forEach(sectionId => {
      profileSections.push({
        id: sectionId,
        name: sections[sectionId].name,
        image: sections[sectionId].image,
        link: sections[sectionId].link
      });
    });
  });
}

function renderRanking() {
  const html = `
    <div class="ranking-main">
      <div class="section-header">
        <div class="section-title">Top 25 Users</div>
      </div>
      
      <div class="ranking-position">
        <div class="ranking-position-label">Your Position</div>
        <div class="ranking-position-value" id="myPosition">Loading...</div>
      </div>
      
      <div id="rankingList"></div>
    </div>
  `;
  
  document.getElementById('main-content').innerHTML = html;
  
  if (rankingListener) rankingListener.off();
  
  const usersRef = db.ref('users');
  
  function updateRankingList(snap) {
    const users = [];
    
    snap.forEach(child => {
      const userData = child.val();
      users.push({
        id: child.key,
        name: userData.name || 'Unknown',
        avatar: userData.avatar || 'https://i.postimg.cc/3JQ85fth/IMG-20251018-022832-196.jpg?raw=true',
        balance: userData.balance || 0
      });
    });
    
    users.sort((a, b) => b.balance - a.balance);
    
    const myPosition = users.findIndex(u => u.id === userId) + 1;
    const top25 = users.slice(0, 25);
    
    let html = '';
    top25.forEach((user, index) => {
      const position = index + 1;
      const isTop3 = position <= 3;
      
      html += `
        <div class="ranking-row">
          <div class="ranking-position-num ${isTop3 ? 'top3' : ''}">${position}</div>
          <img src="${user.avatar}" class="ranking-avatar" alt="${user.name}" />
          <div class="ranking-user-info">
            <div class="ranking-user-name">${user.name}</div>
            <div class="ranking-user-id">ID: ${user.id}</div>
          </div>
          <div class="ranking-balance">${user.balance.toFixed(3)} TRM</div>
        </div>
      `;
    });
    
    document.getElementById('rankingList').innerHTML = html;
    document.getElementById('myPosition').textContent = myPosition > 0 ? `#${myPosition}` : 'Unranked';
  }
  
  usersRef.on('value', updateRankingList);
  rankingListener = usersRef;
}

// Event Listeners
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    showTab(this.dataset.tab);
  });
});

document.getElementById('closeReferralModal').addEventListener('click', () => {
  document.getElementById('referralModal').style.display = 'none';
});

document.getElementById('referralModal').addEventListener('click', (e) => {
  if (e.target.id === 'referralModal') {
    document.getElementById('referralModal').style.display = 'none';
  }
});

// Verification Modal Listeners
document.getElementById('closeVerificationModal').addEventListener('click', hideVerificationModal);
document.getElementById('cancelVerification').addEventListener('click', hideVerificationModal);
document.getElementById('sendVerificationPayment').addEventListener('click', sendVerificationPayment);

document.getElementById('verificationModal').addEventListener('click', (e) => {
  if (e.target.id === 'verificationModal') {
    hideVerificationModal();
  }
});

// Initialize profile sections
db.ref('profileSections').once('value').then(snap => {
  if (!snap.exists()) {
    db.ref('profileSections').set({
      roadmap: {
        name: 'Roadmap',
        image: 'https://i.postimg.cc/2j0RjzFN/images-7.jpg?raw=true',
        link: 'https://trimint.vercel.app/roadmap'
      },
      presale: {
        name: 'Presale',
        image: 'https://i.postimg.cc/hGfM6qkT/verify.png?raw=true',
        link: 'https://trimint.vercel.app/presale'
      }
    });
  }
});

// Initialize App
if (getTelegramUserData()) {
  loadUserData();
} else {
  notify('Failed to initialize Telegram user data');
}
