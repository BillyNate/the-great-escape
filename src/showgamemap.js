export default function showGameMap(mapElement, mapOptions)
{
console.log('showGameMap()');
return new Promise(function(resolve, reject)
{
  var map = new google.maps.Map(mapElement, mapOptions);
  resolve({ map: map });
});
}