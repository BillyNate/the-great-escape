export default function checkNotifications()
{
  console.log('checkNotifications()');
  return new Promise(function(resolve, reject)
  {
    if(!('Notification' in window))
    {
      reject('no-support');
    }
    else if(Notification.permission === 'granted') // Let's check whether notification permissions have already been granted
    {
      resolve();
    }
    else if(Notification.permission !== 'denied')
    {
      Notification.requestPermission(function(permission)
      {
        if(permission === 'granted') // If the user accepts
        {
          resolve();
        }
        else
        {
          reject('denied');
        }
      });
    }
    else
    {
      reject('no-support');
    }
  });
}