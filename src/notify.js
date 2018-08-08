import Push from 'push.js';

export default function notify(title, body)
{
  var options = { icon: '/favicon-196x196.png', timeout: 30000 };
  if(body)
  {
    options['body'] = body;
  }
  Push.create(title, options);
}