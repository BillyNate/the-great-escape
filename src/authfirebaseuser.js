import firebase from 'firebase/app';
import 'firebase/auth';

export default function authFirebaseUser()
{
  console.log('authFirebaseUser()');
  return new Promise(function(resolve, reject)
  {
    firebase.auth().onAuthStateChanged(function(user)
    {
      if(user)
      {
        resolve(user);
      }
    });

    if(!firebase.auth().currentUser)
    {
      firebase.auth().signInAnonymously().catch(function(error)
      {
        reject(error);
      });
    }
    else
    {
      resolve(firebase.auth().currentUser);
    }
  });
}