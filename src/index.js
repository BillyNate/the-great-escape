import Bowser from 'bowser';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import '../firebase.init.js';
import loadGoogleMapsApi from 'load-google-maps-api';
import jQuery from 'jquery';
import './sleep-config.js';
import 'jquery-fullscreen-kayahr';
import Slip from 'slipjs';
import loadTemplates from './loadtemplates.js';
import langArticleSet from './langarticleset.js';
import ready from 'document-ready-promise';
import './browsercompat.js';
import capitalizeFirst from './capitalizefirst.js';
import { EXIT, ITEM, GAME, PLAYER, VENUE } from './constants.js';
import authFirebaseUser from './authfirebaseuser.js';
import determineGame from './determinegame.js';
import checkBattery from './checkbattery.js';
import checkGeolocation from './checkgeolocation.js';
import checkNotifications from './checknotifications.js';
import { HTMLMarker, PlayerMarker, VenueMarker, ItemMarker, createCustomMarker } from './gmapsmarkers.js';
import { getEvenlyRandomLocations, loadNearestRoads } from './maplocations.js';
import showLocationMap from './showlocationmap.js';
import showGameMap from './showgamemap.js';
import notify from './notify.js';
import './favicons';
import './style.scss';

var googleMapsApiSettings = { v: '3', key: 'AIzaSyDj1NcE7259YziwZBoxXaVGaNtnmA4uBVI', libraries: ['drawing', 'geometry'] },
    clockInterval = null;

