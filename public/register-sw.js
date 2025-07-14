// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registration successful with scope: ', registration.scope);
        
        // Request background sync permission if available
        if ('sync' in registration) {
          document.addEventListener('DOMContentLoaded', function() {
            // Enable offline claim button when SW is ready
            const claimButtons = document.querySelectorAll('[data-offline-claim]');
            claimButtons.forEach(button => {
              button.removeAttribute('disabled');
              button.setAttribute('data-sw-ready', 'true');
            });
          });
        }
      })
      .catch(function(error) {
        console.log('Service Worker registration failed: ', error);
      });
  });

  // Handle online/offline status changes
  window.addEventListener('online', function() {
    document.body.classList.remove('offline-mode');
    
    // Attempt to sync any pending operations
    navigator.serviceWorker.ready.then(function(registration) {
      if ('sync' in registration) {
        registration.sync.register('referralClaimSync');
      }
    });
  });

  window.addEventListener('offline', function() {
    document.body.classList.add('offline-mode');
    
    // Show offline notification
    if (!document.querySelector('.offline-notification')) {
      const notification = document.createElement('div');
      notification.className = 'offline-notification';
      notification.innerHTML = `
        <div class="offline-content">
          <p>You are currently offline. Some features may be limited.</p>
          <button class="offline-close">✕</button>
        </div>
      `;
      document.body.appendChild(notification);
      
      // Add event listener to close button
      notification.querySelector('.offline-close').addEventListener('click', function() {
        notification.remove();
      });
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        notification.remove();
      }, 5000);
    }
  });
  
  // Listen for messages from the service worker
  navigator.serviceWorker.addEventListener('message', function(event) {
    const message = event.data;
    
    // Handle GET_PENDING_CLAIMS message - SW is requesting pending claims
    if (message && message.type === 'GET_PENDING_CLAIMS') {
      // Get pending claims from localStorage
      const pendingClaimsJson = localStorage.getItem('pendingReferralClaims');
      const pendingClaims = pendingClaimsJson ? JSON.parse(pendingClaimsJson) : [];
      
      // Send pending claims back to the service worker through the message port
      event.ports[0].postMessage(pendingClaims);
    }
    
    // Handle UPDATE_PENDING_CLAIMS message - SW processed a claim successfully
    else if (message && message.type === 'UPDATE_PENDING_CLAIMS' && message.claim) {
      // Get current pending claims
      const pendingClaimsJson = localStorage.getItem('pendingReferralClaims');
      const pendingClaims = pendingClaimsJson ? JSON.parse(pendingClaimsJson) : [];
      
      // Remove the processed claim
      const updatedPendingClaims = pendingClaims.filter(
        pendingClaim => pendingClaim.timestamp !== message.claim.timestamp
      );
      
      // Update localStorage
      localStorage.setItem('pendingReferralClaims', JSON.stringify(updatedPendingClaims));
      
      // Update balance display if on user page
      if (window.location.pathname.includes('/user/')) {
        const balanceElements = document.querySelectorAll('[data-balance-display]');
        balanceElements.forEach(element => {
          // Flag for refresh on next page visit
          localStorage.setItem('refreshBalanceOnLoad', 'true');
        });
      }
    }
    
    // Handle successful claim sync
    else if (message && message.type === 'CLAIM_SYNCED') {
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'success-notification';
      notification.innerHTML = `
        <div class="success-content">
          <p>Your offline claim has been successfully processed!</p>
          <button class="success-close">✕</button>
        </div>
      `;
      document.body.appendChild(notification);
      
      // Add event listener to close button
      notification.querySelector('.success-close').addEventListener('click', function() {
        notification.remove();
      });
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        notification.remove();
      }, 5000);
      
      // Refresh claim status if on a relevant page
      if (window.location.pathname.includes('/user/')) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  });
  
  // Check if we need to refresh balance on page load (after background sync)
  document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('refreshBalanceOnLoad') === 'true') {
      localStorage.removeItem('refreshBalanceOnLoad');
      
      // If on user page, refresh the balance data
      if (window.location.pathname.includes('/user/')) {
        // Trigger a refresh of balance data
        const refreshEvent = new CustomEvent('refresh-balance');
        window.dispatchEvent(refreshEvent);
      }
    }
  });
}

// Add offline/online notification styles
const style = document.createElement('style');
style.textContent = `
  .offline-mode button[data-offline-action="true"] {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .offline-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #ef4444;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease forwards;
  }
  
  .offline-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .offline-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
  }
  
  @keyframes slideIn {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @media (max-width: 640px) {
    .offline-notification {
      bottom: 10px;
      right: 10px;
      left: 10px;
      padding: 10px 12px;
    }
  }
  
  .success-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #10b981;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease forwards;
  }
  
  .success-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .success-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
  }
  
  @media (max-width: 640px) {
    .success-notification {
      bottom: 10px;
      right: 10px;
      left: 10px;
      padding: 10px 12px;
    }
  }
`;
document.head.appendChild(style);

// Add install prompt for iOS devices
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Store the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install prompt after user interaction
  document.addEventListener('click', () => {
    if (deferredPrompt) {
      // For iOS devices that don't support beforeinstallprompt
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS && !sessionStorage.getItem('iosInstallPromptShown')) {
        // Show iOS-specific install instructions
        setTimeout(() => {
          const iosPrompt = document.createElement('div');
          iosPrompt.className = 'ios-install-prompt';
          iosPrompt.innerHTML = `
            <div class="ios-install-content">
              <p>To install this app, tap <span>Share</span> and then <span>Add to Home Screen</span></p>
              <button class="ios-prompt-close">✕</button>
            </div>
          `;
          document.body.appendChild(iosPrompt);
          
          // Only show once per session
          sessionStorage.setItem('iosInstallPromptShown', 'true');
          
          // Add event listener to close button
          iosPrompt.querySelector('.ios-prompt-close').addEventListener('click', function() {
            iosPrompt.remove();
          });
          
          // Auto remove after 10 seconds
          setTimeout(() => {
            if (document.body.contains(iosPrompt)) {
              iosPrompt.remove();
            }
          }, 10000);
        }, 3000);
      }
    }
  }, { once: true });
});

// Add iOS install prompt styles
const iosStyle = document.createElement('style');
iosStyle.textContent = `
  .ios-install-prompt {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #3b82f6;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    max-width: 320px;
    text-align: center;
    animation: slideIn 0.3s ease forwards;
  }
  
  .ios-install-content {
    position: relative;
  }
  
  .ios-install-content p {
    margin: 0;
    line-height: 1.5;
  }
  
  .ios-install-content span {
    font-weight: bold;
  }
  
  .ios-prompt-close {
    position: absolute;
    top: -8px;
    right: -8px;
    background-color: rgba(0,0,0,0.3);
    border: none;
    color: white;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 50%;
  }
`;
document.head.appendChild(iosStyle);