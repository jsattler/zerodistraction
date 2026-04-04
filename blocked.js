function getOriginalUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('originalUrl');
}

let scheduleCheckInterval = null;

async function initBlockedPage() {
  const originalUrl = getOriginalUrl();

  // Start timer updates for manual timer mode
  Timer.startUpdates(
    (status) => {
      updateTimer(status);
    },
    async () => {
      // Manual timer expired — check if schedule is still active before redirecting
      const scheduleActive = await Schedule.isInScheduledWindow();
      if (scheduleActive) {
        // Schedule is still blocking, switch to schedule countdown
        Timer.stopUpdates();
        startScheduleCountdown();
      } else if (originalUrl) {
        window.location.href = originalUrl;
      } else {
        window.location.href = 'about:home';
      }
    }
  );

  const timerStatus = await Timer.getStatus();

  if (timerStatus.isActive) {
    updateTimer(timerStatus);
  } else {
    // No manual timer — check schedule
    const scheduleStatus = await Schedule.getStatus();
    if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
      updateTimer(scheduleStatus);
      startScheduleCountdown();
    } else {
      updateTimer(timerStatus);
    }
  }
}

function startScheduleCountdown() {
  if (scheduleCheckInterval) return;

  scheduleCheckInterval = setInterval(async () => {
    const scheduleStatus = await Schedule.getStatus();
    if (scheduleStatus.isActive && scheduleStatus.isScheduled) {
      updateTimer(scheduleStatus);
    } else {
      // Schedule window ended
      clearInterval(scheduleCheckInterval);
      scheduleCheckInterval = null;
      const originalUrl = getOriginalUrl();
      if (originalUrl) {
        window.location.href = originalUrl;
      } else {
        window.location.href = 'about:home';
      }
    }
  }, 1000);
}

function updateTimer(status) {
  const timeRemainingElement = DomUtils.querySelector('#timeRemaining');
  const progressFillElement = DomUtils.querySelector('#progressFill');
  const backButton = DomUtils.querySelector('#backButton');

  if (!status.isActive) {
    timeRemainingElement.textContent = '--:--:--';
    progressFillElement.style.width = '0%';

    // Show back button when nothing is active
    const originalUrl = getOriginalUrl();
    if (originalUrl && backButton) {
      backButton.style.display = 'block';
      backButton.onclick = () => {
        window.location.href = originalUrl;
      };
    }
    return;
  }

  // Hide back button when blocking is active
  if (backButton) {
    backButton.style.display = 'none';
  }

  timeRemainingElement.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  const progressPercent = status.progress * 100;
  progressFillElement.style.width = `${progressPercent}%`;
}

initBlockedPage();
