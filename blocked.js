function getOriginalUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('originalUrl');
}

async function initBlockedPage() {
  const originalUrl = getOriginalUrl();

  Timer.startUpdates(
    (status) => {
      updateTimer(status);
    },
    () => {
      // When timer expires, redirect to original URL if available
      if (originalUrl) {
        window.location.href = originalUrl;
      } else {
        window.location.href = 'about:home';
      }
    }
  );

  const status = await Timer.getStatus();
  updateTimer(status);
}

function updateTimer(status) {
  const timeRemainingElement = DomUtils.querySelector('#timeRemaining');
  const progressFillElement = DomUtils.querySelector('#progressFill');
  const backButton = DomUtils.querySelector('#backButton');

  if (!status.isActive) {
    timeRemainingElement.textContent = '--:--:--';
    progressFillElement.style.width = '0%';

    // Show back button when timer is not active
    const originalUrl = getOriginalUrl();
    if (originalUrl && backButton) {
      backButton.style.display = 'block';
      backButton.onclick = () => {
        window.location.href = originalUrl;
      };
    }
    return;
  }

  // Hide back button when timer is active
  if (backButton) {
    backButton.style.display = 'none';
  }

  timeRemainingElement.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  const progressPercent = status.progress * 100;
  progressFillElement.style.width = `${progressPercent}%`;
}

initBlockedPage();
