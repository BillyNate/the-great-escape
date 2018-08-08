export default function checkBattery()
{
  console.log('checkBattery()');
  return new Promise(function(resolve, reject)
  {
    function readBattery(battery)
    {
      if(battery.level <= .5)
      {
        reject(battery.level);
      }
      else
      {
        resolve(battery.level);
      }
    }

    if(navigator.battery)
    {
      readBattery(navigator.battery);
    }
    else if(navigator.getBattery)
    {
      navigator.getBattery().then(readBattery);
    }
    else
    {
      reject(null);
    }
  });
}