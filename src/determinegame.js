import checkGameState from './checkgamestate.js';
import { GAME } from './constants.js';

export default function determineGame(user)
{
  console.log('determineGame()');
  return new Promise(function(resolve, reject)
  {
    (new Promise(function(_resolve, _reject)
    {
      if(window.location.pathname.substr(1, 4) == 'game')
      {
        checkGameState(window.location.pathname.substr(6))
        .then(function(game)
        { 
          if(game.values.state == GAME.STATE.ASSEMBLING || game.values.state == GAME.STATE.ONGOING)
          {
            _resolve(game);
          }
          else
          {
            _reject();
          }
        })
        .catch(function(error)
        {
          _reject(error);
        });
      }
      else
      {
        _reject();
      }
    }))
    .then(function(game)
    {
      resolve(game);
    })
    .catch(function(error)
    {
      if(!user.values.game)
      {
        resolve(null);
      }
      else
      {
        checkGameState(user.values.game).then(function(game)
        {
          if(game.values.state == GAME.STATE.ASSEMBLING || game.values.state == GAME.STATE.ONGOING)
          {
            resolve(game);
          }
          else
          {
            resolve(null);
          }
        }).catch(function(error)
        {
          resolve(null);
        });
      }
    })
    .catch(function(error)
    {
      resolve(null);
    });
  });
}