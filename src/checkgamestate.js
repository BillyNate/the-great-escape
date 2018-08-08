export default function checkGameState(gameID)
{
  console.log('checkGameState()');
  return new Promise(function(resolve, reject)
  {
    firebase.database().ref('games/' + gameID).once('value').then(function(snapshot)
    {
      resolve({ uid: gameID, values: snapshot.val() });
    }).catch(function(error)
    {
      reject(error);
    });
  });
}