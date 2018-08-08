import Bowser from 'bowser';
import Modernizr from 'modernizr';
import ready from 'document-ready-promise';

ready().then(function()
{
  var modernizrChecks = ['cookies', 'eventlistener', 'geolocation', 'history', 'websockets', 'localstorage', 'sessionstorage', 'promises', 'audio', 'video', 'hashchange', 'cssgradients', 'opacity', 'mediaqueries', 'cssanimations', 'bgsizecover', 'borderradius', 'boxsizing', 'flexbox', 'csstransitions'],
      checksNotPassed = [],
      i;

  for(i in modernizrChecks)
  {
    if(!Modernizr[modernizrChecks[i]])
    {
      checksNotPassed.push(modernizrChecks[i]);
    }
  }

  if(!Bowser.check({ safari: '10.0' })) // Safari 9 will not work...
  {
    checksNotPassed.push('Firebase');
  }

  var dialogEl = document.getElementsByClassName('outdated')[0];
  if(checksNotPassed.length > 0)
  {
    dialogEl.style.display = 'block';
    dialogEl.getElementsByTagName('p')[0].appendChild(document.createTextNode(' (including ' + checksNotPassed.join(', ') + ')'));
    var containerEl = document.getElementsByClassName('container')[0];
    containerEl.parentNode.removeChild(containerEl);

  }
  else
  {
    dialogEl.parentNode.removeChild(dialogEl);
  }
});