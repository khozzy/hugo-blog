/**
 * Newsletter Subscription Form Handler
 *
 * Handles form submissions to the Cloudflare Worker proxy.
 * Requires window.subscribeConfig.workerUrl to be set.
 */

(function () {
  'use strict';

  const config = window.subscribeConfig || {};

  if (!config.workerUrl) {
    console.error('Subscribe: workerUrl not configured');
    return;
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Show message in form
   */
  function showMessage(form, message, isError) {
    const messageEl = form.querySelector('.subscribe-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.style.display = 'block';
      messageEl.classList.toggle('subscribe-message-error', isError);
      messageEl.classList.toggle('subscribe-message-success', !isError);
    }
  }

  /**
   * Set loading state
   */
  function setLoading(form, loading) {
    const button = form.querySelector('.subscribe-button');
    const textEl = form.querySelector('.subscribe-button-text');
    const loadingEl = form.querySelector('.subscribe-button-loading');
    const input = form.querySelector('.subscribe-input');

    if (button) {
      button.disabled = loading;
    }
    if (input) {
      input.disabled = loading;
    }
    if (textEl) {
      textEl.style.display = loading ? 'none' : 'inline';
    }
    if (loadingEl) {
      loadingEl.style.display = loading ? 'inline-flex' : 'none';
    }
  }

  /**
   * Track conversion in GA4
   */
  function trackConversion(campaign, leadMagnet) {
    if (typeof gtag === 'function') {
      gtag('event', 'newsletter_subscribe', {
        event_category: 'engagement',
        event_label: campaign || 'default',
        lead_magnet: leadMagnet || '',
      });
    }
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const input = form.querySelector('.subscribe-input');
    const email = input ? input.value.trim() : '';
    const campaign = form.dataset.campaign || '';
    const leadMagnet = form.dataset.leadMagnet || '';

    // Hide any previous message
    const messageEl = form.querySelector('.subscribe-message');
    if (messageEl) {
      messageEl.style.display = 'none';
    }

    // Client-side validation
    if (!email) {
      showMessage(form, 'Please enter your email address.', true);
      return;
    }

    if (!isValidEmail(email)) {
      showMessage(form, 'Please enter a valid email address.', true);
      return;
    }

    setLoading(form, true);

    try {
      const response = await fetch(config.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          campaign: campaign,
          lead_magnet: leadMagnet,
          page_url: window.location.href,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showMessage(form, result.message || 'Successfully subscribed!', false);
        trackConversion(campaign, leadMagnet);

        // Clear input
        if (input) {
          input.value = '';
        }

        // Optionally hide form after success
        const inputGroup = form.querySelector('.subscribe-input-group');
        if (inputGroup) {
          inputGroup.style.display = 'none';
        }
      } else {
        showMessage(form, result.error || 'Subscription failed. Please try again.', true);
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      showMessage(form, 'Network error. Please try again.', true);
    } finally {
      setLoading(form, false);
    }
  }

  /**
   * Initialize all subscribe forms on the page
   */
  function init() {
    const forms = document.querySelectorAll('.subscribe-form');
    forms.forEach(function (form) {
      form.addEventListener('submit', handleSubmit);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
