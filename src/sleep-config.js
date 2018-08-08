import sleep from './sleep.js';

$(function()
{
  sleep.prevent();
  // For some stupid reason the touchstart does not fire the first time...
  $(document).on('touchstart mousedown', function()
  {
    if(sleep._video.paused)
    {
      sleep._video.play();
    }
  });
});