function getRandomLocations(center, minDistance, maxDistance, number)
{
  var returnArray = [];
  for(var i=0; i<number; i++)
  {
    returnArray[i] = google.maps.geometry.spherical.computeOffset(center, Math.random() * (maxDistance - minDistance) + minDistance, Math.random() * 360);
  }
  return returnArray;
}

function findExtremeDistance(latlng, latlngs=[], extreme=-1)
{
  if(latlngs.length <= 0)
  {
    return null;
  }

  var currentValue;
  return latlngs.reduce(function(accumulator, currentElement, currentIndex)
  {
    currentValue = { index: currentIndex, distance: google.maps.geometry.spherical.computeDistanceBetween(latlng, currentElement) };
    
    if((currentValue.distance - accumulator.distance) / Math.abs(currentValue.distance - accumulator.distance) == extreme)
    {
      return currentValue;
    }
    return accumulator;
  }, { index: 0, distance: google.maps.geometry.spherical.computeDistanceBetween(latlng, latlngs[0]) });
}

function findClosestBy(latlng, latlngs=[])
{
  return findExtremeDistance(latlng, latlngs, -1);
}

function findFurthestAway(latlng, latlngs=[])
{
  return findExtremeDistance(latlng, latlngs, 1);
}

function getEvenlyRandomLocations(center, minDistance, maxDistance, number, preExisting=[])
{
  var returnArray = [],
      sampleArray = preExisting,
      randomLoc = null,
      currentDistance;
  
  for(var i=0; i<number; i++)
  {
    randomLoc = getRandomLocations(center, minDistance, maxDistance, 10).reduce(function(accumulator, location, i, locations)
    {
      if(sampleArray.length > 0)
      {
        currentDistance = findClosestBy(location, sampleArray);
      }
      else
      {
        currentDistance = accumulator;
        currentDistance.distance = 0;
      }
      
      if(currentDistance.distance >= accumulator.distance)
      {
        currentDistance.index = i;
        currentDistance.location = location;
        return currentDistance;
      }
      return accumulator;
    }, { index: -1, distance: -1, location: null });
    returnArray.push(randomLoc.location);
    sampleArray.push(randomLoc.location);
  }
  return returnArray;
}

function loadNearestRoads(locations)
{
  return new Promise(function(resolve, reject)
  {
    var locationsString = locations.map(function(location)
    {
      return location.lat() + ',' + location.lng();
    }).join('|');

    $.get('//roads.googleapis.com/v1/nearestRoads', { points: locationsString, key: 'AIzaSyDj1NcE7259YziwZBoxXaVGaNtnmA4uBVI' }).done(function(data)
    {
      var nearestRoads = [];
      for(var i=0; i<data.snappedPoints.length; i++)
      {
        nearestRoads[data.snappedPoints[i].originalIndex] = data.snappedPoints[i].location;
      }
      // TODO: Add check & fix for unroadable locations (now giving undefined)
      resolve(nearestRoads);
    }).fail(function(error)
    {
      reject(error);
    });
  });
}

export { getRandomLocations, getEvenlyRandomLocations, loadNearestRoads };