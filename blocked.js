async function initBlockedPage() {
  Timer.startUpdates(
    (status) => {
      updateTimer(status);
    },
    () => {
      window.location.href = 'about:home';
    }
  );

  const status = await Timer.getStatus();
  updateTimer(status);
}

function updateTimer(status) {
  const timeRemainingElement = DomUtils.querySelector('#timeRemaining');
  const progressFillElement = DomUtils.querySelector('#progressFill');

  if (!status.isActive) {
    timeRemainingElement.textContent = '--:--:--';
    progressFillElement.style.width = '0%';
    return;
  }

  timeRemainingElement.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  const progressPercent = status.progress * 100;
  progressFillElement.style.width = `${progressPercent}%`;
}

initBlockedPage();
