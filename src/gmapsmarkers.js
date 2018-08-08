var HTMLMarker,
    PlayerMarker,
    VenueMarker,
    ItemMarker;

function createCustomMarker()
{
  return new Promise(function(resolve, reject)
  {
    HTMLMarker = function()
    { };

    HTMLMarker.prototype = new google.maps.OverlayView();

    HTMLMarker.prototype.init = function(latlng, iconname, name)
    {
      this.lat = latlng.lat;
      this.lng = latlng.lng;
      this.pos = new google.maps.LatLng(this.lat, this.lng);
      this.iconname = iconname;
      this.name = name;
      this.div = null;
      this.visible = true;
    };

    HTMLMarker.prototype.onRemove = function()
    {
      if(this.div)
      {
        this.div.style.display = 'none';
      }
    };
    
    HTMLMarker.prototype.onAdd = function()
    {
      var panes = this.getPanes();
      if(!this.div)
      {
        var nameEl = document.createElement('span');
        nameEl.className = 'name';
        this.div = document.createElement('div');
        this.div.innerHTML = '<i class="game-icon"></i>';
        this.div.appendChild(nameEl);
        panes.overlayImage.appendChild(this.div);
        this.setDetails();
      }
      this.div.style.display = (this.visible ? 'block' : 'none');
    };

    HTMLMarker.prototype.setDetails = function()
    {
      if(this.div)
      {
        this.div.className = this.classToAdd + ' ' + this.iconname;
        this.div.getElementsByClassName('game-icon')[0].className = 'game-icon ' + this.iconname;
        this.div.getElementsByClassName('name')[0].innerHTML = this.name;
      }
    };
    
    HTMLMarker.prototype.draw = function()
    {
      var overlayProjection = this.getProjection();
      if(overlayProjection)
      {
        var position = overlayProjection.fromLatLngToDivPixel(this.pos);
        if(this.div)
        {
          this.div.style.display = (this.visible ? 'block' : 'none');
          this.div.style.left = position.x + 'px';
          this.div.style.top = position.y + 'px';
        }
      }
    };

    HTMLMarker.prototype.setPosition = function(latlng)
    {
      this.lat = latlng.lat;
      this.lng = latlng.lng;
      this.pos = new google.maps.LatLng(this.lat, this.lng);
      this.draw();
    };

    HTMLMarker.prototype.show = function()
    {
      this.visible = true;
      this.draw();
    };

    HTMLMarker.prototype.hide = function()
    {
      this.visible = false;
      this.draw();
    };

    PlayerMarker = function(latlng, iconname, name='')
    {
      this.classToAdd = 'gmaps-player';
      this.items = [];
      this.init(latlng, iconname, name);
    }
    PlayerMarker.prototype = new HTMLMarker();
    PlayerMarker.prototype.setName = function(name)
    {
      this.name = name;
      HTMLMarker.prototype.setDetails.call(this);
    };
    PlayerMarker.prototype.onAdd = function()
    {
      HTMLMarker.prototype.onAdd.call(this);
      var itemsEl = document.createElement('ul');
      itemsEl.className = 'items';
      this.div.appendChild(itemsEl);
      this.setItems(this.items);
    };
    PlayerMarker.prototype.setItems = function(items)
    {
      this.items = items;

      if(this.div)
      {
        var liEls = '';
        if(this.items)
        {
          for(var i=0; i<this.items.length; i++)
          {
            liEls += '<li class="game-icon ' + this.items[i] + '"></li>';
          }
        }
        this.div.getElementsByClassName('items')[0].innerHTML = liEls;
      }
    };

    VenueMarker = function(latlng, iconname, name, requirements=[], worth=1000, state='')
    {
      this.classToAdd = 'gmaps-venue ' + state;
      this.requirements = requirements;
      this.worth = worth;
      this.state = state;
      this.init(latlng, iconname, name);
    }
    VenueMarker.prototype = new HTMLMarker();
    VenueMarker.prototype.onAdd = function()
    {
      HTMLMarker.prototype.onAdd.call(this);
      var gainEl = document.createElement('b'),
          reqEl = document.createElement('ul'),
          liEls = '';
      gainEl.className = 'gain';
      reqEl.className = 'requirements';
      gainEl.innerHTML = '&#36; ' + this.worth;
      for(var i=0; i<this.requirements.length; i++)
      {
        liEls += '<li class="game-icon ' + this.requirements[i] + '"></li>';
      }
      reqEl.innerHTML = liEls;
      this.div.appendChild(gainEl);
      this.div.appendChild(reqEl);
    };

    ItemMarker = function(latlng, iconname, name)
    {
      this.classToAdd = 'gmaps-item';
      this.init(latlng, iconname, name);
    }
    ItemMarker.prototype = new HTMLMarker();

    resolve();
  });
}

export { HTMLMarker, PlayerMarker, VenueMarker, ItemMarker, createCustomMarker };