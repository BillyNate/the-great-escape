$(function()
{
  var noSleep = new NoSleep();

  function enableNoSleep()
  {
    noSleep.enable();
    document.removeEventListener('click', enableNoSleep, false);
  }
  document.addEventListener('click', enableNoSleep, false);
});