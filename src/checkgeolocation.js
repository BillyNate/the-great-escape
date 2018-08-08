export default function checkGeolocation(locationEventCallback, inaccurateCallback)
{
  console.log('checkGeolocation()');
  return new Promise(function(resolve, reject)
  {
    var resolved = false,
        startedAccuracyChecksOn = Date.now(),
        lastInacurateOn = Date.now();
    
    if(!navigator.geolocation)
    {
      reject();
    }
    else
    {
      navigator.geolocation.watchPosition(function(location)
      {
        var accuracy = location.coords.accuracy;
        if(!resolved)
        {
          if(location.coords.accuracy < 15)
          {
            if(Date.now() - lastInacurateOn > 5000)
            {
              resolve();
              resolved = true;
            }
          }
          else
          {
            lastInacurateOn = Date.now();
            if(Date.now() - startedAccuracyChecksOn > 15000)
            {
              inaccurateCallback();
            }
          }
        }
        locationEventCallback(location);
      }, function(error)
      {
        reject(error);
      }, { enableHighAccuracy: true, maximumAge: 500 });
    }
  });
}