ready().then(function()
{

  if(!Bowser.check({ safari: '10.0' }))
  {
    return;
  }

  // "global" vars:
  var mapOptions = { zoom: 16, gestureHandling: 'greedy', mapTypeId: 'roadmap', streetViewControl: false, mapTypeControl: false, fullscreenControl: false, styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }] },
      templates = null,
      texts = null,
      fireDatabase = firebase.database(),
      firebasePlayer = { uid: null, values: null, lastTimestamp: null, lastLocation: { lat: 0, lng: 0 } },
      firebaseGame = { uid: null, values: null },
      firebasePlayers = {},
      firebaseFugitivePlayer = null,
      firebaseConnected = true,
      entities = { items: [], venues: [] },
      serverTimeOffset = 0,
      playerMaxTimeout = 20 * 1000,
      map = null,
      centerMapOnPlayer = true,
      mapMarkers = { me: null, items: [], venues: [], players: {} };

  function loadLanguageTexts()
  {
    return new Promise(function(resolve, reject)
    {
      var language = 'en',
          languageOptions = ['en', 'nl'];
      if(navigator.language)
      {
        if(languageOptions.indexOf(navigator.language.substr(0, 2)) >= 0)
        {
          language = navigator.language.substr(0, 2);
        }
      }
      fireDatabase.ref('languages/' + language).once('value').then(function(languageSnapshot)
      {
        resolve(languageSnapshot.val());
      }).catch(function(error)
      {
        reject(error);
      });
    });
  }

  function storeLanguageTexts(loadedTexts)
  {
    texts = loadedTexts;
    return Promise.resolve();
  }

  function replaceLoadingTexts()
  {
    $('li.locationaccess span').text(texts.misc.access_loc);
    $('li.notificationaccess span').text(texts.misc.access_notify);
    $('li.battery span').text(texts.misc.battery_level);
    $('li.userdata span').text(texts.misc.load_data_user);
    $('li.gamedata span').text(texts.misc.load_data_game);
    $('li.maps span').text(texts.misc.load_map);
    $('li.locationaccess .note').text(texts.misc.note_location_access);
    $('li.notificationaccess .note').text(texts.misc.note_notifications);
    $('li.battery .note').text(texts.misc.note_battery);
    $('li.userdata .note').text(texts.misc.note_user_data);
    $('li.gamedata .note').text(texts.misc.note_game_data);
    $('li.maps .note').text(texts.misc.note_map);
    $('input[name="username"]').prop('placeholder', texts.misc.placeholder_name);
    $('input[type="submit"]').val(texts.misc.submit_join);
    return Promise.resolve();
  }

  function loadUserGame()
  {
    console.log('loadUserGame()');
    return new Promise(function(resolveLoadUserGame, rejectLoadUserGame)
    {
      // Load/authenticate user:
      authFirebaseUser()
      // User authenticated:
      .then(function(player)
      {
        return new Promise(function(_resolve, _reject)
        {
          firebasePlayer.uid = player.uid;

          Promise.all(
          [
            fireDatabase.ref('players/' + player.uid).once('value'),
            fireDatabase.ref('items').once('value'),
            fireDatabase.ref('venues').once('value')
          ]).then(function(returnValues)
          {
            var optionalPromises = [];
            if(returnValues[0].val())
            {
              firebasePlayer.values = returnValues[0].val();
            }
            else
            {
              // If there's no record of this player, then create one containing a zero value location. Otherwise there's no record to keep track of:
              optionalPromises.push(fireDatabase.ref('players/' + firebasePlayer.uid).update({ location: { lat: 0, lng: 0 } }));
            }
            entities.items = returnValues[1].val()
            entities.venues = returnValues[2].val();

            Promise.all(optionalPromises).then(function()
            {
              // Keep track of changes to the player:
              fireDatabase.ref('players/' + firebasePlayer.uid).on('value', function(changedPlayerSnapshot)
              {
                if(!firebasePlayer.values)
                {
                  firebasePlayer.values = {};
                }
                firebasePlayer.values = changedPlayerSnapshot.val();
              });

              _resolve(firebasePlayer);
            });
          });
        });
      })
      .then(function(firebasePlayer)
      {
        resolveLoadUserGame(firebasePlayer);
      })
      .catch(function(error)
      {
        rejectLoadUserGame(error);
      });
    });
  }

  // DEBUG! {
  var locationOffset = { lat: 0, lng: 0 };
  document.onkeydown = function(event)
  {
    event = event || window.event;

    switch(event.keyCode.toString())
    {
      case '38':
        locationOffset.lat += 0.0001;
        break;
      case '40':
        locationOffset.lat -= 0.0001;
        break;
      case '39':
        locationOffset.lng += 0.0001;
        break;
      case '37':
        locationOffset.lng -= 0.0001;
        break;
    }
  };
  // DEBUG! }

  function onLocationChange(location)
  {
    var coords = { lat: location.coords.latitude, lng: location.coords.longitude };
    coords.lat += locationOffset.lat;
    coords.lng += locationOffset.lng;

    if(firebasePlayer.uid)
    {
      fireDatabase.ref('players/' + firebasePlayer.uid).update({ location: coords });
      if(firebaseGame.uid && firebaseConnected)
      {
        if(firebaseGame.values)
        {
          if(firebaseGame.values.players[firebasePlayer.uid])
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update({ timestamp: firebase.database.ServerValue.TIMESTAMP });
          }
        }
      }

      if(firebaseGame.values)
      {
        if(firebaseGame.values.state)
        {
          if(firebaseGame.values.state == GAME.STATE.ONGOING && map)
          {
            gameLoop(coords);
          }
          else if(firebaseGame.values.state == GAME.STATE.ASSEMBLING && firebaseGame.values.players[firebasePlayer.uid])
          {
            if(firebaseGame.values.players[firebasePlayer.uid].state == PLAYER.STATE.READY && firebaseGame.values.location.radius < google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(firebaseGame.values.location.lat, firebaseGame.values.location.lng), new google.maps.LatLng(location.coords.latitude, location.coords.longitude)))
            {
              fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update({ state: PLAYER.STATE.BIDING });
            }
          }
        }
      }
    }
  }

  function onInaccurateLocation()
  {
    $('li.locationaccess .note').text(texts.misc.note_location_accuracy).show();
  }

  function updateVisualLoader(finished, resolved=true)
  {
    var returnFunction = function(returnValue)
    {
      return new Promise(function(resolve, reject)
      {
        if(resolved)
        {
          $('ul.loading .' + finished + ' > i').text('check').removeClass('rotating');
          resolve(returnValue);
        }
        else if(resolved === null)
        {
          $('ul.loading .' + finished + ' > i').text('remove').removeClass('rotating');
          $('ul.loading .' + finished + ' .note').show();
          resolve(returnValue);
        }
        else
        {
          $('ul.loading .' + finished + ' > i').text('close').removeClass('rotating');
          $('ul.loading .' + finished + ' .note').show();
          reject(returnValue);
        }
      });
    };
    return returnFunction;
  }

  function reorient() // after a position change in the history stack
  {
      var state = history.state;
      var direction; /* (-1, 0, 1) = (backward, reload, forward)
        position of this entry vs. last entry (of ours) shown */
      if( state === null ) // then this entry is new to the stack
      {
          var position = history.length - 1; // top of stack
          direction = 1;

          // (1) Stamp the entry with its own position in the stack
          state = String( position );
          history.replaceState( state, /*no title*/'' );
      }
      else // this entry was pre-existing
      {
          var position = Number( state );
          var stateLastShown =
            sessionStorage.getItem( 'stateLastShown' );
          var positionLastShown = Number( stateLastShown );
          direction = Math.sign( position - positionLastShown );
      }

      // (2) Stamp the session with the last position shown
      sessionStorage.setItem( 'stateLastShown', state );

      // (3) Answer the question
      console.log( 'travel direction was ' + direction );
  }

  $(window).bind('popstate load', function(event)
  {
    var direction = Math.sign(Number(window.history.state) - Number(sessionStorage.getItem('stateLastShown')));

    sessionStorage.setItem('stateLastShown', window.history.state);

    if(direction == -1 && firebaseGame.uid)
    {
      if(confirm(texts.misc.dialog_leave_game))
      {
        var gameUpdates = [];
        if(firebaseGame.values.state == GAME.STATE.ASSEMBLING && firebaseGame.values.host == firebasePlayer.uid)
        {
          gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/players').remove());
        }
        else
        {
          if(firebaseGame.values.state == GAME.STATE.ONGOING && firebaseFugitivePlayer == firebasePlayer.uid)
          {
            gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid).update({ state: GAME.STATE.APPREHENDED }));
          }
          gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).remove());
        }
        gameUpdates.push(fireDatabase.ref('players/' + firebasePlayer.uid + '/game').remove());
        Promise.all(gameUpdates).then(function()
        {
          window.location.assign('/');
        });
      }
      else
      {
        window.history.pushState(String(Number(window.history.state) + 1), null, window.location.pathname);
        sessionStorage.setItem('stateLastShown', window.history.state);
      }
    }
  });
  if(!window.history.state)
  {
    if(!sessionStorage.getItem('stateLastShown'))
    {
      sessionStorage.setItem('stateLastShown', '0');
    }
    window.history.replaceState(String(Number(sessionStorage.getItem('stateLastShown')) + 1), null);
    window.history.pushState(String(Number(window.history.state) + 1), null, window.location.pathname);
    sessionStorage.setItem('stateLastShown', window.history.state);
  }

  function evaluateChecks(returnValues)
  {
    console.log('All primary promises have been resolved!');

    // Set firebaseGame if found (from url or database):
    if(returnValues[0])
    {
      firebaseGame.uid = returnValues[0].uid;
      firebaseGame.values = returnValues[0].values;
    }

    templates = returnValues[3];

    if(!firebaseGame.uid)
    {
      $('ul.loading .gamedata > i').text('remove');
    }

    if(returnValues[4] !== null && returnValues[4] < .25)
    {
      return Promise.reject();
    }
    else if((returnValues[4] !== null && returnValues[4] < .5) || returnValues[6])
    {
      if(returnValues[6] == 'no-support')
      {
        var chromeURL = 'https://play.google.com/store/apps/details?id=com.android.chrome';
        if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)
        {
          chromeURL = 'https://itunes.apple.com/us/app/google-chrome/id535886823';
        }
        $('li.notificationaccess .note').append('<br>' + texts.misc.note_notifications_support.replace('$1', chromeURL));
      }
      return Promise.resolve('pause');
    }
    else
    {
      return Promise.resolve();
    }
  }

  function enterGame(optionalParameter)
  {
    var username = null,
        gameState = null;
    
    if(firebasePlayer.values)
    {
      if(firebasePlayer.values.name)
      {
        username = firebasePlayer.values.name;
      }
    }

    if(firebaseGame.values)
    {
      if(firebaseGame.values.state)
      {
        gameState = firebaseGame.values.state;
      }
    }

    if(!firebaseGame.uid || !username || gameState == GAME.STATE.ASSEMBLING || optionalParameter == 'pause')
    {
      return new Promise(function(resolve, reject)
      {
        if(!firebaseGame.uid)
        {
          $('form.enter input[type="submit"]').val(texts.misc.submit_new_game);
        }
        else
        {
          $('form.enter input[name="game"]').val(firebaseGame.uid);
        }

        if(firebasePlayer.values)
        {
          if(firebasePlayer.values.name)
          {
            $('form.enter input[name="username"]').val(firebasePlayer.values.name);
          }
        }

        $('form.enter').show().one('submit', function(event)
        {
          event.preventDefault();
          if($.trim($(this).find('input[name="username"]').val()).length > 0)
          {
            $(this).hide();

            var updates = [];

            updates.push(fireDatabase.ref('players/' + firebasePlayer.uid).update({ name: $.trim($(this).find('input[name="username"]').val()) }));

            if($(this).find('input[name="game"]').val().length <= 0)
            {
              var gameSettings = { state: GAME.STATE.ASSEMBLING, players: {} };
              gameSettings.players[firebasePlayer.uid] = { role: PLAYER.ROLE.FUGITIVE, state: PLAYER.STATE.BIDING, resets: 0, timestamp: firebase.database.ServerValue.TIMESTAMP };
              gameSettings.host = firebasePlayer.uid;

              updates.unshift(fireDatabase.ref('games').push(gameSettings));
            }
            
            Promise.all(updates)
            .then(function(returnValues)
            {
              if(returnValues.length > 1)
              {
                firebaseGame.uid = returnValues[0].key;
              }
              return fireDatabase.ref('games/' + firebaseGame.uid).once('value');
            })
            .then(function(gameSnapshot)
            {
              firebaseGame.values = gameSnapshot.val();
              resolve();
            }).catch(function(error)
            {
              reject(error);
            });
          }
        });
      });
    }
    else
    {
      return Promise.resolve();
    }
  }

  function registerToGame()
  {
    var queries = [],
        addPlayer = false;

    queries.push(fireDatabase.ref('players/' + firebasePlayer.uid).update({ game: firebaseGame.uid }));

    if(!firebaseGame.values.players)
    {
      addPlayer = true;
    }
    else if(!firebaseGame.values.players[firebasePlayer.uid])
    {
      addPlayer = true;
    }

    if(addPlayer)
    {
      var players = {};
      players[firebasePlayer.uid] = { state: PLAYER.STATE.BIDING, role: PLAYER.ROLE.HUNTER, resets: 0, timestamp: firebase.database.ServerValue.TIMESTAMP };
      queries.push(fireDatabase.ref('games/' + firebaseGame.uid + '/players').update(players));
    }

    fireDatabase.ref('games/' + firebaseGame.uid).on('value', function(gameSnapshot)
    {
      firebaseGame.values = gameSnapshot.val();
    });

    return Promise.all(queries);
  }

  function pickLocation()
  {
    return new Promise(function(resolve, reject)
    {
      if((firebaseGame.values.location && firebaseGame.values.items) || firebaseGame.values.host != firebasePlayer.uid)
      {
        resolve();
      }
      else // (!firebaseGame.location && firebaseGame.host == firebasePlayer.uid)
      {
        var items = [],
            venues = [],
            exit = { location: { lat: 0, lng: 0 } };

        $('.container').empty();
        $(templates.locationpick).appendTo('.container').find('form.location').hide().find('button[name="scramble"]').text(texts.misc.button_place);
        $('form.location input[type="submit"]').val(texts.misc.button_save);

        mapOptions.center = firebasePlayer.values.location;

        var chain = new Promise(function(resolve, reject)
        {
          var i;
          for(i in entities.venues)
          {
            venues.push({ type: entities.venues[i].type, location: { lat: 0, lng: 0 }, marker: null });
          }
          for(i in entities.items)
          {
            for(var j=0; j<entities.items[i].amount; j++)
            {
              items.push({ type: entities.items[i].type, location: { lat: 0, lng: 0 }, marker: null });
            }
          }
          resolve();
        });

        chain
        .then(function()
        {
          return showLocationMap(document.getElementsByClassName('googlemap')[0], mapOptions);
        })
        .then(function(returnValues)
        {
          map = returnValues.map;
          var drawingManager = returnValues.dm;
          var eventListener = google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event)
          {
            // Switch back to non-drawing mode after drawing a shape.
            drawingManager.setDrawingMode(null);

            var gameLocation = { lat: event.overlay.center.lat(), lng: event.overlay.center.lng(), radius: event.overlay.radius };

            $('form.location').on('submit', function(e)
            {
              e.preventDefault();

              $('form.location').hide();
              var gameUpdates = [];
              gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/location').set(gameLocation));
              gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/exit').set({ location: exit.location }));
              gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/items').set(items.map(function(item)
              {
                return { location: item.location, type: item.type, state: ITEM.STATE.LOST };
              })));
              gameUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/venues').set(venues.map(function(venue)
              {
                return { location: venue.location, type: venue.type, state: VENUE.STATE.ORDINARY };
              })));

              Promise.all(gameUpdates).then(function()
              {
                resolve();
              });

            }).show().find('input[type="submit"]').hide().siblings('button[name="scramble"]').on('click', function(e)
            {
              e.preventDefault();

              Promise.resolve(getEvenlyRandomLocations(event.overlay.center, event.overlay.radius/10, event.overlay.radius/2, 2))
              .then(loadNearestRoads)
              .then(function(exitLocations)
              {
                var i, j = 0;
                for(i=0; i<exitLocations.length; i++)
                {
                  if(!exitLocations[i])
                  {
                    continue;
                  }

                  exit.location.lat = exitLocations[i].latitude;
                  exit.location.lng = exitLocations[i].longitude;
                  break;
                }

                // Pass the used exit location as Google LatLngs to the next function
                return Promise.resolve([new google.maps.LatLng(exit.location.lat, exit.location.lng)]);
              })
              .then(function(locations)
              {
                return Promise.resolve(getEvenlyRandomLocations(event.overlay.center, event.overlay.radius/10, event.overlay.radius, Math.floor(venues.length * 1.5), locations));
              })
              .then(loadNearestRoads)
              .then(function(venueLocations)
              {
                var i, j = 0;
                for(i=0; i<venueLocations.length&&j<venues.length; i++)
                {
                  // If there's actually no nearby road on venueLocations[i], continue to the next possible location. We got 1.5 times as much possible locations as we require, so it should do fine...
                  if(!venueLocations[i])
                  {
                    continue;
                  }

                  venues[j].location.lat = venueLocations[i].latitude;
                  venues[j].location.lng = venueLocations[i].longitude;

                  if(!venues[j].marker)
                  {
                    venues[j].marker = new VenueMarker(venues[j].location, venues[j].type);
                    venues[j].marker.setMap(map);
                  }
                  else
                  {
                    venues[j].marker.setPosition(venues[j].location);
                  }

                  j ++;
                }

                // Pass all used locations as Google LatLngs to the next function
                return Promise.resolve(venues.map(function(venue)
                {
                  return new google.maps.LatLng(venue.location.lat, venue.location.lng);
                }));
              })
              .then(function(locations)
              {
                return Promise.resolve(getEvenlyRandomLocations(event.overlay.center, event.overlay.radius/10, event.overlay.radius, Math.floor(items.length * 1.5), locations));
              })
              .then(loadNearestRoads)
              .then(function(itemLocations)
              {
                var i, j = 0;
                for(i=0; i<itemLocations.length&&j<items.length; i++)
                {
                  // If there's actually no nearby road on itemLocations[i], continue to the next possible location. We got 1.5 times as much possible locations as we require, so it should do fine...
                  if(!itemLocations[i])
                  {
                    continue;
                  }

                  items[j].location.lat = itemLocations[i].latitude;
                  items[j].location.lng = itemLocations[i].longitude;

                  if(!items[j].marker)
                  {
                    items[j].marker = new ItemMarker(items[j].location, items[j].type);
                    items[j].marker.setMap(map);
                  }
                  else
                  {
                    items[j].marker.setPosition(items[j].location);
                  }

                  j ++;
                }
                $('form.location input[type="submit"]').show();
              });
              
              $(this).text(texts.misc.button_shuffle);
            });
          });
        });
      }
    });
  }

  function managePlayers()
  {
    return new Promise(function(resolve, reject)
    {
      if(firebaseGame.values.state != GAME.STATE.ASSEMBLING)
      {
        resolve();
      }
      else
      {
        var players = {};

        $('.container').empty();
        $(templates.playeroverview).appendTo('.container').find('form.controls').on('submit', function(event)
        {
          event.preventDefault();

          fireDatabase.ref('games/' + firebaseGame.uid + '/players').orderByChild('timestamp').endAt(Date.now() + serverTimeOffset - (10 * 1000)).once('value').then(function(playersSnapshot)
          {
            if(playersSnapshot.numChildren() == 0)
            {
              return Promise.resolve();
            }

            $('form.controls input[type="submit"]').hide();

            var playerStateUpdates = [];
            $.each(playersSnapshot.val(), function(playerID, player)
            {
              playerStateUpdates.push(fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID).update({ state: PLAYER.STATE.BIDING }));
            });
            return Promise.all(playerStateUpdates);
          }).then(function()
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players').orderByChild('state').equalTo(PLAYER.STATE.READY).once('value').then(function(playersSnapshot)
            {
              if(playersSnapshot.numChildren() == Object.keys(firebaseGame.values.players).length)
              {
                $('form.controls').hide();
                fireDatabase.ref('games/' + firebaseGame.uid).update({ state: GAME.STATE.ONGOING, timestamp: firebase.database.ServerValue.TIMESTAMP });
              }
              else
              {
                $('form.controls input[type="submit"]').hide();
              }
            });
          });
        }).find('button[name="whatsapp"]').text(texts.misc.button_invite_whatsapp).siblings('input[type="submit"]').val(texts.misc.button_start);
        
        if(firebasePlayer.uid == firebaseGame.values.host)
        {
          new Slip($('.container').find('ul.players').get()[0]);
          $('.container').find('ul.players').on('slip:beforereorder', function(event)
          {
            event.preventDefault();
          })
          .on('slip:beforeswipe', function(event)
          {
            if($(event.target).attr('data-player-id') == firebasePlayer.uid)
            {
              event.preventDefault();
            }
          })
          .on('slip:swipe', function(event)
          {
            $(event.target).remove();
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + $(event.target).attr('data-player-id')).remove();
          });
        }
        
        if(firebaseGame.values.host == firebasePlayer.uid)
        {
          $('form.controls button[name="whatsapp"]').show();
        }

        $('ul.players').on('click', 'i', function()
        {
          if($(this).hasClass('state') && $(this).closest('li').data('player-id') == firebasePlayer.uid)
          {
            var newState = PLAYER.STATE.BIDING;
            if($(this).hasClass(PLAYER.STATE.BIDING) && firebaseGame.values.location.radius > google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(firebaseGame.values.location.lat, firebaseGame.values.location.lng), new google.maps.LatLng(firebasePlayer.values.location.lat, firebasePlayer.values.location.lng)))
            {
              newState = PLAYER.STATE.READY;
            }
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update($.extend({ state: newState }, ( firebaseConnected ? { timestamp: firebase.database.ServerValue.TIMESTAMP } : {})));
          }
          else if($(this).hasClass('role') && firebasePlayer.uid == firebaseGame.values.host)
          {
            var newFugitive = $(this).closest('li').data('player-id');
            $.each(firebaseGame.values.players, function(playerID, player)
            {
              fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID).update($.extend({ role: (playerID == newFugitive ? PLAYER.ROLE.FUGITIVE : PLAYER.ROLE.HUNTER) }, ( firebaseConnected ? { timestamp: firebase.database.ServerValue.TIMESTAMP } : {})));
            });
          }
        });
        fireDatabase.ref('games/' + firebaseGame.uid + '/players').on('child_added', function(gamePlayerSnapshot)
        {
          fireDatabase.ref('players/' + gamePlayerSnapshot.key).once('value').then(function(playerSnapshot)
          {
            players[gamePlayerSnapshot.key] = playerSnapshot.val().name;
            $(templates.playerlistitem).find('li').clone().attr('data-player-id', gamePlayerSnapshot.key).prependTo('ul.players').find('span').text(playerSnapshot.val().name).siblings('.role').addClass(gamePlayerSnapshot.val().role).siblings('.state').addClass(gamePlayerSnapshot.val().state).closest('li').insertAfter('ul.players li:nth-child(' + (Object.values(players).sort().indexOf(playerSnapshot.val().name) + 1) + ')');;
          });
        });
        fireDatabase.ref('games/' + firebaseGame.uid + '/players').on('child_changed', function(playerSnapshot)
        {
          $('ul.players li[data-player-id="' + playerSnapshot.key + '"] i.role').removeClass(PLAYER.ROLE.FUGITIVE).removeClass(PLAYER.ROLE.HUNTER).addClass(playerSnapshot.val().role).siblings('i.state').removeClass(PLAYER.STATE.BIDING).removeClass(PLAYER.STATE.READY).addClass(playerSnapshot.val().state);
          
          if(firebasePlayer.uid == firebaseGame.values.host && Object.keys(firebaseGame.values.players).length > 1)
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players').orderByChild('state').equalTo(PLAYER.STATE.READY).once('value').then(function(playersSnapshot)
            {
              if(playersSnapshot.numChildren() == Object.keys(firebaseGame.values.players).length)
              {
                $('form.controls input[type="submit"]').show();
              }
              else
              {
                $('form.controls input[type="submit"]').hide();
              }
            });
          }
        });
        fireDatabase.ref('games/' + firebaseGame.uid + '/players').on('child_removed', function(gamePlayerSnapshot)
        {
          delete players[gamePlayerSnapshot.key];
          if(gamePlayerSnapshot.key == firebasePlayer.uid)
          {
            fireDatabase.ref('players/' + firebasePlayer.uid + '/game').remove();
            window.location.replace('/');
          }
          $('ul.players li[data-player-id="' + gamePlayerSnapshot.key + '"]').remove();
        });
        fireDatabase.ref('games/' + firebaseGame.uid + '/state').on('value', function(stateSnapshot)
        {
          if(stateSnapshot.val() != GAME.STATE.ASSEMBLING)
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players').off('child_added');
            fireDatabase.ref('games/' + firebaseGame.uid + '/players').off('child_changed');
            fireDatabase.ref('games/' + firebaseGame.uid + '/players').off('child_removed');
            resolve();
          }
        });
        $('form.controls button[name="whatsapp"]').on('click', function(event)
        {
          event.preventDefault();
          window.open('whatsapp://send?text=' + texts.misc.invitation.replace('$1', encodeURI(window.location.protocol + '//' + window.location.hostname + '/game/' + firebaseGame.uid)), 'WhatsApp');
        });
      }
    });
  }

  function countdown()
  {
    return new Promise(function(resolve, reject)
    {
      var counter = 0;
      if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
      {
        resolve();
      }
      else if((Date.now() + serverTimeOffset - firebaseGame.values.timestamp) / 1000 > 20)
      {
        resolve()
      }
      else
      {
        $('.container').empty();
        $(templates.countdown).appendTo('.container');
        var countdownInterval = setInterval(function()
        {
          counter = Math.ceil(20 - ((Date.now() + serverTimeOffset - firebaseGame.values.timestamp) / 1000));
          $('#countdown').text(counter.toString().padStart(2, '0'));
          if(counter <= 0)
          {
            clearInterval(countdownInterval);
            resolve();
          }
        }, 100); // Update every 100ms to keep all clients clocks pretty much in sync
      }
    });
  }

  function battle()
  {
    return new Promise(function(resolve, reject)
    {
      $('.container').remove();
      $(templates.battlefield).children().clone().prependTo('body').filter('ul.inventory, ul.pharmacy').find('li').remove();
      $('.distance .pin').remove();
      $('div.info section.explanation').append(texts.misc['info_' + firebaseGame.values.players[firebasePlayer.uid].role].replace(/\s{2}/g, '<br>')).siblings('section.tips').append($('<ul>').append(texts.misc.info_tips.map(function(string)
      {
        return '<li>' + string + '</li>';
      })));
      $('div.info i').not('.material-icons').each(function(index)
      {
        $(this).prop('class', 'game-icon game-icon-' + $(this).prop('class'));
      });

      if(firebasePlayer.values.location)
      {
        mapOptions.center = firebasePlayer.values.location;
      }
      else
      {
        mapOptions.center = { lat: firebaseGame.values.location.lat, lng: firebaseGame.values.location.lng };
      }
      mapOptions.zoom = 18;
      firebasePlayer.lastTimestamp = firebaseGame.values.players[firebasePlayer.uid].timestamp;

      notify(texts.misc.notify_start_title, texts.misc.notify_start_body);

      fireDatabase.ref('games/' + firebaseGame.uid + '/state').on('value', function(gameStateSnapshot)
      {
        if(gameStateSnapshot.val() == GAME.STATE.APPREHENDED || gameStateSnapshot.val() == GAME.STATE.VANISHED)
        {
          resolve(gameStateSnapshot.val());
        }
      });

      fireDatabase.ref('.info/connected').on('value', function(connectedSnapshot)
      {
        firebaseConnected = connectedSnapshot.val();
      });

      fireDatabase.ref('games/' + firebaseGame.uid + '/shots').orderByChild('timestamp').startAt(Date.now() + serverTimeOffset).on('child_added', function(shotSnapshot)
      {
        if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE && !shotSnapshot.val().hit)
        {
          var notificationTitle = texts.misc.notify_shot_at_title_default;
          if(firebasePlayers[shotSnapshot.val().by].name)
          {
            notificationTitle = texts.misc.notify_shot_at_title_name.replace('$1', firebasePlayers[shotSnapshot.val().by].name);
          }
          notify(notificationTitle, texts.misc.notify_shot_at_body_miss);
        }
        else if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE) // && shotSnapshot.val().hit
        {
          var indexOfMedkit = -1;
          if(firebaseGame.values.players[firebasePlayer.uid].items)
          {
            indexOfMedkit = firebaseGame.values.players[firebasePlayer.uid].items.indexOf(ITEM.TYPE.MEDKIT);
          }

          if(indexOfMedkit >= 0)
          {
            var items = firebaseGame.values.players[firebasePlayer.uid].items;
            items.splice(indexOfMedkit, 1);
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid + '/items').set(items);

            var notificationTitle = texts.misc.notify_shot_at_title_default;
            if(firebasePlayers[shotSnapshot.val().by].name)
            {
              notificationTitle = texts.misc.notify_shot_at_title_name.replace('$1', firebasePlayers[shotSnapshot.val().by].name);
            }
            
            notify(notificationTitle, texts.misc.notify_shot_at_body_hit);
          }
          else
          {
            // GAME OVER!
            fireDatabase.ref('games/' + firebaseGame.uid).update({ state: GAME.STATE.APPREHENDED });
          }
        }
        else if(!shotSnapshot.val().hit) // && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER
        {
          var notificationTitle = texts.misc.notify_shot_to_title_default;
          if(shotSnapshot.val().by == firebasePlayer.uid)
          {
            notificationTitle = texts.misc.notify_shot_to_title_self;
          }
          else if(firebasePlayers[shotSnapshot.val().by].name)
          {
            notificationTitle = texts.misc.notify_shot_to_title_name.replace('$1', firebasePlayers[shotSnapshot.val().by].name);
          }
          notify(notificationTitle, texts.misc.notify_shot_to_body_miss);
        }
        else // shotSnapshot.val().hit && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER
        {
          // No notification here... Either we'll receive a notification about the fugitive using a medkit or it's game over...
        }
      });

      showGameMap(document.getElementsByClassName('battlefield')[0], mapOptions)
      .then(function(returnValues)
      {
        map = returnValues.map;
        var i = 0;

        google.maps.event.addListener(map, 'dragstart', function(event)
        {
          centerMapOnPlayer = false;
          $('button.center').show();
        });

        // Put items on the map:
        fireDatabase.ref('games/' + firebaseGame.uid + '/items').on('child_added', function(itemsSnapshot)
        {
          mapMarkers.items[itemsSnapshot.key] = new ItemMarker(itemsSnapshot.val().location, itemsSnapshot.val().type, texts.items[itemsSnapshot.val().type].word);
          mapMarkers.items[itemsSnapshot.key].setMap(map);

          if(itemsSnapshot.val().state == ITEM.STATE.FOUND)
          {
            mapMarkers.items[itemsSnapshot.key].hide();
          }
          else
          {
            mapMarkers.items[itemsSnapshot.key].show();
          }
        });

        fireDatabase.ref('games/' + firebaseGame.uid + '/items').on('child_changed', function(itemsSnapshot)
        {
          if(itemsSnapshot.val().state == ITEM.STATE.FOUND)
          {
            $(mapMarkers.items[itemsSnapshot.key].div).removeClass('glow-blue glow-orange');
            mapMarkers.items[itemsSnapshot.key].hide();
            if(itemsSnapshot.val().type != ITEM.TYPE.BULLET)
            {
              var notificationTitle = texts.misc.notify_found_item_title_default;
              if(firebaseFugitivePlayer == firebasePlayer.uid)
              {
                notificationTitle = texts.misc.notify_found_item_title_self;
              }
              else if(firebasePlayers[firebaseFugitivePlayer].name)
              {
                notificationTitle = texts.misc.notify_found_item_title_name.replace('$2', firebasePlayers[firebaseFugitivePlayer].name);
              }
              notificationTitle = langArticleSet(notificationTitle, texts.articles, texts.items[itemsSnapshot.val().type], '1');

              notify(notificationTitle);
            }
            else if(firebaseGame.values.host == firebasePlayer.uid) // Just found item is a bullet. The host should check if a new bullet needs be added to the map:
            {
              var lostBullets = 0,
                  updateItems = {};
              for(var itemI in firebaseGame.values.items)
              {
                if(firebaseGame.values.items[itemI].type == ITEM.TYPE.BULLET && firebaseGame.values.items[itemI].state == ITEM.STATE.LOST)
                {
                  lostBullets ++;
                }
              }
              if(lostBullets <= 2)
              {
                // New location to be used for the new bullet (does not take the already existing locations in consideration):
                Promise.resolve(getEvenlyRandomLocations(new google.maps.LatLng(firebaseGame.values.location.lat, firebaseGame.values.location.lng), firebaseGame.values.location.radius/10, firebaseGame.values.location.radius, 1))
                .then(loadNearestRoads)
                .then(function(newLocations)
                {
                  updateItems[firebaseGame.values.items.length] = { type: ITEM.TYPE.BULLET, state: ITEM.STATE.LOST, location: { lat: newLocations[0].latitude, lng: newLocations[0].longitude } };
                  fireDatabase.ref('games/' + firebaseGame.uid + '/items').update(updateItems);
                });
              }
            }
          }
        });

        // Put venues on the map:
        var balance = 0;
        for(i in firebaseGame.values.venues)
        {
          mapMarkers.venues[i] = new VenueMarker(firebaseGame.values.venues[i].location, firebaseGame.values.venues[i].type, texts.venues[firebaseGame.values.venues[i].type].word, entities.venues[i].needs, entities.venues[i].needs.length * 1000, firebaseGame.values.venues[i].state);
          mapMarkers.venues[i].setMap(map);

          if(firebaseGame.values.venues[i].state == VENUE.STATE.ROBBED)
          {
            balance += entities.venues[i].needs.length * 1000;
          }
        }
        $('.piggybank').text(balance);
        
        fireDatabase.ref('games/' + firebaseGame.uid + '/venues').on('child_changed', function(venuesSnapshot)
        {
          if(venuesSnapshot.val().state == VENUE.STATE.ROBBED)
          {
            balance = 0;
            for(var j in firebaseGame.values.venues)
            {
              if(firebaseGame.values.venues[j].state == VENUE.STATE.ROBBED || j == venuesSnapshot.key)
              {
                balance += entities.venues[j].needs.length * 1000;
              }
            }
            $('.piggybank').text(balance);
            $('.gmaps-venue.' + venuesSnapshot.val().type).addClass(VENUE.STATE.ROBBED);

            var notificationBody = texts.misc.notify_robbed_body_default;
            if(firebaseFugitivePlayer == firebasePlayer.uid)
            {
              notificationBody = texts.misc.notify_robbed_body_self;
            }
            else if(firebasePlayers[firebaseFugitivePlayer].name)
            {
              notificationBody = texts.misc.notify_robbed_body_name.replace('$2', firebasePlayers[firebaseFugitivePlayer].name);
            }
            notificationBody = notificationBody.replace('$1', balance);
            
            notify(capitalizeFirst(langArticleSet(texts.misc.notify_robbed_title, texts.articles, texts.venues[venuesSnapshot.val().type], '1')), notificationBody);
          }
        });

        if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE && firebaseGame.values.exit)
        {
          var exitMarker = new VenueMarker(firebaseGame.values.exit.location, EXIT, texts.misc.exit, [], -5000);
          exitMarker.setMap(map);
        }

        // Put other players on the map:
        $.each(firebaseGame.values.players, function(playerID, player)
        {
          firebasePlayers[playerID] = { name: null, location: firebasePlayer.values.location };

          if(player.role == PLAYER.ROLE.FUGITIVE)
          {
            firebaseFugitivePlayer = playerID;
          }
          else
          {
            $(templates.battlefield).find('.distance .pin').clone().appendTo('.distance').attr('data-player-id', playerID).hide();
            if(playerID == firebasePlayer.uid)
            {
              $('.distance .pin[data-player-id="' + playerID + '"]').addClass('self');
            }
          }

          if(playerID == firebasePlayer.uid)
          {
            // Put the player itself on the map:
            mapMarkers.me = new PlayerMarker(firebasePlayer.values.location, firebaseGame.values.players[firebasePlayer.uid].role);
            mapMarkers.me.setMap(map);

            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/timestamp').on('value', function(playerTimestampSnapshot)
            {
              if(playerTimestampSnapshot.val() - firebasePlayer.lastTimestamp > playerMaxTimeout)
              {
                if(firebaseGame.values.players[firebasePlayer.uid].items)
                {
                  if(firebaseGame.values.players[firebasePlayer.uid].items.length > 0)
                  {
                    var items = firebaseGame.values.players[firebasePlayer.uid].items;
                    var item = items.splice(Math.floor(Math.random() * (firebaseGame.values.players[firebasePlayer.uid].items.length - 0.000001)), 1);
                    for(var k in firebaseGame.values.items)
                    {
                      if(firebaseGame.values.items[k].state == ITEM.STATE.FOUND && firebaseGame.values.items[k].type == item)
                      {
                        fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid + '/items').set(items);
                        fireDatabase.ref('games/' + firebaseGame.uid + '/items/' + k).update({ state: ITEM.STATE.LOST, location: firebasePlayer.lastLocation });
                        mapMarkers.items[k].setPosition(firebasePlayer.lastLocation);
                        mapMarkers.items[k].show();
                        notify(texts.misc.notify_lost_item_title, langArticleSet(texts.misc.notify_lost_item_body, texts.articles, texts.items[item], '1'));
                        break;
                      }
                    }
                  }
                }
              }
              firebasePlayer.lastTimestamp = playerTimestampSnapshot.val();
              firebasePlayer.lastLocation = firebasePlayer.values.location;
            });
          }
          else
          {
            // Put the other players on the map:
            mapMarkers.players[playerID] = new PlayerMarker(firebasePlayers[playerID].location, player.role);
            if(player.items)
            {
              mapMarkers.players[playerID].setItems(player.items);
            }
            mapMarkers.players[playerID].setMap(map);
            mapMarkers.players[playerID].hide();

            fireDatabase.ref('players/' + playerID + '/name').once('value').then(function(playerNameSnapshot)
            {
              firebasePlayers[playerID].name = playerNameSnapshot.val();
              mapMarkers.players[playerID].setName(firebasePlayers[playerID].name);
            });

            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/location').on('value', function(playerLocationSnapshot)
            {
              if(playerLocationSnapshot.val())
              {
                mapMarkers.players[playerID].setPosition(playerLocationSnapshot.val());
                mapMarkers.players[playerID].show();
              }
            });
          }

          if(player.role == PLAYER.ROLE.FUGITIVE && playerID != firebasePlayer.uid)
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/items').on('child_removed', function(playerItemsSnapshot)
            {
              if(playerItemsSnapshot.val() == ITEM.TYPE.MEDKIT)
              {
                var lastShot = null,
                    notificationTitle = texts.misc.notify_shot_to_title_default,
                    notificationBody = texts.misc.notify_shot_to_body_hit_default;
                for(var shotID in firebaseGame.values.shots)
                {
                  if(lastShot == null)
                  {
                    lastShot = firebaseGame.values.shots[shotID];
                  }
                  else if(lastShot.timestamp < firebaseGame.values.shots[shotID].timestamp)
                  {
                    lastShot = firebaseGame.values.shots[shotID];
                  }
                }
                if(lastShot)
                {
                  if(lastShot.by == firebasePlayer.uid)
                  {
                    notificationTitle = texts.misc.notify_shot_to_title_self;
                  }
                  else if(firebasePlayers[lastShot.by].name)
                  {
                    notificationTitle = texts.misc.notify_shot_to_title_name.replace('$1', firebasePlayers[lastShot.by].name);
                  }
                }
                if(firebasePlayers[firebaseFugitivePlayer].name)
                {
                  notificationBody = texts.misc.notify_shot_to_body_hit_name.replace('$1', firebasePlayers[firebaseFugitivePlayer].name);
                }
                notify(notificationTitle, notificationBody);
              }
            });
          }

          var initialPlayerItemsLoad = true;
          fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/items').on('value', function(playerItemsSnapshot)
          {
            if(player.role == PLAYER.ROLE.HUNTER && !initialPlayerItemsLoad && playerItemsSnapshot.val())
            {
              if(playerItemsSnapshot.val().indexOf(ITEM.TYPE.BULLET) >= 0)
              {
                var notificationTitle = texts.misc.notify_found_bullet_title_default;
                if(playerID == firebasePlayer.uid)
                {
                  notificationTitle = texts.misc.notify_found_bullet_title_self;
                }
                else if(firebasePlayers[playerID].name)
                {
                  notificationTitle = texts.misc.notify_found_bullet_title_name.replace('$1', firebasePlayers[playerID].name);
                }
                notify(notificationTitle);
              }
            }
            initialPlayerItemsLoad = false;

            if(playerID != firebasePlayer.uid && playerItemsSnapshot.val())
            {
              mapMarkers.players[playerID].setItems(playerItemsSnapshot.val());
            }

            if(player.role == PLAYER.ROLE.FUGITIVE)
            {
              $('.gmaps-venue .requirements li').removeClass('found');

              if(playerItemsSnapshot.val())
              {
                var acquired = playerItemsSnapshot.val();

                for(var i in acquired)
                {
                  $('.gmaps-venue .requirements li.' + acquired[i]).addClass('found');
                }
              }
            }
          });
          
          // Google maps might finish loading *after* the fugitive items have been loaded, causing the jQuery to have no effect. This should fix this:
          google.maps.event.addListenerOnce(map, 'idle', function(event)
          {
            for(var itemI in firebaseGame.values.players[firebaseFugitivePlayer].items)
            {
              $('.gmaps-venue .requirements li.' + firebaseGame.values.players[firebaseFugitivePlayer].items[itemI]).addClass('found');
            }
          });

          fireDatabase.ref('players/' + playerID + '/location').on('value', function(playerLocationSnapshot)
          {
            var distance = 0,
                pinsToUpdate = [];

            firebasePlayers[playerID].location = playerLocationSnapshot.val();

            if(firebaseGame.values.players[playerID].role == PLAYER.ROLE.FUGITIVE)
            {
              // Loop all other players against this one
              pinsToUpdate = Object.keys(firebasePlayers);
              pinsToUpdate.splice(pinsToUpdate.indexOf(firebaseFugitivePlayer), 1);
            }
            else if(firebaseFugitivePlayer != null)
            {
              // compare this player with fugitive
              pinsToUpdate = [playerID];
            }

            if(firebaseFugitivePlayer != null)
            {
              for(var i in pinsToUpdate)
              {
                distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(firebasePlayers[pinsToUpdate[i]].location.lat, firebasePlayers[pinsToUpdate[i]].location.lng), new google.maps.LatLng(firebasePlayers[firebaseFugitivePlayer].location.lat, firebasePlayers[firebaseFugitivePlayer].location.lng));
                if(distance < 200)
                {
                  $('.distance .pin[data-player-id="' + pinsToUpdate[i] + '"]').css({ right: (distance / 200 * 100) + '%' }).show();
                }
                else
                {
                  $('.distance .pin[data-player-id="' + pinsToUpdate[i] + '"]').hide();
                }
              }
            }

            // Updating map location only happens on very specific curcumstances:
            // - Hunter sees hunters
            // - Every 4 minutes
            // - When the fugitive picks up an item, or robs a venue
            if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER && $('.gmaps-player[data-player-id="' + playerID + '"]').hasClass(PLAYER.ROLE.HUNTER)) // TODO: Replace usage of htmlmarker for actual (firebase) data
            {
              mapMarkers.players[playerID].setPosition(playerLocationSnapshot.val());
            }
          });
        });
        
        // Keep track of players leaving the game:
        fireDatabase.ref('games/' + firebaseGame.uid + '/players').on('child_removed', function(gamePlayerSnapshot)
        {
          if(gamePlayerSnapshot.key != firebasePlayer.uid)
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + gamePlayerSnapshot.key + '/location').off('value');
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + gamePlayerSnapshot.key + '/items').off('child_removed');
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + gamePlayerSnapshot.key + '/items').off('value');
            fireDatabase.ref('players/' + gamePlayerSnapshot.key + '/location').off('value');

            mapMarkers.players[gamePlayerSnapshot.key].hide();
            mapMarkers.players[gamePlayerSnapshot.key].setMap(null);

            $('.distance .pin[data-player-id="' + gamePlayerSnapshot.key + '"]').remove();

            notify(texts.misc.notify_user_left_title.replace('$1', firebasePlayers[gamePlayerSnapshot.key].name));
          }
        });

        // Listen for changes on the player's items:
        fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid + '/items').on('value', function(playerItemsSnapshot)
        {
          var items = playerItemsSnapshot.val(),
              itemContainer = '';

          $('ul.inventory, ul.pharmacy').empty();

          if(items) // can be null...
          {
            for(var k in items)
            {
              itemContainer = 'inventory';
              if(items[k] == ITEM.TYPE.MEDKIT)
              {
                itemContainer = 'pharmacy';
              }
              $(templates.battlefield).find('ul.' + itemContainer + ' li').clone().appendTo('ul.' + itemContainer).find('i').addClass(items[k]);
            }
            if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER && items.indexOf(ITEM.TYPE.BULLET) >= 0)
            {
              $('button.fire').show();
            }
            else
            {
              $('button.fire').hide();
            }
          }
          else
          {
            $('button.fire').hide();
          }
        });

        clockInterval = setInterval(function()
        {
          var secondsPassed = (Date.now() + serverTimeOffset - firebaseGame.values.timestamp) / 1000;
          var resetsPassed = Math.floor(secondsPassed / 60 / 4);
          var date = new Date(null);

          date.setSeconds((60 * 4) - (secondsPassed - (resetsPassed * 60 * 4)));

          $('.clock').text(date.toISOString().substr(14, 5));

          if(resetsPassed > firebaseGame.values.players[firebasePlayer.uid].resets)
          {
            fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update($.extend({ resets: resetsPassed, location: firebasePlayer.values.location }, ( firebaseConnected ? { timestamp: firebase.database.ServerValue.TIMESTAMP } : {})));

            if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
            {
              notify(texts.misc.notify_clock_title, texts.misc.notify_clock_hunters_body);
            }
            else
            {
              notify(texts.misc.notify_clock_title, texts.misc.notify_clock_fugitive_body);
            }
          }
        }, 1000);

        // Listen for clicks on the items, venues and players:
        $('.battlefield').on('click', '.gmaps-item, .gmaps-venue, .gmaps-player', function()
        {
          var thisEL = $(this).get();
          $(thisEL).addClass('open');
          setTimeout(function()
          {
            $(thisEL).removeClass('open');
          }, 3000);

          // Concerns an item:
          if($(this).hasClass('gmaps-item'))
          {
            // Assume item only glows when nearby:
            if(($(this).hasClass('glow-blue') || $(this).hasClass('glow-orange')) && ((firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE && !$(this).hasClass(ITEM.TYPE.BULLET)) || (firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER && $(this).hasClass(ITEM.TYPE.BULLET))))
            {
              var k = $('.battlefield .gmaps-item').index(this),
                  items = [];
              if(firebaseGame.values.players[firebasePlayer.uid].items)
              {
                items = firebaseGame.values.players[firebasePlayer.uid].items;
              }
              // Check if item of this type is not already added to the inventory:
              if(items.indexOf(firebaseGame.values.items[k].type) < 0 || firebaseGame.values.items[k].type == ITEM.TYPE.MEDKIT)
              {
                items.push(firebaseGame.values.items[k].type);
              }
              fireDatabase.ref('games/' + firebaseGame.uid + '/items/' + k).update({ state: ITEM.STATE.FOUND });
              fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update($.extend({ items: items, location: firebasePlayer.values.location }, ( firebaseConnected ? { timestamp: firebase.database.ServerValue.TIMESTAMP } : {})));
            }
          }
          // Concerns a venue:
          else if($(this).hasClass('gmaps-venue'))
          {
            // Assume venue only glows green when nearby and all items present:
            if($(this).hasClass('glow-green') && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
            {
              if($(this).hasClass(EXIT))
              {
                // Fugitive is done!
                // GAME OVER!
                fireDatabase.ref('games/' + firebaseGame.uid).update({ state: GAME.STATE.VANISHED });
              }
              else
              {
                var k = $('.battlefield .gmaps-venue').index(this);
                fireDatabase.ref('games/' + firebaseGame.uid + '/venues/' + k).update({ state: VENUE.STATE.ROBBED });
                fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid).update($.extend({ location: firebasePlayer.values.location }, ( firebaseConnected ? { timestamp: firebase.database.ServerValue.TIMESTAMP } : {})));
                // Recalculate amount of money the fugitive has stolen!
                $(this).removeClass('glow-green');
              }
            }
          }
          // Concerns a player:
          else if($(this).hasClass('gmaps-player'))
          {
            // TODO: If click on fugitive, show 'shoot' button?
            if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER)
            {

            }
          }
        });
        
        $('button.fullscreen').on('click', function(event)
        {
          event.preventDefault();

          if($('body').fullScreen())
          {
            $('body').fullScreen(false);
            $(this).find('i.material-icons').text('fullscreen');
          }
          else
          {
            $('body').fullScreen(true);
            $(this).find('i.material-icons').text('fullscreen_exit');
          }
        });

        $('button.info').on('click', function(event)
        {
          event.preventDefault();

          $('div.info').show();
        });

        $('div.info button.close').on('click', function(event)
        {
          event.preventDefault();

          $(this).closest('div.info').hide();
        });

        $('button.fire').on('click', function(event)
        {
          event.preventDefault();

          // Hide button, the one and only bullet is used, so the button is unavailable:
          $(this).hide();

          // Calculate range:
          var distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(firebasePlayers[firebaseFugitivePlayer].location.lat, firebasePlayers[firebaseFugitivePlayer].location.lng), new google.maps.LatLng(firebasePlayers[firebasePlayer.uid].location.lat, firebasePlayers[firebasePlayer.uid].location.lng));
          
          fireDatabase.ref('games/' + firebaseGame.uid + '/shots').push({ by: firebasePlayer.uid, hit: (distance < 50), timestamp: firebase.database.ServerValue.TIMESTAMP });
          
          // Remove all items from the inventory, cause there can only be one bullet anyway:
          fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid + '/items').remove();
        });

        $('button.center').on('click', function(event)
        {
          event.preventDefault();

          $(this).hide();

          map.setCenter(new google.maps.LatLng(firebasePlayers[firebasePlayer.uid].location.lat, firebasePlayers[firebasePlayer.uid].location.lng));
          centerMapOnPlayer = true;
        }).hide();
      });
    });
  }

  function wrapUp(state)
  {
    // Start by removing all potentially created listeners. This should also prevent notification from popping up:
    fireDatabase.ref('games/' + firebaseGame.uid + '/items').off('child_changed');
    fireDatabase.ref('games/' + firebaseGame.uid + '/shots').off('child_added');
    fireDatabase.ref('games/' + firebaseGame.uid + '/state').off('value');
    fireDatabase.ref('games/' + firebaseGame.uid + '/players').off('child_removed');
    fireDatabase.ref('games/' + firebaseGame.uid + '/venues').off('child_changed');
    fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + firebasePlayer.uid + '/items').off('value');
    fireDatabase.ref('.info/connected').off('value');

    $.each(firebaseGame.values.players, function(playerID, player)
    {
      fireDatabase.ref('players/' + playerID + '/location').off('value');
      fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/items').off('child_removed');
      fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/items').off('value');
      fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/location').off('value');
      fireDatabase.ref('games/' + firebaseGame.uid + '/players/' + playerID + '/timestamp').off('value');
    });

    clearInterval(clockInterval);

    var modalTitle,
        modalBody,
        stats = '';

    if(state == GAME.STATE.VANISHED && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
    {
      modalTitle = texts.misc.notify_win_title;
      modalBody = texts.misc.notify_escaped_body;
    }
    else if(state == GAME.STATE.VANISHED && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER)
    {
      modalTitle = texts.misc.notify_lose_title;
      modalBody = texts.misc.notify_escaped_body;
    }
    else if(state == GAME.STATE.APPREHENDED && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
    {
      modalTitle = texts.misc.notify_lose_title;
      modalBody = texts.misc.notify_apprehended_body;
    }
    else if(state == GAME.STATE.APPREHENDED && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER)
    {
      modalTitle = texts.misc.notify_win_title;
      modalBody = texts.misc.notify_apprehended_body;
    }

    var duration = Date.now() + serverTimeOffset - firebaseGame.values.timestamp;
    var minutes = Math.floor(duration / 60 / 1000);
    var seconds = Math.round((duration - (minutes * 60 * 1000)) / 1000);
    var numberOfItems = '0';
    var numberOfVenues = '0';
    var numberOfBullets = '0';
    var numberOfShots = '0';
    var numberOfHits = '0';
    var lastHit = { timestamp: 0, by: null };
    var i = 0;

    if(firebaseGame.values.players[firebaseFugitivePlayer].items)
    {
      numberOfItems = firebaseGame.values.players[firebaseFugitivePlayer].items.length;
    }

    for(i in firebaseGame.values.venues)
    {
      if(firebaseGame.values.venues[i].state == VENUE.STATE.ROBBED)
      {
        numberOfVenues ++;
      }
    }

    for(i in firebaseGame.values.items)
    {
      if(firebaseGame.values.items[i].type == ITEM.TYPE.BULLET && firebaseGame.values.items[i].state == ITEM.STATE.FOUND)
      {
        numberOfBullets ++;
      }
    }

    if(firebaseGame.values.shots)
    {
      for(i in firebaseGame.values.shots)
      {
        numberOfShots ++;
        if(firebaseGame.values.shots[i].hit)
        {
          numberOfHits ++;
          if(firebaseGame.values.shots[i].timestamp > lastHit.timestamp)
          {
            lastHit = firebaseGame.values.shots[i];
          }
        }
      }
    }

    stats += '<em>' + texts.misc.stats_duration + '</em><strong>' + texts.misc.stats_minutes_seconds.replace('$1', minutes).replace('$2', seconds) + '</strong>';
    stats += '<em>' + texts.misc.stats_tools + '</em><strong>' + numberOfItems + '</strong>';
    stats += '<em>' + texts.misc.stats_venues + '</em><strong>' + numberOfVenues + '</strong>';
    stats += '<em>' + texts.misc.stats_bullets + '</em><strong>' + numberOfBullets + '</strong>';
    stats += '<em>' + texts.misc.stats_shots + '</em><strong>' + numberOfShots + '</strong>';
    stats += '<em>' + texts.misc.stats_hits + '</em><strong>' + numberOfHits + '</strong>';

    if(state == GAME.STATE.APPREHENDED && lastHit.timestamp > 0)
    {
      stats += '<em>' + texts.misc.stats_kill + '</em>';
      if(lastHit.by == firebasePlayer.uid)
      {
        stats += '<strong>' + firebasePlayer.values.name + '</strong>';
      }
      else
      {
        stats += '<strong>' + firebasePlayers[lastHit.by].name + '</strong>';
      }
    }

    $(templates.gameover).clone().find('.modal').append($('<strong>').text(modalBody)).append($('<p>').append(stats)).find('h3').text(modalTitle).closest('#gameover').appendTo('body');
    notify(modalTitle, modalBody);
  }

  function gameLoop(location) //gets called on location change if game is in GAME.STATE.ONGOING state
  {
    // Update location of player
    mapMarkers.me.setPosition({ lat: location.lat, lng: location.lng });
    if(centerMapOnPlayer)
    {
      map.setCenter(new google.maps.LatLng(location.lat, location.lng));
    }

    var distance = 0,
        glow = '';

    for(var i in firebaseGame.values.items)
    {
      if(firebaseGame.values.items[i].state == ITEM.STATE.LOST && ((firebaseGame.values.items[i].type == ITEM.TYPE.BULLET && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.HUNTER) || (firebaseGame.values.items[i].type != ITEM.TYPE.BULLET && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)))
      {
        distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(location.lat, location.lng), new google.maps.LatLng(firebaseGame.values.items[i].location.lat, firebaseGame.values.items[i].location.lng));
        if(distance < 10)
        {
          glow = 'glow-blue';
          if(firebaseGame.values.players[firebasePlayer.uid].items)
          {
            if(firebaseGame.values.items[i].type != ITEM.TYPE.MEDKIT && firebaseGame.values.players[firebasePlayer.uid].items.indexOf(firebaseGame.values.items[i].type) >= 0)
            {
              glow = 'glow-orange';
            }
          }

          $('.battlefield .gmaps-item:eq(' + i + ')').addClass(glow);
        }
        else
        {
          $('.battlefield .gmaps-item:eq(' + i + ')').removeClass('glow-blue glow-orange');
        }
      }
    }
    for(var i in firebaseGame.values.venues)
    {
      if(firebaseGame.values.venues[i].state == VENUE.STATE.ORDINARY && firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE)
      {
        distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(location.lat, location.lng), new google.maps.LatLng(firebaseGame.values.venues[i].location.lat, firebaseGame.values.venues[i].location.lng));
        if(distance < 10)
        {
          var classToAdd = 'glow-red',
              hasAllItems = true;

          if(firebaseGame.values.players[firebasePlayer.uid].items)
          {
            for(var itemI in entities.venues[i].needs)
            {
              if(firebaseGame.values.players[firebasePlayer.uid].items.indexOf(entities.venues[i].needs[itemI]) == -1)
              {
                hasAllItems = false;
                break;
              }
            }
            if(hasAllItems)
            {
              classToAdd = 'glow-green';
            }
          }
          $('.battlefield .gmaps-venue:eq(' + i + ')').addClass(classToAdd);
        }
        else
        {
          $('.battlefield .gmaps-venue:eq(' + i + ')').removeClass('glow-red').removeClass('glow-green');
        }
      }
    }
    
    if(firebaseGame.values.players[firebasePlayer.uid].role == PLAYER.ROLE.FUGITIVE && firebaseGame.values.exit)
    {
      distance = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(location.lat, location.lng), new google.maps.LatLng(firebaseGame.values.exit.location.lat, firebaseGame.values.exit.location.lng));
      if(distance < 10)
      {
        var classToAdd = 'glow-red',
            balance = 0;
        for(var i in firebaseGame.values.venues)
        {
          if(firebaseGame.values.venues[i].state == VENUE.STATE.ROBBED)
          {
            balance += entities.venues[i].needs.length * 1000;
          }
        }
        if(balance >= 5000)
        {
          classToAdd = 'glow-green';
        }
        $('.battlefield .gmaps-venue.exit').addClass(classToAdd);
      }
      else
      {
        $('.battlefield .gmaps-venue.exit').removeClass('glow-red').removeClass('glow-green');
      }
    }

    if($('.battlefield .gmaps-item.glow-blue').length > 0 || $('.battlefield .gmaps-item.glow-orange').length > 0 || $('.battlefield .gmaps-venue.glow-red').length > 0 || $('.battlefield .gmaps-venue.glow-green').length > 0)
    {
      $(mapMarkers.me.div).addClass('clickthrough');
    }
    else if($(mapMarkers.me.div).hasClass('clickthrough'))
    {
      $(mapMarkers.me.div).removeClass('clickthrough')
    }
  }

  fireDatabase.ref('version').once('value').then(function(versionSnapshot)
  {
    if(versionSnapshot.val() != PACKAGE.VERSION)
    {
      location.reload(true);
    }
  });

  fireDatabase.ref('/.info/serverTimeOffset').once('value').then(function(snapshot)
  {
    serverTimeOffset = snapshot.val();
  });

  Promise.all(
  [
    loadUserGame().then(updateVisualLoader('userdata')).then(determineGame).then(updateVisualLoader('gamedata')),
    loadGoogleMapsApi(googleMapsApiSettings).then(createCustomMarker).then(updateVisualLoader('maps')),
    checkGeolocation(onLocationChange, onInaccurateLocation).then(updateVisualLoader('locationaccess')).catch(updateVisualLoader('locationaccess', false)),
    loadTemplates('/templates.html'),
    checkBattery().then(updateVisualLoader('battery')).catch(updateVisualLoader('battery', null)),
    loadLanguageTexts().then(storeLanguageTexts).then(replaceLoadingTexts),
    checkNotifications().then(updateVisualLoader('notificationaccess')).catch(updateVisualLoader('notificationaccess', null))
  ])
  .then(evaluateChecks)
  // Game determined (or null):
  .then(enterGame)
  // Game determined, do some postprocessing and attach an eventlistener:
  .then(registerToGame)
  // Everything save! Continue to next phase
  .then(pickLocation)
  .then(managePlayers)
  .then(countdown)
  .then(battle)
  .then(wrapUp)
  .catch(function(error)
  {
    console.warn(error);
  });
});