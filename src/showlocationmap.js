export default function showLocationMap(mapElement, mapOptions)
{
  console.log('showLocationMap()');
  return new Promise(function(resolve, reject)
  {
    var map = new google.maps.Map(mapElement, mapOptions);
    var drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.CIRCLE,
        drawingControl: false,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [google.maps.drawing.OverlayType.CIRCLE]
        },
        circleOptions: { fillColor: '#999', fillOpacity: .5, strokeWeight: .5, clickable: false, editable: true, zIndex: 1 }
      });
    drawingManager.setMap(map);
    resolve({ map: map, dm: drawingManager });
  });
}