import axios from 'axios';
import { $ } from './bling';

const mapOptions = {
  center: { lat: 43.2, lng: -79.8 },
  zoom: 10
};

function loadPlaces(map, lat = 43.2, lng = -79.8) {
  axios
    .get(`/api/stores/near?lat=${lat}&lng=${lng}`)
    .then(res => {
      const places = res.data;
      if (!places.length) {
        alert('No places found');
        return;
      }

      // create bounds for the map to fit all points in view
      const bounds = new google.maps.LatLngBounds();
      // create info window to display store info on each marker
      const infoWindow = new google.maps.InfoWindow();
      
      const markers = places.map(place => {
        const [placeLng, placeLat] = place.location.coordinates;
        const position = { lat: placeLat, lng: placeLng };
        // this lets the map bounds know all the points it needs to fit in the view
        bounds.extend(position);
        const marker = new google.maps.Marker({ map, position });
        marker.place = place;
        return marker;
      });

      // add listeners to each marker to show an info window on click
      markers.forEach(marker => { marker.addListener('click', function() {
        const html = `
          <div class="popup">
            <a href="/store/${this.place.slug}">
              <img src="/uploads/${this.place.photo || 'store.png'}" alt="${this.place.name}" />
              <p>
                ${this.place.name} - ${this.place.location.address}
              </p>
            </a>
          </div>
        `;
        // place is the object we put on each marker above
        infoWindow.setContent(html);
        // which map and marker to open on top of
        infoWindow.open(map, this);
      })});

      // then zoom the map to fit all the markers
      map.setCenter(bounds.getCenter());
      map.fitBounds(bounds);
    })
    .catch(err => console.error(err));
}

function makeMap(mapDiv) {
  if (!mapDiv) return;
  // otherwise, make our map
  const map = new google.maps.Map(mapDiv, mapOptions);
  loadPlaces(map);

  const input = $('[name="geolocate"]');
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    loadPlaces(map, place.geometry.location.lat(), place.geometry.location.lng());
  });
}

export default makeMap;