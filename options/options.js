document.addEventListener('DOMContentLoaded', function() {
  initOptions();
});

async function initOptions() {
  await loadOptions();

  const timerDisplayElement = DomUtils.querySelector('#timer-display');
  const durationSlider = DomUtils.querySelector('#duration-slider');
  if (timerDisplayElement && durationSlider && durationSlider.value) {
    const sliderValue = parseInt(durationSlider.value);
    if (!isNaN(sliderValue)) {
      const durationInMs = sliderValue * 60 * 1000;
      timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
    }
  }

  await checkTimerStatus();

  DomUtils.addEventListener(DomUtils.querySelector('#stop-btn'), 'click', stopTimer);
  DomUtils.addEventListener(DomUtils.querySelector('#start-stop-btn'), 'click', startTimer);
  DomUtils.addEventListener(DomUtils.querySelector('#duration-slider'), 'input', () => {
    updateTimerDisplay();
    saveDurationChange();
  });

  Timer.onTimerChanged(async (status) => {
    await checkTimerStatus();
    if (status && status.isActive) {
      startTimerDisplay();
    }
  });

  Storage.onTimerSettingsChanged(async (newSettings) => {
    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (newSettings.duration && durationSlider && parseInt(durationSlider.value) !== newSettings.duration) {
      durationSlider.value = newSettings.duration;
      updateTimerDisplay();
    }
  });

  DomUtils.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    DomUtils.addEventListener(checkbox, 'change', saveOptions);
  });

  const exceptionsInput = DomUtils.querySelector('#exceptions-input');
  const additionalUrlsInput = DomUtils.querySelector('#additional-urls-input');

  const debouncedSave = MiscUtils.debounce(saveOptions, 500);

  DomUtils.addEventListener(exceptionsInput, 'input', debouncedSave);
  DomUtils.addEventListener(additionalUrlsInput, 'input', debouncedSave);
}

async function loadOptions() {
  try {
    const [options, timerSettings] = await Promise.all([
      Storage.loadUserOptions(),
      Storage.loadTimerSettings()
    ]);

    if (!options) {
      console.error('Failed to load user options');
      return;
    }

    DomUtils.querySelector('#social-checkbox').checked = options.socialEnabled;
    DomUtils.querySelector('#news-checkbox').checked = options.newsEnabled;
    DomUtils.querySelector('#entertainment-checkbox').checked = options.entertainmentEnabled;
    DomUtils.querySelector('#exceptions-input').value = options.exceptions || '';
    DomUtils.querySelector('#additional-urls-input').value = options.additionalUrls || '';

    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (durationSlider && timerSettings && timerSettings.duration) {
      durationSlider.value = timerSettings.duration;
    }
  } catch (error) {
    console.error('Error loading options:', error);
  }
}

async function saveOptions() {
  const options = {
    socialEnabled: DomUtils.querySelector('#social-checkbox').checked,
    newsEnabled: DomUtils.querySelector('#news-checkbox').checked,
    entertainmentEnabled: DomUtils.querySelector('#entertainment-checkbox').checked,
    exceptions: DomUtils.querySelector('#exceptions-input').value,
    additionalUrls: DomUtils.querySelector('#additional-urls-input').value
  };

  await Storage.saveUserOptions(options);
}

async function saveDurationChange() {
  const durationSlider = DomUtils.querySelector('#duration-slider');
  const duration = parseInt(durationSlider.value);

  const settings = await Storage.loadTimerSettings();
  settings.duration = duration;
  await Storage.saveTimerSettings(settings);
}

async function checkTimerStatus() {
  const status = await Timer.getStatus();
  const timerControl = DomUtils.querySelector('#timer-control');
  const sliderContainer = DomUtils.querySelector('.slider-container');
  const startStopBtn = DomUtils.querySelector('#start-stop-btn');
  const stopBtn = DomUtils.querySelector('#stop-btn');

  if (status.isActive) {
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'none';
    startStopBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    startTimerDisplay();
  } else {
    timerControl.style.display = 'block';
    sliderContainer.style.display = 'block';
    startStopBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    Timer.stopUpdates();

    // Set default timer display
    const timerDisplayElement = DomUtils.querySelector('#timer-display');
    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (durationSlider && durationSlider.value) {
      const currentSliderValue = parseInt(durationSlider.value);
      if (!isNaN(currentSliderValue)) {
        const durationInMs = currentSliderValue * 60 * 1000;
        timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
      } else {
        timerDisplayElement.textContent = '00:00:00';
      }
    } else {
      timerDisplayElement.textContent = '00:00:00';
    }
  }
}

function startTimerDisplay() {
  Timer.startUpdates(
    (status) => {
      updateTimerDisplay(status);
    },
    () => {
      checkTimerStatus(); // Hide timer control when expired
    }
  );
}

function updateTimerDisplay(status = null) {
  const timerDisplayElement = DomUtils.querySelector('#timer-display');
  const progressFill = DomUtils.querySelector('#progress-fill');

  if (!status) {
    const durationSlider = DomUtils.querySelector('#duration-slider');
    if (durationSlider && durationSlider.value) {
      const currentSliderValue = parseInt(durationSlider.value);
      if (!isNaN(currentSliderValue)) {
        const durationInMs = currentSliderValue * 60 * 1000;
        timerDisplayElement.textContent = Formatters.formatTimeRemaining(durationInMs);
        if (progressFill) {
          progressFill.style.width = '0%';
        }
        return;
      }
    }
    return; // Don't update if invalid
  }

  timerDisplayElement.textContent = Formatters.formatTimeRemaining(status.timeRemaining);

  if (progressFill && status.progress !== undefined) {
    const progressPercentage = Math.round(status.progress * 100);
    progressFill.style.width = `${progressPercentage}%`;
  }
}

async function startTimer() {
  const durationSlider = DomUtils.querySelector('#duration-slider');
  const selectedDuration = parseInt(durationSlider.value);
  await Timer.start(selectedDuration);
  await checkTimerStatus();
}

async function stopTimer() {
  await Timer.stop();
  Timer.stopUpdates();
  await checkTimerStatus();
}
